import { Queue, Worker } from 'bullmq'
import type { Job, JobsOptions } from 'bullmq'
import { db } from '@/db/knex'
import { getRedisUrl } from '@/modules/shared/helpers/envHelper'
import type { LogEvent, LogQueuePayload } from '@/modules/logs/domain/types'
import {
  ensureLogMonthPartitionFactory,
  insertLogEventsFactory
} from '@/modules/logs/repositories/logs'
import { moduleLogger } from '@/observability/logging'
import { TIME } from '@speckle/shared'

const logger = moduleLogger.child({ module: 'logs' })
const LOG_QUEUE_NAME = 'sys-log-write'

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000
  },
  removeOnComplete: {
    age: 1 * TIME.day,
    count: 1000
  },
  removeOnFail: {
    age: 1 * TIME.week,
    count: 5000
  }
}

let logQueue: Queue<LogQueuePayload> | undefined
let logWorker: Worker<LogQueuePayload> | undefined

const buildBullConnection = () => {
  const redisUrl = getRedisUrl()
  const parsed = new URL(redisUrl)
  const dbIndex = parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isNaN(dbIndex) ? 0 : dbIndex,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {})
  }
}

export const getLogQueue = () => {
  if (!logQueue) {
    logQueue = new Queue<LogQueuePayload>(LOG_QUEUE_NAME, {
      connection: buildBullConnection(),
      defaultJobOptions
    })
  }

  return logQueue
}

export const enqueueLogEvents = async ({ events }: { events: LogEvent[] }) => {
  if (!events.length) return

  await getLogQueue().add('write-log-batch', { events })
}

export const startLogWorker = () => {
  if (logWorker) return

  const insertLogEvents = insertLogEventsFactory({ db })
  const ensureLogMonthPartition = ensureLogMonthPartitionFactory({ db })

  logWorker = new Worker<LogQueuePayload>(
    LOG_QUEUE_NAME,
    async (job: Job<LogQueuePayload>) => {
      const events = job.data.events || []
      if (!events.length) return

      const uniqueMonths = Array.from(
        new Set(
          events.map((event) => {
            const d = new Date(event.eventTime)
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
          })
        )
      )
      await Promise.all(
        uniqueMonths.map(async (month) =>
          ensureLogMonthPartition({ eventTime: new Date(String(month)) })
        )
      )

      await insertLogEvents({ events })
    },
    {
      connection: buildBullConnection(),
      concurrency: 10
    }
  )

  logWorker.on('error', (err: Error) => {
    logger.error({ err }, 'Log queue worker encountered an error')
  })
  logWorker.on('failed', (job: Job<LogQueuePayload> | undefined, err: Error) => {
    logger.error(
      {
        err,
        jobId: job?.id
      },
      'Log queue worker failed to process a job'
    )
  })
}

export const stopLogQueue = async () => {
  await Promise.allSettled([logWorker?.close(), logQueue?.close()])
  logWorker = undefined
  logQueue = undefined
}
