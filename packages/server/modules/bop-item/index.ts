import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { bopItemRouterFactory } from '@/modules/bop-item/rest/router'

const bopItemModule: SpeckleModule = {
  init: async ({ app }) => {
    moduleLogger.info('Init bop-item module')
    app.use(bopItemRouterFactory())
  }
}

export default bopItemModule
