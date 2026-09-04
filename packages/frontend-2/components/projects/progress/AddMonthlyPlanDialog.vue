<!-- eslint-disable -->
<template>
  <div>
    <LayoutDialog v-model:open="isOpen" max-width="xl" prevent-close-on-click-outside>
      <template #header>
        {{ initialRecord ? '编辑月度计划' : '新增月度计划' }}
      </template>

      <div class="space-y-4 py-2">
        <!-- Form Header -->
        <div
          class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-outline-2 bg-foundation-page p-3"
        >
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-2">
              <label for="monthly-plan-yearmonth" class="text-body-sm font-medium">
                年月
                <span class="text-danger">*</span>
              </label>
              <input
                id="monthly-plan-yearmonth"
                v-model="yearMonth"
                type="month"
                class="h-8 rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none transition focus:border-primary"
              />
            </div>

            <div class="w-60 shrink-0">
              <FlowFieldsDynamicApprovalUserField
                v-model:value="selectedCreatorUserId"
                layout="horizontal"
                :field="{
                  name: '编制人',
                  key: 'createdBy',
                  type: 'user',
                  required: true,
                  placeholder: '输入用户名搜索'
                }"
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span
              v-if="annualPlanName"
              class="hidden max-w-[220px] truncate rounded bg-primary/10 px-2 py-1 text-body-3xs font-medium text-primary xl:inline"
              :title="annualPlanName"
            >
              年度计划：{{ annualPlanName }}
            </span>
            <FormButton
              size="sm"
              color="subtle"
              :icon-left="Sparkles"
              :loading="isLoadingAnnualTasks"
              @click="handleFetchMonthlyTasks"
            >
              获取本月计划
            </FormButton>
          </div>
        </div>

        <!-- 年度计划任务来源提示 -->
        <div
          v-if="!annualTasks.length && yearMonth && !isLoadingAnnualTasks"
          class="rounded-lg border border-dashed border-outline-3 bg-foundation-page px-3 py-2 text-body-xs text-foreground-2"
        >
          {{
            yearMonth
              ? `${yearMonth.slice(
                  0,
                  4
                )} 年暂无可用年度计划，或该年度计划尚未导入任务。`
              : '请先选择年月以匹配对应年度计划任务。'
          }}
          可先在「年度计划」详情页导入 `.mpp` 文件后再回来获取本月计划。
        </div>

        <!-- Task Items Table -->
        <div class="overflow-x-auto rounded-lg border border-outline-2">
          <table class="w-full text-left text-body-sm">
            <thead class="bg-foundation-2 text-foreground-2 border-b border-outline-2">
              <tr>
                <th class="px-3 py-2 w-10">#</th>
                <th class="px-3 py-2 min-w-[220px]">
                  任务名称
                  <span class="text-danger">*</span>
                </th>
                <th class="px-3 py-2 w-36">
                  开始时间
                  <span class="text-danger">*</span>
                </th>
                <th class="px-3 py-2 w-36">
                  结束时间
                  <span class="text-danger">*</span>
                </th>
                <th class="px-3 py-2 w-28">总工程量</th>
                <th class="px-3 py-2 w-24">单位</th>
                <th class="px-3 py-2 w-32">本月计划量</th>
                <th class="px-3 py-2 min-w-[150px]">备注</th>
                <th class="px-3 py-2 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-2 bg-foundation">
              <tr
                v-for="(task, index) in tasks"
                :key="task.id"
                class="hover:bg-foundation-2/50 transition-colors"
              >
                <td class="px-3 py-2 text-foreground-2 text-center">{{ index + 1 }}</td>

                <!-- Select task from master schedule -->
                <td class="px-2 py-1.5">
                  <button
                    type="button"
                    class="flex h-8 w-full items-center justify-between rounded-md border border-outline-3 bg-foundation px-2 text-left text-body-sm transition hover:border-primary"
                    @click="activeRowIndex = index"
                  >
                    <span className="truncate font-medium">
                      {{ task.taskName || '选择年度计划任务...' }}
                    </span>
                    <ExternalLink class="h-3.5 w-3.5 text-foreground-2 shrink-0 ml-1" />
                  </button>
                </td>

                <td class="px-2 py-1.5">
                  <input
                    v-model="task.startDate"
                    type="date"
                    class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none focus:border-primary"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    v-model="task.endDate"
                    type="date"
                    class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none focus:border-primary"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    :value="task.totalVolume || '-'"
                    readonly
                    class="h-8 w-full rounded-md border border-outline-2 bg-foundation-2 px-2 text-body-sm text-foreground-2 cursor-not-allowed"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    :value="task.unit || '-'"
                    readonly
                    class="h-8 w-full rounded-md border border-outline-2 bg-foundation-2 px-2 text-body-sm text-foreground-2 cursor-not-allowed"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    v-model="task.plannedVolume"
                    type="number"
                    placeholder="0"
                    class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none focus:border-primary"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    v-model="task.remark"
                    type="text"
                    placeholder="备注"
                    class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none focus:border-primary"
                  />
                </td>

                <td class="px-2 py-1.5 text-center">
                  <button
                    v-if="tasks.length > 1"
                    type="button"
                    class="inline-flex h-7 w-7 items-center justify-center rounded text-danger hover:bg-danger-lighter transition"
                    @click="removeTask(index)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <FormButton size="sm" color="outline" :icon-left="Plus" @click="addTask">
          添加任务行
        </FormButton>
      </div>

      <template #buttons>
        <FormButton color="outline" @click="isOpen = false">取消</FormButton>
        <FormButton color="primary" :disabled="!isValid" @click="handleSave">
          {{ initialRecord ? '保存修改' : '保存月度计划' }}
        </FormButton>
      </template>
    </LayoutDialog>

    <!-- Task Selection Dialog -->
    <TaskSelectDialog
      v-if="activeRowIndex !== null"
      :open="activeRowIndex !== null"
      :master-tasks="annualTasks"
      :selected-task-id="tasks[activeRowIndex]?.linkedPlanTaskId"
      title="选择年度计划任务"
      search-placeholder="搜索年度计划任务名称..."
      empty-text="暂无匹配的年度计划任务，请确认该年份年度计划已导入任务"
      @update:open="activeRowIndex = null"
      @select="handleMasterTaskSelected"
    />
  </div>
