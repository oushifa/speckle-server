import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'

const flowModule: SpeckleModule = {
  init: async () => {
    moduleLogger.info('Init flow module')
  }
}

export default flowModule
