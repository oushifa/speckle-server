<template>
  <div class="flex-1 flex flex-col gap-6 items-center justify-center">
    <IllustrationEmptystateFiltersTab />
    <div class="text-foreground-2 text-heading-sm mt-2">暂无筛选器</div>
    <FormButton color="outline" @click="$emit('addFilter')">添加筛选器</FormButton>
  </div>
</template>

<script setup lang="ts">
import { FormButton } from '@speckle/ui-components'

defineEmits<{
  addFilter: []
}>()
</script>
