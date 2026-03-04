<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] space-y-6 px-4">
    <div class="text-center space-y-2">
      <h1 class="text-2xl font-bold text-foreground">授权成功</h1>
      <p class="text-foreground-2">您已成功使用桌面 UI 进行身份验证。</p>
    </div>

    <div v-if="accessCode" class="w-full max-w-md space-y-2">
      <div class="p-4 bg-foundation-2 rounded border border-outline-2 break-all">
        <p class="text-xs font-medium text-foreground-2 uppercase tracking-wider mb-2">
          访问代码
        </p>
        <code class="font-mono text-primary text-sm">{{ accessCode }}</code>
      </div>
      <p class="text-xs text-center text-foreground-2">
        如果应用程序未自动继续，请复制以上代码。
      </p>
    </div>

    <div v-else class="text-danger">未收到访问代码。请重试。</div>

    <div class="pt-4">
      <CommonTextLink :to="homeRoute" size="sm">返回首页</CommonTextLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { homeRoute } from '~~/lib/common/helpers/route'

const route = useRoute()
const accessCode = computed(() => route.query.access_code as string)

useHead({
  title: 'Authentication Callback'
})

definePageMeta({
  name: 'authn-callback'
})
</script>
