export type LogSource = 'frontend' | 'backend'

export type LogResultStatus = 'success' | 'fail' | 'unknown'

export type LogEvent = {
  eventId: string
  eventTime: string
  source: LogSource
  who: {
    userId?: string | null
    orgId?: string | null
    role?: string | null
    ip?: string | null
    userAgent?: string | null
  }
  where: {
    page?: string | null
    route?: string | null
    api?: string | null
    module?: string | null
    service?: string | null
  }
  what: {
    action: string
    targetType?: string | null
    targetId?: string | null
    payloadSummary?: Record<string, unknown> | string | null
    method?: string | null
  }
  result: {
    status: LogResultStatus
    code?: string | null
    message?: string | null
    durationMs?: number | null
    httpStatus?: number | null
  }
  trace: {
    traceId?: string | null
    requestId?: string | null
  }
  metadata?: Record<string, unknown> | null
}

export type LogQueuePayload = {
  events: LogEvent[]
}
