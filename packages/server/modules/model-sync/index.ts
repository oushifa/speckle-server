import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { modelSyncRouterFactory } from '@/modules/model-sync/rest/router'

const modelSyncModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('🔄 Init model-sync module')
    app.use(modelSyncRouterFactory())
  }
}

export default modelSyncModule
