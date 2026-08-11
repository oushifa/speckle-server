<template>
  <div class="flex flex-col h-full text-foreground gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-heading-lg mt-3">实际进度</h1>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <FormTextInput
          v-model="searchQuery"
          name="actual-progress-search"
          placeholder="搜索日期、月份、负责人、记录人"
          :custom-icon="Search"
          color="foundation"
          class="w-72"
        />
        <FormButton
          v-if="hasFunctionalPerm('actual-progress:import')"
          color="outline"
          :icon-left="Upload"
          :disabled="isLoadingRecords || isImportingExcel"
          @click="triggerImportExcel"
        >
          {{ isImportingExcel ? '导入中...' : '导入Excel' }}
        </FormButton>
        <FormButton
          v-if="hasFunctionalPerm('actual-progress:export')"
          color="outline"
          :icon-left="Download"
          :disabled="isLoadingRecords"
          @click="handleExportExcel"
        >
          导出Excel
        </FormButton>
        <FormButton
          v-if="hasFunctionalPerm('actual-progress:create')"
          color="primary"
          :icon-left="Plus"
          :disabled="isLoadingRecords"
          @click="openCreateDialog"
        >
          新增填报
        </FormButton>
        <input
          ref="importInputRef"
          type="file"
          class="hidden"
          aria-label="导入实际进度Excel文件"
          accept=".xlsx,.xls"
          @change="handleImportFileChange"
        />
      </div>
    </div>

    <div
      class="flex-1 overflow-hidden flex flex-col rounded-lg border border-outline-2 bg-foundation"
    >
      <LayoutTable :columns="columns" :items="paginatedItems" class="flex-1">
        <template #reportDate="{ item }">
          <div class="font-medium">{{ item.reportDate }}</div>
          <div class="text-body-xs text-foreground-2">{{ item.weekDay }}</div>
        </template>

        <template #yearMonth="{ item }">
          <div class="text-body-sm">{{ item.yearMonth || '-' }}</div>
        </template>

        <template #siteLeader="{ item }">
          <div class="text-body-sm truncate">{{ item.siteLeader || '-' }}</div>
        </template>

        <template #reporter="{ item }">
          <div class="text-body-sm truncate">{{ item.reporter || '-' }}</div>
        </template>

        <template #tasksInfo="{ item }">
          <div v-if="item.tasks && item.tasks.length" class="space-y-1">
            <div
              v-for="(task, idx) in item.tasks.slice(0, 2)"
              :key="idx"
              class="text-body-xs truncate"
            >
              <span class="font-medium">{{ task.taskName }}</span>
              <span class="text-foreground-2 ml-1">
                完成 {{ task.completedVolume }}{{ task.unit }}
              </span>
            </div>
            <div v-if="item.tasks.length > 2" class="text-body-xs text-foreground-2">
              +{{ item.tasks.length - 2 }} 项...
            </div>
          </div>
          <div v-else class="text-body-sm text-foreground-2">-</div>
        </template>

        <template #bimInfo="{ item }">
          <div v-if="countAllTaskBimLinks(item) > 0">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-body-xs font-medium bg-success-lighter text-success-darker"
            >
              已关联 {{ countAllTaskBimLinks(item) }} 个构件
            </span>
          </div>
          <div v-else class="text-body-xs text-foreground-2">未关联</div>
        </template>

        <template #remark="{ item }">
          <div class="text-body-sm truncate">{{ item.remark || '-' }}</div>
        </template>

        <template #actions="{ item }">
          <div class="flex items-center justify-end gap-2">
            <FormButton
              size="sm"
              color="outline"
              hide-text
              :icon-left="Eye"
              @click="openViewDialog(item)"
            />
            <FormButton
              v-if="hasFunctionalPerm('actual-progress:edit')"
              size="sm"
              color="outline"
              hide-text
              :icon-left="Pencil"
              @click="openEditDialog(item)"
            />
            <FormButton
              v-if="hasFunctionalPerm('actual-progress:delete')"
              size="sm"
              color="outline"
              hide-text
              :icon-left="Trash2"
              :disabled="deletingRecordId === item.id"
              @click="handleDelete(item.id)"
            />
          </div>
        </template>
      </LayoutTable>
    </div>

    <div
      class="px-4 py-4 border border-outline-2 rounded-lg flex items-center justify-between bg-foundation"
    >
      <div class="flex items-center gap-4 text-sm text-foreground-2">
        <div v-if="isLoadingRecords">正在加载列表...</div>
        <div class="flex items-center gap-2">
          <span>每页显示</span>
          <select
            v-model="itemsPerPage"
            aria-label="每页显示条数"
            class="bg-foundation-2 border border-outline-3 rounded px-2 py-1 outline-none"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          <span>条</span>
        </div>
        <div>共 {{ totalItems }} 条，第 {{ startItemIndex }}-{{ endItemIndex }} 条</div>
      </div>

      <div class="flex items-center gap-2">
        <button
          :disabled="currentPage === 1"
          class="p-1 rounded hover:bg-foundation-2 disabled:opacity-50 disabled:hover:bg-transparent"
          @click="currentPage > 1 && currentPage--"
        >
          <ChevronLeft class="h-5 w-5 text-foreground-2" />
        </button>

        <button
          v-for="page in totalPages"
          :key="page"
          class="px-3 py-1 rounded text-sm transition-colors"
          :class="
            currentPage === page
              ? 'bg-primary text-white'
              : 'hover:bg-foundation-2 text-foreground'
          "
          @click="currentPage = page"
        >
          {{ page }}
        </button>

        <button
          :disabled="currentPage === totalPages"
          class="p-1 rounded hover:bg-foundation-2 disabled:opacity-50 disabled:hover:bg-transparent"
          @click="currentPage < totalPages && currentPage++"
        >
          <ChevronRight class="h-5 w-5 text-foreground-2" />
        </button>
      </div>
    </div>

    <!-- 查看详情弹窗 -->
    <LayoutDialog
      v-model:open="viewDialogOpen"
      max-width="xl"
      :buttons="viewDialogButtons"
    >
      <template #header>实际进度详情</template>
      <div class="max-h-[75vh] overflow-y-auto pr-2 space-y-5">
        <div class="text-body-sm text-foreground-2">查看实际进度填报详情</div>

        <section class="rounded-xl bg-foundation-page p-4 space-y-4">
          <div class="text-body-md font-medium">日期信息</div>
          <div class="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div v-for="item in viewBasicInfoItems" :key="item.label" class="space-y-1">
              <div class="text-body-xs text-foreground-2">{{ item.label }}</div>
              <div class="text-body-md font-medium whitespace-pre-wrap break-words">
                {{ item.value }}
              </div>
            </div>
          </div>
        </section>

        <section
          v-if="viewRecord && viewRecord.tasks && viewRecord.tasks.length"
          class="rounded-xl bg-foundation-page p-4 space-y-3"
        >
          <div class="text-body-md font-medium">今日填报进度</div>
          <div class="space-y-2">
            <div
              v-for="(task, idx) in viewRecord.tasks"
              :key="idx"
              class="rounded-lg border border-outline-2 bg-foundation p-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <div class="text-body-sm font-medium">{{ task.taskName }}</div>
                  <div class="text-body-xs text-foreground-2 mt-1">
                    本次完成：{{ task.completedVolume }}{{ task.unit || '' }}
                    <span v-if="task.plannedVolume" class="ml-2"
                      >/ 计划：{{ task.plannedVolume }}{{ task.unit || '' }}</span
                    >
                  </div>
                </div>
                <button
                  v-if="getViewTaskSelectionCount(task) > 0"
                  type="button"
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-body-xs font-medium bg-success-lighter text-success-darker shrink-0 hover:opacity-90"
                  @click="openAssociatedModelDrawer(task)"
                >
                  查看关联BIM（{{ getViewTaskSelectionCount(task) }}）
                </button>
                <span
                  v-else
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-body-xs font-medium bg-foundation-2 text-foreground-2 shrink-0"
                >
                  未关联BIM
                </span>
              </div>
            </div>
          </div>
        </section>
        <section
          v-else
          class="rounded-xl bg-foundation-page p-4 text-body-sm text-foreground-2"
        >
          暂无今日填报进度明细
        </section>



        <section class="rounded-xl bg-foundation-page p-4 space-y-4">
          <div class="text-body-md font-medium">备注</div>
          <div class="rounded-xl bg-foundation px-4 py-4 text-body-md whitespace-pre-wrap break-words">
            {{ displayDetailValue(viewRecord?.remark) }}
          </div>
        </section>
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
        <span v-if="selectedAssociationTaskName" class="text-sm text-foreground-2">
          | {{ selectedAssociationTaskName }}
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

    <!-- 新增/编辑弹窗 -->
    <LayoutDialog
      v-model:open="dialogOpen"
      max-width="xl"
      :buttons="dialogButtons"
      :prevent-close-on-click-outside="taskSelectOpen"
    >
      <template #header>{{ dialogTitle }}</template>
      <div class="space-y-6 max-h-[80vh] overflow-y-auto pr-1">

        <!-- 日期信息 -->
        <section class="space-y-3">
          <div class="text-body-sm font-semibold text-foreground border-b border-outline-2 pb-2">日期信息</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormTextInput
              v-model="draftForm.reportTimestamp"
              name="actual-report-timestamp"
              label="填报日期"
              type="date"
              show-label
            />
            <FormTextInput
              v-model="draftForm.weekDay"
              name="actual-week-day"
              label="星期"
              show-label
              :disabled="true"
            />
          </div>

          <div class="rounded-xl border border-outline-2 bg-foundation-page p-4 space-y-3">
            <div class="flex items-center gap-2">
              <ClipboardList class="h-4 w-4 text-primary" />
              <div class="text-body-sm font-semibold text-foreground">选择月度计划</div>
              <span class="text-danger text-body-xs">*</span>
            </div>
            <div class="text-body-xs text-foreground-2">
              选择后自动带出该月度计划的任务细项，支持继续补充计划外任务。
            </div>
            <select
              v-model="draftForm.yearMonth"
              aria-label="选择月度计划"
              class="w-full rounded border border-outline-3 bg-foundation px-3 py-2 outline-none text-body-sm"
              @change="onYearMonthChange"
            >
              <option value="">-- 请选择月份 --</option>
              <option
                v-for="plan in monthlyPlans"
                :key="plan.id"
                :value="plan.yearMonth"
              >
                {{ plan.yearMonth }}（{{ plan.tasks?.length || 0 }} 项任务）
              </option>
            </select>
            <div
              v-if="selectedMonthlyPlan"
              class="flex flex-wrap items-center gap-2 text-body-xs"
            >
              <span class="inline-flex items-center rounded-full bg-primary-muted px-2.5 py-1 font-medium text-primary">
                当前计划：{{ selectedMonthlyPlan.yearMonth }}
              </span>
              <span class="inline-flex items-center rounded-full bg-foundation px-2.5 py-1 text-foreground-2 border border-outline-2">
                {{ selectedMonthlyPlan.tasks?.length || 0 }} 项任务
              </span>
            </div>
          </div>
        </section>

        <!-- 工程细项 -->
        <section class="space-y-3">
          <div class="flex items-center justify-between border-b border-outline-2 pb-2">
            <div class="flex items-center gap-2">
              <div class="text-body-sm font-semibold text-foreground">今日进度填报</div>
              <span
                v-if="draftForm.tasks.length"
                class="inline-flex items-center rounded-full px-2 py-0.5 text-body-xs font-medium bg-foundation-2 text-foreground-2"
              >
                {{ draftForm.tasks.length }} 项任务
              </span>
            </div>
            <FormButton size="sm" color="outline" :icon-left="Plus" @click="openTaskSelectDialog">
              从总计划添加
            </FormButton>
          </div>

          <div
            v-if="draftForm.yearMonth"
            class="rounded-xl border border-outline-2 bg-foundation-page px-4 py-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center rounded-full bg-primary-muted px-2.5 py-1 text-body-xs font-medium text-primary">
                {{ draftForm.yearMonth }}
              </span>
              <span class="text-body-xs text-foreground-2">
                已选择月度计划，当前共 {{ draftTaskCount }} 项任务待填报。
              </span>
            </div>
          </div>

          <div v-if="isLoadingMonthlyTasks" class="text-body-sm text-foreground-2 py-4 text-center">
            正在加载月度计划细项...
          </div>

          <!-- 任务表格 -->
          <div
            v-else
            class="rounded-lg overflow-hidden border border-outline-2"
          >
            <!-- 表头 -->
            <div
              class="grid text-body-xs font-medium text-foreground-2 bg-foundation-2 border-b border-outline-2"
              style="grid-template-columns: 1.8fr 100px 56px 120px 90px 40px; padding: 8px 12px;"
            >
              <div>任务名称</div>
              <div class="text-center">本月计划工程量</div>
              <div class="text-center">单位</div>
              <div class="text-center">本次完成工程量</div>
              <div class="text-center">BIM关联</div>
              <div class="text-center">操作</div>
            </div>

            <!-- 空状态 -->
            <div
              v-if="!draftForm.tasks.length"
              class="py-8 text-center text-body-sm text-foreground-2 bg-foundation"
            >
              {{ draftForm.yearMonth ? '该月度计划暂无细项，可点击"从总计划添加"' : '请先选择所属月份' }}
            </div>

            <!-- 任务行 -->
            <div
              v-for="(task, idx) in draftForm.tasks"
              :key="idx"
              class="grid items-center bg-foundation border-b border-outline-2 last:border-b-0 hover:bg-foundation-2/40 transition-colors"
              style="grid-template-columns: 1.8fr 100px 56px 120px 90px 40px; padding: 8px 12px;"
            >
              <!-- 任务名 -->
              <div class="pr-2">
                <div class="text-body-xs font-medium text-foreground truncate" :title="task.taskName">
                  {{ task.taskName }}
                </div>
                <div v-if="task.linkedPlanTaskId" class="text-body-xs text-foreground-2 mt-0.5 flex items-center gap-1">
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                  月度计划
                </div>
              </div>

              <!-- 计划工程量 -->
              <div class="text-body-xs text-center text-foreground-2">
                {{ task.plannedVolume || '-' }}
              </div>

              <!-- 单位 -->
              <div class="text-body-xs text-center text-foreground-2">
                {{ task.unit || '-' }}
              </div>

              <!-- 本次完成工程量 -->
              <div class="px-1">
                <input
                  type="number"
                  :value="task.completedVolume"
                  min="0"
                  :aria-label="`${task.taskName} 本次完成工程量`"
                  class="w-full h-7 rounded border border-outline-3 bg-foundation px-2 text-body-xs outline-none focus:border-primary text-center"
                  placeholder="0"
                  @input="(e) => task.completedVolume = (e.target as HTMLInputElement).value"
                />
              </div>

              <!-- BIM关联 -->
              <div class="text-center">
                <CommonModelObjectMultiModelSelectDrawer
                  v-model:model_ids="task.modelIds"
                  v-model:selections="task.selections"
                  :project-id="projectId"
                >
                  <template #trigger>
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-body-xs transition-colors"
                      :class="
                        task.selections && task.selections.length > 0
                          ? 'bg-success-lighter text-success-darker border border-success-lighter'
                          : 'bg-foundation-2 text-foreground-2 border border-outline-3'
                      "
                    >
                      <Box class="h-3 w-3" />
                      <span>
                        {{ getTaskSelectionCount(task) > 0 ? `${getTaskSelectionCount(task)}件` : '关联' }}
                      </span>
                    </button>
                  </template>
                </CommonModelObjectMultiModelSelectDrawer>
              </div>

              <!-- 删除 -->
              <div class="flex justify-center">
                <button
                  class="p-1.5 rounded text-foreground-2 hover:text-danger hover:bg-danger/10 transition-colors"
                  title="移除细项"
                  @click="removeTask(idx)"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <!-- 底部：从总计划添加入口（当已有月度计划时显示） -->
            <div
              v-if="draftForm.yearMonth"
              class="px-3 py-2 bg-foundation border-t border-outline-2"
            >
              <button
                type="button"
                class="flex items-center gap-1.5 text-body-xs px-3 py-1.5 rounded transition-colors text-primary border border-dashed border-primary/50 hover:bg-primary/5"
                @click="openTaskSelectDialog"
              >
                <Plus class="h-3.5 w-3.5" />
                新增计划外任务
              </button>
            </div>
          </div>
        </section>

        <!-- 备注 -->
        <section class="space-y-3">
          <div class="text-body-sm font-semibold text-foreground border-b border-outline-2 pb-2">备注</div>
          <FormTextArea
            v-model="draftForm.remark"
            name="actual-remark"
            label="备注"
            show-label
          />
        </section>


        <!-- 人员信息 -->
        <section class="space-y-3">
          <div class="text-body-sm font-semibold text-foreground border-b border-outline-2 pb-2">人员信息</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormTextInput
              v-model="draftForm.siteLeader"
              name="actual-site-leader"
              label="现场负责人"
              placeholder="请输入现场负责人姓名"
              show-label
            />
            <FormTextInput
              v-model="draftForm.reporter"
              name="actual-reporter"
              label="记录人"
              placeholder="请输入记录人姓名"
              show-label
            />
          </div>
        </section>
      </div>
    </LayoutDialog>

    <!-- 任务选择弹窗 -->
    <TaskSelectDialog
      v-if="taskSelectOpen"
      :open="taskSelectOpen"
      :master-tasks="masterTaskOptions"
      :selected-task-id="null"
      @update:open="taskSelectOpen = $event"
      @select="onTaskSelectConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import {
  Box,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X
} from 'lucide-vue-next'
import {
  CommonModelObjectMultiModelSelectDrawer,
  CommonModelPropsViewer
} from '#components'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'
import {
  createActualProgressRecord,
  deleteActualProgressRecord,
  getActualProgressRecords,
  getProgressMonthlyPlans,
  getProgressPlanTasks,
  importActualProgressRecordsFromExcel,
  updateActualProgressRecord,
  type ActualProgressRecord,
  type ActualProgressRecordBimSelection,
  type ActualProgressRecordInput,
  type MonthlyRecordItem,
  type ProgressPlanTask
} from '~/lib/projects/api/progress'
import TaskSelectDialog from '~/components/projects/progress/TaskSelectDialog.vue'
import type { MasterTaskOption } from '~/components/projects/progress/TaskSelectDialog.vue'
import type { LayoutDialogButton } from '@speckle/ui-components'

