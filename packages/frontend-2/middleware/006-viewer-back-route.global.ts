import { useViewerBackRoute } from '~/lib/viewer/composables/backRoute'

const MODEL_VIEWER_ROUTE_NAME = 'model-viewer'

/**
 * Records the page the user came from when they open the model viewer, so the viewer's
 * back button can return there. Hash-only navigations inside the viewer keep the same
 * route name and must not overwrite the remembered entry page.
 */
export default defineParallelizedNuxtRouteMiddleware((to, from) => {
  if (to.name !== MODEL_VIEWER_ROUTE_NAME) return

  // `from.name` is undefined on the very first (server/initial) navigation, which means
  // there's no in-app page to go back to
  if (!from.name || from.name === MODEL_VIEWER_ROUTE_NAME) return

  useViewerBackRoute().value = from.fullPath
})
