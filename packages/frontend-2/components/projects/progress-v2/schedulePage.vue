<template>
  <div class="flex flex-col gap-4 text-foreground">
    <!-- Header with Title and Tabs -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-2 pb-3"
    >
      <div class="flex items-center gap-6">
        <h1 class="text-heading-lg">进度计划</h1>
        <div class="flex items-center border-b border-outline-2">
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'total'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'total'"
          >
            总进度计划
          </button>
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'annual'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'annual'"
          >
            年度计划
          </button>
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'monthly'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'monthly'"
          >
            月度计划
          </button>
        </div>
      </div>

      <!-- Actions Header -->
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="activeTab === 'total'">
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
        </template>
        <template v-else-if="activeTab === 'annual'">
          <FormButton
            size="sm"
            color="primary"
            :icon-left="Plus"
            @click="openCreateAnnualDialog"
          >
            新增年度计划
          </FormButton>
        </template>
        <template v-else-if="activeTab === 'monthly'">
          <FormButton
            size="sm"
            color="primary"
            :icon-left="Plus"
            @click="openCreateMonthlyDialog"
          >
            新增月度计划
          </FormButton>
        </template>
      </div>
    </div>

    <!-- ── Tab 1: 总进度计划 ── -->
    <div
      v-if="activeTab === 'total'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingTasks"
        class="px-4 py-10 text-center text-body-sm text-foreground-2 border-b border-outline-2"
      >
        正在加载总计划任务...
      </div>
      <div
        v-else-if="!treeTasks.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2 border-b border-outline-2"
      >
        {{
          latestPlanFile
            ? '当前已上传计划文件，未解析出任务项。'
            : '当前还没有总进度计划，请点击右上角导入 `.mpp` 文件。'
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
        <!-- 去掉任务项点击显示实际进度详情弹窗，仅作纯文本显示 -->
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

      <div
        v-if="latestPlanFile && !isLoadingTasks"
        class="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-outline-2 bg-foundation-page/60 px-4 py-2 text-body-xs text-foreground-2"
      >
        <span>当前总计划文件：{{ latestPlanFile.fileName }}</span>
        <span v-if="latestPlanFile.updatedAt">
          最后更新：{{
            new Date(latestPlanFile.updatedAt).toLocaleString('zh-CN', { hour12: false })
          }}
        </span>
      </div>
    </div>

    <!-- ── Tab 2: 年度计划 ── -->
    <div
      v-else-if="activeTab === 'annual'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingAnnual"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        正在加载年度计划...
      </div>
      <div
        v-else-if="!annualPlans.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        暂无年度计划，请点击右上角新增。
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-body-sm border-collapse">
          <thead>
            <tr class="border-b border-outline-2 bg-foundation-page/50 text-foreground-2 font-medium">
              <th class="py-3 px-4">年份</th>
              <th class="py-3 px-4">计划名称</th>
              <th class="py-3 px-4">起止日期</th>
              <th class="py-3 px-4">编制人</th>
              <th class="py-3 px-4">计划文件</th>
              <th class="py-3 px-4">更新时间</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plan in annualPlans"
              :key="plan.id"
              class="border-b border-outline-2 hover:bg-primary-muted/20 transition-colors"
            >
              <td class="py-3 px-4 font-semibold text-primary">
                {{ plan.year }}年
              </td>
              <td class="py-3 px-4">
                <NuxtLink
                  :to="`/projects/${projectId}/progress-v2/annual/${plan.id}`"
                  class="font-medium text-primary hover:underline"
                >
                  {{ plan.name }}
                </NuxtLink>
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ plan.startDate ? plan.startDate.slice(0, 10) : '' }} ~
                {{ plan.endDate ? plan.endDate.slice(0, 10) : '' }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ plan.preparedBy || '-' }}
              </td>
              <td class="py-3 px-4">
                <span v-if="plan.fileName" class="text-body-xs bg-foundation-page px-2 py-0.5 rounded border border-outline-2">
                  {{ plan.fileName }}
                </span>
                <span v-else class="text-foreground-3 text-body-xs">未上传MPP</span>
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs">
                {{ plan.updatedAt ? new Date(plan.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '-' }}
              </td>
              <td class="py-3 px-4 text-right space-x-2">
                <button
                  type="button"
                  class="text-primary hover:underline text-body-sm"
                  @click="openEditAnnualDialog(plan)"
                >
                  编辑
                </button>
                <button
                  type="button"
                  class="text-danger hover:underline text-body-sm"
                  @click="promptDeleteAnnual(plan)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Tab 3: 月度计划 ── -->
    <div
      v-else-if="activeTab === 'monthly'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingMonthly"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        正在加载月度计划...
      </div>
      <div
        v-else-if="!monthlyPlans.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        暂无月度计划，请点击右上角新增。
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-body-sm border-collapse">
          <thead>
            <tr class="border-b border-outline-2 bg-foundation-page/50 text-foreground-2 font-medium">
              <th class="py-3 px-4">计划月份</th>
              <th class="py-3 px-4">计划标题</th>
              <th class="py-3 px-4">任务数</th>
              <th class="py-3 px-4">备注说明</th>
              <th class="py-3 px-4">更新时间</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plan in monthlyPlans"
              :key="plan.id"
              class="border-b border-outline-2 hover:bg-primary-muted/20 transition-colors"
            >
              <td class="py-3 px-4 font-semibold text-primary">
                {{ plan.yearMonth }}
              </td>
              <td class="py-3 px-4 font-medium text-foreground">
                {{ plan.title || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ plan.tasks?.length || 0 }} 项施工任务
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ plan.remark || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs">
                {{ plan.updatedAt ? new Date(plan.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '-' }}
              </td>
              <td class="py-3 px-4 text-right space-x-2">
                <button
                  type="button"
                  class="text-primary hover:underline text-body-sm"
                  @click="openEditMonthlyDialog(plan)"
                >
                  编辑任务
                </button>
                <button
                  type="button"
                  class="text-danger hover:underline text-body-sm"
                  @click="promptDeleteMonthly(plan)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── 弹窗 1: 新增/编辑年度计划 ── -->
    <LayoutDialog
      v-model:open="annualDialogOpen"
      :title="editingAnnualPlan ? '编辑年度计划' : '新增年度计划'"
      max-width="md"
    >
      <form class="space-y-4" @submit.prevent="handleSaveAnnual">
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">
            年份 <span class="text-danger">*</span>
          </label>
          <FormTextInput
            v-model="annualForm.year"
            name="annual-year"
            type="number"
            placeholder="例如 2026"
            color="foundation"
            required
          />
        </div>
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">
            计划名称 <span class="text-danger">*</span>
          </label>
          <FormTextInput
            v-model="annualForm.name"
            name="annual-name"
            placeholder="例如 2026年度总体实施计划"
            color="foundation"
            required
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">开始日期</label>
            <FormTextInput
              v-model="annualForm.startDate"
              name="annual-start"
              type="date"
              color="foundation"
              required
            />
          </div>
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">结束日期</label>
            <FormTextInput
              v-model="annualForm.endDate"
              name="annual-end"
              type="date"
              color="foundation"
              required
            />
          </div>
        </div>
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">编制人</label>
          <FormTextInput
            v-model="annualForm.preparedBy"
            name="annual-prepared-by"
            placeholder="编制责任人"
            color="foundation"
          />
        </div>
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">备注说明</label>
          <FormTextArea
            v-model="annualForm.remark"
            name="annual-remark"
            placeholder="计划补充说明..."
            color="foundation"
            rows="3"
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <FormButton color="outline" type="button" @click="annualDialogOpen = false">
            取消
          </FormButton>
          <FormButton color="primary" type="submit" :disabled="isSavingAnnual">
            {{ isSavingAnnual ? '保存中...' : '确定保存' }}
          </FormButton>
        </div>
      </form>
    </LayoutDialog>

    <!-- ── 弹窗 2: 新增/编辑月度计划 ── -->
    <LayoutDialog
      v-model:open="monthlyDialogOpen"
      :title="editingMonthlyPlan ? '编辑月度计划' : '新增月度计划'"
      max-width="lg"
    >
      <form class="space-y-4" @submit.prevent="handleSaveMonthly">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">
              年月 <span class="text-danger">*</span>
            </label>
            <FormTextInput
              v-model="monthlyForm.yearMonth"
              name="monthly-yearMonth"
              type="month"
              :disabled="!!editingMonthlyPlan"
              color="foundation"
              required
            />
          </div>
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">计划标题</label>
            <FormTextInput
              v-model="monthlyForm.title"
              name="monthly-title"
              placeholder="例如 2026-09 月度施工计划"
              color="foundation"
            />
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-body-xs font-semibold text-foreground">本月施工任务清单（独立维护）</span>
            <FormButton
              size="sm"
              color="outline"
              type="button"
              :icon-left="Plus"
              @click="addMonthlyTaskRow"
            >
              添加任务
            </FormButton>
          </div>
          <div class="border border-outline-2 rounded overflow-hidden max-h-60 overflow-y-auto">
            <table class="w-full text-left text-body-xs border-collapse">
              <thead>
                <tr class="bg-foundation-page/60 border-b border-outline-2 text-foreground-2">
                  <th class="p-2">任务名称</th>
                  <th class="p-2">计划起止</th>
                  <th class="p-2">计划量</th>
                  <th class="p-2">单位</th>
                  <th class="p-2">责任人</th>
                  <th class="p-2 w-12">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(task, idx) in monthlyForm.tasks"
                  :key="task.id"
                  class="border-b border-outline-2"
                >
                  <td class="p-1">
                    <input
                      v-model="task.taskName"
                      class="w-full bg-foundation border border-outline-2 rounded px-2 py-1 text-body-xs text-foreground"
                      placeholder="任务名"
                      required
                    />
                  </td>
                  <td class="p-1 flex gap-1">
                    <input
                      v-model="task.startDate"
                      type="date"
                      class="w-24 bg-foundation border border-outline-2 rounded px-1 py-1 text-body-xs text-foreground"
                    />
                    <input
                      v-model="task.endDate"
                      type="date"
                      class="w-24 bg-foundation border border-outline-2 rounded px-1 py-1 text-body-xs text-foreground"
                    />
                  </td>
                  <td class="p-1">
                    <input
                      v-model="task.plannedVolume"
                      class="w-16 bg-foundation border border-outline-2 rounded px-2 py-1 text-body-xs text-foreground"
                      placeholder="工程量"
                    />
                  </td>
                  <td class="p-1">
                    <input
                      v-model="task.unit"
                      class="w-12 bg-foundation border border-outline-2 rounded px-2 py-1 text-body-xs text-foreground"
                      placeholder="单位"
                    />
                  </td>
                  <td class="p-1">
                    <input
                      v-model="task.responsible"
                      class="w-16 bg-foundation border border-outline-2 rounded px-2 py-1 text-body-xs text-foreground"
                      placeholder="责任人"
                    />
                  </td>
                  <td class="p-1 text-center">
                    <button
                      type="button"
                      class="text-danger hover:underline text-body-xs"
                      @click="removeMonthlyTaskRow(idx)"
                    >
                      删除
                    </button>
                  </td>
                </tr>
                <tr v-if="!monthlyForm.tasks.length">
                  <td colspan="6" class="p-4 text-center text-foreground-3 text-body-xs">
                    暂未添加任务，可点击上方“添加任务”自主录入本月任务。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">备注说明</label>
          <FormTextArea
            v-model="monthlyForm.remark"
            name="monthly-remark"
            placeholder="说明与要求..."
            color="foundation"
            rows="2"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <FormButton color="outline" type="button" @click="monthlyDialogOpen = false">
            取消
          </FormButton>
          <FormButton color="primary" type="submit" :disabled="isSavingMonthly">
            {{ isSavingMonthly ? '保存中...' : '确定保存' }}
          </FormButton>
        </div>
      </form>
    </LayoutDialog>

    <!-- ── 二次确认删除弹窗 (CommonConfirmDialog) ── -->
    <CommonConfirmDialog
      v-model:open="showDeleteConfirm"
      :title="deleteConfirmTitle"
      :text="deleteConfirmText"
      confirm-button-text="确认删除"
      cancel-button-text="取消"
      confirm-button-color="danger"
      @confirm="executeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { Download, Upload, Plus } from 'lucide-vue-next'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { CommonConfirmDialog } from '#components'
import {
  getLatestProgressV2PlanFile,
  uploadProgressV2PlanFile,
  getProgressV2PlanTasks,
  getProgressV2PlanFileDownloadUrl,
  listProgressV2AnnualPlans,
  createProgressV2AnnualPlan,
  updateProgressV2AnnualPlan,
  deleteProgressV2AnnualPlan,
  listProgressV2MonthlyPlans,
  createProgressV2MonthlyPlan,
  updateProgressV2MonthlyPlan,
  deleteProgressV2MonthlyPlan,
  type ProgressV2PlanFile,
  type ProgressV2PlanTask,
  type ProgressV2AnnualPlan,
  type ProgressV2MonthlyPlan,
  type MonthlyPlanTaskItem
} from '~/lib/projects/api/progress-v2'

const route = useRoute()
const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const activeTab = ref<'total' | 'annual' | 'monthly'>('total')

// ── 总进度计划数据 ──
const isImporting = ref(false)
const isLoadingTasks = ref(false)
const planImportInputRef = ref<HTMLInputElement | null>(null)
const latestPlanFile = ref<ProgressV2PlanFile | null>(null)
const planTasks = ref<ProgressV2PlanTask[]>([])

const taskColumns = [
  { id: 'wbs', header: '层级', classes: 'col-span-1' },
  { id: 'taskName', header: '任务名称', classes: 'col-span-4' },
  { id: 'duration', header: '工期', classes: 'col-span-1' },
  { id: 'startDate', header: '开始时间', classes: 'col-span-2' },
  { id: 'endDate', header: '完成时间', classes: 'col-span-2' },
  { id: 'quantity', header: '工程量', classes: 'col-span-1' },
  { id: 'unit', header: '单位', classes: 'col-span-1' }
]

const buildTaskTree = (tasks: ProgressV2PlanTask[]): ProgressV2PlanTask[] => {
  const taskMap = new Map<string, ProgressV2PlanTask>()
  tasks.forEach((t) => {
    taskMap.set(t.id, { ...t, children: [] })
  })

  const rootTasks: ProgressV2PlanTask[] = []
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

const treeTasks = computed(() => buildTaskTree(planTasks.value))

const loadTotalPlanData = async () => {
  if (!projectId.value) return
  isLoadingTasks.value = true
  try {
    const [file, tasks] = await Promise.all([
      getLatestProgressV2PlanFile({ projectId: projectId.value, apiOrigin }),
      getProgressV2PlanTasks({ projectId: projectId.value, apiOrigin })
    ])
    latestPlanFile.value = file
    planTasks.value = tasks
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载总进度计划失败',
      description: err.message
    })
  } finally {
    isLoadingTasks.value = false
  }
}

const triggerPlanImport = () => {
  planImportInputRef.value?.click()
}

const handlePlanImportChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  isImporting.value = true
  try {
    const res = await uploadProgressV2PlanFile({
      projectId: projectId.value,
      file,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '导入总进度计划成功',
      description: `成功解析并更新 ${res.taskCount} 条总计划任务`
    })
    await loadTotalPlanData()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '导入总进度计划失败',
      description: err.message
    })
  } finally {
    isImporting.value = false
  }
}

