import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { flowRouterFactory } from '@/modules/flow/rest/router'

const flowModule: SpeckleModule = {
  init: async ({ app }) => {
    moduleLogger.info('Init flow module')
    app.use(flowRouterFactory())
  }
}

export default flowModule
