import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'
import { BadRequestError } from '@/modules/shared/errors'

export const ProjectProgressAnnualPlans = buildTableHelper(
  'project_progress_annual_plans',
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

export type AnnualPlanRecord = {
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

export type CreateAnnualPlanInput = {
  projectId: string
  year: number
  name: string
  startDate: string | Date
  endDate: string | Date
  preparedBy?: string | null
  blobId?: string | null
  fileName?: string | null
  fileSize?: number | string | null
  remark?: string | null
  createdBy: string
}

export type UpdateAnnualPlanInput = {
  year?: number
  name?: string
  startDate?: string | Date
  endDate?: string | Date
  preparedBy?: string | null
  blobId?: string | null
  fileName?: string | null
  fileSize?: number | string | null
  remark?: string | null
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  annualPlans: (db: Knex) => db<AnnualPlanRecord>(ProjectProgressAnnualPlans.name)
}

export const listProgressAnnualPlansFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    search?: string
  }): Promise<AnnualPlanRecord[]> => {
    let query = tables
      .annualPlans(deps.db)
      .where({ projectId: params.projectId })
      .orderBy('year', 'desc')
      .orderBy('updatedAt', 'desc')

    if (params.search && params.search.trim()) {
      const keyword = `%${params.search.trim()}%`
      query = query.andWhere((builder) => {
        builder
          .whereILike('name', keyword)
          .orWhereILike('preparedBy', keyword)
          .orWhereRaw('CAST(year AS TEXT) ILIKE ?', [keyword])
      })
    }

    return await query
  }

export const getProgressAnnualPlanByIdFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    planId: string
  }): Promise<AnnualPlanRecord | undefined> => {
    return await tables
      .annualPlans(deps.db)
      .where({
        id: params.planId,
        projectId: params.projectId
      })
      .first()
  }

export const createProgressAnnualPlanFactory =
  (deps: { db: Knex }) =>
  async (params: CreateAnnualPlanInput): Promise<AnnualPlanRecord> => {
    const id = generateId()
    const record: Partial<AnnualPlanRecord> = {
      id,
      projectId: params.projectId,
      year: Number(params.year),
      name: params.name.trim(),
      startDate: new Date(params.startDate),
      endDate: new Date(params.endDate),
      preparedBy: params.preparedBy ? params.preparedBy.trim() : null,
      blobId: params.blobId || null,
      fileName: params.fileName || null,
      fileSize: params.fileSize ? Number(params.fileSize) : null,
      remark: params.remark ? params.remark.trim() : null,
      createdBy: params.createdBy
    }

    const [inserted] = await tables.annualPlans(deps.db).insert(record).returning('*')
    return inserted
  }

export const updateProgressAnnualPlanFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    planId: string
    input: UpdateAnnualPlanInput
  }): Promise<AnnualPlanRecord> => {
    const existing = await tables
      .annualPlans(deps.db)
      .where({
        id: params.planId,
        projectId: params.projectId
      })
      .first()

    if (!existing) {
      throw new BadRequestError('Annual plan not found')
    }

    const updates: Record<string, unknown> = {
      updatedAt: deps.db.fn.now()
    }

    if (params.input.year !== undefined) updates.year = Number(params.input.year)
    if (params.input.name !== undefined) updates.name = params.input.name.trim()
    if (params.input.startDate !== undefined)
      updates.startDate = new Date(params.input.startDate)
    if (params.input.endDate !== undefined)
      updates.endDate = new Date(params.input.endDate)
    if (params.input.preparedBy !== undefined)
      updates.preparedBy = params.input.preparedBy
        ? params.input.preparedBy.trim()
        : null
    if (params.input.blobId !== undefined) updates.blobId = params.input.blobId || null
    if (params.input.fileName !== undefined)
      updates.fileName = params.input.fileName || null
    if (params.input.fileSize !== undefined)
      updates.fileSize = params.input.fileSize ? Number(params.input.fileSize) : null
    if (params.input.remark !== undefined)
      updates.remark = params.input.remark ? params.input.remark.trim() : null

    const [updated] = await tables
      .annualPlans(deps.db)
      .where({
        id: params.planId,
        projectId: params.projectId
      })
      .update(updates)
      .returning('*')

    return updated
  }

export const deleteProgressAnnualPlanFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; planId: string }): Promise<void> => {
    await tables
      .annualPlans(deps.db)
      .where({
        id: params.planId,
        projectId: params.projectId
      })
      .delete()
  }
