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
const INSERT_BATCH_SIZE = 2000
const STREAM_HIGH_WATER_MARK = 200
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
 * - 只物化「能解析出编码的构件」，不物化整棵对象树；
 * - 在一个事务里「删旧切片 → 流式插入 → 最后写状态行」，中途失败整体回滚，
 *   不会留下「看着新鲜其实是半份」的切片；
 * - 流式读取版本的闭包成员，内存占用与模型规模无关。
 */
export const rebuildModelComponentCodeIndexFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
  }): Promise<{ commitId: string | null; rowCount: number }> => {
    const { projectId, modelId } = params

    const latest = await getLatestModelCommitsFactory({ db })({
      projectId,
      modelIds: [modelId]
    })
    const version = latest.get(modelId)
    if (!version) return { commitId: null, rowCount: 0 }

    const spaceCode = await resolveSpaceCodeForCommit(
      db,
      projectId,
      version.referencedObject
    )

    let rowCount = 0
    await db.transaction(async (trx) => {
      await trx(TABLE).where({ project_id: projectId, model_id: modelId }).del()

      let batch: ComponentCodeIndexRow[] = []
      const flush = async () => {
        if (!batch.length) return
        await trx(TABLE).insert(batch)
        rowCount += batch.length
        batch = []
      }

      const collect = (objectId: string, data: any) => {
        const code = extractComponentCodeFromObjectData(data, {
          defaultSpaceCode: spaceCode || ''
        })
        if (!code) return

        const base = {
          project_id: projectId,
          model_id: modelId,
          commit_id: version.commitId,
          object_id: objectId,
          component_code: code
        }
        batch.push({ ...base, application_id: objectId })

        const applicationId = getApplicationIdFromData(data)
        if (applicationId && applicationId !== objectId) {
          batch.push({ ...base, application_id: applicationId })
        }
      }

      // 根对象本身也可能被表单当作构件引用
      const rootRow = (await trx('objects')
        .where('streamId', projectId)
        .andWhere('id', version.referencedObject)
        .select('id', 'data')
        .first()) as { id: string; data?: unknown } | undefined
      if (rootRow) collect(rootRow.id, parseObjectData(rootRow.data))

      const stream = trx('objects as root')
        .joinRaw(`JOIN jsonb_each_text(root.data->'__closure') AS d ON true`)
        .join('objects as o', function (this: any) {
          this.on('o.streamId', '=', 'root.streamId').andOn('o.id', '=', 'd.key')
        })
        .where('root.streamId', projectId)
        .andWhere('root.id', version.referencedObject)
        .select('o.id as id', 'o.data as data')
        .stream({ highWaterMark: STREAM_HIGH_WATER_MARK })

      for await (const row of stream as any) {
        collect(row.id, parseObjectData(row.data))
        if (batch.length >= INSERT_BATCH_SIZE) await flush()
      }
      await flush()

      // 状态行最后写：事务提交前对外不可见
      await trx(TABLE).insert({
        project_id: projectId,
        model_id: modelId,
        commit_id: version.commitId,
        application_id: STATE_APPLICATION_ID,
        object_id: null,
        component_code: ''
      })
    })

    return { commitId: version.commitId, rowCount }
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
