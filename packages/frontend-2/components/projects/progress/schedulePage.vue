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
          <span class="truncate font-medium text-body-sm">
            {{ item.taskName }}
          </span>
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

        <template #inspection="{ item }">
          <span class="text-body-sm">{{ item.inspection || '-' }}</span>
        </template>

        <template #taskStatus="{ item }">
          <div class="flex flex-col items-start gap-1">
            <div
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-nowrap"
              :class="getTaskStatusBadgeClass(item.taskStatus)"
            >
              {{ getTaskStatusText(item.taskStatus) }}
            </div>
            <span
              v-if="typeof item.completionRate === 'number'"
              class="text-body-xs text-foreground-2"
            >
              完成率 {{ item.completionRate }}%
            </span>
          </div>
        </template>

        <template #status="{ item }">
          <div
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-nowrap"
            :class="
              (item.applicationIds || []).length
                ? 'bg-success-lighter text-success-darker'
                : 'bg-foundation-2 text-foreground-2'
            "
          >
            {{ (item.applicationIds || []).length ? '已关联BIM模型' : '未关联' }}
          </div>
        </template>

        <template #operation="{ item }">
          <div class="flex justify-center">
            <FormButton
              size="sm"
              color="outline"
              :icon-left="Link2"
              @click.stop="openLinkDialog(item)"
            >
              关联
            </FormButton>
          </div>
        </template>
      </LayoutTable>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import { Download, Link2, Upload } from 'lucide-vue-next'
import { CommonModelObjectMultiModelSelectDrawer } from '#components'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import {
  downloadLatestProgressPlanFile,
  getLatestProgressPlanFile,
  getProgressPlanTasks,
  getProgressTaskSnapshots,
  updateProgressPlanTaskBimAssociation,
  uploadProgressPlanFile,
  type ProgressPlanFile,
  type ProgressPlanTask,
  type ProgressPlanTaskBimSelection,
  type ProgressTaskSnapshot,
  type ProgressTaskSnapshotStatus
} from '~/lib/projects/api/progress'

interface ScheduleItem {
  id: string
  wbs?: string
  taskName: string
  duration: string
  startDate: string
  endDate: string
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
  taskStatus?: ProgressTaskSnapshotStatus
  completionRate?: number
}

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

const getTaskBimSummary = (params: {
  modelId?: string | null
  modelIds?: string[] | null
  applicationIds?: string[] | null
  selections?: ProgressPlanTaskBimSelection[] | null
}) => {
  const normalizedSelections = normalizeSelections(params.selections)
  if (!normalizedSelections.length) {
    const legacyModelId = normalizeString(params.modelId)
    const legacyApplicationIds = uniqueStrings(params.applicationIds || [])
    if (legacyModelId && legacyApplicationIds.length) {
      normalizedSelections.push({
        modelId: legacyModelId,
        applicationIds: legacyApplicationIds
      })
    }
  }

  const modelIds = uniqueStrings([
    ...(params.modelIds || []),
    ...normalizedSelections.map((group) => group.modelId)
  ])
  const applicationIds = uniqueStrings(
    normalizedSelections.flatMap((group) => group.applicationIds)
  )

  return {
    modelId:
      normalizedSelections.length === 1
        ? normalizedSelections[0]?.modelId || null
        : null,
    modelIds,
    applicationIds,
    selections: normalizedSelections
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
  { id: 'inspection', header: '检验批', classes: 'col-span-1' },
  { id: 'taskStatus', header: '任务状态', classes: 'col-span-1' },
  { id: 'status', header: '关联状态', classes: 'col-span-1' },
  { id: 'operation', header: '操作', classes: 'col-span-1 flex justify-center' }
]

const route = useRoute()
const { triggerNotification } = useGlobalToast()
const apiOrigin = useApiOrigin()

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
const selectedTaskId = ref<string | null>(null)
const draftModelIds = ref<string[]>([])
const draftSelections = ref<ProgressPlanTaskBimSelection[]>([])

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
  predecessor: task.predecessor || undefined,
  inspection: task.inspection || undefined,
  sortOrder: task.sortOrder,
  level: task.level || 0,
  parentId: task.parentId || undefined,
  children: [],
  ...getTaskBimSummary(task)
})

