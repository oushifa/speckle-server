<template>
  <div>
    <Portal to="navigation">
      <div>流程测试</div>
    </Portal>
    <FlowTest />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '流程测试'
})

definePageMeta({
  middleware: ['auth']
})
</script>
