<template>
  <div>
    <div class="flex flex-col h-full space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-heading-lg text-foreground mt-3">月度验工</h1>
        <div class="flex items-center space-x-2 text-sm">
          <FormTextInput
            v-model="searchQuery"
            name="monthly-measurement-search"
            placeholder="搜索验工编码/施工单位"
            show-clear
            class="w-72 text-sm"
          >
            <template #input-right>
              <div
                class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"
              >
                <MagnifyingGlassIcon class="h-5 w-5 text-foreground-2" />
              </div>
            </template>
          </FormTextInput>
          <FormButton :icon-left="PlusIcon" color="primary" @click="openCreateDialog">
            新增
          </FormButton>
        </div>
      </div>

      <div
        class="flex-grow overflow-hidden bg-foundation rounded-lg border border-outline-3 flex flex-col"
      >
        <LayoutTable
          :columns="columns"
          :items="tableItems"
          class="h-full"
          empty-message="暂无月度验工"
        >
          <template #code="{ item }">
            <button
              class="text-sm font-medium text-primary hover:underline font-mono"
              @click="viewItem(item)"
            >
              {{ item.code }}
            </button>
          </template>
          <template #contractCode="{ item }">
            <span class="text-sm text-foreground">{{ item.contractCode || '-' }}</span>
          </template>
          <template #creator="{ item }">
            <span class="text-sm text-foreground">{{ item.creator?.name || '-' }}</span>
          </template>
          <template #roundName="{ item }">
            <span class="text-sm text-foreground">{{ item.roundName || '-' }}</span>
          </template>
          <template #createdAt="{ item }">
            <span class="text-sm text-foreground">
              {{
                formatDate(
                  Number(item.createdAt ? new Date(item.createdAt).getTime() : 0)
                )
              }}
            </span>
          </template>
          <template #baseDate="{ item }">
            <span class="text-sm text-foreground">
              {{ dayjs(Number(item.baseDate)).format('YYYY-MM') }}
            </span>
          </template>
          <template #totalAmount="{ item }">
            <span class="text-sm text-foreground font-mono font-medium">
              {{
                item.totalAmount != null
                  ? Number(item.totalAmount).toLocaleString()
                  : '0'
              }}
            </span>
          </template>
          <template #status="{ item }">
            <button
              v-if="item.flowInstanceId"
              class="cursor-pointer text-sm"
              title="查看流程详情"
              @click="openFlowDetail(item)"
            >
              <CommonBadge
                :color-classes="getStatusColor(item.approveStatus)"
                class="text-sm font-medium"
                rounded
              >
                {{ getStatusText(item.approveStatus) }}
              </CommonBadge>
            </button>
            <CommonBadge
              v-else
              :color-classes="getStatusColor(item.approveStatus)"
              class="text-sm font-medium"
              rounded
            >
              {{ getStatusText(item.approveStatus) }}
            </CommonBadge>
          </template>
          <template #currentApprovers="{ item }">
            <span class="text-sm text-foreground">
              {{ item.currentStepApprovers?.join(', ') || '-' }}
            </span>
          </template>
          <template #actions="{ item }">
            <div class="flex items-center justify-end gap-1.5 text-sm">
              <button
                class="rounded p-1 text-primary transition-colors hover:text-primary-focus"
                title="查看详情"
                @click="viewItem(item)"
              >
                <EyeIcon class="h-4 w-4" />
              </button>
              <button
                class="rounded p-1 text-success transition-colors hover:text-success-darker disabled:cursor-not-allowed disabled:opacity-40"
                title="送审"
                :disabled="isSubmitted(item)"
                @click="triggerSubmitItem(item)"
              >
                <PaperAirplaneIcon class="h-4 w-4" />
              </button>
              <button
                class="rounded p-1 text-warning transition-colors hover:text-warning-darker disabled:cursor-not-allowed disabled:opacity-40"
                title="编辑"
                :disabled="isSubmitted(item)"
                @click="editItem(item)"
              >
                <PencilSquareIcon class="h-4 w-4" />
              </button>
              <button
                class="rounded p-1 text-danger transition-colors hover:text-danger-darker disabled:cursor-not-allowed disabled:opacity-40"
                title="删除"
                :disabled="isSubmitted(item)"
                @click="deleteItem(item)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </template>
        </LayoutTable>

        <div
          class="flex items-center justify-between border-t border-outline-3 bg-foundation p-4 text-[13px] leading-5"
        >
          <div class="text-[13px] leading-5 text-foreground-2">
            每页显示
            <label for="monthly-measurement-page-size" class="sr-only">
              每页显示条数
            </label>
            <select
              id="monthly-measurement-page-size"
              v-model="pageSize"
              class="mx-1 rounded border border-outline-3 bg-foundation px-2 py-1 text-[13px] leading-5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
            条 &nbsp; 共 {{ totalItems }} 条，第 {{ startItem }}-{{ endItem }} 条
          </div>
          <div class="flex items-center space-x-2">
            <button
              class="rounded border border-outline-3 px-2 py-1 text-[13px] leading-5 text-foreground-2 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage === 1"
              @click="goPrevPage"
            >
              &lt; 上一页
            </button>
            <span class="px-2 text-[13px] leading-5 text-foreground-2">
              第 {{ currentPage }} / {{ totalPages || 1 }} 页
            </span>
            <button
              class="rounded border border-outline-3 px-2 py-1 text-[13px] leading-5 text-foreground-2 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!nextCursor"
              @click="goNextPage"
            >
              下一页 &gt;
            </button>
          </div>
        </div>
      </div>
    </div>

    <LayoutDialog
      v-model:open="createDialogOpen"
      max-width="xl"
      prevent-close-on-click-outside
      :buttons="createDialogButtons"
    >
      <template #header>{{ dialogTitle }}</template>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormTextInput
            v-model="createForm.roundName"
            name="monthly-measurement-round-name"
            label="期数"
            show-label
            show-required
            placeholder="如：1期"
            :disabled="isViewMode"
          />
          <FormTextInput
            v-model="createForm.baseDate"
            name="monthly-measurement-base-date"
            label="年月"
            type="month"
            show-label
            show-required
            :disabled="isViewMode"
          />
          <FormTextInput
            v-model="createForm.startDate"
            name="monthly-measurement-start-date"
            label="计量开始时间"
            type="date"
            show-label
            show-required
            :disabled="isViewMode"
          />
          <FormTextInput
            v-model="createForm.endDate"
            name="monthly-measurement-end-date"
            label="计量结束时间"
            type="date"
            show-label
            show-required
            :disabled="isViewMode"
          />
        </div>
        <div v-if="createError" class="text-body-sm text-danger mt-2">
          {{ createError }}
        </div>
      </div>
    </LayoutDialog>

    <LayoutDialog
      v-model:open="submitConfirmOpen"
      max-width="xl"
      :buttons="submitConfirmButtons"
    >
      <template #header>确认送审流程</template>
      <div v-if="submitTargetItem" class="space-y-4">
        <div class="text-sm text-foreground-2">
          请确认本次送审将使用当前已启用的月度验工审批流程。
          <p class="mt-1 font-semibold text-foreground">
            验工编码：
            <span class="font-mono">{{ submitTargetItem.code }}</span>
          </p>
        </div>
        <div class="rounded-lg border border-outline-3 bg-foundation p-3">
          <div v-if="submitFlowLoading" class="text-sm text-foreground-2">
            正在读取当前已启用的月度验工审批流程...
          </div>
          <div v-else-if="activeSubmitFlow" class="space-y-2 text-sm">
            <div class="font-medium text-foreground">
              流程名称：{{ activeSubmitFlow.name }}
              <span class="ml-2 text-foreground-2">
                V{{ activeSubmitFlow.version }}
              </span>
            </div>
            <div class="text-foreground-2">
              审批节点：{{
                activeSubmitFlow.steps.map((step) => step.role).join(' -> ') || '-'
              }}
            </div>
          </div>
          <div v-else class="text-sm text-danger">
            未找到当前已启用的月度验工审批流程，请先到审批流程设置中启用。
          </div>
        </div>
        <FormTextArea
          v-model="submitRemark"
          label="送审说明"
          placeholder="请输入送审说明"
          name="remark"
          show-label
        />
      </div>
    </LayoutDialog>

    <LayoutDialog
      v-model:open="submitFinalConfirmOpen"
      max-width="lg"
      :buttons="submitFinalConfirmButtons"
    >
      <template #header>二次确认送审</template>
      <div v-if="submitTargetItem && activeSubmitFlow" class="space-y-4">
        <div class="text-sm text-foreground-2">
          请再次确认，送审后将按当前启用版本发起审批流程。
        </div>
        <div class="rounded-lg border border-outline-3 bg-foundation p-3 text-sm">
          <div class="font-medium text-foreground">
            验工编码：
            <span class="font-mono">{{ submitTargetItem.code }}</span>
          </div>
          <div class="mt-2 text-foreground-2">
            审批流程：{{ activeSubmitFlow.name }}（V{{ activeSubmitFlow.version }}）
          </div>
          <div class="mt-1 text-foreground-2">
            送审说明：{{ submitRemark.trim() || '送审' }}
          </div>
        </div>
      </div>
    </LayoutDialog>

    <div v-if="flowDetailDrawerOpen" class="fixed inset-0 z-50 flex justify-end">
      <button class="absolute inset-0 bg-black/40" @click="closeFlowDrawer" />
      <div
        class="relative h-full w-full max-w-3xl bg-foundation-page border-l border-outline-3 shadow-xl overflow-y-auto"
      >
        <div
          class="p-4 border-b border-outline-3 flex items-center justify-between gap-3"
        >
          <div class="min-w-0">
            <div class="text-body-sm font-medium truncate">
              {{ selectedFlowInstance?.definition?.name || '流程详情' }}
            </div>
            <div class="text-body-xs text-foreground-2">
              #{{ selectedFlowInstance?.id }}
            </div>
          </div>
          <button
            class="px-2 py-1 rounded border border-outline-3 text-body-xs"
            @click="closeFlowDrawer"
          >
            关闭
          </button>
        </div>
        <div class="p-4 space-y-4">
          <div v-if="flowDetailLoading" class="text-body-sm text-foreground-2">
            加载中...
          </div>
          <div v-else-if="!selectedFlowInstance" class="text-body-sm text-foreground-2">
            未找到流程详情
          </div>
          <template v-else>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="border border-outline-3 rounded-lg p-3">
                <div class="text-body-xs text-foreground-2">状态</div>
                <div class="text-body-sm">
                  {{ formatFlowStatusLabel(selectedFlowInstance.status) }}
                </div>
              </div>
              <div class="border border-outline-3 rounded-lg p-3">
                <div class="text-body-xs text-foreground-2">当前步骤</div>
                <div class="text-body-sm">
                  {{ getCurrentFlowStepName(selectedFlowInstance) }}
                </div>
              </div>
              <div class="border border-outline-3 rounded-lg p-3">
                <div class="text-body-xs text-foreground-2">发起时间</div>
                <div class="text-body-sm">
                  {{ formatDateTime(selectedFlowInstance.createdAt) }}
                </div>
              </div>
              <div class="border border-outline-3 rounded-lg p-3">
                <div class="text-body-xs text-foreground-2">更新时间</div>
                <div class="text-body-sm">
                  {{ formatDateTime(selectedFlowInstance.updatedAt) }}
                </div>
              </div>
            </div>
            <div
              v-if="isAdmin"
              class="space-y-2 border border-outline-3 rounded-lg p-3"
            >
              <div class="text-body-sm font-medium">管理员流程操作</div>
              <FormTextArea
                v-model="flowActionComment"
                label="操作说明"
                placeholder="强制操作/重置请填写说明"
                name="flow-admin-comment"
                show-label
              />
              <FormTextInput
                v-model="reactivateTargetStep"
                type="number"
                label="重开到步骤"
                placeholder="请输入步骤序号（如 1）"
                name="flow-reactivate-step"
                show-label
              />
              <div class="flex flex-wrap gap-2">
                <FormButton
                  color="primary"
                  :disabled="!canForceReviewFlow || flowActionLoading"
                  :loading="flowActionLoading"
                  @click="forceApproveFlow"
                >
                  强制通过
                </FormButton>
                <FormButton
                  color="danger"
                  :disabled="!canForceReviewFlow || flowActionLoading"
                  :loading="flowActionLoading"
                  @click="forceRejectFlow"
                >
                  强制驳回
                </FormButton>
                <FormButton
                  color="outline"
                  :disabled="!canForceReviewFlow || flowActionLoading"
                  :loading="flowActionLoading"
                  @click="forceCancelFlow"
                >
                  强制取消
                </FormButton>
                <FormButton
                  color="primary"
                  :disabled="!canReactivateFlow || flowActionLoading"
                  :loading="flowActionLoading"
                  @click="reactivateFlow"
                >
                  激活流程
                </FormButton>
                <FormButton
                  color="outline"
                  :disabled="flowActionLoading"
                  :loading="flowActionLoading"
                  @click="resetFlowToUnsubmitted"
                >
                  重置未送审
                </FormButton>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-body-sm font-medium">流程日志</div>
              <div
                v-if="!selectedFlowInstance.actions.length"
                class="text-body-sm text-foreground-2 border border-outline-3 rounded-lg p-3"
              >
                暂无流程日志
              </div>
              <div
                v-for="action in selectedFlowInstance.actions"
                :key="action.id"
                class="border border-outline-3 rounded-lg p-3 text-body-xs text-foreground-2"
              >
                {{ formatFlowActionLabel(action.action) }} ·
                {{ action.actor?.name || action.actorId || '-' }} ·
                {{ formatDateTime(action.createdAt) }}
                <span v-if="action.toStatus">
                  · {{ formatFlowStatusLabel(action.toStatus) }}
                </span>
                <span v-if="action.comment">· {{ action.comment }}</span>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-body-sm font-medium">流程步骤</div>
              <div
                v-for="step in selectedFlowInstance.steps"
                :key="step.id"
                class="border rounded-lg p-3"
                :class="getFlowStepCardClass(step.status)"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="text-body-sm font-medium">
                    Step {{ step.stepIndex }} · {{ step.name }}
                  </div>
                  <span
                    class="text-body-xs px-2 py-0.5 rounded-full"
                    :class="getFlowStepTagClass(step.status)"
                  >
                    {{ formatFlowStepStatusLabel(step.status) }}
                  </span>
                </div>
                <div class="text-body-xs text-foreground-2 mt-1">
                  审核：{{ step.approvedByIds.length }}/{{ step.requiredApprovals }}
                </div>
                <div class="text-body-xs text-foreground-2 mt-1">
                  审核人：{{
                    step.approverIds.length ? step.approverIds.join('、') : '任意审批人'
                  }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <CommonConfirmDialog
      v-model:open="deleteConfirmOpen"
      title="确认删除该验工单吗？"
      text="确认删除该验工单吗？此操作不可撤销。"
      confirm-text="确认删除"
      @confirm="confirmDeleteItem"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useApolloClient, useMutation, useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import dayjs from 'dayjs'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import {
  LayoutTable,
  FormTextInput,
  FormButton,
  CommonBadge
} from '@speckle/ui-components'
import {
  approvalFlowInstanceDetailsForMonthlyMeasurementQuery,
  projectQualityAcceptanceFormsQuery,
  projectMonthlyMeasurementsQuery
} from '~/lib/projects/graphql/queries'
import {
  createMonthlyMeasurementMutation,
  monthlyMeasurementPreviewMutation,
  updateMonthlyMeasurementMutation,
  deleteMonthlyMeasurementMutation,
  submitMonthlyMeasurementMutation
} from '~/lib/projects/graphql/mutations'
import type {
  ApprovalFlowInstanceDetailsForMonthlyMeasurementQuery,
  ProjectMonthlyMeasurementsQuery
} from '~/lib/common/generated/gql/graphql'

type PreviewItem = {
  boqItemId: string
  boqCode: string
  boqName: string
  boqParentId: string | null
  boqDepth: number
  uom: string | null
  price: number | null
  pendingTotalQty: number
  approvedCumulativeQty: number
  measuredQtyDefault: number
  sourceAcceptanceIds: string[]
  sourceAcceptances?: {
    id: string
    acceptancePart: string
    inspectionLotNumber: string
    acceptanceContent: string
    actualFinishDate: number | null
    workVolume: number | null
    unit: string | null
  }[]
  isSummaryRow: boolean
  sortIndex: number
}

type MonthlyMeasurementNode = NonNullable<
  NonNullable<
    NonNullable<ProjectMonthlyMeasurementsQuery['project']>['monthlyMeasurements']
  >['items'][number]
>
type FlowInstanceNode = NonNullable<
  ApprovalFlowInstanceDetailsForMonthlyMeasurementQuery['approvalFlowInstance']
>
type PreviewViewTag = 'list' | 'model'
type ActiveApprovalFlow = {
  id: string
  templateId: string
  name: string
  version: number
  category: {
    id: string
    name: string
  }
  steps: Array<{
    id: string
    role: string
    approvers: string[]
    mode: 'OR' | 'AND'
  }>
}

const approveFlowMutation = gql`
  mutation ForceApproveFlow($input: ApproveApprovalFlowInput!) {
    approvalMutations {
      approve(input: $input) {
        id
        status
      }
    }
  }
`

const rejectFlowMutation = gql`
  mutation ForceRejectFlow($input: RejectApprovalFlowInput!) {
    approvalMutations {
      reject(input: $input) {
        id
        status
      }
    }
  }
`

const cancelFlowMutation = gql`
  mutation ForceCancelFlow($input: CancelApprovalFlowInput!) {
    approvalMutations {
      cancel(input: $input) {
        id
        status
      }
    }
  }
`

const reactivateFlowMutation = gql`
  mutation ReactivateFlow($input: ReactivateApprovalFlowInput!) {
    approvalMutations {
      reactivate(input: $input) {
        id
        status
        currentStep
      }
    }
  }
`

const resetFlowToUnsubmittedMutation = gql`
  mutation ResetFlowToUnsubmitted($input: ResetApprovalFlowToUnsubmittedInput!) {
    approvalMutations {
      resetToUnsubmitted(input: $input) {
        id
        status
      }
    }
  }
`

const apollo = useApolloClient().client
const { isAdmin } = useActiveUser()

const route = useRoute()
const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const pageCursors = ref<Record<number, string | null>>({ 1: null })
const currentCursor = computed(() => pageCursors.value[currentPage.value] || null)

const updateDebouncedSearch = useDebounceFn((value: string) => {
  debouncedSearchQuery.value = value.trim()
}, 300)
watch(searchQuery, (value) => updateDebouncedSearch(value), { immediate: true })

const columns = [
  { id: 'code', header: '验工编码', classes: 'col-span-2' },
  { id: 'contractCode', header: '合同编号', classes: 'col-span-1 font-mono' },
  { id: 'creator', header: '发起人', classes: 'col-span-1' },
  { id: 'roundName', header: '期数', classes: 'col-span-1' },
  { id: 'createdAt', header: '发起时间', classes: 'col-span-1 font-mono' },
  { id: 'baseDate', header: '基准时间', classes: 'col-span-1 font-mono' },
  {
    id: 'totalAmount',
    header: '验工总额(元)',
    classes: 'col-span-1.5 text-right pr-4 font-mono'
  },
  { id: 'status', header: '审核状态', classes: 'col-span-1' },
  { id: 'currentApprovers', header: '当前负责人', classes: 'col-span-1.5' },
  { id: 'actions', header: '操作', classes: 'col-span-1 text-right text-sm' }
]

const tableItems = ref<any[]>([])
const totalItems = ref(0)
const nextCursor = ref<string | null>(null)
const listLoading = ref(false)

const refetchMonthly = async () => {
  if (!projectId.value) return
  listLoading.value = true
  const apiOrigin = useApiOrigin()
  try {
    const res: any = await $fetch(
      `${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements`,
      {
        params: {
          search: debouncedSearchQuery.value || '',
          cursor: currentCursor.value || '',
          limit: pageSize.value
        }
      }
    )
    tableItems.value = res.items || []
    nextCursor.value = res.cursor || null
    totalItems.value = res.totalCount || 0
  } catch (err) {
    console.error('获取列表失败', err)
  } finally {
    listLoading.value = false
  }
}

watch(
  [projectId, debouncedSearchQuery, pageSize, currentCursor],
  () => {
    refetchMonthly()
  },
  { immediate: true }
)

watch([projectId, debouncedSearchQuery, pageSize], () => {
  currentPage.value = 1
  pageCursors.value = { 1: null }
})

const totalPages = computed(() =>
  Math.ceil(totalItems.value / Number(pageSize.value || 1))
)
const startItem = computed(() =>
  totalItems.value === 0 ? 0 : (currentPage.value - 1) * Number(pageSize.value) + 1
)
const endItem = computed(() =>
  Math.min(currentPage.value * Number(pageSize.value), totalItems.value)
)

const goPrevPage = () => {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
}

const goNextPage = () => {
  const cursor = nextCursor.value
  if (!cursor) return
  const nextPage = currentPage.value + 1
  pageCursors.value[nextPage] = cursor
  currentPage.value = nextPage
}

const { triggerNotification } = useGlobalToast()
const deleteConfirmOpen = ref(false)
const itemToDelete = ref<any>(null)

const createDialogOpen = ref(false)
const createError = ref('')
const dialogMode = ref<'create' | 'edit' | 'view'>('create')
const editingMeasurementId = ref<string | null>(null)
const excludedAcceptanceIds = ref<string[]>([])
const expandedBoqRowIds = ref<Set<string>>(new Set())
const removeDialogOpen = ref(false)
const pendingRemoveItem = ref<{ boqItemId: string; acceptanceId: string } | null>(null)
const previewLoading = ref(false)
const previewBaseDate = ref(0)
const previewItems = ref<any[]>([])
const previewViewTag = ref<PreviewViewTag>('list')
const measuredQtyByBoq = ref<Record<string, string>>({})
const remarkByBoq = ref<Record<string, string>>({})
const actionLoadingId = ref<string | null>(null)
const submitConfirmOpen = ref(false)
const submitFinalConfirmOpen = ref(false)
const submitTargetItem = ref<any>(null)
const submitRemark = ref('')
const submitFlowLoading = ref(false)
const activeSubmitFlow = ref<ActiveApprovalFlow | null>(null)
const flowDetailDrawerOpen = ref(false)
const flowDetailLoading = ref(false)
const selectedFlowInstance = ref<FlowInstanceNode | null>(null)
const flowActionComment = ref('')
const reactivateTargetStep = ref('')
const flowActionLoading = ref(false)

type AcceptanceFormLite = {
  id: string
  BIM?: Array<{
    modelId?: string | null
    bimIds?: Array<string | null> | null
    applicationIds?: string[] | null
  }> | null
}

const saveLoading = ref(false)

const createForm = ref({
  unit: '',
  code: '',
  baseDate: dayjs().format('YYYY-MM'),
  roundName: '',
  startDate: '',
  endDate: ''
})
const previewSourceAcceptanceIds = computed(() =>
  Array.from(
    new Set(
      previewItems.value
        .flatMap((item) => item.sourceAcceptanceIds || [])
        .filter((id) => !!id)
    )
  )
)
const { result: acceptanceFormsResult, loading: acceptanceFormsLoading } = useQuery(
  projectQualityAcceptanceFormsQuery,
  () => ({
    projectId: projectId.value,
    search: null,
    cursor: null,
    limit: 500
  }),
  {
    enabled: computed(
      () =>
        !!projectId.value &&
        createDialogOpen.value &&
        previewViewTag.value === 'model' &&
        previewSourceAcceptanceIds.value.length > 0
    )
  }
)

const selectedPreviewModelIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: unknown) => {
      const row = form as AcceptanceFormLite | null
      if (!row || !selectedIds.has(row.id)) return
      const BIM = row.BIM || []
      BIM.forEach((entry) => {
        if (entry.modelId) ids.add(entry.modelId)
      })
    }
  )
  return Array.from(ids)
})

const selectedPreviewBimIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: unknown) => {
      const row = form as AcceptanceFormLite | null
      if (!row || !selectedIds.has(row.id)) return
      const BIM = row.BIM || []
      BIM.forEach((entry) => {
        ;(entry.bimIds || []).forEach((id) => {
          if (typeof id === 'string' && id) ids.add(id)
        })
      })
    }
  )
  return Array.from(ids)
})

const selectedPreviewApplicationIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: unknown) => {
      const row = form as AcceptanceFormLite | null
      if (!row || !selectedIds.has(row.id)) return
      const BIM = row.BIM || []
      BIM.forEach((entry) => {
        ;(entry.applicationIds || []).forEach((id) => {
          if (typeof id === 'string' && id) ids.add(id)
        })
      })
    }
  )
  return Array.from(ids)
})

const isViewMode = computed(() => dialogMode.value === 'view')
const dialogTitle = computed(() => {
  if (dialogMode.value === 'view') return '月度验工详情'
  if (dialogMode.value === 'edit') return '编辑月度验工'
  return '新增月度验工'
})

const resetDialogState = () => {
  createError.value = ''
  editingMeasurementId.value = null
  createForm.value = {
    unit: '',
    code: '',
    baseDate: dayjs().format('YYYY-MM'),
    roundName: '',
    startDate: dayjs().subtract(1, 'month').date(19).format('YYYY-MM-DD'),
    endDate: dayjs().date(20).format('YYYY-MM-DD')
  }
}

