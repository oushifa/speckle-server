<!-- eslint-disable vue/no-v-html -->
<template>
  <form method="post" @submit="onSubmit">
    <div class="flex flex-col space-y-2">
      <FormTextInput
        v-model="email"
        type="email"
        name="email"
        label="工作邮箱"
        placeholder="邮箱"
        size="lg"
        color="foundation"
        :rules="emailRules"
        show-label
        :disabled="isEmailDisabled"
        auto-focus
        autocomplete="email"
      />
      <FormTextInput
        type="text"
        name="name"
        label="全名"
        placeholder="我的名字"
        size="lg"
        :rules="nameRules"
        color="foundation"
        show-label
        :disabled="loading"
        autocomplete="name"
      />
      <FormTextInput
        v-model="password"
        type="password"
        name="password"
        label="密码"
        placeholder="输入强密码"
        color="foundation"
        size="lg"
        :rules="passwordRules"
        show-label
        :disabled="loading"
        autocomplete="new-password"
      />
    </div>
    <AuthPasswordChecks :password="password" class="mt-2 h-12 sm:h-8" />
    <div class="mt-8 flex px-2">
      <AuthRegisterNewsletter v-model:newsletter-consent="newsletterConsent" />
    </div>
    <FormButton
      submit
      full-width
      size="lg"
      class="mt-5"
      :disabled="loading || !isMounted"
    >
      注册
    </FormButton>
    <AuthRegisterTerms v-if="serverInfo.termsOfService" :server-info="serverInfo" />
    <div v-if="!inviteEmail" class="mt-2 sm:mt-4 text-center text-body-xs">
      <span class="mr-2 text-foreground-3">已有账号？</span>
      <NuxtLink class="text-foreground" :to="finalLoginRoute">登录</NuxtLink>
    </div>
  </form>
</template>
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { isEmail, isRequired } from '~~/lib/common/helpers/validation'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { ensureError } from '@speckle/shared'
import { useAuthManager } from '~~/lib/auth/composables/auth'
import { loginRoute } from '~~/lib/common/helpers/route'
import { graphql } from '~~/lib/common/generated/gql'
import type { ServerTermsOfServicePrivacyPolicyFragmentFragment } from '~~/lib/common/generated/gql/graphql'
import { useMounted } from '@vueuse/core'
import {
  passwordRules,
  doesNotContainBlockedDomain
} from '~~/lib/auth/helpers/validation'

graphql(`
  fragment ServerTermsOfServicePrivacyPolicyFragment on ServerInfo {
    termsOfService
  }
`)

type FormValues = { email: string; password: string; name: string; company?: string }

const props = defineProps<{
  challenge: string
  serverInfo: ServerTermsOfServicePrivacyPolicyFragmentFragment
  inviteEmail?: string
}>()

const { handleSubmit } = useForm<FormValues>()
const router = useRouter()
const { signUpWithEmail, inviteToken } = useAuthManager()
const { triggerNotification } = useGlobalToast()
const isMounted = useMounted()
const isNoPersonalEmailsEnabled = useIsNoPersonalEmailsEnabled()

const newsletterConsent = defineModel<boolean>('newsletterConsent', { required: true })
const loading = ref(false)
const password = ref('')
const email = ref('')

const emailRules = computed(() =>
  inviteToken.value || !isNoPersonalEmailsEnabled.value
    ? [isEmail]
    : [isEmail, doesNotContainBlockedDomain]
)
const nameRules = [isRequired]

const isEmailDisabled = computed(() => !!props.inviteEmail?.length || loading.value)

const finalLoginRoute = computed(() => {
  const result = router.resolve({
    path: loginRoute,
    query: inviteToken.value ? { token: inviteToken.value } : {}
  })
  return result.fullPath
})

const onSubmit = handleSubmit(async (fullUser) => {
  try {
    loading.value = true
    const user = fullUser
    await signUpWithEmail({
      user,
      challenge: props.challenge,
      inviteToken: inviteToken.value,
      newsletter: newsletterConsent.value
    })
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '注册失败',
      description: `${ensureError(e).message}`
    })
  } finally {
    loading.value = false
  }
})

watch(
  () => props.inviteEmail,
  (inviteEmail) => {
    if (inviteEmail) {
      email.value = inviteEmail
    }
  },
  { immediate: true }
)
</script>