</template>

<script setup lang="ts">
/* eslint-disable */
import { computed, ref, watch } from 'vue'
import { FormButton, LayoutDialog } from '@speckle/ui-components'
import { ExternalLink, Plus, Sparkles, Trash2 } from 'lucide-vue-next'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import TaskSelectDialog, { type MasterTaskOption } from './TaskSelectDialog.vue'
import type {
  MonthlyRecordItem,
  MonthlyPlanTaskItem as MonthlyTaskItem
} from '~~/lib/projects/api/progress'
import {
  getProgressAnnualPlanTasks,
  getProgressAnnualPlans
} from '~~/lib/projects/api/progress'
import { searchSystemUsers } from '~~/lib/organizations/api'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

const props = defineProps<{
  open: boolean
  projectId: string
  initialRecord?: MonthlyRecordItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', record: MonthlyRecordItem): void
}>()

const { activeUser } = useActiveUser()

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const emptyTask = (): MonthlyTaskItem => ({
  id: generateUUID(),
  taskName: '',
  linkedPlanTaskId: '',
  linkedPlanTaskName: '',
  startDate: '',
  endDate: '',
  totalVolume: '',
  unit: '',
  plannedVolume: '',
  actualVolume: '0',
  progressPercent: 0,
  remark: '',
  bimComponentCount: 0,
  bimLinked: false
})

const yearMonth = ref('')
const createdBy = ref('')
const tasks = ref<MonthlyTaskItem[]>([emptyTask()])
const activeRowIndex = ref<number | null>(null)

const apiOrigin = useApiOrigin()
const selectedCreatorUserId = ref('')

// 年度计划任务（由选择年月年份对应的年度计划任务树提供）
const annualTasks = ref<MasterTaskOption[]>([])
const annualPlanName = ref('')
const isLoadingAnnualTasks = ref(false)

