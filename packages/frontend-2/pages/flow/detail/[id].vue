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

    <!-- 无对应流程 -->
    <div
      v-else-if="!loading && !isTokenLoggingIn && !instance"
      class="flex flex-col items-center justify-center loading-stopped"
    >
      <CommonLoadingIcon class="w-8 h-8 text-primary" />
      <p
        class="mt-4 text-body-xs text-foreground-2 text-center max-w-md px-4 break-words"
      >
        未找到该流程（流程 ID：{{ instanceId }}），可能已被删除或您没有查看权限
      </p>
    </div>

    <!-- 流程存在但无对应跳转单据 -->
    <div
      v-else-if="
        !loading &&
        !isTokenLoggingIn &&
        instance &&
        !resourceRoute &&
        hasAttemptedRedirect
      "
      class="flex flex-col items-center justify-center loading-stopped"
    >
      <CommonLoadingIcon class="w-8 h-8 text-primary" />
      <p
        class="mt-4 text-body-xs text-foreground-2 text-center max-w-md px-4 break-words"
      >
        暂未配置该流程对应的单据页面（流程 ID：{{ instanceId }}）
      </p>
    </div>

    <!-- 正常加载 / 解析 Token / 跳转中 -->
    <div v-else class="flex flex-col items-center justify-center">
      <CommonLoadingIcon class="w-8 h-8 text-primary animate-spin" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { CommonLoadingIcon } from '@speckle/ui-components'
import { useAuthManager, useAuthCookie } from '~/lib/auth/composables/auth'
import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'

useHead({ title: '处理流程' })

definePageMeta({
  // 独立页面：不套用后台布局（不要顶栏 / 侧边栏），只呈现流程本身
  layout: 'empty',
  middleware: ['flow-detail-auth']
})

type FlowInstanceDetail = {
  id: string
  projectId?: string | null
  resourceType: string
  resourceId?: string | null
  formData?: Record<string, unknown> | null
}

type FlowDetailApiResponse = {
  instance?: FlowInstanceDetail | null
  binding?: unknown
  steps?: unknown[]
  actions?: unknown[]
}

const router = useRouter()
const route = useRoute()
const apiOrigin = useApiOrigin()
const { refetch: refetchActiveUser } = useActiveUser()
const { initializePermissions } = useCustomPermissions()
const authCookie = useAuthCookie()
const { loginWithToken } = useAuthManager()

enum TokenLoginStatus {
  Idle = 'idle',
  LoggingIn = 'logging-in',
  Success = 'success',
  Failed = 'failed'
}

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

const tokenLoginStatus = ref<TokenLoginStatus>(
  parseTokenInput(tokenFromQuery.value)
    ? TokenLoginStatus.LoggingIn
    : TokenLoginStatus.Idle
)
const tokenLoginError = ref('')

const isTokenLoggingIn = computed(
  () => tokenLoginStatus.value === TokenLoginStatus.LoggingIn
)

const cleanUrlToken = async () => {
  if (route.query.token) {
    const nextQuery = { ...route.query }
    delete nextQuery.token
    await router.replace({ query: nextQuery })
  }
}

const isRedirecting = ref(false)
const hasAttemptedRedirect = ref(false)

