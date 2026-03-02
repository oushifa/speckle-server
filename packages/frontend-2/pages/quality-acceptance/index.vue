<template>
  <div>
    <Portal to="navigation">
      <!-- <HeaderNavLink :to="projectsRoute" name="Projects" :separator="false" /> -->
      <div>数智南北</div>
    </Portal>
    <QualityAcceptancePage />
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
