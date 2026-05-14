<template>
  <div>
    <Portal to="navigation">
      <div>数智南北</div>
    </Portal>
    <CommonDevelopingPlaceholder module-name="质量验收" />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '质量验收'
})

definePageMeta({
  middleware: ['auth']
})
</script>
