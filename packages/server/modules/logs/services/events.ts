import cryptoRandomString from 'crypto-random-string'
import type { Request } from 'express'
import type { LogEvent, LogResultStatus } from '@/modules/logs/domain/types'

const DEFAULT_SOURCE = 'frontend' as const

const toSingleHeader = (value: string | string[] | undefined) => {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

const sanitizeActionPart = (value: string) =>
  value
    .replace(/^\/+|\/+$/g, '')
    .replace(/[/:]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/[^a-zA-Z0-9._-]/g, '_')

const normalizeResultStatus = (
  status: string | undefined,
  httpStatus: number | null | undefined
): LogResultStatus => {
  if (status === 'success' || status === 'fail' || status === 'unknown') return status
  if (typeof httpStatus === 'number') return httpStatus >= 400 ? 'fail' : 'success'
  return 'unknown'
}

const getRequestId = (req: Request) => toSingleHeader(req.headers['x-request-id'])

const getTraceId = (req: Request) =>
  toSingleHeader(req.headers['x-trace-id']) || getRequestId(req)

const getClientIp = (req: Request) =>
  toSingleHeader(req.headers['x-speckle-client-ip']) ||
  toSingleHeader(req.headers['x-forwarded-for']) ||
  req.ip ||
  null

const getUserAgent = (req: Request) => toSingleHeader(req.headers['user-agent'])

const buildDefaultAction = (path: string, method: string) => {
  const normalizedPath = sanitizeActionPart(path || 'unknown')
  return `api.${method.toLowerCase()}.${normalizedPath || 'unknown'}`
}

type IncomingLogEvent = Omit<
  Partial<LogEvent>,
  'who' | 'where' | 'what' | 'result' | 'trace'
> & {
  who?: Partial<LogEvent['who']>
  where?: Partial<LogEvent['where']>
  what?: Partial<LogEvent['what']>
  result?: Partial<LogEvent['result']>
  trace?: Partial<LogEvent['trace']>
}

export const normalizeIncomingFrontendEvent = (params: {
  event: IncomingLogEvent
  req: Request
}): LogEvent => {
  const { event, req } = params
  const nowIso = new Date().toISOString()

  return {
    eventId: event.eventId || cryptoRandomString({ length: 20 }),
    eventTime: event.eventTime || nowIso,
    source: event.source || DEFAULT_SOURCE,
    who: {
      userId: event.who?.userId || req.context.userId || null,
      orgId: event.who?.orgId || null,
      role: event.who?.role || req.context.role || null,
      ip: event.who?.ip || getClientIp(req),
      userAgent: event.who?.userAgent || getUserAgent(req)
    },
    where: {
      page: event.where?.page || null,
      route: event.where?.route || req.path || null,
      api: event.where?.api || null,
      module: event.where?.module || null,
      service: event.where?.service || null
    },
    what: {
      action: event.what?.action || 'frontend.unknown',
      targetType: event.what?.targetType || null,
      targetId: event.what?.targetId || null,
      payloadSummary: event.what?.payloadSummary || null,
      method: event.what?.method || null
    },
    result: {
      status: normalizeResultStatus(event.result?.status, event.result?.httpStatus),
      code: event.result?.code || null,
      message: event.result?.message || null,
      durationMs: event.result?.durationMs || null,
      httpStatus: event.result?.httpStatus || null
    },
    trace: {
      traceId: event.trace?.traceId || getTraceId(req),
      requestId: event.trace?.requestId || getRequestId(req)
    },
    metadata: event.metadata || null
  }
}

export const buildBackendApiOperationEvent = (params: {
  req: Request
  durationMs: number
  httpStatus: number
  /**
   * 请求路径快照。必须在请求进入挂载点之前捕获：
   * express 的挂载机制（如 app.use('/graphql', ...)）会在处理过程中改写 req.url，
   * 导致 finish 回调里读取的 req.path 变成 '/'，从而丢失真实路径。
   */
  path?: string | null
}): LogEvent => {
  const { req, durationMs, httpStatus, path } = params
  const effectivePath = path || req.path || req.originalUrl || 'unknown'
  const action = buildDefaultAction(effectivePath, req.method)
  const urlWithoutQuery = (req.originalUrl || req.url || '').split('?')[0] || req.path
  const nowIso = new Date().toISOString()

  return {
    eventId: cryptoRandomString({ length: 20 }),
    eventTime: nowIso,
    source: 'backend',
    who: {
      userId: req.context.userId || null,
      orgId: null,
      role: req.context.role || null,
      ip: getClientIp(req),
      userAgent: getUserAgent(req)
    },
    where: {
      route: effectivePath || null,
      api: urlWithoutQuery || null,
      module: null,
      service: null,
      page: null
    },
    what: {
      action,
      targetType: 'api',
      targetId: null,
      payloadSummary: null,
      method: req.method
    },
    result: {
      status: httpStatus >= 400 ? 'fail' : 'success',
      code: String(httpStatus),
      message: null,
      durationMs,
      httpStatus
    },
    trace: {
      traceId: getTraceId(req),
      requestId: getRequestId(req)
    },
    metadata: null
  }
}
