<template>
  <ViewerStateSetup
    :init-params="viewerInitParams"
    :cancel-hash-state="true"
    @setup="onViewerSetup"
  >
    <slot />
    <div class="absolute inset-0">
      <ViewerCoreSetup viewer-host-classes="h-full" :hide-loading-bar="true" />
    </div>
    <div class="h-full">
      <div class="absolute z-50 left-0 w-72 bg-zinc-200 h-full overflow-hidden">
        <ViewerModelsPanel v-model:sub-view="modelsSubView" />
      </div>
    </div>
    <div v-if="!selectionSidbarDisabled" class="right-0 top-0 absolute">
      <ViewerSelectionSidebar ref="selectionSidebar" class="z-20" />
    </div>
  </ViewerStateSetup>
</template>
<script setup lang="ts">
import { resourceBuilder } from '@speckle/shared/viewer/route'
import { ViewerEvent } from '@speckle/viewer'
import { writableAsyncComputed } from '~/lib/common/composables/async'
import type { SpeckleObject } from '~/lib/viewer/helpers/sceneExplorer'
import type {
  InjectableViewerState,
  UseSetupViewerParams
} from '~/lib/viewer/composables/setup'
import { ViewerRenderPageType } from '~/lib/viewer/helpers/state'
import { ModelsSubView } from '~/lib/viewer/helpers/sceneExplorer'

const props = withDefaults(
  defineProps<{
    projectId?: string | null
    modelIds?: string[]
    viewerState?: InjectableViewerState | null
    filterBims?: string[]
    filterApplicationIds?: string[]
    selectionSidbarDisabled?: boolean
  }>(),
  {
    projectId: '',
    modelIds: () => [],
    viewerState: null,
    filterBims: () => [],
    filterApplicationIds: () => [],
    selectionSidbarDisabled: false
  }
)

const emit = defineEmits<{
  (e: 'update:viewerState', v: InjectableViewerState): void
}>()

const localModelsSubView = ref<ModelsSubView>(ModelsSubView.Main)
const setupViewerState = shallowRef<InjectableViewerState | null>(null)

const modelsSubView = computed<ModelsSubView>({
  get: () =>
    setupViewerState.value?.ui.panels.modelsSubView.value || localModelsSubView.value,
  set: (value) => {
    localModelsSubView.value = value
    if (setupViewerState.value) {
      setupViewerState.value.ui.panels.modelsSubView.value = value
    }
  }
})

const onViewerSetup = (State: InjectableViewerState) => {
  setupViewerState.value = State
  localModelsSubView.value = State.ui.panels.modelsSubView.value
  emit('update:viewerState', State)
}

const attrs = useAttrs()

const toStringArray = (input: unknown): string[] => {
  if (!Array.isArray(input)) return []
  return input.map((id) => String(id)).filter(Boolean)
}

const attrProjectId = computed(() => String(attrs['project_id'] || ''))
const attrModelIds = computed(() => toStringArray(attrs['model_ids']))
const attrModel = computed(() => toStringArray(attrs.model))

const normalizedProjectId = computed(() => props.projectId || attrProjectId.value)

const normalizedModelIds = computed(() => {
  const source =
    props.modelIds.length > 0
      ? props.modelIds
      : attrModelIds.value.length > 0
      ? attrModelIds.value
      : attrModel.value
  return toStringArray(source)
})

const normalizedFilterBims = computed(() => toStringArray(props.filterBims))
const normalizedFilterApplicationIds = computed(() =>
  toStringArray(props.filterApplicationIds)
)
const isApplyingFilters = ref(false)

const viewerResourceIdString = writableAsyncComputed({
  get: () => {
    const modelIds = normalizedModelIds.value.slice()
    return modelIds.length ? resourceBuilder().addModels(modelIds).toString() : ''
  },
  set: async () => {
    // Keep local project/model models as the source of truth
  },
  initialState: '',
  asyncRead: false
})

const viewerProjectId = writableAsyncComputed({
  get: () => normalizedProjectId.value,
  set: async () => {},
  initialState: '',
  asyncRead: false
})

const viewerInitParams = computed(
  (): UseSetupViewerParams => ({
    projectId: viewerProjectId,
    resourceIdString: viewerResourceIdString,
    pageType: ViewerRenderPageType.Viewer
  })
)

