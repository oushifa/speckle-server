<template>
  <Component
    :is="mainComponent"
    class="flex items-center shrink-0 select-none"
    :to="to"
    :target="target"
  >
    <div id="logo">
      <span class="font-[Youshe] text-3xl font-bold">BIM赋能</span>
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

<style scoped>
#logo {
  margin-left: -0.375rem;
  width: 13rem;
  height: 54px;
  background-image: url('~/assets/images/layout/bg-2.png'),
    url('~/assets/images/layout/bg-1.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;
  display: flex;
  align-items: center;
  font-size: 32px;
  letter-spacing: 28%;
  justify-content: center;
}
#logo > span {
  padding-right: 1rem;
}
</style>
