import { z } from 'zod'

const nullableString = z.string().trim().max(1024).nullable().optional()

const nullableNumber = z.number().finite().nullable().optional()

export const logEventSchema = z.object({
  eventId: z.string().min(1).max(128).optional(),
  eventTime: z.string().datetime().optional(),
  source: z.enum(['frontend', 'backend']).optional(),
  who: z
    .object({
      userId: nullableString,
      orgId: nullableString,
      role: nullableString,
      ip: nullableString,
      userAgent: nullableString
    })
    .optional(),
  where: z
    .object({
      page: nullableString,
      route: nullableString,
      api: nullableString,
      module: nullableString,
      service: nullableString
    })
    .optional(),
  what: z.object({
    action: z.string().min(1).max(512),
    targetType: nullableString,
    targetId: nullableString,
    payloadSummary: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
    method: nullableString
  }),
  result: z
    .object({
      status: z.enum(['success', 'fail', 'unknown']).optional(),
      code: nullableString,
      message: nullableString,
      durationMs: nullableNumber,
      httpStatus: nullableNumber
    })
    .optional(),
  trace: z
    .object({
      traceId: nullableString,
      requestId: nullableString
    })
    .optional(),
  metadata: z.record(z.unknown()).nullable().optional()
})

export const batchLogEventsBodySchema = z.object({
  events: z.array(logEventSchema).max(500)
})
