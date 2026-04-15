<template>
  <ViewerStateSetup :init-params="viewerInitParams" @setup="onViewerSetup">
    <slot />
    <div class="absolute inset-0">
      <ViewerCoreSetup viewer-host-classes="h-full" :hide-loading-bar="true" />
    </div>
  </ViewerStateSetup>
</template>
<script setup lang="ts">
import { resourceBuilder } from '@speckle/shared/viewer/route'
import { writableAsyncComputed } from '~/lib/common/composables/async'
import type {
  InjectableViewerState,
  UseSetupViewerParams
} from '~/lib/viewer/composables/setup'
import { ViewerRenderPageType } from '~/lib/viewer/helpers/state'

const props = withDefaults(
  defineProps<{
    projectId?: string | null
    modelIds?: string[]
    viewerState?: InjectableViewerState | null
  }>(),
  {
    projectId: '',
    modelIds: () => [],
    viewerState: null
  }
)

const emit = defineEmits<{
  (e: 'update:viewerState', v: InjectableViewerState): void
}>()

const onViewerSetup = (State: InjectableViewerState) => {
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
