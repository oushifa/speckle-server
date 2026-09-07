import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressV2MonthlyPlans = buildTableHelper(
  'project_progress_v2_monthly_plans',
  [
    'id',
    'projectId',
    'yearMonth',
    'title',
    'startDate',
    'endDate',
    'preparedBy',
    'remark',
    'tasks',
    'attachments',
    'createdBy',
    'createdAt',
    'updatedAt'
  ]
)

export type MonthlyPlanTaskItem = {
  id: string
  taskName: string
  startDate?: string | null
  endDate?: string | null
  plannedVolume?: string | null
  actualVolume?: string | null
  unit?: string | null
  progressPercent?: number
  responsible?: string | null
  remark?: string | null
}

export type ProgressV2MonthlyPlanAttachment = {
  blobId: string
  fileName: string
  fileSize?: number | string | null
}

export type ProgressV2MonthlyPlanRecord = {
  id: string
  projectId: string
  yearMonth: string
  title: string | null
  startDate: Date | null
  endDate: Date | null
  preparedBy: string | null
  remark: string | null
  tasks: MonthlyPlanTaskItem[] | string
  attachments: ProgressV2MonthlyPlanAttachment[] | string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressV2MonthlyPlans: (db: Knex) =>
    db<ProgressV2MonthlyPlanRecord>(ProjectProgressV2MonthlyPlans.name)
}

const normalizeMonthlyPlan = (
  record?: ProgressV2MonthlyPlanRecord
): ProgressV2MonthlyPlanRecord | undefined => {
  if (!record) return undefined
  let tasks = record.tasks
  if (typeof tasks === 'string') {
    try {
      tasks = JSON.parse(tasks)
    } catch {
      tasks = []
    }
  }

  let attachments = record.attachments
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments)
    } catch {
      attachments = []
    }
  }
  if (!attachments || !Array.isArray(attachments)) {
    attachments = []
  }

  return {
    ...record,
    tasks: tasks || [],
    attachments
  }
}

export type CreateProgressV2MonthlyPlanParams = {
  projectId: string
  yearMonth: string
  title?: string | null
  startDate?: Date | null
  endDate?: Date | null
  preparedBy?: string | null
  remark?: string | null
  tasks?: MonthlyPlanTaskItem[]
  attachments?: ProgressV2MonthlyPlanAttachment[] | null
  createdBy: string
}

export type UpdateProgressV2MonthlyPlanParams = {
  id: string
  projectId: string
  title?: string | null
  startDate?: Date | null
  endDate?: Date | null
  preparedBy?: string | null
  remark?: string | null
  tasks?: MonthlyPlanTaskItem[]
  attachments?: ProgressV2MonthlyPlanAttachment[] | null
}

export const listProgressV2MonthlyPlansFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<ProgressV2MonthlyPlanRecord[]> => {
    const list = await tables
      .projectProgressV2MonthlyPlans(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlans.col.projectId]: params.projectId
      })
      .orderBy(ProjectProgressV2MonthlyPlans.col.yearMonth, 'desc')

    return list.map((item) => normalizeMonthlyPlan(item) as ProgressV2MonthlyPlanRecord)
  }

export const getProgressV2MonthlyPlanByIdFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id: string
    projectId: string
  }): Promise<ProgressV2MonthlyPlanRecord | undefined> => {
    const record = await tables
      .projectProgressV2MonthlyPlans(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlans.col.id]: params.id,
        [ProjectProgressV2MonthlyPlans.col.projectId]: params.projectId
      })
      .first()

    return normalizeMonthlyPlan(record)
  }

export const getProgressV2MonthlyPlanByYearMonthFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    yearMonth: string
  }): Promise<ProgressV2MonthlyPlanRecord | undefined> => {
    const record = await tables
      .projectProgressV2MonthlyPlans(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlans.col.projectId]: params.projectId,
        [ProjectProgressV2MonthlyPlans.col.yearMonth]: params.yearMonth
      })
      .first()

    return normalizeMonthlyPlan(record)
  }

export const createProgressV2MonthlyPlanFactory =
  (deps: { db: Knex }) =>
  async (
    params: CreateProgressV2MonthlyPlanParams
  ): Promise<ProgressV2MonthlyPlanRecord> => {
    const tasksJson = JSON.stringify(params.tasks || [])
    const attachmentsJson = params.attachments
      ? JSON.stringify(params.attachments)
      : null
    const [inserted] = await tables.projectProgressV2MonthlyPlans(deps.db).insert(
      {
        id: generateId(),
        projectId: params.projectId,
        yearMonth: params.yearMonth,
        title: params.title ?? `${params.yearMonth} 月度施工计划`,
        startDate: params.startDate ?? null,
        endDate: params.endDate ?? null,
        preparedBy: params.preparedBy ?? null,
        remark: params.remark ?? null,
        tasks: tasksJson as string,
        attachments: attachmentsJson as string | null,
        createdBy: params.createdBy
      },
      '*'
    )
    return normalizeMonthlyPlan(inserted) as ProgressV2MonthlyPlanRecord
  }

export const updateProgressV2MonthlyPlanFactory =
  (deps: { db: Knex }) =>
  async (
    params: UpdateProgressV2MonthlyPlanParams
  ): Promise<ProgressV2MonthlyPlanRecord | undefined> => {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    }
    if (params.title !== undefined) updateData.title = params.title
    if (params.startDate !== undefined) updateData.startDate = params.startDate
    if (params.endDate !== undefined) updateData.endDate = params.endDate
    if (params.preparedBy !== undefined) updateData.preparedBy = params.preparedBy
    if (params.remark !== undefined) updateData.remark = params.remark
    if (params.tasks !== undefined) updateData.tasks = JSON.stringify(params.tasks)
    if (params.attachments !== undefined) {
      updateData.attachments = params.attachments
        ? JSON.stringify(params.attachments)
        : null
    }

    const [updated] = await tables
      .projectProgressV2MonthlyPlans(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlans.col.id]: params.id,
        [ProjectProgressV2MonthlyPlans.col.projectId]: params.projectId
      })
      .update(updateData, '*')

    return normalizeMonthlyPlan(updated)
  }

export const deleteProgressV2MonthlyPlanFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string; projectId: string }): Promise<boolean> => {
    const count = await tables
      .projectProgressV2MonthlyPlans(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlans.col.id]: params.id,
        [ProjectProgressV2MonthlyPlans.col.projectId]: params.projectId
      })
      .del()
    return count > 0
  }
