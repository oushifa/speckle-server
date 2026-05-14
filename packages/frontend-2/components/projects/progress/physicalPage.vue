<template>
  <div class="flex flex-col h-[calc(100vh-120px)] gap-4 text-foreground">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-heading-lg mt-3">形象进度</h1>
        <p v-if="lastRebuildSummary" class="text-body-xs text-foreground-2 mt-1">
          最近重建：任务 {{ lastRebuildSummary.planTaskCount }} 条，实际记录
          {{ lastRebuildSummary.actualRecordCount }} 条，构件
          {{ lastRebuildSummary.affectedElementCount }} 个
        </p>
      </div>
      <FormButton
        color="outline"
        :disabled="!projectId || isRebuildingSnapshots"
        :submit-disabled="!projectId || isRebuildingSnapshots"
        @click="handleRebuildSnapshots"
      >
        {{ isRebuildingSnapshots ? '重建中...' : '重建快照' }}
      </FormButton>
    </div>

    <div class="flex flex-1 gap-6 min-h-0">
      <div
        class="w-88 flex flex-col bg-foundation rounded-lg border border-outline-2 shadow-sm flex-shrink-0"
      >
        <div class="p-4 border-b border-outline-2 flex items-center gap-2">
          <FolderOpen class="w-5 h-5 text-foreground-2" />
          <span class="font-bold">模型文件树</span>
          <span class="ml-auto text-body-xs text-foreground-2">
            已勾选 {{ selectedModelIds.length }} 个模型
          </span>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="loadingTree" class="px-2 py-3 text-body-sm text-foreground-2">
            模型树加载中...
          </div>
          <div
            v-else-if="!visibleNodes.length"
            class="px-2 py-3 text-body-sm text-foreground-2"
          >
            当前项目暂无可展示的模型
          </div>
          <div
            v-for="node in visibleNodes"
            v-else
            :key="node.id"
            class="w-full flex items-center gap-2 py-2 px-2 rounded text-left transition-colors"
            :class="
              activeNodeId === node.id
                ? 'bg-primary-muted text-primary'
                : 'hover:bg-foundation-2 text-foreground'
            "
            :style="{ paddingLeft: `${node.level * 1.25 + 0.5}rem` }"
            role="button"
            tabindex="0"
            @click="handleNodeClick(node)"
            @keydown.enter.prevent="handleNodeClick(node)"
            @keydown.space.prevent="handleNodeClick(node)"
          >
            <button
              type="button"
              class="w-4 h-4 flex items-center justify-center flex-shrink-0 text-foreground-2"
              :disabled="!node.hasChildren"
              @click.stop="toggleExpand(node.id)"
            >
              <component
                :is="isExpanded(node.id) ? ChevronDown : ChevronRight"
                v-if="node.hasChildren"
                class="w-3.5 h-3.5"
              />
            </button>

            <component
              :is="node.type === 'folder' ? Folder : FileText"
              class="w-4 h-4 flex-shrink-0"
              :class="node.type === 'folder' ? 'text-foreground-2' : 'text-primary'"
            />

            <label
              v-if="node.type === 'model' && node.modelId"
              class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
              @click.stop
            >
              <input
                type="checkbox"
                :checked="isModelSelected(node.modelId)"
                @change="toggleModelSelection(node.modelId)"
              />
              <span class="truncate text-body-sm">
                {{ node.label }}
              </span>
            </label>
            <span v-else class="truncate text-body-sm flex-1">{{ node.label }}</span>

            <span
              v-if="node.type === 'model' && node.updatedAt"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-foundation-2 text-foreground-2"
            >
              {{ formatDate(node.updatedAt) }}
            </span>
          </div>
        </div>

        <div class="p-4 border-t border-outline-2 bg-foundation-2/50 rounded-b-lg">
          <h3 class="font-bold mb-3 text-body-sm">图例</h3>
          <div class="space-y-2">
            <div
              v-for="legendItem in legendItems"
              :key="legendItem.label"
              class="flex items-center gap-2"
            >
              <span
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: legendItem.color }"
              ></span>
              <span class="text-body-xs text-foreground-2">
                {{ legendItem.label }}（{{ legendItem.count }}）
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 flex flex-col gap-4 min-h-0">
        <div
          class="flex-1 bg-foundation-page rounded-lg border border-outline-2 flex flex-col items-center justify-center relative overflow-hidden"
        >
          <div
            v-if="isPreparingViewer"
            class="h-full w-full flex items-center justify-center text-body-sm text-foreground-2"
          >
            正在准备模型与进度快照...
          </div>
          <div
            v-else-if="!selectedModelIds.length"
            class="text-center z-10 flex flex-col items-center p-8 max-w-xl"
          >
            <Box class="w-20 h-20 text-foreground-3 mb-4" />
            <h3 class="text-heading-md font-bold text-foreground-2 mb-2">
              选择左侧模型后预览
            </h3>
            <p class="text-body-sm text-foreground-3">
              左侧支持按树结构展开文件夹并勾选模型，右侧 Viewer 会只展示当前勾选的模型。
            </p>
          </div>
          <CommonModelPropsViewer
            v-else
            v-model:viewer-state="viewerState"
            :project-id="projectId"
            :model-ids="selectedModelIds"
            selection-sidbar-disabled
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-lg border border-outline-2 bg-foundation p-4">
            <div class="text-body-sm font-medium mb-3">进度统计概览</div>
            <div class="grid grid-cols-2 gap-3 text-body-sm">
              <div class="rounded border border-outline-2 bg-foundation-page p-3">
                构件总数：{{ statistics?.totalElements ?? 0 }}
              </div>
              <div class="rounded border border-outline-2 bg-foundation-page p-3">
                已完成：{{ statistics?.finishedElements ?? 0 }}
              </div>
              <div class="rounded border border-outline-2 bg-foundation-page p-3">
                进行中：{{ statistics?.inProgressElements ?? 0 }}
              </div>
              <div class="rounded border border-outline-2 bg-foundation-page p-3">
                完成率：{{ formatPercent(statistics?.completionRate) }}
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-outline-2 bg-foundation p-4">
            <div class="text-body-sm font-medium mb-3">当前模型进度</div>
            <div class="space-y-2 text-body-sm">
              <div>当前项目：{{ projectId || '-' }}</div>
              <div>当前节点：{{ activeNodeSummary.label }}</div>
              <div>节点类型：{{ activeNodeSummary.typeLabel }}</div>
              <div>已勾选模型：{{ selectedModelIds.length }}</div>
              <div>当前构件快照：{{ selectedSnapshots.length }}</div>
              <div>延期完成：{{ delayedSnapshotCount }}</div>
              <div>最近更新：{{ latestSnapshotUpdatedAt }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Box,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen
} from 'lucide-vue-next'
import { FilteringExtension, ViewerEvent } from '@speckle/viewer'
import { gql } from '@apollo/client/core'
import {
  rebuildProgressSnapshots,
  getProgressElementSnapshots,
  getProgressStatistics,
  type RebuildProgressSnapshotsSummary,
  type ProgressElementSnapshot,
  type ProgressElementSnapshotStatus,
  type ProgressStatistics
} from '~/lib/projects/api/progress'
import { latestModelsPaginationQuery } from '~~/lib/projects/graphql/queries'
import { useApolloClient } from '@vue/apollo-composable'
import type { ProjectLatestModelsPaginationQuery } from '~~/lib/common/generated/gql/graphql'
import type { SpeckleObject } from '~/lib/viewer/helpers/sceneExplorer'
import type { InjectableViewerState } from '~/lib/viewer/composables/setup'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

