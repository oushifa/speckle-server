<template>
  <div class="flex flex-col gap-4 text-foreground">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-heading-lg mt-3">进度计划</h1>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <FormButton
          size="sm"
          color="primary"
          :icon-left="Upload"
          :disabled="isImporting"
          @click="triggerPlanImport"
        >
          {{ isImporting ? '上传中...' : '导入 / 更新 计划' }}
        </FormButton>
        <FormButton
          size="sm"
          color="outline"
          :icon-left="Download"
          :disabled="!latestPlanFile"
          @click="handleDownloadPlanFile"
        >
          下载计划文件
        </FormButton>
        <input
          ref="planImportInputRef"
          type="file"
          class="hidden"
          accept=".mpp"
          aria-label="导入进度计划文件"
          @change="handlePlanImportChange"
        />
      </div>
    </div>

    <div
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden"
    >
      <div
        v-if="isLoadingTasks"
        class="px-4 py-10 text-center text-body-sm text-foreground-2 border-b border-outline-2"
      >
        正在加载计划任务...
      </div>
      <div
        v-else-if="!items.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2 border-b border-outline-2"
      >
        {{
          latestPlanFile
            ? '当前已上传计划文件，等待后端解析并写入任务树。'
            : '当前还没有计划任务，请先导入 `.mpp` 文件。'
        }}
      </div>
      <LayoutTable :columns="columns" :items="treeItems" class="w-full">
        <template #wbs="{ item }">
          <span class="text-body-sm">{{ item.wbs }}</span>
        </template>
        <template #taskName="{ item }">
          <div class="min-w-0 py-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate font-medium text-body-sm">
                {{ item.taskName }}
              </span>
              <span
                v-if="item.milestoneType"
                v-tippy="getMilestoneTooltipProps(item)"
                class="inline-flex shrink-0"
                :class="getMilestoneIconClass(item.milestoneType)"
              >
                <Flag class="h-3.5 w-3.5" />
              </span>
              <span
                v-if="item.isCriticalTask"
                v-tippy="criticalTaskTooltipProps"
                class="inline-flex shrink-0 text-warning-darker"
              >
                <Star class="h-3.5 w-3.5 fill-current" />
              </span>
            </div>
          </div>
        </template>

        <template #duration="{ item }">
          <span class="text-body-sm">{{ item.duration }}</span>
        </template>

        <template #startDate="{ item }">
          <span class="text-body-sm">{{ item.startDate }}</span>
        </template>

        <template #endDate="{ item }">
          <span class="text-body-sm">{{ item.endDate }}</span>
        </template>

        <template #predecessor="{ item }">
          <span class="text-body-sm">{{ item.predecessor || '-' }}</span>
        </template>

        <template #taskStatus="{ item }">
          <div class="flex flex-col items-start gap-1">
            <!-- <div
              v-if="!item.hasChildren"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-nowrap"
              :class="getTaskStatusBadgeClass(item.taskStatus)"
            >
              {{ getTaskStatusText(item.taskStatus) }}
            </div> -->
            <span
              v-if="typeof item.completionRate === 'number'"
              class="text-body-xs text-foreground-2"
            >
              完成率 {{ item.completionRate }}%
            </span>
            <!-- <span v-if="item.hasChildren" class="text-body-xs text-foreground-2">
              子任务 {{ item.totalTaskCount }}，完成
              {{ item.finishedTaskCount || 0 }}，逾期
              {{ item.delayedTaskCount || 0 }}
            </span> -->
          </div>
        </template>

        <template #status="{ item }">
          <template v-if="item.hasChildren">
            <div
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-nowrap bg-foundation-2 text-foreground-2"
            >
              -
            </div>
          </template>
          <div
            v-else
            role="button"
            tabindex="0"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-nowrap"
            :class="
              item.applicationIds.length
                ? 'bg-success-lighter text-success-darker cursor-pointer'
                : 'bg-foundation-2 text-foreground-2'
            "
            @click="openAssociatedModelDrawer(item)"
            @keydown.enter="openAssociatedModelDrawer(item)"
            @keydown.space="openAssociatedModelDrawer(item)"
          >
            {{ item.applicationIds.length ? '已关联BIM模型' : '未关联' }}
          </div>
        </template>

        <template #operation="{ item }">
          <div class="flex items-center justify-center gap-2">
            <FormButton
              v-if="item.canEditBimAssociation"
              color="outline"
              :icon-left="Link2"
              hide-text
              @click.stop="openLinkDialog(item)"
            ></FormButton>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-outline-3 bg-foundation text-foreground-2 transition hover:bg-primary-muted hover:text-primary"
              :class="item.milestoneType ? 'border-primary text-primary' : ''"
              :aria-label="`设置里程碑：${item.taskName}`"
              @click.stop="openMarkerDialog(item)"
            >
              <Flag class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-outline-3 bg-foundation text-foreground-2 transition hover:bg-warning-lighter hover:text-warning-darker"
              :class="
                item.isCriticalTask
                  ? 'border-warning text-warning-darker bg-warning-lighter'
                  : ''
              "
              :aria-label="`${item.isCriticalTask ? '取消' : '标记'}关键任务：${
                item.taskName
              }`"
              @click.stop="toggleCriticalTask(item)"
            >
              <Star
                class="h-4 w-4"
                :class="item.isCriticalTask ? 'fill-current' : ''"
              />
            </button>
          </div>
        </template>
      </LayoutTable>
    </div>

    <LayoutDialog
      v-model:open="markerDialogOpen"
      max-width="lg"
      :buttons="markerDialogButtons"
    >
      <template #header>
        {{
          selectedMarkerTask
            ? `设置里程碑：${selectedMarkerTask.taskName}`
            : '设置里程碑'
        }}
      </template>
      <div v-if="selectedMarkerTask" class="space-y-4">
        <div class="rounded border border-outline-2 bg-foundation-page p-3">
          <div class="text-body-xs text-foreground-2">任务信息</div>
          <div class="mt-1 text-body-sm font-medium text-foreground">
            {{ selectedMarkerTask.taskName }}
          </div>
          <div class="mt-1 text-body-xs text-foreground-2">
            层级：{{ selectedMarkerTask.wbs || '-' }}
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <div class="text-body-sm font-medium text-foreground">里程碑</div>
            <div class="mt-1 text-body-xs text-foreground-2">
              选择里程碑类型后，可填写节点说明。
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
            <button
              v-for="option in milestoneTypeOptions"
              :key="option.value || 'none'"
              type="button"
              class="rounded-lg border px-3 py-3 text-left transition"
              :class="
                markerFormMilestoneType === option.value
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-outline-2 bg-foundation-page text-foreground hover:border-outline-3'
              "
              @click="markerFormMilestoneType = option.value"
            >
              <div class="text-body-sm font-medium">{{ option.label }}</div>
              <div class="mt-1 text-body-3xs text-foreground-2">
                {{ option.description }}
              </div>
            </button>
          </div>

          <div v-if="markerFormMilestoneType" class="space-y-2">
            <label
              for="progress-task-milestone-description"
              class="text-body-sm font-medium text-foreground"
            >
              里程碑描述
            </label>
            <textarea
              id="progress-task-milestone-description"
              v-model="markerFormMilestoneDescription"
              rows="4"
              maxlength="500"
              class="w-full rounded-lg border border-outline-3 bg-foundation-page px-3 py-2 text-body-sm outline-none transition focus:border-primary"
              placeholder="输入里程碑说明，例如项目整体竣工、阶段验收完成等"
            />
            <div class="text-right text-body-3xs text-foreground-2">
              {{ markerFormMilestoneDescription.length }}/500
            </div>
          </div>
        </div>
      </div>
    </LayoutDialog>

    <LayoutDialog
      v-model:open="linkDialogOpen"
      max-width="lg"
      :buttons="linkDialogButtons"
    >
      <template #header>
        {{ selectedTask ? `BIM关联：${selectedTask.taskName}` : 'BIM关联' }}
      </template>
      <div v-if="selectedTask" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="rounded border border-outline-2 bg-foundation-page p-3">
            <div class="text-body-xs text-foreground-2">计划开始</div>
            <div class="text-body-sm font-medium mt-1">
              {{ selectedTask.startDate }}
            </div>
          </div>
          <div class="rounded border border-outline-2 bg-foundation-page p-3">
            <div class="text-body-xs text-foreground-2">计划完成</div>
            <div class="text-body-sm font-medium mt-1">{{ selectedTask.endDate }}</div>
          </div>
        </div>
        <div
          class="rounded border border-dashed border-outline-3 p-4 bg-foundation-page"
        >
          <CommonModelObjectMultiModelSelectDrawer
            v-model:model_ids="draftModelIds"
            v-model:selections="draftSelections"
            :project-id="projectId"
            placeholder="选择与计划任务关联的模型构件"
          />
        </div>
        <div class="text-body-xs text-foreground-2">
          当前已选择 {{ draftSelectedObjectCount }} 个构件，涉及
          {{ draftSelectedModelCount }} 个模型，保存后将按 `modelId + applicationId`
          建立任务与模型的关联关系。
        </div>
      </div>
    </LayoutDialog>

    <LayoutDrawer
      v-model:open="associatedModelDrawerOpen"
      placement="right"
      width="95%"
      body-classes="p-4"
    >
      <template #title>
        关联模型查看
        <span v-if="selectedAssociationTask" class="text-sm text-foreground-2">
          | {{ selectedAssociationTask.taskName || selectedAssociationTask.wbs || '-' }}
        </span>
      </template>
      <div class="h-[85vh] relative">
        <CommonModelPropsViewer
          v-if="selectedAssociationModelIds.length"
          :project-id="projectId"
          :model-ids="selectedAssociationModelIds"
          :filter-bims="selectedAssociationBimIds"
          :filter-application-ids="selectedAssociationApplicationIds"
        />
        <div v-else class="h-full flex items-center justify-center text-foreground-2">
          未找到关联模型
        </div>
      </div>
    </LayoutDrawer>
  </div>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import { Download, Flag, Link2, Star, Upload } from 'lucide-vue-next'
import {
  CommonModelObjectMultiModelSelectDrawer,
  CommonModelPropsViewer
} from '#components'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import {
  downloadLatestProgressPlanFile,
  getLatestProgressPlanFile,
  getProgressPlanTasks,
  updateProgressPlanTaskMarker,
  updateProgressPlanTaskBimAssociation,
  uploadProgressPlanFile,
  type ProgressPlanFile,
  type ProgressPlanTask,
  type ProgressPlanTaskBimSelection,
  type ProgressPlanTaskMilestoneType,
  type ProgressTaskSnapshotStatus
} from '~/lib/projects/api/progress'

interface ScheduleItem {
  id: string
  wbs?: string
  taskName: string
  duration: string
  startDate: string
  endDate: string
  milestoneType: ProgressPlanTaskMilestoneType | null
  milestoneDescription: string | null
  isCriticalTask: boolean
  predecessor?: string
  inspection?: string
  sortOrder: number
  level: number
  parentId?: string
  children?: ScheduleItem[]
  modelId: string | null
  modelIds: string[]
  applicationIds: string[]
  selections: ProgressPlanTaskBimSelection[]
  BIM?: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  hasChildren: boolean
  canEditBimAssociation: boolean
  taskStatus: ProgressTaskSnapshotStatus | null
  completionRate: number
  totalElementCount: number
  finishedElementCount: number
  inProgressElementCount: number
  notStartedElementCount: number
  delayedElementCount: number
  totalTaskCount: number
  linkedTaskCount: number
  finishedTaskCount: number
  delayedTaskCount: number
}

const milestoneTypeOptions: Array<{
  value: ProgressPlanTaskMilestoneType | null
  label: string
  description: string
}> = [
  { value: null, label: '不设置', description: '移除当前里程碑标记' },
  { value: 'project', label: '项目级', description: '整个项目的重要节点' },
  { value: 'phase', label: '阶段级', description: '工程阶段完成节点' },
  { value: 'acceptance', label: '验收级', description: '质量或专项验收节点' }
]

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

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

const normalizeSelections = (
  selections: ProgressPlanTaskBimSelection[] | null | undefined
): ProgressPlanTaskBimSelection[] =>
  (Array.isArray(selections) ? selections : [])
    .map((group) => ({
      modelId: normalizeString(group?.modelId),
      applicationIds: uniqueStrings(group?.applicationIds || [])
    }))
    .filter((group) => group.modelId && group.applicationIds.length > 0)

const getTaskBimSummary = (task: {
  BIM?: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
}) => {
  const BIM = task.BIM || []
  const modelIds = uniqueStrings(BIM.map((e) => e.modelId))
  const applicationIds = uniqueStrings(BIM.flatMap((e) => e.applicationIds))
  const selections = BIM.map((e) => ({
    modelId: e.modelId,
    applicationIds: e.applicationIds
  }))
  return {
    BIM,
    modelId: modelIds.length === 1 ? modelIds[0] : null,
    modelIds,
    applicationIds,
    selections
  }
}

const normalizeScheduleItem = (item: ScheduleItem): ScheduleItem => ({
  ...item,
  ...getTaskBimSummary(item),
  children: item.children || []
})

const columns = [
  { id: 'wbs', header: '层级', classes: 'col-span-1' },
  { id: 'taskName', header: '任务名称', classes: 'col-span-3' },
  { id: 'duration', header: '工期', classes: 'col-span-1' },
  { id: 'startDate', header: '开始时间', classes: 'col-span-1' },
  { id: 'endDate', header: '完成时间', classes: 'col-span-1' },
  { id: 'predecessor', header: '前置任务', classes: 'col-span-1' },
  { id: 'taskStatus', header: '任务状态', classes: 'col-span-1' },
  { id: 'status', header: '关联状态', classes: 'col-span-1' },
  { id: 'operation', header: '操作', classes: 'col-span-1 flex justify-center' }
]

const route = useRoute()
const { triggerNotification } = useGlobalToast()
const apiOrigin = useApiOrigin()
const { getTooltipProps } = useSmartTooltipDelay()
const criticalTaskTooltipProps = getTooltipProps(
  {
    content: '<div>关键任务（中优先级）</div><div>项目关键路径任务，需重点关注</div>',
    allowHTML: true
  },
  {
    maxWidth: 320
  }
)

const items = ref<ScheduleItem[]>([])
const treeItems = ref<ScheduleItem[]>([])
const planImportInputRef = ref<HTMLInputElement | null>(null)
const latestPlanFile = ref<ProgressPlanFile | null>(null)
const planFileName = ref('未上传计划文件')
const lastImportedAt = ref('')
const isImporting = ref(false)
const isLoadingTasks = ref(false)
const isSavingLink = ref(false)
const linkDialogOpen = ref(false)
const markerDialogOpen = ref(false)
const selectedTaskId = ref<string | null>(null)
const selectedMarkerTaskId = ref<string | null>(null)
const draftModelIds = ref<string[]>([])
const draftSelections = ref<ProgressPlanTaskBimSelection[]>([])
const markerFormMilestoneType = ref<ProgressPlanTaskMilestoneType | null>(null)
const markerFormMilestoneDescription = ref('')
const isSavingMarker = ref(false)
const associatedModelDrawerOpen = ref(false)
const selectedAssociationTaskId = ref<string | null>(null)
const selectedAssociationModelIds = ref<string[]>([])
const selectedAssociationBimIds = ref<string[]>([])
const selectedAssociationApplicationIds = ref<string[]>([])

const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const draftSelectedObjectCount = computed(() =>
  draftSelections.value.reduce((count, group) => count + group.applicationIds.length, 0)
)

const draftSelectedModelCount = computed(() => draftModelIds.value.length)

const formatPlanDate = (value: string | null) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('zh-CN')
}

const mapTaskRecordToItem = (task: ProgressPlanTask): ScheduleItem => ({
  id: task.id,
  wbs: task.wbs || undefined,
  taskName: task.taskName,
  duration: task.duration || '-',
  startDate: formatPlanDate(task.startDate),
  endDate: formatPlanDate(task.endDate),
  milestoneType: task.milestoneType,
  milestoneDescription: task.milestoneDescription,
  isCriticalTask: task.isCriticalTask,
  predecessor: task.predecessor || undefined,
  inspection: task.inspection || undefined,
  sortOrder: task.sortOrder,
  level: task.level || 0,
  parentId: task.parentId || undefined,
  children: [],
  ...getTaskBimSummary(task),
  hasChildren: task.hasChildren,
  canEditBimAssociation: task.canEditBimAssociation,
  taskStatus: task.taskStatus,
  completionRate: task.completionRate,
  totalElementCount: task.totalElementCount,
  finishedElementCount: task.finishedElementCount,
  inProgressElementCount: task.inProgressElementCount,
  notStartedElementCount: task.notStartedElementCount,
  delayedElementCount: task.delayedElementCount,
  totalTaskCount: task.totalTaskCount,
  linkedTaskCount: task.linkedTaskCount,
  finishedTaskCount: task.finishedTaskCount,
  delayedTaskCount: task.delayedTaskCount
})

const getParentWbs = (wbs?: string) => {
  if (!wbs) return null
  const segments = wbs.split('.').filter(Boolean)
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('.')
}

const getWbsLevel = (wbs?: string, fallbackLevel = 0) => {
  if (!wbs) return fallbackLevel
  const segments = wbs.split('.').filter(Boolean)
  return Math.max(segments.length - 1, 0)
}

const parseWbsSegments = (wbs?: string) => {
  if (!wbs) return []
  return wbs
    .split('.')
    .filter(Boolean)
    .map((segment) => Number.parseInt(segment, 10))
}

const compareWbs = (left?: string, right?: string) => {
  if (!left && !right) return 0
  if (left && !right) return -1
  if (!left && right) return 1

  const leftSegments = parseWbsSegments(left)
  const rightSegments = parseWbsSegments(right)
  const maxLength = Math.max(leftSegments.length, rightSegments.length)

  for (let index = 0; index < maxLength; index++) {
    const leftSegment = leftSegments[index]
    const rightSegment = rightSegments[index]

    if (leftSegment === undefined) return -1
    if (rightSegment === undefined) return 1
    if (leftSegment !== rightSegment) return leftSegment - rightSegment
  }

  return 0
}

const rebuildTaskTree = (taskItems: ScheduleItem[]) => {
  const orderedItems = [...taskItems]
    .map((item) => normalizeScheduleItem(item))
    .sort((left, right) => {
      const wbsOrder = compareWbs(left.wbs, right.wbs)
      if (wbsOrder !== 0) {
        return wbsOrder
      }

      if (!left.wbs && !right.wbs && left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }

      if (left.taskName !== right.taskName) {
        return left.taskName.localeCompare(right.taskName, 'zh-CN')
      }

      return left.sortOrder - right.sortOrder
    })

  const originalParentIds = new Map(
    orderedItems.map((item) => [item.id, item.parentId || undefined])
  )
  const itemMap = new Map(orderedItems.map((item) => [item.id, item]))
  const itemByWbs = new Map(
    orderedItems.flatMap((item) => (item.wbs ? [[item.wbs, item] as const] : []))
  )

  itemMap.forEach((item) => {
    item.children = []
    item.parentId = undefined
    item.level = getWbsLevel(item.wbs, item.level)
  })

  const rootItems: ScheduleItem[] = []

  orderedItems.forEach((item) => {
    const wbsParent = getParentWbs(item.wbs)
    const originalParentId = originalParentIds.get(item.id)
    const parent = item.wbs
      ? wbsParent
        ? itemByWbs.get(wbsParent)
        : undefined
      : originalParentId
      ? itemMap.get(originalParentId)
      : undefined

    if (!parent) {
      rootItems.push(item)
      return
    }

    item.parentId = parent.id
    item.level = parent.level + 1
    parent.children = [...(parent.children || []), item]
  })

  items.value = orderedItems
  treeItems.value = rootItems
}

const selectedTask = computed(
  () => items.value.find((item) => item.id === selectedTaskId.value) || null
)

const selectedMarkerTask = computed(
  () => items.value.find((item) => item.id === selectedMarkerTaskId.value) || null
)

const selectedAssociationTask = computed(
  () => items.value.find((item) => item.id === selectedAssociationTaskId.value) || null
)

const markerDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      markerDialogOpen.value = false
    }
  },
  {
    text: isSavingMarker.value ? '保存中...' : '保存标记',
    props: { color: 'primary' },
    onClick: () => {
      saveTaskMarker()
    }
  }
])

const linkDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      linkDialogOpen.value = false
    }
  },
  {
    text: '保存关联',
    props: { color: 'primary' },
    onClick: () => {
      saveTaskLink()
    }
  }
])

const showSuccess = (title: string, description: string) => {
  triggerNotification({
    type: ToastNotificationType.Success,
    title,
    description
  })
}

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

const getMilestoneTypeLabel = (type: ProgressPlanTaskMilestoneType | null) => {
  switch (type) {
    case 'project':
      return '项目级里程碑'
    case 'phase':
      return '阶段级里程碑'
    case 'acceptance':
      return '验收级里程碑'
    default:
      return '里程碑'
  }
}

const getMilestoneIconClass = (type: ProgressPlanTaskMilestoneType | null) => {
  switch (type) {
    case 'project':
      return 'text-primary'
    case 'phase':
      return 'text-info'
    case 'acceptance':
      return 'text-success'
    default:
      return 'text-foreground-2'
  }
}

const getMilestoneTooltipProps = (item: ScheduleItem) =>
  getTooltipProps(
    {
      content: [
        `<div>${getMilestoneTypeLabel(item.milestoneType)}</div>`,
        item.milestoneDescription ? `<div>${item.milestoneDescription}</div>` : ''
      ].join(''),
      allowHTML: true
    },
    {
      maxWidth: 360
    }
  )

const applyPlanFileState = (file: ProgressPlanFile | null) => {
  latestPlanFile.value = file
  planFileName.value = file?.fileName || '未上传计划文件'
  lastImportedAt.value = file?.updatedAt
    ? new Date(file.updatedAt).toLocaleString('zh-CN', { hour12: false })
    : ''
}

const fetchLatestPlanFile = async () => {
  if (!projectId.value) return

  try {
    const file = await getLatestProgressPlanFile({
      projectId: projectId.value,
      apiOrigin
    })
    applyPlanFileState(file)
  } catch (error) {
    showMessage(
      '加载计划文件失败',
      error instanceof Error ? error.message : '未能获取当前计划文件信息'
    )
  }
}

const fetchPlanTasks = async () => {
  if (!projectId.value) {
    items.value = []
    return
  }

  isLoadingTasks.value = true
  try {
    const tasks = await getProgressPlanTasks({
      projectId: projectId.value,
      apiOrigin
    })
    rebuildTaskTree(tasks.map(mapTaskRecordToItem))
  } catch (error) {
    items.value = []
    treeItems.value = []
    showMessage(
      '加载计划任务失败',
      error instanceof Error ? error.message : '未能获取当前计划任务'
    )
  } finally {
    isLoadingTasks.value = false
  }
}

const triggerPlanImport = () => {
  planImportInputRef.value?.click()
}

const handlePlanImportChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!projectId.value) {
    showMessage(
      '上传失败',
      '当前未识别项目ID，无法上传计划文件。',
      ToastNotificationType.Warning
    )
    input.value = ''
    return
  }

  if (!file.name.toLowerCase().endsWith('.mpp')) {
    showMessage(
      '上传失败',
      '仅支持上传 `.mpp` 格式的计划文件。',
      ToastNotificationType.Warning
    )
    input.value = ''
    return
  }

  isImporting.value = true
  try {
    const uploadResult = await uploadProgressPlanFile({
      projectId: projectId.value,
      file,
      apiOrigin
    })
    applyPlanFileState(uploadResult.data)
    await fetchPlanTasks()
    const summary = uploadResult.importSummary

    if (summary?.status === 'completed') {
      showSuccess(
        '计划文件已上传并解析',
        `已保存 ${uploadResult.data.fileName}，导入 ${summary.importedTaskCount} 条计划任务。`
      )
    } else if (summary?.status === 'failed') {
      showMessage(
        '计划文件已上传，但解析失败',
        summary.error || '原始文件已保存，请检查后端解析日志。',
        ToastNotificationType.Warning
      )
    } else {
      showSuccess('计划文件已上传', `已保存最新计划文件：${uploadResult.data.fileName}`)
    }
  } catch (error) {
    showMessage('计划文件上传失败', error instanceof Error ? error.message : '上传失败')
  } finally {
    isImporting.value = false
    input.value = ''
  }
}

const handleDownloadPlanFile = async () => {
  if (!projectId.value || !latestPlanFile.value) {
    showMessage(
      '无法下载',
      '当前项目还没有可下载的计划文件。',
      ToastNotificationType.Warning
    )
    return
  }

  try {
    await downloadLatestProgressPlanFile({
      projectId: projectId.value,
      apiOrigin,
      fallbackFileName: latestPlanFile.value.fileName
    })
    showSuccess('下载成功', `已下载 ${latestPlanFile.value.fileName}`)
  } catch (error) {
    showMessage('计划文件下载失败', error instanceof Error ? error.message : '下载失败')
  }
}

const openLinkDialog = (item: ScheduleItem) => {
  if (!item.canEditBimAssociation) return
  selectedTaskId.value = item.id
  draftModelIds.value = [...(item.modelIds || [])]
  draftSelections.value = normalizeSelections(item.selections)
  linkDialogOpen.value = true
}

const openMarkerDialog = (item: ScheduleItem) => {
  selectedMarkerTaskId.value = item.id
  markerFormMilestoneType.value = item.milestoneType
  markerFormMilestoneDescription.value = item.milestoneDescription || ''
  markerDialogOpen.value = true
}

const openAssociatedModelDrawer = (item: ScheduleItem) => {
  if (item.hasChildren) return
  selectedAssociationTaskId.value = item.id
  selectedAssociationModelIds.value = uniqueStrings(item.modelIds || [])
  selectedAssociationApplicationIds.value = uniqueStrings(item.applicationIds || [])
  // Progress plan links currently persist applicationIds without separate bimIds.
  // Reuse applicationIds as fallback lookup keys so CommonModelPropsViewer can isolate them.
  selectedAssociationBimIds.value = [...selectedAssociationApplicationIds.value]
  associatedModelDrawerOpen.value = true
}

const applyLocalTaskMarkerState = (task: ProgressPlanTask) => {
  const target = items.value.find((item) => item.id === task.id)
  if (!target) return

  target.milestoneType = task.milestoneType
  target.milestoneDescription = task.milestoneDescription
  target.isCriticalTask = task.isCriticalTask
}

const saveTaskLink = async () => {
  if (!selectedTask.value) return
  if (!projectId.value) return

  isSavingLink.value = true
  try {
    const BIM = draftSelections.value.map((sel) => ({
      modelId: sel.modelId,
      applicationIds: sel.applicationIds,
      bimIds: sel.applicationIds.map(() => null)
    }))
    const updated = await updateProgressPlanTaskBimAssociation({
      projectId: projectId.value,
      taskId: selectedTask.value.id,
      BIM,
      apiOrigin
    })
    await fetchPlanTasks()
    linkDialogOpen.value = false
    showSuccess(
      'BIM关联已更新',
      `任务“${updated.taskName}”已保存 ${
        getTaskBimSummary(updated).applicationIds.length
      } 个构件关联。`
    )
  } catch (error) {
    showMessage(
      'BIM关联保存失败',
      error instanceof Error ? error.message : '保存任务 BIM 关联失败'
    )
  } finally {
    isSavingLink.value = false
  }
}

const saveTaskMarker = async () => {
  if (!selectedMarkerTask.value) return
  if (!projectId.value) return

  isSavingMarker.value = true
  try {
    const updated = await updateProgressPlanTaskMarker({
      projectId: projectId.value,
      taskId: selectedMarkerTask.value.id,
      milestoneType: markerFormMilestoneType.value,
      milestoneDescription: markerFormMilestoneType.value
        ? markerFormMilestoneDescription.value.trim()
        : null,
      isCriticalTask: selectedMarkerTask.value.isCriticalTask,
      apiOrigin
    })
    applyLocalTaskMarkerState(updated)
    markerDialogOpen.value = false

    showSuccess(
      '里程碑已更新',
      updated.milestoneType
        ? `任务“${updated.taskName}”已设置为${getMilestoneTypeLabel(
            updated.milestoneType
          )}。`
        : `任务“${updated.taskName}”已移除里程碑标记。`
    )
  } catch (error) {
    showMessage(
      '里程碑保存失败',
      error instanceof Error ? error.message : '保存里程碑失败'
    )
  } finally {
    isSavingMarker.value = false
  }
}

const toggleCriticalTask = async (item: ScheduleItem) => {
  if (!projectId.value) return

  isSavingMarker.value = true
  try {
    const updated = await updateProgressPlanTaskMarker({
      projectId: projectId.value,
      taskId: item.id,
      milestoneType: item.milestoneType,
      milestoneDescription: item.milestoneDescription,
      isCriticalTask: !item.isCriticalTask,
      apiOrigin
    })
    applyLocalTaskMarkerState(updated)
    showSuccess(
      updated.isCriticalTask ? '已标记关键任务' : '已取消关键任务',
      `任务“${updated.taskName}”${
        updated.isCriticalTask ? '已标记为关键任务。' : '已取消关键任务标记。'
      }`
    )
  } catch (error) {
    showMessage(
      '关键任务更新失败',
      error instanceof Error ? error.message : '更新关键任务标记失败'
    )
  } finally {
    isSavingMarker.value = false
  }
}

watch(projectId, () => {
  applyPlanFileState(null)
  fetchLatestPlanFile()
  fetchPlanTasks()
})

onMounted(() => {
  fetchLatestPlanFile()
  fetchPlanTasks()
})

watch(associatedModelDrawerOpen, (isOpen) => {
  if (isOpen) return
  selectedAssociationTaskId.value = null
  selectedAssociationModelIds.value = []
  selectedAssociationBimIds.value = []
  selectedAssociationApplicationIds.value = []
})

watch(markerDialogOpen, (isOpen) => {
  if (isOpen) return
  selectedMarkerTaskId.value = null
  markerFormMilestoneType.value = null
  markerFormMilestoneDescription.value = ''
})
</script>
