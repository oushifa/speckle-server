import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const AlignmentDrawings = buildTableHelper('alignment_drawings', [
  'id',
  'projectId',
  'blobId',
  'fileName',
  'fileType',
  'fileSize',
  'creator',
  'updater',
  'createdAt',
  'updatedAt'
])

export type AlignmentDrawingRecord = {
  id: string
  projectId: string
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  drawings: (db: Knex) => db<AlignmentDrawingRecord>(AlignmentDrawings.name)
}

export const listAlignmentDrawingsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<AlignmentDrawingRecord[]> =>
    await tables
      .drawings(deps.db)
      .where({ [AlignmentDrawings.col.projectId]: params.projectId })
      .orderBy(AlignmentDrawings.col.createdAt, 'desc')

export const getAlignmentDrawingFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    drawingId: string
  }): Promise<AlignmentDrawingRecord | null> =>
    (await tables
      .drawings(deps.db)
      .where({
        [AlignmentDrawings.col.projectId]: params.projectId,
        [AlignmentDrawings.col.id]: params.drawingId
      })
      .first()) || null

export const createAlignmentDrawingFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    blobId: string
    fileName: string
    fileType: string
    fileSize: number | null
    creator: string
    updater: string
  }): Promise<AlignmentDrawingRecord> => {
    const [record] = await tables.drawings(deps.db).insert(
      {
        id: generateId(),
        ...params
      },
      '*'
    )

    return record
  }

export const deleteAlignmentDrawingFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; drawingId: string }): Promise<boolean> => {
    const deletedCount = await tables
      .drawings(deps.db)
      .where({
        [AlignmentDrawings.col.projectId]: params.projectId,
        [AlignmentDrawings.col.id]: params.drawingId
      })
      .delete()

    return deletedCount > 0
  }
