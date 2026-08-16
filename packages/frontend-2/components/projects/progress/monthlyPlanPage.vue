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
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-primary text-primary font-semibold"
          >
            月度计划
          </button>
        </div>
      </div>
    </div>

    <!-- Monthly Plan Main View Component -->
    <ProjectsProgressMonthlyPlanComponent
      :project-id="projectId"
      :master-tasks="masterTaskOptions"
    />
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import type { MasterTaskOption } from './TaskSelectDialog.vue'
import { getProgressPlanTasks } from '~/lib/projects/api/progress'

const route = useRoute()
const router = useRouter()

const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const masterTaskOptions = ref<MasterTaskOption[]>([
  {
    id: '1-1-1-1',
    taskName: '路基土方开挖',
    level: 3,
    hasChildren: false,
    parentId: '1-1-1',
    volume: '120000',
    unit: 'm³',
    startDate: '2025-01-01',
    endDate: '2025-03-01'
  },
  {
    id: '1-1-1-2',
    taskName: '路基填筑压实',
    level: 3,
    hasChildren: false,
    parentId: '1-1-1',
    volume: '95000',
    unit: 'm³',
    startDate: '2025-03-02',
    endDate: '2025-05-30'
  },
  {
    id: '1-3-1-1',
    taskName: '桩基施工',
    level: 3,
    hasChildren: false,
    parentId: '1-3-1',
    volume: '350',
    unit: '根',
    startDate: '2025-01-01',
    endDate: '2025-03-31'
  }
])

const navigateToSchedule = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/schedule`)
  }
}

const apiOrigin = useApiOrigin()

onMounted(async () => {
  if (!projectId.value) return
  try {
    const tasks = await getProgressPlanTasks({ projectId: projectId.value, apiOrigin })
    if (tasks && tasks.length) {
      const parentIdSet = new Set(tasks.map((t) => t.parentId).filter(Boolean))
      masterTaskOptions.value = tasks.map((t) => ({
        id: t.id,
        taskName: t.taskName,
        level: t.level || 0,
        hasChildren: t.hasChildren || parentIdSet.has(t.id),
        parentId: t.parentId || undefined,
        volume: t.quantity || undefined,
        unit: t.unit || undefined,
        startDate: t.startDate || '',
        endDate: t.endDate || ''
      }))
    }
  } catch (e) {
    // fallback to initial mock list
  }
})
</script>
