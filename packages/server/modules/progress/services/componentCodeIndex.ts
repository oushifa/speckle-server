/* eslint-disable @typescript-eslint/no-explicit-any, camelcase */
import type { Knex } from 'knex'
import {
  buildComponentCodeLookup,
  extractComponentCodeFromObjectData,
  parseObjectData,
  resolveSpaceCodeForCommit,
  type ComponentCodeLookupInput
} from '@/modules/progress/services/componentCodeLookup'

/**
 * 构件编码索引：把「构件编码 <-> applicationId」的解析结果物化下来，
 * 让读路径彻底不碰 objects。
 *
 * 可信前提（很重要）：只有当某模型的切片版本（`commit_id`）与该模型**当前最新
 * 版本**一致时，才允许信任索引；否则该模型自动回退到实时解析。
 * 这样即使重建漏跑、失败或落后，最差也只是退化成改动前的性能，而不是静默返回
 * 「查不到」。
 */

const TABLE = 'component_code_index'
/** application_id 为 '' 的行是切片状态行（component_code 也是 ''） */
const STATE_APPLICATION_ID = ''

const chunkList = <T>(list: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size))
  return chunks
}

const uniqueNonEmpty = (values: Array<string | null | undefined>): string[] => {
  const set = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) set.add(trimmed)
  }
  return Array.from(set)
}

/**
 * 与实时解析保持一致：一个构件会同时以「对象 id」和「它的
 * applicationId / GlobalId」两个键对外可查。
 */
const getApplicationIdFromData = (data: any): string | null => {
  const candidate =
    data?.applicationId ?? data?.properties?.Attributes?.GlobalId ?? data?.GlobalId
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

export type LatestModelCommit = {
  commitId: string
  referencedObject: string
}

export type IndexedModelCommit = {
  commitId: string
  updatedAt: Date | null
}

type ComponentCodeIndexRow = {
  project_id: string
  model_id: string
  commit_id: string
  application_id: string
  object_id: string | null
  component_code: string
}

/** 各模型当前最新版本（与 componentCodeLookup 里的取法保持同一排序） */
export const getLatestModelCommitsFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    projectId: string
    modelIds: string[]
  }): Promise<Map<string, LatestModelCommit>> => {
    const result = new Map<string, LatestModelCommit>()
    const modelIds = uniqueNonEmpty(params.modelIds)
    if (!modelIds.length) return result

    const rows = (await db('commits')
      .join('branch_commits', 'branch_commits.commitId', 'commits.id')
      .join('branches', 'branches.id', 'branch_commits.branchId')
      .where('branches.streamId', params.projectId)
      .whereIn('branch_commits.branchId', modelIds)
      .orderBy('branch_commits.branchId', 'asc')
      .orderBy('commits.createdAt', 'desc')
      .orderBy('commits.id', 'desc')
      .select(
        'branch_commits.branchId as modelId',
        'commits.id as commitId',
        'commits.referencedObject as referencedObject'
      )) as Array<{ modelId: string; commitId: string; referencedObject: string }>

    for (const row of rows) {
      if (result.has(row.modelId)) continue
      result.set(row.modelId, {
        commitId: row.commitId,
        referencedObject: row.referencedObject
      })
    }

    return result
  }

/** 各模型已建好的切片版本（状态行） */
export const getIndexedModelCommitsFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    projectId: string
    modelIds: string[]
  }): Promise<Map<string, IndexedModelCommit>> => {
    const result = new Map<string, IndexedModelCommit>()
    const modelIds = uniqueNonEmpty(params.modelIds)
    if (!modelIds.length) return result

    const rows = (await db(TABLE)
      .where('project_id', params.projectId)
      .andWhere('application_id', STATE_APPLICATION_ID)
      .whereIn('model_id', modelIds)
      .select('model_id', 'commit_id', 'updated_at')) as Array<{
      model_id: string
      commit_id: string
      updated_at: Date | null
    }>

    for (const row of rows) {
      result.set(row.model_id, {
        commitId: row.commit_id,
        updatedAt: row.updated_at
      })
    }

    return result
  }

