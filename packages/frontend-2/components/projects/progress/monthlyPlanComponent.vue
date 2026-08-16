<template>
  <div class="space-y-4">
    <!-- Header Controls -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <FormTextInput
          v-model="searchKeyword"
          placeholder="搜索任务名称..."
          name="monthly-search"
          size="sm"
          class="w-64"
        />
        <input
          v-model="filterYearMonth"
          type="month"
          class="h-8 rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none transition focus:border-primary"
        />
        <FormButton
          v-if="searchKeyword || filterYearMonth"
          size="sm"
          color="subtle"
          @click="clearFilters"
        >
          清除筛选
        </FormButton>
      </div>

      <FormButton
        size="sm"
        color="primary"
        :icon-left="Plus"
        @click="isAddDialogOpen = true"
      >
        新增月度计划
      </FormButton>
    </div>

    <!-- Monthly Plan List by Month -->
    <div
      v-if="!filteredRecords.length"
      class="rounded-lg border border-outline-2 bg-foundation py-12 text-center text-body-sm text-foreground-2"
    >
      暂无月度计划，点击「新增月度计划」开始
    </div>

    <div
      v-else
      class="border border-outline-2 rounded-lg overflow-hidden bg-foundation"
    >
      <!-- 统一表格大表头 -->
      <div
        class="grid grid-cols-[48px_100px_1fr_100px_100px_160px_100px] gap-3 bg-foundation-page px-4 py-3 text-body-xs font-semibold text-foreground-2 border-b border-outline-2 select-none"
      >
        <div></div>
        <div class="flex items-center">年月</div>
        <div class="flex items-center">任务概览</div>
        <div class="flex items-center justify-center">任务数</div>
        <div class="flex items-center justify-center">编制人</div>
        <div class="flex items-center justify-center">创建时间</div>
        <div class="flex items-center justify-center">操作</div>
      </div>

      <div class="divide-y divide-outline-2">
        <div
          v-for="record in filteredRecords"
          :key="record.id"
          class="transition-colors"
        >
          <!-- Record Row Header -->
          <div
            class="grid grid-cols-[48px_100px_1fr_100px_100px_160px_100px] gap-3 px-4 py-3 items-center cursor-pointer hover:bg-foundation-2/30"
            @click="toggleExpand(record.id)"
          >
            <!-- Expand Toggle -->
            <div class="flex justify-center">
              <component
                :is="expandedRecordIds.includes(record.id) ? ChevronDown : ChevronRight"
                class="h-4 w-4 text-foreground-2 transition-transform"
              />
            </div>

            <!-- Year Month -->
            <div>
              <span
                class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
              >
                {{ record.yearMonth }}
              </span>
            </div>

            <!-- Task Preview -->
            <div class="flex flex-wrap gap-1.5 ml-2 truncate">
              <span
                v-for="t in record.tasks.slice(0, 3)"
                :key="t.id"
                class="rounded bg-foundation px-2 py-0.5 text-body-xs text-foreground-2 border border-outline-2 truncate max-w-[120px]"
              >
                {{ t.taskName }}
              </span>
              <span
                v-if="record.tasks.length > 3"
                class="text-body-xs text-foreground-2 shrink-0"
              >
                +{{ record.tasks.length - 3 }} 项
              </span>
            </div>

            <!-- Task Count -->
            <div class="text-center font-medium">{{ record.tasks.length }} 项</div>

            <!-- Creator -->
            <div class="text-center">{{ record.createdBy }}</div>

            <!-- Created Time -->
            <div class="text-center text-foreground-2 text-body-xs">
              {{ record.createdAt ? record.createdAt.substring(0, 10) : '-' }}
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-center gap-1.5" @click.stop>
              <button
                type="button"
                class="rounded p-1 text-foreground-2 hover:bg-foundation-3 hover:text-primary transition"
                title="编辑"
                @click="openEditDialog(record)"
              >
                <Pencil class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-foreground-2 hover:bg-danger-lighter hover:text-danger transition"
                title="删除"
                @click="deleteRecord(record.id)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Expanded Tasks List -->
          <div
            v-if="expandedRecordIds.includes(record.id)"
            class="border-t border-outline-2 bg-foundation-page/10"
          >
            <div class="overflow-x-auto">
              <table class="w-full text-left text-body-sm">
                <thead
                  class="bg-foundation-page text-foreground-2 border-b border-outline-2 select-none"
                >
                  <tr>
                    <th class="px-3 py-2 w-10 text-center">#</th>
                    <th class="px-3 py-2 min-w-[180px]">任务名称</th>
                    <th class="px-3 py-2 w-24 text-center">开始时间</th>
                    <th class="px-3 py-2 w-24 text-center">结束时间</th>
                    <th class="px-3 py-2 w-24 text-center">总工程量</th>
                    <th class="px-3 py-2 w-16 text-center">单位</th>
                    <th class="px-3 py-2 w-24 text-center">本月计划</th>
                    <th class="px-3 py-2 w-24 text-center">累计完成</th>
                    <th class="px-3 py-2 w-36 text-center">进度</th>
                    <th class="px-3 py-2 w-32 text-center">BIM关联</th>
                    <th class="px-3 py-2 min-w-[150px]">备注</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-outline-2 bg-foundation">
                  <tr
                    v-for="(task, idx) in record.tasks"
                    :key="task.id"
                    class="hover:bg-foundation-2/30 transition-colors"
                  >
                    <td class="px-3 py-2 text-foreground-2 text-center">
                      {{ idx + 1 }}
                    </td>
                    <td class="px-3 py-2 font-medium">{{ task.taskName }}</td>
                    <td class="px-3 py-2 text-foreground-2 text-center">
                      {{ task.startDate }}
                    </td>
                    <td class="px-3 py-2 text-foreground-2 text-center">
                      {{ task.endDate }}
                    </td>
                    <td class="px-3 py-2 text-foreground-2 text-center">
                      {{ task.totalVolume || '-' }}
                    </td>
                    <td class="px-3 py-2 text-foreground-2 text-center">
                      {{ task.unit }}
                    </td>
                    <td class="px-3 py-2 font-medium text-center">
                      {{ task.plannedVolume || '-' }}
                    </td>
                    <td class="px-3 py-2 text-foreground-2 text-center">
                      {{ task.actualVolume || '-' }}
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex items-center gap-2">
                        <div
                          class="flex-1 rounded-full h-1.5 bg-outline-3 overflow-hidden"
                        >
                          <div
                            class="rounded-full h-full transition-all"
                            :class="[
                              (task.progressPercent || 0) >= 90
                                ? 'bg-success'
                                : (task.progressPercent || 0) >= 60
                                ? 'bg-warning'
                                : 'bg-danger'
                            ]"
                            :style="{
                              width: `${Math.min(task.progressPercent || 0, 100)}%`
                            }"
                          />
                        </div>
                        <span
                          class="text-body-xs font-medium text-foreground w-8 text-right shrink-0"
                        >
                          {{ task.progressPercent || 0 }}%
                        </span>
                      </div>
                    </td>

                    <!-- BIM Association (read-only: derived from actual progress) -->
                    <td class="px-3 py-2 text-center">
                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-1.5 rounded border px-2.5 py-1 text-xs whitespace-nowrap shrink-0"
                        :class="
                          hasBim(task)
                            ? 'border-success-darker/30 bg-success-lighter text-success-darker cursor-pointer'
                            : 'border-outline-3 bg-foundation-2 text-foreground-2 cursor-default'
                        "
                        :disabled="!hasBim(task)"
                        @click="hasBim(task) && openBimViewDrawer(task)"
                      >
                        <Box class="h-3.5 w-3.5" />
                        <span class="whitespace-nowrap shrink-0">
                          {{
                            hasBim(task)
                              ? `已关联 (${getSelectionsCount(task)}件)`
                              : '未关联'
                          }}
                        </span>
                      </button>
                    </td>

                    <td class="px-3 py-2 text-foreground-2">
                      {{ task.remark || '-' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Monthly Plan Dialog -->
    <AddMonthlyPlanDialog
      v-model:open="isAddDialogOpen"
      :master-tasks="masterTasks"
      :initial-record="editingRecord"
      @save="handleSaveRecord"
    />

    <!-- BIM Association Viewer (read-only: derived from actual progress) -->
    <LayoutDrawer
      v-model:open="isBimDrawerOpen"
      placement="right"
      width="95%"
      body-classes="p-4"
    >
      <template #title>
        BIM关联查看
        <span v-if="activeBimTask" class="text-sm text-foreground-2">
          | {{ activeBimTask.taskName }}
        </span>
      </template>
      <div class="flex flex-col gap-3 h-[85vh]">
        <div
          v-if="activeBimTask"
          class="grid grid-cols-2 gap-3 rounded-lg border border-outline-2 bg-foundation-page p-3 text-body-xs"
        >
          <div>
            <div class="text-foreground-2">计划开始</div>
            <div class="text-body-sm font-medium mt-1">
              {{ activeBimTask.startDate }}
            </div>
          </div>
          <div>
            <div class="text-foreground-2">计划完成</div>
            <div class="text-body-sm font-medium mt-1">{{ activeBimTask.endDate }}</div>
          </div>
        </div>
        <div class="relative flex-1">
          <CommonModelPropsViewer
            v-if="viewModelIds.length"
            :project-id="projectId"
            :model-ids="viewModelIds"
            :filter-bims="viewBimIds"
            :filter-application-ids="viewApplicationIds"
          />
          <div v-else class="h-full flex items-center justify-center text-foreground-2">
            未找到关联模型（BIM 关联由实际进度填报自动反推）
          </div>
        </div>
      </div>
    </LayoutDrawer>

    <CommonConfirmDialog
      v-model:open="confirmDialogOpen"
      :title="confirmDialogTitle"
      :text="confirmDialogText"
      confirm-text="确认删除"
      :loading="isDeleting"
      @confirm="executeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { FormButton, FormTextInput, LayoutDrawer } from '@speckle/ui-components'
import { Box, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { CommonConfirmDialog, CommonModelPropsViewer } from '#components'
import AddMonthlyPlanDialog from './AddMonthlyPlanDialog.vue'
import type { MasterTaskOption } from './TaskSelectDialog.vue'
import {
  getProgressMonthlyPlans,
  createProgressMonthlyPlan,
  updateProgressMonthlyPlan,
  deleteProgressMonthlyPlan,
  type MonthlyRecordItem,
  type MonthlyPlanTaskItem as MonthlyTaskItem
} from '~~/lib/projects/api/progress'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

const props = defineProps<{
  projectId: string
  masterTasks: MasterTaskOption[]
}>()

const emit = defineEmits<{
  (e: 'sync-records', records: MonthlyRecordItem[]): void
}>()

const records = ref<MonthlyRecordItem[]>([])
const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

// 二次确认弹窗 State
const confirmDialogOpen = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogText = ref('')
const isDeleting = ref(false)
const planIdToDelete = ref<string | null>(null)

const expandedRecordIds = ref<string[]>(['mp-001'])
const searchKeyword = ref('')
const filterYearMonth = ref('')
const isAddDialogOpen = ref(false)
const editingRecord = ref<MonthlyRecordItem | null>(null)

// BIM Drawer State（只读查看：BIM 关联由实际进度填报反推，不允许手动关联）
const isBimDrawerOpen = ref(false)
const activeBimTask = ref<MonthlyTaskItem | null>(null)
const viewModelIds = ref<string[]>([])
const viewApplicationIds = ref<string[]>([])
const viewBimIds = ref<string[]>([])

const filteredRecords = computed(() => {
  return records.value.filter((r: MonthlyRecordItem) => {
    if (filterYearMonth.value && r.yearMonth !== filterYearMonth.value) return false
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      const hasMatch = r.tasks.some((t: MonthlyTaskItem) =>
        t.taskName.toLowerCase().includes(kw)
      )
      if (!hasMatch) return false
    }
    return true
  })
})

const clearFilters = () => {
  searchKeyword.value = ''
  filterYearMonth.value = ''
}

const toggleExpand = (id: string) => {
  if (expandedRecordIds.value.includes(id)) {
    expandedRecordIds.value = expandedRecordIds.value.filter((i) => i !== id)
  } else {
    expandedRecordIds.value.push(id)
  }
}

const getSelectionsCount = (task: MonthlyTaskItem) => {
  if (task.selections && task.selections.length > 0) {
    return task.selections.reduce(
      (sum: number, item: any) => sum + item.applicationIds.length,
      0
    )
  }
  return task.bimComponentCount || 0
}

const loadMonthlyPlans = async () => {
  try {
    const data = await getProgressMonthlyPlans({
      projectId: props.projectId,
      apiOrigin
    })
    records.value = data
    if (data.length && expandedRecordIds.value.length === 0) {
      expandedRecordIds.value = [data[0].id]
    }
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载失败',
      description: error instanceof Error ? error.message : '加载月度计划失败'
    })
  }
}