const getTaskStatusText = (status?: ProgressTaskSnapshotStatus) => {
  switch (status) {
    case 'no_bim_link':
      return '未关联构件'
    case 'not_started':
      return '未开始'
    case 'in_progress':
      return '进行中'
    case 'delayed':
      return '已逾期'
    case 'finished_on_time':
      return '按期完成'
    case 'finished_delayed':
      return '延期完成'
    default:
      return '未生成'
  }
}

const getTaskStatusBadgeClass = (status?: ProgressTaskSnapshotStatus) => {
  switch (status) {
    case 'finished_on_time':
      return 'bg-primary-lighter text-primary-darker'
    case 'finished_delayed':
    case 'delayed':
      return 'bg-danger-lighter text-danger-darker'
    case 'in_progress':
      return 'bg-warning-lighter text-warning-darker'
    case 'not_started':
    case 'no_bim_link':
      return 'bg-foundation-2 text-foreground-2'
    default:
      return 'bg-foundation-2 text-foreground-2'
  }
}

const mergeTaskSnapshots = (
  taskItems: ScheduleItem[],
  taskSnapshots: ProgressTaskSnapshot[]
): ScheduleItem[] => {
  const snapshotMap = new Map(
    taskSnapshots.map((snapshot) => [snapshot.taskId, snapshot])
  )

  return taskItems.map((item) => {
    const snapshot = snapshotMap.get(item.id)
    return {
      ...item,
      taskStatus: snapshot?.taskStatus,
      completionRate: snapshot?.completionRate
    }
  })
}

const fetchAllTaskSnapshots = async () => {
  if (!projectId.value) return []

  const limit = 200
  let page = 1
  const results: ProgressTaskSnapshot[] = []

  while (true) {
    const payload = await getProgressTaskSnapshots({
      projectId: projectId.value,
      apiOrigin,
      page,
      limit
    })
    results.push(...payload.data)

    if (results.length >= payload.meta.total || payload.data.length < limit) {
      break
    }

    page += 1
  }

  return results
}

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
    const [tasks, taskSnapshots] = await Promise.all([
      getProgressPlanTasks({
        projectId: projectId.value,
        apiOrigin
      }),
      fetchAllTaskSnapshots()
    ])
    rebuildTaskTree(mergeTaskSnapshots(tasks.map(mapTaskRecordToItem), taskSnapshots))
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
  selectedTaskId.value = item.id
  draftModelIds.value = [...(item.modelIds || [])]
  draftSelections.value = normalizeSelections(item.selections)
  linkDialogOpen.value = true
}

const saveTaskLink = async () => {
  if (!selectedTask.value) return
  if (!projectId.value) return

  isSavingLink.value = true
  try {
    const bimSummary = getTaskBimSummary({
      modelIds: draftModelIds.value,
      selections: draftSelections.value
    })
    const updated = await updateProgressPlanTaskBimAssociation({
      projectId: projectId.value,
      taskId: selectedTask.value.id,
      modelId: bimSummary.modelId,
      modelIds: bimSummary.modelIds,
      applicationIds: bimSummary.applicationIds,
      selections: bimSummary.selections,
      apiOrigin
    })
    const target = items.value.find((item) => item.id === updated.id)
    if (target) {
      Object.assign(target, getTaskBimSummary(updated))
    }
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

watch(projectId, () => {
  applyPlanFileState(null)
  fetchLatestPlanFile()
  fetchPlanTasks()
})

onMounted(() => {
  fetchLatestPlanFile()
  fetchPlanTasks()
})
</script>
