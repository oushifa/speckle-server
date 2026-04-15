<template>
  <div class="space-y-3">
    <div
      class="grid grid-cols-1 gap-3"
      :class="hasFixedProject ? 'md:grid-cols-1' : 'md:grid-cols-2'"
    >
      <FormSelectBase
        v-if="!hasFixedProject"
        v-model="projectOptionProxy"
        name="model-object-project-select"
        label="项目"
        show-label
        :items="projectOptions"
        :disabled="disabled || projectOptions.length === 0"
        :allow-unset="true"
        by="id"
      >
        <template #nothing-selected>
          {{ loadingProjects ? '加载项目中...' : '请选择项目' }}
        </template>
        <template #something-selected="{ value }">
          {{ Array.isArray(value) ? value[0]?.name : value?.name }}
        </template>
        <template #option="{ item }">
          {{ item.name }}
        </template>
      </FormSelectBase>

      <FormSelectBase
        v-model="modelOptionProxy"
        name="model-object-model-select"
        label="模型"
        show-label
        :class="hasFixedProject ? 'md:col-span-1' : ''"
        :items="modelOptions"
        :disabled="disabled || !activeProjectId || modelOptions.length === 0"
        :allow-unset="true"
        by="id"
      >
        <template #nothing-selected>
          {{ activeProjectId ? '请选择模型' : '请先选择项目' }}
        </template>
        <template #something-selected="{ value }">
          {{ Array.isArray(value) ? value[0]?.name : value?.name }}
        </template>
        <template #option="{ item }">
          {{ item.name }}
        </template>
      </FormSelectBase>
    </div>

    <button
      type="button"
      class="w-full px-3 py-2 border border-outline-3 rounded-md bg-foundation-page text-left flex items-center justify-between gap-2 disabled:opacity-50"
      :disabled="disabled || !modelIdModel"
      @click="openDrawer"
    >
      <span
        class="truncate text-body-sm"
        :class="selectedCount > 0 ? 'text-foreground' : 'text-foreground-2'"
      >
        {{ triggerSelectedNamesLabel }}
      </span>
      <span class="text-body-xs text-foreground-2 shrink-0">
        {{ selectedCount }} 已选
      </span>
    </button>

    <CommonConfirmDialog
      v-model:open="open"
      title="选择构件"
      confirm-text="确定"
      max-width="xl"
      @confirm="submitSelection"
    >
      <div class="space-y-3">
        <div class="text-body-xs text-foreground-2 truncate">
          项目：{{ projectDisplayName }} ｜ 模型：{{ modelDisplayName }}
        </div>
        <div class="flex items-center justify-between gap-3">
          <div class="text-body-xs text-foreground-2">
            可在左侧构件树或右侧 Viewer 中多选（按住 Shift 可叠加）
          </div>
          <button
            class="px-2 py-1 rounded border border-outline-3 text-body-xs"
            @click="clearDraftSelection"
          >
            清空选择
          </button>
        </div>
        <div class="h-[65vh] overflow-hidden">
          <div
            v-if="!activeProjectId"
            class="h-full border border-outline-3 rounded flex items-center justify-center text-body-sm text-foreground-2"
          >
            请先选择项目
          </div>
          <div
            v-else-if="!modelIdModel"
            class="h-full border border-outline-3 rounded flex items-center justify-center text-body-sm text-foreground-2"
          >
            请先选择模型
          </div>
          <div v-else class="h-full relative">
            <ViewerStateSetup :init-params="viewerInitParams" @setup="onViewerSetup">
              <div class="absolute left-0 top-0 h-full w-60 z-50">
                <ViewerModelsPanel />
              </div>
              <div class="size-full">
                <ViewerCoreSetup
                  viewer-host-classes="h-full"
                  :hide-loading-bar="true"
                />
              </div>
            </ViewerStateSetup>
          </div>
        </div>
      </div>
    </CommonConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { gql } from '@apollo/client/core'
import { useQuery } from '@vue/apollo-composable'
import { resourceBuilder } from '@speckle/shared/viewer/route'
import { writableAsyncComputed } from '~/lib/common/composables/async'
import { getHeaderAndSubheaderForSpeckleObject } from '~/lib/object-sidebar/helpers'
import type { SpeckleObject } from '~/lib/viewer/helpers/sceneExplorer'
import { ViewerRenderPageType } from '~/lib/viewer/helpers/state'
import type {
  InjectableViewerState,
  UseSetupViewerParams
} from '~/lib/viewer/composables/setup'

