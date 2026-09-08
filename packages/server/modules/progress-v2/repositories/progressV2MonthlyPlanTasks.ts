import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressV2MonthlyPlanTasks = buildTableHelper(
  'project_progress_v2_monthly_plan_tasks',
  [
    'id',
    'projectId',
    'monthlyPlanId',
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
    'BIM',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressV2MonthlyPlanTaskRecord = {
  id: string
  projectId: string
  monthlyPlanId: string
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
  BIM: unknown
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressV2MonthlyPlanTasks: (db: Knex) =>
    db<ProgressV2MonthlyPlanTaskRecord>(ProjectProgressV2MonthlyPlanTasks.name)
}

export type InsertProgressV2MonthlyPlanTaskInput = {
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
  BIM?: unknown
  creator: string
  updater: string
}

export const listProgressV2MonthlyPlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    monthlyPlanId: string
  }): Promise<ProgressV2MonthlyPlanTaskRecord[]> => {
    return await tables
      .projectProgressV2MonthlyPlanTasks(deps.db)
      .where({
        [ProjectProgressV2MonthlyPlanTasks.col.projectId]: params.projectId,
        [ProjectProgressV2MonthlyPlanTasks.col.monthlyPlanId]: params.monthlyPlanId
      })
      .orderBy(ProjectProgressV2MonthlyPlanTasks.col.sortOrder, 'asc')
  }

export const replaceProgressV2MonthlyPlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    monthlyPlanId: string
    tasks: InsertProgressV2MonthlyPlanTaskInput[]
  }): Promise<ProgressV2MonthlyPlanTaskRecord[]> => {
    return await deps.db.transaction(async (trx) => {
      // 1. 删除旧任务
      await tables
        .projectProgressV2MonthlyPlanTasks(trx)
        .where({
          [ProjectProgressV2MonthlyPlanTasks.col.projectId]: params.projectId,
          [ProjectProgressV2MonthlyPlanTasks.col.monthlyPlanId]: params.monthlyPlanId
        })
        .del()

      if (!params.tasks.length) {
        return []
      }

      // 2. 建立 id 映射（如果是临时 id）
      const idMap = new Map<string, string>()
      params.tasks.forEach((t) => {
        if (t.id) {
          idMap.set(t.id, generateId())
        }
      })

      const now = new Date()
      const recordsToInsert: Array<
        Omit<ProgressV2MonthlyPlanTaskRecord, 'createdAt' | 'updatedAt'> & {
          createdAt: Date
          updatedAt: Date
        }
      > = params.tasks.map((t, idx) => {
        const newId = (t.id && idMap.get(t.id)) || generateId()
        const parentId = (t.parentId && idMap.get(t.parentId)) || t.parentId || null
        return {
          id: newId,
          projectId: params.projectId,
          monthlyPlanId: params.monthlyPlanId,
          externalId: t.externalId || null,
          sysTaskId: t.sysTaskId || null,
          quantity: t.quantity || null,
          unit: t.unit || null,
          wbs: t.wbs || null,
          name: t.name,
          parentId,
          level: t.level ?? 0,
          sortOrder: t.sortOrder ?? idx,
          duration: t.duration || null,
          planStart: t.planStart || null,
          planEnd: t.planEnd || null,
          predecessor: t.predecessor || null,
          BIM: t.BIM || null,
          creator: t.creator,
          updater: t.updater,
          createdAt: now,
          updatedAt: now
        }
      })

      // 批量写入（每批 200 条）
      const chunkSize = 200
      for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
        const chunk = recordsToInsert.slice(i, i + chunkSize)
        await tables.projectProgressV2MonthlyPlanTasks(trx).insert(chunk)
      }

      return await tables
        .projectProgressV2MonthlyPlanTasks(trx)
        .where({
          [ProjectProgressV2MonthlyPlanTasks.col.projectId]: params.projectId,
          [ProjectProgressV2MonthlyPlanTasks.col.monthlyPlanId]: params.monthlyPlanId
        })
        .orderBy(ProjectProgressV2MonthlyPlanTasks.col.sortOrder, 'asc')
    })
  }
