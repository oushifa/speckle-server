import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { qualityAcceptanceRouterFactory } from '@/modules/quality-acceptance-form/rest/router'

const qualityAcceptanceFormModule: SpeckleModule = {
  init: async ({ app }) => {
    moduleLogger.info('Init quality-acceptance-form module')
    app.use(qualityAcceptanceRouterFactory())
  }
}

export default qualityAcceptanceFormModule
