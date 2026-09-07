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
    'remark',
    'tasks',
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

export type ProgressV2MonthlyPlanRecord = {
  id: string
  projectId: string
  yearMonth: string
  title: string | null
  remark: string | null
  tasks: MonthlyPlanTaskItem[] | string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressV2MonthlyPlans: (db: Knex) =>
    db<ProgressV2MonthlyPlanRecord>(ProjectProgressV2MonthlyPlans.name)
}

export type CreateProgressV2MonthlyPlanParams = {
  projectId: string
  yearMonth: string
  title?: string | null
  remark?: string | null
  tasks?: MonthlyPlanTaskItem[]
  createdBy: string
}

export type UpdateProgressV2MonthlyPlanParams = {
  id: string
  projectId: string
  title?: string | null
  remark?: string | null
  tasks?: MonthlyPlanTaskItem[]
}

export const listProgressV2MonthlyPlansFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<ProgressV2MonthlyPlanRecord[]> => {
    return await tables
      .projectProgressV2MonthlyPlans(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlans.col.projectId]: params.projectId
      })
      .orderBy(ProjectProgressV2MonthlyPlans.col.yearMonth, 'desc')
  }

export const getProgressV2MonthlyPlanByIdFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string; projectId: string }): Promise<ProgressV2MonthlyPlanRecord | undefined> => {
    return await tables
      .projectProgressV2MonthlyPlans(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlans.col.id]: params.id,
        [ProjectProgressV2MonthlyPlans.col.projectId]: params.projectId
      })
      .first()
  }

export const getProgressV2MonthlyPlanByYearMonthFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; yearMonth: string }): Promise<ProgressV2MonthlyPlanRecord | undefined> => {
    return await tables
      .projectProgressV2MonthlyPlans(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlans.col.projectId]: params.projectId,
        [ProjectProgressV2MonthlyPlans.col.yearMonth]: params.yearMonth
      })
      .first()
  }

export const createProgressV2MonthlyPlanFactory =
  (deps: { db: Knex }) =>
  async (params: CreateProgressV2MonthlyPlanParams): Promise<ProgressV2MonthlyPlanRecord> => {
    const tasksJson = JSON.stringify(params.tasks || [])
    const [inserted] = await tables.projectProgressV2MonthlyPlans(deps.db).insert(
      {
        id: generateId(),
        projectId: params.projectId,
        yearMonth: params.yearMonth,
        title: params.title ?? `${params.yearMonth} 月度施工计划`,
        remark: params.remark ?? null,
        tasks: tasksJson as any,
        createdBy: params.createdBy
      },
      '*'
    )
    return inserted
  }

export const updateProgressV2MonthlyPlanFactory =
  (deps: { db: Knex }) =>
  async (params: UpdateProgressV2MonthlyPlanParams): Promise<ProgressV2MonthlyPlanRecord | undefined> => {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    }
    if (params.title !== undefined) updateData.title = params.title
    if (params.remark !== undefined) updateData.remark = params.remark
    if (params.tasks !== undefined) updateData.tasks = JSON.stringify(params.tasks)

    const [updated] = await tables
      .projectProgressV2MonthlyPlans(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlans.col.id]: params.id,
        [ProjectProgressV2MonthlyPlans.col.projectId]: params.projectId
      })
      .update(updateData, '*')

    return updated
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
