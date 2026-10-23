import { activeUserQuery } from '~~/lib/auth/composables/activeUser'
import { usePostAuthRedirect } from '~~/lib/auth/composables/postAuthRedirect'
import { useApolloClientFromNuxt } from '~~/lib/common/composables/graphql'
import { convertThrowIntoFetchResult } from '~~/lib/common/helpers/graphql'
import { loginRoute } from '~~/lib/common/helpers/route'

/**
 * 流程详情页权限中间件：
 * 若 URL query 中携带 token（第三方免登），放行由页面自身执行 Token 登录；
 * 否则进行标准的登录态校验，未登录则跳转至登录页。
 */
export default defineParallelizedNuxtRouteMiddleware(async (to) => {
  const rawToken = to.query.token
  const hasToken =
    Boolean(typeof rawToken === 'string' && rawToken.trim()) ||
    Boolean(Array.isArray(rawToken) && rawToken[0]?.trim())

  if (hasToken) {
    return
  }

  const nuxt = useNuxtApp()
  const client = useApolloClientFromNuxt()
  const postAuthRedirect = usePostAuthRedirect({ route: to })

  const isAccessCodeReq = !!to.query?.access_code
  const isBasicHomepage = to.path === '/' && !Object.keys(to.query).length
  const savePostAuthRedirect = !isAccessCodeReq && !isBasicHomepage

  const { data } = await client
    .query({
      query: activeUserQuery
    })
    .catch(convertThrowIntoFetchResult)

  // Redirect to login if not logged in
  if (!data?.activeUser?.id) {
    if (import.meta.server && nuxt.ssrContext?.event.node.req.method === 'OPTIONS') {
      return
    }

    if (savePostAuthRedirect) {
      postAuthRedirect.set(to.fullPath)
      return navigateTo(loginRoute)
    } else {
      return navigateTo({ path: loginRoute, query: to.query })
    }
  }
})