const openCreateDialog = () => {
  dialogMode.value = 'create'
  resetDialogState()
  createDialogOpen.value = true
}

watch(
  () => createForm.value.baseDate,
  (nextBaseDate, prevBaseDate) => {
    if (!createDialogOpen.value || isViewMode.value) return
    if (nextBaseDate === prevBaseDate) return

    if (!nextBaseDate) return

    // 默认开始结束时间联动计算
    const m = dayjs(nextBaseDate, 'YYYY-MM')
    if (m.isValid()) {
      createForm.value.startDate = m.subtract(1, 'month').date(19).format('YYYY-MM-DD')
      createForm.value.endDate = m.date(20).format('YYYY-MM-DD')
    }
  }
)

const buildPreviewFromMeasurement = (item: MonthlyMeasurementNode) => {
  const rows = (item.items || [])
    .map((row) => ({
      boqItemId: row.boqItemId,
      boqCode: row.boqCode || '',
      boqName: row.boqName || '',
      boqParentId: row.boqParentId || null,
      boqDepth: row.boqDepth,
      uom: row.uom || null,
      price: row.price || null,
      pendingTotalQty: Number(row.pendingTotalQty || 0),
      approvedCumulativeQty: Number(row.approvedCumulativeQty || 0),
      measuredQtyDefault: Number(row.measuredQty || 0),
      sourceAcceptanceIds: row.sourceAcceptanceIds || [],
      sourceAcceptances: (row.sourceAcceptances || []).map((acc: any) => ({
        id: acc.id,
        acceptancePart: acc.acceptancePart || '',
        inspectionLotNumber: acc.inspectionLotNumber || '',
        acceptanceContent: acc.acceptanceContent || '',
        actualFinishDate: acc.actualFinishDate ? Number(acc.actualFinishDate) : null,
        workVolume: acc.workVolume != null ? Number(acc.workVolume) : null,
        unit: acc.unit || null
      })),
      isSummaryRow: !!row.isSummaryRow,
      sortIndex: Number(row.sortIndex || 0)
    }))
    .sort((a, b) => a.sortIndex - b.sortIndex)
  previewItems.value = rows
  previewBaseDate.value = Number(item.baseDate || 0)
  previewViewTag.value = 'list'
  measuredQtyByBoq.value = Object.fromEntries(
    rows.map((row) => [
      row.boqItemId,
      row.isSummaryRow ? '' : `${row.measuredQtyDefault}`
    ])
  )
  remarkByBoq.value = Object.fromEntries(
    rows
      .filter((row) => !row.isSummaryRow)
      .map((row) => {
        const matched = item.items?.find(
          (itemRow) => itemRow.boqItemId === row.boqItemId
        )
        return [row.boqItemId, matched?.remark || '']
      })
  )
}

