<template>
  <div />
</template>

<script setup lang="ts">
useHead({ title: '工作台' })

definePageMeta({
  middleware: ['auth', 'dashboard-redirect']
})
</script>
