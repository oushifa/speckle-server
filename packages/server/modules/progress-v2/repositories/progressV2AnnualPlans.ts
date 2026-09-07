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
    'attachments',
    'remark',
    'createdBy',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressV2AnnualPlanAttachment = {
  blobId: string
  fileName: string
  fileSize?: number | string | null
}

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
  attachments: ProgressV2AnnualPlanAttachment[] | string | null
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

const normalizeAnnualPlan = (
  record?: ProgressV2AnnualPlanRecord
): ProgressV2AnnualPlanRecord | undefined => {
  if (!record) return undefined
  let attachments = record.attachments
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments)
    } catch {
      attachments = []
    }
  }
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    if (record.blobId && record.fileName) {
      attachments = [
        {
          blobId: record.blobId,
          fileName: record.fileName,
          fileSize: record.fileSize
        }
      ]
    } else {
      attachments = []
    }
  }
  return {
    ...record,
    attachments
  }
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
  attachments?: ProgressV2AnnualPlanAttachment[] | null
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
  attachments?: ProgressV2AnnualPlanAttachment[] | null
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

    const list = await query
      .orderBy(ProjectProgressV2AnnualPlans.col.year, 'desc')
      .orderBy(ProjectProgressV2AnnualPlans.col.createdAt, 'desc')

    return list.map((item) => normalizeAnnualPlan(item) as ProgressV2AnnualPlanRecord)
  }

export const getProgressV2AnnualPlanByIdFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id: string
    projectId: string
  }): Promise<ProgressV2AnnualPlanRecord | undefined> => {
    const record = await tables
      .projectProgressV2AnnualPlans(deps.db)
      .where({
        [ProjectProgressV2AnnualPlans.col.id]: params.id,
        [ProjectProgressV2AnnualPlans.col.projectId]: params.projectId
      })
      .first()

    return normalizeAnnualPlan(record)
  }

export const createProgressV2AnnualPlanFactory =
  (deps: { db: Knex }) =>
  async (
    params: CreateProgressV2AnnualPlanParams
  ): Promise<ProgressV2AnnualPlanRecord> => {
    let blobId = params.blobId ?? null
    let fileName = params.fileName ?? null
    let fileSize = params.fileSize ?? null
    let attachments = params.attachments ?? null

    if (attachments && attachments.length > 0) {
      if (!blobId) blobId = attachments[0].blobId
      if (!fileName) fileName = attachments[0].fileName
      if (fileSize === null || fileSize === undefined) {
        fileSize =
          attachments[0].fileSize !== undefined && attachments[0].fileSize !== null
            ? Number(attachments[0].fileSize)
            : null
      }
    } else if (blobId && fileName) {
      attachments = [{ blobId, fileName, fileSize }]
    }

    const [inserted] = await tables.projectProgressV2AnnualPlans(deps.db).insert(
      {
        id: generateId(),
        projectId: params.projectId,
        year: params.year,
        name: params.name,
        startDate: params.startDate,
        endDate: params.endDate,
        preparedBy: params.preparedBy ?? null,
        blobId,
        fileName,
        fileSize,
        attachments: attachments ? JSON.stringify(attachments) : null,
        remark: params.remark ?? null,
        createdBy: params.createdBy
      },
      '*'
    )
    return normalizeAnnualPlan(inserted) as ProgressV2AnnualPlanRecord
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
    if (params.remark !== undefined) updateData.remark = params.remark

    if (params.attachments !== undefined) {
      updateData.attachments = params.attachments
        ? JSON.stringify(params.attachments)
        : null
      if (params.attachments && params.attachments.length > 0) {
        updateData.blobId = params.attachments[0].blobId
        updateData.fileName = params.attachments[0].fileName
        updateData.fileSize =
          params.attachments[0].fileSize !== undefined &&
          params.attachments[0].fileSize !== null
            ? Number(params.attachments[0].fileSize)
            : null
      } else {
        updateData.blobId = null
        updateData.fileName = null
        updateData.fileSize = null
      }
    } else {
      if (params.blobId !== undefined) updateData.blobId = params.blobId
      if (params.fileName !== undefined) updateData.fileName = params.fileName
      if (params.fileSize !== undefined) updateData.fileSize = params.fileSize
    }

    const [updated] = await tables
      .projectProgressV2AnnualPlans(deps.db)
      .where({
        [ProjectProgressV2AnnualPlans.col.id]: params.id,
        [ProjectProgressV2AnnualPlans.col.projectId]: params.projectId
      })
      .update(updateData, '*')

    return normalizeAnnualPlan(updated)
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
