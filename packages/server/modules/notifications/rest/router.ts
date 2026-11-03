import { Router, type RequestHandler } from 'express'
import { db } from '@/db/knex'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import {
  ensureAppNotificationsTable,
  getAppNotificationsFactory,
  getUnreadNotificationsCountFactory,
  markNotificationAsReadFactory,
  markAllNotificationsAsReadFactory
} from '@/modules/notifications/services/appNotifications'

export const notificationsRestRouterFactory = (): Router => {
  const router = Router()
  const corsMiddleware = corsMiddlewareFactory()

  // Ensure table exists on initialization
  void ensureAppNotificationsTable(db)

  const requireAuth: RequestHandler = (req, res, next) => {
    if (!req.context.auth || !req.context.userId) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    return next()
  }

  router.options('/api/v1/notifications*', corsMiddleware)
  router.use('/api/v1/notifications', corsMiddleware, requireAuth)

  // 1. 获取未读通知数 (必须在 :id 之前声明，避免被路由通配截获)
  router.get('/api/v1/notifications/unread-count', async (req, res) => {
    try {
      const userId = req.context.userId!
      const unreadCount = await getUnreadNotificationsCountFactory({ db })(userId)
      return res.status(200).json({ unreadCount, count: unreadCount })
    } catch (err) {
      req.log.error(err, 'Get notifications unread count failed')
      return res.status(500).json({ error: 'Failed to get unread count' })
    }
  })

  // 2. 全部标记为已读 (必须在 :id 之前声明)
  router.put('/api/v1/notifications/read-all', async (req, res) => {
    try {
      const userId = req.context.userId!
      await markAllNotificationsAsReadFactory({ db })(userId)
      return res.status(200).json({ success: true })
    } catch (err) {
      req.log.error(err, 'Mark all notifications read failed')
      return res.status(500).json({ error: 'Failed to mark all notifications as read' })
    }
  })

  // 3. 获取通知列表 (按时间倒序)
  router.get('/api/v1/notifications', async (req, res) => {
    try {
      const userId = req.context.userId!
      const limit = req.query.limit
        ? Math.max(1, Math.min(200, Number(req.query.limit)))
        : 100
      const offset = req.query.offset ? Math.max(0, Number(req.query.offset)) : 0
      const result = await getAppNotificationsFactory({ db })({ userId, limit, offset })
      return res.status(200).json(result)
    } catch (err) {
      req.log.error(err, 'Get notifications list failed')
      return res.status(500).json({ error: 'Failed to get notifications' })
    }
  })

  // 4. 单条标记为已读
  router.put('/api/v1/notifications/:id/read', async (req, res) => {
    try {
      const userId = req.context.userId!
      const { id } = req.params
      await markNotificationAsReadFactory({ db })({ id, userId })
      return res.status(200).json({ success: true })
    } catch (err) {
      req.log.error(err, 'Mark notification read failed')
      return res.status(500).json({ error: 'Failed to mark notification as read' })
    }
  })

  return router
}
