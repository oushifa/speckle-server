<template>
  <div class="flex flex-col gap-4 text-foreground">
    <!-- Header with Title and Tabs -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-2 pb-3"
    >
      <div class="flex items-center gap-6">
        <h1 class="text-heading-lg">进度管理</h1>
        <div class="flex items-center border-b border-outline-2">
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'actual'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'actual'"
          >
            进度管理
          </button>
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'milestone'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'milestone'"
          >
            里程碑管理
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap items-center gap-3">
        <FormTextInput
          v-if="activeTab === 'actual'"
          v-model="actualSearchQuery"
          name="actual-search"
          placeholder="搜索任务名称/填报人..."
          :custom-icon="Search"
          color="foundation"
          class="w-64"
          @update:model-value="debounceLoadActual"
        />
        <FormTextInput
          v-else
          v-model="milestoneSearchQuery"
          name="milestone-search"
          placeholder="搜索里程碑/责任人..."
          :custom-icon="Search"
          color="foundation"
          class="w-64"
          @update:model-value="debounceLoadMilestones"
        />

        <FormButton
          v-if="activeTab === 'actual'"
          size="sm"
          color="primary"
          :icon-left="Plus"
          @click="openCreateActualDialog"
        >
          新增填报
        </FormButton>
        <FormButton
          v-else
          size="sm"
          color="primary"
          :icon-left="Plus"
          @click="openCreateMilestoneDialog"
        >
          新增里程碑
        </FormButton>
      </div>
    </div>

    <!-- ── Tab 1: 进度管理（实际填报记录） ── -->
    <div
      v-if="activeTab === 'actual'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingActual"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        正在加载施工进度记录...
      </div>
      <div
        v-else-if="!actualRecords.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        暂无进度填报记录，请点击右上角新增。
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-body-sm border-collapse">
          <thead>
            <tr class="border-b border-outline-2 bg-foundation-page/50 text-foreground-2 font-medium">
              <th class="py-3 px-4">填报日期</th>
              <th class="py-3 px-4">施工任务名称</th>
              <th class="py-3 px-4">施工部位/区域</th>
              <th class="py-3 px-4">起止时间</th>
              <th class="py-3 px-4">进度%</th>
              <th class="py-3 px-4">天气情况</th>
              <th class="py-3 px-4">填报人</th>
              <th class="py-3 px-4">备注说明</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rec in actualRecords"
              :key="rec.id"
              class="border-b border-outline-2 hover:bg-primary-muted/20 transition-colors"
            >
              <td class="py-3 px-4 font-semibold text-primary">
                {{ rec.reportDate }}
              </td>
              <td class="py-3 px-4 font-medium text-foreground">
                {{ rec.taskName }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ rec.sectionName || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs">
                {{ rec.actualStartDate ? rec.actualStartDate.slice(0, 10) : '-' }} ~
                {{ rec.actualEndDate ? rec.actualEndDate.slice(0, 10) : '-' }}
              </td>
              <td class="py-3 px-4">
                <span class="inline-block px-2 py-0.5 rounded text-body-xs font-semibold bg-primary-muted text-primary">
                  {{ rec.progressPercent }}%
                </span>
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ rec.weather || '-' }} {{ rec.highTemperature ? `${rec.highTemperature}℃` : '' }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ rec.reporter || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs max-w-xs truncate">
                {{ rec.remark || '-' }}
              </td>
              <td class="py-3 px-4 text-right space-x-2">
                <button
                  type="button"
                  class="text-primary hover:underline text-body-sm"
                  @click="openEditActualDialog(rec)"
                >
                  编辑
                </button>
                <button
                  type="button"
                  class="text-danger hover:underline text-body-sm"
                  @click="promptDeleteActual(rec)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Tab 2: 里程碑管理 ── -->
    <div
      v-else-if="activeTab === 'milestone'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingMilestones"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        正在加载里程碑...
      </div>
      <div
        v-else-if="!milestones.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        暂无里程碑数据，请点击右上角新增。
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-body-sm border-collapse">
          <thead>
            <tr class="border-b border-outline-2 bg-foundation-page/50 text-foreground-2 font-medium">
              <th class="py-3 px-4">里程碑名称</th>
              <th class="py-3 px-4">计划完成时间</th>
              <th class="py-3 px-4">实际完成时间</th>
              <th class="py-3 px-4">当前状态</th>
              <th class="py-3 px-4">级别类型</th>
              <th class="py-3 px-4">责任人</th>
              <th class="py-3 px-4">备注说明</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in milestones"
              :key="item.id"
              class="border-b border-outline-2 hover:bg-primary-muted/20 transition-colors"
            >
              <td class="py-3 px-4 font-semibold text-foreground">
                {{ item.taskName }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ item.plannedEnd ? item.plannedEnd.slice(0, 10) : '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ item.actualEnd ? item.actualEnd.slice(0, 10) : '-' }}
              </td>
              <td class="py-3 px-4">
                <span
                  :class="[
                    'px-2 py-0.5 rounded text-body-xs font-medium',
                    item.status === '按期完成' || item.status === '已完成'
                      ? 'bg-success-lighter text-success-darker'
                      : item.status === '进行中'
                      ? 'bg-primary-muted text-primary'
                      : item.status === '已逾期'
                      ? 'bg-danger-lighter text-danger-darker'
                      : 'bg-foundation-page text-foreground-2 border border-outline-2'
                  ]"
                >
                  {{ item.status }}
                </span>
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{
                  item.milestoneType === 'project'
                    ? '项目级'
                    : item.milestoneType === 'phase'
                    ? '阶段级'
                    : '验收级'
                }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ item.responsible || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs max-w-xs truncate">
                {{ item.remark || '-' }}
              </td>
              <td class="py-3 px-4 text-right space-x-2">
                <button
                  type="button"
                  class="text-primary hover:underline text-body-sm"
                  @click="openEditMilestoneDialog(item)"
                >
                  编辑
                </button>
                <button
                  type="button"
                  class="text-danger hover:underline text-body-sm"
                  @click="promptDeleteMilestone(item)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── 弹窗 1: 新增/编辑进度填报 ── -->
    <LayoutDialog
      v-model:open="actualDialogOpen"
      :title="editingActualRecord ? '编辑进度填报' : '新增进度填报'"
      max-width="md"
    >
      <form class="space-y-4" @submit.prevent="handleSaveActual">
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">
            任务名称 <span class="text-danger">*</span>
          </label>
          <FormTextInput
            v-model="actualForm.taskName"
            name="actual-taskName"
            placeholder="例如 1#桥梁桩基混凝土浇筑"
            color="foundation"
            required
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">
              填报日期 <span class="text-danger">*</span>
            </label>
            <FormTextInput
              v-model="actualForm.reportDate"
              name="actual-reportDate"
              type="date"
              color="foundation"
              required
            />
          </div>
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">施工部位/区域</label>
            <FormTextInput
              v-model="actualForm.sectionName"
              name="actual-sectionName"
              placeholder="例如 K12+200~K12+350"
              color="foundation"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">实际开始</label>
            <FormTextInput
              v-model="actualForm.actualStartDate"
              name="actual-startDate"
              type="date"
              color="foundation"
            />
          </div>
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">实际完成</label>
            <FormTextInput
              v-model="actualForm.actualEndDate"
              name="actual-endDate"
              type="date"
              color="foundation"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">完成进度 (%)</label>
            <FormTextInput
              v-model="actualForm.progressPercent"
              name="actual-progressPercent"
              type="number"
              min="0"
              max="100"
              color="foundation"
            />
          </div>
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">填报人</label>
            <FormTextInput
              v-model="actualForm.reporter"
              name="actual-reporter"
              placeholder="填报人姓名"
              color="foundation"
            />
          </div>
        </div>
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">施工记录与说明</label>
          <FormTextArea
            v-model="actualForm.constructionRecord"
            name="actual-record"
            placeholder="现场施工进度与情况记录..."
            color="foundation"
            rows="2"
          />
        </div>
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">备注</label>
          <FormTextInput
            v-model="actualForm.remark"
            name="actual-remark"
            placeholder="备注说明"
            color="foundation"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <FormButton color="outline" type="button" @click="actualDialogOpen = false">
            取消
          </FormButton>
          <FormButton color="primary" type="submit" :disabled="isSavingActual">
            {{ isSavingActual ? '保存中...' : '确定保存' }}
          </FormButton>
        </div>
      </form>
    </LayoutDialog>

    <!-- ── 弹窗 2: 新增/编辑里程碑 ── -->
    <LayoutDialog
      v-model:open="milestoneDialogOpen"
      :title="editingMilestone ? '编辑里程碑' : '新增里程碑'"
      max-width="md"
    >
      <form class="space-y-4" @submit.prevent="handleSaveMilestone">
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">
            里程碑名称 <span class="text-danger">*</span>
          </label>
          <FormTextInput
            v-model="milestoneForm.taskName"
            name="ms-taskName"
            placeholder="例如 主体结构封顶"
            color="foundation"
            required
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">计划完成时间</label>
            <FormTextInput
              v-model="milestoneForm.plannedEnd"
              name="ms-planEnd"
              type="date"
              color="foundation"
            />
          </div>
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">实际完成时间</label>
            <FormTextInput
              v-model="milestoneForm.actualEnd"
              name="ms-actEnd"
              type="date"
              color="foundation"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">状态</label>
            <select
              v-model="milestoneForm.status"
              class="w-full bg-foundation border border-outline-2 rounded px-3 py-2 text-body-sm text-foreground"
            >
              <option value="未开始">未开始</option>
              <option value="进行中">进行中</option>
              <option value="按期完成">按期完成</option>
              <option value="逾期完成">逾期完成</option>
              <option value="已逾期">已逾期</option>
            </select>
          </div>
          <div>
            <label class="block text-body-xs font-medium text-foreground-2 mb-1">级别类型</label>
            <select
              v-model="milestoneForm.milestoneType"
              class="w-full bg-foundation border border-outline-2 rounded px-3 py-2 text-body-sm text-foreground"
            >
              <option value="project">项目级</option>
              <option value="phase">阶段级</option>
              <option value="inspection">验收级</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">责任人</label>
          <FormTextInput
            v-model="milestoneForm.responsible"
            name="ms-responsible"
            placeholder="负责人姓名"
            color="foundation"
          />
        </div>
        <div>
          <label class="block text-body-xs font-medium text-foreground-2 mb-1">备注说明</label>
          <FormTextArea
            v-model="milestoneForm.remark"
            name="ms-remark"
            placeholder="里程碑意义及验收标准说明..."
            color="foundation"
            rows="2"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <FormButton color="outline" type="button" @click="milestoneDialogOpen = false">
            取消
          </FormButton>
          <FormButton color="primary" type="submit" :disabled="isSavingMilestone">
            {{ isSavingMilestone ? '保存中...' : '确定保存' }}
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
import { Plus, Search } from 'lucide-vue-next'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { CommonConfirmDialog } from '#components'
import {
  listProgressV2ActualRecords,
  createProgressV2ActualRecord,
  updateProgressV2ActualRecord,
  deleteProgressV2ActualRecord,
  listProgressV2Milestones,
  createProgressV2Milestone,
  updateProgressV2Milestone,
  deleteProgressV2Milestone,
  type ProgressV2ActualRecord,
  type ProgressV2Milestone
} from '~/lib/projects/api/progress-v2'

const route = useRoute()
const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const activeTab = ref<'actual' | 'milestone'>('actual')

// ── 进度管理（实际填报） ──
const isLoadingActual = ref(false)
const actualRecords = ref<ProgressV2ActualRecord[]>([])
const actualSearchQuery = ref('')
const actualDialogOpen = ref(false)
const editingActualRecord = ref<ProgressV2ActualRecord | null>(null)
const isSavingActual = ref(false)

const actualForm = reactive({
  taskName: '',
  sectionName: '',
  reportDate: new Date().toISOString().slice(0, 10),
  actualStartDate: '',
  actualEndDate: '',
  progressPercent: '100',
  reporter: '',
  constructionRecord: '',
  remark: ''
})

const loadActualRecords = async () => {
  if (!projectId.value) return
  isLoadingActual.value = true
  try {
    actualRecords.value = await listProgressV2ActualRecords({
      projectId: projectId.value,
      apiOrigin,
      search: actualSearchQuery.value
    })
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载实际进度失败',
      description: err.message
    })
  } finally {
    isLoadingActual.value = false
  }
}

