import type { SpeckleObject } from '~/lib/viewer/helpers/sceneExplorer'

type FlattenedEntry = {
  key: string
  path: string
  value: unknown
  units?: string
}

export const COMPONENT_CODE_ALIASES = [
  '构件编码',
  '构件编号',
  'componentcode',
  'elementcode'
]

export const normalizeCodeText = (value: string) => {
  return value.toLowerCase().replace(/[\s_.:/\\()[\]{}（）-]/g, '')
}

export const formatCodeDisplayValue = (value: unknown, units?: string) => {
  if (value === null || value === undefined || value === '') return ''
  const unitsSuffix = units?.trim().length ? ` ${units}` : ''
  if (Array.isArray(value))
    return value.length ? `${value.join(', ')}${unitsSuffix}` : ''
  if (typeof value === 'object') return ''
  return `${String(value)}${unitsSuffix}`
}

export const flattenObjectEntries = (
  input: unknown,
  currentPath = '',
  entries: FlattenedEntry[] = []
): FlattenedEntry[] => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return entries

  const objectValue = input as Record<string, unknown>
  const ignoredKeys = new Set([
    '__closure',
    'displayMesh',
    'displayValue',
    'totalChildrenCount',
    '__importedUrl',
    '__parents',
    'bbox'
  ])

  for (const [key, rawValue] of Object.entries(objectValue)) {
    if (ignoredKeys.has(key)) continue

    const newPath = currentPath ? `${currentPath}.${key}` : key
    if (
      rawValue &&
      typeof rawValue === 'object' &&
      !Array.isArray(rawValue) &&
      'name' in (rawValue as Record<string, unknown>) &&
      'value' in (rawValue as Record<string, unknown>)
    ) {
      const param = rawValue as { name?: unknown; value?: unknown }
      const parameterName =
        typeof param.name === 'string' && param.name.length ? param.name : key
      entries.push({
        key: parameterName,
        path: newPath,
        value: param.value,
        units:
          'units' in param && typeof (param as { units?: unknown }).units === 'string'
            ? ((param as { units?: string }).units as string)
            : undefined
      })
      continue
    }

    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      flattenObjectEntries(rawValue, newPath, entries)
      continue
    }

    entries.push({
      key,
      path: newPath,
      value: rawValue
    })
  }

  return entries
}

/**
 * 参考 Viewer 获取构件编码的逻辑：
 * 1. 优先从构件自身属性中查找 '构件编码', '构件编号', 'componentcode', 'elementcode'
 * 2. 若无，通过 WorldTree 计算 '分类对象代码' + '空间代码' + '分部分项代码' + '序号码'
 */
export const extractComponentCode = (
  obj: SpeckleObject | null | undefined,
  worldTree?: {
    findId?: (id: string) => unknown[] | null
    getComponentCode?: (node: unknown) => string | null
  } | null,
  node?: unknown | null
): string | null => {
  if (!obj) return null

  const entries = flattenObjectEntries(obj)
  const normalizedAliases = COMPONENT_CODE_ALIASES.map(normalizeCodeText)

  // 1. 精确匹配
  const exactMatch = entries.find((entry) => {
    const keyNorm = normalizeCodeText(entry.key)
    const pathNorm = normalizeCodeText(entry.path)
    return normalizedAliases.some((alias) => keyNorm === alias || pathNorm === alias)
  })
  if (exactMatch) {
    const val = formatCodeDisplayValue(exactMatch.value, exactMatch.units)
    if (val && val !== '-') return val.trim()
  }

  // 2. 模糊匹配
  const fuzzyMatch = entries.find((entry) => {
    const keyNorm = normalizeCodeText(entry.key)
    const pathNorm = normalizeCodeText(entry.path)
    return normalizedAliases.some(
      (alias) => keyNorm.includes(alias) || pathNorm.includes(alias)
    )
  })
  if (fuzzyMatch) {
    const val = formatCodeDisplayValue(fuzzyMatch.value, fuzzyMatch.units)
    if (val && val !== '-') return val.trim()
  }

  // 3. 通过 WorldTree 获取 (拼接 分类对象代码 + 空间代码 + 分部分项代码 + 序号码)
  const targetNode =
    node ||
    (worldTree && obj.id && typeof worldTree.findId === 'function'
      ? worldTree.findId(obj.id)?.[0]
      : null)

  if (targetNode && worldTree && typeof worldTree.getComponentCode === 'function') {
    const compCode = worldTree.getComponentCode(targetNode)
    if (compCode && compCode.trim()) {
      return compCode.trim()
    }
  }

  return null
}
