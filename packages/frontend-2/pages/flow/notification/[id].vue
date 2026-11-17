<template>
  <div class="mx-auto max-w-3xl py-4">
    <Portal to="navigation">
      <div>通知详情</div>
    </Portal>

    <!-- Token 校验失败 -->
    <div
      v-if="tokenLoginStatus === TokenLoginStatus.Failed"
      class="flex flex-col items-center justify-center rounded-xl border border-outline-3 bg-foundation p-8 text-center"
    >
      <ExclamationTriangleIcon class="h-10 w-10 text-danger" />
      <h2 class="mt-3 text-heading-sm text-foreground">身份验证失败</h2>
      <p class="mt-2 max-w-md break-words text-body-sm text-foreground-2">
        {{ tokenLoginError || 'Token 验证失败，请确认凭证是否有效或已过期' }}
      </p>
      <div class="mt-6">
        <FormButton color="outline" @click="goBackToList">返回通知列表</FormButton>
      </div>
    </div>

    <!-- 加载中 / 解析 Token -->
    <div
      v-else-if="isTokenLoggingIn || loading"
      class="flex flex-col items-center justify-center rounded-xl border border-outline-3 bg-foundation p-12"
    >
      <CommonLoadingIcon class="h-8 w-8 text-primary animate-spin" />
      <p class="mt-3 text-body-sm text-foreground-2">
        {{ isTokenLoggingIn ? '正在验证访问凭证...' : '正在加载通知详情...' }}
      </p>
    </div>

    <!-- 通知不存在或无权限 -->
    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center rounded-xl border border-outline-3 bg-foundation p-8 text-center"
    >
      <BellSlashIcon class="h-10 w-10 text-foreground-2" />
      <h2 class="mt-3 text-heading-sm text-foreground">通知不存在或无权限查看</h2>
      <p class="mt-2 max-w-md break-words text-body-sm text-foreground-2">
        未找到该通知（通知 ID：{{ notificationId }}），可能已被删除或您没有查看权限
      </p>
      <div class="mt-6">
        <FormButton color="outline" @click="goBackToList">返回通知列表</FormButton>
      </div>
    </div>

    <!-- 其他加载错误 -->
    <div
      v-else-if="loadError"
      class="flex flex-col items-center justify-center rounded-xl border border-outline-3 bg-foundation p-8 text-center"
    >
      <ExclamationTriangleIcon class="h-10 w-10 text-danger" />
      <h2 class="mt-3 text-heading-sm text-foreground">加载通知详情失败</h2>
      <p class="mt-2 max-w-md break-words text-body-sm text-foreground-2">
        {{ loadError }}
      </p>
      <div class="mt-6 flex items-center gap-3">
        <FormButton color="primary" @click="loadNotificationDetail">重试</FormButton>
        <FormButton color="outline" @click="goBackToList">返回通知列表</FormButton>
      </div>
    </div>

    <!-- 通知详情卡片 -->
    <div
      v-else-if="notification"
      class="rounded-xl border border-outline-3 bg-foundation p-6 shadow-sm space-y-5"
    >
      <div
        class="flex flex-wrap items-start justify-between gap-3 border-b border-outline-3 pb-4"
      >
        <div class="space-y-2 min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-heading-md font-semibold text-foreground break-words">
              {{ notification.title || '未命名通知' }}
            </h1>
            <span
              v-if="notification.projectName"
              class="shrink-0 rounded bg-primary/10 px-2.5 py-0.5 text-body-xs font-medium text-primary"
            >
              {{ notification.projectName }}
            </span>
          </div>
          <div class="flex items-center gap-2 text-body-xs text-foreground-2">
            <ClockIcon class="h-4 w-4" />
            <span>发送时间：{{ formatDate(notification.createdAt) }}</span>
          </div>
        </div>

        <span
          class="shrink-0 rounded-full px-3 py-1 text-body-xs font-medium"
          :class="
            notification.isRead
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          "
        >
          {{ notification.isRead ? '已读' : '未读' }}
        </span>
      </div>

      <div class="rounded-lg bg-foundation-2 p-4">
        <div class="text-body-xs font-medium text-foreground-2 mb-2">通知内容</div>
        <div
          class="whitespace-pre-wrap break-words text-body-sm text-foreground leading-relaxed"
        >
          {{ notification.content || '（无详细内容）' }}
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
        <FormButton color="outline" @click="goBackToList">返回通知列表</FormButton>
        <FormButton v-if="hasTargetUrl" color="primary" @click="goToTarget">
          前往查看关联业务
        </FormButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  BellSlashIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'
import { CommonLoadingIcon } from '@speckle/ui-components'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { useAuthCookie, useAuthManager } from '~/lib/auth/composables/auth'
import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'

useHead({ title: '通知详情' })

definePageMeta({
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

const loading = ref(false)
const notFound = ref(false)
const loadError = ref('')
const notification = ref<NotificationDetail | null>(null)

const hasTargetUrl = computed(() => Boolean(notification.value?.targetUrl?.trim()))

const getAuthHeaders = (): Record<string, string> | undefined =>
  authCookie.value ? { Authorization: `Bearer ${authCookie.value}` } : undefined

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString()
}

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
  try {
    await $fetch(`${apiOrigin}/api/v1/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeaders()
    })
    if (notification.value && notification.value.id === id) {
      notification.value = {
        ...notification.value,
        isRead: true
      }
    }
  } catch {
    // 标记已读失败不影响详情展示
  }
}

const loadNotificationDetail = async () => {
  const id = notificationId.value.trim()
  if (!id) {
    notFound.value = true
    notification.value = null
    return
  }

  loading.value = true
  notFound.value = false
  loadError.value = ''

  try {
    const res = await $fetch<NotificationDetailResponse>(
      `${apiOrigin}/api/v1/notifications/${id}`,
      {
        headers: getAuthHeaders()
      }
    )
    const detail = extractNotification(res)
    if (!detail) {
      notFound.value = true
      notification.value = null
      return
    }
    notification.value = detail
    if (!detail.isRead) {
      await markNotificationAsRead(detail.id)
    }
  } catch (err) {
    const statusCode =
      (err as { statusCode?: number; status?: number; response?: { status?: number } })
        ?.statusCode ??
      (err as { status?: number })?.status ??
      (err as { response?: { status?: number } })?.response?.status
    notification.value = null
    if (statusCode === 404 || statusCode === 403) {
      notFound.value = true
    } else {
      loadError.value =
        err instanceof Error ? err.message : '获取通知详情失败，请稍后重试'
    }
  } finally {
    loading.value = false
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

  await loadNotificationDetail()
}

const goToTarget = () => {
  const url = notification.value?.targetUrl?.trim()
  if (!url) return
  if (/^https?:\/\//i.test(url)) {
    void navigateTo(url, { external: true })
    return
  }
  void navigateTo(url)
}

const goBackToList = () => {
  void navigateTo('/flow?tab=notification')
}

onMounted(() => {
  const token = tokenFromQuery.value
  if (token) {
    void runTokenLogin(token)
    return
  }
  void loadNotificationDetail()
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
    void loadNotificationDetail()
  }
})
</script>
