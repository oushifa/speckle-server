/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Knex } from 'knex'

const SPACE_CODE_ALIASES = ['空间代码', 'spacecode']

/**
 * 「项目信息」节点的识别标记。一个模型内可能只有部分节点带空间代码，
 * 优先取「项目信息」节点上的值作为该模型的默认空间代码，与前端 Viewer 口径一致。
 */
const PROJECT_INFO_MARKERS = [
  '项目信息',
  'project information',
  'project info',
  'ifcsite',
  'ifcproject',
  'ost_projectinformation'
]

const OBJECT_QUERY_BATCH_SIZE = 500

/** 模型 -> 空间代码 的进程内缓存时长（模型空间代码是低频变更数据） */
const MODEL_SPACE_CODE_CACHE_TTL_MS = 10 * 60 * 1000
const MODEL_SPACE_CODE_CACHE_MAX_ENTRIES = 500

/**
 * 构件编码反查入参：某个模型下的一批构件标识。
 *
 * 必须携带 `modelId`，否则构件自身没有「空间代码」时会退回到「全项目第一个
 * 项目信息节点」的口径——多模型项目里该口径取到哪个模型的空间代码是不确定的。
 */
export type ComponentCodeLookupInput = {
  modelId?: string | null
  applicationIds?: string[] | null
}

type NormalizedLookupInput = {
  applicationIds: string[]
  modelIdByApplicationId: Map<string, string>
}

const chunkList = <T>(list: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size))
  return chunks
}

const parseObjectData = (data: unknown): any => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  return data ?? null
}

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
 * 从单个构件对象的 `data` 中解析构件编码。
 *
 * 编码规则与外部查询接口保持一致：
 * 优先读取构件自身的「构件编码」，缺失时按
 * 「分类对象代码 + 空间代码 + 分部分项代码 + 序号码」拼接（空间代码缺省时
 * 回退到调用方传入的默认空间代码）。
 */
export const extractComponentCodeFromObjectData = (
  data: unknown,
  options: { defaultSpaceCode?: string } = {}
): string | null => {
  const directCode = getPropertyValue(data, ['构件编码', 'componentcode', 'bimcode'])

  const classCode =
    getPropertyValue(data, ['分类对象代码', 'classificationobjectcode']) || ''
  const sectionCode = getPropertyValue(data, ['分部分项代码', 'sectionitemcode']) || ''
  const serialNum = getPropertyValue(data, ['序号码', '序号', 'serialnumber']) || ''
  const spaceCode =
    getPropertyValue(data, SPACE_CODE_ALIASES) || options.defaultSpaceCode || ''

  const fullCode =
    directCode ||
    (classCode && (serialNum || sectionCode)
      ? `${classCode}${spaceCode}${sectionCode}${serialNum}`
      : '')

  return fullCode || null
}

const looksLikeProjectInfoNode = (data: any): boolean => {
  if (!data) return false
  let text: string
  try {
    text = typeof data === 'string' ? data : JSON.stringify(data)
  } catch {
    return false
  }
  const normalized = text.toLowerCase()
  return PROJECT_INFO_MARKERS.some((marker) => normalized.includes(marker))
}

const modelSpaceCodeCache = new Map<
  string,
  { code: string | null; expiresAt: number }
>()

/** 清空模型空间代码缓存（测试与模型重新导入后使用） */
export const clearModelSpaceCodeCache = () => modelSpaceCodeCache.clear()

/**
 * 解析某个模型自己的默认空间代码。
 *
 * 数据来源：该模型最新版本的根对象闭包（`data.__closure`）内，带「空间代码」
 * 的节点；优先取「项目信息」节点。多模型项目里各模型的空间代码可能不同
 * （例如同一项目下 `NB0101` / `NB0102`），因此**不能**在项目维度取第一个。
 */
