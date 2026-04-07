import { BoqItems } from '@/modules/core/dbSchema'
import type { Knex } from 'knex'

export const boqItemTypes = [
  'PROJECT',
  'CATEGORY',
  'SECTION',
  'SUBSECTION',
  'ITEM'
] as const

export type BoqItemType = (typeof boqItemTypes)[number]

export type BoqItemRecord = {
  id: string
  projectId: string
  parentId: string | null
  type: BoqItemType
  code: string
  name: string
  unit: string | null
  quantity: string | null
  price: string | null
  sortOrder: number
  depth: number
  createdAt: Date
  updatedAt: Date
}

const tables = {
  boqItems: (db: Knex) => db<BoqItemRecord>(BoqItems.name)
}

export const getBoqItemFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; id: string }) => {
    return await tables
      .boqItems(deps.db)
      .where(BoqItems.col.projectId, params.projectId)
      .andWhere(BoqItems.col.id, params.id)
      .first()
  }

export const getBoqItemsFactory =
  (deps: { db: Knex }) => async (params: { projectId: string }) => {
    return await tables
      .boqItems(deps.db)
      .where(BoqItems.col.projectId, params.projectId)
      .orderBy(BoqItems.col.depth, 'asc')
      .orderBy(BoqItems.col.sortOrder, 'asc')
      .orderBy(BoqItems.col.createdAt, 'asc')
  }

export const countBoqItemsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    parentId: string | null
    search?: string | null
  }) => {
    const q = tables.boqItems(deps.db).where(BoqItems.col.projectId, params.projectId)
    if (params.parentId === null) q.whereNull(BoqItems.col.parentId)
    else q.andWhere(BoqItems.col.parentId, params.parentId)

    if (params.search?.length) {
      q.andWhere((qb) => {
        qb.whereILike(BoqItems.col.name, `%${params.search}%`).orWhereILike(
          BoqItems.col.code,
          `%${params.search}%`
        )
      })
    }

    const [{ count }] = await q.count()
    return Number.parseInt(String(count))
  }

export const getBoqItemsByParentFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    parentId: string | null
    type?: BoqItemType
    search?: string | null
    limit?: number | null
  }) => {
    const q = tables
      .boqItems(deps.db)
      .where(BoqItems.col.projectId, params.projectId)
      .orderBy(BoqItems.col.sortOrder, 'asc')
      .orderBy(BoqItems.col.id, 'asc')

    if (params.parentId === null) q.whereNull(BoqItems.col.parentId)
    else q.andWhere(BoqItems.col.parentId, params.parentId)

    if (params.type) q.andWhere(BoqItems.col.type, params.type)

    if (params.search?.length) {
      q.andWhere((qb) => {
        qb.whereILike(BoqItems.col.name, `%${params.search}%`).orWhereILike(
          BoqItems.col.code,
          `%${params.search}%`
        )
      })
    }

    if (params.limit) q.limit(params.limit)

    return await q
  }

export const getSiblingMaxSortOrderFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; parentId: string | null }) => {
    const q = tables.boqItems(deps.db).where(BoqItems.col.projectId, params.projectId)
    if (params.parentId === null) q.whereNull(BoqItems.col.parentId)
    else q.andWhere(BoqItems.col.parentId, params.parentId)

    const item = await q.orderBy(BoqItems.col.sortOrder, 'desc').first()
    return item?.sortOrder ?? null
  }

export const insertBoqItemFactory =
  (deps: { db: Knex }) => async (item: BoqItemRecord) => {
    await tables.boqItems(deps.db).insert(item)
  }

export const updateBoqItemFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    id: string
    item: Partial<
      Pick<
        BoqItemRecord,
        | 'parentId'
        | 'code'
        | 'name'
        | 'unit'
        | 'quantity'
        | 'price'
        | 'sortOrder'
        | 'updatedAt'
      >
    >
  }) => {
    return await tables
      .boqItems(deps.db)
      .where(BoqItems.col.projectId, params.projectId)
      .andWhere(BoqItems.col.id, params.id)
      .update(params.item)
  }

export const deleteBoqItemFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; id: string }) => {
    return await tables
      .boqItems(deps.db)
      .where(BoqItems.col.projectId, params.projectId)
      .andWhere(BoqItems.col.id, params.id)
      .delete()
  }

export const deleteBoqItemSubtreeFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; id: string }) => {
    await deps.db.raw(
      `
      WITH RECURSIVE boq_tree AS (
        SELECT "id", "projectId"
        FROM "boq_items"
        WHERE "id" = ? AND "projectId" = ?
        UNION ALL
        SELECT c."id", c."projectId"
        FROM "boq_items" c
        INNER JOIN boq_tree t ON c."parentId" = t."id"
        WHERE c."projectId" = ?
      )
      DELETE FROM "boq_items"
      WHERE "id" IN (SELECT "id" FROM boq_tree) AND "projectId" = ?
      `,
      [params.id, params.projectId, params.projectId, params.projectId]
    )
  }

export const hasBoqChildrenFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; id: string }) => {
    const child = await tables
      .boqItems(deps.db)
      .where(BoqItems.col.projectId, params.projectId)
      .andWhere(BoqItems.col.parentId, params.id)
      .first()
    return !!child
  }
