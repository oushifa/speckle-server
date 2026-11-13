import { getFeatureFlags } from '@/modules/shared/helpers/envHelper'
import type { SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { getSavedViewsRouter } from '@/modules/viewer/rest/savedViews'
import { getSplitScreenConfigsRouter } from '@/modules/viewer/rest/splitScreenConfigs'
import { getViewerCatalogsRouter } from '@/modules/viewer/rest/viewerCatalogs'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { publish } from '@/modules/shared/utils/subscriptions'
import { reportSubscriptionEventsFactory } from '@/modules/viewer/events/subscriptionListeners'
import { viewerLogger } from '@/observability/logging'

const viewerModule: SpeckleModule = {
  init: async ({ app, isInitial }) => {
    viewerLogger.info('🤩 Initializing viewer module...')
    app.use(getSplitScreenConfigsRouter())
    app.use(getViewerCatalogsRouter())

    if (getFeatureFlags().FF_SAVED_VIEWS_ENABLED) {
      app.use(getSavedViewsRouter())

      if (isInitial) {
        reportSubscriptionEventsFactory({
          listen: getEventBus().listen,
          publish
        })()
      }
    }
  }
}

export default viewerModule
