import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { getUnifiedWorkSyncHost } from '@/modules/shared/helpers/envHelper'

const unifiedWorkSyncLogger = moduleLogger.child({
  module: 'unified-work-sync'
})

const unifiedWorkSyncModule: SpeckleModule = {
  init: async () => {
    const host = getUnifiedWorkSyncHost()
    unifiedWorkSyncLogger.info(
      {
        enabled: Boolean(host),
        host: host || undefined
      },
      '[WORK_SYNC] Init unified work sync module'
    )
  }
}

export default unifiedWorkSyncModule
