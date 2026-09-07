<template>
  <div class="flex flex-col gap-4 text-foreground">
    <!-- Breadcrumb & Header -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-2 pb-3"
    >
      <div class="flex items-center gap-2 text-body-sm text-foreground-2">
        <NuxtLink
          :to="`/projects/${projectId}/progress-v2/schedule`"
          class="hover:text-primary transition-colors flex items-center gap-1"
        >
          <ArrowLeft class="size-4" />
          <span>返回进度计划</span>
        </NuxtLink>
        <span>/</span>
        <span class="font-semibold text-foreground">
          {{ annualPlan?.name || '年度计划详情' }}
        </span>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <FormButton
          size="sm"
          color="primary"
          :icon-left="Upload"
          :disabled="isImporting"
          @click="triggerAnnualMppImport"
        >
          {{ isImporting ? '上传中...' : '导入 / 更新 年度MPP计划' }}
        </FormButton>
        <input
          ref="annualMppInputRef"
          type="file"
          class="hidden"
          accept=".mpp"
          aria-label="导入年度进度计划文件"
          @change="handleAnnualMppChange"
        />
      </div>
    </div>

    <!-- Annual Plan Metadata Bar -->
    <div
      v-if="annualPlan"
      class="bg-foundation rounded-lg p-4 border border-outline-2 flex flex-wrap items-center justify-between gap-4 text-body-sm shadow-xs"
    >
      <div class="flex flex-wrap items-center gap-6">
        <div>
          <span class="text-foreground-2">计划年度：</span>
          <span class="font-semibold text-primary">{{ annualPlan.year }}年</span>
        </div>
        <div>
          <span class="text-foreground-2">工期区间：</span>
          <span class="font-medium text-foreground">
            {{ annualPlan.startDate?.slice(0, 10) }} ~
            {{ annualPlan.endDate?.slice(0, 10) }}
          </span>
        </div>
        <div>
          <span class="text-foreground-2">编制人：</span>
          <span class="font-medium text-foreground">
            {{ annualPlan.preparedBy || '-' }}
          </span>
        </div>
        <div>
          <span class="text-foreground-2">当前计划文件：</span>
          <span
            v-if="annualPlan.fileName"
            class="bg-foundation-page px-2 py-0.5 rounded border border-outline-2 font-mono text-body-xs"
          >
            {{ annualPlan.fileName }}
          </span>
          <span v-else class="text-foreground-3">未上传</span>
        </div>
      </div>
    </div>

    <!-- Task Tree Table -->
    <div
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingTasks"
        class="px-4 py-10 text-center text-body-sm text-foreground-2 border-b border-outline-2"
      >
        正在加载年度任务树...
      </div>
      <div
        v-else-if="!treeTasks.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2 border-b border-outline-2"
      >
        {{
          annualPlan?.fileName
            ? '当前已上传计划文件，未解析出任务项。'
            : '当前年度计划还没有任务，请点击右上角导入该年度的 `.mpp` 文件。'
        }}
      </div>
      <LayoutTable
        v-else
        :columns="taskColumns"
        :items="treeTasks"
        class="w-full"
        expand-all-by-default
      >
        <template #taskName="{ item }">
          <span class="text-body-sm font-medium text-foreground">
            {{ item.taskName || item.name }}
          </span>
        </template>
        <template #duration="{ item }">
          <span class="text-body-sm text-center block">{{ item.duration || '-' }}</span>
        </template>
        <template #startDate="{ item }">
          <span class="text-body-sm text-center block">
            {{ item.startDate || '-' }}
          </span>
        </template>
        <template #endDate="{ item }">
          <span class="text-body-sm text-center block">{{ item.endDate || '-' }}</span>
        </template>
      </LayoutTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Upload } from 'lucide-vue-next'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import {
  listProgressV2AnnualPlans,
  uploadProgressV2AnnualPlanFile,
  getProgressV2AnnualPlanTasks,
  type ProgressV2AnnualPlan,
  type ProgressV2AnnualPlanTask
} from '~/lib/projects/api/progress-v2'

const route = useRoute()
const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const annualPlanId = computed(() => {
  const pid = route.params.planId
  return typeof pid === 'string' ? pid : ''
})

const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const annualPlan = ref<ProgressV2AnnualPlan | null>(null)
const tasks = ref<ProgressV2AnnualPlanTask[]>([])
const isLoadingTasks = ref(false)
const isImporting = ref(false)
const annualMppInputRef = ref<HTMLInputElement | null>(null)

const taskColumns = [
  { id: 'taskName', header: '任务名称', classes: 'col-span-6' },
  { id: 'duration', header: '工期', classes: 'col-span-2 text-center' },
  { id: 'startDate', header: '开始时间', classes: 'col-span-2 text-center' },
  { id: 'endDate', header: '完成时间', classes: 'col-span-2 text-center' }
]

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

const rebuildTaskTree = (
  taskList: ProgressV2AnnualPlanTask[]
): ProgressV2AnnualPlanTask[] => {
  const orderedItems = [...taskList].sort((left, right) => {
    const wbsOrder = compareWbs(left.wbs || undefined, right.wbs || undefined)
    if (wbsOrder !== 0) return wbsOrder
    return (left.taskName || left.name).localeCompare(
      right.taskName || right.name,
      'zh-CN'
    )
  })

  const originalParentIds = new Map(
    orderedItems.map((item) => [item.id, item.parentId || undefined])
  )
  const itemMap = new Map(
    orderedItems.map((item) => [
      item.id,
      { ...item, children: [] as ProgressV2AnnualPlanTask[] }
    ])
  )
  const itemByWbs = new Map(
    orderedItems.flatMap((item) =>
      item.wbs ? [[item.wbs, itemMap.get(item.id)!] as const] : []
    )
  )

  itemMap.forEach((item) => {
    item.children = []
    item.parentId = null
    item.level = getWbsLevel(item.wbs || undefined, item.level)
  })

  const rootItems: ProgressV2AnnualPlanTask[] = []

  orderedItems.forEach((raw) => {
    const item = itemMap.get(raw.id)!
    const wbsParent = getParentWbs(item.wbs || undefined)
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
    parent.hasChildren = true
  })

  return rootItems
}

const treeTasks = computed(() => rebuildTaskTree(tasks.value))

const loadData = async () => {
  if (!projectId.value || !annualPlanId.value) return
  isLoadingTasks.value = true
  try {
    const [allPlans, planTasks] = await Promise.all([
      listProgressV2AnnualPlans({ projectId: projectId.value, apiOrigin }),
      getProgressV2AnnualPlanTasks({
        projectId: projectId.value,
        annualPlanId: annualPlanId.value,
        apiOrigin
      })
    ])
    annualPlan.value = allPlans.find((p) => p.id === annualPlanId.value) || null
    tasks.value = planTasks
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载年度计划详情失败',
      description: err instanceof Error ? err.message : String(err)
    })
  } finally {
    isLoadingTasks.value = false
  }
}

const triggerAnnualMppImport = () => {
  annualMppInputRef.value?.click()
}

const handleAnnualMppChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  isImporting.value = true
  try {
    const res = await uploadProgressV2AnnualPlanFile({
      projectId: projectId.value,
      annualPlanId: annualPlanId.value,
      file,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '导入年度计划成功',
      description: `成功解析并更新 ${res.taskCount} 条年度计划任务`
    })
    await loadData()
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '导入年度计划失败',
      description: err instanceof Error ? err.message : String(err)
    })
  } finally {
    isImporting.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>
