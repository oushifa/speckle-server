import { buildTableHelper } from '@/modules/core/dbSchema'
import {
  type ViewerCatalog,
  type ViewerCatalogNode
} from '@/modules/viewer/domain/types/viewerCatalogs'
import cryptoRandomString from 'crypto-random-string'
import { type Knex } from 'knex'

export const ViewerCatalogs = buildTableHelper('viewer_catalogs', [
  'id',
  'projectId',
  'modelId',
  'authorId',
  'title',
  'treeData',
  'createdAt',
  'updatedAt'
])

const generateId = () => cryptoRandomString({ length: 10 })

type ViewerCatalogDbRecord = Omit<ViewerCatalog, 'treeData'> & {
  treeData: string | ViewerCatalogNode[]
}

const toViewerCatalog = (record: ViewerCatalogDbRecord): ViewerCatalog => ({
  ...record,
  treeData:
    typeof record.treeData === 'string'
      ? (JSON.parse(record.treeData) as ViewerCatalogNode[])
      : record.treeData
})

const tables = {
  viewerCatalogs: (db: Knex) => db<ViewerCatalogDbRecord>(ViewerCatalogs.name)
}

export type CreateViewerCatalogParams = {
  projectId: string
  modelId: string
  authorId: string | null
  title: string
  treeData: string
}

export const createViewerCatalogFactory =
  (deps: { db: Knex }) =>
  async (params: CreateViewerCatalogParams): Promise<ViewerCatalog> => {
    const [insertedItem] = await tables.viewerCatalogs(deps.db).insert(
      {
        id: generateId(),
        ...params
      },
      '*'
    )
    return toViewerCatalog(insertedItem)
  }

export const getViewerCatalogsByProjectFactory =
  (deps: { db: Knex }) =>
  async (projectId: string, modelId: string): Promise<ViewerCatalog[]> => {
    const records = await tables
      .viewerCatalogs(deps.db)
      .where({
        [ViewerCatalogs.col.projectId]: projectId,
        [ViewerCatalogs.col.modelId]: modelId
      })
      .orderBy('createdAt', 'asc')
    return records.map(toViewerCatalog)
  }

export const getViewerCatalogFactory =
  (deps: { db: Knex }) =>
  async (
    catalogId: string,
    projectId: string,
    modelId: string
  ): Promise<ViewerCatalog | undefined> => {
    const record = await tables
      .viewerCatalogs(deps.db)
      .where({
        [ViewerCatalogs.col.id]: catalogId,
        [ViewerCatalogs.col.projectId]: projectId,
        [ViewerCatalogs.col.modelId]: modelId
      })
      .first()
    return record ? toViewerCatalog(record) : undefined
  }

export type UpdateViewerCatalogParams = {
  id: string
  projectId: string
  modelId: string
  update: {
    title?: string
    treeData?: string
  }
}

export const updateViewerCatalogFactory =
  (deps: { db: Knex }) =>
  async (params: UpdateViewerCatalogParams): Promise<ViewerCatalog | undefined> => {
    const { id, projectId, modelId, update } = params
    const [updatedItem] = await tables
      .viewerCatalogs(deps.db)
      .where({
        [ViewerCatalogs.col.id]: id,
        [ViewerCatalogs.col.projectId]: projectId,
        [ViewerCatalogs.col.modelId]: modelId
      })
      .update(
        {
          ...update,
          updatedAt: new Date()
        },
        '*'
      )
    return updatedItem ? toViewerCatalog(updatedItem) : undefined
  }

export const deleteViewerCatalogFactory =
  (deps: { db: Knex }) =>
  async (catalogId: string, projectId: string, modelId: string): Promise<boolean> => {
    const result = await tables
      .viewerCatalogs(deps.db)
      .where({
        [ViewerCatalogs.col.id]: catalogId,
        [ViewerCatalogs.col.projectId]: projectId,
        [ViewerCatalogs.col.modelId]: modelId
      })
      .delete()
    return result > 0
  }
