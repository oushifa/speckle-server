<template>
  <div>
    <Portal to="current-page">
      <NuxtLink :to="`/projects/${projectId}/settings/permission`">项目设置</NuxtLink>
      <span> / 权限管理</span>
    </Portal>

    <div class="flex flex-col items-center justify-center min-h-[500px] bg-slate-50 rounded-3xl border border-slate-100 p-8 text-center mt-6">
      <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
        <IconAccount class="w-8 h-8" />
      </div>
      <h3 class="text-lg font-semibold text-slate-800 mb-2">权限管理</h3>
      <p class="text-sm text-slate-500 max-w-sm">
        该模块正在开发中。您可以在此管理项目成员的角色与权限分配，确保项目数据的安全性与合规性。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Portal } from 'portal-vue'

const route = useRoute()
const projectId = computed(() => route.params.id as string)
</script>
