<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foundation">
    <!-- Token 校验失败 -->
    <div
      v-if="tokenLoginStatus === TokenLoginStatus.Failed"
      class="flex flex-col items-center justify-center loading-stopped"
    >
      <CommonLoadingIcon class="w-8 h-8 text-primary" />
      <p
        class="mt-4 text-body-xs text-foreground-2 text-center max-w-md px-4 break-words"
      >
        {{ tokenLoginError || 'Token 验证失败，请确认凭证是否有效或已过期' }}
      </p>
    </div>

    <!-- 通知不存在或无权限 -->
    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center loading-stopped"
    >
      <CommonLoadingIcon class="w-8 h-8 text-primary" />
      <p
        class="mt-4 text-body-xs text-foreground-2 text-center max-w-md px-4 break-words"
      >
        未找到该通知（通知 ID：{{ notificationId }}），可能已被删除或您没有查看权限
      </p>
    </div>

    <!-- 请求 / 标记已读 / 跳转失败 -->
    <div
      v-else-if="loadError"
      class="flex flex-col items-center justify-center loading-stopped"
    >
      <CommonLoadingIcon class="w-8 h-8 text-primary" />
      <p
        class="mt-4 text-body-xs text-foreground-2 text-center max-w-md px-4 break-words"
      >
        {{ loadError }}
      </p>
    </div>

    <!-- 通知未配置关联业务跳转地址 -->
    <div
      v-else-if="missingTargetUrl"
      class="flex flex-col items-center justify-center loading-stopped"
    >
      <CommonLoadingIcon class="w-8 h-8 text-primary" />
      <p
        class="mt-4 text-body-xs text-foreground-2 text-center max-w-md px-4 break-words"
      >
        该通知未配置关联业务跳转地址（通知 ID：{{ notificationId }}）
      </p>
    </div>

    <!-- 正常加载 / Token 校验 / 标记已读 / 跳转中 -->
    <div v-else class="flex flex-col items-center justify-center">
      <CommonLoadingIcon class="w-8 h-8 text-primary animate-spin" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { CommonLoadingIcon } from '@speckle/ui-components'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { useAuthCookie, useAuthManager } from '~/lib/auth/composables/auth'
import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'

useHead({ title: '通知详情' })

definePageMeta({
  // 独立中转页面：不套用后台布局（不要顶栏 / 侧边栏），支持第三方免登后标记已读并跳转
  layout: 'empty',
  middleware: ['flow-detail-auth']
})

type NotificationDetail = {
  id: string
  userId?: string
  projectId?: string
  title: string
  content: string
  targetUrl?: string | null
  isRead: boolean
  createdAt: string
  updatedAt?: string
  projectName?: string | null
}

type NotificationDetailResponse =
  | NotificationDetail
  | {
      item?: NotificationDetail | null
      notification?: NotificationDetail | null
      data?: NotificationDetail | null
    }

enum TokenLoginStatus {
  Idle = 'idle',
  LoggingIn = 'logging-in',
  Success = 'success',
  Failed = 'failed'
}

const router = useRouter()
const route = useRoute()
const apiOrigin = useApiOrigin()
const authCookie = useAuthCookie()
const { loginWithToken } = useAuthManager()
const { refetch: refetchActiveUser } = useActiveUser()
const { initializePermissions } = useCustomPermissions()

const parseTokenInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('://')) return trimmed

  try {
    const parsedUrl = new URL(trimmed)
    return parsedUrl.searchParams.get('token')?.trim() || trimmed
  } catch {
    return trimmed
  }
}

const tokenFromQuery = computed(() => {
  const token = route.query.token
  if (Array.isArray(token)) return token[0] || ''
  return (token as string) || ''
})

const notificationId = computed(() => String(route.params.id || ''))

const tokenLoginStatus = ref<TokenLoginStatus>(
  parseTokenInput(tokenFromQuery.value)
    ? TokenLoginStatus.LoggingIn
    : TokenLoginStatus.Idle
)
const tokenLoginError = ref('')

const isTokenLoggingIn = computed(
  () => tokenLoginStatus.value === TokenLoginStatus.LoggingIn
)

const notFound = ref(false)
const loadError = ref('')
const missingTargetUrl = ref(false)
let latestProcessSeq = 0

const getAuthHeaders = (): Record<string, string> | undefined =>
  authCookie.value ? { Authorization: `Bearer ${authCookie.value}` } : undefined

const cleanUrlToken = async () => {
  if (route.query.token) {
    const nextQuery = { ...route.query }
    delete nextQuery.token
    await router.replace({ query: nextQuery })
  }
}

const extractNotification = (
  res: NotificationDetailResponse | null | undefined
): NotificationDetail | null => {
  if (!res || typeof res !== 'object') return null
  if ('id' in res && typeof res.id === 'string') return res
  if ('item' in res && res.item) return res.item
  if ('notification' in res && res.notification) return res.notification
  if ('data' in res && res.data) return res.data
  return null
}

