import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectDrawings = buildTableHelper('project_drawings', [
  'id',
  'projectId',
  'folderId',
  'name',
  'blobId',
  'convertedBlobId',
  'conversionStatus',
  'conversionError',
  'fileName',
  'fileType',
  'contentType',
  'fileSize',
  'creator',
  'updater',
  'createdAt',
  'updatedAt'
])

export type ProjectDrawingRecord = {
  id: string
  projectId: string
  folderId: string | null
  name: string
  blobId: string
  convertedBlobId: string | null
  conversionStatus: string | null
  conversionError: string | null
  fileName: string
  fileType: string
  contentType: string
  fileSize: number | string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  drawings: (db: Knex) => db<ProjectDrawingRecord>(ProjectDrawings.name)
}

export const getProjectDrawingFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    drawingId: string
  }): Promise<ProjectDrawingRecord | null> =>
    (await tables
      .drawings(deps.db)
      .where({
        [ProjectDrawings.col.projectId]: params.projectId,
        [ProjectDrawings.col.id]: params.drawingId
      })
      .first()) || null

export const listProjectDrawingsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    folderId?: string | null
    search?: string | null
    cursor?: { updatedAt: Date; id: string } | null
    limit: number
  }): Promise<ProjectDrawingRecord[]> => {
    const q = tables
      .drawings(deps.db)
      .where({ [ProjectDrawings.col.projectId]: params.projectId })

    if (params.folderId) {
      q.andWhere({ [ProjectDrawings.col.folderId]: params.folderId })
    }

    if (params.search?.trim()) {
      const search = `%${params.search.trim()}%`
      q.andWhere((builder) => {
        builder
          .where(ProjectDrawings.col.name, 'ilike', search)
          .orWhere(ProjectDrawings.col.fileName, 'ilike', search)
      })
    }

    if (params.cursor) {
      const c = params.cursor
      q.andWhere((builder) => {
        builder
          .where(ProjectDrawings.col.updatedAt, '<', c.updatedAt)
          .orWhere((inner) => {
            inner
              .where(ProjectDrawings.col.updatedAt, '=', c.updatedAt)
              .andWhere(ProjectDrawings.col.id, '<', c.id)
          })
      })
    }

    return await q
      .orderBy(ProjectDrawings.col.updatedAt, 'desc')
      .orderBy(ProjectDrawings.col.id, 'desc')
      .limit(params.limit)
  }

export const createProjectDrawingFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    folderId: string | null
    name: string
    blobId: string
    convertedBlobId?: string | null
    conversionStatus?: string | null
    conversionError?: string | null
    fileName: string
    fileType: string
    contentType: string
    fileSize: number | null
    creator: string
    updater: string
  }): Promise<ProjectDrawingRecord> => {
    const [record] = await tables.drawings(deps.db).insert(
      {
        id: generateId(),
        ...params
      },
      '*'
    )

    return record
  }

export const updateProjectDrawingFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    drawingId: string
    patch: Partial<
      Pick<ProjectDrawingRecord, 'convertedBlobId' | 'conversionStatus' | 'conversionError' | 'updater'>
    >
  }): Promise<ProjectDrawingRecord | null> => {
    const [updated] = await tables
      .drawings(deps.db)
      .where({
        [ProjectDrawings.col.projectId]: params.projectId,
        [ProjectDrawings.col.id]: params.drawingId
      })
      .update({ ...params.patch, updatedAt: deps.db.fn.now() }, '*')

    return updated || null
  }

export const deleteProjectDrawingFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; drawingId: string }): Promise<boolean> => {
    const deletedCount = await tables
      .drawings(deps.db)
      .where({
        [ProjectDrawings.col.projectId]: params.projectId,
        [ProjectDrawings.col.id]: params.drawingId
      })
      .delete()

    return deletedCount > 0
  }