const loadAnnualPlanTasksForYear = async (yearValue: string) => {
  if (!props.projectId || !yearValue) {
    annualTasks.value = []
    annualPlanName.value = ''
    return
  }

  isLoadingAnnualTasks.value = true
  try {
    const plans = await getProgressAnnualPlans({
      projectId: props.projectId,
      apiOrigin,
      search: yearValue
    })
    const year = Number(yearValue)
    const targetPlan = plans
      .filter((p) => p.year === year)
      .sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0]

    if (!targetPlan) {
      annualTasks.value = []
      annualPlanName.value = ''
      return
    }

    annualPlanName.value = targetPlan.name

    const planTasks = await getProgressAnnualPlanTasks({
      projectId: props.projectId,
      planId: targetPlan.id,
      apiOrigin
    })
    if (!planTasks.length) {
      annualTasks.value = []
      return
    }

    const parentIdSet = new Set(planTasks.map((t) => t.parentId).filter(Boolean))
    annualTasks.value = planTasks.map((t) => ({
      id: t.id,
      taskName: t.taskName,
      level: t.level || 0,
      hasChildren: t.hasChildren || parentIdSet.has(t.id),
      parentId: t.parentId || undefined,
      wbs: t.wbs || undefined,
      volume: t.quantity || undefined,
      unit: t.unit || undefined,
      startDate: t.startDate || '',
      endDate: t.endDate || ''
    }))
  } catch {
    // 年度计划任务为辅助数据，加载失败保持空态
    annualTasks.value = []
    annualPlanName.value = ''
  } finally {
    isLoadingAnnualTasks.value = false
  }
}

watch([selectedCreatorUserId, yearMonth], async ([newId, newYearMonth]) => {
  if (newYearMonth) {
    loadAnnualPlanTasksForYear(String(newYearMonth).slice(0, 4))
  }
  if (!newId) {
    createdBy.value = ''
    return
  }
  if (newId === activeUser.value?.id) {
    createdBy.value = activeUser.value?.name || ''
    return
  }
  try {
    const results = await searchSystemUsers({ query: newId, apiOrigin })
    const target = results.find((u) => u.id === newId)
    if (target) {
      createdBy.value = target.name
    } else {
      createdBy.value = newId
    }
  } catch (err) {
    console.error('根据ID获取用户名出错:', err)
    createdBy.value = newId
  }
})

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

