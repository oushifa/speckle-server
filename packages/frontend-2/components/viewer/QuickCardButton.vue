<template>
  <div v-tippy="getTooltipProps('快捷卡片')">
    <FormButton
      color="subtle"
      size="sm"
      hide-text
      :class="{
        '!bg-highlight-3': active
      }"
      :icon-left="CreditCard"
      @click.stop="$emit('click', $event)"
    >
      快捷卡片
    </FormButton>
  </div>
</template>

<script setup lang="ts">
import { CreditCard } from 'lucide-vue-next'
defineProps<{
  active: boolean
}>()

defineEmits<{
  click: [event: Event]
}>()

const { getTooltipProps } = useSmartTooltipDelay()
</script>
