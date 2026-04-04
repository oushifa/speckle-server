<template>
  <div>
    <Portal to="navigation">
      <div>流程审核</div>
    </Portal>
    <FlowPage />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '流程审核'
})

definePageMeta({
  middleware: ['auth']
})
</script>
