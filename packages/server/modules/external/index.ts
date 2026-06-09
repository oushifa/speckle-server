import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { externalRouterFactory } from '@/modules/external/rest/router'

const externalModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('🔌 Init external API module')
    app.use(externalRouterFactory())
  }
}

export default externalModule
