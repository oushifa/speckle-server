import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { projectCostSummaryRouterFactory } from '@/modules/project-statistics/rest/router'

const projectStatisticsModule: SpeckleModule = {
  init: async ({ app }) => {
    moduleLogger.info('Init project-statistics module')
    app.use(projectCostSummaryRouterFactory())
  }
}

export default projectStatisticsModule
