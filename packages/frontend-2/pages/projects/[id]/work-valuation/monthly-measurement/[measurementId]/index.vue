<script setup lang="ts">
const route = useRoute()
navigateTo(`/projects/${route.params.id}/work-valuation/monthly-measurement/${route.params.measurementId}/acceptance`, { replace: true })
</script>
<template>
  <div />
</template>
