import { RvtConversionJobs } from '@/modules/rvt-conversion/dbSchema'
import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'

export type RvtConversionJobStatus =
  | 'pending'
  | 'dispatched'
  | 'acknowledged'
  | 'succeeded'
  | 'failed'

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
