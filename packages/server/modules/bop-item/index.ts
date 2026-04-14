import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'

const bopItemModule: SpeckleModule = {
  init: async () => {
    moduleLogger.info('Init bop-item module')
  }
}

export default bopItemModule
