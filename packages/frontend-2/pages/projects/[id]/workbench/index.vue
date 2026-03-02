<template>
  <div>
    <Portal to="current-page">
      <div>工作台</div>
    </Portal>
    <!-- <ProjectPageModelsTab /> -->
    工作台
  </div>
</template>

<script setup lang="ts">
import type { ProjectPageProjectFragment } from '~/lib/common/generated/gql/graphql'

const attrs = useAttrs() as {
  project: ProjectPageProjectFragment
}
console.log(attrs, 'attrs')
</script>