const handleDownloadPlanFile = () => {
  if (!projectId.value || !latestPlanFile.value) return
  const url = getProgressV2PlanFileDownloadUrl({ projectId: projectId.value, apiOrigin })
  window.open(url, '_blank')
}

// ── 年度计划数据 ──
const isLoadingAnnual = ref(false)
const annualPlans = ref<ProgressV2AnnualPlan[]>([])
const annualDialogOpen = ref(false)
const editingAnnualPlan = ref<ProgressV2AnnualPlan | null>(null)
const isSavingAnnual = ref(false)
const annualForm = reactive({
  year: String(new Date().getFullYear()),
  name: '',
  startDate: `${new Date().getFullYear()}-01-01`,
  endDate: `${new Date().getFullYear()}-12-31`,
  preparedBy: '',
  remark: ''
})

const loadAnnualPlans = async () => {
  if (!projectId.value) return
  isLoadingAnnual.value = true
  try {
    annualPlans.value = await listProgressV2AnnualPlans({
      projectId: projectId.value,
      apiOrigin
    })
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载年度计划失败',
      description: err.message
    })
  } finally {
    isLoadingAnnual.value = false
  }
}

const openCreateAnnualDialog = () => {
  editingAnnualPlan.value = null
  const y = new Date().getFullYear()
  annualForm.year = String(y)
  annualForm.name = `${y}年度实施进度计划`
  annualForm.startDate = `${y}-01-01`
  annualForm.endDate = `${y}-12-31`
  annualForm.preparedBy = ''
  annualForm.remark = ''
  annualDialogOpen.value = true
}