let actualSearchTimer: any = null
const debounceLoadActual = () => {
  clearTimeout(actualSearchTimer)
  actualSearchTimer = setTimeout(loadActualRecords, 300)
}

const openCreateActualDialog = () => {
  editingActualRecord.value = null
  actualForm.taskName = ''
  actualForm.sectionName = ''
  actualForm.reportDate = new Date().toISOString().slice(0, 10)
  actualForm.actualStartDate = new Date().toISOString().slice(0, 10)
  actualForm.actualEndDate = new Date().toISOString().slice(0, 10)
  actualForm.progressPercent = '100'
  actualForm.reporter = ''
  actualForm.constructionRecord = ''
  actualForm.remark = ''
  actualDialogOpen.value = true
}

const openEditActualDialog = (rec: ProgressV2ActualRecord) => {
  editingActualRecord.value = rec
  actualForm.taskName = rec.taskName
  actualForm.sectionName = rec.sectionName || ''
  actualForm.reportDate = rec.reportDate
  actualForm.actualStartDate = rec.actualStartDate ? rec.actualStartDate.slice(0, 10) : ''
  actualForm.actualEndDate = rec.actualEndDate ? rec.actualEndDate.slice(0, 10) : ''
  actualForm.progressPercent = String(rec.progressPercent)
  actualForm.reporter = rec.reporter || ''
  actualForm.constructionRecord = rec.constructionRecord || ''
  actualForm.remark = rec.remark || ''
  actualDialogOpen.value = true
}

