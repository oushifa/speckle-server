import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { prepaymentRouterFactory } from '@/modules/prepayment/rest/router'

const prepaymentModule: SpeckleModule = {
  init: async ({ app }) => {
    moduleLogger.info('Init prepayment module')
    app.use(prepaymentRouterFactory())
  }
}

export default prepaymentModule
