<template>
  <div>
    <div
      v-if="topLevelItems.length && project && !isModelUploading"
      class="space-y-2 max-w-full"
    >
      <div v-for="item in topLevelItems" :key="item.id">
        <ProjectPageModelsStructureItem
          :item="item"
          :project="project"
          :is-search-result="isUsingSearch"
          @model-updated="onModelUpdated"
          @create-submodel="onCreateSubmodel"
        />
      </div>
      <FormButtonSecondaryViewAll
        v-if="showViewAll"
        :to="allProjectModelsRoute(projectId)"
      />
    </div>
    <template v-else-if="!areQueriesLoading">
      <CommonEmptySearchState
        v-if="
          !topLevelItems.length &&
          isFiltering &&
          (baseResult?.project?.modelsTree.items || []).length === 0
        "
        @clear-search="$emit('clear-search')"
      />
      <div v-else>
        <ProjectCardImportFileArea
          v-if="project"
          :project="project"
          class="h-36 col-span-4"
          @uploading="onModelUploading"
        />
      </div>
    </template>
    <InfiniteLoading
      v-if="topLevelItems?.length && !disablePagination"
      :settings="{ identifier: infiniteLoaderId }"
      @infinite="infiniteLoad"
    />
    <ProjectModelsAdd
      v-model:open="showNewDialog"
      :project="project"
      :parent-model-name="newSubmodelParent || undefined"
    />
  </div>
</template>
<script setup lang="ts">
import type {
  PendingFileUploadFragment,
  ProjectLatestModelsPaginationQueryVariables,
  ProjectPageLatestItemsModelItemFragment,
  ProjectPageLatestItemsModelsFragment,
  SingleLevelModelTreeItemFragment,
  FormUsersSelectItemFragment,
  ProjectModelsTreeTopLevelQueryVariables
} from '~~/lib/common/generated/gql/graphql'
import { useQuery, useQueryLoading } from '@vue/apollo-composable'
import {
  latestModelsPaginationQuery,
  latestModelsQuery,
  projectModelsTreeTopLevelQuery,
  projectModelsTreeTopLevelPaginationQuery
} from '~~/lib/projects/graphql/queries'
import type { Nullable, SourceAppDefinition } from '@speckle/shared'
import type { InfiniteLoaderState } from '~~/lib/global/helpers/components'
import { useEvictProjectModelFields } from '~~/lib/projects/composables/modelManagement'
import { allProjectModelsRoute } from '~~/lib/common/helpers/route'
import type { FileAreaUploadingPayload } from '~/lib/form/helpers/fileUpload'

const emit = defineEmits<{
  (e: 'update:loading', v: boolean): void
  (e: 'clear-search'): void
}>()

const props = defineProps<{
  projectId: string
  project?: ProjectPageLatestItemsModelsFragment
  search?: string
  disablePagination?: boolean
  sourceApps?: SourceAppDefinition[]
  contributors?: FormUsersSelectItemFragment[]
  treeModelIds?: string[] | null
}>()

const logger = useLogger()

const infiniteLoadCacheBuster = ref(0)
const newSubmodelParent = ref('')

const showNewDialog = computed({
  get: () => !!newSubmodelParent.value,
  set: (newVal) => {
    if (!newVal) {
      newSubmodelParent.value = ''
    }
  }
})

const evictModelFields = useEvictProjectModelFields()
const areQueriesLoading = useQueryLoading()
const isTreeSelectionActive = computed(() => props.treeModelIds !== null)
const isTreeSelectionEmpty = computed(
  () => isTreeSelectionActive.value && !props.treeModelIds?.length
)

const baseQueryVariables = computed(
  (): ProjectModelsTreeTopLevelQueryVariables => ({
    projectId: props.projectId,
    filter: {
      search: props.search || null,
      sourceApps: props.sourceApps?.length
        ? props.sourceApps.map((a) => a.searchKey)
        : null,
      contributors: props.contributors?.length
        ? props.contributors.map((c) => c.id)
        : null
    }
  })
)
const latestModelsQueryVariables = computed(
  (): ProjectLatestModelsPaginationQueryVariables => ({
    projectId: props.projectId,
    filter: {
      search: props.search || null,
      sourceApps: props.sourceApps?.length
        ? props.sourceApps.map((a) => a.searchKey)
        : null,
      contributors: props.contributors?.length
        ? props.contributors.map((c) => c.id)
        : null,
      ids: props.treeModelIds?.length ? props.treeModelIds : null
    }
  })
)
const isTreeModelIdsFiltering = computed(
  () => isTreeSelectionActive.value && !isTreeSelectionEmpty.value
)

const infiniteLoaderId = ref('')
const isModelUploading = ref(false)

// Base query (all pending uploads + first page of models)
const {
  result: baseResult,
  variables: resultVariables,
  onResult: onBaseResult
} = useQuery(
  projectModelsTreeTopLevelQuery,
  () => baseQueryVariables.value,
  () => ({ enabled: !isTreeSelectionActive.value })
)
const {
  result: latestModelsBaseResult,
  variables: latestModelsVariables,
  onResult: onLatestModelsBaseResult
} = useQuery(
  latestModelsQuery,
  () => latestModelsQueryVariables.value,
  () => ({ enabled: isTreeModelIdsFiltering.value })
)