const handleSaveActual = async () => {
  if (!projectId.value) return
  isSavingActual.value = true
  try {
    if (editingActualRecord.value) {
      await updateProgressV2ActualRecord({
        projectId: projectId.value,
        recordId: editingActualRecord.value.id,
        apiOrigin,
        data: {
          taskName: actualForm.taskName,
          sectionName: actualForm.sectionName || null,
          reportDate: actualForm.reportDate,
          actualStartDate: actualForm.actualStartDate || null,
          actualEndDate: actualForm.actualEndDate || null,
          progressPercent: Number(actualForm.progressPercent || 0),
          reporter: actualForm.reporter || null,
          constructionRecord: actualForm.constructionRecord || null,
          remark: actualForm.remark || null
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '填报记录已更新'
      })
    } else {
      await createProgressV2ActualRecord({
        projectId: projectId.value,
        apiOrigin,
        data: {
          taskName: actualForm.taskName,
          sectionName: actualForm.sectionName || null,
          reportDate: actualForm.reportDate,
          actualStartDate: actualForm.actualStartDate || null,
          actualEndDate: actualForm.actualEndDate || null,
          progressPercent: Number(actualForm.progressPercent || 0),
          reporter: actualForm.reporter || null,
          constructionRecord: actualForm.constructionRecord || null,
          remark: actualForm.remark || null
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '创建成功',
        description: '已新增进度填报记录'
      })
    }
    actualDialogOpen.value = false
    await loadActualRecords()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: err.message
    })
  } finally {
    isSavingActual.value = false
  }
}