export const resolveModelSpaceCode = async (
  projectDb: Knex,
  projectId: string,
  modelId: string
): Promise<string | null> => {
  if (!projectId || !modelId) return null

  try {
    const latestCommit = (await projectDb('commits')
      .join('branch_commits', 'branch_commits.commitId', 'commits.id')
      .join('branches', 'branches.id', 'branch_commits.branchId')
      .where('branch_commits.branchId', modelId)
      .andWhere('branches.streamId', projectId)
      .orderBy('commits.createdAt', 'desc')
      .select('commits.referencedObject')
      .first()) as { referencedObject?: string } | undefined

    const rootObjectId = latestCommit?.referencedObject
    if (!rootObjectId) return null

    const rootRow = (await projectDb('objects')
      .where('streamId', projectId)
      .andWhere('id', rootObjectId)
      .select('data')
      .first()) as { data?: unknown } | undefined

    const rootData = parseObjectData(rootRow?.data)
    const rootSpaceCode = getPropertyValue(rootData, SPACE_CODE_ALIASES)
    if (rootSpaceCode) return rootSpaceCode

    const closure = rootData?.__closure
    const candidateIds =
      closure && typeof closure === 'object' && !Array.isArray(closure)
        ? Object.keys(closure)
        : []
    if (!candidateIds.length) return null

    // 闭包内可能有多个带空间代码的节点：优先「项目信息」节点，
    // 其余情况按 id 排序取第一个，保证同一份数据每次得到相同结果。
    let fallbackSpaceCode: string | null = null
    for (const batch of chunkList(candidateIds, OBJECT_QUERY_BATCH_SIZE)) {
      const rows = (await projectDb('objects')
        .where('streamId', projectId)
        .whereIn('id', batch)
        .andWhere(function (this: any) {
          this.whereRaw('data::text ILIKE ?', ['%空间代码%']).orWhereRaw(
            'data::text ILIKE ?',
            ['%spacecode%']
          )
        })
        .orderBy('id', 'asc')
        .select('id', 'data')) as Array<{ data?: unknown }>

      for (const row of rows) {
        const data = parseObjectData(row.data)
        const spaceCode = getPropertyValue(data, SPACE_CODE_ALIASES)
        if (!spaceCode) continue
        if (looksLikeProjectInfoNode(data)) return spaceCode
        if (!fallbackSpaceCode) fallbackSpaceCode = spaceCode
      }
    }

    return fallbackSpaceCode
  } catch (err) {
    console.error('Failed to resolve model space code:', err)
    return null
  }
}

const getModelSpaceCode = async (
  projectDb: Knex,
  projectId: string,
  modelId: string
): Promise<string | null> => {
  const cacheKey = `${projectId}:${modelId}`
  const cached = modelSpaceCodeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.code

  const spaceCode = await resolveModelSpaceCode(projectDb, projectId, modelId)

  // 只缓存命中结果：解析失败（例如模型刚导入、版本还没落库）不做负缓存
  if (spaceCode) {
    if (modelSpaceCodeCache.size >= MODEL_SPACE_CODE_CACHE_MAX_ENTRIES) {
      const oldestKey = modelSpaceCodeCache.keys().next().value
      if (oldestKey) modelSpaceCodeCache.delete(oldestKey)
    }
    modelSpaceCodeCache.set(cacheKey, {
      code: spaceCode,
      expiresAt: Date.now() + MODEL_SPACE_CODE_CACHE_TTL_MS
    })
  }

  return spaceCode
}

/**
 * 项目级兜底空间代码：模型信息无法解析时（老数据、未落 commits 的模型）沿用
 * 「项目内第一个带空间代码的节点」口径，但按 id 排序，保证结果稳定。
 */
const getProjectWideSpaceCode = async (
  projectDb: Knex,
  projectId: string
): Promise<string> => {
  try {
    const rows = (await projectDb('objects')
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
      .orderBy('id', 'asc')
      .select('id', 'data')) as Array<{ data?: unknown }>

    for (const row of rows) {
      const spaceCode = getPropertyValue(parseObjectData(row.data), SPACE_CODE_ALIASES)
      if (spaceCode) return spaceCode
    }

    return ''
  } catch (err) {
    console.error('Failed to resolve project space code:', err)
    return ''
  }
}

