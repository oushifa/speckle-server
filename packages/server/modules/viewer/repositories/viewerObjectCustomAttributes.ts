import { buildTableHelper } from '@/modules/core/dbSchema'
import type { ViewerObjectCustomAttribute } from '@/modules/viewer/domain/types/viewerObjectCustomAttributes'
import cryptoRandomString from 'crypto-random-string'
import { type Knex } from 'knex'

export const ViewerObjectCustomAttributes = buildTableHelper(
  'viewer_object_custom_attributes',
  [
    'id',
    'projectId',
    'modelId',
    'applicationId',
    'authorId',
    'name',
    'value',
    'createdAt',
    'updatedAt'
  ]
)

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  viewerObjectCustomAttributes: (db: Knex) =>
    db<ViewerObjectCustomAttribute>(ViewerObjectCustomAttributes.name)
}

export type CreateViewerObjectCustomAttributeParams = {
  projectId: string
  modelId: string
  applicationId: string
  authorId: string | null
  name: string
  value: string
}

export const createViewerObjectCustomAttributeFactory =
  (deps: { db: Knex }) =>
  async (
    params: CreateViewerObjectCustomAttributeParams
  ): Promise<ViewerObjectCustomAttribute> => {
    const [insertedItem] = await tables.viewerObjectCustomAttributes(deps.db).insert(
      {
        id: generateId(),
        ...params
      },
      '*'
    )

    return insertedItem
  }

export type UpdateViewerObjectCustomAttributeParams = {
  id: string
  projectId: string
  modelId: string
  name: string
  value: string
}

export const getViewerObjectCustomAttributesFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    applicationId?: string
  }): Promise<ViewerObjectCustomAttribute[]> => {
    const query = tables
      .viewerObjectCustomAttributes(deps.db)
      .where({
        [ViewerObjectCustomAttributes.col.projectId]: params.projectId,
        [ViewerObjectCustomAttributes.col.modelId]: params.modelId
      })

    if (params.applicationId) {
      query.andWhere({
        [ViewerObjectCustomAttributes.col.applicationId]: params.applicationId
      })
    }

    const records = await query.orderBy('createdAt', 'asc')

    return records
  }

export const updateViewerObjectCustomAttributeFactory =
  (deps: { db: Knex }) =>
  async (
    params: UpdateViewerObjectCustomAttributeParams
  ): Promise<ViewerObjectCustomAttribute | null> => {
    const [updatedItem] = await tables
      .viewerObjectCustomAttributes(deps.db)
      .where({
        [ViewerObjectCustomAttributes.col.id]: params.id,
        [ViewerObjectCustomAttributes.col.projectId]: params.projectId,
        [ViewerObjectCustomAttributes.col.modelId]: params.modelId
      })
      .update(
        {
          [ViewerObjectCustomAttributes.short.col.name]: params.name,
          [ViewerObjectCustomAttributes.short.col.value]: params.value,
          [ViewerObjectCustomAttributes.short.col.updatedAt]: deps.db.fn.now()
        },
        '*'
      )

    return updatedItem || null
  }

export const deleteViewerObjectCustomAttributeFactory =
  (deps: { db: Knex }) =>
  async (params: {
    id: string
    projectId: string
    modelId: string
  }): Promise<boolean> => {
    const result = await tables
      .viewerObjectCustomAttributes(deps.db)
      .where({
        [ViewerObjectCustomAttributes.col.id]: params.id,
        [ViewerObjectCustomAttributes.col.projectId]: params.projectId,
        [ViewerObjectCustomAttributes.col.modelId]: params.modelId
      })
      .delete()

    return result > 0
  }
