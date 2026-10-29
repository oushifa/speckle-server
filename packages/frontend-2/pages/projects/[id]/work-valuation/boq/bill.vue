<template>
  <div>
    <Portal to="current-page">
      <div class="flex items-center space-x-1.5 text-xs text-foreground-2">
        <NuxtLink :to="`/projects/${projectId}/work-valuation/boq/bill`">
          验工计价
        </NuxtLink>
        <span>/</span>
        <span class="text-foreground">清单管理</span>
      </div>
    </Portal>
    <ProjectsWorkValuationBOQPage />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const projectId = computed(() => route.params.id as string)
</script>
