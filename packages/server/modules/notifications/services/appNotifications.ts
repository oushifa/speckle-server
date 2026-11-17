import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'
import { AppNotifications, UnifiedWorkSyncRecords } from '@/modules/core/dbSchema'
import {
  type UnifiedWorkSyncRecord,
  type UnifiedWorkSyncStatusValue
} from '@/modules/unified-work-sync/repositories/unifiedWorkSyncRecords'
import {
  buildNotificationTaskId,
  removeNotificationTodoFromUnifiedWork,
  removeNotificationTodosFromUnifiedWork,
  syncNotificationsToUnifiedWork
} from '@/modules/unified-work-sync/services/notificationTodoSync'
import { moduleLogger } from '@/observability/logging'

const notificationsLogger = moduleLogger.child({
  module: 'notifications'
})

export type NotificationUnifiedWorkPushInfo = {
  taskId: string
  status: UnifiedWorkSyncStatusValue
  errorType: string | null
  errorMessage: string | null
  errorDetail: Record<string, unknown> | null
  attempts: number
  lastAttemptAt: Date | string
  account: string | null
}

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
  unifiedWorkPush?: NotificationUnifiedWorkPushInfo | null
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

const attachUnifiedWorkPushRecords = async (
  db: Knex,
  rows: AppNotificationRecord[]
): Promise<AppNotificationRecord[]> => {
  if (!rows.length) return []

  const taskIds = rows.map((row) => buildNotificationTaskId(row.id))
  const syncRows = await db<
    Pick<
      UnifiedWorkSyncRecord,
      | 'taskId'
      | 'status'
      | 'errorType'
      | 'errorMessage'
      | 'errorDetail'
      | 'attempts'
      | 'lastAttemptAt'
      | 'account'
    >
  >(UnifiedWorkSyncRecords.name)
    .whereIn('taskId', taskIds)
    .select([
      'taskId',
      'status',
      'errorType',
      'errorMessage',
      'errorDetail',
      'attempts',
      'lastAttemptAt',
      'account'
    ])

  const syncByTaskId = new Map(syncRows.map((record) => [record.taskId, record]))

  return rows.map((row) => {
    const syncRecord = syncByTaskId.get(buildNotificationTaskId(row.id))
    return {
      ...row,
      isRead: Boolean(row.isRead),
      unifiedWorkPush: syncRecord
        ? {
            taskId: syncRecord.taskId,
            status: syncRecord.status,
            errorType: syncRecord.errorType ?? null,
            errorMessage: syncRecord.errorMessage ?? null,
            errorDetail: syncRecord.errorDetail ?? null,
            attempts: syncRecord.attempts,
            lastAttemptAt: syncRecord.lastAttemptAt,
            account: syncRecord.account ?? null
          }
        : null
    }
  })
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

    void syncNotificationsToUnifiedWork(records).catch((err) => {
      notificationsLogger.warn(
        { err, notificationIds: records.map((r) => r.id) },
        '[WORK_SYNC] Failed to sync newly created notifications to unified work'
      )
    })

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

    const formattedRows = await attachUnifiedWorkPushRecords(db, rows)

    return {
      items: formattedRows,
      unreadCount: Number(count) || 0
    }
  }

export const getAppNotificationByIdFactory =
  ({ db }: { db: Knex }) =>
  async (params: {
    id: string
    userId: string
  }): Promise<AppNotificationRecord | null> => {
    const { id, userId } = params
    await ensureAppNotificationsTable(db)

    const row = await db(`${AppNotifications.name} as an`)
      .leftJoin('streams as s', 'an.projectId', 's.id')
      .where({
        'an.id': id,
        'an.userId': userId
      })
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
      .first()

    if (!row) return null

    const [formatted] = await attachUnifiedWorkPushRecords(db, [row])
    return formatted || null
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
    const updatedCount = await db(AppNotifications.name)
      .where({ id, userId })
      .update({ isRead: true, updatedAt: db.fn.now() })

    if (updatedCount > 0) {
      try {
        await removeNotificationTodoFromUnifiedWork(id)
      } catch (err) {
        notificationsLogger.warn(
          { err, notificationId: id, userId },
          '[WORK_SYNC] Failed to remove notification todo from unified work'
        )
      }
    }
  }

export const markAllNotificationsAsReadFactory =
  ({ db }: { db: Knex }) =>
  async (userId: string): Promise<void> => {
    await ensureAppNotificationsTable(db)
    const unreadRows = await db<AppNotificationRecord>(AppNotifications.name)
      .where({ userId, isRead: false })
      .select<{ id: string }[]>('id')
    const unreadIds = unreadRows.map((row) => row.id)
    if (!unreadIds.length) return

    await db(AppNotifications.name)
      .where({ userId, isRead: false })
      .update({ isRead: true, updatedAt: db.fn.now() })

    try {
      await removeNotificationTodosFromUnifiedWork(unreadIds)
    } catch (err) {
      notificationsLogger.warn(
        { err, userId, count: unreadIds.length },
        '[WORK_SYNC] Failed to remove notification todos from unified work'
      )
    }
  }
