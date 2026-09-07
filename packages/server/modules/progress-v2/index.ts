import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { progressV2RouterFactory } from '@/modules/progress-v2/rest/router'

const progressV2Module: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('📅 Init progress-v2 module')
    app.use(progressV2RouterFactory())
  }
}

export default progressV2Module