type DialogMode = 'create' | 'edit'

type DraftTaskItem = {
  linkedPlanTaskId: string | null
  taskName: string
  plannedVolume: string
  completedVolume: string
  unit: string
  modelIds: string[]
  selections: Array<{ modelId: string; applicationIds: string[] }>
}

type ActualProgressForm = {
  id: string
  yearMonth: string
  reportTimestamp: string
  weekDay: string
  reportDate: string
  siteLeader: string
  reporter: string
  remark: string
  tasks: DraftTaskItem[]
  workers: string[]
  taskName: string
  startModelIds: string[]
  startApplicationIds: string[]
  startSelections: ActualProgressRecordBimSelection[]
  finishModelIds: string[]
  finishApplicationIds: string[]
  finishSelections: ActualProgressRecordBimSelection[]
  startBIM: Array<{ modelId: string; applicationIds: string[]; bimIds: (string | null)[] }>
  finishBIM: Array<{ modelId: string; applicationIds: string[]; bimIds: (string | null)[] }>
  startElementCodes: string
  finishElementCodes: string
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
  selections: ActualProgressRecordBimSelection[] | null | undefined
): ActualProgressRecordBimSelection[] =>
  (Array.isArray(selections) ? selections : [])
    .map((group) => ({
      modelId: normalizeString(group?.modelId),
      applicationIds: uniqueStrings(group?.applicationIds || [])
    }))
    .filter((group) => group.modelId && group.applicationIds.length > 0)

