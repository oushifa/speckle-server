import { db } from '@/db/knex'
import { AppNotifications, Streams, Users } from '@/modules/core/dbSchema'
import type { AppNotificationRecord } from '@/modules/notifications/services/appNotifications'
import { BadRequestError, NotFoundError } from '@/modules/shared/errors'
import {
  UnifiedWorkSyncStatus,
  deleteUnifiedWorkSyncRecordFactory,
  upsertUnifiedWorkSyncRecordFactory
} from '@/modules/unified-work-sync/repositories/unifiedWorkSyncRecords'
import {
  formatErrorDetails,
  getAuthToken,
  getSyncConfig,
  isRemoveSuccess,
  isUnifiedWorkSyncEnabled,
  pushUnifiedWorkItem,
  removeUnifiedWorkItem,
  resolveExternalUserCode,
  resolvePublicOrigin,
  unifiedWorkSyncLogger,
  type ExternalUserRow,
  type UnifiedWorkPushPayload,
  type UnifiedWorkSyncResult,
  type UnifiedWorkTaskMeta
} from '@/modules/unified-work-sync/services/unifiedWorkClient'

const NOTIFICATION_STEP_INDEX = -1

export const buildNotificationTaskId = (notificationId: string) =>
  `SPK-NOTIFY-${notificationId}`

export const buildNotificationDetailRoute = (notificationId: string) =>
  `/flow/notification/${notificationId}`

export const buildNotificationDetailLink = (notificationId: string) => {
  const origin = resolvePublicOrigin()
  if (!origin) return null
  try {
    return new URL(buildNotificationDetailRoute(notificationId), origin).toString()
  } catch {
    return null
  }
}

