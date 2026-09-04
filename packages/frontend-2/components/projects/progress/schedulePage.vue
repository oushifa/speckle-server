<template>
  <div class="flex flex-col gap-4 text-foreground">
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-2 pb-3"
    >
      <div class="flex items-center gap-6">
        <h1 class="text-heading-lg">进度计划</h1>
        <div class="flex items-center border-b border-outline-2">
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-primary text-primary font-semibold"
          >
            总进度计划
          </button>
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-transparent text-foreground-2 hover:text-foreground"
            @click="navigateToAnnual"
          >
            年度计划
          </button>
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-transparent text-foreground-2 hover:text-foreground"
            @click="navigateToMonthly"
          >
            月度计划
          </button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <FormButton
          v-if="hasFunctionalPerm('progress-plan:import')"
          size="sm"
          color="primary"
          :icon-left="Upload"
          :disabled="isImporting"
          @click="triggerPlanImport"
        >
          {{ isImporting ? '上传中...' : '导入 / 更新 计划' }}
        </FormButton>
        <FormButton
          v-if="hasFunctionalPerm('progress-plan:download')"
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

    <!-- Total Progress Plan View（仅展示，无业务交互） -->
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
        v-else-if="!treeItems.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2 border-b border-outline-2"
      >
        {{
          latestPlanFile
            ? '当前已上传计划文件，等待后端解析并写入任务树。'
            : '当前还没有计划任务，请先导入 `.mpp` 文件。'
        }}
      </div>
      <LayoutTable
        v-else
        :columns="columns"
        :items="treeItems"
        class="w-full"
        expand-all-by-default
      >
        <template #wbs="{ item }">
          <span class="text-body-sm text-foreground-2">{{ item.wbs }}</span>
        </template>
        <template #taskName="{ item }">
          <span class="text-body-sm font-medium">{{ item.taskName }}</span>
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
      </LayoutTable>
      <div
        v-if="latestPlanFile && !isLoadingTasks"
        class="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-outline-2 bg-foundation-page/60 px-4 py-2 text-body-xs text-foreground-2"
      >
        <span>计划文件：{{ latestPlanFile.fileName }}</span>
        <span v-if="latestPlanFile.updatedAt">
          最后更新：{{
            new Date(latestPlanFile.updatedAt).toLocaleString('zh-CN', {
              hour12: false
            })
          }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, Upload } from 'lucide-vue-next'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'
import {
  downloadLatestProgressPlanFile,
  getLatestProgressPlanFile,
  getProgressPlanTasks,
  uploadProgressPlanFile,
  type ProgressPlanFile,
  type ProgressPlanTask
} from '~/lib/projects/api/progress'

interface ScheduleItem {
  id: string
  wbs?: string
  taskName: string
  duration: string
  startDate: string
  endDate: string
  level: number
  parentId?: string
  children?: ScheduleItem[]
}

const columns = [
  { id: 'wbs', header: '层级', classes: 'col-span-1' },
  { id: 'taskName', header: '任务名称', classes: 'col-span-5' },
  { id: 'duration', header: '工期', classes: 'col-span-2' },
  { id: 'startDate', header: '开始时间', classes: 'col-span-2' },
  { id: 'endDate', header: '完成时间', classes: 'col-span-2' }
]

const route = useRoute()
const router = useRouter()

const navigateToAnnual = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/annual`)
  }
}

const navigateToMonthly = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/monthly`)
  }
}

const { hasFunctionalPerm } = useCustomPermissions()
const { triggerNotification } = useGlobalToast()
const apiOrigin = useApiOrigin()

const items = ref<ScheduleItem[]>([])
const treeItems = ref<ScheduleItem[]>([])
const planImportInputRef = ref<HTMLInputElement | null>(null)
const latestPlanFile = ref<ProgressPlanFile | null>(null)
const isImporting = ref(false)
const isLoadingTasks = ref(false)

const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

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
  level: task.level || 0,
  parentId: task.parentId || undefined,
  children: []
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
  const orderedItems = [...taskItems].sort((left, right) => {
    const wbsOrder = compareWbs(left.wbs, right.wbs)
    if (wbsOrder !== 0) return wbsOrder
    if (!left.wbs && !right.wbs && left.taskName !== right.taskName) {
      return left.taskName.localeCompare(right.taskName, 'zh-CN')
    }
    return left.taskName.localeCompare(right.taskName, 'zh-CN')
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
    treeItems.value = []
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
      // 导出统一为 MSPDI(.xml)，下载兜底文件名同步为 .xml
      fallbackFileName: latestPlanFile.value.fileName.replace(/\.mpp$/i, '.xml')
    })
    showSuccess('下载成功', `已下载 ${latestPlanFile.value.fileName}`)
  } catch (error) {
    showMessage('计划文件下载失败', error instanceof Error ? error.message : '下载失败')
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
