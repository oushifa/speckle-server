import { buildTableHelper } from '@/modules/core/dbSchema'
import { MODEL_SYNC_AUTO_RETRY_LIMIT } from '@/modules/model-sync/services/errors'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectModelSyncTasks = buildTableHelper('project_model_sync_tasks', [
  'id',
  'projectId',
  'modelId',
  'fileId',
  'fileUploadId',
  'versionId',
  'fileName',
  'fileType',
  'fileSize',
  'status',
  'progressPercent',
  'progressPhase',
  'progressMessage',
  'seedId',
  'assetId',
  'assetName',
  'transformTaskId',
  'error',
  'errorCode',
  'retriable',
  'retryCount',
  'creator',
  'updater',
  'createdAt',
  'updatedAt'
])

export type ModelSyncTaskStatus =
  | 'waiting_upload'
  | 'speckle_converting'
  | 'syncing_dtp_model'
  | 'syncing_external_ids'
  | 'triggering_model_transform'
  | 'polling_model_transform'
  | 'succeeded'
  | 'failed'

export type ProjectModelSyncTaskRecord = {
  id: string
  projectId: string
  modelId: string
  fileId: string | null
  fileUploadId: string | null
  versionId: string | null
  fileName: string
  fileType: string | null
  fileSize: number | string | null
  status: ModelSyncTaskStatus
  progressPercent: number | string | null
  progressPhase: string | null
  progressMessage: string | null
  queuePosition?: number | null
  seedId: string | null
  assetId: string | null
  assetName: string | null
  transformTaskId: string | null
  error: string | null
  errorCode: string | null
  retriable: boolean
  retryCount: number
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })
const AUDIT_USER_MAX_LENGTH = 10

const normalizeAuditUser = (value: string) => value.slice(0, AUDIT_USER_MAX_LENGTH)

const tables = {
  tasks: (db: Knex) => db<ProjectModelSyncTaskRecord>(ProjectModelSyncTasks.name)
}

export const getProjectModelSyncTaskFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    taskId: string
  }): Promise<ProjectModelSyncTaskRecord | null> =>
    (await tables
      .tasks(deps.db)
      .where({
        [ProjectModelSyncTasks.col.projectId]: params.projectId,
        [ProjectModelSyncTasks.col.modelId]: params.modelId,
        [ProjectModelSyncTasks.col.id]: params.taskId
      })
      .first()) || null

export const listProjectModelSyncTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    limit?: number
  }): Promise<ProjectModelSyncTaskRecord[]> =>
    await tables
      .tasks(deps.db)
      .where({
        [ProjectModelSyncTasks.col.projectId]: params.projectId,
        [ProjectModelSyncTasks.col.modelId]: params.modelId
      })
      .orderBy(ProjectModelSyncTasks.col.createdAt, 'desc')
      .limit(params.limit || 20)

export const listProjectModelSyncTasksByFileUploadIdFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    fileUploadId: string
    activeOnly?: boolean
    limit?: number
  }): Promise<ProjectModelSyncTaskRecord[]> => {
    const query = tables
      .tasks(deps.db)
      .where({
        [ProjectModelSyncTasks.col.projectId]: params.projectId,
        [ProjectModelSyncTasks.col.fileUploadId]: params.fileUploadId
      })
      .orderBy(ProjectModelSyncTasks.col.createdAt, 'desc')

    if (params.activeOnly) {
      query.whereNotIn(ProjectModelSyncTasks.col.status, ['succeeded', 'failed'])
    }

    if (params.limit) {
      query.limit(params.limit)
    }

    return await query
  }

export const listLatestProjectModelSyncTasksByModelIdsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelIds: string[]
  }): Promise<ProjectModelSyncTaskRecord[]> => {
    if (!params.modelIds.length) {
      return []
    }

    const rows = await tables
      .tasks(deps.db)
      .where({
        [ProjectModelSyncTasks.col.projectId]: params.projectId
      })
      .whereIn(ProjectModelSyncTasks.col.modelId, params.modelIds)
      .orderBy([
        {
          column: ProjectModelSyncTasks.col.modelId,
          order: 'asc'
        },
        {
          column: ProjectModelSyncTasks.col.createdAt,
          order: 'desc'
        }
      ])

    const latestByModelId = new Map<string, ProjectModelSyncTaskRecord>()
    for (const row of rows) {
      if (!latestByModelId.has(row.modelId)) {
        latestByModelId.set(row.modelId, row)
      }
    }

    return params.modelIds
      .map((modelId) => latestByModelId.get(modelId))
      .filter((task): task is ProjectModelSyncTaskRecord => Boolean(task))
  }

export const listActiveProjectModelSyncTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    limit?: number
  }): Promise<ProjectModelSyncTaskRecord[]> =>
    await tables
      .tasks(deps.db)
      .where({
        [ProjectModelSyncTasks.col.projectId]: params.projectId
      })
      .whereNotIn(ProjectModelSyncTasks.col.status, ['succeeded', 'failed'])
      .orderBy(ProjectModelSyncTasks.col.createdAt, 'desc')
      .limit(params.limit || 50)

export const listResumableProjectModelSyncTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    limit?: number
  }): Promise<ProjectModelSyncTaskRecord[]> =>
    await tables
      .tasks(deps.db)
      .where((builder) => {
        builder
          .whereNotIn(ProjectModelSyncTasks.col.status, ['succeeded', 'failed'])
          .orWhere((retryBuilder) => {
            retryBuilder
              .where(ProjectModelSyncTasks.col.status, 'failed')
              .andWhere(ProjectModelSyncTasks.col.retriable, true)
              .andWhere(
                ProjectModelSyncTasks.col.retryCount,
                '<',
                MODEL_SYNC_AUTO_RETRY_LIMIT
              )
          })
      })
      .andWhere(ProjectModelSyncTasks.col.projectId, params.projectId)
      .orderBy(ProjectModelSyncTasks.col.createdAt, 'desc')
      .limit(params.limit || 50)

export const getActiveProjectModelSyncTaskFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
  }): Promise<ProjectModelSyncTaskRecord | null> =>
    (await tables
      .tasks(deps.db)
      .where({
        [ProjectModelSyncTasks.col.projectId]: params.projectId,
        [ProjectModelSyncTasks.col.modelId]: params.modelId
      })
      .whereNotIn(ProjectModelSyncTasks.col.status, ['succeeded', 'failed'])
      .orderBy(ProjectModelSyncTasks.col.createdAt, 'desc')
      .first()) || null

export const createProjectModelSyncTaskFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    fileId?: string | null
    fileUploadId?: string | null
    versionId?: string | null
    fileName: string
    fileType?: string | null
    fileSize?: number | null
    status: ModelSyncTaskStatus
    creator: string
    updater: string
  }): Promise<ProjectModelSyncTaskRecord> => {
    const [record] = await tables.tasks(deps.db).insert(
      {
        id: generateId(),
        fileId: null,
        fileUploadId: null,
        versionId: null,
        fileType: null,
        fileSize: null,
        progressPercent: null,
        progressPhase: null,
        progressMessage: null,
        seedId: null,
        assetId: null,
        assetName: null,
        transformTaskId: null,
        error: null,
        errorCode: null,
        retriable: false,
        retryCount: 0,
        ...params,
        creator: normalizeAuditUser(params.creator),
        updater: normalizeAuditUser(params.updater)
      },
      '*'
    )

    return record
  }

export const updateProjectModelSyncTaskFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    taskId: string
    patch: Partial<
      Pick<
        ProjectModelSyncTaskRecord,
        | 'fileId'
        | 'fileUploadId'
        | 'versionId'
        | 'fileType'
        | 'fileSize'
        | 'status'
        | 'progressPercent'
        | 'progressPhase'
        | 'progressMessage'
        | 'seedId'
        | 'assetId'
        | 'assetName'
        | 'transformTaskId'
        | 'error'
        | 'errorCode'
        | 'retriable'
        | 'retryCount'
        | 'updater'
      >
    >
  }): Promise<ProjectModelSyncTaskRecord | null> => {
    const [record] = await tables
      .tasks(deps.db)
      .where({
        [ProjectModelSyncTasks.col.projectId]: params.projectId,
        [ProjectModelSyncTasks.col.modelId]: params.modelId,
        [ProjectModelSyncTasks.col.id]: params.taskId
      })
      .update(
        {
          ...params.patch,
          ...(params.patch.updater !== undefined
            ? { updater: normalizeAuditUser(params.patch.updater) }
            : {}),
          updatedAt: deps.db.fn.now()
        },
        '*'
      )

    return record || null
  }
