import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { fileManagementRouterFactory } from '@/modules/file-management/rest/router'

const fileManagementModule: SpeckleModule = {
  init: async ({ app }) => {
    moduleLogger.info('Init file-management module')
    app.use(fileManagementRouterFactory())
  }
}

export default fileManagementModule