watch(
  () => props.open,
  (val) => {
    if (val) {
      if (props.initialRecord) {
        yearMonth.value = props.initialRecord.yearMonth
        createdBy.value = props.initialRecord.createdBy
        selectedCreatorUserId.value = ''
        tasks.value = JSON.parse(JSON.stringify(props.initialRecord.tasks || []))

        // 异步查匹配的ID回显
        const creatorName = props.initialRecord.createdBy
        if (creatorName) {
          searchSystemUsers({ query: creatorName, apiOrigin })
            .then((results) => {
              const found = results.find((u) => u.name === creatorName)
              if (found) {
                selectedCreatorUserId.value = found.id
              }
            })
            .catch((err) => {
              console.error('根据名称查询用户ID出错:', err)
            })
        }
      } else {
        const now = new Date()
        yearMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
          2,
          '0'
        )}`
        const defaultUser = activeUser.value?.name || '张三'
        createdBy.value = defaultUser
        selectedCreatorUserId.value = activeUser.value?.id || ''
        tasks.value = [emptyTask()]
      }

      // 打开弹窗时同步加载所选年份对应的年度计划任务树
      if (yearMonth.value) {
        loadAnnualPlanTasksForYear(yearMonth.value.slice(0, 4))
      }
    } else {
      annualTasks.value = []
      annualPlanName.value = ''
    }
  },
  { immediate: true }
)

const isValid = computed(() => {
  return (
    !!yearMonth.value &&
    !!createdBy.value &&
    tasks.value.length > 0 &&
    tasks.value.every((t) => t.taskName && t.startDate && t.endDate)
  )
})

const addTask = () => tasks.value.push(emptyTask())

const removeTask = (idx: number) => tasks.value.splice(idx, 1)

const handleMasterTaskSelected = (masterTask: MasterTaskOption) => {
  if (activeRowIndex.value === null) return
  const idx = activeRowIndex.value

  const task = tasks.value[idx]
  task.linkedPlanTaskId = masterTask.id
  task.linkedPlanTaskName = masterTask.taskName
  task.taskName = masterTask.taskName
  if (masterTask.volume) task.totalVolume = masterTask.volume
  if (masterTask.unit) task.unit = masterTask.unit
  if (masterTask.startDate) {
    task.startDate = masterTask.startDate.includes('T')
      ? masterTask.startDate.split('T')[0]
      : masterTask.startDate.substring(0, 10)
  }
  if (masterTask.endDate) {
    task.endDate = masterTask.endDate.includes('T')
      ? masterTask.endDate.split('T')[0]
      : masterTask.endDate.substring(0, 10)
  }

  activeRowIndex.value = null
}

const { triggerNotification } = useGlobalToast()

const checkIsParentTask = (
  mt: MasterTaskOption,
  index: number,
  allTasks: MasterTaskOption[]
): boolean => {
  if (!allTasks || !allTasks.length) return false
  if (mt.hasChildren) return true
  if (allTasks.some((other) => other.id !== mt.id && other.parentId === mt.id))
    return true
  if (
    mt.wbs &&
    allTasks.some(
      (other) => other.id !== mt.id && other.wbs && other.wbs.startsWith(mt.wbs + '.')
    )
  ) {
    return true
  }
  if (index < allTasks.length - 1) {
    const nextTask = allTasks[index + 1]
    if (
      typeof nextTask.level === 'number' &&
      typeof mt.level === 'number' &&
      nextTask.level > mt.level
    ) {
      return true
    }
  }
  const minLevel = Math.min(...allTasks.map((t) => t.level ?? 0))
  const maxLevel = Math.max(...allTasks.map((t) => t.level ?? 0))
  if (minLevel < maxLevel && mt.level === minLevel) {
    return true
  }
  return false
}

const handleFetchMonthlyTasks = async () => {
  if (!yearMonth.value) {
    triggerNotification({
      type: ToastNotificationType.Warning,
      title: '获取本月计划',
      description: '请先选择年月'
    })
    return
  }
  const [y, m] = yearMonth.value.split('-')
  const currentYm = `${y}-${m}`
  const yearValue = y

  // 若年度计划任务尚未就绪，先按年份加载对应年度计划任务
  if (!annualTasks.value.length && !isLoadingAnnualTasks.value) {
    await loadAnnualPlanTasksForYear(yearValue)
  }

  if (!annualTasks.value.length) {
    triggerNotification({
      type: ToastNotificationType.Warning,
      title: '获取本月计划',
      description: `${yearValue} 年暂无可用年度计划任务，请先在「年度计划」中创建并导入任务。`
    })
    return
  }

  const matches = annualTasks.value.filter((mt, idx) => {
    if (checkIsParentTask(mt, idx, annualTasks.value) || !mt.startDate || !mt.endDate) {
      return false
    }
    const taskStart = mt.startDate.substring(0, 7)
    const taskEnd = mt.endDate.substring(0, 7)
    return currentYm >= taskStart && currentYm <= taskEnd
  })

  if (matches.length > 0) {
    tasks.value = matches.map((mt) => {
      const t = emptyTask()
      t.linkedPlanTaskId = mt.id
      t.linkedPlanTaskName = mt.taskName
      t.taskName = mt.taskName
      t.startDate = mt.startDate
        ? mt.startDate.includes('T')
          ? mt.startDate.split('T')[0]
          : mt.startDate.substring(0, 10)
        : ''
      t.endDate = mt.endDate
        ? mt.endDate.includes('T')
          ? mt.endDate.split('T')[0]
          : mt.endDate.substring(0, 10)
        : ''
      t.totalVolume = mt.volume || ''
      t.unit = mt.unit || ''
      return t
    })
    triggerNotification({
      type: ToastNotificationType.Info,
      title: '获取本月计划成功',
      description: `已为您自动检索并带出 ${matches.length} 项本月施工任务（已过滤父级任务）`
    })
  } else {
    triggerNotification({
      type: ToastNotificationType.Info,
      title: '获取本月计划',
      description: '当前月份未匹配到符合条件的底层施工任务节点'
    })
  }
}

const handleSave = () => {
  if (!isValid.value) return

  const record: MonthlyRecordItem = {
    id: props.initialRecord?.id || generateUUID(),
    projectId: props.initialRecord?.projectId || '',
    yearMonth: yearMonth.value,
    tasks: tasks.value,
    createdAt: props.initialRecord?.createdAt || new Date().toLocaleString('zh-CN'),
    updatedAt: props.initialRecord?.updatedAt || new Date().toLocaleString('zh-CN'),
    createdBy: createdBy.value
  }

  emit('save', record)
  isOpen.value = false
}
</script>