const openEditAnnualDialog = (plan: ProgressV2AnnualPlan) => {
  editingAnnualPlan.value = plan
  annualForm.year = String(plan.year)
  annualForm.name = plan.name
  annualForm.startDate = plan.startDate ? plan.startDate.slice(0, 10) : ''
  annualForm.endDate = plan.endDate ? plan.endDate.slice(0, 10) : ''
  annualForm.preparedBy = plan.preparedBy || ''
  annualForm.remark = plan.remark || ''
  annualDialogOpen.value = true
}

const handleSaveAnnual = async () => {
  if (!projectId.value) return
  isSavingAnnual.value = true
  try {
    if (editingAnnualPlan.value) {
      await updateProgressV2AnnualPlan({
        projectId: projectId.value,
        annualPlanId: editingAnnualPlan.value.id,
        apiOrigin,
        data: {
          year: Number(annualForm.year),
          name: annualForm.name,
          startDate: annualForm.startDate,
          endDate: annualForm.endDate,
          preparedBy: annualForm.preparedBy || null,
          remark: annualForm.remark || null
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '年度计划信息已更新'
      })
    } else {
      await createProgressV2AnnualPlan({
        projectId: projectId.value,
        apiOrigin,
        data: {
          year: Number(annualForm.year),
          name: annualForm.name,
          startDate: annualForm.startDate,
          endDate: annualForm.endDate,
          preparedBy: annualForm.preparedBy || null,
          remark: annualForm.remark || null
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '创建成功',
        description: '已新建年度计划'
      })
    }
    annualDialogOpen.value = false
    await loadAnnualPlans()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: err.message
    })
  } finally {
    isSavingAnnual.value = false
  }
}

