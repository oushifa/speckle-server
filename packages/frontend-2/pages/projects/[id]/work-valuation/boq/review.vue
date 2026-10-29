<template>
  <div class="flex min-w-0 flex-col gap-4">
    <!-- 面包屑导航 -->
    <Portal to="current-page">
      <div class="flex items-center space-x-1.5 text-xs text-foreground-2">
        <NuxtLink :to="`/projects/${projectId}/work-valuation/boq/bill`">
          验工计价
        </NuxtLink>
        <span>/</span>
        <span class="text-foreground">复核工程量管理</span>
      </div>
    </Portal>

    <!-- 顶部 3-Tab 导航 -->
    <BoqNavTabs :project-id="projectId" active-tab="review" />

    <!-- 复核工程量管理列表 -->
    <BoqReviewList :project-id="projectId" kind="review" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BoqNavTabs from '~/components/projects/work-valuation/boq-review/BoqNavTabs.vue'
import BoqReviewList from '~/components/projects/work-valuation/boq-review/BoqReviewList.vue'

const route = useRoute()
const projectId = computed(() => route.params.id as string)
</script>
