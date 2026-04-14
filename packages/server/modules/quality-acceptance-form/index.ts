import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'

const qualityAcceptanceFormModule: SpeckleModule = {
  init: async () => {
    moduleLogger.info('Init quality-acceptance-form module')
  }
}

export default qualityAcceptanceFormModule
