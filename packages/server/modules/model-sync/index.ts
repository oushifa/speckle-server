import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { modelSyncRouterFactory } from '@/modules/model-sync/rest/router'
import { getModelSyncBuildInfo } from '@/modules/model-sync/services/buildInfo'

const modelSyncModule: SpeckleModule = {
  init({ app }) {
    // 启动时打印版本指纹，便于用 `docker logs <server> | grep 'model-sync build'` 确认版本
    moduleLogger.info(
      { build: getModelSyncBuildInfo() },
      '🔄 Init model-sync module (model-sync build)'
    )
    app.use(modelSyncRouterFactory())
  }
}

export default modelSyncModule
