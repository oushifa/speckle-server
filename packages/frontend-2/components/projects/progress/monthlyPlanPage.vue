<template>
  <div class="flex flex-col gap-4 text-foreground">
    <!-- Header with Navigation Tabs -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-2 pb-3"
    >
      <div class="flex items-center gap-6">
        <h1 class="text-heading-lg">进度计划</h1>
        <div class="flex items-center border-b border-outline-2">
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-transparent text-foreground-2 hover:text-foreground"
            @click="navigateToSchedule"
          >
            总进度计划
          </button>
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-transparent text-foreground-2 hover:text-foreground"
            @click="navigateToAnnual"
          >
            年度计划
          </button>
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-primary text-primary font-semibold"
          >
            月度计划
          </button>
        </div>
      </div>
    </div>

    <!-- Monthly Plan Main View Component -->
    <ProjectsProgressMonthlyPlanComponent :project-id="projectId" />
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const navigateToSchedule = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/schedule`)
  }
}

const navigateToAnnual = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/annual`)
  }
}
</script>
