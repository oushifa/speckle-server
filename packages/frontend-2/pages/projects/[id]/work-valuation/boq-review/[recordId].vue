<template>
  <div
    class="flex flex-col h-[calc(100vh-130px)] max-h-[calc(100vh-130px)] overflow-hidden"
  >
    <BoqReviewDetailPage :project-id="projectId" :record-id="recordId" :kind="kind" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BoqReviewDetailPage from '~/components/projects/work-valuation/boq-review/BoqReviewDetailPage.vue'
import type { ReviewKind } from '~/components/projects/work-valuation/boq-review/boqReviewTypes'

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const recordId = computed(() => route.params.recordId as string)
const kind = computed<ReviewKind>(() => {
  return (route.query.kind as ReviewKind) || 'review'
})
</script>
