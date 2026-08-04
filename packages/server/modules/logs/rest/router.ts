import { Router, type RequestHandler } from 'express'
import { validateRequest } from 'zod-express'
import { batchLogEventsBodySchema } from '@/modules/logs/rest/schemas'
import { normalizeIncomingFrontendEvent } from '@/modules/logs/services/events'
import { enqueueLogEvents } from '@/modules/logs/services/queue'
import { db } from '@/db/knex'
import { listLogEventsFactory } from '@/modules/logs/repositories/logs'
import { getUsersFactory } from '@/modules/core/repositories/users'
import { requirePermission } from '@/modules/shared/middleware'

const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.context.auth)
    return res.status(401).send({ error: 'Authentication required.' })
  return next()
}

const clampLimit = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 100
  return Math.min(Math.max(Math.floor(num), 1), 500)
}

const clampPage = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 1
  return Math.max(Math.floor(num), 1)
}

const parseDateStart = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const date = new Date(`${value.trim()}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const parseDateEnd = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const date = new Date(`${value.trim()}T23:59:59.999Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

export const logsRouterFactory = (): Router => {
  const app = Router()
  const listLogEvents = listLogEventsFactory({ db })
  const getUsers = getUsersFactory({ db })

  app.get(
    '/api/v1/logs/events',
    requireAuth,
    requirePermission('permission-management:edit'),
    async (req, res) => {
      const pageSize = clampLimit(req.query.pageSize ?? req.query.limit)
      const page = clampPage(req.query.page)
      const offset = (page - 1) * pageSize
      const search =
        typeof req.query.q === 'string' && req.query.q.trim()
          ? req.query.q.trim()
          : undefined
      const opType =
        typeof req.query.opType === 'string' && req.query.opType !== 'all'
          ? req.query.opType
          : undefined
      const result =
        req.query.result === 'success' || req.query.result === 'fail'
          ? req.query.result
          : undefined
      const dateFrom = parseDateStart(req.query.dateFrom)
      const dateTo = parseDateEnd(req.query.dateTo)

      const { items: rows, totalCount } = await listLogEvents({
        limit: pageSize,
        offset,
        search,
        opType,
        result,
        dateFrom,
        dateTo,
        operationOnly: true
      })

      const userIds = [
        ...new Set(rows.map((row) => row.user_id).filter((id): id is string => !!id))
      ]
      const users = userIds.length
        ? await getUsers(userIds, {
            skipClean: true
          })
        : []
      const userById = new Map(
        users.map((user) => [
          user.id,
          {
            id: user.id,
            name: user.name,
            email: user.email || null
          }
        ])
      )

      const events = rows.map((row) => {
        const location = toRecord(row.location)
        return {
          eventId: row.id,
          eventTime: row.event_time.toISOString(),
          source: row.source,
          who: {
            userId: row.user_id,
            user: row.user_id ? userById.get(row.user_id) ?? null : null,
            orgId: row.org_id,
            role: row.user_role,
            ip: row.ip,
            userAgent: row.user_agent
          },
          where: {
            page:
              typeof location.page === 'string' || location.page === null
                ? location.page
                : null,
            route:
              typeof location.route === 'string' || location.route === null
                ? location.route
                : null,
            api:
              typeof location.api === 'string' || location.api === null
                ? location.api
                : null,
            module:
              typeof location.module === 'string' || location.module === null
                ? location.module
                : null,
            service:
              typeof location.service === 'string' || location.service === null
                ? location.service
                : null
          },
          what: {
            action: row.action,
            targetType: row.target_type,
            targetId: row.target_id,
            payloadSummary: row.payload_summary,
            method: null
          },
          result: {
            status: row.result_status,
            code: row.result_code,
            message: row.result_message,
            durationMs: row.duration_ms,
            httpStatus: row.http_status
          },
          trace: {
            traceId: row.trace_id,
            requestId: row.request_id
          },
          metadata: row.metadata
        }
      })

      return res.status(200).send({
        items: events,
        total: totalCount,
        page,
        pageSize
      })
    }
  )

  app.post(
    '/api/v1/logs/events/batch',
    requireAuth,
    validateRequest({ body: batchLogEventsBodySchema }),
    async (req, res) => {
      const events = req.body.events.map((event) =>
        normalizeIncomingFrontendEvent({
          event,
          req
        })
      )

      await enqueueLogEvents({ events })
      return res.status(202).send({ accepted: events.length })
    }
  )

  return app
}