const isFiltering = computed(() => {
  const filter = isTreeModelIdsFiltering.value
    ? latestModelsVariables.value?.filter
    : resultVariables.value?.filter
  if (filter?.contributors?.length) return true
  if (props.treeModelIds?.length) return true
  if (filter?.search?.length) return true
  if (filter?.sourceApps?.length) return true
  return false
})

// Pagination query
const {
  result: extraPagesResult,
  fetchMore: fetchMorePages,
  onResult: onExtraPagesResult
} = useQuery(
  projectModelsTreeTopLevelPaginationQuery,
  () => ({
    ...baseQueryVariables.value,
    cursor: null as Nullable<string>
  }),
  () => ({
    enabled: !props.disablePagination && !isTreeSelectionActive.value
  })
)
const {
  result: latestModelsExtraPagesResult,
  fetchMore: fetchMoreLatestModelsPages,
  onResult: onLatestModelsExtraPagesResult
} = useQuery(
  latestModelsPaginationQuery,
  () => ({
    ...latestModelsQueryVariables.value,
    cursor: null as Nullable<string>
  }),
  () => ({ enabled: !props.disablePagination && isTreeModelIdsFiltering.value })
)

const pendingModels = computed(() =>
  isFiltering.value ? [] : baseResult.value?.project?.pendingImportedModels || []
)
const modelTreeItems = computed(() => {
  if (isTreeSelectionEmpty.value) return []

  if (!isTreeModelIdsFiltering.value) {
    return extraPagesResult.value
      ? extraPagesResult.value?.project?.modelsTree.items || []
      : baseResult.value?.project?.modelsTree.items || []
  }

  const models = latestModelsExtraPagesResult.value
    ? latestModelsExtraPagesResult.value?.project?.models?.items || []
    : latestModelsBaseResult.value?.project?.models?.items || []

  return models.map(
    (model) =>
      ({
        __typename: 'ModelsTreeItem',
        id: model.id,
        name: model.displayName || model.name,
        fullName: model.name,
        model: model as unknown as ProjectPageLatestItemsModelItemFragment,
        hasChildren: false,
        updatedAt: model.updatedAt
      } as unknown as SingleLevelModelTreeItemFragment)
  )
})

const topLevelItems = computed(
  (): Array<SingleLevelModelTreeItemFragment | PendingFileUploadFragment> =>
    [...pendingModels.value, ...modelTreeItems.value].slice(
      0,
      props.disablePagination ? 8 : undefined
    )
)

const isUsingSearch = computed(() =>
  isTreeSelectionActive.value
    ? !!latestModelsVariables.value?.filter?.search
    : !!resultVariables.value?.filter?.search
)
const moreToLoad = computed(() =>
  isTreeSelectionEmpty.value
    ? false
    : isTreeModelIdsFiltering.value
    ? !latestModelsBaseResult.value?.project ||
      (latestModelsExtraPagesResult.value?.project?.models?.items.length ||
        latestModelsBaseResult.value.project.models.items.length) <
        latestModelsBaseResult.value.project.models.totalCount
    : !extraPagesResult.value?.project ||
      extraPagesResult.value.project.modelsTree.items.length <
        extraPagesResult.value.project.modelsTree.totalCount
)
const showViewAll = computed(() => moreToLoad.value && props.disablePagination)

const onModelUpdated = () => {
  // Evict model data
  evictModelFields(props.projectId)

  // Reset pagination
  infiniteLoadCacheBuster.value++
  calculateLoaderId()
}

const onCreateSubmodel = (parentModelName: string) => {
  newSubmodelParent.value = parentModelName
}

const infiniteLoad = async (state: InfiniteLoaderState) => {
  if (isTreeModelIdsFiltering.value) {
    const cursor =
      latestModelsExtraPagesResult.value?.project?.models.cursor ||
      latestModelsBaseResult.value?.project?.models.cursor ||
      null
    if (!moreToLoad.value || !cursor) return state.complete()

    try {
      await fetchMoreLatestModelsPages({
        variables: {
          cursor
        }
      })
    } catch (e) {
      logger.error(e)
      state.error()
      return
    }

    state.loaded()
    if (!moreToLoad.value) {
      state.complete()
    }
    return
  }

  const cursor =
    extraPagesResult.value?.project?.modelsTree.cursor ||
    baseResult.value?.project?.modelsTree.cursor ||
    null
  if (!moreToLoad.value || !cursor) return state.complete()

  try {
    await fetchMorePages({
      variables: {
        cursor
      }
    })
  } catch (e) {
    logger.error(e)
    state.error()
    return
  }

  state.loaded()
  if (!moreToLoad.value) {
    state.complete()
  }
}

const calculateLoaderId = () => {
  const vars = isTreeModelIdsFiltering.value
    ? latestModelsQueryVariables.value
    : baseQueryVariables.value
  const id = JSON.stringify(vars.filter) + `${infiniteLoadCacheBuster.value}`
  infiniteLoaderId.value = id
}

const onModelUploading = (payload: FileAreaUploadingPayload) => {
  isModelUploading.value = payload.isUploading
}

watch(areQueriesLoading, (newVal) => {
  emit('update:loading', newVal)
})

onBaseResult(calculateLoaderId)
onExtraPagesResult(calculateLoaderId)
onLatestModelsBaseResult(calculateLoaderId)
onLatestModelsExtraPagesResult(calculateLoaderId)
</script>