function getMaybeRefValue<T>(
  input: T | { value: T } | null | undefined
): T | undefined {
  if (input && typeof input === 'object' && 'value' in input) {
    return (input as { value: T }).value
  }
  return input as T | undefined
}

type ViewerTreeNodeLike = {
  model?: { raw?: SpeckleObject }
}

type ViewerTreeLike = {
  findId: (id: string) => ViewerTreeNodeLike[] | null
  findApplicationId?: (applicationId: string) => ViewerTreeNodeLike[] | null
}

const applyFilters = () => {
  const state = setupViewerState.value
  if (!state) return

  const bimIds = normalizedFilterBims.value
  const applicationIds = normalizedFilterApplicationIds.value
  isApplyingFilters.value = true
  try {
    const objects: SpeckleObject[] = []
    const objectIds: string[] = bimIds
    const tree = getMaybeRefValue(state.viewer.metadata.worldTree as unknown as object)
    if (tree) {
      const typedTree = tree as ViewerTreeLike
      bimIds.forEach((id, index) => {
        let nodes = typedTree.findId(id) || []
        nodes?.forEach((node) => {
          if (!node.model?.raw?.id) return
          objects.push(node.model.raw)
        })
        if (nodes.length === 0) {
          nodes = typedTree.findApplicationId?.(applicationIds[index]) || []
          nodes?.forEach((node) => {
            if (!node.model?.raw?.id) return
            // objectIds.splice(index, 1, node.model?.raw?.id)
            objects.push(node.model.raw)
          })
        }
      })

      // if (objects.length === 0) {
      //   applicationIds.forEach((applicationId) => {
      //     const nodes = typedTree.findApplicationId?.(applicationId) || []
      //     nodes?.forEach((node) => {
      //       if (!node.model?.raw?.id) return
      //       if (objectIds.has(node.model.raw.id)) return
      //       objectIds.add(node.model.raw.id)
      //       objects.push(node.model.raw)
      //     })
      //   })
      // }
    }

    const isolatedIds = objectIds.filter((id): id is string => !!id)
    const isolatedRef = state.ui.filters.isolatedObjectIds as unknown as {
      value?: string[]
    }
    if (isolatedRef && 'value' in isolatedRef) {
      isolatedRef.value = isolatedIds
    } else {
      ;(state.ui.filters.isolatedObjectIds as unknown as string[]) = isolatedIds
    }

    const selectedObjects = state.ui.filters.selectedObjects as unknown
    const selectedObjectsRef = selectedObjects as { value?: SpeckleObject[] }
    if (selectedObjectsRef && 'value' in selectedObjectsRef) {
      selectedObjectsRef.value = objects
    } else {
      ;(state.ui.filters.selectedObjects as unknown as SpeckleObject[]) = objects
    }
  } finally {
    isApplyingFilters.value = false
  }
}

const onViewerLoadComplete = () => {
  // nextTick(() => applyFilters())
  setTimeout(() => {
    applyFilters()
  }, 300)
}

watch(
  [
    () => setupViewerState.value,
    () => normalizedFilterBims.value,
    () => normalizedFilterApplicationIds.value
  ],
  () => {
    applyFilters()
  },
  { immediate: true, deep: true }
)

// watch(
//   () => getMaybeRefValue(setupViewerState.value?.resources.response.resourcesLoaded),
//   (loaded) => {
//     if (!loaded) return
//     console.log('viewer inited')
//     nextTick(() => applyFilters())
//   },
//   { immediate: true }
// )

watch(
  () => setupViewerState.value,
  (newState, oldState) => {
    if (oldState) {
      oldState.viewer.instance.removeListener(
        ViewerEvent.LoadComplete,
        onViewerLoadComplete
      )
    }
    if (newState) {
      newState.viewer.instance.on(ViewerEvent.LoadComplete, onViewerLoadComplete)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  const state = setupViewerState.value
  if (!state) return
  state.viewer.instance.removeListener(ViewerEvent.LoadComplete, onViewerLoadComplete)
})

// watch(
//   () => props.modelIds,
//   (newModelId, oldModelId) => {
//     if (newModelId === oldModelId) return
//     bimIdsModel.value = []
//     draftSelectedIds.value = new Set()
//     if (newModelId) openDrawer()
//     else {
//       open.value = false
//       viewerState.value = null
//     }
//   }
// )
</script>
