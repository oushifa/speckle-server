import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { projectCostSummaryRouterFactory } from '@/modules/project-cost-summary/rest/router'

const projectCostSummaryModule: SpeckleModule = {
  init: async ({ app }) => {
    moduleLogger.info('Init project-cost-summary module')
    app.use(projectCostSummaryRouterFactory())
  }
}

export default projectCostSummaryModule
