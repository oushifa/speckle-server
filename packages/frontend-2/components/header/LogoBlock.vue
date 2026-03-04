<template>
  <Component
    :is="mainComponent"
    class="flex items-center shrink-0 select-none"
    :to="to"
    :target="target"
  >
    <img
      class="block -ml-2 mr-1"
      src="~~/assets/images/layout/logo.png"
      alt="数智南北"
    />
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
