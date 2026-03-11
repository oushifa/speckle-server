<template>
  <div
    id="speckle"
    class="bg-foundation-page text-foreground has-[.viewer]:!overflow-hidden has-[.viewer-transparent]:!bg-transparent"
  >
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <SingletonManagers />
  </div>
</template>
<script setup lang="ts">
// import { useTheme } from '~~/lib/core/composables/theme'
import { useAuthManager } from '~~/lib/auth/composables/auth'
import { useFixBraveSafariCookies } from '~~/lib/common/composables/reactiveCookie'

// const { isDarkTheme } = useTheme()

useHead({
  // Title suffix
  titleTemplate: (titleChunk) => (titleChunk ? `${titleChunk} | 数智南北` : '数智南北'),
  htmlAttrs: {
    // class: computed(() => (isDarkTheme.value ? `dark` : ``)),
    class: computed(() => ``),
    lang: 'zh-CN'
  },
  bodyAttrs: {
    class:
      'bg-foundation-page text-foreground has-[.viewer-transparent]:!bg-transparent'
  }
})

const { watchAuthQueryString } = useAuthManager()
watchAuthQueryString()
useFixBraveSafariCookies()
</script>
<style>
.page-enter-active,
.page-leave-active {
  transition: all 0.1s;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
