import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { alignmentRouterFactory } from '@/modules/alignment/rest/router'

const alignmentModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('🧭 Init alignment module')
    app.use(alignmentRouterFactory())
  }
}

export default alignmentModule