const isSubmitted = (item: { approveStatus?: string | null }) => {
  if (!item.approveStatus) return false
  const status = item.approveStatus.toUpperCase()
  return status !== 'START' && status !== 'RETURNED'
}

const viewItem = (item: any) => {
  navigateTo(
    `/projects/${projectId.value}/work-valuation/monthly-measurement/${item.id}/acceptance`
  )
}

const resetSubmitState = () => {
  submitConfirmOpen.value = false
  submitFinalConfirmOpen.value = false
  submitTargetItem.value = null
  submitRemark.value = ''
  submitFlowLoading.value = false
  activeSubmitFlow.value = null
}

const loadActiveSubmitFlow = async () => {
  if (!projectId.value) return null
  const apiOrigin = useApiOrigin()
  return await $fetch<ActiveApprovalFlow>(
    `${apiOrigin}/api/projects/${projectId.value}/approval-definitions/active`,
    {
      params: {
        category: 'MONTHLY_INSPECTION'
      }
    }
  )
}

const triggerSubmitItem = async (item: any) => {
  if (isSubmitted(item)) return
  resetSubmitState()
  submitTargetItem.value = item
  submitFlowLoading.value = true
  try {
    activeSubmitFlow.value = await loadActiveSubmitFlow()
    submitConfirmOpen.value = true
  } catch (e: any) {
    triggerNotification({
      title: '操作失败',
      description:
        e.data?.error || '未找到当前已启用的月度验工审批流程，请先到审批流程设置中启用',
      type: ToastNotificationType.Danger
    })
    resetSubmitState()
  } finally {
    submitFlowLoading.value = false
  }
}

