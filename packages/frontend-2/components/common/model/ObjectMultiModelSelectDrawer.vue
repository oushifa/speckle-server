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
        v-model="modelOptionsProxy"
        name="model-object-model-multi-select"
        label="模型"
        show-label
        multiple
        fit-content
        :class="hasFixedProject ? 'md:col-span-1' : ''"
        :items="modelOptions"
        :disabled="disabled || !activeProjectId || modelOptions.length === 0"
        :allow-unset="true"
        by="id"
      >
        <template #nothing-selected>
          <span class="truncate block">
            {{ activeProjectId ? '请选择模型' : '请先选择项目' }}
          </span>
        </template>
        <template #something-selected="{ value }">
          <span class="truncate block">
            <template v-if="Array.isArray(value)">
              {{
                value.length <= 2
                  ? value.map((item) => item.name).join('、')
                  : `${value
                      .slice(0, 2)
                      .map((item) => item.name)
                      .join('、')} 等 ${value.length} 个模型`
              }}
            </template>
            <template v-else>
              {{ value?.name }}
            </template>
          </span>
        </template>
        <template #option="{ item }">
          <span class="whitespace-nowrap" :title="item.name">{{ item.name }}</span>
        </template>
      </FormSelectBase>
    </div>

    <button
      type="button"
      class="w-full px-3 py-2 border border-outline-3 rounded-md bg-foundation-page text-left flex items-center justify-between gap-2 disabled:opacity-50"
      :disabled="disabled || filteredModelIds.length === 0"
      @click="openDrawer"
    >
      <span
        v-tippy="triggerSelectedNamesTooltip"
        class="truncate text-body-sm"
        :class="selectedObjectCount > 0 ? 'text-foreground' : 'text-foreground-2'"
      >
        {{ triggerSelectedNamesLabel }}
      </span>
      <span class="text-body-xs text-foreground-2 shrink-0">
        {{ selectedObjectCount }} 已选
      </span>
    </button>

    <CommonConfirmDialog
      v-model:open="open"
      title="选择构件"
      confirm-text="确定"
      max-width="xl"
      fullscreen="all"
      @confirm="submitSelection"
    >
      <div class="p-3 h-full flex flex-col">
        <div class="text-body-xs text-foreground-2 truncate">
          项目：{{ projectDisplayName }} ｜ 模型：{{ modelDisplayName }}
        </div>
        <div class="flex items-center justify-between gap-3">
          <div class="text-body-xs text-foreground-2">
            已选 {{ filteredModelIds.length }} 个模型，可在左侧构件树或右侧 Viewer
            中多选（按住 Shift 可叠加）
          </div>
          <button
            class="px-2 py-1 rounded border border-outline-3 text-body-xs"
            @click="clearDraftSelection"
          >
            清空选择
          </button>
        </div>
        <div class="flex-grow overflow-hidden">
          <div
            v-if="!activeProjectId"
            class="h-full border border-outline-3 rounded flex items-center justify-center text-body-sm text-foreground-2"
          >
            请先选择项目
          </div>
          <div
            v-else-if="filteredModelIds.length === 0"
            class="h-full border border-outline-3 rounded flex items-center justify-center text-body-sm text-foreground-2"
          >
            请先选择模型
          </div>
          <div v-else class="h-full relative">
            <ViewerStateSetup
              :init-params="viewerInitParams"
              :cancel-hash-state="true"
              @setup="onViewerSetup"
            >
              <div class="size-full">
                <ViewerCoreSetup
                  viewer-host-classes="h-full"
                  :hide-loading-bar="true"
                />
                <ClientOnly>
                  <ViewerControlsLeft
                    ref="leftControls"
                    @force-close-panels="() => closeAllPanels('left')"
                  />
                  <ViewerControlsBottom
                    ref="bottomControls"
                    @force-close-panels="() => closeAllPanels('bottom')"
                  />
                  <div class="right-0 top-0 absolute">
                    <ViewerSelectionSidebar ref="selectionSidebar" class="z-20" />
                  </div>
                </ClientOnly>
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

