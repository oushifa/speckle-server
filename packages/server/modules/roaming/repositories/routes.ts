import type { Knex } from 'knex'

export interface RoamingRouteRecord {
  id: string
  projectId: string
  name: string
  mode: string
  points: unknown[]
  loop: boolean
  speed: number | string
  eyeHeight: number | string | null
  creator: string | null
  updater: string | null
  createdAt: Date
  updatedAt: Date
}

const TABLE_NAME = 'roaming_routes'

const toJsonbValue = <T>(db: Knex, value: T | null | undefined) =>
  value === null || value === undefined
    ? null
    : db.raw('?::jsonb', [JSON.stringify(value)])

export const listRoamingRoutesFactory =
  ({ db }: { db: Knex }) =>
  async ({ projectId }: { projectId: string }): Promise<RoamingRouteRecord[]> => {
    return (await db(TABLE_NAME)
      .where({ projectId })
      .orderBy('updatedAt', 'desc')) as RoamingRouteRecord[]
  }

export const getRoamingRouteFactory =
  ({ db }: { db: Knex }) =>
  async ({
    projectId,
    routeId
  }: {
    projectId: string
    routeId: string
  }): Promise<RoamingRouteRecord | null> => {
    const record = (await db(TABLE_NAME).where({ projectId, id: routeId }).first()) as
      | RoamingRouteRecord
      | undefined
    return record || null
  }

export const createRoamingRouteFactory =
  ({ db }: { db: Knex }) =>
  async (
    record: Omit<RoamingRouteRecord, 'createdAt' | 'updatedAt'>
  ): Promise<RoamingRouteRecord> => {
    const now = new Date()
    const insertPayload = {
      ...record,
      points: toJsonbValue(db, record.points || []),
      createdAt: now,
      updatedAt: now
    }

    const [created] = (await db(TABLE_NAME)
      .insert(insertPayload)
      .returning('*')) as RoamingRouteRecord[]

    return created
  }

export const updateRoamingRouteFactory =
  ({ db }: { db: Knex }) =>
  async ({
    projectId,
    routeId,
    updates
  }: {
    projectId: string
    routeId: string
    updates: Partial<Omit<RoamingRouteRecord, 'id' | 'projectId' | 'createdAt'>>
  }): Promise<RoamingRouteRecord | null> => {
    const payload: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date()
    }
    if (updates.points !== undefined) {
      payload.points = toJsonbValue(db, updates.points)
    }

    const [updated] = (await db(TABLE_NAME)
      .where({ projectId, id: routeId })
      .update(payload)
      .returning('*')) as RoamingRouteRecord[]

    return updated || null
  }

export const deleteRoamingRouteFactory =
  ({ db }: { db: Knex }) =>
  async ({
    projectId,
    routeId
  }: {
    projectId: string
    routeId: string
  }): Promise<boolean> => {
    const deletedCount = await db(TABLE_NAME).where({ projectId, id: routeId }).delete()
    return deletedCount > 0
  }
