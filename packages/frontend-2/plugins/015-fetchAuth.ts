import { useAuthCookie } from '~~/lib/auth/composables/auth'

export default defineNuxtPlugin(() => {
  const apiOrigin = useApiOrigin()
  const apiBase = new URL(apiOrigin)
  const authToken = useAuthCookie()

  const authFetch = $fetch.create({
    onRequest({ request, options }) {
      const token = authToken.value || null
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