interface FolderItem {
  id: string
  label: string
  parentId: string | null
  updatedAt?: string
  modelIds: string[]
}

interface ModelItem {
  id: string
  label: string
  updatedAt?: string
  folderId: string | null
}

interface VisibleNode {
  id: string
  label: string
  type: 'root' | 'folder' | 'model'
  level: number
  hasChildren: boolean
  modelId?: string
  updatedAt?: string
}

interface PhysicalProgressFolderQueryModel {
  id: string
  name: string
  displayName?: string | null
  updatedAt?: string | null
}

interface PhysicalProgressFolderQueryItem {
  id: string
  name: string
  parentId?: string | null
  updatedAt?: string | null
  models?: PhysicalProgressFolderQueryModel[] | null
}

interface PhysicalProgressFoldersByParentQuery {
  project?: {
    folders?: {
      items?: PhysicalProgressFolderQueryItem[] | null
    } | null
  } | null
}

type ViewerTreeNodeLike = {
  model?: {
    id?: unknown
    raw?: SpeckleObject
  }
  children?: ViewerTreeNodeLike[]
}

type ViewerTreeLike = {
  _root?: {
    children?: ViewerTreeNodeLike[]
  }
  findApplicationId?: (applicationId: string) => ViewerTreeNodeLike[] | null
}

