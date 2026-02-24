<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] space-y-6 px-4">
    <div class="text-center space-y-2">
      <h1 class="text-2xl font-bold text-foreground">Authentication Successful</h1>
      <p class="text-foreground-2">
        You have successfully authenticated with the Speckle Desktop UI.
      </p>
    </div>

    <div v-if="accessCode" class="w-full max-w-md space-y-2">
      <div class="p-4 bg-foundation-2 rounded border border-outline-2 break-all">
        <p class="text-xs font-medium text-foreground-2 uppercase tracking-wider mb-2">
          Access Code
        </p>
        <code class="font-mono text-primary text-sm">{{ accessCode }}</code>
      </div>
      <p class="text-xs text-center text-foreground-2">
        If the application doesn't proceed automatically, please copy the code above.
      </p>
    </div>

    <div v-else class="text-danger">No access code received. Please try again.</div>

    <div class="pt-4">
      <CommonTextLink :to="homeRoute" size="sm">Go to Home</CommonTextLink>
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