// ── 里程碑管理 ──
const isLoadingMilestones = ref(false)
const milestones = ref<ProgressV2Milestone[]>([])
const milestoneSearchQuery = ref('')
const milestoneDialogOpen = ref(false)
const editingMilestone = ref<ProgressV2Milestone | null>(null)
const isSavingMilestone = ref(false)

const milestoneForm = reactive({
  taskName: '',
  plannedEnd: '',
  actualEnd: '',
  status: '未开始',
  milestoneType: 'phase',
  responsible: '',
  remark: ''
})

const loadMilestones = async () => {
  if (!projectId.value) return
  isLoadingMilestones.value = true
  try {
    milestones.value = await listProgressV2Milestones({
      projectId: projectId.value,
      apiOrigin,
      search: milestoneSearchQuery.value
    })
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载里程碑失败',
      description: err.message
    })
  } finally {
    isLoadingMilestones.value = false
  }
}

let milestoneSearchTimer: any = null
const debounceLoadMilestones = () => {
  clearTimeout(milestoneSearchTimer)
  milestoneSearchTimer = setTimeout(loadMilestones, 300)
}

const openCreateMilestoneDialog = () => {
  editingMilestone.value = null
  milestoneForm.taskName = ''
  milestoneForm.plannedEnd = ''
  milestoneForm.actualEnd = ''
  milestoneForm.status = '未开始'
  milestoneForm.milestoneType = 'phase'
  milestoneForm.responsible = ''
  milestoneForm.remark = ''
  milestoneDialogOpen.value = true
}