// ── 月度计划数据 ──
const isLoadingMonthly = ref(false)
const monthlyPlans = ref<ProgressV2MonthlyPlan[]>([])
const monthlyDialogOpen = ref(false)
const editingMonthlyPlan = ref<ProgressV2MonthlyPlan | null>(null)
const isSavingMonthly = ref(false)
const monthlyForm = reactive({
  yearMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  title: '',
  remark: '',
  tasks: [] as MonthlyPlanTaskItem[]
})

const loadMonthlyPlans = async () => {
  if (!projectId.value) return
  isLoadingMonthly.value = true
  try {
    monthlyPlans.value = await listProgressV2MonthlyPlans({
      projectId: projectId.value,
      apiOrigin
    })
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载月度计划失败',
      description: err.message
    })
  } finally {
    isLoadingMonthly.value = false
  }
}

const openCreateMonthlyDialog = () => {
  editingMonthlyPlan.value = null
  const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  monthlyForm.yearMonth = ym
  monthlyForm.title = `${ym} 月度施工计划`
  monthlyForm.remark = ''
  monthlyForm.tasks = []
  monthlyDialogOpen.value = true
}

const openEditMonthlyDialog = (plan: ProgressV2MonthlyPlan) => {
  editingMonthlyPlan.value = plan
  monthlyForm.yearMonth = plan.yearMonth
  monthlyForm.title = plan.title || ''
  monthlyForm.remark = plan.remark || ''
  monthlyForm.tasks = JSON.parse(JSON.stringify(plan.tasks || []))
  monthlyDialogOpen.value = true
}

