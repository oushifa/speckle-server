import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { fileConversionRouterFactory } from '@/modules/file-conversion/rest/router'

const fileConversionModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('🗂️ Init file conversion module')
    app.use(fileConversionRouterFactory())
  }
}

export default fileConversionModule
