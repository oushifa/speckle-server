import type cron from 'node-cron'
import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { rvtConversionRouterFactory } from '@/modules/rvt-conversion/rest/router'
import { createRvtConvertLogger } from '@/modules/rvt-conversion/services/logging'
import { shutdownRvtConversionWsServer } from '@/modules/rvt-conversion/services/wsServer'
import { db } from '@/db/knex'
import { scheduleExecutionFactory } from '@/modules/core/services/taskScheduler'
import {
  acquireTaskLockFactory,
  releaseTaskLockFactory
} from '@/modules/core/repositories/scheduledTasks'
import { getRegisteredDbClients } from '@/modules/multiregion/utils/dbSelector'
import { expireOldRvtConversionJobsFactory } from '@/modules/rvt-conversion/services/tasks'
import { TIME } from '@speckle/shared'

const EveryFiveMinutes = '*/5 * * * *'
const HalfDayInSeconds = 12 * TIME.hour
const rvtModuleLogger = createRvtConvertLogger('module')

let scheduledTask: cron.ScheduledTask | null = null

const rvtConversionModule: SpeckleModule = {
  async init({ app, isInitial }) {
    rvtModuleLogger.info('RVT_CONVERT init module')
    app.use(rvtConversionRouterFactory())

    if (isInitial) {
      const scheduleExecution = scheduleExecutionFactory({
        acquireTaskLock: acquireTaskLockFactory({ db }),
        releaseTaskLock: releaseTaskLockFactory({ db })
      })

      const regionClients = await getRegisteredDbClients()
      const expiryHandlers = [db, ...regionClients].map((projectDb) =>
        expireOldRvtConversionJobsFactory({ db: projectDb })
      )

      scheduledTask = scheduleExecution(
        EveryFiveMinutes,
        'RvtConversionJobExpiry',
        async (_scheduledTime, { logger }) => {
          const results = await Promise.all(
            expiryHandlers.map((handler) =>
              handler({
                timeoutThresholdSeconds: HalfDayInSeconds
              })
            )
          )

          logger.info(
            {
              module: 'rvt-conversion',
              tag: 'RVT_CONVERT',
              expiredJobsCount: results.reduce((sum, jobs) => sum + jobs.length, 0),
              timeoutThresholdSeconds: HalfDayInSeconds
            },
            'RVT_CONVERT expiry task completed'
          )
        }
      )
    }
  },
  async shutdown() {
    if (scheduledTask) scheduledTask.stop()
    await shutdownRvtConversionWsServer()
  }
}

export default rvtConversionModule