const openEditMilestoneDialog = (m: ProgressV2Milestone) => {
  editingMilestone.value = m
  milestoneForm.taskName = m.taskName
  milestoneForm.plannedEnd = m.plannedEnd ? m.plannedEnd.slice(0, 10) : ''
  milestoneForm.actualEnd = m.actualEnd ? m.actualEnd.slice(0, 10) : ''
  milestoneForm.status = m.status || '未开始'
  milestoneForm.milestoneType = m.milestoneType || 'phase'
  milestoneForm.responsible = m.responsible || ''
  milestoneForm.remark = m.remark || ''
  milestoneDialogOpen.value = true
}

const handleSaveMilestone = async () => {
  if (!projectId.value) return
  isSavingMilestone.value = true
  try {
    if (editingMilestone.value) {
      await updateProgressV2Milestone({
        projectId: projectId.value,
        milestoneId: editingMilestone.value.id,
        apiOrigin,
        data: {
          taskName: milestoneForm.taskName,
          plannedStart: null,
          plannedEnd: milestoneForm.plannedEnd || null,
          actualStart: null,
          actualEnd: milestoneForm.actualEnd || null,
          status: milestoneForm.status,
          milestoneType: milestoneForm.milestoneType,
          responsible: milestoneForm.responsible || null,
          remark: milestoneForm.remark || null,
          tags: ['milestone']
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '里程碑信息已更新'
      })
    } else {
      await createProgressV2Milestone({
        projectId: projectId.value,
        apiOrigin,
        data: {
          taskName: milestoneForm.taskName,
          plannedStart: null,
          plannedEnd: milestoneForm.plannedEnd || null,
          actualStart: null,
          actualEnd: milestoneForm.actualEnd || null,
          status: milestoneForm.status,
          milestoneType: milestoneForm.milestoneType,
          responsible: milestoneForm.responsible || null,
          remark: milestoneForm.remark || null,
          tags: ['milestone']
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '创建成功',
        description: '已新建里程碑'
      })
    }
    milestoneDialogOpen.value = false
    await loadMilestones()
  } catch (err: any) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: err.message
    })
  } finally {
    isSavingMilestone.value = false
  }
}

// ── 删除二次确认 ──
const showDeleteConfirm = ref(false)
const deleteConfirmTitle = ref('确认删除')
const deleteConfirmText = ref('确定要删除该项吗？此操作不可逆。')
let pendingDeleteAction: (() => Promise<void>) | null = null

const promptDeleteActual = (rec: ProgressV2ActualRecord) => {
  deleteConfirmTitle.value = '删除填报记录'
  deleteConfirmText.value = `确定要删除「${rec.reportDate} - ${rec.taskName}」的填报记录吗？`
  pendingDeleteAction = async () => {
    await deleteProgressV2ActualRecord({
      projectId: projectId.value,
      recordId: rec.id,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '施工填报记录已删除'
    })
    await loadActualRecords()
  }
  showDeleteConfirm.value = true
}

const promptDeleteMilestone = (m: ProgressV2Milestone) => {
  deleteConfirmTitle.value = '删除里程碑'
  deleteConfirmText.value = `确定要删除「${m.taskName}」里程碑吗？`
  pendingDeleteAction = async () => {
    await deleteProgressV2Milestone({
      projectId: projectId.value,
      milestoneId: m.id,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '里程碑已删除'
    })
    await loadMilestones()
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
    if (tab === 'actual') loadActualRecords()
    else if (tab === 'milestone') loadMilestones()
  }
)

onMounted(() => {
  loadActualRecords()
})
</script>
