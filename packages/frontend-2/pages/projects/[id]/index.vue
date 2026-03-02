<template>
  <div></div>
</template>

<script setup lang="ts">
import { projectRoute } from '~/lib/common/helpers/route'

definePageMeta({
  middleware: [
    (to) => {
      const projectId = to.params.id as string
      return navigateTo(projectRoute(projectId) + '/workbench')
    }
  ]
})
</script>