onMounted(() => {
  loadMonthlyPlans()
})

// 监听数据变更同步给总进度
watch(
  records,
  (newVal) => {
    emit('sync-records', newVal)
  },
  { deep: true, immediate: true }
)

const openEditDialog = (record: MonthlyRecordItem) => {
  editingRecord.value = record
  isAddDialogOpen.value = true
}

const deleteRecord = (id: string) => {
  const target = records.value.find((r: MonthlyRecordItem) => r.id === id)
  planIdToDelete.value = id
  confirmDialogTitle.value = '确认删除月度计划'
  confirmDialogText.value = `你确定要删除 ${
    target?.yearMonth || ''
  } 的月度计划吗？对应的任务行信息也将被全部清除，此操作不可撤销。`
  confirmDialogOpen.value = true
}

const executeDelete = async () => {
  if (!planIdToDelete.value) return
  isDeleting.value = true
  try {
    await deleteProgressMonthlyPlan({
      projectId: props.projectId,
      planId: planIdToDelete.value,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Info,
      title: '删除成功',
      description: '月度计划删除成功。'
    })
    await loadMonthlyPlans()
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除失败',
      description: error instanceof Error ? error.message : '删除失败，请重试'
    })
  } finally {
    isDeleting.value = false
    confirmDialogOpen.value = false
    planIdToDelete.value = null
  }
}

