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

/**
 * 空间代码「快速通道」只扫版本根对象闭包里的浅层节点。
 *
 * `__closure` 的值就是该子节点到根对象的最小深度（core 仓库的取子对象实现同样
 * 依赖这一点），而项目信息节点基本都挂在最上面一两层。把 ILIKE 的作用域从
 * 「模型全部对象」收窄到「浅层节点」，冷启动代价就从 O(模型规模) 降成一次
 * 带 LIMIT 的索引查询。
 *
 * 这里只是启发式：窗口内没找到「项目信息」节点时，会回退到原有的全闭包扫描，
 * 因此对导出结构异常的老数据仍然保持原有语义（只是退回原来的耗时）。
 */
const SHALLOW_SPACE_CODE_MAX_DEPTH = 2

/**
 * 模型 -> 空间代码 的进程内缓存。
 *
 * 缓存键里带上了该模型的最新 commitId：版本一变键就变，模型重新导入/新增版本后
 * 自动失效，因此不需要任何显式清理逻辑，TTL 只用于回收内存。
 */
const MODEL_SPACE_CODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MODEL_SPACE_CODE_CACHE_MAX_ENTRIES = 2000

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

type PropertyEntry = {
  key: string
  path: string
  value: any
}

const chunkList = <T>(list: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size))
  return chunks
}

/** pg 可能把 jsonb 以字符串返回，统一在这里解析（构件编码索引重建也复用它） */
export const parseObjectData = (data: unknown): any => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  return data ?? null
}

/** 归一化键名/路径：忽略大小写、空格与常见分隔符 */
const normalizeKeyText = (value: string) =>
  value.toLowerCase().replace(/[\s_.:/\\()[\]{}（）-]/g, '')

/** 展平时跳过这些重型/无关字段（网格、包围盒等），否则会拖垮解析 */
const IGNORED_FLATTEN_KEYS = [
  '__closure',
  'displayMesh',
  'displayValue',
  'totalChildrenCount',
  '__importedUrl',
  '__parents',
  'bbox'
]

/**
 * 把构件对象的参数树展平成属性列表。
 *
 * 同时兼容 Speckle 的 `{ name, value }` 参数节点与普通键值对。整个对象只展平
 * **一次**，供后续按多个别名查找复用——此前每取一个属性都会重新递归整棵树，
 * 解析一个构件要展平 5 次。
 */
export const flattenObjectPropertyEntries = (raw: any): PropertyEntry[] => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []

  const entries: PropertyEntry[] = []
  const visited = new Set()

  const flatten = (obj: any, currentPath = '') => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || visited.has(obj))
      return
    visited.add(obj)

    for (const [key, rawValue] of Object.entries(obj)) {
      if (IGNORED_FLATTEN_KEYS.includes(key)) continue

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

  return entries
}

const formatPropertyValue = (value: any): string | null => {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value)) return value.length ? value.join(', ') : null
  if (typeof value === 'object') return null
  return String(value)
}

/**
 * 在已展平的属性列表上按别名查找：先全等匹配，再包含匹配。
 * 语义与旧的 `getPropertyValue` 逐字一致（包括「全等命中即使格式化为 null
 * 也不再降级到包含匹配」这一细节）。
 */
const findPropertyValue = (
  entries: PropertyEntry[],
  aliases: string[]
): string | null => {
  const normalizedAliases = aliases.map(normalizeKeyText)

  const exactMatch = entries.find((entry) => {
    const keyNorm = normalizeKeyText(entry.key)
    const pathNorm = normalizeKeyText(entry.path)
    return normalizedAliases.some((alias) => keyNorm === alias || pathNorm === alias)
  })
  if (exactMatch) return formatPropertyValue(exactMatch.value)

  const fuzzyMatch = entries.find((entry) => {
    const keyNorm = normalizeKeyText(entry.key)
    const pathNorm = normalizeKeyText(entry.path)
    return normalizedAliases.some(
      (alias) => keyNorm.includes(alias) || pathNorm.includes(alias)
    )
  })
  if (fuzzyMatch) return formatPropertyValue(fuzzyMatch.value)

  return null
}

/**
 * 从构件对象的参数树中按别名提取属性值。
 *
 * 同时兼容 Speckle 的 `{ name, value }` 参数节点与普通键值对，
 * 并对键名/路径做归一化（忽略大小写、空格与常见分隔符）。
 */
export const getPropertyValue = (raw: any, aliases: string[]): string | null =>
  findPropertyValue(flattenObjectPropertyEntries(raw), aliases)

/**
 * 在已展平的属性列表上解析构件编码。
 *
 * 编码规则与外部查询接口保持一致：优先读取构件自身的「构件编码」，缺失时按
 * 「分类对象代码 + 空间代码 + 分部分项代码 + 序号码」拼接（空间代码缺省时
 * 回退到调用方传入的默认空间代码）。
 */