type ModelObjectSelectionGroup = {
  modelId: string
  applicationIds: string[]
}

type ViewerTreeNodeLike = {
  model?: {
    id?: string
    raw?: SpeckleObject
  }
  children?: ViewerTreeNodeLike[]
}

type ViewerTreeLike = {
  _root?: {
    children?: ViewerTreeNodeLike[]
  }
  findId: (id: string) => ViewerTreeNodeLike[] | null
  findApplicationId?: (applicationId: string) => ViewerTreeNodeLike[] | null
}

type ViewerResourceItemLike = {
  objectId: string
  modelId?: string | null
}

const projectModelsQuery = gql`
  query CommonModelObjectMultiModelSelectDrawerProjects {
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
const modelIdsModel = defineModel<string[]>('model_ids', {
  default: () => []
})
const selectionsModel = defineModel<ModelObjectSelectionGroup[]>('selections', {
  default: () => []
})
const open = defineModel<boolean>('open', { default: false })

const leftControls = ref()
const bottomControls = ref()
const selectionSidebar = ref()

const viewerState = ref<InjectableViewerState | null>(null)
const draftSelectionByModelId = ref<Record<string, Set<string>>>({})
const applicationIdByBimId = ref<Record<string, string>>({})
const modelIdByBimId = ref<Record<string, string>>({})
const bimIdsBySelectionKey = ref<Record<string, string[]>>({})
const selectedObjectLabelMap = ref<Record<string, { title: string; subTitle: string }>>(
  {}
)

const { result: projectModelsResult, loading: loadingProjects } =
  useQuery<ProjectModelsQueryResult>(projectModelsQuery)

const fixedProjectId = computed(() => {
  const value = props.projectId?.trim()
  return value || null
})
const hasFixedProject = computed(() => !!fixedProjectId.value)
const activeProjectId = computed(() => fixedProjectId.value || projectIdModel.value)

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const uniqueStrings = (values: unknown[]) => {
  const seen = new Set<string>()
  return values.reduce<string[]>((acc, value) => {
    const normalized = normalizeString(value)
    if (!normalized || seen.has(normalized)) return acc
    seen.add(normalized)
    acc.push(normalized)
    return acc
  }, [])
}

const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

const selectionKey = (modelId: string, applicationId: string) =>
  `${modelId}::${applicationId}`

const normalizeSelectionGroups = (
  input: ModelObjectSelectionGroup[] | null | undefined
) =>
  (Array.isArray(input) ? input : [])
    .map((group) => ({
      modelId: normalizeString(group?.modelId),
      applicationIds: uniqueStrings(group?.applicationIds || [])
    }))
    .filter((group) => group.modelId && group.applicationIds.length > 0)

function getMaybeRefValue<T>(
  input: T | { value: T } | null | undefined
): T | undefined {
  if (input && typeof input === 'object' && 'value' in input) {
    return (input as { value: T }).value
  }
  return input as T | undefined
}

const getApplicationIdString = (obj: SpeckleObject): string | null => {
  const value = (obj as unknown as { applicationId?: unknown })?.applicationId
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const getNodeObjectId = (value: unknown) => {
  const normalized = normalizeString(value)
  if (!normalized) return ''
  return normalized.split('/').reverse()[0] || normalized
}

const viewerProjectId = writableAsyncComputed({
  get: () => activeProjectId.value || '',
  set: async (value: string) => {
    projectIdModel.value = value || null
  },
  initialState: '',
  asyncRead: false
})

const filteredModelIds = computed(() => uniqueStrings(modelIdsModel.value || []))

const viewerResourceIdString = writableAsyncComputed({
  get: () =>
    filteredModelIds.value.length
      ? resourceBuilder().addModels(filteredModelIds.value).toString()
      : '',
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

const selectedSelections = computed(() =>
  normalizeSelectionGroups(selectionsModel.value)
)
const selectedObjectCount = computed(() =>
  selectedSelections.value.reduce(
    (count, group) => count + group.applicationIds.length,
    0
  )
)

const projectOptionProxy = computed<ProjectOption | undefined>({
  get: () =>
    projectOptions.value.find((item) => item.id === projectIdModel.value) || undefined,
  set: (value) => {
    projectIdModel.value = value?.id || null
  }
})

const modelOptionsProxy = computed<ModelOption[] | undefined>({
  get: () =>
    modelOptions.value.filter((item) => filteredModelIds.value.includes(item.id)),
  set: (value) => {
    modelIdsModel.value = uniqueStrings((value || []).map((item) => item.id))
  }
})

const projectDisplayName = computed(() => {
  const project = projectOptions.value.find((item) => item.id === activeProjectId.value)
  return project?.name || activeProjectId.value || '-'
})

const modelDisplayName = computed(() => {
  if (!filteredModelIds.value.length) return '-'
  const names = filteredModelIds.value.map(
    (id) => modelOptions.value.find((item) => item.id === id)?.name || id
  )
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 个模型`
})

