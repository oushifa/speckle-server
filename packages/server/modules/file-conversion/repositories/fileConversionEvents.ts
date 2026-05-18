import { buildTableHelper } from '@/modules/core/dbSchema'
import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'

export const FileConversionEvents = buildTableHelper('file_conversion_events', [
  'id',
  'fileId',
  'streamId',
  'status',
  'startedBy',
  'startedAt',
  'finishedAt',
  'callbackPayload',
  'errorMessage',
  'creator',
  'updater',
  'createdAt',
  'updatedAt'
])

export type FileConversionEventStatus = 'queued' | 'processing' | 'success' | 'failed'

export type FileConversionEventRecord = {
  id: string
  fileId: string
  streamId: string
  status: FileConversionEventStatus
  startedBy: string | null
  startedAt: Date | null
  finishedAt: Date | null
  callbackPayload: Record<string, unknown> | null
  errorMessage: string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })
const cols = FileConversionEvents.short.col

const tables = {
  fileConversionEvents: (db: Knex) => db<FileConversionEventRecord>(FileConversionEvents.name)
}

export const createFileConversionEventFactory =
  (deps: { db: Knex }) =>
  async (params: {
    fileId: string
    streamId: string
    status: FileConversionEventStatus
    startedBy: string | null
    creator: string
  }): Promise<FileConversionEventRecord> => {
    const now = new Date()
    const [record] = await tables
      .fileConversionEvents(deps.db)
      .insert({
        [cols.id]: generateId(),
        [cols.fileId]: params.fileId,
        [cols.streamId]: params.streamId,
        [cols.status]: params.status,
        [cols.startedBy]: params.startedBy,
        [cols.startedAt]: now,
        [cols.creator]: params.creator,
        [cols.updater]: params.creator,
        [cols.createdAt]: now,
        [cols.updatedAt]: now
      })
      .returning('*')

    return record
  }

export const getFileConversionEventByIdFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string }): Promise<FileConversionEventRecord | null> => {
    return (
      (await tables
        .fileConversionEvents(deps.db)
        .where(FileConversionEvents.col.id, params.id)
        .first()) || null
    )
  }

export const getLatestFileConversionEventByFileIdFactory =
  (deps: { db: Knex }) =>
  async (params: { fileId: string }): Promise<FileConversionEventRecord | null> => {
    return (
      (await tables
        .fileConversionEvents(deps.db)
        .where(FileConversionEvents.col.fileId, params.fileId)
        .orderBy(FileConversionEvents.col.createdAt, 'desc')
        .first()) || null
    )
  }

export const updateFileConversionEventFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id: string
    item: Partial<FileConversionEventRecord>
  }): Promise<FileConversionEventRecord | null> => {
    const [record] = await tables
      .fileConversionEvents(deps.db)
      .where(FileConversionEvents.col.id, params.id)
      .update(
        {
          ...params.item,
          [cols.updatedAt]: new Date()
        },
        '*'
      )

    return record || null
  }