const addMonthlyTaskRow = () => {
  monthlyForm.tasks.push({
    id: String(Date.now()),
    taskName: '',
    startDate: '',
    endDate: '',
    plannedVolume: '',
    actualVolume: '0',
    unit: 'm³',
    responsible: '',
    remark: ''
  })
}

const removeMonthlyTaskRow = (index: number) => {
  monthlyForm.tasks.splice(index, 1)
}

const handleSaveMonthly = async () => {
  if (!projectId.value) return
  isSavingMonthly.value = true
  try {
    if (editingMonthlyPlan.value) {
      await updateProgressV2MonthlyPlan({
        projectId: projectId.value,
        monthlyPlanId: editingMonthlyPlan.value.id,
        apiOrigin,
        data: {
          title: monthlyForm.title,
          remark: monthlyForm.remark,
          tasks: monthlyForm.tasks
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '月度计划任务已保存'
      })
    } else {
      await createProgressV2MonthlyPlan({
        projectId: projectId.value,
        apiOrigin,
        data: {
          yearMonth: monthlyForm.yearMonth,
          title: monthlyForm.title,
          remark: monthlyForm.remark,
          tasks: monthlyForm.tasks
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '创建成功',
        description: '已新建月度施工计划'
      })
    }
    monthlyDialogOpen.value = false
    await loadMonthlyPlans()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: err.message
    })
  } finally {
    isSavingMonthly.value = false
  }
}

