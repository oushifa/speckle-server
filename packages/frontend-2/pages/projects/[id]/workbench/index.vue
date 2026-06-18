<template>
  <div>
    <Portal to="current-page">
      <div>工作台</div>
    </Portal>
    <ProjectsWorkbenchPage :project="project" />
  </div>
</template>

<script setup lang="ts">
import type { ProjectPageProjectFragment } from '~/lib/common/generated/gql/graphql'

defineProps<{
  project: ProjectPageProjectFragment
}>()
</script>