const columns = [
  { id: 'reportDate', header: '日期', classes: 'col-span-2' },
  { id: 'yearMonth', header: '月份', classes: 'col-span-1' },
  { id: 'siteLeader', header: '现场负责人', classes: 'col-span-1' },
  { id: 'reporter', header: '记录人', classes: 'col-span-1' },
  { id: 'tasksInfo', header: '工程细项', classes: 'col-span-3' },
  { id: 'bimInfo', header: 'BIM关联', classes: 'col-span-1' },
  { id: 'remark', header: '备注', classes: 'col-span-1' },
  { id: 'actions', header: '操作', classes: 'col-span-2 text-right' }
]

const createDefaultForm = (): ActualProgressForm => ({
  id: '',
  yearMonth: '',
  taskName: '',
  reportTimestamp: new Date().toISOString().slice(0, 10),
  weekDay: '',
  reportDate: new Date().toISOString().slice(0, 10),
  siteLeader: '',
  reporter: '',
  startElementCodes: '',
  finishElementCodes: '',
  startModelIds: [],
  startApplicationIds: [],
  startSelections: [],
  finishModelIds: [],
  finishApplicationIds: [],
  finishSelections: [],
  startBIM: [],
  finishBIM: [],
  remark: '',
  tasks: [],
  workers: []
})

