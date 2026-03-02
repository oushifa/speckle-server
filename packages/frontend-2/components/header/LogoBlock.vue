<template>
  <Component
    :is="mainComponent"
    class="flex items-center shrink-0 select-none"
    :to="to"
    :target="target"
  >
    <IconBimSvg class="h-8 w-8 block mr-1" />
    <div
      v-if="!minimal"
      class="text-sm mt-0 font-medium"
      :class="showTextOnMobile ? '' : 'hidden md:flex'"
    >
      数智南北
    </div>
  </Component>
</template>
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    minimal?: boolean
    to?: string
    showTextOnMobile?: boolean
    target?: string
    noLink?: boolean
  }>(),
  {
    to: '/',
    noLink: true
  }
)

const NuxtLink = resolveComponent('NuxtLink')
const mainComponent = computed(() => (props.noLink ? 'div' : NuxtLink))
</script>
