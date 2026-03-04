<template>
  <AuthPasswordResetFinalizationPanel :token="token" />
</template>
<script setup lang="ts">
const route = useRoute()
const token = ref('')

useHead({
  title: '重置密码'
})

definePageMeta({
  name: 'reset-password'
})

onMounted(() => {
  if (route.query.token) {
    token.value = route.query.token as string
  }
})
</script>
