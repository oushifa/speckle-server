import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressTaskSnapshots = buildTableHelper(
  'project_progress_task_snapshots',
  [
    'id',
    'projectId',
    'taskId',
    'totalElementCount',
    'finishedElementCount',
    'inProgressElementCount',
    'notStartedElementCount',
    'delayedElementCount',
    'completionRate',
    'plannedStartAt',
    'plannedFinishAt',
    'actualStartAt',
    'actualFinishAt',
    'taskStatus',
    'lastCalculatedAt',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressTaskSnapshotStatus =
  | 'no_bim_link'
  | 'not_started'
  | 'in_progress'
  | 'delayed'
  | 'finished_on_time'
  | 'finished_delayed'

export type ProgressTaskSnapshotRecord = {
  id: string
  projectId: string
  taskId: string
  totalElementCount: number
  finishedElementCount: number
  inProgressElementCount: number
  notStartedElementCount: number
  delayedElementCount: number
  completionRate: string
  plannedStartAt: Date | null
  plannedFinishAt: Date | null
  actualStartAt: Date | null
  actualFinishAt: Date | null
  taskStatus: ProgressTaskSnapshotStatus
  lastCalculatedAt: Date | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

export type UpsertProgressTaskSnapshotInput = {
  taskId: string
  totalElementCount: number
  finishedElementCount: number
  inProgressElementCount: number
  notStartedElementCount: number
  delayedElementCount: number
  completionRate: number
  plannedStartAt?: Date | null
  plannedFinishAt?: Date | null
  actualStartAt?: Date | null
  actualFinishAt?: Date | null
  taskStatus: ProgressTaskSnapshotStatus
  lastCalculatedAt?: Date | null
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressTaskSnapshots: (db: Knex) =>
    db<ProgressTaskSnapshotRecord>(ProjectProgressTaskSnapshots.name)
}

const snapshotCols = ProjectProgressTaskSnapshots.short.col

export const listProgressTaskSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskStatus?: ProgressTaskSnapshotStatus
    keyword?: string
    page?: number
    limit?: number
  }): Promise<ProgressTaskSnapshotRecord[]> => {
    const page = Math.max(params.page || 1, 1)
    const limit = Math.max(params.limit || 50, 1)
    const query = tables
      .projectProgressTaskSnapshots(deps.db)
      .where({ [ProjectProgressTaskSnapshots.col.projectId]: params.projectId })
      .orderBy(ProjectProgressTaskSnapshots.col.updatedAt, 'desc')

    if (params.taskStatus) {
      query.andWhere(ProjectProgressTaskSnapshots.col.taskStatus, params.taskStatus)
    }
    if (params.keyword) {
      query.andWhere(
        ProjectProgressTaskSnapshots.col.taskId,
        'like',
        `%${params.keyword}%`
      )
    }

    return await query.offset((page - 1) * limit).limit(limit)
  }

export const countProgressTaskSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskStatus?: ProgressTaskSnapshotStatus
    keyword?: string
  }): Promise<number> => {
    const query = tables
      .projectProgressTaskSnapshots(deps.db)
      .where({ [ProjectProgressTaskSnapshots.col.projectId]: params.projectId })
      .count<{ count: string }[]>({ count: '*' })
      .first()

    if (params.taskStatus) {
      query.andWhere(ProjectProgressTaskSnapshots.col.taskStatus, params.taskStatus)
    }
    if (params.keyword) {
      query.andWhere(
        ProjectProgressTaskSnapshots.col.taskId,
        'like',
        `%${params.keyword}%`
      )
    }

    const result = await query
    return Number(result?.count || 0)
  }

export const upsertProgressTaskSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    actorId: string
    snapshots: UpsertProgressTaskSnapshotInput[]
  }): Promise<void> => {
    if (!params.snapshots.length) return

    const payload = params.snapshots.map((snapshot) => ({
      id: generateId(),
      [snapshotCols.projectId]: params.projectId,
      [snapshotCols.taskId]: snapshot.taskId,
      [snapshotCols.totalElementCount]: snapshot.totalElementCount,
      [snapshotCols.finishedElementCount]: snapshot.finishedElementCount,
      [snapshotCols.inProgressElementCount]: snapshot.inProgressElementCount,
      [snapshotCols.notStartedElementCount]: snapshot.notStartedElementCount,
      [snapshotCols.delayedElementCount]: snapshot.delayedElementCount,
      [snapshotCols.completionRate]: snapshot.completionRate,
      [snapshotCols.plannedStartAt]: snapshot.plannedStartAt || null,
      [snapshotCols.plannedFinishAt]: snapshot.plannedFinishAt || null,
      [snapshotCols.actualStartAt]: snapshot.actualStartAt || null,
      [snapshotCols.actualFinishAt]: snapshot.actualFinishAt || null,
      [snapshotCols.taskStatus]: snapshot.taskStatus,
      [snapshotCols.lastCalculatedAt]: snapshot.lastCalculatedAt || null,
      [snapshotCols.creator]: params.actorId,
      [snapshotCols.updater]: params.actorId
    }))

    await tables
      .projectProgressTaskSnapshots(deps.db)
      .insert(payload)
      .onConflict(['projectId', 'taskId'])
      .merge([
        'totalElementCount',
        'finishedElementCount',
        'inProgressElementCount',
        'notStartedElementCount',
        'delayedElementCount',
        'completionRate',
        'plannedStartAt',
        'plannedFinishAt',
        'actualStartAt',
        'actualFinishAt',
        'taskStatus',
        'lastCalculatedAt',
        'updater',
        'updatedAt'
      ])
  }

export const deleteProgressTaskSnapshotsByTaskIdsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; taskIds: string[] }): Promise<void> => {
    if (!params.taskIds.length) return

    await tables
      .projectProgressTaskSnapshots(deps.db)
      .where({ [ProjectProgressTaskSnapshots.col.projectId]: params.projectId })
      .whereIn(ProjectProgressTaskSnapshots.col.taskId, params.taskIds)
      .del()
  }

export const deleteAllProgressTaskSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<void> => {
    await tables
      .projectProgressTaskSnapshots(deps.db)
      .where({ [ProjectProgressTaskSnapshots.col.projectId]: params.projectId })
      .del()
  }
