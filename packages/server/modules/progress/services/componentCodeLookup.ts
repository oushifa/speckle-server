/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Knex } from 'knex'

/**
 * 从构件对象的参数树中按别名提取属性值。
 *
 * 同时兼容 Speckle 的 `{ name, value }` 参数节点与普通键值对，
 * 并对键名/路径做归一化（忽略大小写、空格与常见分隔符）。
 */
export const getPropertyValue = (raw: any, aliases: string[]): string | null => {
  if (!raw || typeof raw !== 'object') return null

  const clean = (val: string) =>
    val.toLowerCase().replace(/[\s_.:/\\()[\]{}（）-]/g, '')
  const normalizedAliases = aliases.map(clean)

  const entries: Array<{ key: string; path: string; value: any }> = []
  const visited = new Set()

  const flatten = (obj: any, currentPath = '') => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || visited.has(obj))
      return
    visited.add(obj)

    const ignoredKeys = [
      '__closure',
      'displayMesh',
      'displayValue',
      'totalChildrenCount',
      '__importedUrl',
      '__parents',
      'bbox'
    ]

    for (const [key, rawValue] of Object.entries(obj)) {
      if (ignoredKeys.includes(key)) continue

      const newPath = currentPath ? `${currentPath}.${key}` : key

      if (
        rawValue &&
        typeof rawValue === 'object' &&
        !Array.isArray(rawValue) &&
        'name' in rawValue &&
        'value' in rawValue
      ) {
        const param = rawValue as { name?: any; value?: any }
        const parameterName =
          typeof param.name === 'string' && param.name.length ? param.name : key
        entries.push({
          key: parameterName,
          path: newPath,
          value: param.value
        })
        continue
      }

      if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        flatten(rawValue, newPath)
        continue
      }

      entries.push({
        key,
        path: newPath,
        value: rawValue
      })
    }
  }

  flatten(raw)

  const formatVal = (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null
    if (Array.isArray(value)) return value.length ? value.join(', ') : null
    if (typeof value === 'object') return null
    return String(value)
  }

  const exactMatch = entries.find((entry) => {
    const keyNorm = clean(entry.key)
    const pathNorm = clean(entry.path)
    return normalizedAliases.some((alias) => keyNorm === alias || pathNorm === alias)
  })
  if (exactMatch) return formatVal(exactMatch.value)

  const fuzzyMatch = entries.find((entry) => {
    const keyNorm = clean(entry.key)
    const pathNorm = clean(entry.path)
    return normalizedAliases.some(
      (alias) => keyNorm.includes(alias) || pathNorm.includes(alias)
    )
  })
  if (fuzzyMatch) return formatVal(fuzzyMatch.value)

  return null
}

/**
 * 构件编码反查表：`applicationId` / 对象 `id` -> 完整构件编码。
 *
 * 编码规则与前端 Viewer、外部查询接口保持一致：
 * 优先读取构件自身的「构件编码」，缺失时按
 * 「分类对象代码 + 空间代码 + 分部分项代码 + 序号码」拼接（空间代码缺省时
 * 回退到模型的项目信息节点）。
 *
 * @param projectDb 项目库连接
 * @param projectId 项目（stream）id
 * @param applicationIds 待反查的构件标识（applicationId / Revit UniqueId / 对象 id）
 */
export const buildComponentCodeLookup = async (
  projectDb: Knex,
  projectId: string,
  applicationIds: string[]
): Promise<Map<string, string>> => {
  const lookup = new Map<string, string>()
  if (!applicationIds.length) return lookup

  try {
    const chunks: string[][] = []
    for (let i = 0; i < applicationIds.length; i += 500) {
      chunks.push(applicationIds.slice(i, i + 500))
    }

    const objects: any[] = []
    for (const batch of chunks) {
      const batchObjects = await projectDb('objects')
        .where('streamId', projectId)
        .andWhere(function (this: any) {
          this.whereIn('id', batch).orWhereRaw(
            `data->>'applicationId' IN (${batch.map(() => '?').join(',')})`,
            batch
          )
        })
        .select('id', 'data')
      objects.push(...batchObjects)
    }

    const projectInfoNodes = await projectDb('objects')
      .where('streamId', projectId)
      .andWhere(function (this: any) {
        this.whereRaw(
          'data::text ILIKE ? OR data::text ILIKE ? OR data::text ILIKE ? OR data::text ILIKE ? OR data::text ILIKE ?',
          [
            '%空间代码%',
            '%spacecode%',
            '%项目信息%',
            '%project information%',
            '%project info%'
          ]
        )
      })
      .select('id', 'data')

    let defaultSpaceCode = ''
    for (const pin of projectInfoNodes) {
      const data = typeof pin.data === 'string' ? JSON.parse(pin.data) : pin.data
      const sc = getPropertyValue(data, ['空间代码', 'spacecode'])
      if (sc) {
        defaultSpaceCode = sc
        break
      }
    }

    for (const obj of objects) {
      const data = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data
      const directCode = getPropertyValue(data, [
        '构件编码',
        'componentcode',
        'bimcode'
      ])

      const classCode =
        getPropertyValue(data, ['分类对象代码', 'classificationobjectcode']) || ''
      const sectionCode =
        getPropertyValue(data, ['分部分项代码', 'sectionitemcode']) || ''
      const serialNum = getPropertyValue(data, ['序号码', '序号', 'serialnumber']) || ''
      const spaceCode =
        getPropertyValue(data, ['空间代码', 'spacecode']) || defaultSpaceCode || ''

      let fullBimCode = directCode || ''
      if (!fullBimCode && classCode && (serialNum || sectionCode)) {
        fullBimCode = `${classCode}${spaceCode}${sectionCode}${serialNum}`
      }

      if (fullBimCode) {
        lookup.set(obj.id, fullBimCode)

        const appId =
          data.applicationId || data.properties?.Attributes?.GlobalId || data.GlobalId
        if (appId && typeof appId === 'string') {
          lookup.set(appId, fullBimCode)
        }
      }
    }
  } catch (err) {
    console.error('Failed to build component code lookup:', err)
  }

  return lookup
}
