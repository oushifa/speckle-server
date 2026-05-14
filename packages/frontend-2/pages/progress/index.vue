<template>
  <div>
    <Portal to="navigation">
      <div>数智南北</div>
    </Portal>
    <CommonDevelopingPlaceholder module-name="进度管理" />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '进度管理'
})

definePageMeta({
  middleware: ['auth']
})
</script>
