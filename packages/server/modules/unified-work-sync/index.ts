import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { moduleLogger } from '@/observability/logging'
import { getUnifiedWorkSyncHost } from '@/modules/shared/helpers/envHelper'

const unifiedWorkSyncModule: SpeckleModule = {
  init: async () => {
    const host = getUnifiedWorkSyncHost()
    moduleLogger.info(
      {
        enabled: Boolean(host),
        host: host || undefined
      },
      'Init unified work sync module'
    )
  }
}

export default unifiedWorkSyncModule
