import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressV2Milestones = buildTableHelper(
  'project_progress_v2_milestones',
  [
    'id',
    'projectId',
    'taskName',
    'plannedStart',
    'plannedEnd',
    'actualStart',
    'actualEnd',
    'status',
    'milestoneType',
    'responsible',
    'remark',
    'tags',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressV2MilestoneRecord = {
  id: string
  projectId: string
  taskName: string
  plannedStart: Date | null
  plannedEnd: Date | null
  actualStart: Date | null
  actualEnd: Date | null
  status: string
  milestoneType: string | null
  responsible: string | null
  remark: string | null
  tags: string[] | string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressV2Milestones: (db: Knex) =>
    db<ProgressV2MilestoneRecord>(ProjectProgressV2Milestones.name)
}

export type CreateProgressV2MilestoneParams = {
  projectId: string
  taskName: string
  plannedStart?: Date | null
  plannedEnd?: Date | null
  actualStart?: Date | null
  actualEnd?: Date | null
  status?: string
  milestoneType?: string | null
  responsible?: string | null
  remark?: string | null
  tags?: string[]
  creator: string
  updater: string
}

export type UpdateProgressV2MilestoneParams = {
  id: string
  projectId: string
  taskName?: string
  plannedStart?: Date | null
  plannedEnd?: Date | null
  actualStart?: Date | null
  actualEnd?: Date | null
  status?: string
  milestoneType?: string | null
  responsible?: string | null
  remark?: string | null
  tags?: string[]
  updater: string
}

export const listProgressV2MilestonesFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    search?: string
  }): Promise<ProgressV2MilestoneRecord[]> => {
    let query = tables.projectProgressV2Milestones(deps.db).where({
      [ProjectProgressV2Milestones.col.projectId]: params.projectId
    })

    if (params.search?.trim()) {
      const s = `%${params.search.trim()}%`
      query = query.andWhere((b) => {
        b.whereILike('taskName', s).orWhereILike('responsible', s)
      })
    }

    return await query
      .orderBy(ProjectProgressV2Milestones.col.plannedEnd, 'asc')
      .orderBy(ProjectProgressV2Milestones.col.createdAt, 'desc')
  }

export const getProgressV2MilestoneByIdFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id: string
    projectId: string
  }): Promise<ProgressV2MilestoneRecord | undefined> => {
    return await tables
      .projectProgressV2Milestones(deps.db)
      .where({
        [ProjectProgressV2Milestones.col.id]: params.id,
        [ProjectProgressV2Milestones.col.projectId]: params.projectId
      })
      .first()
  }

export const createProgressV2MilestoneFactory =
  (deps: { db: Knex }) =>
  async (
    params: CreateProgressV2MilestoneParams
  ): Promise<ProgressV2MilestoneRecord> => {
    const tagsJson = JSON.stringify(params.tags || ['milestone'])
    const [inserted] = await tables.projectProgressV2Milestones(deps.db).insert(
      {
        id: generateId(),
        projectId: params.projectId,
        taskName: params.taskName,
        plannedStart: params.plannedStart ?? null,
        plannedEnd: params.plannedEnd ?? null,
        actualStart: params.actualStart ?? null,
        actualEnd: params.actualEnd ?? null,
        status: params.status ?? '未开始',
        milestoneType: params.milestoneType ?? 'phase',
        responsible: params.responsible ?? null,
        remark: params.remark ?? null,
        tags: tagsJson as string,
        creator: params.creator,
        updater: params.updater
      },
      '*'
    )
    return inserted
  }

export const updateProgressV2MilestoneFactory =
  (deps: { db: Knex }) =>
  async (
    params: UpdateProgressV2MilestoneParams
  ): Promise<ProgressV2MilestoneRecord | undefined> => {
    const updateData: Record<string, unknown> = {
      updater: params.updater,
      updatedAt: new Date()
    }
    if (params.taskName !== undefined) updateData.taskName = params.taskName
    if (params.plannedStart !== undefined) updateData.plannedStart = params.plannedStart
    if (params.plannedEnd !== undefined) updateData.plannedEnd = params.plannedEnd
    if (params.actualStart !== undefined) updateData.actualStart = params.actualStart
    if (params.actualEnd !== undefined) updateData.actualEnd = params.actualEnd
    if (params.status !== undefined) updateData.status = params.status
    if (params.milestoneType !== undefined)
      updateData.milestoneType = params.milestoneType
    if (params.responsible !== undefined) updateData.responsible = params.responsible
    if (params.remark !== undefined) updateData.remark = params.remark
    if (params.tags !== undefined) updateData.tags = JSON.stringify(params.tags)

    const [updated] = await tables
      .projectProgressV2Milestones(deps.db)
      .where({
        [ProjectProgressV2Milestones.col.id]: params.id,
        [ProjectProgressV2Milestones.col.projectId]: params.projectId
      })
      .update(updateData, '*')

    return updated
  }

export const deleteProgressV2MilestoneFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string; projectId: string }): Promise<boolean> => {
    const count = await tables
      .projectProgressV2Milestones(deps.db)
      .where({
        [ProjectProgressV2Milestones.col.id]: params.id,
        [ProjectProgressV2Milestones.col.projectId]: params.projectId
      })
      .del()
    return count > 0
  }
