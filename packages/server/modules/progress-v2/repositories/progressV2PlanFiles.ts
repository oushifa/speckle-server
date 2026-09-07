import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressV2PlanFiles = buildTableHelper(
  'project_progress_v2_plan_files',
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

export type ProgressV2PlanFileRecord = {
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
  projectProgressV2PlanFiles: (db: Knex) =>
    db<ProgressV2PlanFileRecord>(ProjectProgressV2PlanFiles.name)
}

export type CreateProgressV2PlanFileParams = {
  projectId: string
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | null
  creator: string
  updater: string
}

export const createProgressV2PlanFileFactory =
  (deps: { db: Knex }) =>
  async (params: CreateProgressV2PlanFileParams): Promise<ProgressV2PlanFileRecord> => {
    const [insertedItem] = await tables.projectProgressV2PlanFiles(deps.db).insert(
      {
        id: generateId(),
        projectId: params.projectId,
        blobId: params.blobId,
        fileName: params.fileName,
        fileType: params.fileType,
        fileSize: params.fileSize,
        creator: params.creator,
        updater: params.updater
      },
      '*'
    )

    return insertedItem
  }

export const getLatestProgressV2PlanFileFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<ProgressV2PlanFileRecord | undefined> => {
    return await tables
      .projectProgressV2PlanFiles(deps.db)
      .where({
        [ProjectProgressV2PlanFiles.col.projectId]: params.projectId
      })
      .orderBy(ProjectProgressV2PlanFiles.col.createdAt, 'desc')
      .first()
  }