type ProjectOption = {
  id: string
  name: string
  models: Array<{
    id: string
    name: string
  }>
}

type ProjectModelsQueryResult = {
  activeUser: {
    id: string
    projects: {
      items: Array<{
        id: string
        name: string | null
        models: {
          items: Array<{
            id: string
            name: string | null
          }>
        } | null
      }>
    } | null
  } | null
}

type ModelOption = {
  id: string
  name: string
}

const projectModelsQuery = gql`
  query CommonModelObjectMultiSelectDrawerProjects {
    activeUser {
      id
      projects(limit: 200) {
        items {
          id
          name
          models(limit: 200) {
            items {
              id
              name
            }
          }
        }
      }
    }
  }
`

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    placeholder?: string
    projectId?: string | null
  }>(),
  {
    disabled: false,
    placeholder: '选择构件',
    projectId: null
  }
)

const projectIdModel = defineModel<string | null>('project_id', { default: null })
const modelIdModel = defineModel<string | null>('model_id', { default: null })
const bimIdsModel = defineModel<string[]>('bim_ids', { default: () => [] })
const open = defineModel<boolean>('open', { default: false })

const draftSelectedIds = ref<Set<string>>(new Set())
const viewerState = ref<InjectableViewerState | null>(null)
const selectedObjectSubtitleMap = ref<Record<string, string>>({})

const { result: projectModelsResult, loading: loadingProjects } =
  useQuery<ProjectModelsQueryResult>(projectModelsQuery)

const fixedProjectId = computed(() => {
  const value = props.projectId?.trim()
  return value || null
})
const hasFixedProject = computed(() => !!fixedProjectId.value)
const activeProjectId = computed(() => fixedProjectId.value || projectIdModel.value)

const viewerProjectId = writableAsyncComputed({
  get: () => activeProjectId.value || '',
  set: async (value: string) => {
    projectIdModel.value = value || null
  },
  initialState: '',
  asyncRead: false
})

