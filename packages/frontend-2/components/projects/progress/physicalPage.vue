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
          <div
            v-if="selectedModelIds.length && playbackRange"
            class="absolute right-4 bottom-4 z-20 w-[28rem] max-w-[calc(100%-2rem)] rounded-lg border border-outline-2 bg-foundation-page/95 backdrop-blur shadow-lg p-4"
          >
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <div class="text-body-sm font-bold">进度播放</div>
                <div class="text-body-xs text-foreground-2">
                  当前时间：{{ formattedPlaybackTime }}
                </div>
              </div>
              <div class="relative">
                <button
                  type="button"
                  class="text-body-xs text-foreground-2 hover:text-foreground"
                  @click="showPlaybackSpeedPopover = !showPlaybackSpeedPopover"
                >
                  播放速度：{{ playbackSpeedDaysPerSecond }} 天/秒
                </button>
                <div
                  v-if="showPlaybackSpeedPopover"
                  class="absolute right-0 bottom-[calc(100%+0.5rem)] z-30 w-56 rounded-lg border border-outline-2 bg-foundation-page shadow-lg p-3"
                >
                  <div
                    class="flex items-center justify-between gap-3 text-[11px] text-foreground-2 mb-2"
                  >
                    <span>播放速度</span>
                    <span>{{ playbackSpeedDaysPerSecond }} 天/秒</span>
                  </div>
                  <label for="physical-progress-speed-range" class="sr-only">
                    进度播放速度
                  </label>
                  <input
                    id="physical-progress-speed-range"
                    v-model.number="playbackSpeedDaysPerSecond"
                    type="range"
                    class="w-full accent-primary cursor-pointer"
                    :min="MIN_PLAYBACK_SPEED_DAYS_PER_SECOND"
                    :max="MAX_PLAYBACK_SPEED_DAYS_PER_SECOND"
                    step="1"
                  />
                  <div
                    class="flex items-center justify-between gap-3 text-[11px] text-foreground-2 mt-2"
                  >
                    <span>{{ MIN_PLAYBACK_SPEED_DAYS_PER_SECOND }} 天/秒</span>
                    <span>{{ MAX_PLAYBACK_SPEED_DAYS_PER_SECOND }} 天/秒</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 mb-3">
              <button
                type="button"
                class="h-9 w-9 rounded-md border border-outline-3 flex items-center justify-center hover:bg-foundation-2 disabled:opacity-50"
                :disabled="!canPlayTimeline"
                @click="togglePlayback"
              >
                <component :is="isPlaying ? Pause : Play" class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="h-9 w-9 rounded-md border border-outline-3 flex items-center justify-center hover:bg-foundation-2 disabled:opacity-50"
                :disabled="!playbackRange"
                @click="resetPlayback"
              >
                <RotateCcw class="w-4 h-4" />
              </button>
              <div class="flex-1 min-w-0">
                <label for="physical-progress-playback-range" class="sr-only">
                  进度播放时间
                </label>
                <input
                  id="physical-progress-playback-range"
                  v-model.number="playbackSliderValue"
                  type="range"
                  class="w-full accent-primary cursor-pointer"
                  min="0"
                  :max="playbackSliderMax"
                  step="1"
                  :disabled="!playbackRange"
                />
              </div>
            </div>

            <div
              class="flex items-center justify-between gap-3 text-[11px] text-foreground-2"
            >
              <span>{{ playbackRangeLabelStart }}</span>
              <span>{{ Math.round(playbackProgressPercent) }}%</span>
              <span>{{ playbackRangeLabelEnd }}</span>
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
  FolderOpen,
  Pause,
  Play,
  RotateCcw
} from 'lucide-vue-next'
import { FilteringExtension, ViewerEvent } from '@speckle/viewer'
import { gql } from '@apollo/client/core'
import {
  rebuildProgressSnapshots,
  getProgressElementSnapshots,
  getProgressPlanTasks,
  getProgressStatistics,
  type RebuildProgressSnapshotsSummary,
  type ProgressElementSnapshot,
  type ProgressPlanTask,
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
    atomic?: boolean
  }
  children?: ViewerTreeNodeLike[]
}

