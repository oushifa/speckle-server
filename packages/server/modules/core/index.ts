import { moduleLogger } from '@/observability/logging'
import {
  setupResultListener,
  shutdownResultListener
} from '@/modules/core/utils/dbNotificationListener'
import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'

import staticRest from '@/modules/core/rest/static'
import uploadRest from '@/modules/core/rest/upload'
import downloadRest from '@/modules/core/rest/download'
import modelsRest from '@/modules/core/rest/models'
import modelCustomLabelRest from '@/modules/core/rest/modelCustomLabel'
import modelCustomAttributesExcelRest from '@/modules/core/rest/modelCustomAttributesExcel'
import projectModelObjectsRest from '@/modules/core/rest/projectModelObjects'
import modelLibraryProjectRest from '@/modules/core/rest/modelLibraryProject'
import modelLibraryUploadsRest from '@/modules/core/rest/modelLibraryUploads'
import diffUpload from '@/modules/core/rest/diffUpload'
import diffDownload from '@/modules/core/rest/diffDownload'
import scopes from '@/modules/core/scopes'
import roles from '@/modules/core/roles'
import { getGenericRedis } from '@/modules/shared/redis/redis'
import { registerOrUpdateScopeFactory } from '@/modules/shared/repositories/scopes'
import db from '@/db/knex'
import { registerOrUpdateRole } from '@/modules/shared/repositories/roles'
import { isTestEnv } from '@/modules/shared/helpers/envHelper'
import type { HooksConfig, Hook, ExecuteHooks } from '@/modules/core/hooks'
import { reportSubscriptionEventsFactory } from '@/modules/core/events/subscriptionListeners'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { publish } from '@/modules/shared/utils/subscriptions'
import {
  getImplicitUserProjectsCountFactory,
  getStreamCollaboratorsFactory
} from '@/modules/core/repositories/streams'
import { reportUserEventsFactory } from '@/modules/core/events/userTracking'
import { coreLogger } from '@/modules/core/logger'
import { getUserFactory } from '@/modules/core/repositories/users'
import { bullMonitoringRouterFactory } from '@/modules/core/rest/monitoring'
import { projectListenersFactory } from '@/modules/core/events/projectListeners'
import { ensureModelLibraryProjectFactory } from '@/modules/core/services/streams/modelLibrary'

let stopTestSubs: (() => void) | undefined = undefined

const coreModule: SpeckleModule<{
  hooks: HooksConfig
  addHook: (key: keyof HooksConfig, hook: Hook) => void
  executeHooks: ExecuteHooks
}> = {
  hooks: {
    onCreateObjectRequest: [],
    onCreateVersionRequest: []
  },
  addHook(key: keyof HooksConfig, callback: Hook) {
    this.hooks[key].push(callback)
  },
  async executeHooks(key: keyof HooksConfig, { projectId }: { projectId: string }) {
    return await Promise.all(this.hooks[key].map(async (cb) => await cb({ projectId })))
  },
  async init({ app, isInitial }) {
    moduleLogger.info('💥 Init core module')

    // Initialize the static route
    staticRest(app)

    // Initialises the two main bulk upload/download endpoints
    uploadRest(app, { executeHooks: this.executeHooks.bind(this) })
    downloadRest(app)

    // Initialises the two diff-based upload/download endpoints
    diffUpload(app)
    diffDownload(app)

    // Initialises the models REST endpoint
    modelsRest(app)
    modelCustomLabelRest(app)
    modelCustomAttributesExcelRest(app)
    projectModelObjectsRest(app)
    modelLibraryProjectRest(app)
    modelLibraryUploadsRest(app)

    const scopeRegisterFunc = registerOrUpdateScopeFactory({ db })
    // Register core-based scoeps
    for (const scope of scopes) {
      await scopeRegisterFunc({ scope })
    }

    const roleRegisterFunc = registerOrUpdateRole({ db })
    // Register core-based roles
    for (const role of roles) {
      await roleRegisterFunc({ role })
    }

    if (isInitial) {
      // Setup global pg notification listener
      await setupResultListener()

      // Setup test subs
      if (isTestEnv()) {
        const { startEmittingTestSubs } = await import('@/test/graphqlHelper')
        stopTestSubs = await startEmittingTestSubs()
      }

      // Setup up various eventBus listeners
      reportSubscriptionEventsFactory({
        eventListen: getEventBus().listen,
        publish,
        getStreamCollaborators: getStreamCollaboratorsFactory({ db })
      })()

      reportUserEventsFactory({
        eventBus: getEventBus(),
        logger: coreLogger
      })()

      projectListenersFactory({
        eventBus: getEventBus(),
        logger: coreLogger
      })()

      await ensureModelLibraryProjectFactory({ db })()
    }
  },
  async finalize({ app }) {
    // Run BullMQ monitor once the app is fully ready
    app.use(bullMonitoringRouterFactory())
  },
  async shutdown() {
    await shutdownResultListener()
    await getGenericRedis().quit()
    stopTestSubs?.()
  }
}

export default coreModule
