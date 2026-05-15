import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressTaskElements = buildTableHelper(
  'project_progress_task_elements',
  [
    'id',
    'projectId',
    'taskId',
    'modelId',
    'applicationId',
    'planStart',
    'planEnd',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressElementRef = {
  modelId: string
  applicationId: string
}

export type ProgressTaskElementRecord = {
  id: string
  projectId: string
  taskId: string
  modelId: string
  applicationId: string
  planStart: Date | null
  planEnd: Date | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

export type UpsertProgressTaskElementInput = ProgressElementRef & {
  taskId: string
  planStart?: Date | string | null
  planEnd?: Date | string | null
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressTaskElements: (db: Knex) =>
    db<ProgressTaskElementRecord>(ProjectProgressTaskElements.name)
}

const taskElementCols = ProjectProgressTaskElements.short.col

const toNullableDate = (value?: string | Date | null) => {
  if (!value) return null
  if (value instanceof Date) return value

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const listProgressTaskElementsByTaskIdsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskIds: string[]
  }): Promise<ProgressTaskElementRecord[]> => {
    if (!params.taskIds.length) return []

    return await tables
      .projectProgressTaskElements(deps.db)
      .where({ [ProjectProgressTaskElements.col.projectId]: params.projectId })
      .whereIn(ProjectProgressTaskElements.col.taskId, params.taskIds)
  }

export const listProgressTaskElementsByElementsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    elements: ProgressElementRef[]
  }): Promise<ProgressTaskElementRecord[]> => {
    if (!params.elements.length) return []

    return await tables
      .projectProgressTaskElements(deps.db)
      .where({ [ProjectProgressTaskElements.col.projectId]: params.projectId })
      .where((query) => {
        params.elements.forEach((element, index) => {
          const method = index === 0 ? 'where' : 'orWhere'
          query[method]((subQuery: Knex.QueryBuilder) => {
            subQuery
              .where(ProjectProgressTaskElements.col.modelId, element.modelId)
              .andWhere(
                ProjectProgressTaskElements.col.applicationId,
                element.applicationId
              )
          })
        })
      })
  }

export const listDistinctTaskIdsByElementsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    elements: ProgressElementRef[]
  }): Promise<string[]> => {
    if (!params.elements.length) return []

    const rows = await tables
      .projectProgressTaskElements(deps.db)
      .distinct(ProjectProgressTaskElements.col.taskId)
      .where({ [ProjectProgressTaskElements.col.projectId]: params.projectId })
      .where((query) => {
        params.elements.forEach((element, index) => {
          const method = index === 0 ? 'where' : 'orWhere'
          query[method]((subQuery: Knex.QueryBuilder) => {
            subQuery
              .where(ProjectProgressTaskElements.col.modelId, element.modelId)
              .andWhere(
                ProjectProgressTaskElements.col.applicationId,
                element.applicationId
              )
          })
        })
      })

    return rows
      .map((row) => row.taskId)
      .filter((taskId): taskId is string => typeof taskId === 'string')
  }

export const replaceProgressTaskElementsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskIds: string[]
    elements: UpsertProgressTaskElementInput[]
    actorId: string
  }): Promise<ProgressTaskElementRecord[]> => {
    if (params.taskIds.length) {
      await tables
        .projectProgressTaskElements(deps.db)
        .where({ [ProjectProgressTaskElements.col.projectId]: params.projectId })
        .whereIn(ProjectProgressTaskElements.col.taskId, params.taskIds)
        .del()
    }

    if (!params.elements.length) return []

    const payload = params.elements.map((element) => ({
      id: generateId(),
      [taskElementCols.projectId]: params.projectId,
      [taskElementCols.taskId]: element.taskId,
      [taskElementCols.modelId]: element.modelId,
      [taskElementCols.applicationId]: element.applicationId,
      [taskElementCols.planStart]: toNullableDate(element.planStart),
      [taskElementCols.planEnd]: toNullableDate(element.planEnd),
      [taskElementCols.creator]: params.actorId,
      [taskElementCols.updater]: params.actorId
    }))

    return await tables.projectProgressTaskElements(deps.db).insert(payload, '*')
  }

export const deleteAllProgressTaskElementsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<void> => {
    await tables
      .projectProgressTaskElements(deps.db)
      .where({ [ProjectProgressTaskElements.col.projectId]: params.projectId })
      .del()
  }
