<template>
  <div>
    <div class="flex h-[calc(100vh-15rem)] min-h-[38rem] gap-2">
      <div class="w-[250px] flex-shrink-0 overflow-y-auto pr-1">
        <ProjectPageModelsTree
          :project="project"
          :project-id="projectId"
          @update:selected-model-ids="onSelectedModelIdsUpdate"
        />
      </div>
      <div class="min-w-0 flex-grow overflow-y-auto pr-1">
        <ProjectPageModelsListView
          v-if="gridOrList === GridListToggleValue.List"
          :search="finalSearch"
          :project="project"
          :project-id="projectId"
          :source-apps="sourceApps"
          :contributors="contributors"
          :tree-model-ids="selectedTreeModelIds"
          @update:loading="finalLoading = $event"
          @clear-search="clearSearch"
        />
        <ProjectPageModelsCardView
          v-if="gridOrList === GridListToggleValue.Grid"
          :search="finalSearch"
          :project="project"
          :project-id="projectId"
          :source-apps="sourceApps"
          :contributors="contributors"
          :tree-model-ids="selectedTreeModelIds"
          :disable-default-links="false"
          @update:loading="finalLoading = $event"
          @clear-search="clearSearch"
          @model-clicked="onModelClicked"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Optional, SourceAppDefinition } from '@speckle/shared'
import { graphql } from '~~/lib/common/generated/gql'
import type {
  FormUsersSelectItemFragment,
  ProjectModelsPageResults_ProjectFragment,
  ProjectPageLatestItemsModelItemFragment
} from '~~/lib/common/generated/gql/graphql'
import { GridListToggleValue } from '~~/lib/layout/helpers/components'
import { modelRoute } from '~~/lib/common/helpers/route'
import { getModelItemRoute } from '~/lib/projects/helpers/models'

graphql(`
  fragment ProjectModelsPageResults_Project on Project {
    ...ProjectPageLatestItemsModels
  }
`)

const emit = defineEmits<{
  (e: 'update:search', val: string): void
  (e: 'update:loading', val: boolean): void
  (e: 'clear-search'): void
}>()

const props = defineProps<{
  projectId: string
  project?: ProjectModelsPageResults_ProjectFragment
  search: string
  gridOrList: GridListToggleValue
  loading: boolean
  sourceApps: SourceAppDefinition[]
  contributors: FormUsersSelectItemFragment[]
}>()

const router = useRouter()
const selectedTreeModelIds = ref<string[] | null>(null)

const finalSearch = computed({
  get: () => props.search,
  set: (newVal) => emit('update:search', newVal)
})

const finalLoading = computed({
  get: () => props.loading,
  set: (newVal) => emit('update:loading', newVal)
})

const clearSearch = () => {
  finalSearch.value = ''
  emit('clear-search')
}

const onSelectedModelIdsUpdate = (ids: string[] | null) => {
  selectedTreeModelIds.value = ids
}

const onModelClicked = (params: {
  model: Optional<ProjectPageLatestItemsModelItemFragment>
  id: string
}) => {
  const { model, id: modelId } = params
  if (!model) {
    return router.push(modelRoute(props.projectId, modelId))
  }

  return router.push(getModelItemRoute(model))
}
</script>