const editItem = async (item: any) => {
  if (isSubmitted(item)) return
  resetDialogState()
  dialogMode.value = 'edit'
  editingMeasurementId.value = item.id
  createForm.value = {
    unit: item.unit || '',
    code: item.code,
    baseDate: dayjs(Number(item.baseDate)).format('YYYY-MM'),
    roundName: item.roundName || '',
    startDate: item.startDate ? dayjs(Number(item.startDate)).format('YYYY-MM-DD') : '',
    endDate: item.endDate ? dayjs(Number(item.endDate)).format('YYYY-MM-DD') : ''
  }
  await nextTick()
  createDialogOpen.value = true
}

const submitDialog = async () => {
  if (!projectId.value) return
  if (!createForm.value.roundName.trim()) {
    createError.value = '期数不能为空'
    return
  }
  if (!createForm.value.baseDate) {
    createError.value = '年月不能为空'
    return
  }
  if (!createForm.value.startDate || !createForm.value.endDate) {
    createError.value = '计量时间段不能为空'
    return
  }

  createError.value = ''
  const apiOrigin = useApiOrigin()
  const baseDateTs = dayjs(createForm.value.baseDate, 'YYYY-MM')
    .endOf('month')
    .endOf('day')
    .valueOf()
  const startDateTs = dayjs(createForm.value.startDate).startOf('day').valueOf()
  const endDateTs = dayjs(createForm.value.endDate).endOf('day').valueOf()

  saveLoading.value = true
  try {
    if (dialogMode.value === 'edit' && editingMeasurementId.value) {
      await $fetch(
        `${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements/${editingMeasurementId.value}`,
        {
          method: 'PUT',
          body: {
            unit: (createForm.value.unit || '').trim(),
            baseDate: baseDateTs,
            startDate: startDateTs,
            endDate: endDateTs,
            roundName: createForm.value.roundName.trim(),
            measuredItems: [],
            excludedAcceptanceIds: []
          }
        }
      )
    } else {
      await $fetch(
        `${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements`,
        {
          method: 'POST',
          body: {
            unit: (createForm.value.unit || '').trim(),
            baseDate: baseDateTs,
            startDate: startDateTs,
            endDate: endDateTs,
            roundName: createForm.value.roundName.trim(),
            measuredItems: [],
            excludedAcceptanceIds: []
          }
        }
      )
    }
    createDialogOpen.value = false
    await refetchMonthly()
    if (currentPage.value !== 1) currentPage.value = 1
  } catch (e: any) {
    createError.value = e.data?.error || e.message || '保存失败'
  } finally {
    saveLoading.value = false
  }
}

const createDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      resetDialogState()
      createDialogOpen.value = false
    }
  },
  {
    text: dialogMode.value === 'edit' ? '保存' : '提交',
    props: {
      color: 'primary',
      loading: saveLoading.value
    },
    disabled: isViewMode.value || saveLoading.value,
    onClick: () => {
      submitDialog().catch(() => undefined)
    }
  }
])

const confirmSubmitItem = async () => {
  if (!submitTargetItem.value || !projectId.value) return
  actionLoadingId.value = submitTargetItem.value.id
  const apiOrigin = useApiOrigin()
  try {
    await $fetch(
      `${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements/${submitTargetItem.value.id}/submit`,
      {
        method: 'POST',
        body: {
          remark: submitRemark.value.trim() || '送审',
          templateId: activeSubmitFlow.value?.templateId
        }
      }
    )
    await refetchMonthly()
  } catch (e: any) {
    triggerNotification({
      title: '送审失败',
      description: e.data?.error || '送审失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    actionLoadingId.value = null
    resetSubmitState()
  }
}

const submitConfirmButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      resetSubmitState()
    }
  },
  {
    text: '下一步',
    props: {
      color: 'primary',
      loading: submitFlowLoading.value
    },
    disabled:
      !submitTargetItem.value || submitFlowLoading.value || !activeSubmitFlow.value,
    onClick: () => {
      submitConfirmOpen.value = false
      submitFinalConfirmOpen.value = true
    }
  }
])

const submitFinalConfirmButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      resetSubmitState()
    }
  },
  {
    text: '确认送审',
    props: {
      color: 'primary',
      loading: actionLoadingId.value === submitTargetItem.value?.id
    },
    disabled: !submitTargetItem.value || !activeSubmitFlow.value,
    onClick: () => {
      confirmSubmitItem().catch(() => undefined)
    }
  }
])

const openFlowDetail = async (item: MonthlyMeasurementNode) => {
  if (!item.flowInstanceId) return
  flowDetailDrawerOpen.value = true
  flowDetailLoading.value = true
  selectedFlowInstance.value = null
  try {
    const res = await apollo.query({
      query: approvalFlowInstanceDetailsForMonthlyMeasurementQuery,
      variables: {
        id: item.flowInstanceId
      },
      fetchPolicy: 'network-only'
    })
    selectedFlowInstance.value = (res.data?.approvalFlowInstance ||
      null) as FlowInstanceNode
  } finally {
    flowDetailLoading.value = false
  }
}

const closeFlowDrawer = () => {
  flowDetailDrawerOpen.value = false
  selectedFlowInstance.value = null
  flowActionComment.value = ''
  reactivateTargetStep.value = ''
}

const refreshSelectedFlowInstance = async () => {
  if (!selectedFlowInstance.value?.id) return
  flowDetailLoading.value = true
  try {
    const res = await apollo.query({
      query: approvalFlowInstanceDetailsForMonthlyMeasurementQuery,
      variables: {
        id: selectedFlowInstance.value.id
      },
      fetchPolicy: 'network-only'
    })
    selectedFlowInstance.value = (res.data?.approvalFlowInstance ||
      null) as FlowInstanceNode
  } finally {
    flowDetailLoading.value = false
  }
}

const canReactivateFlow = computed(() => {
  const status = selectedFlowInstance.value?.status
  return status === 'APPROVED' || status === 'REJECTED' || status === 'CANCELED'
})

const canForceReviewFlow = computed(
  () => selectedFlowInstance.value?.status === 'PENDING'
)

const ensureAdminComment = () => {
  const comment = flowActionComment.value.trim()
  if (!comment) {
    createError.value = '管理员操作请填写说明'
    return null
  }
  return comment
}

const forceApproveFlow = async () => {
  if (
    !selectedFlowInstance.value ||
    !canForceReviewFlow.value ||
    flowActionLoading.value
  )
    return
  const comment = ensureAdminComment()
  if (!comment) return
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: approveFlowMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          comment,
          forceByAdmin: true
        }
      }
    })
    await Promise.all([refreshSelectedFlowInstance(), refetchMonthly()])
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '强制通过失败'
  } finally {
    flowActionLoading.value = false
  }
}

const forceRejectFlow = async () => {
  if (
    !selectedFlowInstance.value ||
    !canForceReviewFlow.value ||
    flowActionLoading.value
  )
    return
  const comment = ensureAdminComment()
  if (!comment) return
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: rejectFlowMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          comment,
          forceByAdmin: true
        }
      }
    })
    await Promise.all([refreshSelectedFlowInstance(), refetchMonthly()])
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '强制驳回失败'
  } finally {
    flowActionLoading.value = false
  }
}

const forceCancelFlow = async () => {
  if (
    !selectedFlowInstance.value ||
    !canForceReviewFlow.value ||
    flowActionLoading.value
  )
    return
  const comment = ensureAdminComment()
  if (!comment) return
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: cancelFlowMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          comment,
          forceByAdmin: true
        }
      }
    })
    await Promise.all([refreshSelectedFlowInstance(), refetchMonthly()])
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '强制取消失败'
  } finally {
    flowActionLoading.value = false
  }
}

