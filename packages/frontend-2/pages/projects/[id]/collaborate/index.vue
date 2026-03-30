<template>
  <ProjectPageCollaborators />
</template>

<script setup lang="ts">
import type { ProjectPageProjectFragment } from '~~/lib/common/generated/gql/graphql'

definePageMeta({
  middleware: ['auth', 'projects-active-check']
})

const attrs = useAttrs() as {
  project: ProjectPageProjectFragment
}

const projectName = computed(() =>
  attrs.project.name.length ? attrs.project.name : ''
)

useHead({
  title: `协同管理 | ${projectName.value}`
})
</script>
