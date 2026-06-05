<template>
  <div>
    <ProjectPageModelsHeader
      v-model:selected-apps="selectedApps"
      v-model:selected-members="selectedMembers"
      v-model:grid-or-list="gridOrList"
      v-model:search="search"
      v-model:show-only-approved="showOnlyApproved"
      :project="project"
      :project-id="projectId"
      :disabled="loading"
      class="sticky top-0 z-10 bg-foundation-page"
    />

    <ProjectPageModelsResults
      v-model:grid-or-list="gridOrList"
      v-model:search="search"
      v-model:loading="loading"
      :show-only-approved="showOnlyApproved"
      :source-apps="selectedApps"
      :contributors="selectedMembers"
      :project="project"
      :project-id="projectId"
      class="relative mt-6"
      @clear-search="clearSearch"
    />
  </div>
</template>
<script setup lang="ts">
import { useQuery } from '@vue/apollo-composable'
import type { SourceAppDefinition } from '@speckle/shared'
import type { FormUsersSelectItemFragment } from '~~/lib/common/generated/gql/graphql'
import { projectModelsPageQuery } from '~~/lib/projects/graphql/queries'
import { useProjectPageItemViewType } from '~~/lib/projects/composables/projectPages'

const route = useRoute()
const projectId = computed(() => route.params.id as string)

const selectedMembers = ref([] as FormUsersSelectItemFragment[])
const selectedApps = ref([] as SourceAppDefinition[])
const gridOrList = useProjectPageItemViewType('Models')
const search = ref('')
const loading = ref(false)
const showOnlyApproved = ref(false)

const { result } = useQuery(projectModelsPageQuery, () => ({
  projectId: projectId.value
}))

const project = computed(() => result.value?.project)

const clearSearch = () => {
  search.value = ''
  selectedMembers.value = []
  selectedApps.value = []
  showOnlyApproved.value = false
}
</script>