type ViewerResourceItemLike = {
  objectId?: string | null
  modelId?: string | null
}

const getProgressStatusMeta = (status: ProgressElementSnapshotStatus) => {
  switch (status) {
    case 'not_started':
      return { label: '未开始', color: '#9CA3AF' }
    case 'ready_not_started':
      return { label: '待开始', color: '#6B7280' }
    case 'delayed_not_started':
      return { label: '未开始已逾期', color: '#B91C1C' }
    case 'in_progress':
      return { label: '进行中', color: '#F59E0B' }
    case 'in_progress_delayed':
      return { label: '进行中已逾期', color: '#EA580C' }
    case 'finished_ahead':
      return { label: '提前完成', color: '#10B981' }
    case 'finished_on_time':
      return { label: '正常完成', color: '#3B82F6' }
    case 'finished_delayed':
      return { label: '延期完成', color: '#EF4444' }
  }
}

const route = useRoute()
const { triggerNotification } = useGlobalToast()
const ROOT_ID = '__physical_progress_model_root__'
const apiOrigin = useApiOrigin()

const projectFoldersByParentQuery = gql`
  query PhysicalProgressFoldersByParent($projectId: String!, $parentId: String) {
    project(id: $projectId) {
      id
      folders(limit: 100, filter: { parentId: $parentId }) {
        items {
          id
          name
          parentId
          updatedAt
          models {
            id
            name
            displayName
            updatedAt
          }
        }
      }
    }
  }
`

const apollo = useApolloClient().client
const loadingTree = ref(false)
const loadingSnapshots = ref(false)
const loadingStatistics = ref(false)
const isRebuildingSnapshots = ref(false)
const viewerLoadVersion = ref(0)
const activeNodeId = ref<string>(ROOT_ID)
const expandedIds = ref<Set<string>>(new Set([ROOT_ID]))
const folderItems = ref<FolderItem[]>([])
const allModels = ref<ModelItem[]>([])
const selectedModelIds = ref<string[]>([])
const elementSnapshots = ref<ProgressElementSnapshot[]>([])
const statistics = ref<ProgressStatistics | null>(null)
const viewerState = shallowRef<InjectableViewerState | null>(null)
const lastRebuildSummary = ref<RebuildProgressSnapshotsSummary | null>(null)

