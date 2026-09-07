import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressV2ActualRecords = buildTableHelper(
  'project_progress_v2_actual_records',
  [
    'id',
    'projectId',
    'taskName',
    'sectionName',
    'reportDate',
    'actualStartDate',
    'actualEndDate',
    'progressPercent',
    'weather',
    'highTemperature',
    'lowTemperature',
    'constructionRecord',
    'qualityRecord',
    'safetyRecord',
    'reporter',
    'remark',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressV2ActualRecord = {
  id: string
  projectId: string
  taskName: string
  sectionName: string | null
  reportDate: string
  actualStartDate: Date | null
  actualEndDate: Date | null
  progressPercent: number
  weather: string | null
  highTemperature: string | null
  lowTemperature: string | null
  constructionRecord: string | null
  qualityRecord: string | null
  safetyRecord: string | null
  reporter: string | null
  remark: string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressV2ActualRecords: (db: Knex) =>
    db<ProgressV2ActualRecord>(ProjectProgressV2ActualRecords.name)
}

export type CreateProgressV2ActualRecordParams = {
  projectId: string
  taskName: string
  sectionName?: string | null
  reportDate: string
  actualStartDate?: Date | null
  actualEndDate?: Date | null
  progressPercent?: number
  weather?: string | null
  highTemperature?: string | null
  lowTemperature?: string | null
  constructionRecord?: string | null
  qualityRecord?: string | null
  safetyRecord?: string | null
  reporter?: string | null
  remark?: string | null
  creator: string
  updater: string
}

export type UpdateProgressV2ActualRecordParams = {
  id: string
  projectId: string
  taskName?: string
  sectionName?: string | null
  reportDate?: string
  actualStartDate?: Date | null
  actualEndDate?: Date | null
  progressPercent?: number
  weather?: string | null
  highTemperature?: string | null
  lowTemperature?: string | null
  constructionRecord?: string | null
  qualityRecord?: string | null
  safetyRecord?: string | null
  reporter?: string | null
  remark?: string | null
  updater: string
}

export const listProgressV2ActualRecordsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; search?: string }): Promise<ProgressV2ActualRecord[]> => {
    let query = tables
      .projectProgressV2ActualRecords(deps.db)
      .where({
        [ProjectProgressV2ActualRecords.col.projectId]: params.projectId
      })

    if (params.search?.trim()) {
      const s = `%${params.search.trim()}%`
      query = query.andWhere((builder) => {
        builder.whereILike('taskName', s).orWhereILike('reporter', s)
      })
    }

    return await query.orderBy(ProjectProgressV2ActualRecords.col.reportDate, 'desc').orderBy(ProjectProgressV2ActualRecords.col.createdAt, 'desc')
  }

export const getProgressV2ActualRecordByIdFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string; projectId: string }): Promise<ProgressV2ActualRecord | undefined> => {
    return await tables
      .projectProgressV2ActualRecords(deps.db)
      .where({
        [ProjectProgressV2ActualRecords.col.id]: params.id,
        [ProjectProgressV2ActualRecords.col.projectId]: params.projectId
      })
      .first()
  }

export const createProgressV2ActualRecordFactory =
  (deps: { db: Knex }) =>
  async (params: CreateProgressV2ActualRecordParams): Promise<ProgressV2ActualRecord> => {
    const [inserted] = await tables.projectProgressV2ActualRecords(deps.db).insert(
      {
        id: generateId(),
        projectId: params.projectId,
        taskName: params.taskName,
        sectionName: params.sectionName ?? null,
        reportDate: params.reportDate,
        actualStartDate: params.actualStartDate ?? null,
        actualEndDate: params.actualEndDate ?? null,
        progressPercent: params.progressPercent ?? 0,
        weather: params.weather ?? null,
        highTemperature: params.highTemperature ?? null,
        lowTemperature: params.lowTemperature ?? null,
        constructionRecord: params.constructionRecord ?? null,
        qualityRecord: params.qualityRecord ?? null,
        safetyRecord: params.safetyRecord ?? null,
        reporter: params.reporter ?? null,
        remark: params.remark ?? null,
        creator: params.creator,
        updater: params.updater
      },
      '*'
    )
    return inserted
  }

export const updateProgressV2ActualRecordFactory =
  (deps: { db: Knex }) =>
  async (params: UpdateProgressV2ActualRecordParams): Promise<ProgressV2ActualRecord | undefined> => {
    const updateData: Record<string, unknown> = {
      updater: params.updater,
      updatedAt: new Date()
    }
    if (params.taskName !== undefined) updateData.taskName = params.taskName
    if (params.sectionName !== undefined) updateData.sectionName = params.sectionName
    if (params.reportDate !== undefined) updateData.reportDate = params.reportDate
    if (params.actualStartDate !== undefined) updateData.actualStartDate = params.actualStartDate
    if (params.actualEndDate !== undefined) updateData.actualEndDate = params.actualEndDate
    if (params.progressPercent !== undefined) updateData.progressPercent = params.progressPercent
    if (params.weather !== undefined) updateData.weather = params.weather
    if (params.highTemperature !== undefined) updateData.highTemperature = params.highTemperature
    if (params.lowTemperature !== undefined) updateData.lowTemperature = params.lowTemperature
    if (params.constructionRecord !== undefined) updateData.constructionRecord = params.constructionRecord
    if (params.qualityRecord !== undefined) updateData.qualityRecord = params.qualityRecord
    if (params.safetyRecord !== undefined) updateData.safetyRecord = params.safetyRecord
    if (params.reporter !== undefined) updateData.reporter = params.reporter
    if (params.remark !== undefined) updateData.remark = params.remark

    const [updated] = await tables
      .projectProgressV2ActualRecords(deps.db)
      .where({
        [ProjectProgressV2ActualRecords.col.id]: params.id,
        [ProjectProgressV2ActualRecords.col.projectId]: params.projectId
      })
      .update(updateData, '*')

    return updated
  }

export const deleteProgressV2ActualRecordFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string; projectId: string }): Promise<boolean> => {
    const count = await tables
      .projectProgressV2ActualRecords(deps.db)
      .where({
        [ProjectProgressV2ActualRecords.col.id]: params.id,
        [ProjectProgressV2ActualRecords.col.projectId]: params.projectId
      })
      .del()
    return count > 0
  }
