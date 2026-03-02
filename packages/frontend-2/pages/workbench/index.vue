<template>
  <div>
    <Portal to="navigation">
      <!-- <HeaderNavLink :to="projectsRoute" name="Projects" :separator="false" /> -->
      <div>数智南北</div>
    </Portal>
    <WorkbenchPage />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '工作台'
})

definePageMeta({
  middleware: ['auth']
})
</script>