const runTokenLogin = async (inputToken: string) => {
  const token = parseTokenInput(inputToken)
  if (!token) {
    tokenLoginStatus.value = TokenLoginStatus.Failed
    tokenLoginError.value = 'URL 中的 Token 为空'
    return
  }

  // 检测原本是否存在旧 token
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

  // 检测原本是否存在旧 token 并且与新兑换的 spToken 是否属于不同账号/不同 token
  if (oldToken && oldToken !== spToken) {
    // 发生了账号切换：在将新 token 写入 Cookie 并清除 URL 中的 token query 后，
    // 直接通过 window.location.replace(cleanUrl) 进行页面刷新重载！彻底消除 SSR 旧用户 HTML 水合残留以及旧 Apollo 缓存
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

  // 如果是首登或无需整页重载的情况：
  tokenLoginStatus.value = TokenLoginStatus.Success

  // 移除 URL 中的 token，防止刷新时重复校验或凭据泄漏
  await cleanUrlToken()

  try {
    await refetchActiveUser()
    await initializePermissions(true)
    await refetch()
    await tryAutoRedirect()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('加载流程实例失败:', error)
    hasAttemptedRedirect.value = true
    isRedirecting.value = false
  }
}

onMounted(() => {
  const token = tokenFromQuery.value
  if (token) {
    void runTokenLogin(token)
  }
})

watch(tokenFromQuery, (newToken) => {
  if (newToken && tokenLoginStatus.value !== TokenLoginStatus.LoggingIn) {
    void runTokenLogin(newToken)
  }
})

const instanceId = computed(() => String(route.params.id || ''))
const queryEnabled = computed(
  () =>
    !!instanceId.value &&
    !isTokenLoggingIn.value &&
    tokenLoginStatus.value !== TokenLoginStatus.Failed
)

const instance = ref<FlowInstanceDetail | null>(null)
const loading = ref(false)
let latestFetchSeq = 0

const fetchInstanceDetail = async () => {
  const id = instanceId.value.trim()
  if (!id || !queryEnabled.value) {
    if (!id) {
      instance.value = null
    }
    loading.value = false
    return
  }

  const seq = ++latestFetchSeq
  loading.value = true
  try {
    const headers: Record<string, string> = {}
    if (authCookie.value) {
      headers.Authorization = `Bearer ${authCookie.value}`
    }

    const res = await fetch(
      `${apiOrigin}/api/approval-instances/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers,
        credentials: 'include'
      }
    )

    if (!res.ok) {
      if (seq !== latestFetchSeq) return
      instance.value = null
      return
    }

    const text = await res.text()
    const data = text ? (JSON.parse(text) as FlowDetailApiResponse | null) : null
    if (seq !== latestFetchSeq) return
    instance.value = data?.instance || null
  } catch (error) {
    if (seq !== latestFetchSeq) return
    // eslint-disable-next-line no-console
    console.error('加载流程实例失败:', error)
    instance.value = null
  } finally {
    if (seq === latestFetchSeq) {
      loading.value = false
    }
  }
}

const refetch = async () => {
  await fetchInstanceDetail()
}

watch(
  [instanceId, queryEnabled],
  ([id, isEnabled]) => {
    if (!id || !isEnabled) {
      if (!id) {
        instance.value = null
      }
      loading.value = false
      return
    }
    void fetchInstanceDetail()
  },
  { immediate: true }
)

const getFormResource = () => {
  const item = instance.value
  if (!item) return null

  const resourceId = typeof item.resourceId === 'string' ? item.resourceId.trim() : ''
  if (resourceId) {
    const separatorIndex = resourceId.indexOf(':')
    if (separatorIndex !== -1) {
      const formTable = resourceId.slice(0, separatorIndex).trim().toLowerCase()
      const formId = resourceId.slice(separatorIndex + 1).trim()
      if (formTable && formId) {
        return { formTable, formId }
      }
    }
  }

  const formData = item.formData
  if (formData && typeof formData === 'object') {
    const rawTable = (formData as Record<string, unknown>).formTable
    const rawId = (formData as Record<string, unknown>).formId
    const formTable = typeof rawTable === 'string' ? rawTable.trim().toLowerCase() : ''
    const formId =
      typeof rawId === 'string'
        ? rawId.trim()
        : typeof rawId === 'number'
        ? String(rawId)
        : ''
    if (formTable && formId) {
      return { formTable, formId }
    }
  }

  return null
}

const resourceRoute = computed(() => {
  const item = instance.value
  if (!item) return null

  if (item.resourceType === 'MODEL' && item.id) {
    return `/flow/model-approve/${item.id}`
  }

  const formResource = getFormResource()
  if (!item.projectId || !formResource) return null

  if (
    formResource.formTable === 'monthly_measurements' ||
    formResource.formTable === 'monthly_measurement'
  ) {
    return `/projects/${item.projectId}/work-valuation/monthly-measurement/${formResource.formId}/acceptance?mode=edit`
  }
  if (
    formResource.formTable === 'safety_measures' ||
    formResource.formTable === 'safety_measure'
  ) {
    return `/projects/${item.projectId}/work-valuation/safety-measure/${formResource.formId}?mode=edit`
  }
  if (
    formResource.formTable === 'boq_review_records' ||
    formResource.formTable === 'boq_reviews' ||
    formResource.formTable === 'boq_review'
  ) {
    return `/projects/${item.projectId}/work-valuation/boq-review/${formResource.formId}`
  }
  return null
})

const tryAutoRedirect = async () => {
  if (hasAttemptedRedirect.value || isRedirecting.value) return
  if (!instance.value) return

  if (tokenLoginStatus.value === TokenLoginStatus.LoggingIn) return
  if (tokenLoginStatus.value === TokenLoginStatus.Failed) return

  if (resourceRoute.value) {
    isRedirecting.value = true
    hasAttemptedRedirect.value = true
    try {
      await cleanUrlToken()
      await navigateTo(resourceRoute.value, { replace: true })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('跳转业务单据失败:', error)
      isRedirecting.value = false
    }
  } else {
    hasAttemptedRedirect.value = true
  }
}

watch(
  [
    () => instance.value,
    () => resourceRoute.value,
    () => tokenLoginStatus.value,
    () => loading.value
  ],
  ([inst, _routeVal, status, isLoading]) => {
    if (isLoading || status === TokenLoginStatus.LoggingIn) return

    if (!inst) {
      if (status === TokenLoginStatus.Success) {
        hasAttemptedRedirect.value = true
      }
      return
    }

    void tryAutoRedirect()
  },
  { immediate: true }
)
</script>

<style scoped>
.loading-stopped :deep(.spinner),
.loading-stopped :deep(.path) {
  animation: none;
}
</style>
