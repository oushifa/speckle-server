import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { progressRouterFactory } from '@/modules/progress/rest/router'

const progressModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('📅 Init progress module')
    app.use(progressRouterFactory())
  }
}

export default progressModule
