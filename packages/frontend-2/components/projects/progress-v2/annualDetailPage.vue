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
            {{ annualPlan.startDate?.slice(0, 10) }} ~ {{ annualPlan.endDate?.slice(0, 10) }}
          </span>
        </div>
        <div>
          <span class="text-foreground-2">编制人：</span>
          <span class="font-medium text-foreground">{{ annualPlan.preparedBy || '-' }}</span>
        </div>
        <div>
          <span class="text-foreground-2">当前计划文件：</span>
          <span v-if="annualPlan.fileName" class="bg-foundation-page px-2 py-0.5 rounded border border-outline-2 font-mono text-body-xs">
            {{ annualPlan.fileName }}
          </span>
          <span v-else class="text-foreground-3">未上传</span>
        </div>
      </div>
    </div>

    <!-- Task Tree Table -->
    <div class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col">
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
        <template #wbs="{ item }">
          <span class="text-body-sm text-foreground-2">{{ item.wbs }}</span>
        </template>
        <!-- 需求3：去掉年度计划任务项点击显示实际进度详情弹窗，纯文本展示 -->
        <template #taskName="{ item }">
          <span class="text-body-sm font-medium text-foreground">{{ item.taskName }}</span>
        </template>
        <template #duration="{ item }">
          <span class="text-body-sm">{{ item.duration || '-' }}</span>
        </template>
        <template #startDate="{ item }">
          <span class="text-body-sm">{{ item.startDate || '-' }}</span>
        </template>
        <template #endDate="{ item }">
          <span class="text-body-sm">{{ item.endDate || '-' }}</span>
        </template>
        <template #quantity="{ item }">
          <span class="text-body-sm">{{ item.quantity || '-' }}</span>
        </template>
        <template #unit="{ item }">
          <span class="text-body-sm">{{ item.unit || '-' }}</span>
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
  { id: 'wbs', header: '层级', classes: 'col-span-1' },
  { id: 'taskName', header: '任务名称', classes: 'col-span-4' },
  { id: 'duration', header: '工期', classes: 'col-span-1' },
  { id: 'startDate', header: '开始时间', classes: 'col-span-2' },
  { id: 'endDate', header: '完成时间', classes: 'col-span-2' },
  { id: 'quantity', header: '工程量', classes: 'col-span-1' },
  { id: 'unit', header: '单位', classes: 'col-span-1' }
]

const buildTaskTree = (taskList: ProgressV2AnnualPlanTask[]): ProgressV2AnnualPlanTask[] => {
  const taskMap = new Map<string, ProgressV2AnnualPlanTask>()
  taskList.forEach((t) => {
    taskMap.set(t.id, { ...t, children: [] })
  })

  const rootTasks: ProgressV2AnnualPlanTask[] = []
  taskMap.forEach((task) => {
    if (task.parentId && taskMap.has(task.parentId)) {
      const parent = taskMap.get(task.parentId)!
      parent.children = parent.children || []
      parent.children.push(task)
      parent.hasChildren = true
    } else {
      rootTasks.push(task)
    }
  })
  return rootTasks
}

const treeTasks = computed(() => buildTaskTree(tasks.value))

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
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载年度计划详情失败',
      description: err.message
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
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '导入年度计划失败',
      description: err.message
    })
  } finally {
    isImporting.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>