const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const folderChildrenMap = computed(() => {
  const map = new Map<string, FolderItem[]>()

  const ensure = (key: string) => {
    if (!map.has(key)) map.set(key, [])
    return map.get(key) as FolderItem[]
  }

  ensure(ROOT_ID)
  folderItems.value.forEach((item) => {
    const parentKey = item.parentId || ROOT_ID
    ensure(parentKey).push(item)
  })

  map.forEach((items) => items.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')))
  return map
})

const modelsByFolderMap = computed(() => {
  const map = new Map<string, ModelItem[]>()

  allModels.value.forEach((model) => {
    const folderKey = model.folderId || ROOT_ID
    if (!map.has(folderKey)) {
      map.set(folderKey, [])
    }
    map.get(folderKey)?.push(model)
  })

  map.forEach((items) => items.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')))
  return map
})

const visibleNodes = computed(() => {
  const result: VisibleNode[] = []

  const appendChildren = (parentId: string, level: number) => {
    const folders = folderChildrenMap.value.get(parentId) || []
    folders.forEach((folder) => {
      const childFolderCount = folderChildrenMap.value.get(folder.id)?.length || 0
      const modelCount = modelsByFolderMap.value.get(folder.id)?.length || 0
      result.push({
        id: folder.id,
        label: folder.label,
        type: 'folder',
        level,
        hasChildren: childFolderCount + modelCount > 0,
        updatedAt: folder.updatedAt
      })

      if (expandedIds.value.has(folder.id)) {
        appendChildren(folder.id, level + 1)
      }
    })

    const models = modelsByFolderMap.value.get(parentId) || []
    models.forEach((model) => {
      result.push({
        id: `model:${model.id}:${parentId}`,
        label: model.label,
        type: 'model',
        level,
        hasChildren: false,
        modelId: model.id,
        updatedAt: model.updatedAt
      })
    })
  }

  if (!folderItems.value.length && !allModels.value.length) {
    return result
  }

  if (expandedIds.value.has(ROOT_ID)) {
    appendChildren(ROOT_ID, 0)
  }

  return result
})

const selectedModelIdSet = computed(() => new Set(selectedModelIds.value))
const isPreparingViewer = computed(
  () => loadingTree.value || loadingSnapshots.value || loadingStatistics.value
)

const selectedSnapshots = computed(() => elementSnapshots.value)
const progressStatuses: ProgressElementSnapshotStatus[] = [
  'not_started',
  'ready_not_started',
  'delayed_not_started',
  'in_progress',
  'in_progress_delayed',
  'finished_ahead',
  'finished_on_time',
  'finished_delayed'
]

const delayedSnapshotCount = computed(
  () =>
    selectedSnapshots.value.filter((item) => item.progressStatus === 'finished_delayed')
      .length
)

const latestSnapshotUpdatedAt = computed(() => {
  const latest = selectedSnapshots.value.reduce<{ raw?: string; value: number }>(
    (acc, item) => {
      const raw = item.updatedAt || item.lastReportAt || undefined
      const value = raw ? new Date(raw).getTime() : Number.NaN
      if (!Number.isFinite(value) || value <= acc.value) return acc
      return { raw, value }
    },
    { raw: undefined, value: Number.NEGATIVE_INFINITY }
  )

  return formatDate(latest.raw)
})

const legendItems = computed(() =>
  progressStatuses.map((status) => {
    const meta = getProgressStatusMeta(status)
    return {
      label: meta.label,
      color: meta.color,
      count: selectedSnapshots.value.filter((item) => item.progressStatus === status)
        .length
    }
  })
)

const activeNodeSummary = computed(() => {
  if (activeNodeId.value === ROOT_ID) {
    return {
      label: '模型文件',
      typeLabel: '根节点',
      modelCount: allModels.value.length,
      updatedAt: latestUpdatedAt.value
    }
  }

  const folder = folderItems.value.find((item) => item.id === activeNodeId.value)
  if (folder) {
    return {
      label: folder.label,
      typeLabel: '文件夹',
      modelCount: getFolderModelIds(folder.id).length,
      updatedAt: formatDate(folder.updatedAt)
    }
  }

  const modelId = activeNodeId.value.startsWith('model:')
    ? activeNodeId.value.split(':')[1]
    : activeNodeId.value
  const model = allModels.value.find((item) => item.id === modelId)
  return {
    label: model?.label || '-',
    typeLabel: '模型',
    modelCount: model ? 1 : 0,
    updatedAt: formatDate(model?.updatedAt)
  }
})

const latestUpdatedAt = computed(() => {
  const source =
    selectedModelIds.value.length > 0
      ? allModels.value.filter((item) => selectedModelIdSet.value.has(item.id))
      : allModels.value

  const latest = source.reduce<{ raw?: string; value: number }>(
    (acc, item) => {
      const value = item.updatedAt ? new Date(item.updatedAt).getTime() : Number.NaN
      if (!Number.isFinite(value) || value <= acc.value) return acc
      return { raw: item.updatedAt, value }
    },
    { raw: undefined, value: Number.NEGATIVE_INFINITY }
  )

  return formatDate(latest.raw)
})

const isExpanded = (id: string) => expandedIds.value.has(id)

const isModelSelected = (modelId: string) => selectedModelIdSet.value.has(modelId)

const formatPercent = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value}%` : '-'

const showMessage = (
  title: string,
  description: string,
  type: ToastNotificationType = ToastNotificationType.Danger
) => {
  triggerNotification({
    type,
    title,
    description
  })
}

const showSuccess = (title: string, description: string) => {
  triggerNotification({
    type: ToastNotificationType.Success,
    title,
    description
  })
}

const formatDate = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

function getMaybeRefValue<T>(
  input: T | { value: T } | null | undefined
): T | undefined {
  if (input && typeof input === 'object' && 'value' in input) {
    return (input as { value: T }).value
  }

  return input as T | undefined
}

const getApplicationIdString = (obj: SpeckleObject): string | null => {
  const value = (obj as { applicationId?: unknown })?.applicationId
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const getNodeObjectId = (value: unknown) => {
  const normalized = normalizeString(value)
  if (!normalized) return ''
  return normalized.split('/').reverse()[0] || normalized
}

const selectionKey = (modelId: string, applicationId: string) =>
  `${modelId}::${applicationId}`

const toggleExpand = (id: string) => {
  const target = visibleNodes.value.find((node) => node.id === id)
  if (!target?.hasChildren) return

  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  expandedIds.value = new Set(expandedIds.value)
}

const toggleModelSelection = (modelId: string) => {
  const next = new Set(selectedModelIds.value)
  if (next.has(modelId)) {
    next.delete(modelId)
  } else {
    next.add(modelId)
  }
  selectedModelIds.value = Array.from(next)
}

const handleNodeClick = (node: VisibleNode) => {
  activeNodeId.value = node.id

  if (node.type === 'model' && node.modelId) {
    toggleModelSelection(node.modelId)
    return
  }

  if (node.hasChildren) {
    toggleExpand(node.id)
  }
}

const getFolderModelIds = (folderId: string): string[] => {
  const currentIds = (modelsByFolderMap.value.get(folderId) || []).map(
    (item) => item.id
  )
  const childFolders = folderChildrenMap.value.get(folderId) || []

  childFolders.forEach((folder) => {
    currentIds.push(...getFolderModelIds(folder.id))
  })

  return Array.from(new Set(currentIds))
}

const fetchAllElementSnapshotsByModelId = async (modelId: string) => {
  if (!projectId.value) return []

  const limit = 200
  let page = 1
  const result: ProgressElementSnapshot[] = []

  while (true) {
    const payload = await getProgressElementSnapshots({
      projectId: projectId.value,
      apiOrigin,
      modelId,
      page,
      limit
    })
    result.push(...payload.data)

    if (result.length >= payload.meta.total || payload.data.length < limit) {
      break
    }

    page += 1
  }

  return result
}

const loadStatistics = async () => {
  if (!projectId.value) {
    statistics.value = null
    return
  }

  loadingStatistics.value = true
  try {
    statistics.value = await getProgressStatistics({
      projectId: projectId.value,
      apiOrigin
    })
  } finally {
    loadingStatistics.value = false
  }
}

const loadSelectedModelSnapshots = async () => {
  if (!projectId.value || selectedModelIds.value.length === 0) {
    elementSnapshots.value = []
    return
  }

  loadingSnapshots.value = true
  try {
    const groups = await Promise.all(
      selectedModelIds.value.map((modelId) =>
        fetchAllElementSnapshotsByModelId(modelId)
      )
    )
    elementSnapshots.value = groups.flat()
  } finally {
    loadingSnapshots.value = false
  }
}

const refreshPhysicalProgressData = async () => {
  await Promise.all([loadStatistics(), loadSelectedModelSnapshots()])
}

const handleRebuildSnapshots = async () => {
  if (!projectId.value || isRebuildingSnapshots.value) return

  isRebuildingSnapshots.value = true
  try {
    const summary = await rebuildProgressSnapshots({
      projectId: projectId.value,
      apiOrigin
    })
    lastRebuildSummary.value = summary
    await refreshPhysicalProgressData()
    showSuccess(
      '重建完成',
      `已重建 ${summary.planTaskCount} 条任务、${summary.actualRecordCount} 条实际记录，影响 ${summary.affectedElementCount} 个构件。`
    )
  } catch (error) {
    showMessage('重建失败', error instanceof Error ? error.message : '未能完成快照重建')
  } finally {
    isRebuildingSnapshots.value = false
  }
}

const buildViewerObjectIdsBySelectionKey = () => {
  const state = viewerState.value
  if (!state) return new Map<string, string[]>()

  const tree = getMaybeRefValue(
    state.viewer.metadata.worldTree as unknown as object
  ) as ViewerTreeLike | undefined
  const resourceItems = getMaybeRefValue(
    state.resources.response.resourceItems as unknown as ViewerResourceItemLike[]
  )

  if (!tree?._root?.children?.length || !resourceItems?.length) {
    return new Map<string, string[]>()
  }

  const objectIdsBySelectionKey = new Map<string, Set<string>>()
  const resourceMap = resourceItems.reduce<Record<string, string>>((acc, item) => {
    const objectId = normalizeString(item.objectId)
    const modelId = normalizeString(item.modelId)
    if (objectId && modelId) acc[objectId] = modelId
    return acc
  }, {})

  const visit = (node: ViewerTreeNodeLike, modelId: string) => {
    const raw = node.model?.raw
    const nodeObjectId = getNodeObjectId(node.model?.id)
    const applicationId = raw ? getApplicationIdString(raw) : null

    if (applicationId) {
      const key = selectionKey(modelId, applicationId)
      const set = objectIdsBySelectionKey.get(key) || new Set<string>()
      if (raw?.id) set.add(raw.id)
      if (nodeObjectId) set.add(nodeObjectId)
      objectIdsBySelectionKey.set(key, set)
    }

    ;(node.children || []).forEach((child) => visit(child, modelId))
  }

  ;(tree._root.children || []).forEach((rootNode) => {
    const rootObjectId = getNodeObjectId(rootNode.model?.id)
    const modelId = resourceMap[rootObjectId]
    if (!modelId) return
    visit(rootNode, modelId)
  })

  return new Map(
    Array.from(objectIdsBySelectionKey.entries()).map(([key, value]) => [
      key,
      Array.from(value)
    ])
  )
}

const handleViewerLoadComplete = () => {
  window.setTimeout(() => {
    viewerLoadVersion.value += 1
    applySnapshotColorsToViewer()
  }, 300)
}

const applySnapshotColorsToViewer = () => {
  const state = viewerState.value
  if (!state) return

  const extension = state.viewer.instance.getExtension(FilteringExtension)
  if (!extension) return

  if (!selectedModelIds.value.length || !selectedSnapshots.value.length) {
    extension.removeUserObjectColors()
    return
  }

  const objectIdsBySelectionKey = buildViewerObjectIdsBySelectionKey()
  if (!objectIdsBySelectionKey.size) return

  const objectIdsByColor = new Map<string, Set<string>>()

  selectedSnapshots.value.forEach((snapshot) => {
    const color = getProgressStatusMeta(snapshot.progressStatus).color
    const key = selectionKey(snapshot.modelId, snapshot.applicationId)
    const objectIds = objectIdsBySelectionKey.get(key) || []
    if (!objectIds.length) return

    const current = objectIdsByColor.get(color) || new Set<string>()
    objectIds.forEach((id) => current.add(id))
    objectIdsByColor.set(color, current)
  })

  if (!objectIdsByColor.size) {
    extension.removeUserObjectColors()
    return
  }

  extension.setUserObjectColors(
    Array.from(objectIdsByColor.entries()).map(([color, objectIds]) => ({
      color,
      objectIds: Array.from(objectIds)
    }))
  )
}

const loadAllModels = async () => {
  if (!projectId.value) return []

  const rows: ModelItem[] = []
  let cursor: string | null = null

  while (true) {
    const res = (await apollo.query({
      query: latestModelsPaginationQuery,
      variables: {
        projectId: projectId.value,
        filter: null,
        cursor,
        limit: 100
      },
      fetchPolicy: 'no-cache'
    })) as { data?: ProjectLatestModelsPaginationQuery }

    const items = res.data?.project?.models?.items || []
    rows.push(
      ...items.map((item) => ({
        id: item.id,
        label: item.displayName || item.name,
        updatedAt: item.updatedAt || undefined,
        folderId: null
      }))
    )

    cursor = res.data?.project?.models?.cursor || null
    if (!cursor || items.length === 0) break
  }

  return rows
}

const loadTree = async () => {
  if (!projectId.value) return

  loadingTree.value = true
  try {
    const folders: FolderItem[] = []
    const linkedModels = new Map<string, ModelItem>()

    const traverse = async (parentId: string | null) => {
      const res = await apollo.query<PhysicalProgressFoldersByParentQuery>({
        query: projectFoldersByParentQuery,
        variables: {
          projectId: projectId.value,
          parentId
        },
        fetchPolicy: 'no-cache'
      })

      const items = res.data?.project?.folders?.items || []
      items.forEach((item) => {
        const models = (item.models || []).map((model) => ({
          id: model.id,
          label: model.displayName || model.name,
          updatedAt: model.updatedAt || undefined,
          folderId: item.id
        }))

        folders.push({
          id: item.id,
          label: item.name,
          parentId: item.parentId || null,
          updatedAt: item.updatedAt || undefined,
          modelIds: models.map((model) => model.id)
        })

        models.forEach((model) => linkedModels.set(model.id, model))
      })

      for (const folder of items) {
        await traverse(folder.id)
      }
    }

    await traverse(null)

    const latestModels = await loadAllModels()
    latestModels.forEach((model) => {
      if (!linkedModels.has(model.id)) {
        linkedModels.set(model.id, model)
      }
    })

    folderItems.value = folders
    allModels.value = Array.from(linkedModels.values())
    selectedModelIds.value = selectedModelIds.value.filter((id) => linkedModels.has(id))

    if (!visibleNodes.value.find((node) => node.id === activeNodeId.value)) {
      activeNodeId.value = ROOT_ID
    }
  } finally {
    loadingTree.value = false
  }
}

watch(
  projectId,
  async () => {
    await Promise.all([loadTree(), loadStatistics()])
  },
  { immediate: true }
)

watch(
  () => [...selectedModelIds.value],
  () => {
    loadSelectedModelSnapshots()
  },
  { immediate: true }
)

watch(
  () => [
    viewerState.value,
    selectedSnapshots.value,
    selectedModelIds.value,
    viewerLoadVersion.value
  ],
  () => {
    applySnapshotColorsToViewer()
  },
  { deep: true }
)

watch(
  () => viewerState.value,
  (newState, oldState) => {
    if (oldState) {
      oldState.viewer.instance.removeListener(
        ViewerEvent.LoadComplete,
        handleViewerLoadComplete
      )
    }

    if (newState) {
      newState.viewer.instance.on(ViewerEvent.LoadComplete, handleViewerLoadComplete)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  const state = viewerState.value
  state?.viewer.instance.removeListener(
    ViewerEvent.LoadComplete,
    handleViewerLoadComplete
  )
  const extension = state?.viewer.instance.getExtension(FilteringExtension)
  extension?.removeUserObjectColors()
})
</script>
