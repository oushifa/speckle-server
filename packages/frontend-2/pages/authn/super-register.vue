<template>
  <div class="--mx-auto w-full max-w-xl space-y-4">
    <div class="text-center space-y-2">
      <h1 class="text-heading-xl">Super Admin 注册</h1>
      <p class="text-body-sm text-foreground-2">
        仅当填写有效的
        <code>SUPER_REGISTER_TOKEN</code>
        时，此页注册账号才会成为
        <code>server:admin</code>
        。
      </p>
    </div>
    <div class="rounded border border-outline-3 p-3">
      <FormTextInput
        v-model="superRegisterToken"
        name="superRegisterToken"
        label="SUPER_REGISTER_TOKEN"
        placeholder="输入一次性密钥"
        size="lg"
        color="foundation"
        show-label
      />
    </div>
    <AuthRegisterPanel
      :super-register-token="superRegisterToken"
      :require-super-register-token="true"
    />
  </div>
</template>
<script setup lang="ts">
import { useMixpanel } from '~~/lib/core/composables/mp'

const mixpanel = useMixpanel()
const superRegisterToken = ref('')

useHead({ title: 'Super Admin 注册' })

onMounted(() => {
  mixpanel.track('Visit Super Register')
})
</script>