const route = useRoute()
const { hasFunctionalPerm } = useCustomPermissions()
const { triggerNotification } = useGlobalToast()
const apiOrigin = useApiOrigin()

const actualItems = ref<ActualProgressRecord[]>([])
const searchQuery = ref('')
const itemsPerPage = ref(20)
const currentPage = ref(1)
const importInputRef = ref<HTMLInputElement | null>(null)
const dialogOpen = ref(false)
const viewDialogOpen = ref(false)
const dialogMode = ref<DialogMode>('create')
const editingId = ref<string | null>(null)
const draftForm = ref<ActualProgressForm>(createDefaultForm())
const lastOperation = ref('尚未执行导入导出操作')
const isLoadingRecords = ref(false)
const isImportingExcel = ref(false)
const isSavingRecord = ref(false)
const deletingRecordId = ref<string | null>(null)
const viewRecord = ref<ActualProgressRecord | null>(null)
const associatedModelDrawerOpen = ref(false)
const selectedAssociationTaskName = ref('')
const selectedAssociationModelIds = ref<string[]>([])
const selectedAssociationApplicationIds = ref<string[]>([])
const selectedAssociationBimIds = ref<string[]>([])

const monthlyPlans = ref<MonthlyRecordItem[]>([])
const isLoadingMonthlyTasks = ref(false)
const planTasks = ref<ProgressPlanTask[]>([])
const taskSelectOpen = ref(false)