/**
 * 正向查询：构件编码 → applicationId。
 *
 * 这是「只想知道哪些构件命中」时最省的路径：一次索引查询，不碰 objects，
 * 也不需要知道表单引用了哪些构件。
 */
export const lookupApplicationIdsByComponentCodesFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    projectId: string
    componentCodes: string[]
    modelId?: string | null
  }): Promise<
    Array<{ modelId: string; applicationId: string; componentCode: string }>
  > => {
    const codes = uniqueNonEmpty(params.componentCodes)
    if (!codes.length) return []

    const rows = (await db(TABLE)
      .where('project_id', params.projectId)
      // 排除状态行
      .andWhereNot('application_id', STATE_APPLICATION_ID)
      .whereIn('component_code', codes)
      .modify((q) => {
        if (params.modelId) q.andWhere('model_id', params.modelId)
      })
      .select(
        'model_id as modelId',
        'application_id as applicationId',
        'component_code as componentCode'
      )) as Array<{ modelId: string; applicationId: string; componentCode: string }>

    return rows
  }

/**
 * 反向查询：applicationId → 构件编码。
 *
 * 用于「已经拿到表单引用的构件清单，要把它翻成编码」的场景（现在的
 * `by-component-codes` 就是这一类：响应里要返回每个关联构件对应的编码）。
 * 只查指定模型切片，走主键前缀。
 */
export const lookupComponentCodesByApplicationIdsFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    projectId: string
    modelIds: string[]
    applicationIds: string[]
  }): Promise<Map<string, string>> => {
    const lookup = new Map<string, string>()
    const modelIds = uniqueNonEmpty(params.modelIds)
    const applicationIds = uniqueNonEmpty(params.applicationIds)
    if (!modelIds.length || !applicationIds.length) return lookup

    for (const batch of chunkList(applicationIds, 500)) {
      const rows = (await db(TABLE)
        .where('project_id', params.projectId)
        .whereIn('model_id', modelIds)
        .whereIn('application_id', batch)
        .andWhereNot('application_id', STATE_APPLICATION_ID)
        .orderBy('component_code', 'asc')
        .select('application_id', 'component_code')) as Array<{
        application_id: string
        component_code: string
      }>

      for (const row of rows) {
        if (lookup.has(row.application_id)) continue
        lookup.set(row.application_id, row.component_code)
      }
    }

    return lookup
  }

/**
 * 重建某个模型（branch）当前版本的构件编码切片。
 *
 * 覆盖范围是**整个模型的全部构件**（不是只物化被表单引用的那些），因为业务上
 * 随时可能给新构件补质量验收单。为了在这种情况下不把 CPU 打满，做了四件事：
 *
 * 1. **只取 id 列表，再分批取 data**：闭包只展开一次（只取 id，不读 data），
 *    然后按 id 分批去捞对象的 data。旧实现是一条查询把整个模型的对象连 data
 *    一起拉出来，等价于把模型全量重解析一遍。
 * 2. **每批都是在"关并行 + 有超时"的事务里跑**（`max_parallel_workers_per_gather = 0`）：
 *    大表上的并行顺序扫描会吃满所有核，这是"整机卡死"的主因之一。
 * 3. **自适应让出 CPU**：按每批实际耗时反推停顿时间，保证占空比不超过
 *    `dutyCycle`（默认 0.5）。批量再大也只是变慢，不会持续占满。
 * 4. **中断可续跑**：清掉旧 commit 的切片后，本轮写入的行保留；重跑时以
 *    `object_id` 为游标跳过已写过的部分。状态行（`application_id = ''`）
 *    始终最后写，所以半份切片永远会被读路径判为"不新鲜"而回退，不会读错。
 *
 * 两个可选加速开关（默认关闭，因为都依赖数据结构假设，需先用验证 SQL 确认）：
 * - `maxDepth`：只用闭包深度 <= N 的对象做候选。几何/网格对象都在深层，
 *   跳过它们能大幅减少真实读取行数；
 * - `prefilter`：只在 SQL 侧按别名预过滤（`data::text ILIKE`），不把无关对象的
 *   data 传到 Node、也不解析。
 */
