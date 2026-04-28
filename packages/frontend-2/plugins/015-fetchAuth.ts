import { useAuthCookie } from '~~/lib/auth/composables/auth'

export default defineNuxtPlugin(() => {
  const apiOrigin = useApiOrigin()
  const apiBase = new URL(apiOrigin)
  const route = useRoute()
  const authToken = useAuthCookie()

  const resolveEffectiveToken = () => {
    const embedToken = route.query.embedToken
    const dashboardToken = route.query.dashboardToken
    const presentationToken = route.query.presentationToken
    const routeToken =
      (typeof dashboardToken === 'string' && dashboardToken) ||
      (typeof embedToken === 'string' && embedToken) ||
      (typeof presentationToken === 'string' && presentationToken) ||
      null

    return routeToken || authToken.value || null
  }

  const authFetch = $fetch.create({
    onRequest({ request, options }) {
      const token = resolveEffectiveToken()
      if (!token) return

      const requestUrl =
        typeof request === 'string'
          ? request
          : request instanceof URL
            ? request.toString()
            : request.url
      const resolvedUrl = new URL(requestUrl, apiBase)
      if (resolvedUrl.origin !== apiBase.origin) return

      const headers = new Headers(options.headers as HeadersInit | undefined)
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      options.headers = headers
    }
  })

  globalThis.$fetch = authFetch
})
