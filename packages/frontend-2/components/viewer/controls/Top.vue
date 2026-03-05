<template>
  <div
    class="z-50 absolute top-[3.5rem] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-md bg-foundation border border-outline-2 py-1 px-2"
  >
    <NuxtLink to="/projects" class="">项目管理</NuxtLink>
    <span class="">/</span>
    <span>模型</span>
    <div></div>
  </div>
</template>
<script setup>
import { useInjectedViewerLoadedResources } from '~/lib/viewer/composables/setup'

const { resourceItems, modelsAndVersionIds, objects, resourcesLoading } =
  useInjectedViewerLoadedResources()
</script>
