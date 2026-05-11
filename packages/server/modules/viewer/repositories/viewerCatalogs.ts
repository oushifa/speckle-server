import { buildTableHelper } from '@/modules/core/dbSchema'
import { type ViewerCatalog } from '@/modules/viewer/domain/types/viewerCatalogs'
import cryptoRandomString from 'crypto-random-string'
import { type Knex } from 'knex'

export const ViewerCatalogs = buildTableHelper('viewer_catalogs', [
  'id',
  'projectId',
  'authorId',
  'title',
  'treeData',
  'createdAt',
  'updatedAt'
])

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  viewerCatalogs: (db: Knex) => db<ViewerCatalog>(ViewerCatalogs.name)
}

export type CreateViewerCatalogParams = {
  projectId: string
  authorId: string | null
  title: string
  treeData: any
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
    return insertedItem
  }

export const getViewerCatalogsByProjectFactory =
  (deps: { db: Knex }) =>
  async (projectId: string): Promise<ViewerCatalog[]> => {
    return await tables
      .viewerCatalogs(deps.db)
      .where({ [ViewerCatalogs.col.projectId]: projectId })
      .orderBy('createdAt', 'asc')
  }

export const getViewerCatalogFactory =
  (deps: { db: Knex }) =>
  async (catalogId: string, projectId: string): Promise<ViewerCatalog | undefined> => {
    return await tables
      .viewerCatalogs(deps.db)
      .where({
        [ViewerCatalogs.col.id]: catalogId,
        [ViewerCatalogs.col.projectId]: projectId
      })
      .first()
  }

export type UpdateViewerCatalogParams = {
  id: string
  projectId: string
  update: {
    title?: string
    treeData?: any
  }
}

export const updateViewerCatalogFactory =
  (deps: { db: Knex }) =>
  async (params: UpdateViewerCatalogParams): Promise<ViewerCatalog | undefined> => {
    const { id, projectId, update } = params
    const [updatedItem] = await tables
      .viewerCatalogs(deps.db)
      .where({
        [ViewerCatalogs.col.id]: id,
        [ViewerCatalogs.col.projectId]: projectId
      })
      .update(
        {
          ...update,
          updatedAt: new Date()
        },
        '*'
      )
    return updatedItem
  }

export const deleteViewerCatalogFactory =
  (deps: { db: Knex }) =>
  async (catalogId: string, projectId: string): Promise<boolean> => {
    const result = await tables
      .viewerCatalogs(deps.db)
      .where({
        [ViewerCatalogs.col.id]: catalogId,
        [ViewerCatalogs.col.projectId]: projectId
      })
      .delete()
    return result > 0
  }
