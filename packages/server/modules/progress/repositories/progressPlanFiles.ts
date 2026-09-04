import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressPlanFiles = buildTableHelper(
  'project_progress_plan_files',
  [
    'id',
    'projectId',
    'annualPlanId',
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
  annualPlanId?: string | null
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
  annualPlanId?: string | null
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
        projectId: params.projectId,
        annualPlanId: params.annualPlanId ?? null,
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

export const getLatestProgressPlanFileFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    annualPlanId?: string | null
  }): Promise<ProgressPlanFileRecord | undefined> => {
    let query = tables.projectProgressPlanFiles(deps.db).where({
      [ProjectProgressPlanFiles.col.projectId]: params.projectId
    })

    if (params.annualPlanId) {
      query = query.where({
        annualPlanId: params.annualPlanId
      })
    } else {
      query = query.whereNull('annualPlanId')
    }

    return await query.orderBy(ProjectProgressPlanFiles.col.createdAt, 'desc').first()
  }
