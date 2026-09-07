import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressV2AnnualPlanTasks = buildTableHelper(
  'project_progress_v2_annual_plan_tasks',
  [
    'id',
    'projectId',
    'annualPlanId',
    'externalId',
    'sysTaskId',
    'quantity',
    'unit',
    'wbs',
    'name',
    'parentId',
    'level',
    'sortOrder',
    'duration',
    'planStart',
    'planEnd',
    'predecessor',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressV2AnnualPlanTaskRecord = {
  id: string
  projectId: string
  annualPlanId: string
  externalId: string | null
  sysTaskId: string | null
  quantity: string | null
  unit: string | null
  wbs: string | null
  name: string
  parentId: string | null
  level: number
  sortOrder: number
  duration: string | null
  planStart: Date | null
  planEnd: Date | null
  predecessor: string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressV2AnnualPlanTasks: (db: Knex) =>
    db<ProgressV2AnnualPlanTaskRecord>(ProjectProgressV2AnnualPlanTasks.name)
}

export type InsertProgressV2AnnualPlanTaskInput = {
  id?: string
  externalId?: string | null
  sysTaskId?: string | null
  quantity?: string | null
  unit?: string | null
  wbs?: string | null
  name: string
  parentId?: string | null
  level?: number
  sortOrder?: number
  duration?: string | null
  planStart?: Date | null
  planEnd?: Date | null
  predecessor?: string | null
  creator: string
  updater: string
}

export const listProgressV2AnnualPlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    annualPlanId: string
  }): Promise<ProgressV2AnnualPlanTaskRecord[]> => {
    return await tables
      .projectProgressV2AnnualPlanTasks(deps.db)
      .where({
        [ProjectProgressV2AnnualPlanTasks.col.projectId]: params.projectId,
        [ProjectProgressV2AnnualPlanTasks.col.annualPlanId]: params.annualPlanId
      })
      .orderBy(ProjectProgressV2AnnualPlanTasks.col.sortOrder, 'asc')
  }

export const replaceProgressV2AnnualPlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    annualPlanId: string
    tasks: InsertProgressV2AnnualPlanTaskInput[]
  }): Promise<ProgressV2AnnualPlanTaskRecord[]> => {
    return await deps.db.transaction(async (trx) => {
      // 1. 删除此年度计划下的旧任务
      await trx(ProjectProgressV2AnnualPlanTasks.name)
        .where({
          [ProjectProgressV2AnnualPlanTasks.col.projectId]: params.projectId,
          [ProjectProgressV2AnnualPlanTasks.col.annualPlanId]: params.annualPlanId
        })
        .del()

      if (!params.tasks.length) return []

      const now = new Date()
      const rows = params.tasks.map((task) => ({
        id: task.id || generateId(),
        projectId: params.projectId,
        annualPlanId: params.annualPlanId,
        externalId: task.externalId ?? null,
        sysTaskId: task.sysTaskId ?? null,
        quantity: task.quantity ?? null,
        unit: task.unit ?? null,
        wbs: task.wbs ?? null,
        name: task.name,
        parentId: task.parentId ?? null,
        level: Number(task.level || 0),
        sortOrder: Number(task.sortOrder || 0),
        duration: task.duration ?? null,
        planStart: task.planStart ?? null,
        planEnd: task.planEnd ?? null,
        predecessor: task.predecessor ?? null,
        creator: task.creator,
        updater: task.updater,
        createdAt: now,
        updatedAt: now
      }))

      const chunkSize = 200
      const inserted: ProgressV2AnnualPlanTaskRecord[] = []
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const res = await trx<ProgressV2AnnualPlanTaskRecord>(
          ProjectProgressV2AnnualPlanTasks.name
        ).insert(chunk, '*')
        inserted.push(...res)
      }

      return inserted
    })
  }

export const deleteProgressV2AnnualPlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; annualPlanId: string }): Promise<void> => {
    await tables
      .projectProgressV2AnnualPlanTasks(deps.db)
      .where({
        [ProjectProgressV2AnnualPlanTasks.col.projectId]: params.projectId,
        [ProjectProgressV2AnnualPlanTasks.col.annualPlanId]: params.annualPlanId
      })
      .del()
  }
