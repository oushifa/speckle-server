import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { customRoleRouterFactory } from '@/modules/custom-role/rest/router'

const customRoleModule: SpeckleModule = {
  init({ app }) {
    moduleLogger.info('🔐 Init custom-role module')
    app.use(customRoleRouterFactory())
  }
}

export default customRoleModule