export type ModelComponentCodeRebuildOptions = {
  /** 每批处理多少个候选对象 */
  batchSize?: number
  /** 每批之后强制停顿的下限（毫秒） */
  pauseMs?: number
  /** CPU 占空比上限（0.05 ~ 1）。0.5 表示每干 1 秒至少歇 1 秒 */
  dutyCycle?: number
  /** 只用闭包深度 <= maxDepth 的对象做候选；null/不传 = 不限深度 */
  maxDepth?: number | null
  /** SQL 侧别名预过滤（默认关闭） */
  prefilter?: boolean
  onProgress?: (info: { scanned: number; total: number; inserted: number }) => void
}

export type ModelComponentCodeRebuildResult = {
  commitId: string | null
  /** 本次实际写入的行数（续跑时不含之前已写入的） */
  rowCount: number
  /** 本次扫描的候选对象数 */
  scanned: number
  /** 候选对象总数 */
  candidates: number
  /** 因续跑而跳过的候选对象数 */
  skipped: number
  elapsedMs: number
}

const DEFAULT_BATCH_SIZE = 2000
const DEFAULT_PAUSE_MS = 50
const DEFAULT_DUTY_CYCLE = 0.5
const BATCH_STATEMENT_TIMEOUT = '60s'
const DEPTH_EXPRESSION = `CASE WHEN d.value ~ '^[0-9]+$' THEN (d.value)::int ELSE 2147483647 END`

/**
 * 别名预过滤（分隔符容忍的超集）。
 *
 * 一个对象能产出编码，必然含有「直接构件编码」或「分类对象代码」之一；而
 * `getPropertyValue` 会先把键名里的空格/下划线/点等分隔符去掉再比对，所以这里
 * 用「单词 + %」的写法覆盖 `classification_object_code` / `componentCode` 这类变体。
 * 中文别名本身不可能插分隔符，直接整体匹配。
 */
const CANDIDATE_DATA_FILTERS = [
  '%分类对象代码%',
  '%构件编码%',
  '%classification%',
  '%component%code%',
  '%bim%code%'
]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 取版本闭包内的候选对象 id（含根对象本身），只取 id，不读 data */
const loadCandidateObjectIds = async (
  db: Knex,
  params: {
    projectId: string
    rootObjectId: string
    maxDepth?: number | null
  }
): Promise<string[]> => {
  const maxDepth = params.maxDepth ?? null
  const depthFilter =
    maxDepth === null
      ? ''
      : `AND ${DEPTH_EXPRESSION} <= ${Math.max(0, Math.floor(maxDepth))}`

  return db.transaction(async (trx) => {
    await trx.raw('SET LOCAL max_parallel_workers_per_gather = 0')
    await trx.raw(`SET LOCAL statement_timeout = '${BATCH_STATEMENT_TIMEOUT}'`)

    const res = await trx.raw(
      `SELECT d.key AS id
         FROM objects root
         JOIN jsonb_each_text(root.data->'__closure') AS d ON true
        WHERE root."streamId" = ? AND root.id = ?
          ${depthFilter}
        UNION
       SELECT ? AS id`,
      [params.projectId, params.rootObjectId, params.rootObjectId]
    )

    return ((res?.rows ?? []) as Array<{ id: string }>).map((row) => row.id).sort()
  })
}

export const rebuildModelComponentCodeIndexFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    options?: ModelComponentCodeRebuildOptions
  }): Promise<ModelComponentCodeRebuildResult> => {
    const { projectId, modelId } = params
    const options = params.options ?? {}
    const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE)
    const pauseMs = Math.max(0, options.pauseMs ?? DEFAULT_PAUSE_MS)
    const dutyCycle = Math.min(
      1,
      Math.max(0.05, options.dutyCycle ?? DEFAULT_DUTY_CYCLE)
    )
    const prefilter = options.prefilter ?? false
    const maxDepth = options.maxDepth ?? null
    const startedAt = Date.now()

    const latest = await getLatestModelCommitsFactory({ db })({
      projectId,
      modelIds: [modelId]
    })
    const version = latest.get(modelId)
    if (!version) {
      return {
        commitId: null,
        rowCount: 0,
        scanned: 0,
        candidates: 0,
        skipped: 0,
        elapsedMs: Date.now() - startedAt
      }
    }

    const spaceCode = await resolveSpaceCodeForCommit(
      db,
      projectId,
      version.referencedObject
    )

    const candidateIds = await loadCandidateObjectIds(db, {
      projectId,
      rootObjectId: version.referencedObject,
      maxDepth
    })

    // 清掉旧 commit 的切片与状态行；保留本轮（同 commit）已写入的行用于续跑
    await db.transaction(async (trx) => {
      await trx(TABLE)
        .where({ project_id: projectId, model_id: modelId })
        .andWhereNot('commit_id', version.commitId)
        .del()
      await trx(TABLE)
        .where({
          project_id: projectId,
          model_id: modelId,
          application_id: STATE_APPLICATION_ID
        })
        .del()
    })

    const resumeRow = (await db(TABLE)
      .where({ project_id: projectId, model_id: modelId, commit_id: version.commitId })
      .whereNotNull('object_id')
      .max('object_id as maxId')
      .first()) as { maxId?: string | null } | undefined
    const resumeAfter = resumeRow?.maxId ?? ''
    const pending = resumeAfter
      ? candidateIds.filter((id) => id > resumeAfter)
      : candidateIds

    const collectIndexRows = (
      objects: Array<{ id: string; data?: unknown }>
    ): ComponentCodeIndexRow[] => {
      const rows: ComponentCodeIndexRow[] = []
      for (const object of objects) {
        const data = parseObjectData(object.data)
        const code = extractComponentCodeFromObjectData(data, {
          defaultSpaceCode: spaceCode || ''
        })
        if (!code) continue

        const base = {
          project_id: projectId,
          model_id: modelId,
          commit_id: version.commitId,
          object_id: object.id,
          component_code: code
        }
        rows.push({ ...base, application_id: object.id })

        const applicationId = getApplicationIdFromData(data)
        if (applicationId && applicationId !== object.id) {
          rows.push({ ...base, application_id: applicationId })
        }
      }
      return rows
    }

    let rowCount = 0
    let scanned = 0

    for (const batch of chunkList(pending, batchSize)) {
      const batchStartedAt = Date.now()

      const inserted = await db.transaction(async (trx) => {
        // 关掉并行扫描：大表上并行顺序扫描会吃满所有核
        await trx.raw('SET LOCAL max_parallel_workers_per_gather = 0')
        await trx.raw(`SET LOCAL statement_timeout = '${BATCH_STATEMENT_TIMEOUT}'`)

        const query = trx('objects').where('streamId', projectId).whereIn('id', batch)
        if (prefilter) {
          query.andWhere(function (this: any) {
            for (const filter of CANDIDATE_DATA_FILTERS) {
              this.orWhereRaw('data::text ILIKE ?', [filter])
            }
          })
        }

        const objects = (await query.select('id', 'data')) as Array<{
          id: string
          data?: unknown
        }>
        const indexRows = collectIndexRows(objects)
        if (indexRows.length) {
          // 续跑可能重复写同一对象，冲突即跳过
          await trx(TABLE).insert(indexRows).onConflict().ignore()
        }
        return indexRows.length
      })

      rowCount += inserted
      scanned += batch.length
      options.onProgress?.({ scanned, total: pending.length, inserted: rowCount })

      // 自适应让出 CPU：按本批耗时反推停顿，保证占空比不超过 dutyCycle
      const batchElapsed = Date.now() - batchStartedAt
      const throttle =
        dutyCycle < 1 ? Math.round(batchElapsed * (1 / dutyCycle - 1)) : 0
      const wait = Math.max(pauseMs, throttle)
      if (wait > 0) await sleep(wait)
    }

    // 状态行最后写：写出来才代表这份切片完整、可被读路径信任
    await db(TABLE).insert({
      project_id: projectId,
      model_id: modelId,
      commit_id: version.commitId,
      application_id: STATE_APPLICATION_ID,
      object_id: null,
      component_code: ''
    })

    return {
      commitId: version.commitId,
      rowCount,
      scanned,
      candidates: candidateIds.length,
      skipped: candidateIds.length - pending.length,
      elapsedMs: Date.now() - startedAt
    }
  }

