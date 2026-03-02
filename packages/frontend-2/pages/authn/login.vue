<template>
  <AuthLoginPanel />
</template>
<script setup lang="ts">
import { useMixpanel } from '~~/lib/core/composables/mp'

const mixpanel = useMixpanel()

useHead({ title: '登录' })

onMounted(() => {
  mixpanel.track('Visit Log In')
})

definePageMeta({
  name: 'login'
})
</script>
