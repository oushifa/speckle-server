import { buildTableHelper, Users } from '@/modules/core/dbSchema'
import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'

export const FileConversionFiles = buildTableHelper('file_conversion_files', [
  'id',
  'fileName',
  'fileSize',
  'sourceObjectKey',
  'sourceFileUrl',
  'resultObjectKey',
  'resultFileUrl',
  'streamId',
  'status',
  'isConverted',
  'uploadedAt',
  'startedAt',
  'convertedAt',
  'errorMessage',
  'creator',
  'updater',
  'createdAt',
  'updatedAt'
])

export type FileConversionStatus =
  | 'uploaded'
  | 'pending'
  | 'queued'
  | 'processing'
  | 'success'
  | 'failed'

export type FileConversionRecord = {
  id: string
  fileName: string
  fileSize: number | null
  sourceObjectKey: string | null
  sourceFileUrl: string | null
  resultObjectKey: string | null
  resultFileUrl: string | null
  streamId: string
  status: FileConversionStatus
  isConverted: boolean
  uploadedAt: Date | null
  startedAt: Date | null
  convertedAt: Date | null
  errorMessage: string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

export type FileConversionListItem = FileConversionRecord & {
  creatorName: string | null
}

const generateId = () => cryptoRandomString({ length: 10 })
const generateStreamId = () => `conv_${cryptoRandomString({ length: 20 })}`

const tables = {
  fileConversions: (db: Knex) => db<FileConversionRecord>(FileConversionFiles.name)
}

const cols = FileConversionFiles.short.col

const applyFilters = (
  query: Knex.QueryBuilder,
  params: {
    creator?: string
    status?: FileConversionStatus
    keyword?: string
  }
) => {
  if (params.creator) {
    query.andWhere(FileConversionFiles.col.creator, params.creator)
  }
  if (params.status) {
    query.andWhere(FileConversionFiles.col.status, params.status)
  }
  if (params.keyword?.trim()) {
    query.andWhereLike(FileConversionFiles.col.fileName, `%${params.keyword.trim()}%`)
  }
}

export const createFileConversionFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id?: string
    streamId?: string
    fileName: string
    fileSize: number | null
    sourceObjectKey: string
    sourceFileUrl: string
    creator: string
  }): Promise<FileConversionRecord> => {
    const now = new Date()
    const [record] = await tables
      .fileConversions(deps.db)
      .insert({
        [cols.id]: params.id || generateId(),
        [cols.fileName]: params.fileName,
        [cols.fileSize]: params.fileSize,
        [cols.sourceObjectKey]: params.sourceObjectKey,
        [cols.sourceFileUrl]: params.sourceFileUrl,
        [cols.streamId]: params.streamId || generateStreamId(),
        [cols.status]: 'uploaded',
        [cols.isConverted]: false,
        [cols.creator]: params.creator,
        [cols.updater]: params.creator,
        [cols.createdAt]: now,
        [cols.updatedAt]: now
      })
      .returning('*')

    return record
  }

export const getFileConversionByIdFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string }): Promise<FileConversionRecord | null> => {
    return (
      (await tables
        .fileConversions(deps.db)
        .where(FileConversionFiles.col.id, params.id)
        .first()) || null
    )
  }

export const getUserFileConversionByIdFactory =
  (deps: { db: Knex }) =>
  async (params: { id: string; creator: string }): Promise<FileConversionRecord | null> => {
    return (
      (await tables
        .fileConversions(deps.db)
        .where(FileConversionFiles.col.id, params.id)
        .andWhere(FileConversionFiles.col.creator, params.creator)
        .first()) || null
    )
  }

export const updateFileConversionFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id: string
    item: Partial<FileConversionRecord>
  }): Promise<FileConversionRecord | null> => {
    const [record] = await tables
      .fileConversions(deps.db)
      .where(FileConversionFiles.col.id, params.id)
      .update(
        {
          ...params.item,
          [cols.updatedAt]: new Date()
        },
        '*'
      )

    return record || null
  }

export const listFileConversionsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    creator: string
    status?: FileConversionStatus
    keyword?: string
    page: number
    pageSize: number
  }): Promise<{ items: FileConversionListItem[]; total: number }> => {
    const offset = (params.page - 1) * params.pageSize

    const itemsQuery = tables
      .fileConversions(deps.db)
      .leftJoin(Users.name, Users.col.id, FileConversionFiles.col.creator)
      .select<FileConversionListItem[]>([
        ...FileConversionFiles.cols,
        Users.colAs('name', 'creatorName')
      ])
      .orderBy(FileConversionFiles.col.updatedAt, 'desc')
      .limit(params.pageSize)
      .offset(offset)

    applyFilters(itemsQuery, params)

    const countQuery = tables
      .fileConversions(deps.db)
      .count<{ count: string }[]>('* as count')

    applyFilters(countQuery, params)

    const [items, countRows] = await Promise.all([itemsQuery, countQuery])
    return {
      items,
      total: parseInt(countRows[0]?.count || '0')
    }
  }

export const listPendingFileConversionsFactory =
  (deps: { db: Knex }) =>
  async (): Promise<FileConversionRecord[]> => {
    return await tables
      .fileConversions(deps.db)
      .where(FileConversionFiles.col.status, 'pending')
      .orderBy(FileConversionFiles.col.createdAt, 'asc')
  }