const toSafeIsoString = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export const syncNotificationsToUnifiedWork = async (
  notifications: AppNotificationRecord[]
): Promise<UnifiedWorkSyncResult> => {
  const result: UnifiedWorkSyncResult = {
    pushCount: 0,
    failCount: 0,
    removeCount: 0
  }

  if (!notifications.length) return result

  if (!isUnifiedWorkSyncEnabled()) {
    unifiedWorkSyncLogger.debug(
      { count: notifications.length },
      '[WORK_SYNC] Unified work sync is disabled (UNIFIED_WORK_SYNC_HOST not set), skip notification push'
    )
    return result
  }

  const config = getSyncConfig()
  const userIds = Array.from(
    new Set(
      notifications.map((n) => n.userId).filter((id): id is string => Boolean(id))
    )
  )
  const projectIds = Array.from(
    new Set(
      notifications.map((n) => n.projectId).filter((id): id is string => Boolean(id))
    )
  )

  const [users, projects] = await Promise.all([
    userIds.length
      ? db<ExternalUserRow>(Users.name)
          .select<ExternalUserRow[]>(['id', 'name', 'email'])
          .whereIn('id', userIds)
      : Promise.resolve([] as ExternalUserRow[]),
    projectIds.length
      ? db<{ id: string; name: string | null }>(Streams.name)
          .select('id', 'name')
          .whereIn('id', projectIds)
      : Promise.resolve([] as Array<{ id: string; name: string | null }>)
  ])

  const userMap = new Map(users.map((user) => [user.id, user]))
  const projectMap = new Map(
    projects.map((project) => [project.id, project.name || null])
  )

  const upsertRecord = upsertUnifiedWorkSyncRecordFactory({ db })
  const recordResult = async (record: Parameters<typeof upsertRecord>[0]) => {
    try {
      await upsertRecord(record)
    } catch (err) {
      unifiedWorkSyncLogger.error(
        {
          error: formatErrorDetails(err),
          notificationId: record.instanceId,
          taskId: record.taskId
        },
        '[WORK_SYNC] Failed to persist notification unified work push status'
      )
    }
  }

  const desiredItems: Array<{
    payload: UnifiedWorkPushPayload
    meta: UnifiedWorkTaskMeta
  }> = []

  for (const notification of notifications) {
    const taskId = buildNotificationTaskId(notification.id)
    const user = userMap.get(notification.userId)
    const projectName =
      projectMap.get(notification.projectId) ?? notification.projectName ?? null

    const mappedApproverAccount = resolveExternalUserCode(user)
    const approverAccount = mappedApproverAccount || config.account
    const creatorAccount = config.account || approverAccount

    const meta: UnifiedWorkTaskMeta = {
      instanceId: notification.id,
      taskId,
      stepIndex: NOTIFICATION_STEP_INDEX,
      approverId: notification.userId,
      account: approverAccount || null
    }

    if (!approverAccount) {
      result.failCount += 1
      unifiedWorkSyncLogger.warn(
        {
          notificationId: notification.id,
          userId: notification.userId
        },
        '[WORK_SYNC] Skip notification unified work push because no recipient account could be resolved'
      )
      await recordResult({
        ...meta,
        systemCode: config.systemCode,
        status: UnifiedWorkSyncStatus.Failed,
        errorType: 'NO_ACCOUNT',
        errorMessage: 'No unified work account could be resolved for the recipient',
        errorDetail: null
      })
      continue
    }

    if (!creatorAccount) {
      result.failCount += 1
      unifiedWorkSyncLogger.warn(
        {
          notificationId: notification.id,
          userId: notification.userId
        },
        '[WORK_SYNC] Skip notification unified work push because no creator account could be resolved'
      )
      await recordResult({
        ...meta,
        systemCode: config.systemCode,
        status: UnifiedWorkSyncStatus.Failed,
        errorType: 'NO_CREATOR_ACCOUNT',
        errorMessage: 'No unified work account could be resolved for the creator',
        errorDetail: null
      })
      continue
    }

    const createdIso = toSafeIsoString(notification.createdAt)
    const route =
      buildNotificationDetailLink(notification.id) ||
      buildNotificationDetailRoute(notification.id)

    desiredItems.push({
      meta,
      payload: {
        systemCode: config.systemCode,
        taskId,
        title: notification.title,
        creator: creatorAccount,
        assignee: approverAccount,
        reviewer: [{ user: approverAccount, status: 'pending' }],
        createTime: createdIso,
        reviewTime: createdIso,
        route,
        extraData: {
          source: config.systemCode,
          type: 'NOTIFICATION',
          notificationId: notification.id,
          projectId: notification.projectId,
          projectName,
          targetUrl: notification.targetUrl,
          link: route,
          route,
          userId: notification.userId,
          approverAccount,
          creatorAccount
        }
      }
    })
  }

  if (!desiredItems.length) {
    return result
  }

  const token = await getAuthToken()
  if (!token) {
    const authDetail = {
      host: config.host,
      hasStaticToken: Boolean(config.token),
      hasCredentials: Boolean(config.username && config.password),
      systemCode: config.systemCode
    }
    for (const item of desiredItems) {
      result.failCount += 1
      await recordResult({
        ...item.meta,
        systemCode: config.systemCode,
        status: UnifiedWorkSyncStatus.Failed,
        errorType: 'AUTH_UNAVAILABLE',
        errorMessage:
          'Could not obtain a unified work access token (check UNIFIED_WORK_SYNC_TOKEN or the configured credentials)',
        errorDetail: authDetail
      })
    }
    unifiedWorkSyncLogger.warn(
      { count: desiredItems.length },
      '[WORK_SYNC] Skip notification unified work push because auth token is unavailable'
    )
    return result
  }

  for (const item of desiredItems) {
    const { payload, meta } = item
    try {
      const res = await pushUnifiedWorkItem({ token, payload })
      result.pushCount += 1
      await recordResult({
        ...meta,
        systemCode: payload.systemCode,
        status: UnifiedWorkSyncStatus.Success,
        errorType: null,
        errorMessage: null,
        errorDetail: null
      })
      unifiedWorkSyncLogger.info(
        {
          notificationId: meta.instanceId,
          taskId: payload.taskId,
          assignee: payload.assignee,
          route: payload.route,
          responseData: res
        },
        '[WORK_SYNC] Successfully pushed notification todo to unified work'
      )
    } catch (err) {
      const errorDetails = formatErrorDetails(err)
      result.failCount += 1
      await recordResult({
        ...meta,
        systemCode: payload.systemCode,
        status: UnifiedWorkSyncStatus.Failed,
        errorType:
          typeof errorDetails.status === 'number'
            ? `HTTP_${errorDetails.status}`
            : errorDetails.code || 'UNKNOWN',
        errorMessage: errorDetails.message,
        errorDetail: errorDetails as unknown as Record<string, unknown>
      })
      unifiedWorkSyncLogger.error(
        {
          error: errorDetails,
          notificationId: meta.instanceId,
          taskId: payload.taskId,
          assignee: payload.assignee
        },
        `[WORK_SYNC] Failed to push notification todo (${payload.taskId}): ${errorDetails.message}`
      )
    }
  }

  return result
}