// ── 删除二次确认 (CommonConfirmDialog) ──
const showDeleteConfirm = ref(false)
const deleteConfirmTitle = ref('确认删除')
const deleteConfirmText = ref('确定要删除该项吗？此操作不可逆。')
let pendingDeleteAction: (() => Promise<void>) | null = null

const promptDeleteAnnual = (plan: ProgressV2AnnualPlan) => {
  deleteConfirmTitle.value = '删除年度计划'
  deleteConfirmText.value = `确定要删除「${plan.name}」吗？关联的年度任务树也将被移除。`
  pendingDeleteAction = async () => {
    await deleteProgressV2AnnualPlan({
      projectId: projectId.value,
      annualPlanId: plan.id,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '年度计划已删除'
    })
    await loadAnnualPlans()
  }
  showDeleteConfirm.value = true
}

const promptDeleteMonthly = (plan: ProgressV2MonthlyPlan) => {
  deleteConfirmTitle.value = '删除月度计划'
  deleteConfirmText.value = `确定要删除「${plan.yearMonth}」月度计划吗？`
  pendingDeleteAction = async () => {
    await deleteProgressV2MonthlyPlan({
      projectId: projectId.value,
      monthlyPlanId: plan.id,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '月度计划已删除'
    })
    await loadMonthlyPlans()
  }
  showDeleteConfirm.value = true
}

const executeDelete = async () => {
  if (!pendingDeleteAction) return
  try {
    await pendingDeleteAction()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除失败',
      description: err.message
    })
  } finally {
    pendingDeleteAction = null
    showDeleteConfirm.value = false
  }
}

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'total') loadTotalPlanData()
    else if (tab === 'annual') loadAnnualPlans()
    else if (tab === 'monthly') loadMonthlyPlans()
  }
)

onMounted(() => {
  loadTotalPlanData()
})
</script>
