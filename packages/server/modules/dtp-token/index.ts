import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import dtpTokenRouterFactory from '@/modules/dtp-token/rest/router'

const dtpTokenModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('🎫 Init dtp-token module')
    app.use(dtpTokenRouterFactory())
  }
}

export default dtpTokenModule