const extractComponentCodeFromEntries = (
  entries: PropertyEntry[],
  options: { defaultSpaceCode?: string } = {}
): string | null => {
  const directCode = findPropertyValue(entries, [
    '构件编码',
    'componentcode',
    'bimcode'
  ])

  const classCode =
    findPropertyValue(entries, ['分类对象代码', 'classificationobjectcode']) || ''
  const sectionCode =
    findPropertyValue(entries, ['分部分项代码', 'sectionitemcode']) || ''
  const serialNum = findPropertyValue(entries, ['序号码', '序号', 'serialnumber']) || ''
  const spaceCode =
    findPropertyValue(entries, SPACE_CODE_ALIASES) || options.defaultSpaceCode || ''

  const fullCode =
    directCode ||
    (classCode && (serialNum || sectionCode)
      ? `${classCode}${spaceCode}${sectionCode}${serialNum}`
      : '')

  return fullCode || null
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
): string | null =>
  extractComponentCodeFromEntries(flattenObjectPropertyEntries(data), options)

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

const modelSpaceCodeCache = new Map<string, { code: string; expiresAt: number }>()

/** 清空模型空间代码缓存（测试与模型重新导入后使用） */
export const clearModelSpaceCodeCache = () => modelSpaceCodeCache.clear()

const cacheModelSpaceCode = (cacheKey: string, code: string) => {
  const now = Date.now()

  for (const [key, entry] of modelSpaceCodeCache) {
    if (entry.expiresAt <= now) modelSpaceCodeCache.delete(key)
  }

  while (modelSpaceCodeCache.size >= MODEL_SPACE_CODE_CACHE_MAX_ENTRIES) {
    const oldestKey = modelSpaceCodeCache.keys().next().value
    if (!oldestKey) break
    modelSpaceCodeCache.delete(oldestKey)
  }

  modelSpaceCodeCache.set(cacheKey, {
    code,
    expiresAt: now + MODEL_SPACE_CODE_CACHE_TTL_MS
  })
}

/** 取模型（branch）最新版本，用于定位根对象并作为缓存失效键 */
const getLatestCommit = async (
  projectDb: Knex,
  projectId: string,
  modelId: string
): Promise<{ commitId?: string; referencedObject?: string } | undefined> => {
  return (
    (await projectDb('commits')
      .join('branch_commits', 'branch_commits.commitId', 'commits.id')
      .join('branches', 'branches.id', 'branch_commits.branchId')
      .where('branch_commits.branchId', modelId)
      .andWhere('branches.streamId', projectId)
      .orderBy('commits.createdAt', 'desc')
      // 加一个确定性 tiebreaker：构件编码索引的新鲜度判断依赖「同一个模型最新版本」
      // 在新旧两处代码里取到同一行
      .orderBy('commits.id', 'desc')
      .select('commits.id as commitId', 'commits.referencedObject as referencedObject')
      .first()) as { commitId?: string; referencedObject?: string } | undefined
  )
}

/**
 * 快速通道：只在该版本闭包的浅层节点里找「项目信息」节点。
 *
 * 与下面的全闭包扫描相比，这里把 ILIKE 的扫描范围从「模型全部对象」收窄到
 * 「深度 <= SHALLOW_SPACE_CODE_MAX_DEPTH 的节点」，且只发一条 SQL
 * （原来要按 500 一批地把整个闭包捞回来）。
 */
const findShallowProjectInfoSpaceCode = async (
  projectDb: Knex,
  projectId: string,
  rootObjectId: string
): Promise<string | null> => {
  try {
    const rows = (await projectDb('objects as root')
      .joinRaw(`JOIN jsonb_each_text(root.data->'__closure') AS d ON true`)
      .join('objects as o', function (this: any) {
        this.on('o.streamId', '=', 'root.streamId').andOn('o.id', '=', 'd.key')
      })
      .where('root.streamId', projectId)
      .andWhere('root.id', rootObjectId)
      // __closure 的值是深度。用 CASE 而不是 `x ~ '...' AND (x)::int <= ?`：
      // WHERE 里各条件的求值顺序并不保证，脏数据会让 ::int 先执行而整条查询报错。
      // CASE 保证只有匹配数字正则的分支才会真的转型（非数字落到 int4 上限被过滤掉）。
      .andWhereRaw(
        `(CASE WHEN d.value ~ '^[0-9]+$' THEN (d.value)::int ELSE 2147483647 END) <= ?`,
        [SHALLOW_SPACE_CODE_MAX_DEPTH]
      )
      .andWhere(function (this: any) {
        this.whereRaw('o.data::text ILIKE ?', ['%空间代码%']).orWhereRaw(
          'o.data::text ILIKE ?',
          ['%spacecode%']
        )
      })
      .orderByRaw('(d.value)::int asc, o.id asc')
      .select('o.id as id', 'o.data as data')) as Array<{ data?: unknown }>

    for (const row of rows) {
      const data = parseObjectData(row.data)
      const spaceCode = getPropertyValue(data, SPACE_CODE_ALIASES)
      if (!spaceCode) continue
      if (looksLikeProjectInfoNode(data)) return spaceCode
    }

    return null
  } catch (err) {
    // 快速通道只是优化：失败就让调用方走全量扫描
    console.error('Failed to resolve shallow model space code:', err)
    return null
  }
}

