import { Router, type RequestHandler } from 'express'
import { validateRequest } from 'zod-express'
import { batchLogEventsBodySchema } from '@/modules/logs/rest/schemas'
import { normalizeIncomingFrontendEvent } from '@/modules/logs/services/events'
import { enqueueLogEvents } from '@/modules/logs/services/queue'
import { db } from '@/db/knex'
import { listLogEventsFactory } from '@/modules/logs/repositories/logs'
import { getUsersFactory } from '@/modules/core/repositories/users'

const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.context.auth) return res.status(401).send({ error: 'Authentication required.' })
  return next()
}

const clampLimit = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 100
  return Math.min(Math.max(Math.floor(num), 1), 500)
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

export const logsRouterFactory = (): Router => {
  const app = Router()
  const listLogEvents = listLogEventsFactory({ db })
  const getUsers = getUsersFactory({ db })

  app.get('/api/v1/logs/events', requireAuth, async (req, res) => {
    const limit = clampLimit(req.query.limit)
    const rows = await listLogEvents({ limit })
    const userIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => !!id))]
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
          user: row.user_id ? (userById.get(row.user_id) ?? null) : null,
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
            typeof location.api === 'string' || location.api === null ? location.api : null,
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

    return res.status(200).send({ events })
  })

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
