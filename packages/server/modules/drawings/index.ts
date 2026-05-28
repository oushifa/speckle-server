import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { drawingsRouterFactory } from '@/modules/drawings/rest/router'

const drawingsModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('🗺️ Init drawings module')
    app.use(drawingsRouterFactory())
  }
}

export default drawingsModule