const viewerResourceIdString = writableAsyncComputed({
  get: () =>
    modelIdModel.value ? resourceBuilder().addModel(modelIdModel.value).toString() : '',
  set: async () => {
    // Keep local project/model models as the source of truth
  },
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

const projectOptions = computed<ProjectOption[]>(() =>
  (projectModelsResult.value?.activeUser?.projects?.items || []).map((project) => ({
    id: project.id,
    name: project.name || project.id,
    models: (project.models?.items || []).map((model) => ({
      id: model.id,
      name: model.name || model.id
    }))
  }))
)

const modelOptions = computed<ModelOption[]>(() => {
  if (!activeProjectId.value) return []
  return (
    projectOptions.value.find((item) => item.id === activeProjectId.value)?.models || []
  )
})

const projectOptionProxy = computed<ProjectOption | undefined>({
  get: () =>
    projectOptions.value.find((item) => item.id === projectIdModel.value) || undefined,
  set: (value) => {
    projectIdModel.value = value?.id || null
  }
})

const modelOptionProxy = computed<ModelOption | undefined>({
  get: () =>
    modelOptions.value.find((item) => item.id === modelIdModel.value) || undefined,
  set: (value) => {
    modelIdModel.value = value?.id || null
  }
})

const filteredBimIds = computed(() =>
  Array.isArray(bimIdsModel.value) ? bimIdsModel.value : []
)
const selectedCount = computed(() => filteredBimIds.value.length)

const projectDisplayName = computed(() => {
  const project = projectOptions.value.find((item) => item.id === activeProjectId.value)
  return project?.name || activeProjectId.value || '-'
})

const modelDisplayName = computed(() => {
  const model = modelOptions.value.find((item) => item.id === modelIdModel.value)
  return model?.name || modelIdModel.value || '-'
})

const triggerSelectedNamesLabel = computed(() => {
  if (!activeProjectId.value) return '请先选择项目'
  if (!modelIdModel.value) return '请先选择模型'
  if (!selectedCount.value) return props.placeholder

  const names = filteredBimIds.value
    .map((id) => selectedObjectSubtitleMap.value[id])
    .filter((name): name is string => !!name)
  if (!names.length) return `已选择 ${selectedCount.value} 个构件`
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 个构件`
})

function getMaybeRefValue<T>(
  input: T | { value: T } | null | undefined
): T | undefined {
  if (input && typeof input === 'object' && 'value' in input) {
    return (input as { value: T }).value
  }
  return input as T | undefined
}

const selectedIdsFromViewer = computed(() => {
  const selectedSet = getMaybeRefValue(
    viewerState.value?.ui.filters.selectedObjectIds as unknown as Set<string>
  )
  return selectedSet ? Array.from(selectedSet) : []
})

const selectedObjectsFromViewer = computed(() => {
  const selected = getMaybeRefValue(
    viewerState.value?.ui.filters.selectedObjects as unknown as SpeckleObject[]
  )
  return Array.isArray(selected) ? selected : []
})

const applyDraftSelectionToViewer = () => {
  const state = viewerState.value
  if (!state) return
  const tree = getMaybeRefValue(state.viewer.metadata.worldTree as unknown as object)
  if (!tree) return

  const objects: SpeckleObject[] = []
  Array.from(draftSelectedIds.value).forEach((id) => {
    const nodes = (tree as { findId: (id: string) => unknown }).findId(id) as Array<{
      model?: { raw?: SpeckleObject }
    }>
    nodes.forEach((node) => {
      if (!node.model?.raw?.id) return
      objects.push(node.model.raw)
      const { header, subheader } = getHeaderAndSubheaderForSpeckleObject(
        node.model.raw
      )
      const label = subheader || header
      if (label) selectedObjectSubtitleMap.value[node.model.raw.id] = label
    })
  })

  const selectedObjects = state.ui.filters.selectedObjects as unknown
  const selectedObjectsRef = selectedObjects as { value?: SpeckleObject[] }
  if (selectedObjectsRef && 'value' in selectedObjectsRef) {
    selectedObjectsRef.value = objects
  } else {
    ;(state.ui.filters.selectedObjects as unknown as SpeckleObject[]) = objects
  }
}

const syncDraftFromModel = () => {
  draftSelectedIds.value = new Set(filteredBimIds.value)
  applyDraftSelectionToViewer()
}

const clearDraftSelection = () => {
  draftSelectedIds.value = new Set()
  applyDraftSelectionToViewer()
}

const openDrawer = () => {
  open.value = true
}

const submitSelection = () => {
  bimIdsModel.value = Array.from(draftSelectedIds.value)
  open.value = false
  viewerState.value = null
}

const onViewerSetup = (state: InjectableViewerState) => {
  viewerState.value = state
}

watch(selectedObjectsFromViewer, (objects) => {
  objects.forEach((obj) => {
    if (!obj?.id) return
    const { header, subheader } = getHeaderAndSubheaderForSpeckleObject(obj)
    const label = subheader || header
    if (label) selectedObjectSubtitleMap.value[obj.id] = label
  })
})

watch(
  () => fixedProjectId.value,
  (projectId) => {
    if (!projectId) return
    if (projectIdModel.value !== projectId) projectIdModel.value = projectId
  },
  { immediate: true }
)

watch(
  () => projectIdModel.value,
  (newProjectId, oldProjectId) => {
    if (newProjectId === oldProjectId) return
    modelIdModel.value = null
    bimIdsModel.value = []
    draftSelectedIds.value = new Set()
    open.value = false
    viewerState.value = null
  }
)

watch(
  () => modelIdModel.value,
  (newModelId, oldModelId) => {
    if (newModelId === oldModelId) return
    bimIdsModel.value = []
    draftSelectedIds.value = new Set()
    if (newModelId) openDrawer()
    else {
      open.value = false
      viewerState.value = null
    }
  }
)

watch(
  () => open.value,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) syncDraftFromModel()
    if (!isOpen && wasOpen) viewerState.value = null
  }
)

watch(selectedIdsFromViewer, (ids) => {
  if (!open.value) return
  draftSelectedIds.value = new Set(ids)
})

watch(
  [() => open.value, () => viewerState.value?.resources.response.resourcesLoaded],
  ([isOpen, resourcesLoaded]) => {
    if (!isOpen || !getMaybeRefValue(resourcesLoaded)) return
    nextTick(() => applyDraftSelectionToViewer())
  },
  { immediate: true }
)
</script>