const markNotificationAsRead = async (id: string) => {
  await $fetch(`${apiOrigin}/api/v1/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PUT',
    headers: getAuthHeaders()
  })
}

const processNotificationAndRedirect = async () => {
  const id = notificationId.value.trim()
  const seq = ++latestProcessSeq
  notFound.value = false
  loadError.value = ''
  missingTargetUrl.value = false

  if (!id) {
    notFound.value = true
    return
  }

  let detail: NotificationDetail | null = null
  try {
    const res = await $fetch<NotificationDetailResponse>(
      `${apiOrigin}/api/v1/notifications/${encodeURIComponent(id)}`,
      {
        headers: getAuthHeaders()
      }
    )
    if (seq !== latestProcessSeq) return
    detail = extractNotification(res)
    if (!detail) {
      notFound.value = true
      return
    }
  } catch (err) {
    if (seq !== latestProcessSeq) return
    const statusCode =
      (
        err as {
          statusCode?: number
          status?: number
          response?: { status?: number }
        }
      )?.statusCode ??
      (err as { status?: number })?.status ??
      (err as { response?: { status?: number } })?.response?.status
    if (statusCode === 404 || statusCode === 403) {
      notFound.value = true
    } else {
      loadError.value =
        err instanceof Error ? err.message : '获取通知详情失败，请稍后重试'
    }
    return
  }

  if (!detail.isRead) {
    try {
      await markNotificationAsRead(detail.id)
    } catch (err) {
      if (seq !== latestProcessSeq) return
      // eslint-disable-next-line no-console
      console.error('标记通知已读失败:', err)
      loadError.value =
        err instanceof Error ? err.message : '标记通知已读失败，请稍后重试'
      return
    }
    if (seq !== latestProcessSeq) return
  }

  const targetUrl = detail.targetUrl?.trim()
  if (!targetUrl) {
    missingTargetUrl.value = true
    return
  }

  try {
    await cleanUrlToken()
    if (/^https?:\/\//i.test(targetUrl)) {
      await navigateTo(targetUrl, { external: true, replace: true })
    } else {
      await navigateTo(targetUrl, { replace: true })
    }
  } catch (err) {
    if (seq !== latestProcessSeq) return
    // eslint-disable-next-line no-console
    console.error('跳转关联业务页面失败:', err)
    loadError.value =
      err instanceof Error ? err.message : '跳转关联业务页面失败，请稍后重试'
  }
}

const runTokenLogin = async (inputToken: string) => {
  const token = parseTokenInput(inputToken)
  if (!token) {
    tokenLoginStatus.value = TokenLoginStatus.Failed
    tokenLoginError.value = 'URL 中的 Token 为空'
    return
  }

  const oldToken = authCookie.value

  tokenLoginStatus.value = TokenLoginStatus.LoggingIn
  tokenLoginError.value = ''

  const requestHeaders = new Headers()
  requestHeaders.append('Content-Type', 'application/json')
  const requestBody = JSON.stringify({ token })
  const loginUrl = new URL('/auth/sso/token-login', apiOrigin).toString()

  let spToken: string | undefined
  try {
    const ssoResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody,
      redirect: 'follow'
    }).then((res) => res.json())

    spToken = ssoResponse.token as string | undefined
    if (!spToken) {
      tokenLoginStatus.value = TokenLoginStatus.Failed
      tokenLoginError.value =
        ssoResponse.err ||
        ssoResponse.message ||
        'Token 验证失败，请检查 token 是否正确'
      return
    }

    await loginWithToken({
      token: spToken,
      skipRedirect: true
    })
  } catch (error) {
    tokenLoginStatus.value = TokenLoginStatus.Failed
    tokenLoginError.value =
      error instanceof Error ? error.message : '网络异常，请稍后重试'
    return
  }

  if (oldToken && oldToken !== spToken) {
    if (import.meta.client) {
      let cleanUrl = window.location.pathname
      const searchParams = new URLSearchParams(window.location.search)
      searchParams.delete('token')
      const queryString = searchParams.toString()
      if (queryString) {
        cleanUrl += `?${queryString}`
      }
      if (window.location.hash) {
        cleanUrl += window.location.hash
      }
      window.location.replace(cleanUrl)
      return
    }
  }

  tokenLoginStatus.value = TokenLoginStatus.Success
  await cleanUrlToken()

  try {
    await refetchActiveUser()
    await initializePermissions(true)
  } catch {
    // ignore permission refresh error and proceed to fetch notification detail
  }

  await processNotificationAndRedirect()
}

onMounted(() => {
  const token = tokenFromQuery.value
  if (token) {
    void runTokenLogin(token)
    return
  }
  void processNotificationAndRedirect()
})

watch(tokenFromQuery, (newToken) => {
  if (newToken && tokenLoginStatus.value !== TokenLoginStatus.LoggingIn) {
    void runTokenLogin(newToken)
  }
})

watch(notificationId, (newId, oldId) => {
  if (
    newId &&
    newId !== oldId &&
    !isTokenLoggingIn.value &&
    tokenLoginStatus.value !== TokenLoginStatus.Failed
  ) {
    void processNotificationAndRedirect()
  }
})
</script>

<style scoped>
.loading-stopped :deep(.spinner),
.loading-stopped :deep(.path) {
  animation: none;
}
</style>
