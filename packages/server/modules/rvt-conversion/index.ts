import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { rvtConversionRouterFactory } from '@/modules/rvt-conversion/rest/router'
import { shutdownRvtConversionWsServer } from '@/modules/rvt-conversion/services/wsServer'

const rvtConversionModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('🧱 Init RVT conversion module')
    app.use(rvtConversionRouterFactory())
  },
  async shutdown() {
    await shutdownRvtConversionWsServer()
  }
}

export default rvtConversionModule
