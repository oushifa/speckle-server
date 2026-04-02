<template>
  <form method="post" @submit.prevent="onSubmit">
    <div class="flex flex-col gap-4">
      <h1 class="text-heading-xl text-center mb-2">第三方 Token 登录</h1>

      <FormTextInput
        v-model="currentToken"
        type="text"
        name="token"
        label="URL Token"
        placeholder="/authn/token-login?token=xxx"
        size="lg"
        color="foundation"
        :loading="isLoadingState"
        :help="helpText"
        :custom-error-message="errorMessage"
        show-label
        :disabled="isLoadingState"
      />

      <div class="rounded-lg border border-outline-3 p-4">
        <div class="flex items-center justify-between">
          <div class="text-body-xs text-foreground-2">当前状态</div>
          <div class="text-body-2xs px-2 py-0.5 rounded" :class="statusTagClass">
            {{ statusTagText }}
          </div>
        </div>
        <div class="text-body-sm mt-2 text-foreground">{{ statusMessage }}</div>
      </div>

      <div class="rounded-lg border border-outline-3 p-4">
        <div class="text-body-xs text-foreground-2">全局 Token 存储</div>
        <div class="mt-2 grid grid-cols-1 gap-2">
          <div class="flex items-center justify-between">
            <span class="text-body-xs text-foreground-2">oaToken</span>
            <span class="text-body-xs text-foreground">
              {{ maskedOaToken || '未写入' }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-body-xs text-foreground-2">spToken</span>
            <span class="text-body-xs text-foreground">
              {{ maskedSpToken || '未写入' }}
            </span>
          </div>
        </div>
      </div>

      <div class="mt-8 space-y-4">
        <FormButton
          v-if="state !== LoginState.Success"
          size="lg"
          submit
          full-width
          :loading="isLoadingState"
          :disabled="!canSubmit"
        >
          {{ submitText }}
        </FormButton>
        <FormButton v-else size="lg" full-width :to="homeRoute">进入首页</FormButton>
        <FormButton size="lg" color="subtle" full-width :to="loginRoute">
          返回登录页
        </FormButton>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { homeRoute, loginRoute } from '~/lib/common/helpers/route'
import { useAuthManager, useThirdPartyTokenState } from '~/lib/auth/composables/auth'

enum LoginState {
  TokenChecking = 'token-checking',
  SigningIn = 'signing-in',
  Success = 'success',
  Invalid = 'invalid',
  Missing = 'missing'
}

const route = useRoute()
const { loginWithToken } = useAuthManager()
const {
  oaToken: oaTokenState,
  spToken: spTokenState,
  oaUser: oaUserState
} = useThirdPartyTokenState()

const state = ref<LoginState>(LoginState.TokenChecking)
const currentToken = ref('')
const errorDetails = ref('')

const tokenFromQuery = computed(() => {
  const token = route.query.token
  if (Array.isArray(token)) return token[0] || ''
  return token || ''
})

const maskedToken = computed(() => {
  const token = currentToken.value.trim()
  if (!token) return ''
  if (token.length <= 8) return `${token.slice(0, 2)}***`
  return `${token.slice(0, 4)}***${token.slice(-2)}`
})

const maskStoredToken = (token: string | null) => {
  if (!token) return ''
  if (token.length <= 8) return `${token.slice(0, 2)}***`
  return `${token.slice(0, 4)}***${token.slice(-2)}`
}

const maskedOaToken = computed(() => maskStoredToken(oaTokenState.value))
const maskedSpToken = computed(() => maskStoredToken(spTokenState.value))

const isLoadingState = computed(
  () => state.value === LoginState.TokenChecking || state.value === LoginState.SigningIn
)

const hasToken = computed(() => !!currentToken.value.trim())
const canSubmit = computed(() => hasToken.value && !isLoadingState.value)

const statusTagText = computed(() => {
  if (state.value === LoginState.TokenChecking) return 'Token 检测中'
  if (state.value === LoginState.SigningIn) return '等待登录'
  if (state.value === LoginState.Success) return '登录成功'
  if (state.value === LoginState.Invalid) return 'Token 无效'
  return '缺少 Token'
})

const statusTagClass = computed(() => {
  if (state.value === LoginState.Success) return 'bg-success-muted text-success'
  if (state.value === LoginState.Invalid) return 'bg-danger-muted text-danger'
  if (state.value === LoginState.Missing) return 'bg-warning-muted text-warning'
  return 'bg-primary-muted text-primary'
})

const helpText = computed(() => {
  if (state.value === LoginState.TokenChecking) return '正在检查 token 有效性'
  if (state.value === LoginState.SigningIn) return 'token 校验通过，正在登录'
  if (state.value === LoginState.Success)
    return `已识别 token：${maskedToken.value}，并写入全局状态`
  return '从 URL query 自动读取 token，也支持手动修改后重试'
})

const errorMessage = computed(() => {
  if (state.value === LoginState.Invalid)
    return errorDetails.value || 'Token 无效，请检查 token 是否正确'
  if (state.value === LoginState.Missing) return '缺少 token，请通过 URL query 传入'
  return undefined
})

const submitText = computed(() => {
  if (state.value === LoginState.TokenChecking) return 'Token 检测中...'
  if (state.value === LoginState.SigningIn) return '等待登录...'
  return '重新检测 Token'
})

const statusMessage = computed(() => {
  if (state.value === LoginState.TokenChecking) return '正在检查 token 格式与可用性'
  if (state.value === LoginState.SigningIn)
    return 'oaToken 已获取，正在交换 spToken 并完成登录'
  if (state.value === LoginState.Success) return '登录已完成，你可以继续进入系统'
  if (state.value === LoginState.Invalid) return errorDetails.value || 'token 校验失败'
  return '请通过 /authn/token-login?token=xxx 方式访问此页面'
})

const runTokenLogin = async () => {
  const token = currentToken.value.trim()
  currentToken.value = token
  errorDetails.value = ''

  if (!token) {
    state.value = LoginState.Missing
    oaTokenState.value = null
    spTokenState.value = null
    return
  }

  state.value = LoginState.TokenChecking
  const requestHeaders = new Headers()
  requestHeaders.append('Content-Type', 'application/json')
  const withNewUser = true

  const requestBody = JSON.stringify({
    ['with_new_user']: withNewUser,
    client: 'shangkan',
    token
  })

  try {
    const oaResponse = await fetch('http://47.100.77.97:64487/api/login/other', {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody,
      redirect: 'follow'
    }).then((response) => response.json())

    const oaToken = oaResponse.msg?.token as string | undefined
    if (!(oaResponse.ret === 0 && oaToken)) {
      oaTokenState.value = null
      spTokenState.value = null
      state.value = LoginState.Invalid
      errorDetails.value = oaResponse.msg || 'OA token 获取失败'
      return
    }

    oaTokenState.value = oaToken
    oaUserState.value = oaResponse.msg?.user || null
    state.value = LoginState.SigningIn

    const authorizationHeaders = new Headers()
    authorizationHeaders.append('Authorization', `Bearer ${oaToken}`)
    const spResponse = await fetch('http://47.100.77.97:64487/api/getcode', {
      method: 'GET',
      headers: authorizationHeaders
    }).then((response) => response.json())

    const spToken = spResponse.msg?.token as string | undefined
    if (!(spResponse.ret === 0 && spToken)) {
      spTokenState.value = null
      state.value = LoginState.Invalid
      errorDetails.value = spResponse.msg || 'SP token 获取失败'
      return
    }

    await loginWithToken({
      token: spToken,
      oaToken,
      oaUser: oaUserState.value,
      skipRedirect: false
    })
    state.value = LoginState.Success
  } catch (error) {
    oaTokenState.value = null
    spTokenState.value = null
    state.value = LoginState.Invalid
    errorDetails.value = error instanceof Error ? error.message : '网络异常，请稍后重试'
  }
}

const onSubmit = async () => {
  if (!canSubmit.value) return
  await runTokenLogin()
}

watch(
  tokenFromQuery,
  async (token) => {
    currentToken.value = token.trim()
    await runTokenLogin()
  },
  { immediate: true }
)
</script>
