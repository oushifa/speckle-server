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
            {{ Array.isArray(value) ? value[0]?.name : value?.name }}
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
      :disabled="disabled || !modelIdModel"
      @click="openDrawer"
    >
      <span
        v-tippy="triggerSelectedNamesTooltip"
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
      fullscreen="all"
      @confirm="submitSelection"
    >
      <div class="p-3 h-full flex flex-col">
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
        <div class="flex-grow overflow-hidden">
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
const applicationIdsModel = defineModel<string[]>('application_ids', {
  default: () => []
})
const open = defineModel<boolean>('open', { default: false })

const leftControls = ref()
const bottomControls = ref()
const selectionSidebar = ref()

// draftSelectedIds 存储 applicationId（BIM 侧标识）
const draftSelectedIds = ref<Set<string>>(new Set())
const viewerState = ref<InjectableViewerState | null>(null)
const applicationIdByBimId = ref<Record<string, string>>({})
// 反向映射：applicationId -> bimId列表（用于高亮 viewer 中的构件）
const bimIdsByApplicationId = ref<Record<string, string[]>>({})
const selectedObjectLabelMap = ref<Record<string, { title: string; subTitle: string }>>(
  {}
)

const upsertObjectMetadata = (bimId: string, obj: SpeckleObject) => {
  if (!obj?.id) return

  const { header, subheader } = getHeaderAndSubheaderForSpeckleObject(obj)
  if (header || subheader) {
    const label = {
      title: header || '',
      subTitle: subheader || ''
    }
    selectedObjectLabelMap.value[obj.id] = label
    selectedObjectLabelMap.value[bimId] = label
  }

  const applicationId = getApplicationIdString(obj)
  if (applicationId) {
    applicationIdByBimId.value[obj.id] = applicationId
    applicationIdByBimId.value[bimId] = applicationId
    // 维护反向映射
    if (!bimIdsByApplicationId.value[applicationId]) {
      bimIdsByApplicationId.value[applicationId] = []
    }
    if (!bimIdsByApplicationId.value[applicationId].includes(obj.id)) {
      bimIdsByApplicationId.value[applicationId].push(obj.id)
    }
    // 标签也对 applicationId 建立映射
    const label = {
      title: header || '',
      subTitle: subheader || ''
    }
    if (header || subheader) {
      selectedObjectLabelMap.value[applicationId] = label
    }
  }
}

const collectMetadataFromViewerTree = (ids: Iterable<string>) => {
  const state = viewerState.value
  if (!state) return
  const tree = getMaybeRefValue(state.viewer.metadata.worldTree as unknown as object)
  if (!tree) return

  Array.from(ids).forEach((id) => {
    const nodes = (tree as { findId: (id: string) => unknown }).findId(id) as Array<{
      model?: { raw?: SpeckleObject }
    }>
    nodes.forEach((node) => {
      const raw = node.model?.raw
      if (!raw?.id) return
      upsertObjectMetadata(id, raw)
    })
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

const filteredApplicationIds = computed(() =>
  Array.isArray(applicationIdsModel.value) ? applicationIdsModel.value : []
)
const selectedCount = computed(() => filteredApplicationIds.value.length)

const projectDisplayName = computed(() => {
  const project = projectOptions.value.find((item) => item.id === activeProjectId.value)
  return project?.name || activeProjectId.value || '-'
})

const modelDisplayName = computed(() => {
  const model = modelOptions.value.find((item) => item.id === modelIdModel.value)
  return model?.name || modelIdModel.value || '-'
})

const getSelectedObjectDisplayName = (id: string) => {
  const item = selectedObjectLabelMap.value[id]
  if (!item) return null
  if (item.title && item.subTitle) return `${item.title}-${item.subTitle}`
  return item.subTitle || item.title || null
}

const triggerSelectedNamesLabel = computed(() => {
  if (!activeProjectId.value) return '请先选择项目'
  if (!modelIdModel.value) return '请先选择模型'
  if (!selectedCount.value) return props.placeholder

  const names = filteredApplicationIds.value
    .map((id) => getSelectedObjectDisplayName(id))
    .filter((name): name is string => !!name)
  if (!names.length) return `已选择 ${selectedCount.value} 个构件`
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 个构件`
})

const triggerSelectedNamesTooltip = computed(() => {
  if (!activeProjectId.value || !modelIdModel.value || !selectedCount.value) {
    return triggerSelectedNamesLabel.value
  }

  const names = filteredApplicationIds.value
    .map((id) => getSelectedObjectDisplayName(id))
    .filter((name): name is string => !!name)
  if (!names.length) return triggerSelectedNamesLabel.value

  return {
    content: names.join('<br>'),
    allowHTML: true,
    maxWidth: 520
  }
})

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
  // draftSelectedIds 存的是 applicationId
  // 需通过 bimIdsByApplicationId 反查对应的 bimId 再求树节点
  Array.from(draftSelectedIds.value).forEach((appId) => {
    const bimIds = bimIdsByApplicationId.value[appId] || []
    if (bimIds.length) {
      bimIds.forEach((bimId) => {
        const nodes = (tree as { findId: (id: string) => unknown }).findId(
          bimId
        ) as Array<{
          model?: { raw?: SpeckleObject }
        }>
        nodes.forEach((node) => {
          if (!node.model?.raw?.id) return
          objects.push(node.model.raw)
          upsertObjectMetadata(bimId, node.model.raw)
        })
      })
    } else {
      // 如果还没进行过映射（首次打开），尝试直接用 appId 查找
      const nodes = (tree as { findId: (id: string) => unknown }).findId(
        appId
      ) as Array<{
        model?: { raw?: SpeckleObject }
      }>
      nodes.forEach((node) => {
        if (!node.model?.raw?.id) return
        objects.push(node.model.raw)
        upsertObjectMetadata(appId, node.model.raw)
      })
    }
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
  // draftSelectedIds 存的是 applicationId，需反查 bimId 后高亮 viewer
  // 直接以 applicationId 为草稿集合，openDrawer 后由 applyDraftSelectionToViewer 同步高亮
  draftSelectedIds.value = new Set(filteredApplicationIds.value)
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
  // draftSelectedIds 此时存的是 applicationId
  const selectedApplicationIds = Array.from(draftSelectedIds.value)
  applicationIdsModel.value = selectedApplicationIds
  open.value = false
  viewerState.value = null
}

const onViewerSetup = (state: InjectableViewerState) => {
  viewerState.value = state
}

watch(selectedObjectsFromViewer, (objects) => {
  objects.forEach((obj) => {
    if (!obj?.id) return
    upsertObjectMetadata(obj.id, obj)
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
    applicationIdsModel.value = []
    applicationIdByBimId.value = {}
    bimIdsByApplicationId.value = {}
    draftSelectedIds.value = new Set()
    open.value = false
    viewerState.value = null
  }
)

watch(
  () => modelIdModel.value,
  (newModelId, oldModelId) => {
    if (newModelId === oldModelId) return
    applicationIdsModel.value = []
    applicationIdByBimId.value = {}
    bimIdsByApplicationId.value = {}
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
  // viewer 返回的是 bimId，需转换为 applicationId 后存入 draftSelectedIds
  collectMetadataFromViewerTree(ids)
  const appIds = ids
    .map((id) => applicationIdByBimId.value[id])
    .filter((id): id is string => !!id)
  draftSelectedIds.value = new Set(appIds.length ? appIds : ids)
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
