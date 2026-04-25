<template>
  <div class="--mx-auto w-full max-w-xl space-y-4">
    <div class="text-center space-y-2">
      <h1 class="text-heading-xl">Super Admin 注册</h1>
      <p class="text-body-sm text-foreground-2">
        仅当填写有效的
        <code>SUPER_REGISTER_TOKEN</code>
        时才允许创建
        <code>server:admin</code>
        账号。
      </p>
    </div>
    <form class="rounded border border-outline-3 p-3 space-y-3" @submit="onSubmit">
      <FormTextInput
        v-model="superRegisterToken"
        name="superRegisterToken"
        label="SUPER_REGISTER_TOKEN"
        placeholder="输入一次性密钥"
        size="lg"
        color="foundation"
        show-label
      />
      <FormTextInput
        v-model="email"
        name="email"
        label="账号"
        placeholder="账号"
        size="lg"
        color="foundation"
        show-label
      />
      <FormTextInput
        v-model="name"
        name="name"
        label="全名"
        placeholder="我的名字"
        size="lg"
        :rules="[isRequired]"
        color="foundation"
        show-label
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
      />
      <AuthPasswordChecks :password="password" class="h-12 sm:h-8" />
      <p v-if="errorMessage" class="text-danger text-body-sm">{{ errorMessage }}</p>
      <FormButton submit full-width size="lg" :disabled="loading || !isMounted">
        注册 Super Admin
      </FormButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { useMixpanel } from '~~/lib/core/composables/mp'
import { useAuthManager, useLoginOrRegisterUtils } from '~~/lib/auth/composables/auth'
import { ensureError } from '@speckle/shared'
import { isRequired } from '~~/lib/common/helpers/validation'
import { passwordRules } from '~~/lib/auth/helpers/validation'
import { useMounted } from '@vueuse/core'

const mixpanel = useMixpanel()
const { signUpWithEmail } = useAuthManager()
const { challenge } = useLoginOrRegisterUtils()
const { handleSubmit } = useForm<{ email: string; password: string; name: string }>()
const isMounted = useMounted()

const superRegisterToken = ref('')
const email = ref('')
const password = ref('')
const name = ref('')
const loading = ref(false)
const errorMessage = ref('')

useHead({ title: 'Super Admin 注册' })

const onSubmit = handleSubmit(async () => {
  try {
    loading.value = true
    errorMessage.value = ''
    await signUpWithEmail({
      user: {
        email: email.value,
        password: password.value,
        name: name.value
      },
      challenge: challenge.value,
      superRegisterToken: superRegisterToken.value,
      superRegisterOnly: true
    })
  } catch (e) {
    errorMessage.value = '注册失败'
    mixpanel.track('Super Register Failed', {
      reason: ensureError(e).message
    })
  } finally {
    loading.value = false
  }
})

onMounted(() => {
  mixpanel.track('Visit Super Register')
})
</script>