const getSelectedObjectDisplayName = (modelId: string, applicationId: string) => {
  const item = selectedObjectLabelMap.value[selectionKey(modelId, applicationId)]
  if (!item) return null
  if (item.title && item.subTitle) return `${item.title}-${item.subTitle}`
  return item.subTitle || item.title || null
}

const triggerSelectedNamesLabel = computed(() => {
  if (!activeProjectId.value) return '请先选择项目'
  if (!filteredModelIds.value.length) return '请先选择模型'
  if (!selectedObjectCount.value) return props.placeholder

  const names = selectedSelections.value
    .flatMap((group) =>
      group.applicationIds.map((applicationId) =>
        getSelectedObjectDisplayName(group.modelId, applicationId)
      )
    )
    .filter((name): name is string => !!name)
  if (!names.length) return `已选择 ${selectedObjectCount.value} 个构件`
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 个构件`
})

const triggerSelectedNamesTooltip = computed(() => {
  if (
    !activeProjectId.value ||
    !filteredModelIds.value.length ||
    !selectedObjectCount.value
  ) {
    return triggerSelectedNamesLabel.value
  }

  const names = selectedSelections.value
    .flatMap((group) =>
      group.applicationIds.map((applicationId) =>
        getSelectedObjectDisplayName(group.modelId, applicationId)
      )
    )
    .filter((name): name is string => !!name)
  if (!names.length) return triggerSelectedNamesLabel.value

  return {
    content: names.join('<br>'),
    allowHTML: true,
    maxWidth: 520
  }
})

const selectedObjectsFromViewer = computed(() => {
  const selected = getMaybeRefValue(
    viewerState.value?.ui.filters.selectedObjects as unknown as SpeckleObject[]
  )
  return Array.isArray(selected) ? selected : []
})

const draftGroups = computed(() =>
  filteredModelIds.value
    .map((modelId) => ({
      modelId,
      applicationIds: Array.from(draftSelectionByModelId.value[modelId] || [])
    }))
    .filter((group) => group.applicationIds.length > 0)
)

const upsertObjectMetadata = (modelId: string, bimId: string, obj: SpeckleObject) => {
  const normalizedModelId = normalizeString(modelId)
  if (!normalizedModelId || !obj?.id) return

  const normalizedBimId = normalizeString(bimId) || obj.id
  const { header, subheader } = getHeaderAndSubheaderForSpeckleObject(obj)
  if (header || subheader) {
    selectedObjectLabelMap.value[selectionKey(normalizedModelId, normalizedBimId)] = {
      title: header || '',
      subTitle: subheader || ''
    }
  }

  modelIdByBimId.value[obj.id] = normalizedModelId
  modelIdByBimId.value[normalizedBimId] = normalizedModelId

  const applicationId = getApplicationIdString(obj)
  if (!applicationId) return

  applicationIdByBimId.value[obj.id] = applicationId
  applicationIdByBimId.value[normalizedBimId] = applicationId

  const key = selectionKey(normalizedModelId, applicationId)
  const currentBimIds = bimIdsBySelectionKey.value[key] || []
  if (!currentBimIds.includes(obj.id)) currentBimIds.push(obj.id)
  if (normalizedBimId !== obj.id && !currentBimIds.includes(normalizedBimId)) {
    currentBimIds.push(normalizedBimId)
  }
  bimIdsBySelectionKey.value[key] = currentBimIds

  if (header || subheader) {
    selectedObjectLabelMap.value[key] = {
      title: header || '',
      subTitle: subheader || ''
    }
  }
}

const indexViewerTreeMetadata = () => {
  const state = viewerState.value
  if (!state) return

  const tree = getMaybeRefValue(
    state.viewer.metadata.worldTree as unknown as object
  ) as ViewerTreeLike | undefined
  const resourceItems = getMaybeRefValue(
    state.resources.response.resourceItems as unknown as ViewerResourceItemLike[]
  )

  if (!tree?._root?.children?.length || !resourceItems?.length) return

  const resourceMap = resourceItems.reduce<Record<string, string>>((acc, item) => {
    const objectId = normalizeString(item.objectId)
    const modelId = normalizeString(item.modelId)
    if (objectId && modelId) acc[objectId] = modelId
    return acc
  }, {})

  const visit = (node: ViewerTreeNodeLike, modelId: string) => {
    const raw = node.model?.raw
    const nodeObjectId = getNodeObjectId(node.model?.id)

    if (raw?.id) upsertObjectMetadata(modelId, raw.id, raw)
    if (raw && nodeObjectId && nodeObjectId !== raw.id) {
      upsertObjectMetadata(modelId, nodeObjectId, raw)
    }

    ;(node.children || []).forEach((child) => visit(child, modelId))
  }

  ;(tree._root.children || []).forEach((rootNode) => {
    const rootObjectId = getNodeObjectId(rootNode.model?.id)
    const modelId = resourceMap[rootObjectId]
    if (!modelId) return
    visit(rootNode, modelId)
  })
}

const closeAllPanels = (except?: 'left' | 'bottom') => {
  if (except !== 'left' && leftControls.value?.forceClosePanels) {
    leftControls.value.forceClosePanels()
  }
  if (except !== 'bottom' && bottomControls.value?.forceClosePanels) {
    bottomControls.value.forceClosePanels()
  }
  selectionSidebar.value?.forceClose?.()
}

const applyDraftSelectionToViewer = () => {
  const state = viewerState.value
  if (!state) return

  const tree = getMaybeRefValue(
    state.viewer.metadata.worldTree as unknown as object
  ) as ViewerTreeLike | undefined
  if (!tree) return

  indexViewerTreeMetadata()

  const objectsById = new Map<string, SpeckleObject>()

  draftGroups.value.forEach((group) => {
    group.applicationIds.forEach((applicationId) => {
      const key = selectionKey(group.modelId, applicationId)
      const bimIds = bimIdsBySelectionKey.value[key] || []
      const nodesFromIds = bimIds.flatMap((bimId) => tree.findId(bimId) || [])
      const nodes =
        nodesFromIds.length > 0
          ? nodesFromIds
          : (tree.findApplicationId?.(applicationId) || []).filter((node) => {
              const rawId = node.model?.raw?.id
              return !!rawId && modelIdByBimId.value[rawId] === group.modelId
            })

      nodes.forEach((node) => {
        const raw = node.model?.raw
        if (!raw?.id) return
        if (
          modelIdByBimId.value[raw.id] &&
          modelIdByBimId.value[raw.id] !== group.modelId
        ) {
          return
        }
        upsertObjectMetadata(group.modelId, raw.id, raw)
        objectsById.set(raw.id, raw)
      })
    })
  })

  const selectedObjects = state.ui.filters.selectedObjects as unknown
  const selectedObjectsRef = selectedObjects as { value?: SpeckleObject[] }
  const objects = Array.from(objectsById.values())
  if (selectedObjectsRef && 'value' in selectedObjectsRef) {
    selectedObjectsRef.value = objects
  } else {
    ;(state.ui.filters.selectedObjects as unknown as SpeckleObject[]) = objects
  }
}

const syncDraftFromModel = () => {
  draftSelectionByModelId.value = normalizeSelectionGroups(
    selectionsModel.value
  ).reduce<Record<string, Set<string>>>((acc, group) => {
    if (!filteredModelIds.value.includes(group.modelId)) return acc
    acc[group.modelId] = new Set(group.applicationIds)
    return acc
  }, {})
  applyDraftSelectionToViewer()
}

const clearDraftSelection = () => {
  draftSelectionByModelId.value = {}
  applyDraftSelectionToViewer()
}

const openDrawer = () => {
  open.value = true
}

const submitSelection = () => {
  selectionsModel.value = draftGroups.value
  modelIdsModel.value = filteredModelIds.value
  open.value = false
  viewerState.value = null
}

const onViewerSetup = (state: InjectableViewerState) => {
  viewerState.value = state
}

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
    modelIdsModel.value = []
    selectionsModel.value = []
    applicationIdByBimId.value = {}
    modelIdByBimId.value = {}
    bimIdsBySelectionKey.value = {}
    selectedObjectLabelMap.value = {}
    draftSelectionByModelId.value = {}
    open.value = false
    viewerState.value = null
  }
)

watch(
  filteredModelIds,
  (newModelIds, oldModelIds) => {
    if (areStringArraysEqual(newModelIds, oldModelIds || [])) return

    if (!areStringArraysEqual(newModelIds, modelIdsModel.value || [])) {
      modelIdsModel.value = [...newModelIds]
      return
    }

    selectionsModel.value = normalizeSelectionGroups(selectionsModel.value).filter(
      (group) => newModelIds.includes(group.modelId)
    )
    draftSelectionByModelId.value = Object.fromEntries(
      Object.entries(draftSelectionByModelId.value).filter(([modelId]) =>
        newModelIds.includes(modelId)
      )
    )

    applicationIdByBimId.value = {}
    modelIdByBimId.value = {}
    bimIdsBySelectionKey.value = {}

    if (!newModelIds.length) {
      open.value = false
      viewerState.value = null
    }
  },
  { immediate: true }
)

watch(
  () => open.value,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) syncDraftFromModel()
    if (!isOpen && wasOpen) viewerState.value = null
  }
)

watch(selectedObjectsFromViewer, (objects) => {
  if (!open.value) return

  indexViewerTreeMetadata()

  const grouped = objects.reduce<Record<string, Set<string>>>((acc, obj) => {
    if (!obj?.id) return acc

    const modelId = modelIdByBimId.value[obj.id]
    const applicationId =
      getApplicationIdString(obj) || applicationIdByBimId.value[obj.id]
    if (!modelId || !applicationId) return acc

    upsertObjectMetadata(modelId, obj.id, obj)
    if (!acc[modelId]) acc[modelId] = new Set()
    acc[modelId].add(applicationId)
    return acc
  }, {})

  draftSelectionByModelId.value = grouped
})

watch(
  [() => open.value, () => viewerState.value?.resources.response.resourcesLoaded],
  ([isOpen, resourcesLoaded]) => {
    if (!isOpen || !getMaybeRefValue(resourcesLoaded)) return
    indexViewerTreeMetadata()
    nextTick(() => applyDraftSelectionToViewer())
  },
  { immediate: true }
)
</script>