/**
 * 全闭包扫描（原有实现，作为快速通道的兜底）。
 *
 * 闭包内可能有多个带空间代码的节点：优先「项目信息」节点，
 * 其余情况按 id 排序取第一个，保证同一份数据每次得到相同结果。
 */
const scanClosureForSpaceCode = async (
  projectDb: Knex,
  projectId: string,
  rootData: any
): Promise<string | null> => {
  const closure = rootData?.__closure
  const candidateIds =
    closure && typeof closure === 'object' && !Array.isArray(closure)
      ? Object.keys(closure)
      : []
  if (!candidateIds.length) return null

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
}

/** 解析某个版本（commit 根对象）自己的默认空间代码。构件编码索引重建时也复用它 */
export const resolveSpaceCodeForCommit = async (
  projectDb: Knex,
  projectId: string,
  rootObjectId: string
): Promise<string | null> => {
  const rootRow = (await projectDb('objects')
    .where('streamId', projectId)
    .andWhere('id', rootObjectId)
    .select('data')
    .first()) as { data?: unknown } | undefined

  const rootData = parseObjectData(rootRow?.data)

  // 根对象自己带空间代码时直接命中（单次主键查询）
  const rootSpaceCode = getPropertyValue(rootData, SPACE_CODE_ALIASES)
  if (rootSpaceCode) return rootSpaceCode

  const shallowSpaceCode = await findShallowProjectInfoSpaceCode(
    projectDb,
    projectId,
    rootObjectId
  )
  if (shallowSpaceCode) return shallowSpaceCode

  // 浅层窗口内没有「项目信息」节点时，保持原有的全闭包语义
  return scanClosureForSpaceCode(projectDb, projectId, rootData)
}

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
    const latestCommit = await getLatestCommit(projectDb, projectId, modelId)
    const rootObjectId = latestCommit?.referencedObject
    if (!rootObjectId) return null

    return await resolveSpaceCodeForCommit(projectDb, projectId, rootObjectId)
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
  const latestCommit = await getLatestCommit(projectDb, projectId, modelId)
  const rootObjectId = latestCommit?.referencedObject
  if (!latestCommit?.commitId || !rootObjectId) return null

  // 缓存键带 commitId：模型新增版本后自动 miss，不需要显式失效
  const cacheKey = `${projectId}:${modelId}:${latestCommit.commitId}`
  const cached = modelSpaceCodeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.code

  const spaceCode = await resolveSpaceCodeForCommit(projectDb, projectId, rootObjectId)

  // 只缓存命中结果：解析失败（例如模型刚导入、版本还没落库）不做负缓存
  if (spaceCode) cacheModelSpaceCode(cacheKey, spaceCode)

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
 * 按构件标识把 objects 捞回来。
 *
 * 这里刻意保留 `id IN (...) OR data->>'applicationId' IN (...)` 的单条 OR 查询，
 * 而不是拆成两条（实测结论，2026-10）：
 *
 * - 只要 `objects_stream_appid_idx` 存在，planner 会用 `BitmapOr` 同时走
 *   `(streamId, id)` 主键和该表达式索引，一条 SQL 就够，且只做一次 bitmap heap scan；
 * - 拆成两条反而更差：多一轮往返，而且 `id IN (...)` 这条在中小表上会退化成
 *   顺序扫描（52k 对象时实测 68.6ms → 114.5ms，中位数复现）。
 *
 * 真正让这段查询从「每个批次扫一遍整个项目」变成索引命中的是那个表达式索引
 * （无索引基线：52k 431.7ms / 200k 417.0ms）。索引缺失时的对照见基准记录。
 */
const loadObjectsByComponentIds = async (
  projectDb: Knex,
  projectId: string,
  applicationIds: string[]
): Promise<any[]> => {
  const objects: any[] = []

  for (const batch of chunkList(applicationIds, OBJECT_QUERY_BATCH_SIZE)) {
    const batchObjects = (await projectDb('objects')
      .where('streamId', projectId)
      .andWhere(function (this: any) {
        this.whereIn('id', batch).orWhereRaw(
          `data->>'applicationId' IN (${batch.map(() => '?').join(',')})`,
          batch
        )
      })
      .select('id', 'data')) as any[]
    objects.push(...batchObjects)
  }

  return objects
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

    const objects = await loadObjectsByComponentIds(
      projectDb,
      projectId,
      applicationIds
    )

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