const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const filteredItems = computed(() => {
  const query = searchQuery.value.trim()
  if (!query) return actualItems.value
  return actualItems.value.filter((item) =>
    [item.reportDate, item.yearMonth, item.reporter, item.siteLeader, item.remark]
      .join(' ')
      .includes(query)
  )
})

const totalItems = computed(() => filteredItems.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / itemsPerPage.value)))
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredItems.value.slice(start, start + itemsPerPage.value)
})
const startItemIndex = computed(() =>
  totalItems.value === 0 ? 0 : (currentPage.value - 1) * itemsPerPage.value + 1
)
const endItemIndex = computed(() =>
  Math.min(currentPage.value * itemsPerPage.value, totalItems.value)
)

const dialogTitle = computed(() =>
  dialogMode.value === 'create' ? '新增实际进度' : '编辑实际进度'
)

const dialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline', disabled: isSavingRecord.value },
    onClick: () => { dialogOpen.value = false }
  },
  {
    text: dialogMode.value === 'create' ? '保存新增' : '保存修改',
    props: { color: 'primary', disabled: isSavingRecord.value },
    onClick: () => { saveDraft() }
  }
])

const viewDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '关闭',
    props: { color: 'outline' },
    onClick: () => { viewDialogOpen.value = false }
  }
])

