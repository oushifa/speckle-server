<template>
  <AuthTokenLoginPanel />
</template>

<script setup lang="ts">
import { useMixpanel } from '~~/lib/core/composables/mp'

const mixpanel = useMixpanel()

useHead({
  title: 'SSO Token 登录'
})

onMounted(() => {
  mixpanel.track('Visit Log In - Token')
})

definePageMeta({
  name: 'token-login'
})
</script>
