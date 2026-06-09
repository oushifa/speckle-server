import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { organizationsRouterFactory } from '@/modules/organizations/rest/router'

export const init: SpeckleModule['init'] = ({ app }) => {
  moduleLogger.info('🏢 Init organizations module')
  app.use(organizationsRouterFactory())
}