const masterTaskOptions = computed<MasterTaskOption[]>(() =>
  planTasks.value.map((t) => ({
    id: t.id,
    taskName: t.taskName,
    level: t.level ?? 0,
    hasChildren: false,
    parentId: t.parentId ?? undefined,
    volume: '',
    unit: '',
    startDate: t.startDate ?? undefined,
    endDate: t.endDate ?? undefined
  }))
)

const existingLinkedPlanTaskIds = computed(
  () => new Set(draftForm.value.tasks.map((t) => t.linkedPlanTaskId).filter(Boolean))
)

const selectedMonthlyPlan = computed(() =>
  monthlyPlans.value.find((plan) => plan.yearMonth === draftForm.value.yearMonth) || null
)

const draftTaskCount = computed(() => draftForm.value.tasks.length)

const formatDateTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('zh-CN', { hour12: false })
}

const buildWeekDay = (reportDate: string) => {
  const date = new Date(reportDate)
  const dayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return Number.isNaN(date.getTime()) ? '' : dayMap[date.getDay()]
}

const syncReportDateFields = () => {
  draftForm.value.reportDate = draftForm.value.reportTimestamp
    ? draftForm.value.reportTimestamp.slice(0, 10)
    : ''
  draftForm.value.weekDay = buildWeekDay(draftForm.value.reportDate)
}

const displayDetailValue = (value: string | null | undefined) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || '-'
}

const countAllTaskBimLinks = (item: ActualProgressRecord) => {
  if (!item.tasks || !Array.isArray(item.tasks)) return 0
  return item.tasks.reduce((acc, task) => {
    if (!task.selections || !Array.isArray(task.selections)) return acc
    return (
      acc +
      task.selections.reduce((s: number, sel: { applicationIds?: string[] }) => s + (sel.applicationIds?.length || 0), 0)
    )
  }, 0)
}

const getTaskSelectionCount = (task: DraftTaskItem) =>
  (task.selections || []).reduce((acc, selection) => acc + (selection.applicationIds?.length || 0), 0)

const getViewTaskSelectionCount = (task: NonNullable<ActualProgressRecord['tasks']>[number]) =>
  (task.selections || []).reduce((acc, selection) => acc + (selection.applicationIds?.length || 0), 0)

const showSuccess = (title: string, description: string) => {
  triggerNotification({ type: ToastNotificationType.Success, title, description })
}

const showMessage = (
  title: string,
  description: string,
  type: ToastNotificationType = ToastNotificationType.Danger
) => {
  triggerNotification({ type, title, description })
}

