import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressV2AnnualPlans = buildTableHelper(
  'project_progress_v2_annual_plans',
  [
    'id',
    'projectId',
    'year',
    'name',
    'startDate',
    'endDate',
    'preparedBy',
    'blobId',
    'fileName',
    'fileSize',
    'remark',
    'createdBy',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressV2AnnualPlanRecord = {
  id: string
  projectId: string
  year: number
  name: string
  startDate: Date
  endDate: Date
  preparedBy: string | null
  blobId: string | null
  fileName: string | null
  fileSize: number | string | null
  remark: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressV2AnnualPlans: (db: Knex) =>
    db<ProgressV2AnnualPlanRecord>(ProjectProgressV2AnnualPlans.name)
}

export type CreateProgressV2AnnualPlanParams = {
  projectId: string
  year: number
  name: string
  startDate: Date
  endDate: Date
  preparedBy?: string | null
  blobId?: string | null
  fileName?: string | null
  fileSize?: number | null
  remark?: string | null
  createdBy: string
}

export type UpdateProgressV2AnnualPlanParams = {
  id: string
  projectId: string
  year?: number
  name?: string
  startDate?: Date
  endDate?: Date
  preparedBy?: string | null
  blobId?: string | null
  fileName?: string | null
  fileSize?: number | null
  remark?: string | null
}

export const listProgressV2AnnualPlansFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    year?: number
  }): Promise<ProgressV2AnnualPlanRecord[]> => {
    let query = tables
      .projectProgressV2AnnualPlans(deps.db)
      .where({ [ProjectProgressV2AnnualPlans.col.projectId]: params.projectId })

    if (params.year) {
      query = query.where({ [ProjectProgressV2AnnualPlans.col.year]: params.year })
    }

    return await query
      .orderBy(ProjectProgressV2AnnualPlans.col.year, 'desc')
      .orderBy(ProjectProgressV2AnnualPlans.col.createdAt, 'desc')
  }

export const getProgressV2AnnualPlanByIdFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id: string
    projectId: string
  }): Promise<ProgressV2AnnualPlanRecord | undefined> => {
    return await tables
      .projectProgressV2AnnualPlans(deps.db)
      .where({
        [ProjectProgressV2AnnualPlans.col.id]: params.id,
        [ProjectProgressV2AnnualPlans.col.projectId]: params.projectId
      })
      .first()
  }

export const createProgressV2AnnualPlanFactory =
  (deps: { db: Knex }) =>
  async (
    params: CreateProgressV2AnnualPlanParams
  ): Promise<ProgressV2AnnualPlanRecord> => {
    const [inserted] = await tables.projectProgressV2AnnualPlans(deps.db).insert(
      {
        id: generateId(),
        projectId: params.projectId,
        year: params.year,
        name: params.name,
        startDate: params.startDate,
        endDate: params.endDate,
        preparedBy: params.preparedBy ?? null,
        blobId: params.blobId ?? null,
        fileName: params.fileName ?? null,
        fileSize: params.fileSize ?? null,
        remark: params.remark ?? null,
        createdBy: params.createdBy
      },
      '*'
    )
    return inserted
  }

export const updateProgressV2AnnualPlanFactory =
  (deps: { db: Knex }) =>
  async (
    params: UpdateProgressV2AnnualPlanParams
  ): Promise<ProgressV2AnnualPlanRecord | undefined> => {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    }
    if (params.year !== undefined) updateData.year = params.year
    if (params.name !== undefined) updateData.name = params.name
    if (params.startDate !== undefined) updateData.startDate = params.startDate
    if (params.endDate !== undefined) updateData.endDate = params.endDate
    if (params.preparedBy !== undefined) updateData.preparedBy = params.preparedBy
    if (params.blobId !== undefined) updateData.blobId = params.blobId
    if (params.fileName !== undefined) updateData.fileName = params.fileName
    if (params.fileSize !== undefined) updateData.fileSize = params.fileSize
    if (params.remark !== undefined) updateData.remark = params.remark

    const [updated] = await tables
      .projectProgressV2AnnualPlans(deps.db)
      .where({
        [ProjectProgressV2AnnualPlans.col.id]: params.id,
        [ProjectProgressV2AnnualPlans.col.projectId]: params.projectId
      })
      .update(updateData, '*')

    return updated
  }

export const deleteProgressV2AnnualPlanFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string; projectId: string }): Promise<boolean> => {
    const count = await tables
      .projectProgressV2AnnualPlans(deps.db)
      .where({
        [ProjectProgressV2AnnualPlans.col.id]: params.id,
        [ProjectProgressV2AnnualPlans.col.projectId]: params.projectId
      })
      .del()
    return count > 0
  }
