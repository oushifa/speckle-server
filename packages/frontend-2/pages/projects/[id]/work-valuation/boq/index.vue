<template>
  <div />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

definePageMeta({
  middleware: [
    (to) => {
      return navigateTo(`/projects/${to.params.id}/work-valuation/boq/bill`, {
        replace: true
      })
    }
  ]
})

const route = useRoute()
navigateTo(`/projects/${route.params.id}/work-valuation/boq/bill`, { replace: true })
</script>
