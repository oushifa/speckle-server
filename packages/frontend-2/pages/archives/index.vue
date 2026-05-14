<template>
  <div>
    <Portal to="navigation">
      <div>数智南北</div>
    </Portal>
    <CommonDevelopingPlaceholder module-name="档案管理" />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '档案管理'
})

definePageMeta({
  middleware: ['auth']
})
</script>
