import type { Knex } from 'knex'

export type MainMaterialRecord = {
  id: string
  projectId: string
  name: string
  specification: string
  unit: string
  referencePrice: number
  category: string
  createdAt: Date
  updatedAt: Date
}

const tableName = 'main_materials'

const tables = {
  mainMaterials: (db: Knex) => db<MainMaterialRecord>(tableName)
}

export const getMainMaterialFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; id: string }) => {
    return await tables
      .mainMaterials(deps.db)
      .where('projectId', params.projectId)
      .andWhere('id', params.id)
      .first()
  }

export const getMainMaterialsPageFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    search?: string | null
    offset: number
    limit: number
  }) => {
    const q = tables.mainMaterials(deps.db).where('projectId', params.projectId)

    if (params.search?.trim()) {
      const searchPattern = `%${params.search.trim()}%`
      q.andWhere(function () {
        this.whereILike('name', searchPattern)
          .orWhereILike('specification', searchPattern)
          .orWhereILike('category', searchPattern)
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

export const insertMainMaterialFactory =
  (deps: { db: Knex }) => async (item: MainMaterialRecord) => {
    await tables.mainMaterials(deps.db).insert(item)
  }

export const updateMainMaterialFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    id: string
    item: Partial<Pick<MainMaterialRecord, 'name' | 'specification' | 'unit' | 'referencePrice' | 'category' | 'updatedAt'>>
  }) => {
    return await tables
      .mainMaterials(deps.db)
      .where('projectId', params.projectId)
      .andWhere('id', params.id)
      .update(params.item)
  }

export const deleteMainMaterialFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; id: string }) => {
    return await tables
      .mainMaterials(deps.db)
      .where('projectId', params.projectId)
      .andWhere('id', params.id)
      .delete()
  }