/**
 * 读路径统一入口：`applicationId -> 构件编码`。
 *
 * - 切片版本与模型最新版本一致的模型 → 只查索引，完全不碰 objects；
 * - 其余模型（切片缺失 / 落后 / 无法解析）→ 回退到实时解析。
 *
 * 返回结构与 `buildComponentCodeLookup` 完全一致，因此调用方可以无痛替换。
 */
export const buildComponentCodeLookupWithIndexFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    projectId: string
    entries: ComponentCodeLookupInput[] | string[]
  }): Promise<Map<string, string>> => {
    const lookup = new Map<string, string>()

    const appIdsByModel = new Map<string, Set<string>>()
    const addAppId = (modelId: string, applicationId: string) => {
      const ids = appIdsByModel.get(modelId) ?? new Set<string>()
      ids.add(applicationId)
      appIdsByModel.set(modelId, ids)
    }

    for (const entry of params.entries) {
      if (typeof entry === 'string') {
        const trimmed = entry.trim()
        if (trimmed) addAppId('', trimmed)
        continue
      }
      if (!entry || typeof entry !== 'object') continue
      const modelId =
        typeof entry.modelId === 'string' && entry.modelId.trim()
          ? entry.modelId.trim()
          : ''
      for (const applicationId of entry.applicationIds || []) {
        if (typeof applicationId !== 'string') continue
        const trimmed = applicationId.trim()
        if (trimmed) addAppId(modelId, trimmed)
      }
    }

    if (!appIdsByModel.size) return lookup

    const modelIds = Array.from(appIdsByModel.keys()).filter(Boolean)

    // 先查切片状态：如果一个切片都没有（索引还没铺开），就不必再查最新版本，
    // 直接整批回退到实时解析，避免给未启用索引的环境增加无谓查询。
    const indexed = await getIndexedModelCommitsFactory({ db })({
      projectId: params.projectId,
      modelIds
    })
    const latest = indexed.size
      ? await getLatestModelCommitsFactory({ db })({
          projectId: params.projectId,
          modelIds
        })
      : new Map<string, LatestModelCommit>()

    const freshModelIds: string[] = []
    const staleEntries: ComponentCodeLookupInput[] = []
    const allApplicationIds: string[] = []

    for (const [modelId, ids] of appIdsByModel) {
      allApplicationIds.push(...ids)

      const latestCommitId = modelId ? latest.get(modelId)?.commitId : undefined
      const indexedCommitId = modelId ? indexed.get(modelId)?.commitId : undefined
      if (latestCommitId && indexedCommitId === latestCommitId) {
        freshModelIds.push(modelId)
      } else {
        staleEntries.push({
          modelId: modelId || null,
          applicationIds: Array.from(ids)
        })
      }
    }

    if (freshModelIds.length) {
      const fromIndex = await lookupComponentCodesByApplicationIdsFactory({ db })({
        projectId: params.projectId,
        modelIds: freshModelIds,
        applicationIds: allApplicationIds
      })
      for (const [applicationId, code] of fromIndex) {
        lookup.set(applicationId, code)
      }
    }

    if (staleEntries.length) {
      const fromResolver = await buildComponentCodeLookup(
        db,
        params.projectId,
        staleEntries
      )
      for (const [applicationId, code] of fromResolver) {
        lookup.set(applicationId, code)
      }
    }

    return lookup
  }
