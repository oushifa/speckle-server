/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'
import { AppNotifications } from '@/modules/core/dbSchema'

export type AppNotificationRecord = {
  id: string
  userId: string
  projectId: string
  title: string
  content: string
  targetUrl: string
  isRead: boolean
  createdAt: Date | string
  updatedAt: Date | string
  projectName?: string
}

export type CreateNotificationInput = {
  userId: string
  projectId: string
  title: string
  content: string
  targetUrl: string
}

let tableEnsured = false

export async function ensureAppNotificationsTable(db: Knex): Promise<void> {
  if (tableEnsured) return
  const hasTable = await db.schema.hasTable(AppNotifications.name)
  if (!hasTable) {
    await db.schema.createTable(AppNotifications.name, (table) => {
      table.string('id', 36).primary()
      table.string('userId', 32).notNullable().index()
      table.string('projectId', 32).notNullable().index()
      table.string('title', 256).notNullable()
      table.text('content').notNullable().defaultTo('')
      table.string('targetUrl', 512).notNullable().defaultTo('')
      table.boolean('isRead').notNullable().defaultTo(false).index()
      table
        .timestamp('createdAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(db.fn.now())
        .index()
      table
        .timestamp('updatedAt', { precision: 3, useTz: true })
        .notNullable()
        .defaultTo(db.fn.now())

      table.index(['userId', 'isRead', 'createdAt'])
    })
  }
  tableEnsured = true
}

export const createAppNotificationsFactory =
  ({ db }: { db: Knex }) =>
  async (inputs: CreateNotificationInput[]): Promise<AppNotificationRecord[]> => {
    if (!inputs.length) return []
    await ensureAppNotificationsTable(db)

    const now = new Date()
    const records = inputs.map((input) => ({
      id: cryptoRandomString({ length: 20 }),
      userId: input.userId,
      projectId: input.projectId,
      title: input.title,
      content: input.content,
      targetUrl: input.targetUrl,
      isRead: false,
      createdAt: now,
      updatedAt: now
    }))

    await db(AppNotifications.name).insert(records)
    return records
  }

export const getAppNotificationsFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    userId: string
    limit?: number
    offset?: number
  }): Promise<{ items: AppNotificationRecord[]; unreadCount: number }> => {
    const { userId, limit = 100, offset = 0 } = params
    await ensureAppNotificationsTable(db)

    const rows = await db(`${AppNotifications.name} as an`)
      .leftJoin('streams as s', 'an.projectId', 's.id')
      .where('an.userId', userId)
      .select([
        'an.id',
        'an.userId',
        'an.projectId',
        'an.title',
        'an.content',
        'an.targetUrl',
        'an.isRead',
        'an.createdAt',
        'an.updatedAt',
        's.name as projectName'
      ])
      .orderBy('an.createdAt', 'desc')
      .limit(limit)
      .offset(offset)

    const [{ count }] = await db(AppNotifications.name)
      .where({ userId, isRead: false })
      .count<{ count: string | number }[]>({ count: '*' })

    const formattedRows = rows.map((row) => ({
      ...row,
      isRead: Boolean(row.isRead)
    }))

    return {
      items: formattedRows,
      unreadCount: Number(count) || 0
    }
  }

export const getUnreadNotificationsCountFactory =
  ({ db }: { db: Knex }) =>
  async (userId: string): Promise<number> => {
    await ensureAppNotificationsTable(db)
    const [{ count }] = await db(AppNotifications.name)
      .where({ userId, isRead: false })
      .count<{ count: string | number }[]>({ count: '*' })
    return Number(count) || 0
  }

export const markNotificationAsReadFactory =
  ({ db }: { db: Knex }) =>
  async (params: { id: string; userId: string }): Promise<void> => {
    const { id, userId } = params
    await ensureAppNotificationsTable(db)
    await db(AppNotifications.name)
      .where({ id, userId })
      .update({ isRead: true, updatedAt: db.fn.now() })
  }

export const markAllNotificationsAsReadFactory =
  ({ db }: { db: Knex }) =>
  async (userId: string): Promise<void> => {
    await ensureAppNotificationsTable(db)
    await db(AppNotifications.name)
      .where({ userId, isRead: false })
      .update({ isRead: true, updatedAt: db.fn.now() })
  }
