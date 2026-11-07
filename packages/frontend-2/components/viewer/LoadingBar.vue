<template>
  <div :class="containerClasses">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <div
        v-show="loading"
        class="absolute w-full max-w-screen flex justify-center z-50"
      >
        <div
          class="relative bg-blue-500/50 mt-0 h-4 rounded-b-lg select-none px-2 py-1 w-2/3 lg:w-1/3 overflow-hidden shadow-sm"
        >
          <div
            class="absolute h-full inset-0 bg-primary transition-[width] duration-200"
            :class="loadProgress === 0 ? 'animate-pulse' : ''"
            :style="`width: ${Math.max(
              loadProgress > 0 ? Math.floor(loadProgress * 100) : 5,
              0
            )}%`"
          ></div>
          <div
            class="absolute h-full inset-0 text-center text-xs text-foreground-on-primary font-medium"
          >
            {{ Math.floor(loadProgress * 100) }}%
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { useInjectedViewerInterfaceState } from '~~/lib/viewer/composables/setup'

const { loading, loadProgress } = useInjectedViewerInterfaceState()

const containerClasses = computed(() => {
  const classParts = ['absolute left-0 right-0 z-40 h-30', 'transition-all']

  if (loadProgress.value < 1 && loading.value) {
    classParts.push('mt-0')
  } else {
    classParts.push('-mt-5')
  }

  return classParts.join(' ')
})
</script>
