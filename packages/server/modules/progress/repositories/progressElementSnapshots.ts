import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { ProgressElementRef } from '@/modules/progress/repositories/progressTaskElements'
import type { Knex } from 'knex'

export const ProjectProgressElementSnapshots = buildTableHelper(
  'project_progress_element_snapshots',
  [
    'id',
    'projectId',
    'modelId',
    'applicationId',
    'plannedStartAt',
    'plannedFinishAt',
    'actualStartAt',
    'actualFinishAt',
    'progressStatus',
    'progressPercent',
    'isAheadStart',
    'isDelayedFinish',
    'lastReportAt',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressElementSnapshotStatus =
  | 'not_started'
  | 'ready_not_started'
  | 'delayed_not_started'
  | 'in_progress'
  | 'in_progress_delayed'
  | 'finished_ahead'
  | 'finished_on_time'
  | 'finished_delayed'

export type ProgressElementSnapshotRecord = ProgressElementRef & {
  id: string
  projectId: string
  plannedStartAt: Date | null
  plannedFinishAt: Date | null
  actualStartAt: Date | null
  actualFinishAt: Date | null
  progressStatus: ProgressElementSnapshotStatus
  progressPercent: string | null
  isAheadStart: boolean
  isDelayedFinish: boolean
  lastReportAt: Date | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

export type UpsertProgressElementSnapshotInput = ProgressElementRef & {
  plannedStartAt?: Date | null
  plannedFinishAt?: Date | null
  actualStartAt?: Date | null
  actualFinishAt?: Date | null
  progressStatus: ProgressElementSnapshotStatus
  progressPercent?: number | null
  isAheadStart: boolean
  isDelayedFinish: boolean
  lastReportAt?: Date | null
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressElementSnapshots: (db: Knex) =>
    db<ProgressElementSnapshotRecord>(ProjectProgressElementSnapshots.name)
}

const snapshotCols = ProjectProgressElementSnapshots.short.col

export const listProgressElementSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId?: string
    progressStatus?: ProgressElementSnapshotStatus
    page?: number
    limit?: number
  }): Promise<ProgressElementSnapshotRecord[]> => {
    const page = Math.max(params.page || 1, 1)
    const limit = Math.max(params.limit || 50, 1)
    const query = tables
      .projectProgressElementSnapshots(deps.db)
      .where({ [ProjectProgressElementSnapshots.col.projectId]: params.projectId })
      .orderBy(ProjectProgressElementSnapshots.col.updatedAt, 'desc')

    if (params.modelId) {
      query.andWhere(ProjectProgressElementSnapshots.col.modelId, params.modelId)
    }
    if (params.progressStatus) {
      query.andWhere(
        ProjectProgressElementSnapshots.col.progressStatus,
        params.progressStatus
      )
    }

    return await query.offset((page - 1) * limit).limit(limit)
  }

export const countProgressElementSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId?: string
    progressStatus?: ProgressElementSnapshotStatus
    isAheadStart?: boolean
    isDelayedFinish?: boolean
  }): Promise<number> => {
    const query = tables
      .projectProgressElementSnapshots(deps.db)
      .where({ [ProjectProgressElementSnapshots.col.projectId]: params.projectId })
      .count<{ count: string }[]>({ count: '*' })
      .first()

    if (params.modelId) {
      query.andWhere(ProjectProgressElementSnapshots.col.modelId, params.modelId)
    }
    if (params.progressStatus) {
      query.andWhere(
        ProjectProgressElementSnapshots.col.progressStatus,
        params.progressStatus
      )
    }
    if (params.isAheadStart !== undefined) {
      query.andWhere(
        ProjectProgressElementSnapshots.col.isAheadStart,
        params.isAheadStart
      )
    }
    if (params.isDelayedFinish !== undefined) {
      query.andWhere(
        ProjectProgressElementSnapshots.col.isDelayedFinish,
        params.isDelayedFinish
      )
    }

    const result = await query
    return Number(result?.count || 0)
  }

export const listProgressElementSnapshotsByElementsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    elements: ProgressElementRef[]
  }): Promise<ProgressElementSnapshotRecord[]> => {
    if (!params.elements.length) return []

    return await tables
      .projectProgressElementSnapshots(deps.db)
      .where({ [ProjectProgressElementSnapshots.col.projectId]: params.projectId })
      .where((query) => {
        params.elements.forEach((element, index) => {
          const method = index === 0 ? 'where' : 'orWhere'
          query[method]((subQuery: Knex.QueryBuilder) => {
            subQuery
              .where(ProjectProgressElementSnapshots.col.modelId, element.modelId)
              .andWhere(
                ProjectProgressElementSnapshots.col.applicationId,
                element.applicationId
              )
          })
        })
      })
  }

export const upsertProgressElementSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    actorId: string
    snapshots: UpsertProgressElementSnapshotInput[]
  }): Promise<void> => {
    if (!params.snapshots.length) return

    const payload = params.snapshots.map((snapshot) => ({
      id: generateId(),
      [snapshotCols.projectId]: params.projectId,
      [snapshotCols.modelId]: snapshot.modelId,
      [snapshotCols.applicationId]: snapshot.applicationId,
      [snapshotCols.plannedStartAt]: snapshot.plannedStartAt || null,
      [snapshotCols.plannedFinishAt]: snapshot.plannedFinishAt || null,
      [snapshotCols.actualStartAt]: snapshot.actualStartAt || null,
      [snapshotCols.actualFinishAt]: snapshot.actualFinishAt || null,
      [snapshotCols.progressStatus]: snapshot.progressStatus,
      [snapshotCols.progressPercent]:
        snapshot.progressPercent === undefined || snapshot.progressPercent === null
          ? null
          : snapshot.progressPercent,
      [snapshotCols.isAheadStart]: snapshot.isAheadStart,
      [snapshotCols.isDelayedFinish]: snapshot.isDelayedFinish,
      [snapshotCols.lastReportAt]: snapshot.lastReportAt || null,
      [snapshotCols.creator]: params.actorId,
      [snapshotCols.updater]: params.actorId
    }))

    await tables
      .projectProgressElementSnapshots(deps.db)
      .insert(payload)
      .onConflict(['projectId', 'modelId', 'applicationId'])
      .merge([
        'plannedStartAt',
        'plannedFinishAt',
        'actualStartAt',
        'actualFinishAt',
        'progressStatus',
        'progressPercent',
        'isAheadStart',
        'isDelayedFinish',
        'lastReportAt',
        'updater',
        'updatedAt'
      ])
  }

export const deleteProgressElementSnapshotsByElementsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    elements: ProgressElementRef[]
  }): Promise<void> => {
    if (!params.elements.length) return

    await tables
      .projectProgressElementSnapshots(deps.db)
      .where({ [ProjectProgressElementSnapshots.col.projectId]: params.projectId })
      .where((query) => {
        params.elements.forEach((element, index) => {
          const method = index === 0 ? 'where' : 'orWhere'
          query[method]((subQuery: Knex.QueryBuilder) => {
            subQuery
              .where(ProjectProgressElementSnapshots.col.modelId, element.modelId)
              .andWhere(
                ProjectProgressElementSnapshots.col.applicationId,
                element.applicationId
              )
          })
        })
      })
      .del()
  }

export const deleteAllProgressElementSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<void> => {
    await tables
      .projectProgressElementSnapshots(deps.db)
      .where({ [ProjectProgressElementSnapshots.col.projectId]: params.projectId })
      .del()
  }
