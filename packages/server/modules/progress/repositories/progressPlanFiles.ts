import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressPlanFiles = buildTableHelper(
  'project_progress_plan_files',
  [
    'id',
    'projectId',
    'blobId',
    'fileName',
    'fileType',
    'fileSize',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressPlanFileRecord = {
  id: string
  projectId: string
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressPlanFiles: (db: Knex) =>
    db<ProgressPlanFileRecord>(ProjectProgressPlanFiles.name)
}

export type CreateProgressPlanFileParams = {
  projectId: string
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | null
  creator: string
  updater: string
}

export const createProgressPlanFileFactory =
  (deps: { db: Knex }) =>
  async (params: CreateProgressPlanFileParams): Promise<ProgressPlanFileRecord> => {
    const [insertedItem] = await tables.projectProgressPlanFiles(deps.db).insert(
      {
        id: generateId(),
        ...params
      },
      '*'
    )

    return insertedItem
  }

export const getLatestProgressPlanFileFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
  }): Promise<ProgressPlanFileRecord | undefined> => {
    return await tables
      .projectProgressPlanFiles(deps.db)
      .where({
        [ProjectProgressPlanFiles.col.projectId]: params.projectId
      })
      .orderBy(ProjectProgressPlanFiles.col.createdAt, 'desc')
      .first()
  }
