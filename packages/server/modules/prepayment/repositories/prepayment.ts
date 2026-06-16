import type { Knex } from 'knex'

export type PrepaymentItemRecord = {
  id: string
  projectId: string
  name: string
  type: string
  percentage: number | null
  category: string
  createdAt: Date
  updatedAt: Date
}

const tableName = 'prepayment_items'

const tables = {
  prepaymentItems: (db: Knex) => db<PrepaymentItemRecord>(tableName)
}

export const getPrepaymentItemFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; id: string }) => {
    return await tables
      .prepaymentItems(deps.db)
      .where('projectId', params.projectId)
      .andWhere('id', params.id)
      .first()
  }

export const getPrepaymentItemsFactory =
  (deps: { db: Knex }) => async (params: { projectId: string }) => {
    return await tables
      .prepaymentItems(deps.db)
      .where('projectId', params.projectId)
      .orderBy('createdAt', 'desc')
  }

export const getPrepaymentItemsPageFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    search?: string | null
    offset: number
    limit: number
  }) => {
    const q = tables.prepaymentItems(deps.db).where('projectId', params.projectId)

    if (params.search?.trim()) {
      const searchPattern = `%${params.search.trim()}%`
      q.andWhere(function () {
        this.whereILike('name', searchPattern).orWhereILike('category', searchPattern)
      })
    }

    const totalCountQuery = await q.clone().count<{ count: string | number }>('* as count').first()
    const totalCount = Number(totalCountQuery?.count ?? 0)

    const items = await q
      .orderBy('createdAt', 'desc')
      .offset(params.offset)
      .limit(params.limit)

    return { items, totalCount }
  }

export const insertPrepaymentItemFactory =
  (deps: { db: Knex }) => async (item: PrepaymentItemRecord) => {
    await tables.prepaymentItems(deps.db).insert(item)
  }

export const updatePrepaymentItemFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    id: string
    item: Partial<Pick<PrepaymentItemRecord, 'name' | 'type' | 'percentage' | 'category' | 'updatedAt'>>
  }) => {
    return await tables
      .prepaymentItems(deps.db)
      .where('projectId', params.projectId)
      .andWhere('id', params.id)
      .update(params.item)
  }

export const deletePrepaymentItemFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; id: string }) => {
    return await tables
      .prepaymentItems(deps.db)
      .where('projectId', params.projectId)
      .andWhere('id', params.id)
      .delete()
  }