const handleSaveRecord = async (record: MonthlyRecordItem) => {
  try {
    const isEdit = !!editingRecord.value
    let saved: MonthlyRecordItem

    const payloadInput = {
      yearMonth: record.yearMonth,
      createdBy: record.createdBy,
      tasks: record.tasks.map((t: MonthlyTaskItem) => ({
        taskName: t.taskName,
        linkedPlanTaskId: t.linkedPlanTaskId || null,
        linkedPlanTaskName: t.linkedPlanTaskName || null,
        startDate: t.startDate || null,
        endDate: t.endDate || null,
        totalVolume:
          t.totalVolume !== null && t.totalVolume !== undefined
            ? String(t.totalVolume)
            : null,
        unit: t.unit || null,
        plannedVolume:
          t.plannedVolume !== null && t.plannedVolume !== undefined
            ? String(t.plannedVolume)
            : null,
        actualVolume:
          t.actualVolume !== null && t.actualVolume !== undefined
            ? String(t.actualVolume)
            : '0',
        progressPercent:
          typeof t.progressPercent === 'number' ? Math.round(t.progressPercent) : 0,
        remark: t.remark || null,
        bimComponentCount:
          typeof t.bimComponentCount === 'number' ? Math.round(t.bimComponentCount) : 0,
        bimLinked: !!t.bimLinked,
        selections: t.selections || []
      }))
    }

    if (isEdit) {
      saved = await updateProgressMonthlyPlan({
        projectId: props.projectId,
        planId: record.id,
        apiOrigin,
        input: payloadInput
      })
      triggerNotification({
        type: ToastNotificationType.Info,
        title: '更新成功',
        description: `已成功保存对 ${record.yearMonth} 月度计划的修改。`
      })
    } else {
      saved = await createProgressMonthlyPlan({
        projectId: props.projectId,
        apiOrigin,
        input: payloadInput
      })
      triggerNotification({
        type: ToastNotificationType.Info,
        title: '新增成功',
        description: `已成功创建 ${record.yearMonth} 月度计划。`
      })
    }

    isAddDialogOpen.value = false
    editingRecord.value = null
    await loadMonthlyPlans()
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: error instanceof Error ? error.message : '保存失败，请检查数据。'
    })
  }
}

