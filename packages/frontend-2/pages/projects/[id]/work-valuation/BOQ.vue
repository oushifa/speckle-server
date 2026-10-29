<template>
  <div />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

definePageMeta({
  middleware: [
    (to) => {
      const projectId = to.params.id as string
      const tab = to.query.tab
      if (tab === 'review') {
        return navigateTo(`/projects/${projectId}/work-valuation/boq/review`, {
          replace: true
        })
      }
      if (tab === 'change') {
        return navigateTo(`/projects/${projectId}/work-valuation/boq/change`, {
          replace: true
        })
      }
      return navigateTo(`/projects/${projectId}/work-valuation/boq/bill`, {
        replace: true
      })
    }
  ]
})

const route = useRoute()
const projectId = route.params.id as string
const tab = route.query.tab
if (tab === 'review') {
  navigateTo(`/projects/${projectId}/work-valuation/boq/review`, { replace: true })
} else if (tab === 'change') {
  navigateTo(`/projects/${projectId}/work-valuation/boq/change`, { replace: true })
} else {
  navigateTo(`/projects/${projectId}/work-valuation/boq/bill`, { replace: true })
}
</script>
