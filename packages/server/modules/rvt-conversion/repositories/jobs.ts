import { RvtConversionJobs } from '@/modules/rvt-conversion/dbSchema'
import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'

export type RvtConversionJobStatus =
  | 'pending'
  | 'dispatched'
  | 'acknowledged'
  | 'succeeded'
  | 'failed'

export const ActiveRvtConversionJobStatuses: RvtConversionJobStatus[] = [
  'pending',
  'dispatched',
  'acknowledged'
]

export type RvtConversionJob = {
  id: string
  projectId: string
  modelId: string
  sourceFileId: string
  sourceFileName: string
  sourceObjectKey: string
  sourceFileSize: number | null
  versionMessage: string | null
  sourceApplication: string | null
  status: RvtConversionJobStatus
  externalTaskId: string | null
  versionId: string | null
  errorMessage: string | null
  dispatchedAt: Date | null
  acknowledgedAt: Date | null
  finishedAt: Date | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const tables = {
  jobs: (db: Knex) => db<RvtConversionJob>(RvtConversionJobs.name)
}

const cols = RvtConversionJobs.withoutTablePrefix.col

export const createRvtConversionJobFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    sourceFileId: string
    sourceFileName: string
    sourceObjectKey: string
    sourceFileSize: number | null
    versionMessage: string | null
    sourceApplication: string | null
    creator: string
  }): Promise<RvtConversionJob> => {
    const now = new Date()
    const [job] = await tables
      .jobs(deps.db)
      .insert({
        [cols.id]: cryptoRandomString({ length: 10 }),
        [cols.projectId]: params.projectId,
        [cols.modelId]: params.modelId,
        [cols.sourceFileId]: params.sourceFileId,
        [cols.sourceFileName]: params.sourceFileName,
        [cols.sourceObjectKey]: params.sourceObjectKey,
        [cols.sourceFileSize]: params.sourceFileSize,
        [cols.versionMessage]: params.versionMessage,
        [cols.sourceApplication]: params.sourceApplication,
        [cols.status]: 'pending',
        [cols.creator]: params.creator,
        [cols.updater]: params.creator,
        [cols.createdAt]: now,
        [cols.updatedAt]: now
      })
      .returning('*')

    return job
  }

export const getRvtConversionJobByIdFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string }): Promise<RvtConversionJob | null> =>
    (await tables.jobs(deps.db).where(cols.id, params.id).first()) || null

export const getRvtConversionJobForModelFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id: string
    projectId: string
    modelId: string
  }): Promise<RvtConversionJob | null> =>
    (await tables
      .jobs(deps.db)
      .where(cols.id, params.id)
      .andWhere(cols.projectId, params.projectId)
      .andWhere(cols.modelId, params.modelId)
      .first()) || null

export const listRvtConversionJobsBySourceFileFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    sourceFileId: string
    limit?: number
  }): Promise<RvtConversionJob[]> => {
    const query = tables
      .jobs(deps.db)
      .where(cols.projectId, params.projectId)
      .andWhere(cols.sourceFileId, params.sourceFileId)
      .orderBy(cols.createdAt, 'desc')

    if (params.limit) {
      query.limit(params.limit)
    }

    return await query
  }

export const listRvtConversionJobsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId?: string
    statuses?: RvtConversionJobStatus[]
    limit?: number
  }): Promise<RvtConversionJob[]> => {
    const query = tables
      .jobs(deps.db)
      .where(cols.projectId, params.projectId)
      .orderBy(cols.createdAt, 'desc')

    if (params.modelId) {
      query.andWhere(cols.modelId, params.modelId)
    }

    if (params.statuses?.length) {
      query.whereIn(cols.status, params.statuses)
    }

    if (params.limit) {
      query.limit(params.limit)
    }

    return await query
  }

export const updateRvtConversionJobFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id: string
    item: Partial<RvtConversionJob>
  }): Promise<RvtConversionJob | null> => {
    const [job] = await tables
      .jobs(deps.db)
      .where(cols.id, params.id)
      .update(
        {
          ...params.item,
          [cols.updatedAt]: new Date()
        },
        '*'
      )

    return job || null
  }

export const failActiveRvtConversionJobsForModelFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    errorMessage: string
    updater: string
  }): Promise<RvtConversionJob[]> => {
    const now = new Date()

    return await tables
      .jobs(deps.db)
      .where(cols.projectId, params.projectId)
      .andWhere(cols.modelId, params.modelId)
      .whereIn(cols.status, ActiveRvtConversionJobStatuses)
      .update(
        {
          [cols.status]: 'failed',
          [cols.errorMessage]: params.errorMessage,
          [cols.finishedAt]: now,
          [cols.updater]: params.updater,
          [cols.updatedAt]: now
        },
        '*'
      )
  }

export const failExpiredActiveRvtConversionJobsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    timeoutThresholdSeconds: number
    errorMessage: string
    updater: string
  }): Promise<RvtConversionJob[]> => {
    const now = new Date()

    return await tables
      .jobs(deps.db)
      .whereIn(cols.status, ActiveRvtConversionJobStatuses)
      .andWhere((query) => {
        query
          .where(
            cols.acknowledgedAt,
            '<',
            deps.db.raw(`now() - interval '${params.timeoutThresholdSeconds} seconds'`)
          )
          .orWhere((subQuery) => {
            subQuery
              .whereNull(cols.acknowledgedAt)
              .andWhere(
                cols.createdAt,
                '<',
                deps.db.raw(`now() - interval '${params.timeoutThresholdSeconds} seconds'`)
              )
          })
      })
      .update(
        {
          [cols.status]: 'failed',
          [cols.errorMessage]: params.errorMessage,
          [cols.finishedAt]: now,
          [cols.updater]: params.updater,
          [cols.updatedAt]: now
        },
        '*'
      )
  }
