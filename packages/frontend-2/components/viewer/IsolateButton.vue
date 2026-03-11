<template>
  <div v-tippy="getTooltipProps(isIsolated ? '非隔离' : '隔离')">
    <FormButton
      color="subtle"
      size="sm"
      :icon-left="isIsolated ? FunnelX : Funnel"
      hide-text
      @click.stop="$emit('click', $event)"
    >
      {{ isIsolated ? '非隔离' : '隔离' }}
    </FormButton>
  </div>
</template>

<script setup lang="ts">
import { FunnelX, Funnel } from 'lucide-vue-next'

defineProps<{
  isIsolated: boolean
  forceVisible?: boolean
}>()

const { getTooltipProps } = useSmartTooltipDelay()

defineEmits<{
  click: [event: Event]
}>()
</script>
