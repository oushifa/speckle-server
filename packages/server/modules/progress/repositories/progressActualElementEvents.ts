import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { ProgressElementRef } from '@/modules/progress/repositories/progressTaskElements'
import type { Knex } from 'knex'

export const ProjectProgressActualElementEvents = buildTableHelper(
  'project_progress_actual_element_events',
  [
    'id',
    'projectId',
    'recordId',
    'modelId',
    'applicationId',
    'eventType',
    'eventAt',
    'reportDate',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressActualElementEventType = 'start' | 'finish'

export type ProgressActualElementEventRecord = ProgressElementRef & {
  id: string
  projectId: string
  recordId: string
  eventType: ProgressActualElementEventType
  eventAt: Date
  reportDate: string
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

export type UpsertProgressActualElementEventInput = ProgressElementRef & {
  eventType: ProgressActualElementEventType
  eventAt: Date | string
  reportDate: string
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressActualElementEvents: (db: Knex) =>
    db<ProgressActualElementEventRecord>(ProjectProgressActualElementEvents.name)
}

const eventCols = ProjectProgressActualElementEvents.short.col

const toDate = (value: string | Date) => {
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export const listProgressActualElementEventsByElementsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    elements: ProgressElementRef[]
  }): Promise<ProgressActualElementEventRecord[]> => {
    if (!params.elements.length) return []

    return await tables
      .projectProgressActualElementEvents(deps.db)
      .where({ [ProjectProgressActualElementEvents.col.projectId]: params.projectId })
      .where((query) => {
        params.elements.forEach((element, index) => {
          const method = index === 0 ? 'where' : 'orWhere'
          query[method]((subQuery: Knex.QueryBuilder) => {
            subQuery
              .where(ProjectProgressActualElementEvents.col.modelId, element.modelId)
              .andWhere(
                ProjectProgressActualElementEvents.col.applicationId,
                element.applicationId
              )
          })
        })
      })
  }

export const replaceProgressActualElementEventsForRecordFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    recordId: string
    events: UpsertProgressActualElementEventInput[]
    actorId: string
  }): Promise<ProgressActualElementEventRecord[]> => {
    await tables
      .projectProgressActualElementEvents(deps.db)
      .where({ [ProjectProgressActualElementEvents.col.projectId]: params.projectId })
      .andWhere({ [ProjectProgressActualElementEvents.col.recordId]: params.recordId })
      .del()

    if (!params.events.length) return []

    const payload = params.events.map((event) => ({
      id: generateId(),
      [eventCols.projectId]: params.projectId,
      [eventCols.recordId]: params.recordId,
      [eventCols.modelId]: event.modelId,
      [eventCols.applicationId]: event.applicationId,
      [eventCols.eventType]: event.eventType,
      [eventCols.eventAt]: toDate(event.eventAt),
      [eventCols.reportDate]: event.reportDate,
      [eventCols.creator]: params.actorId,
      [eventCols.updater]: params.actorId
    }))

    return await tables.projectProgressActualElementEvents(deps.db).insert(payload, '*')
  }

export const deleteAllProgressActualElementEventsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<void> => {
    await tables
      .projectProgressActualElementEvents(deps.db)
      .where({ [ProjectProgressActualElementEvents.col.projectId]: params.projectId })
      .del()
  }
