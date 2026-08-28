<template>
  <div class="relative pointer-events-none">
    <div
      class="absolute pointer-events-auto transition-transform duration-75"
      :style="style"
    >
      <div class="relative -translate-x-1/2 -translate-y-full">
        <button
          type="button"
          :class="[
            'transition-all duration-150 flex items-center justify-center shadow-md hover:shadow-xl select-none',
            'w-7 h-7 rounded-tr-full rounded-tl-full rounded-br-full cursor-pointer',
            isSelected
              ? 'bg-danger text-white ring-2 ring-warning scale-125 z-20 font-bold'
              : 'bg-foundation text-primary border border-primary/60 hover:scale-110 hover:border-primary z-10 font-medium',
            isOccluded && !isSelected ? 'opacity-65 hover:opacity-100' : 'opacity-100'
          ]"
          :title="`漫游点位 ${index + 1}`"
          @click.stop="$emit('click')"
        >
          <span class="text-xs font-mono font-bold leading-none">{{ index + 1 }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'

defineProps<{
  index: number
  isSelected?: boolean
  isOccluded?: boolean
  style?: Partial<CSSProperties>
}>()

defineEmits<{
  (e: 'click'): void
}>()
</script>
