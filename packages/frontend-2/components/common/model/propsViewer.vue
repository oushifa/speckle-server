<template>
  <ViewerStateSetup
    class="relative isolate"
    :init-params="viewerInitParams"
    :cancel-hash-state="true"
    @setup="onViewerSetup"
  >
    <slot />
    <div class="absolute inset-0">
      <ViewerCoreSetup viewer-host-classes="h-full" :hide-loading-bar="true" />
    </div>
    <div
      class="absolute z-20 left-0 inset-y-0 w-72 bg-foundation border-r border-outline-3 overflow-hidden"
    >
      <ViewerModelsPanel v-model:sub-view="modelsSubView" />
    </div>
    <div v-if="!selectionSidbarDisabled" class="absolute z-20 right-0 top-0">
      <ViewerSelectionSidebar />
    </div>
  </ViewerStateSetup>
</template>
<script setup lang="ts">
import { until } from '@vueuse/core'
import { timeoutAt, TIME_MS, TimeoutError } from '@speckle/shared'
import { resourceBuilder } from '@speckle/shared/viewer/route'
import { SelectionExtension, ViewerEvent } from '@speckle/viewer'
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

const normalizedProjectId = computed(() => props.projectId || '')
const normalizedModelIds = computed(() => props.modelIds || [])
const normalizedFilterBims = computed(() => props.filterBims || [])
const normalizedFilterApplicationIds = computed(() => props.filterApplicationIds || [])

// These are required to be AsyncWritableComputedRef (see UseSetupViewerParams) so that the
// setup composable can drive them (e.g. resolving saved views). The local props remain the
// source of truth, hence the no-op setters.
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

/**
 * Filters are refs in the viewer state, but they can occasionally be accessed as plain
 * values, so we defensively write back via `.value` when present.
 */
function setViewerFilterValue(target: unknown, value: unknown): void {
  if (target && typeof target === 'object' && 'value' in target) {
    ;(target as { value: unknown }).value = value
  }
}

const applyFilters = () => {
  const state = setupViewerState.value
  if (!state) return

  const bimIds = normalizedFilterBims.value
  const appIds = normalizedFilterApplicationIds.value

  // Without filters there's nothing to isolate/select - don't wipe the user's
  // current selection or isolation state
  if (!bimIds.length && !appIds.length) return

  const objectsById = new Map<string, SpeckleObject>()
  const tree = getMaybeRefValue(state.viewer.metadata.worldTree as unknown as object)
  if (tree) {
    const typedTree = tree as ViewerTreeLike & {
      findBimNodeId: (bimId: string) => ViewerTreeNodeLike[] | null
    }

    const collect = (nodes: ViewerTreeNodeLike[] | null) => {
      nodes?.forEach((node) => {
        const raw = node.model?.raw
        if (!raw?.id) return
        objectsById.set(raw.id, raw)
      })
    }

    bimIds.forEach((bimId) => {
      if (!bimId) return
      collect(typedTree.findBimNodeId(bimId))
    })

    appIds.forEach((appId) => {
      if (!appId) return
      let nodes = typedTree.findApplicationId?.(appId) || []
      if (!nodes.length) nodes = typedTree.findId(appId) || []
      collect(nodes)
    })
  }

  const objectIds = Array.from(objectsById.keys())
  setViewerFilterValue(state.ui.filters.isolatedObjectIds, objectIds)
  setViewerFilterValue(
    state.ui.filters.selectedObjects,
    Array.from(objectsById.values())
  )
}

/**
 * The world tree (and its application/bim lookup maps) is only safe to query once the
 * viewer has finished loading. Capture and await the loading signal instead of relying on
 * an arbitrary delay.
 */
const waitForLoadingOver = async () => {
  const state = setupViewerState.value
  if (!state) return
  if (!state.ui.loading?.value) return

  try {
    await Promise.race([
      until(state.ui.loading).toBe(false),
      timeoutAt(TIME_MS.minute, 'Waiting for viewer to finish loading timed out')
    ])
  } catch (e) {
    if (!(e instanceof TimeoutError)) throw e
    // Timeout - fall through and let applyFilters use whatever is already available
  }
}

const applyFiltersWhenReady = async () => {
  await waitForLoadingOver()
  applyFilters()
}

const onViewerLoadComplete = () => {
  applyFiltersWhenReady()
}

watch(
  [
    () => setupViewerState.value,
    () => normalizedFilterBims.value,
    () => normalizedFilterApplicationIds.value
  ],
  () => {
    applyFiltersWhenReady()
  },
  { immediate: true, deep: true }
)

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
  // The viewer is a per-session singleton; reset the transient selection/isolation we may
  // have applied so it doesn't leak into the next viewer-bearing component that mounts.
  state.ui.filters.isolatedObjectIds.value = []
  state.ui.filters.hiddenObjectIds.value = []
  state.ui.filters.selectedObjects.value = []
  state.viewer.instance.getExtension(SelectionExtension)?.clearSelection()
  state.viewer.instance.removeListener(ViewerEvent.LoadComplete, onViewerLoadComplete)
})
</script>
