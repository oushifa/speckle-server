<template>
  <div>
    <Portal to="navigation">
      <!-- <HeaderNavLink :to="projectsRoute" name="Projects" :separator="false" /> -->
      <div>数智南北</div>
    </Portal>
    <ArchivesPage />
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