export const removeNotificationTodosFromUnifiedWork = async (
  notificationIds: string[]
): Promise<UnifiedWorkSyncResult> => {
  const result: UnifiedWorkSyncResult = {
    pushCount: 0,
    failCount: 0,
    removeCount: 0
  }

  const uniqueIds = Array.from(
    new Set(
      notificationIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id))
    )
  )
  if (!uniqueIds.length) return result

  if (!isUnifiedWorkSyncEnabled()) {
    unifiedWorkSyncLogger.debug(
      { count: uniqueIds.length },
      '[WORK_SYNC] Unified work sync is disabled, skip notification todo removal'
    )
    return result
  }

  const token = await getAuthToken()
  if (!token) {
    result.failCount = uniqueIds.length
    unifiedWorkSyncLogger.warn(
      { count: uniqueIds.length },
      '[WORK_SYNC] Skip notification todo removal because auth token is unavailable'
    )
    return result
  }

  const deleteRecord = deleteUnifiedWorkSyncRecordFactory({ db })

  for (const notificationId of uniqueIds) {
    const taskId = buildNotificationTaskId(notificationId)
    try {
      const res = await removeUnifiedWorkItem({ token, taskId })
      if (isRemoveSuccess(res)) {
        result.removeCount += 1
      }
      try {
        await deleteRecord({ taskId })
      } catch (err) {
        unifiedWorkSyncLogger.error(
          {
            error: formatErrorDetails(err),
            notificationId,
            taskId
          },
          '[WORK_SYNC] Failed to delete notification sync record after removal'
        )
      }
      unifiedWorkSyncLogger.info(
        {
          notificationId,
          taskId,
          removed: isRemoveSuccess(res),
          responseData: res
        },
        '[WORK_SYNC] Completed removal of notification todo from unified work'
      )
    } catch (err) {
      result.failCount += 1
      const errorDetails = formatErrorDetails(err)
      unifiedWorkSyncLogger.error(
        {
          error: errorDetails,
          notificationId,
          taskId
        },
        `[WORK_SYNC] Failed to remove notification todo (${taskId}): ${errorDetails.message}`
      )
    }
  }

  return result
}

export const removeNotificationTodoFromUnifiedWork = async (
  notificationId: string
): Promise<UnifiedWorkSyncResult> => {
  return await removeNotificationTodosFromUnifiedWork([notificationId])
}

export const retryNotificationPushToUnifiedWork = async (params: {
  notificationId: string
  userId: string
}): Promise<{ success: boolean; pushCount: number; failCount: number }> => {
  const notification = await db<AppNotificationRecord>(AppNotifications.name)
    .where({ id: params.notificationId, userId: params.userId })
    .first()

  if (!notification) {
    throw new NotFoundError('Notification not found')
  }

  if (notification.isRead) {
    throw new BadRequestError('Notification is already read')
  }

  const result = await syncNotificationsToUnifiedWork([notification])
  return {
    success: result.pushCount > 0 && result.failCount === 0,
    pushCount: result.pushCount,
    failCount: result.failCount
  }
}
