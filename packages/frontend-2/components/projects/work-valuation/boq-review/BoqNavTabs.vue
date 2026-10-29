<template>
  <div class="border-b border-outline-3 bg-foundation">
    <div class="flex items-center space-x-1 sm:space-x-2">
      <NuxtLink
        :to="`/projects/${projectId}/work-valuation/boq/bill`"
        class="px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap"
        :class="[
          activeTab === 'bill'
            ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
            : 'border-transparent text-foreground-2 hover:text-foreground hover:border-outline-2'
        ]"
      >
        <DocumentTextIcon class="w-4 h-4 shrink-0" />
        <span>清单管理</span>
      </NuxtLink>

      <NuxtLink
        :to="`/projects/${projectId}/work-valuation/boq/review`"
        class="px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap"
        :class="[
          activeTab === 'review'
            ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
            : 'border-transparent text-foreground-2 hover:text-foreground hover:border-outline-2'
        ]"
      >
        <ClipboardDocumentCheckIcon class="w-4 h-4 shrink-0" />
        <span>复核工程量管理</span>
      </NuxtLink>

      <NuxtLink
        :to="`/projects/${projectId}/work-valuation/boq/change`"
        class="px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap"
        :class="[
          activeTab === 'change'
            ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-md'
            : 'border-transparent text-foreground-2 hover:text-foreground hover:border-outline-2'
        ]"
      >
        <ArrowPathRoundedSquareIcon class="w-4 h-4 shrink-0" />
        <span>签证变更管理</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathRoundedSquareIcon
} from '@heroicons/vue/24/outline'

defineProps<{
  projectId: string
  activeTab: 'bill' | 'review' | 'change'
}>()
</script>
