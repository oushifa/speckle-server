import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { progressRouterFactory } from '@/modules/progress/rest/router'
import { initializeComponentCodeIndexOnVersionListeners } from '@/modules/progress/services/componentCodeIndexOnVersion'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { isComponentCodeIndexRebuildEnabled } from '@/modules/shared/helpers/envHelper'

let stopComponentCodeIndexListeners: (() => void) | undefined

const progressModule: SpeckleModule = {
  init: async ({ app }) => {
    moduleLogger.info('📅 Init progress module')
    app.use(progressRouterFactory())

    // 版本导入后自动重建构件编码索引切片。
    // 监听器内部只「入队后立刻返回」：重活在后台串行队列里做，既不拖慢导入接口，
    // 也不会因为重建失败打断导入流程（读路径对未建好的模型会自动回退）。
    if (!isComponentCodeIndexRebuildEnabled()) {
      moduleLogger.info('🧩 Component code index auto rebuild DISABLED')
      return
    }

    const listeners = initializeComponentCodeIndexOnVersionListeners({
      eventBus: getEventBus()
    })
    stopComponentCodeIndexListeners = listeners.quit
    moduleLogger.info('🧩 Component code index auto rebuild listeners registered')
  },
  shutdown: async () => {
    stopComponentCodeIndexListeners?.()
    stopComponentCodeIndexListeners = undefined
  }
}

export default progressModule
