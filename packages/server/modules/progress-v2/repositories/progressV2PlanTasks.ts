import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressV2PlanTasks = buildTableHelper(
  'project_progress_v2_plan_tasks',
  [
    'id',
    'projectId',
    'planFileId',
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

export type ProgressV2PlanTaskRecord = {
  id: string
  projectId: string
  planFileId: string | null
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
  projectProgressV2PlanTasks: (db: Knex) =>
    db<ProgressV2PlanTaskRecord>(ProjectProgressV2PlanTasks.name)
}

export type InsertProgressV2PlanTaskInput = {
  id?: string
  planFileId?: string | null
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

export const listProgressV2PlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<ProgressV2PlanTaskRecord[]> => {
    return await tables
      .projectProgressV2PlanTasks(deps.db)
      .where({
        [ProjectProgressV2PlanTasks.col.projectId]: params.projectId
      })
      .orderBy(ProjectProgressV2PlanTasks.col.sortOrder, 'asc')
  }

export const getProgressV2PlanTaskFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string; projectId: string }): Promise<ProgressV2PlanTaskRecord | undefined> => {
    return await tables
      .projectProgressV2PlanTasks(deps.db)
      .where({
        [ProjectProgressV2PlanTasks.col.id]: params.id,
        [ProjectProgressV2PlanTasks.col.projectId]: params.projectId
      })
      .first()
  }

export const replaceProgressV2PlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    planFileId: string
    tasks: InsertProgressV2PlanTaskInput[]
  }): Promise<ProgressV2PlanTaskRecord[]> => {
    return await deps.db.transaction(async (trx) => {
      // 1. 删除旧任务
      await trx(ProjectProgressV2PlanTasks.name)
        .where({
          [ProjectProgressV2PlanTasks.col.projectId]: params.projectId
        })
        .del()

      if (!params.tasks.length) return []

      const now = new Date()
      const rows = params.tasks.map((task) => ({
        id: task.id || generateId(),
        projectId: params.projectId,
        planFileId: params.planFileId,
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

      // 分批写入，防止参数超过数据库上限
      const chunkSize = 200
      const inserted: ProgressV2PlanTaskRecord[] = []
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const res = await trx<ProgressV2PlanTaskRecord>(ProjectProgressV2PlanTasks.name).insert(
          chunk,
          '*'
        )
        inserted.push(...res)
      }

      return inserted
    })
  }