const hasBim = (task: MonthlyTaskItem) =>
  !!task.bimLinked || !!(task.selections && task.selections.length > 0)

const parseSelections = (
  selections: unknown
): Array<{ modelId: string; applicationIds: string[] }> => {
  if (!selections) return []
  if (Array.isArray(selections))
    return selections as Array<{ modelId: string; applicationIds: string[] }>
  if (typeof selections === 'string') {
    try {
      const parsed = JSON.parse(selections)
      return parseSelections(parsed)
    } catch {
      return []
    }
  }
  return []
}

// 只读查看：打开 drawer 展示该任务已反推关联的 BIM 构件（来自实际进度填报）
const openBimViewDrawer = (task: MonthlyTaskItem) => {
  activeBimTask.value = task

  const selections = parseSelections(task.selections)
  viewModelIds.value = [...new Set(selections.map((s) => s.modelId).filter(Boolean))]
  viewApplicationIds.value = [
    ...new Set(selections.flatMap((s) => s.applicationIds || []))
  ]
  // Progress plan links currently persist applicationIds without separate bimIds.
  // Reuse applicationIds as fallback lookup keys so CommonModelPropsViewer can isolate them.
  viewBimIds.value = [...viewApplicationIds.value]
  isBimDrawerOpen.value = true
}

watch(isBimDrawerOpen, (isOpen) => {
  if (isOpen) return
  activeBimTask.value = null
  viewModelIds.value = []
  viewApplicationIds.value = []
  viewBimIds.value = []
})
</script>
