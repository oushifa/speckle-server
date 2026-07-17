import type cron from 'node-cron'
import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { logsRouterFactory } from '@/modules/logs/rest/router'
import { apiOperationLogMiddlewareFactory } from '@/modules/logs/rest/middleware'
import { startLogWorker, stopLogQueue } from '@/modules/logs/services/queue'
import { db } from '@/db/knex'
import { scheduleExecutionFactory } from '@/modules/core/services/taskScheduler'
import {
  acquireTaskLockFactory,
  releaseTaskLockFactory
} from '@/modules/core/repositories/scheduledTasks'
import { cleanupExpiredLogPartitionsFactory } from '@/modules/logs/tasks/cleanup'
import { ensureLogMonthPartitionFactory } from '@/modules/logs/repositories/logs'

const EveryDayAt330UTC = '30 3 * * *'
const LOG_RETENTION_MONTHS = 3

const scheduledTasks: cron.ScheduledTask[] = []

const logsModule: SpeckleModule = {
  init: async ({ app, isInitial }) => {
    moduleLogger.info('📋 Init logs module')
    app.use(apiOperationLogMiddlewareFactory())
    app.use(logsRouterFactory())

    if (!isInitial) return

    const ensureLogMonthPartition = ensureLogMonthPartitionFactory({ db })
    const now = new Date()
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    await ensureLogMonthPartition({ eventTime: now })
    await ensureLogMonthPartition({ eventTime: nextMonth })

    startLogWorker()

    const scheduleExecution = scheduleExecutionFactory({
      acquireTaskLock: acquireTaskLockFactory({ db }),
      releaseTaskLock: releaseTaskLockFactory({ db })
    })
    const cleanupExpiredLogPartitions = cleanupExpiredLogPartitionsFactory({ db })

    scheduledTasks.push(
      scheduleExecution(EveryDayAt330UTC, 'logs.partition-cleanup', async (_, context) => {
        await cleanupExpiredLogPartitions({
          retentionMonths: LOG_RETENTION_MONTHS,
          logger: context.logger
        })
      })
    )
  },
  shutdown: async () => {
    scheduledTasks.forEach((task) => task.stop())
    await stopLogQueue()
  }
}

export default logsModule
