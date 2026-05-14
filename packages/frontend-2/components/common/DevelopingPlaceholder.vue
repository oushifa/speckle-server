<template>
  <div class="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center bg-gray-50 px-6 py-10">
    <div class="text-center">
      <div class="relative mb-6 inline-flex items-center justify-center">
        <div class="absolute h-32 w-32 animate-pulse rounded-full bg-blue-100 opacity-30" />
        <div
          class="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-xl"
        >
          <WrenchScrewdriverIcon class="h-16 w-16 text-white" />
        </div>
      </div>

      <h2 class="mb-3 text-3xl font-bold text-gray-900">功能开发中</h2>
      <p class="mb-8 text-lg text-gray-500">
        {{ description || `${moduleName}功能正在努力开发中，敬请期待` }}
      </p>

      <div class="mb-6 flex items-center justify-center gap-2">
        <span
          v-for="delay in bounceDelays"
          :key="delay"
          class="h-2 w-2 animate-bounce rounded-full bg-blue-600"
          :style="{ animationDelay: delay }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WrenchScrewdriverIcon } from '@heroicons/vue/24/outline'

withDefaults(
  defineProps<{
    moduleName: string
    description?: string
  }>(),
  {
    description: ''
  }
)

const bounceDelays = ['0ms', '150ms', '300ms']
</script>