const normalizeLookupInput = (
  input: ComponentCodeLookupInput[] | string[]
): NormalizedLookupInput => {
  const applicationIds = new Set<string>()
  const modelIdByApplicationId = new Map<string, string>()

  const addApplicationIds = (modelId: string | null, ids: unknown) => {
    if (!Array.isArray(ids)) return
    ids.forEach((id) => {
      if (typeof id !== 'string') return
      const trimmed = id.trim()
      if (!trimmed) return
      applicationIds.add(trimmed)
      if (modelId && !modelIdByApplicationId.has(trimmed)) {
        modelIdByApplicationId.set(trimmed, modelId)
      }
    })
  }

  if (!Array.isArray(input) || !input.length) {
    return { applicationIds: [], modelIdByApplicationId }
  }

  if (input.every((item) => typeof item === 'string')) {
    addApplicationIds(null, input)
    return { applicationIds: Array.from(applicationIds), modelIdByApplicationId }
  }

  ;(input as ComponentCodeLookupInput[]).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return
    const modelId =
      typeof entry.modelId === 'string' && entry.modelId.trim()
        ? entry.modelId.trim()
        : null
    addApplicationIds(modelId, entry.applicationIds)
  })

  return { applicationIds: Array.from(applicationIds), modelIdByApplicationId }
}

/**
 * 构件编码反查表：`applicationId` / 对象 `id` -> 完整构件编码。
 *
 * @param projectDb 项目库连接
 * @param projectId 项目（stream）id
 * @param input 构件标识，可携带其所属 `modelId`（推荐）。构件自身没有空间代码时，
 *   会先按所属模型的空间代码回退，模型信息缺失时才退回到项目级兜底值。
 */
export const buildComponentCodeLookup = async (
  projectDb: Knex,
  projectId: string,
  input: ComponentCodeLookupInput[] | string[]
): Promise<Map<string, string>> => {
  const lookup = new Map<string, string>()
  const { applicationIds, modelIdByApplicationId } = normalizeLookupInput(input)
  if (!applicationIds.length) return lookup

  try {
    const spaceCodeByModelId = new Map<string, string>()
    for (const modelId of new Set(modelIdByApplicationId.values())) {
      const spaceCode = await getModelSpaceCode(projectDb, projectId, modelId)
      if (spaceCode) spaceCodeByModelId.set(modelId, spaceCode)
    }

    let projectWideSpaceCode: string | null = null
    const resolveFallbackSpaceCode = async () => {
      if (projectWideSpaceCode === null) {
        projectWideSpaceCode = await getProjectWideSpaceCode(projectDb, projectId)
      }
      return projectWideSpaceCode
    }

    const objects: any[] = []
    for (const batch of chunkList(applicationIds, OBJECT_QUERY_BATCH_SIZE)) {
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

    for (const obj of objects) {
      const data = parseObjectData(obj.data)
      const ownSpaceCode = getPropertyValue(data, SPACE_CODE_ALIASES)

      const resolveObjectModelId = (): string | undefined => {
        const direct = modelIdByApplicationId.get(obj.id)
        if (direct) return direct

        const candidateIds: unknown[] = [
          data?.applicationId,
          data?.properties?.Attributes?.GlobalId,
          data?.GlobalId
        ]
        for (const candidate of candidateIds) {
          if (typeof candidate !== 'string' || !candidate) continue
          const modelId = modelIdByApplicationId.get(candidate)
          if (modelId) return modelId
        }

        return undefined
      }

      let defaultSpaceCode = ''
      if (!ownSpaceCode) {
        const modelId = resolveObjectModelId()
        defaultSpaceCode =
          (modelId ? spaceCodeByModelId.get(modelId) : undefined) ||
          (await resolveFallbackSpaceCode()) ||
          ''
      }

      const code = extractComponentCodeFromObjectData(data, { defaultSpaceCode })

      if (code) {
        lookup.set(obj.id, code)

        const appId =
          data?.applicationId ||
          data?.properties?.Attributes?.GlobalId ||
          data?.GlobalId
        if (appId && typeof appId === 'string') {
          lookup.set(appId, code)
        }
      }
    }
  } catch (err) {
    console.error('Failed to build component code lookup:', err)
  }

  return lookup
}
