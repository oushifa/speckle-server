import type { Knex } from 'knex'
import type { LogEvent } from '@/modules/logs/domain/types'

const SYS_LOG_TABLE = 'sys_log'

const toRow = (event: LogEvent) => ({
  id: event.eventId,
  ['event_time']: new Date(event.eventTime),
  source: event.source,
  ['user_id']: event.who.userId || null,
  ['org_id']: event.who.orgId || null,
  ['user_role']: event.who.role || null,
  ip: event.who.ip || null,
  ['user_agent']: event.who.userAgent || null,
  location: event.where || {},
  action: event.what.action,
  ['target_type']: event.what.targetType || null,
  ['target_id']: event.what.targetId || null,
  ['payload_summary']:
    typeof event.what.payloadSummary === 'string'
      ? { text: event.what.payloadSummary }
      : event.what.payloadSummary || null,
  ['result_status']: event.result.status,
  ['result_code']: event.result.code || null,
  ['result_message']: event.result.message || null,
  ['duration_ms']: event.result.durationMs || null,
  ['http_status']: event.result.httpStatus || null,
  ['trace_id']: event.trace.traceId || null,
  ['request_id']: event.trace.requestId || null,
  metadata: event.metadata || null
})

export const insertLogEventsFactory =
  ({ db }: { db: Knex }) =>
  async ({ events }: { events: LogEvent[] }) => {
    if (!events.length) return
    const rows = events.map(toRow)
    await db(SYS_LOG_TABLE).insert(rows)
  }

export const ensureLogMonthPartitionFactory =
  ({ db }: { db: Knex }) =>
  async ({ eventTime }: { eventTime: Date }) => {
    await db.raw('SELECT sys_log_ensure_partition_for(?::timestamptz)', [eventTime])
  }

export const listSysLogPartitionsFactory =
  ({ db }: { db: Knex }) =>
  async (): Promise<string[]> => {
    const result = await db.raw<{
      rows: Array<{ partition_name: string }>
    }>(
      `
        SELECT child.relname AS partition_name
        FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child ON pg_inherits.inhrelid = child.oid
        WHERE parent.relname = ?
      `,
      [SYS_LOG_TABLE]
    )

    return result.rows.map((row) => row.partition_name)
  }

export const dropLogPartitionFactory =
  ({ db }: { db: Knex }) =>
  async ({ partitionName }: { partitionName: string }) => {
    await db.raw(`ALTER TABLE ${SYS_LOG_TABLE} DETACH PARTITION ${partitionName}`)
    await db.raw(`DROP TABLE IF EXISTS ${partitionName}`)
  }

type LogEventRow = {
  id: string
  event_time: Date
  source: 'frontend' | 'backend'
  user_id: string | null
  org_id: string | null
  user_role: string | null
  ip: string | null
  user_agent: string | null
  location: Record<string, unknown> | null
  action: string
  target_type: string | null
  target_id: string | null
  payload_summary: Record<string, unknown> | null
  result_status: 'success' | 'fail' | 'unknown'
  result_code: string | null
  result_message: string | null
  duration_ms: number | null
  http_status: number | null
  trace_id: string | null
  request_id: string | null
  metadata: Record<string, unknown> | null
}

export type ListLogEventsParams = {
  limit: number
  offset: number
  search?: string
  opType?: string
  result?: 'success' | 'fail'
  dateFrom?: Date
  dateTo?: Date
  operationOnly?: boolean
}

export const listLogEventsFactory =
  ({ db }: { db: Knex }) =>
  async (params: ListLogEventsParams) => {
    const query = db(SYS_LOG_TABLE).select<LogEventRow[]>(
      'id',
      'event_time',
      'source',
      'user_id',
      'org_id',
      'user_role',
      'ip',
      'user_agent',
      'location',
      'action',
      'target_type',
      'target_id',
      'payload_summary',
      'result_status',
      'result_code',
      'result_message',
      'duration_ms',
      'http_status',
      'trace_id',
      'request_id',
      'metadata'
    )
    if (params.operationOnly !== false) {
      query.whereRaw(`metadata->>'opType' IS NOT NULL`)
    }

    if (params.search?.trim()) {
      const searchTerm = `%${params.search.trim()}%`
      query.andWhere((builder) => {
        builder
          .whereILike('target_id', searchTerm)
          .orWhereRaw(`coalesce(metadata->>'target', '') ILIKE ?`, [searchTerm])
          .orWhereRaw(`coalesce(metadata->>'detail', '') ILIKE ?`, [searchTerm])
          .orWhereRaw(`coalesce(payload_summary->>'text', '') ILIKE ?`, [searchTerm])
          .orWhereExists(
            db('users')
              .select(db.raw('1'))
              .whereRaw(`users.id = ${SYS_LOG_TABLE}.user_id`)
              .andWhereILike('users.name', searchTerm)
          )
      })
    }

    if (params.opType) {
      query.andWhereRaw(`metadata->>'opType' = ?`, [params.opType])
    }

    if (params.result) {
      query.andWhere('result_status', params.result)
    }

    if (params.dateFrom) {
      query.andWhere('event_time', '>=', params.dateFrom)
    }

    if (params.dateTo) {
      query.andWhere('event_time', '<=', params.dateTo)
    }

    const totalCountQuery = await query
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ count: string | number }>('* as count')
      .first()
    const totalCount = Number(totalCountQuery?.count ?? 0)

    const rows = await query
      .orderBy('event_time', 'desc')
      .offset(params.offset)
      .limit(params.limit)

    return { items: rows, totalCount }
  }
