<template>
  <AuthRegisterPanel />
</template>
<script setup lang="ts">
import { useMixpanel } from '~~/lib/core/composables/mp'

const mixpanel = useMixpanel()

useHead({ title: '注册' })

onMounted(() => {
  mixpanel.track('Visit Sign Up')
})
</script>