const fetchActualRecords = async () => {
  if (!projectId.value) {
    actualItems.value = []
    return
  }
  isLoadingRecords.value = true
  try {
    const records = await getActualProgressRecords({ projectId: projectId.value, apiOrigin })
    actualItems.value = records
    if (!records.length) {
      lastOperation.value = '暂无实际进度填报记录'
      return
    }
    const [latestRecord] = [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    if (latestRecord) {
      lastOperation.value = `最近更新于 ${formatDateTime(latestRecord.updatedAt)}`
    }
  } catch (error) {
    actualItems.value = []
    showMessage('加载实际进度失败', error instanceof Error ? error.message : '未能获取实际进度列表')
  } finally {
    isLoadingRecords.value = false
  }
}

const fetchMonthlyPlans = async () => {
  if (!projectId.value) return
  try {
    monthlyPlans.value = await getProgressMonthlyPlans({ projectId: projectId.value, apiOrigin })
  } catch {
    monthlyPlans.value = []
  }
}

const fetchPlanTasks = async () => {
  if (!projectId.value) return
  try {
    planTasks.value = await getProgressPlanTasks({ projectId: projectId.value, apiOrigin })
  } catch {
    planTasks.value = []
  }
}

const onYearMonthChange = async () => {
  const yearMonth = draftForm.value.yearMonth
  if (!yearMonth) {
    draftForm.value.tasks = []
    return
  }
  const plan = monthlyPlans.value.find((p) => p.yearMonth === yearMonth)
  if (!plan) return
  isLoadingMonthlyTasks.value = true
  try {
    draftForm.value.tasks = (plan.tasks || []).map((t) => ({
      linkedPlanTaskId: t.linkedPlanTaskId ?? null,
      taskName: t.taskName,
      plannedVolume: String(t.plannedVolume ?? ''),
      completedVolume: '0',
      unit: t.unit ?? '',
      modelIds: [],
      selections: []
    }))
  } finally {
    isLoadingMonthlyTasks.value = false
  }
}

const openTaskSelectDialog = async () => {
  if (!planTasks.value.length) await fetchPlanTasks()
  taskSelectOpen.value = true
}

const onTaskSelectConfirm = (task: MasterTaskOption) => {
  taskSelectOpen.value = false
  if (existingLinkedPlanTaskIds.value.has(task.id)) {
    showMessage('提示', '该任务已在细项列表中', ToastNotificationType.Warning)
    return
  }
  draftForm.value.tasks.push({
    linkedPlanTaskId: task.id,
    taskName: task.taskName,
    plannedVolume: task.volume ?? '',
    completedVolume: '0',
    unit: task.unit ?? '',
    modelIds: [],
    selections: []
  })
}

const removeTask = (idx: number) => {
  draftForm.value.tasks.splice(idx, 1)
}

const cloneRecordToForm = (item: ActualProgressRecord): ActualProgressForm => ({
  id: item.id,
  yearMonth: item.yearMonth || '',
  taskName: item.taskName || '',
  reportTimestamp: item.reportDate || new Date().toISOString().slice(0, 10),
  weekDay: item.weekDay,
  reportDate: item.reportDate,
  siteLeader: item.siteLeader || '',
  reporter: item.reporter || '',
  startElementCodes: item.startElementCodes,
  finishElementCodes: item.finishElementCodes,
  startModelIds: item.startModelIds || [],
  startApplicationIds: item.startApplicationIds || [],
  startSelections: normalizeSelections(item.startSelections),
  finishModelIds: item.finishModelIds || [],
  finishApplicationIds: item.finishApplicationIds || [],
  finishSelections: normalizeSelections(item.finishSelections),
  startBIM: item.startBIM || [],
  finishBIM: item.finishBIM || [],
  remark: item.remark,
  tasks: (item.tasks || []).map((t) => ({
    linkedPlanTaskId: t.linkedPlanTaskId ?? null,
    taskName: t.taskName,
    plannedVolume: String(t.plannedVolume ?? ''),
    completedVolume: String(t.completedVolume ?? '0'),
    unit: t.unit ?? '',
    modelIds: (t.selections || []).map((s: { modelId: string }) => s.modelId),
    selections: (t.selections || []).map(
      (s: { modelId: string; applicationIds: string[] }) => ({
        modelId: s.modelId,
        applicationIds: s.applicationIds || []
      })
    )
  })),
  workers: item.workers || []
})

const buildRecordInput = (form: ActualProgressForm): ActualProgressRecordInput => {
  syncReportDateFields()
  return {
    taskName: form.taskName.trim() || (form.tasks[0]?.taskName ?? '填报'),
    reportDate: form.reportDate,
    siteLeader: form.siteLeader.trim(),
    reporter: form.reporter.trim(),
    remark: form.remark,
    yearMonth: form.yearMonth,
    tasks: form.tasks.map((t) => ({
      linkedPlanTaskId: t.linkedPlanTaskId,
      taskName: t.taskName,
      plannedVolume: t.plannedVolume,
      completedVolume: t.completedVolume,
      unit: t.unit,
      selections: t.selections || []
    })),
    workers: form.workers
  }
}

const viewBasicInfoItems = computed(() => [
  { label: '日期', value: displayDetailValue(viewRecord.value?.reportDate) },
  { label: '星期', value: displayDetailValue(viewRecord.value?.weekDay) },
  { label: '月度计划', value: displayDetailValue(viewRecord.value?.yearMonth) },
  { label: '现场负责人', value: displayDetailValue(viewRecord.value?.siteLeader) },
  { label: '记录人', value: displayDetailValue(viewRecord.value?.reporter) }
])

const openCreateDialog = async () => {
  dialogMode.value = 'create'
  editingId.value = null
  draftForm.value = createDefaultForm()
  syncReportDateFields()
  await Promise.all([fetchMonthlyPlans(), fetchPlanTasks()])
  dialogOpen.value = true
}

const openEditDialog = async (item: ActualProgressRecord) => {
  dialogMode.value = 'edit'
  editingId.value = item.id
  draftForm.value = cloneRecordToForm(item)
  syncReportDateFields()
  await Promise.all([fetchMonthlyPlans(), fetchPlanTasks()])
  dialogOpen.value = true
}

const openViewDialog = (item: ActualProgressRecord) => {
  viewRecord.value = item
  viewDialogOpen.value = true
}

const openAssociatedModelDrawer = (
  task: NonNullable<ActualProgressRecord['tasks']>[number]
) => {
  selectedAssociationTaskName.value = task.taskName || '-'
  selectedAssociationModelIds.value = uniqueStrings((task.selections || []).map((item) => item.modelId))
  selectedAssociationApplicationIds.value = uniqueStrings(
    (task.selections || []).flatMap((item) => item.applicationIds || [])
  )
  // Actual progress links currently persist applicationIds in selections.
  // Reuse applicationIds as fallback filter keys for the props viewer.
  selectedAssociationBimIds.value = [...selectedAssociationApplicationIds.value]
  associatedModelDrawerOpen.value = true
}

const saveDraft = async () => {
  syncReportDateFields()

  if (!projectId.value) {
    showMessage('保存失败', '当前未识别项目ID，无法保存实际进度。', ToastNotificationType.Warning)
    return
  }
  if (!draftForm.value.yearMonth) {
    showMessage('保存失败', '请选择所属月度计划。', ToastNotificationType.Warning)
    return
  }
  if (!draftForm.value.reportDate) {
    showMessage('保存失败', '请填写有效的填报日期。', ToastNotificationType.Warning)
    return
  }

  isSavingRecord.value = true
  try {
    if (dialogMode.value === 'create') {
      const created = await createActualProgressRecord({
        projectId: projectId.value,
        apiOrigin,
        input: buildRecordInput(draftForm.value)
      })
      await fetchActualRecords()
      lastOperation.value = `已新增 ${created.reportDate} 的实际进度记录`
      showSuccess('实际进度已新增', '已生成新的施工日志填报记录。')
    } else if (editingId.value) {
      const updated = await updateActualProgressRecord({
        projectId: projectId.value,
        recordId: editingId.value,
        apiOrigin,
        input: buildRecordInput(draftForm.value)
      })
      await fetchActualRecords()
      lastOperation.value = `已更新 ${updated.reportDate} 的实际进度记录`
      showSuccess('实际进度已更新', '当前施工日志及 BIM 关联信息已保存。')
    }
    dialogOpen.value = false
  } catch (error) {
    showMessage(
      dialogMode.value === 'create' ? '新增失败' : '保存失败',
      error instanceof Error ? error.message : '保存实际进度失败'
    )
  } finally {
    isSavingRecord.value = false
  }
}

const handleDelete = async (id: string) => {
  if (!projectId.value) return
  deletingRecordId.value = id
  try {
    await deleteActualProgressRecord({ projectId: projectId.value, recordId: id, apiOrigin })
    await fetchActualRecords()
    showSuccess('已删除', '实际进度记录已成功删除。')
  } catch (error) {
    showMessage('删除失败', error instanceof Error ? error.message : '删除实际进度记录失败')
  } finally {
    deletingRecordId.value = null
  }
}

const triggerImportExcel = () => { importInputRef.value?.click() }

const handleImportFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !projectId.value) return
  isImportingExcel.value = true
  try {
    const result = await importActualProgressRecordsFromExcel({
      projectId: projectId.value,
      apiOrigin,
      file
    })
    await fetchActualRecords()
    lastOperation.value = `已导入 ${file.name}，新增 ${result.createdCount} 条实际进度记录`
    showSuccess('导入成功', `已通过后端解析 Excel，并导入 ${result.createdCount} 条记录。`)
  } catch (error) {
    showMessage('导入失败', error instanceof Error ? error.message : '实际进度 Excel 导入失败')
  } finally {
    isImportingExcel.value = false
    input.value = ''
  }
}

const handleExportExcel = () => {
  showMessage('导出能力待接入', '当前仅保留 Excel 导出入口。', ToastNotificationType.Info)
}

watch(
  () => draftForm.value.reportTimestamp,
  () => { syncReportDateFields() }
)

watch(itemsPerPage, () => { currentPage.value = 1 })

watch(totalPages, (pageCount) => {
  if (currentPage.value > pageCount) currentPage.value = pageCount
})

watch(
  projectId,
  () => {
    void fetchActualRecords()
    void fetchMonthlyPlans()
    void fetchPlanTasks()
  },
  { immediate: true }
)
</script>
