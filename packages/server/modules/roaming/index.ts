import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { roamingRouterFactory } from '@/modules/roaming/rest/router'

const roamingModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('🚶 Init roaming module')
    app.use(roamingRouterFactory())
  }
}

export default roamingModule
