<template>
  <div>
    <Portal to="navigation">
      <div>数智南北</div>
    </Portal>
    <ConvertFilesPage />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '文件转换'
})

definePageMeta({
  middleware: ['auth']
})
</script>
