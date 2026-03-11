<template>
  <FormButton
    size="sm"
    color="outline"
    class="pointer-events-auto"
    @click="trackAndResetFilters"
  >
    重置所有筛选器
  </FormButton>
</template>
<script setup lang="ts">
import { useFilterUtilities } from '~/lib/viewer/composables/filtering/filtering'

const { resetFilters } = useFilterUtilities()

const trackAndResetFilters = () => {
  resetFilters()
}
</script>