const reactivateFlow = async () => {
  if (
    !selectedFlowInstance.value ||
    !canReactivateFlow.value ||
    flowActionLoading.value
  )
    return
  const comment = ensureAdminComment()
  if (!comment) return
  const targetStep = Number(reactivateTargetStep.value || 0)
  if (!targetStep || Number.isNaN(targetStep) || targetStep < 1) {
    createError.value = '请输入有效的重开步骤'
    return
  }
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: reactivateFlowMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          targetStep,
          comment
        }
      }
    })
    await Promise.all([refreshSelectedFlowInstance(), refetchMonthly()])
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '流程激活失败'
  } finally {
    flowActionLoading.value = false
  }
}

const resetFlowToUnsubmitted = async () => {
  if (!selectedFlowInstance.value || flowActionLoading.value) return
  const comment = ensureAdminComment()
  if (!comment) return
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: resetFlowToUnsubmittedMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          comment
        }
      }
    })
    await refetchMonthly()
    closeFlowDrawer()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '重置未送审失败'
  } finally {
    flowActionLoading.value = false
  }
}

const deleteItem = (item: any) => {
  if (!projectId.value || isSubmitted(item)) return
  itemToDelete.value = item
  deleteConfirmOpen.value = true
}

const confirmDeleteItem = async () => {
  if (!projectId.value || !itemToDelete.value) return
  actionLoadingId.value = itemToDelete.value.id
  const apiOrigin = useApiOrigin()
  try {
    await $fetch(
      `${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements/${itemToDelete.value.id}`,
      {
        method: 'DELETE'
      }
    )
    triggerNotification({
      title: '删除成功',
      description: '月度验工单已成功删除。',
      type: ToastNotificationType.Success
    })
    await refetchMonthly()
  } catch (e: any) {
    triggerNotification({
      title: '删除失败',
      description: e.data?.error || e.message || '删除失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    actionLoadingId.value = null
    deleteConfirmOpen.value = false
    itemToDelete.value = null
  }
}

const getStatusText = (status: string | null | undefined) => {
  const map: Record<string, string> = {
    START: '待送审',
    PENDING: '审批中',
    IN_REVIEW: '审批中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELED: '已取消',
    RETURNED: '已退回'
  }
  return map[(status || '').toUpperCase()] || '未送审'
}

const getStatusColor = (status: string | null | undefined) => {
  const map: Record<string, string> = {
    START: 'bg-warning-lighter text-warning-darker',
    PENDING: 'bg-primary-muted text-primary',
    IN_REVIEW: 'bg-primary-muted text-primary',
    APPROVED: 'bg-success-lighter text-success-darker',
    REJECTED: 'bg-danger-lighter text-danger-darker',
    CANCELED: 'bg-highlight-3 text-foreground-2',
    RETURNED: 'bg-warning-lighter text-warning-darker'
  }
  return map[(status || '').toUpperCase()] || 'bg-foundation-3 text-foreground-2'
}

const formatFlowStatusLabel = (status?: string | null) => {
  const map: Record<string, string> = {
    PENDING: '审批中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELED: '已取消',
    CANCELLED: '已取消'
  }
  if (!status) return '-'
  return map[status] || status
}

const formatFlowStepStatusLabel = (status?: string | null) => {
  const map: Record<string, string> = {
    WAITING: '未开始',
    PENDING: '当前步骤',
    APPROVED: '已完成',
    REJECTED: '已驳回',
    CANCELED: '已取消',
    CANCELLED: '已取消'
  }
  if (!status) return '-'
  return map[status] || status
}

const formatFlowActionLabel = (action?: string | null) => {
  const map: Record<string, string> = {
    STARTED: '发起流程',
    STEP_APPROVED: '步骤通过',
    APPROVED: '流程通过',
    REJECTED: '流程驳回',
    CANCELED: '流程取消',
    REACTIVATED: '流程激活',
    RESET_TO_UNSUBMITTED: '重置未送审',
    TIMEOUT_REJECTED: '超时驳回'
  }
  if (!action) return '-'
  return map[action] || action
}

const getFlowStepCardClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'border-success bg-success/5'
  if (status === 'PENDING') return 'border-primary bg-primary/5'
  if (status === 'REJECTED' || status === 'CANCELED' || status === 'CANCELLED') {
    return 'border-danger bg-danger/5'
  }
  return 'border-outline-3 bg-foundation'
}

const getFlowStepTagClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'bg-success/10 text-success'
  if (status === 'PENDING') return 'bg-primary/10 text-primary'
  if (status === 'REJECTED' || status === 'CANCELED' || status === 'CANCELLED') {
    return 'bg-danger/10 text-danger'
  }
  return 'bg-foundation-2 text-foreground-2'
}

const getCurrentFlowStepName = (instance: FlowInstanceNode) => {
  const byStatus = instance.steps.find((step) => step.status === 'PENDING')
  if (byStatus) return byStatus.name
  const byIndex = instance.steps.find((step) => step.stepIndex === instance.currentStep)
  return byIndex?.name || '-'
}

const formatQty = (value: number) => {
  if (Number.isInteger(value)) return `${value}`
  return value.toFixed(2)
}

const formatPrice = (value: number | null, isSummaryRow: boolean) => {
  if (isSummaryRow) return '-'
  if (value === null || value === undefined) return '-'
  if (Number.isInteger(value)) return `${value}`
  return value.toFixed(2)
}

const isBoqQuantityMissing = (row: PreviewItem) =>
  !row.isSummaryRow && row.pendingTotalQty < 0

const isCumulativeExceeded = (row: PreviewItem) =>
  !row.isSummaryRow &&
  !isBoqQuantityMissing(row) &&
  row.approvedCumulativeQty > row.pendingTotalQty

const formatDate = (value: number) => {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD')
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}
</script>
