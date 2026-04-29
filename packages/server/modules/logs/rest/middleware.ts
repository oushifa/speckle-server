import type { RequestHandler } from 'express'
import { buildBackendApiOperationEvent } from '@/modules/logs/services/events'
import { enqueueLogEvents } from '@/modules/logs/services/queue'
import { moduleLogger } from '@/observability/logging'

const EXCLUDED_PATHS = new Set(['/api/v1/logs/events/batch', '/api/v1/server/version'])

const shouldSkipLogging = (path: string) => {
  if (EXCLUDED_PATHS.has(path)) return true
  return path.startsWith('/_/')
}

export const apiOperationLogMiddlewareFactory = (): RequestHandler => (req, res, next) => {
  if (shouldSkipLogging(req.path)) {
    return next()
  }

  const startTime = Date.now()

  res.on('finish', () => {
    try {
      const event = buildBackendApiOperationEvent({
        req,
        durationMs: Date.now() - startTime,
        httpStatus: res.statusCode
      })
      void enqueueLogEvents({ events: [event] })
    } catch (err) {
      moduleLogger.error({ err }, 'Failed to enqueue backend api operation log')
    }
  })

  next()
}