type ViewerTreeLike = {
  _root?: {
    children?: ViewerTreeNodeLike[]
  }
  findApplicationId?: (applicationId: string) => ViewerTreeNodeLike[] | null
  findId?: (id: string) => ViewerTreeNodeLike[] | null
}

type ViewerResourceItemLike = {
  objectId?: string | null
  modelId?: string | null
}

type PhysicalProgressDisplayStatus =
  | 'not_started'
  | 'finished_on_time'
  | 'finished_ahead'
  | 'finished_delayed'
  | 'in_progress'

const getProgressStatusMeta = (status: PhysicalProgressDisplayStatus) => {
  switch (status) {
    case 'not_started':
      return { label: '未开始', color: '#9CA3AF' }
    case 'in_progress':
      return { label: '进行中', color: '#F59E0B' }
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
const PLAYBACK_INTERVAL_MS = 100
const DAY_IN_MS = 24 * 60 * 60 * 1000
const DEFAULT_PLAYBACK_SPEED_DAYS_PER_SECOND = 7
const MIN_PLAYBACK_SPEED_DAYS_PER_SECOND = 1
const MAX_PLAYBACK_SPEED_DAYS_PER_SECOND = 30

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
const planTasks = ref<ProgressPlanTask[]>([])
const viewerState = shallowRef<InjectableViewerState | null>(null)
const lastRebuildSummary = ref<RebuildProgressSnapshotsSummary | null>(null)
const currentPlaybackTime = ref<number | null>(null)
const isPlaying = ref(false)
const playbackSpeedDaysPerSecond = ref(DEFAULT_PLAYBACK_SPEED_DAYS_PER_SECOND)
const showPlaybackSpeedPopover = ref(false)
let playbackTimerId: number | null = null

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
const progressStatuses: PhysicalProgressDisplayStatus[] = [
  'not_started',
  'in_progress',
  'finished_ahead',
  'finished_on_time',
  'finished_delayed'
]

const parseDateTime = (value?: string | null) => {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

const getStartOfDayTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const parseDateDayTimestamp = (value?: string | null) => {
  const timestamp = parseDateTime(value)
  return timestamp === null ? null : getStartOfDayTimestamp(timestamp)
}

const compareFinishTiming = (
  actualFinishAt?: string | null,
  plannedStartAt?: string | null,
  plannedFinishAt?: string | null
): PhysicalProgressDisplayStatus => {
  const actualFinish = parseDateDayTimestamp(actualFinishAt)
  const plannedStart = parseDateDayTimestamp(plannedStartAt)
  const plannedFinish = parseDateDayTimestamp(plannedFinishAt)

  if (!actualFinish) return 'finished_on_time'

  if (plannedStart !== null && actualFinish < plannedStart) {
    return 'finished_ahead'
  }

  if (plannedFinish !== null && actualFinish > plannedFinish) {
    return 'finished_delayed'
  }

  return 'finished_on_time'
}

const getSnapshotDisplayStatusAtTime = (
  snapshot: ProgressElementSnapshot,
  timestamp: number
): PhysicalProgressDisplayStatus => {
  const currentDay = getStartOfDayTimestamp(timestamp)
  const plannedStart = parseDateDayTimestamp(snapshot.plannedStartAt)
  const plannedFinish = parseDateDayTimestamp(snapshot.plannedFinishAt)
  const actualStart = parseDateDayTimestamp(snapshot.actualStartAt)
  const actualFinish = parseDateDayTimestamp(snapshot.actualFinishAt)

  // 1. If it has actually finished on or before the current playback day
  if (actualFinish !== null && currentDay >= actualFinish) {
    return compareFinishTiming(snapshot.actualFinishAt, snapshot.plannedStartAt, snapshot.plannedFinishAt)
  }

  // 2. Determine if it has started at the current playback day
  if (actualStart !== null) {
    if (currentDay >= actualStart) {
      return 'in_progress'
    } else {
      return 'not_started'
    }
  }

  // 3. Fallback to planned schedule when there is no actual start info
  if (plannedStart === null && plannedFinish === null) {
    return 'not_started'
  }

  if (plannedStart !== null && currentDay < plannedStart) {
    return 'not_started'
  }

  if (plannedStart !== null || plannedFinish !== null) {
    return 'in_progress'
  }

  return 'not_started'
}

const playbackRange = computed(() => {
  if (!planTasks.value.length) return null

  const topLevel = planTasks.value.filter((task) => task.parentId === null)
  const sourceTasks = topLevel.length
    ? topLevel
    : planTasks.value.filter(
        (task) => task.level === Math.min(...planTasks.value.map((t) => t.level))
      )

  const plannedStarts = sourceTasks
    .map((task) => parseDateTime(task.startDate))
    .filter((value): value is number => value !== null)
  const plannedEnds = sourceTasks
    .map((task) => parseDateTime(task.endDate))
    .filter((value): value is number => value !== null)

  if (!plannedStarts.length && !plannedEnds.length) return null

  const startAt = plannedStarts.length
    ? Math.min(...plannedStarts)
    : Math.min(...plannedEnds)
  const today = getStartOfDayTimestamp(Date.now())

  return {
    startAt,
    endAt: Math.max(today, startAt)
  }
})

const getDefaultPlaybackTime = (range: { startAt: number; endAt: number } | null) => {
  if (!range) return null

  const today = getStartOfDayTimestamp(Date.now())
  if (today < range.startAt) return range.startAt
  if (today > range.endAt) return range.endAt
  return today
}

const effectivePlaybackTime = computed(
  () => currentPlaybackTime.value ?? getDefaultPlaybackTime(playbackRange.value)
)

const playbackSnapshots = computed(() => {
  const timestamp = effectivePlaybackTime.value
  if (!timestamp) return []

  return selectedSnapshots.value.map((snapshot) => ({
    snapshot,
    displayStatus: getSnapshotDisplayStatusAtTime(snapshot, timestamp)
  }))
})

const playbackSliderMax = computed(() => {
  if (!playbackRange.value) return 0
  return Math.max(playbackRange.value.endAt - playbackRange.value.startAt, 0)
})

const playbackSliderValue = computed({
  get: () => {
    if (!playbackRange.value || effectivePlaybackTime.value === null) return 0
    return Math.max(effectivePlaybackTime.value - playbackRange.value.startAt, 0)
  },
  set: (value: number) => {
    if (!playbackRange.value) return
    stopPlayback()
    currentPlaybackTime.value = playbackRange.value.startAt + value
  }
})

const playbackProgressPercent = computed(() => {
  if (!playbackRange.value) return 0
  const total = playbackRange.value.endAt - playbackRange.value.startAt
  if (total <= 0) return 100
  return (playbackSliderValue.value / total) * 100
})

const playbackRangeLabelStart = computed(() =>
  playbackRange.value
    ? formatDateOnly(new Date(playbackRange.value.startAt).toISOString())
    : '-'
)

const playbackRangeLabelEnd = computed(() =>
  playbackRange.value
    ? formatDateOnly(new Date(playbackRange.value.endAt).toISOString())
    : '-'
)

const formattedPlaybackTime = computed(() =>
  effectivePlaybackTime.value
    ? formatDateOnly(new Date(effectivePlaybackTime.value).toISOString())
    : '-'
)

const canPlayTimeline = computed(
  () => !!playbackRange.value && playbackRange.value.endAt > playbackRange.value.startAt
)

const legendItems = computed(() =>
  progressStatuses.map((status) => {
    const meta = getProgressStatusMeta(status)
    return {
      label: meta.label,
      color: meta.color,
      count: playbackSnapshots.value.filter((item) => item.displayStatus === status)
        .length
    }
  })
)

const isExpanded = (id: string) => expandedIds.value.has(id)

const isModelSelected = (modelId: string) => selectedModelIdSet.value.has(modelId)

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

const formatDateOnly = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
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

const getResourceObjectId = (value: unknown) => {
  const normalized = normalizeString(value)
  if (!normalized) return ''
  return normalized.split('/').reverse()[0] || normalized
}

const getViewerObjectId = (value: unknown) => normalizeString(value)
const getFilteringObjectId = (nodeId: unknown, rawId: unknown) => {
  const viewerObjectId = getViewerObjectId(nodeId)
  if (viewerObjectId.length === 32) return viewerObjectId

  const normalizedRawId = normalizeString(rawId)
  if (normalizedRawId.length === 32) return normalizedRawId

  return ''
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

const loadPlanTasks = async () => {
  if (!projectId.value) {
    planTasks.value = []
    return
  }

  try {
    planTasks.value = await getProgressPlanTasks({
      projectId: projectId.value,
      apiOrigin
    })
  } catch (error) {
    planTasks.value = []
    showMessage(
      '加载计划任务失败',
      error instanceof Error ? error.message : '未能获取当前计划任务'
    )
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
  await Promise.all([loadStatistics(), loadPlanTasks(), loadSelectedModelSnapshots()])
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

const buildViewerObjectMaps = () => {
  const state = viewerState.value
  if (!state) {
    return {
      objectIdsBySelectionKey: new Map<string, string[]>(),
      objectIdsByModelId: new Map<string, string[]>()
    }
  }

  const tree = getMaybeRefValue(
    state.viewer.metadata.worldTree as unknown as object
  ) as ViewerTreeLike | undefined
  const resourceItems = getMaybeRefValue(
    state.resources.response.resourceItems as unknown as ViewerResourceItemLike[]
  )

  if (!tree?._root?.children?.length || !resourceItems?.length) {
    return {
      objectIdsBySelectionKey: new Map<string, string[]>(),
      objectIdsByModelId: new Map<string, string[]>()
    }
  }

  const objectIdsBySelectionKey = new Map<string, Set<string>>()
  const objectIdsByModelId = new Map<string, Set<string>>()
  const resourceMap = resourceItems.reduce<Record<string, string>>((acc, item) => {
    const objectId = normalizeString(item.objectId)
    const modelId = normalizeString(item.modelId)
    if (objectId && modelId) acc[objectId] = modelId
    return acc
  }, {})

  const visit = (node: ViewerTreeNodeLike, modelId: string) => {
    const raw = node.model?.raw
    const filteringObjectId = getFilteringObjectId(node.model?.id, raw?.id)
    const applicationId = raw ? getApplicationIdString(raw) : null

    if (filteringObjectId) {
      const modelSet = objectIdsByModelId.get(modelId) || new Set<string>()
      modelSet.add(filteringObjectId)
      objectIdsByModelId.set(modelId, modelSet)
    }

    if (applicationId) {
      const key = selectionKey(modelId, applicationId)
      const set = objectIdsBySelectionKey.get(key) || new Set<string>()
      if (filteringObjectId) {
        set.add(filteringObjectId)
      }
      objectIdsBySelectionKey.set(key, set)
    }

    ;(node.children || []).forEach((child) => visit(child, modelId))
  }

  ;(tree._root.children || []).forEach((rootNode) => {
    const rootObjectId = getResourceObjectId(rootNode.model?.id)
    const modelId = resourceMap[rootObjectId]
    if (!modelId) return
    visit(rootNode, modelId)
  })

  return {
    objectIdsBySelectionKey: new Map(
      Array.from(objectIdsBySelectionKey.entries()).map(([key, value]) => [
        key,
        Array.from(value)
      ])
    ),
    objectIdsByModelId: new Map(
      Array.from(objectIdsByModelId.entries()).map(([modelId, value]) => [
        modelId,
        Array.from(value)
      ])
    )
  }
}

const stopPlayback = () => {
  if (playbackTimerId !== null) {
    window.clearInterval(playbackTimerId)
    playbackTimerId = null
  }
  isPlaying.value = false
}

const resetPlayback = () => {
  stopPlayback()
  currentPlaybackTime.value = getDefaultPlaybackTime(playbackRange.value)
}

const startPlayback = () => {
  if (!playbackRange.value || !canPlayTimeline.value) return
  if (
    currentPlaybackTime.value === null ||
    currentPlaybackTime.value >= playbackRange.value.endAt
  ) {
    currentPlaybackTime.value = getDefaultPlaybackTime(playbackRange.value)
  }

  stopPlayback()
  isPlaying.value = true
  playbackTimerId = window.setInterval(() => {
    if (!playbackRange.value || currentPlaybackTime.value === null) {
      stopPlayback()
      return
    }

    const nextTime =
      currentPlaybackTime.value +
      (playbackSpeedDaysPerSecond.value * DAY_IN_MS * PLAYBACK_INTERVAL_MS) / 1000

    if (nextTime >= playbackRange.value.endAt) {
      currentPlaybackTime.value = playbackRange.value.endAt
      stopPlayback()
      return
    }

    currentPlaybackTime.value = nextTime
  }, PLAYBACK_INTERVAL_MS)
}

const togglePlayback = () => {
  if (isPlaying.value) {
    stopPlayback()
  } else {
    startPlayback()
  }
  showPlaybackSpeedPopover.value = false
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

  if (!selectedModelIds.value.length) {
    extension.resetFilters()
    extension.removeUserObjectColors()
    return
  }

  const { objectIdsBySelectionKey, objectIdsByModelId } = buildViewerObjectMaps()
  const activeLinkedObjectIds = playbackSnapshots.value
    .filter(({ displayStatus }) => displayStatus !== 'not_started')
    .flatMap(({ snapshot }) => {
      const key = selectionKey(snapshot.modelId, snapshot.applicationId)
      return objectIdsBySelectionKey.get(key) || []
    })
  const activeLinkedObjectIdSet = new Set(activeLinkedObjectIds)
  const ghostObjectIds = selectedModelIds.value.flatMap((modelId) =>
    (objectIdsByModelId.get(modelId) || []).filter(
      (id) => !activeLinkedObjectIdSet.has(id)
    )
  )
  extension.resetFilters()
  if (ghostObjectIds.length) {
    extension.hideObjects(ghostObjectIds, 'physical-progress-ghost', false, true)
  }

  if (!objectIdsBySelectionKey.size || !playbackSnapshots.value.length) {
    extension.removeUserObjectColors()
    return
  }

  const objectIdsByColor = new Map<string, Set<string>>()

  playbackSnapshots.value.forEach(({ snapshot, displayStatus }) => {
    if (displayStatus === 'not_started') return
    const color = getProgressStatusMeta(displayStatus).color
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
    await Promise.all([loadTree(), loadStatistics(), loadPlanTasks()])
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
  playbackRange,
  (range) => {
    stopPlayback()
    currentPlaybackTime.value = getDefaultPlaybackTime(range)
  },
  { immediate: true }
)

watch(
  () => [
    viewerState.value,
    playbackSnapshots.value,
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
  stopPlayback()
  const state = viewerState.value
  state?.viewer.instance.removeListener(
    ViewerEvent.LoadComplete,
    handleViewerLoadComplete
  )
  const extension = state?.viewer.instance.getExtension(FilteringExtension)
  extension?.resetFilters()
  extension?.removeUserObjectColors()
})
</script>
