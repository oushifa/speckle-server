<template>
  <div class="flex flex-col h-[calc(100vh-130px)] overflow-hidden">
    <!-- 面包屑导航 Portal -->
    <Portal to="current-page">
      <div class="flex items-center space-x-1.5 text-body-sm text-foreground-2">
        <span>项目管理</span>
        <span>/</span>
        <span>验工计价</span>
        <span>/</span>
        <NuxtLink
          :to="`/projects/${projectId}/work-valuation/monthly-measurement`"
          class="hover:text-primary transition-colors"
        >
          月度验工
        </NuxtLink>
        <span>/</span>
        <span class="text-foreground truncate max-w-[200px]">{{ projectName }}</span>
      </div>
    </Portal>

    <!-- 顶部项目页眉和位置 -->
    <div class="flex items-center justify-between mt-3 flex-shrink-0">
      <div class="flex items-center space-x-3">
        <NuxtLink
          :to="`/projects/${projectId}/work-valuation/monthly-measurement`"
          class="flex items-center text-sm text-foreground-2 hover:text-primary transition-colors"
          title="返回月度验工列表"
        >
          <ArrowLeftIcon class="h-4 w-4 mr-1" />
          返回
        </NuxtLink>
        <h1 class="text-heading-lg text-foreground font-bold">{{ projectName }}</h1>
        <FormButton
          v-if="!isReadOnly && !isAdminOperationMode && item && !isSubmitted(item)"
          size="sm"
          color="outline"
          class="ml-2"
          @click="openEditDialog"
        >
          修改基本信息
        </FormButton>
        <FormButton
          v-if="isServerAdmin"
          size="sm"
          :color="isAdminOperationMode ? 'primary' : 'outline'"
          class="ml-2"
          @click="toggleAdminOperationMode"
        >
          {{ isAdminOperationMode ? '退出管理员模式' : '进入管理员模式' }}
        </FormButton>
        <FormButton
          v-if="isAdminOperationMode && item"
          size="sm"
          color="outline"
          class="ml-2 border-danger text-danger"
          :disabled="!canAdminDelete || deletingMeasurement"
          :title="adminDeleteDisabledReason || undefined"
          @click="openAdminDeleteConfirm"
        >
          管理员删除
        </FormButton>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && !item" class="p-6 text-center text-foreground-2">
      详情加载中...
    </div>

    <template v-else-if="item">
      <div
        v-if="isAdminOperationMode"
        class="mb-3 rounded-lg border border-warning bg-warning/10 px-4 py-3 text-sm text-foreground"
      >
        当前处于管理员操作模式，常规编辑和审批操作已隐藏，仅保留管理员专属动作。
      </div>
      <div class="flex-grow min-h-0 w-full relative">
        <!-- 左侧主体内容：页签与子页面视图 -->
        <div class="h-full flex flex-col overflow-hidden pr-0">
          <!-- 扁平无边框页签导航 -->
          <div
            v-if="!isEditMode"
            class="border-b border-outline-3 bg-foundation rounded-t-lg px-2 flex-shrink-0"
          >
            <nav class="flex space-x-2 -mb-px">
              <NuxtLink
                v-for="tab in tabs"
                :key="tab.id"
                :to="tab.to"
                class="px-5 py-3 text-sm font-medium border-b-2 transition-colors relative"
                :class="[
                  isTabActive(tab.id)
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-foreground-2 hover:text-foreground hover:border-outline-3'
                ]"
              >
                {{ tab.name }}
              </NuxtLink>
            </nav>
          </div>

          <!-- 子页面视图 -->
          <div
            class="flex-grow min-w-0"
            :class="isEditMode ? 'overflow-hidden flex flex-col h-full' : 'overflow-y-auto'"
          >
            <NuxtPage
              :item="item"
              :project-id="projectId"
              :flow-instance="flowInstance"
              @refetch="loadBaseMeasurement"
            />
          </div>
        </div>

        <!-- 右侧绝对定位审批面板 (Slide-over overlay) -->
        <div
          v-if="item.flowInstanceId"
          class="fixed right-0 top-12 bottom-0 z-40 flex flex-col border-l border-outline-3 bg-foundation h-[calc(100vh-48px)] overflow-hidden transition-transform duration-300 ease-in-out shadow-2xl w-[320px]"
          :class="[
            isSidebarExpanded ? 'translate-x-0' : 'translate-x-full pointer-events-none'
          ]"
        >
          <!-- 面板头部 / 折叠控制 -->
          <div
            class="p-3 border-b border-outline-3 flex items-center justify-between flex-shrink-0 bg-foundation-2 h-[48px]"
          >
            <span class="text-sm font-bold text-foreground">
              {{ isAdminOperationMode ? '管理员流程干预' : '审批流程' }}
            </span>
            <button
              class="p-1 hover:bg-highlight-1 rounded text-foreground-2 flex items-center justify-center transition-colors"
              title="收起面板"
              @click="isSidebarExpanded = false"
            >
              <ChevronRightIcon class="h-4 w-4" />
            </button>
          </div>

          <!-- 展开状态的内容 -->
          <div class="flex-grow flex flex-col min-h-0 overflow-y-auto p-4 space-y-5">
            <!-- 流程总体状态 -->
            <div
              class="flex items-center justify-between text-xs pb-3 border-b border-outline-3"
            >
              <span class="text-foreground-2">流程状态:</span>
              <CommonBadge
                :color-classes="
                  getStatusColor(flowInstance?.status || item.approveStatus)
                "
                class="text-xs font-medium"
                rounded
              >
                {{ formatFlowStatusLabel(flowInstance?.status || item.approveStatus) }}
              </CommonBadge>
            </div>

            <!-- 当前审核节点 -->
            <div
              v-if="flowInstance?.status === 'PENDING'"
              class="bg-primary-muted/20 border border-primary/20 rounded-lg p-3 text-xs space-y-1"
            >
              <div class="font-medium text-primary flex items-center gap-1.5">
                <ClockIcon class="h-4 w-4 flex-shrink-0" />
                <span>当前步骤: {{ getCurrentFlowStepName(flowInstance) }}</span>
              </div>
              <div class="text-foreground-2 pl-5">
                待办人:
                {{
                  flowInstance.steps
                    ?.find((s: any) => s.status === 'PENDING')
                    ?.approvers?.map((u: any) => u?.name)
                    .filter(Boolean)
                    .join(', ') || '所有人'
                }}
              </div>
            </div>

            <div
              v-if="isAdminOperationMode && flowInstance"
              class="bg-warning/10 border border-warning/30 rounded-lg p-3 space-y-3"
            >
              <div class="text-xs font-semibold text-foreground">管理员流程干预</div>
              <div class="text-[11px] text-foreground-2">
                所有干预动作都要求填写原因，并会记录到审批日志。
              </div>
              <div class="flex flex-wrap gap-2">
                <FormButton
                  v-if="canAdminForceOperatePending"
                  color="primary"
                  size="sm"
                  :disabled="mutating"
                  @click="openAdminFlowDialog('approve')"
                >
                  强制通过
                </FormButton>
                <FormButton
                  v-if="canAdminForceOperatePending"
                  color="outline"
                  size="sm"
                  :disabled="mutating || !previousStepOptions.length"
                  @click="openAdminFlowDialog('reject-step')"
                >
                  驳回到指定节点
                </FormButton>
                <FormButton
                  v-if="canAdminForceOperatePending"
                  color="outline"
                  size="sm"
                  :disabled="mutating"
                  @click="openAdminFlowDialog('cancel')"
                >
                  强制取消
                </FormButton>
                <FormButton
                  v-if="canAdminForceOperatePending"
                  color="outline"
                  size="sm"
                  :disabled="mutating || !projectTeamCandidates.length"
                  @click="openAdminFlowDialog('transfer')"
                >
                  转交待办
                </FormButton>
                <FormButton
                  v-if="canAdminReactivate"
                  color="outline"
                  size="sm"
                  :disabled="mutating || !reactivateStepOptions.length"
                  @click="openAdminFlowDialog('reactivate')"
                >
                  重新激活
                </FormButton>
              </div>
            </div>

            <!-- 审核意见与操作按钮区 -->
            <div
              v-if="
                !isReadOnly &&
                flowInstance?.status === 'PENDING' &&
                (isTodoUser || isCreator)
              "
              class="bg-foundation-2 border border-outline-3 rounded-lg p-3 space-y-3"
            >
              <FormTextArea
                v-model="reviewComment"
                name="review-comment"
                label="审核意见"
                placeholder="请输入您的审核意见（选填）"
                :rows="3"
                class="text-xs"
              />
              <div class="flex gap-2 justify-end">
                <template v-if="isTodoUser">
                  <FormButton
                    v-if="!isStartStep"
                    color="danger"
                    size="sm"
                    :disabled="mutating"
                    :loading="mutating"
                    @click="confirmReject"
                  >
                    驳回
                  </FormButton>
                  <FormButton
                    color="primary"
                    size="sm"
                    :disabled="mutating"
                    :loading="mutating"
                    @click="confirmApprove"
                  >
                    {{ isStartStep ? '重新送审' : '通过' }}
                  </FormButton>
                </template>
                <template v-else-if="isCreator">
                  <FormButton
                    color="outline"
                    size="sm"
                    :disabled="mutating"
                    :loading="mutating"
                    @click="confirmCancel"
                  >
                    取消流程
                  </FormButton>
                </template>
              </div>
            </div>

            <!-- 审批节点列表 (Steps Timeline) -->
            <div class="space-y-3">
              <h3 class="text-xs font-bold text-foreground flex items-center gap-1">
                <QueueListIcon class="h-4 w-4 text-foreground-2" />
                <span>审批节点列表</span>
              </h3>
              <div class="space-y-2.5">
                <div
                  v-for="step in flowInstance?.steps"
                  :key="step.id"
                  class="border rounded-lg p-3 text-xs"
                  :class="getFlowStepCardClass(step.status)"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-foreground">
                      Step {{ step.stepIndex }} · {{ step.name }}
                    </span>
                    <span
                      class="px-1.5 py-0.5 rounded-full text-[10px]"
                      :class="getFlowStepTagClass(step.status)"
                    >
                      {{ formatFlowStepStatusLabel(step.status) }}
                    </span>
                  </div>
                  <div class="text-foreground-2 mt-1.5">
                    审核进度: {{ step.approvedByIds?.length || 0 }} /
                    {{ step.requiredApprovals }}
                  </div>
                  <div v-if="step.approvers?.length" class="text-foreground-2 mt-0.5">
                    审核人:
                    {{
                      step.approvers
                        .map((u: any) => u?.name)
                        .filter(Boolean)
                        .join('、')
                    }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 审批日志 (Logs) -->
            <div class="space-y-3">
              <h3 class="text-xs font-bold text-foreground flex items-center gap-1">
                <ChatBubbleLeftEllipsisIcon class="h-4 w-4 text-foreground-2" />
                <span>审批日志</span>
              </h3>
              <div
                v-if="!flowInstance?.actions?.length"
                class="text-xs text-foreground-2 text-center py-4 border border-dashed rounded-lg border-outline-3 bg-foundation-2"
              >
                暂无审批日志
              </div>
              <div v-else class="space-y-3 pl-2 border-l border-outline-3 ml-2">
                <div
                  v-for="action in flowInstance.actions"
                  :key="action.id"
                  class="relative pl-4 text-xs space-y-0.5"
                >
                  <!-- 圆点定位 -->
                  <div
                    class="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-foundation-page bg-outline-3"
                    :class="[
                      action.action === 'APPROVED' || action.action === 'STEP_APPROVED'
                        ? 'bg-success'
                        : '',
                      action.action === 'REJECTED' ||
                      action.action === 'TIMEOUT_REJECTED'
                        ? 'bg-danger'
                        : '',
                      action.action === 'CANCELED' ? 'bg-foreground-2' : '',
                      action.action === 'TRANSFERRED_ASSIGNEE' ? 'bg-primary' : ''
                    ]"
                  />
                  <div class="font-medium text-foreground">
                    {{ formatFlowActionLabel(action.action) }}
                  </div>
                  <div class="text-[11px] text-foreground-2 flex flex-wrap gap-x-2">
                    <span>
                      处理人: {{ action.actor?.name || action.actorId || '-' }}
                    </span>
                    <span>·</span>
                    <span class="font-mono">{{ formatDate(action.createdAt) }}</span>
                  </div>
                  <div
                    v-if="action.comment"
                    class="mt-1 p-2 bg-foundation-2 border border-outline-3 rounded text-[11px] text-foreground italic break-all"
                  >
                    "{{ action.comment }}"
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 悬浮触发按钮 -->
        <button
          v-if="item.flowInstanceId && !isSidebarExpanded"
          class="fixed right-0 top-1/2 -translate-y-1/2 z-40 rounded-l-lg bg-primary hover:bg-primary-focus text-white shadow-md px-2 py-3.5 flex flex-col items-center gap-1.5 transition-all select-none cursor-pointer"
          title="展开审批面板"
          @click="isSidebarExpanded = true"
        >
          <QueueListIcon class="h-5 w-5" />
          <span
            class="text-[10px] font-bold tracking-widest"
            style="writing-mode: vertical-rl"
          >
            {{ isAdminOperationMode ? '管理员流程' : '审批流程' }}
          </span>
        </button>
      </div>

      <!-- 统一确认弹窗 -->
      <CommonConfirmDialog
        v-model:open="confirmDialogOpen"
        :title="confirmDialogTitle"
        :text="confirmDialogText"
        :confirm-text="confirmDialogConfirmText"
        :loading="mutating"
        @confirm="handleConfirm"
      />

      <CommonConfirmDialog
        v-model:open="deleteConfirmOpen"
        :title="adminDeleteConfirmTitle"
        :text="adminDeleteConfirmText"
        confirm-text="确认删除"
        :loading="deletingMeasurement"
        @confirm="executeAdminDelete"
      />

      <LayoutDialog
        v-model:open="createDialogOpen"
        max-width="xl"
        prevent-close-on-click-outside
        :buttons="createDialogButtons"
      >
        <template #header>编辑月度验工</template>
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormTextInput
              v-model="createForm.roundName"
              name="monthly-measurement-round-name"
              label="期数"
              show-label
              show-required
              placeholder="如：1"
            />
            <FormTextInput
              v-model="createForm.baseDate"
              name="monthly-measurement-base-date"
              label="年月"
              type="month"
              show-label
              show-required
            />
            <FormTextInput
              v-model="createForm.startDate"
              name="monthly-measurement-start-date"
              label="计量开始时间"
              type="date"
              show-label
              show-required
            />
            <FormTextInput
              v-model="createForm.endDate"
              name="monthly-measurement-end-date"
              label="计量结束时间"
              type="date"
              show-label
              show-required
            />
            <div class="space-y-1.5">
              <div class="text-xs font-semibold text-foreground">支付节点</div>
              <FormSelectBase
                v-model="selectedPaymentPhaseValue"
                :items="paymentPhaseOptions"
                name="monthly-measurement-payment-phase"
                label="支付节点"
                :show-label="false"
                by="id"
                class="w-full text-xs"
              >
                <template #something-selected="{ value }">
                  <span class="truncate text-foreground text-xs">{{
                    (value as any)?.label || '请选择支付节点'
                  }}</span>
                </template>
                <template #option="{ item }">
                  <span class="truncate text-xs">{{ (item as any)?.label }}</span>
                </template>
              </FormSelectBase>
            </div>
            <div class="col-span-1 md:col-span-2 space-y-1.5">
              <div class="text-xs font-semibold text-foreground">关联安全文明措施费</div>
              <FormSelectBase
                v-model="selectedMeasureValue"
                :items="selectOptions"
                name="safety-measure-select"
                label="关联安全文明措施费"
                :show-label="false"
                by="id"
                class="w-full text-xs"
              >
                <template #something-selected="{ value }">
                  <span class="truncate text-foreground text-xs">{{ (value as any)?.label || '不关联' }}</span>
                </template>
                <template #option="{ item }">
                  <span class="truncate text-xs">{{ (item as any)?.label || '不关联' }}</span>
                </template>
              </FormSelectBase>
            </div>
            <div class="col-span-1 md:col-span-2">
              <FormTextArea
                v-model="createForm.detailedDescription"
                name="monthly-measurement-detailed-description"
                label="具体业务事项"
                show-label
                show-required
                placeholder="请输入具体业务事项"
                :rows="4"
              />
            </div>
          </div>
          <div v-if="createError" class="text-body-sm text-danger mt-2">
            {{ createError }}
          </div>
        </div>
      </LayoutDialog>

      <!-- 驳回弹窗选择节点 -->
      <LayoutDialog
        v-model:open="rejectDialogOpen"
        max-width="md"
        :buttons="rejectDialogButtons"
      >
        <template #header>驳回审批</template>
        <div class="space-y-4">
          <div class="space-y-1.5">
            <label for="monthly-measurement-reject-step" class="text-xs font-semibold text-foreground">
              选择退回目标节点
            </label>
            <select
              id="monthly-measurement-reject-step"
              v-model="selectedRollbackStep"
              class="w-full text-xs bg-foundation border border-outline-3 rounded px-3 py-2 focus:outline-none focus:border-primary text-foreground"
            >
              <option
                v-for="step in rejectTargetSteps"
                :key="step.id"
                :value="step.stepIndex"
              >
                Step {{ step.stepIndex }} · {{ step.name }}
              </option>
            </select>
          </div>
          <FormTextArea
            v-model="reviewComment"
            name="reject-comment"
            label="驳回意见"
            placeholder="请输入驳回意见（必填）"
            :rows="3"
            class="text-xs"
          />
        </div>
      </LayoutDialog>

      <LayoutDialog
        v-model:open="adminFlowDialogOpen"
        max-width="md"
        :buttons="adminFlowDialogButtons"
      >
        <template #header>{{ adminFlowDialogTitle }}</template>
        <div class="space-y-4">
          <div
            v-if="
              adminFlowOperation === 'reject-step' || adminFlowOperation === 'reactivate'
            "
            class="space-y-1.5"
          >
            <label for="monthly-measurement-admin-target-step" class="text-xs font-semibold text-foreground">目标节点</label>
            <select
              id="monthly-measurement-admin-target-step"
              v-model="adminSelectedStep"
              class="w-full text-xs bg-foundation border border-outline-3 rounded px-3 py-2 focus:outline-none focus:border-primary text-foreground"
            >
              <option
                v-for="step in adminFlowOperation === 'reactivate'
                  ? reactivateStepOptions
                  : previousStepOptions"
                :key="step.id"
                :value="step.stepIndex"
              >
                Step {{ step.stepIndex }} · {{ step.name }}
              </option>
            </select>
          </div>
          <div v-if="adminFlowOperation === 'transfer'" class="space-y-1.5">
            <label for="monthly-measurement-admin-target-user" class="text-xs font-semibold text-foreground">目标处理人</label>
            <select
              id="monthly-measurement-admin-target-user"
              v-model="adminSelectedAssigneeId"
              class="w-full text-xs bg-foundation border border-outline-3 rounded px-3 py-2 focus:outline-none focus:border-primary text-foreground"
            >
              <option v-for="user in projectTeamCandidates" :key="user.id" :value="user.id">
                {{ user.name }}
              </option>
            </select>
          </div>
          <FormTextArea
            v-model="adminFlowComment"
            name="admin-flow-comment"
            label="操作原因"
            placeholder="请输入管理员干预原因（必填）"
            :rows="4"
            class="text-xs"
          />
        </div>
      </LayoutDialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import {
  ArrowLeftIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  QueueListIcon,
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline'
import { useQuery, useApolloClient } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import {
  FormButton,
  FormTextArea,
  CommonBadge,
  LayoutDialog,
  FormTextInput,
  FormSelectBase
} from '@speckle/ui-components'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { approvalFlowInstanceDetailsForMonthlyMeasurementQuery } from '~/lib/projects/graphql/queries'
import dayjs from 'dayjs'

const approveFlowMutation = gql`
  mutation FlowApprove($input: ApproveApprovalFlowInput!) {
    approvalMutations {
      approve(input: $input) {
        id
        status
      }
    }
  }
`

const rejectFlowMutation = gql`
  mutation FlowReject($input: RejectApprovalFlowInput!) {
    approvalMutations {
      reject(input: $input) {
        id
        status
      }
    }
  }
`

const cancelFlowMutation = gql`
  mutation FlowCancel($input: CancelApprovalFlowInput!) {
    approvalMutations {
      cancel(input: $input) {
        id
        status
      }
    }
  }
`

const reactivateFlowMutation = gql`
  mutation FlowReactivate($input: ReactivateApprovalFlowInput!) {
    approvalMutations {
      reactivate(input: $input) {
        id
        status
      }
    }
  }
`

const transferAssigneeMutation = gql`
  mutation FlowTransferAssignee($input: TransferApprovalFlowAssigneeInput!) {
    approvalMutations {
      transferAssignee(input: $input)
    }
  }
`

const projectTeamForAdminFlowQuery = gql`
  query ProjectTeamForAdminFlow($id: String!) {
    project(id: $id) {
      id
      team {
        role
        user {
          id
          name
        }
      }
    }
  }
`

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const measurementId = computed(() => route.params.measurementId as string)

const item = ref<any>(null)
const currentStepName = ref('')
const currentStepApprovers = ref<string[]>([])
const loading = ref(false)
const apiOrigin = useApiOrigin()

// 侧边栏折叠状态与审批流数据
const isSidebarExpanded = ref(true)
const reviewComment = ref('')
const mutating = ref(false)
const apollo = useApolloClient().client
const { userId, isAdmin: isServerAdmin } = useActiveUser()
const { triggerNotification } = useGlobalToast()

const isAdminOperationMode = computed(
  () => isServerAdmin.value && route.query.adminMode === '1'
)

const flowInstanceId = computed(() => item.value?.flowInstanceId || '')

const { result: flowResult, refetch: refetchFlow } = useQuery(
  approvalFlowInstanceDetailsForMonthlyMeasurementQuery,
  () => ({
    id: flowInstanceId.value
  }),
  {
    enabled: computed(() => !!flowInstanceId.value)
  }
)

const flowInstance = computed(() => flowResult.value?.approvalFlowInstance || null)
const { result: projectTeamResult } = useQuery(
  projectTeamForAdminFlowQuery,
  () => ({
    id: projectId.value
  })
)

// 权限校验计算属性
const isTodoUser = computed(() => {
  if (isAdminOperationMode.value) return false
  if (flowInstance.value?.status !== 'PENDING') return false
  const step = flowInstance.value?.steps?.find((s: any) => s.status === 'PENDING')
  if (!step) return false
  const uid = userId.value || ''
  if (!step.approverIds || !step.approverIds.length) return true
  return step.approverIds.includes(uid)
})

const isStartStep = computed(() => {
  if (!flowInstance.value) return false
  const step = flowInstance.value.steps?.find((s: any) => s.status === 'PENDING')
  return step ? step.stepIndex === 0 : false
})

const isCreator = computed(() => {
  if (isAdminOperationMode.value) return false
  return flowInstance.value?.createdBy === userId.value
})

type AdminFlowOperation =
  | 'approve'
  | 'reject-step'
  | 'cancel'
  | 'reactivate'
  | 'transfer'

const adminFlowDialogOpen = ref(false)
const adminFlowOperation = ref<AdminFlowOperation | null>(null)
const adminFlowComment = ref('')
const adminSelectedStep = ref<number | null>(null)
const adminSelectedAssigneeId = ref('')

const pendingStep = computed(() =>
  flowInstance.value?.steps?.find((s: any) => s.status === 'PENDING') || null
)

const previousStepOptions = computed(() => {
  const currentPendingStep = pendingStep.value
  if (!flowInstance.value?.steps || !currentPendingStep) return []
  return flowInstance.value.steps.filter((s: any) => s.stepIndex < currentPendingStep.stepIndex)
})

const reactivateStepOptions = computed(() => {
  const steps = flowInstance.value?.steps || []
  return steps.filter((s: any) => s.stepIndex === 0 || s.status === 'APPROVED')
})

const projectTeamCandidates = computed(() => {
  const team = projectTeamResult.value?.project?.team || []
  const map = new Map<string, { id: string; name: string }>()
  for (const member of team) {
    const id = member?.user?.id
    const name = member?.user?.name
    if (!id || !name) continue
    map.set(id, { id, name })
  }
  const currentApprovers = pendingStep.value?.approvers || []
  for (const user of currentApprovers) {
    const id = user?.id
    const name = user?.name
    if (!id || !name) continue
    map.set(id, { id, name })
  }
  return Array.from(map.values())
})

const canAdminForceOperatePending = computed(
  () => isAdminOperationMode.value && flowInstance.value?.status === 'PENDING'
)

const canAdminReactivate = computed(() => {
  if (!isAdminOperationMode.value || !flowInstance.value) return false
  return ['APPROVED', 'REJECTED', 'CANCELED', 'CANCELLED'].includes(flowInstance.value.status)
})

const adminFlowDialogTitle = computed(() => {
  const map: Record<AdminFlowOperation, string> = {
    approve: '管理员强制通过',
    'reject-step': '管理员驳回到指定节点',
    cancel: '管理员强制取消流程',
    reactivate: '管理员重新激活流程',
    transfer: '管理员转交待办'
  }
  return adminFlowOperation.value ? map[adminFlowOperation.value] : '管理员流程操作'
})

const adminFlowDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      adminFlowDialogOpen.value = false
    }
  },
  {
    text: '确认执行',
    props: {
      color: 'primary',
      loading: mutating.value
    },
    disabled: mutating.value,
    onClick: () => {
      executeAdminFlowOperation().catch(() => undefined)
    }
  }
])

// 统一确认弹窗状态
const confirmDialogOpen = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogText = ref('')
const confirmDialogConfirmText = ref('')
const confirmDialogAction = ref<(() => Promise<void>) | null>(null)

const triggerConfirm = (
  title: string,
  text: string,
  confirmText: string,
  action: () => Promise<void>
) => {
  confirmDialogTitle.value = title
  confirmDialogText.value = text
  confirmDialogConfirmText.value = confirmText
  confirmDialogAction.value = action
  confirmDialogOpen.value = true
}

const handleConfirm = async () => {
  confirmDialogOpen.value = false
  if (confirmDialogAction.value) {
    await confirmDialogAction.value()
  }
}

// 审批操作执行方法
const executeApprove = async () => {
  if (!flowInstance.value) return
  
  // 校验逻辑：根据当前节点，判断意见字段是否必填
  const pendingStep = flowInstance.value.steps?.find((s: any) => s.status === 'PENDING')
  const stepName = pendingStep ? (pendingStep.name || '').trim() : ''
  const isHeadquartersApprovalStep = [
    '现场指挥',
    '现场指挥部审核人',
    '现场指挥部',
    '指挥部'
  ].includes(stepName)
  
  mutating.value = true
  try {
    // 获取最新的验收和支付申请详情数据
    const [acceptanceData, paymentRequestData] = await Promise.all([
      $fetch<any>(
        `${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements/${measurementId.value}/acceptance`
      ).catch(() => null),
      $fetch<any>(
        `${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements/${measurementId.value}/payment-requests`
      ).catch(() => null)
    ])

    if (stepName === '开始' || stepName === '施工单位') {
      if (!paymentRequestData?.reqContractorOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '支付申请理由陈述在开始节点为必填，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.contractorPayAmt || Number(paymentRequestData.contractorPayAmt) <= 0) {
        triggerNotification({
          title: '校验失败',
          description: '本次申请支付金额在开始节点为必填且必须大于0，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
    } else if (stepName === '施工监理总监') {
      if (!acceptanceData?.supervisionOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '施工监理意见在施工监理总监节点为必填，请先填写并保存月度验工中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.reqSupervisionOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '施工监理意见在施工监理总监节点为必填，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.supervisionPayAmt || Number(paymentRequestData.supervisionPayAmt) <= 0) {
        triggerNotification({
          title: '校验失败',
          description: '本次申请支付金额在施工监理总监节点为必填且必须大于0，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
    } else if (isHeadquartersApprovalStep) {
      if (!acceptanceData?.headquartersOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '现场指挥部意见在现场指挥节点为必填，请先填写并保存月度验工中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.reqHeadquartersOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '现场指挥部意见在现场指挥节点为必填，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.headquartersPayAmt || Number(paymentRequestData.headquartersPayAmt) <= 0) {
        triggerNotification({
          title: '校验失败',
          description: '本次申请支付金额在现场指挥节点为必填且必须大于0，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
    } else if (stepName === '投资监理总监') {
      if (!acceptanceData?.investmentOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '投资监理意见在投资监理总监节点为必填，请先填写并保存月度验工中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.reqInvestmentOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '投资监理意见在投资监理总监节点为必填，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.investmentPayAmt || Number(paymentRequestData.investmentPayAmt) <= 0) {
        triggerNotification({
          title: '校验失败',
          description: '本次申请支付金额在投资监理总监节点为必填且必须大于0，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
    } else if (stepName === '合约管理部负责人') {
      if (!acceptanceData?.ownerOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '合约部管理意见在合约管理部负责人节点为必填，请先填写并保存月度验工中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.reqContractOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '合约管理部意见在合约管理部负责人节点为必填，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.contractPayAmt || Number(paymentRequestData.contractPayAmt) <= 0) {
        triggerNotification({
          title: '校验失败',
          description: '本次申请支付金额在合约管理部负责人节点为必填且必须大于0，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
    } else if (stepName === '分管领导') {
      if (!paymentRequestData?.reqLeaderOpinion?.trim()) {
        triggerNotification({
          title: '校验失败',
          description: '分管领导意见在分管领导节点为必填，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
      if (!paymentRequestData?.leaderPayAmt || Number(paymentRequestData.leaderPayAmt) <= 0) {
        triggerNotification({
          title: '校验失败',
          description: '本次申请支付金额在分管领导节点为必填且必须大于0，请先填写并保存工程费用支付申请单中的该项！',
          type: ToastNotificationType.Danger
        })
        mutating.value = false
        return
      }
    }
  } catch (err) {
    console.error('获取意见详情数据校验失败', err)
  }

  // 校验通过，开始执行突变
  try {
    await apollo.mutate({
      mutation: approveFlowMutation,
      variables: {
        input: {
          instanceId: flowInstance.value.id,
          comment: reviewComment.value.trim() || null
        }
      }
    })
    reviewComment.value = ''
    triggerNotification({
      title: '审批通过成功',
      description: '已成功通过当前审批步骤。',
      type: ToastNotificationType.Success
    })
    await loadBaseMeasurement()
    await refetchFlow()
  } catch (err: any) {
    triggerNotification({
      title: '操作失败',
      description: err.message || err || '未知错误',
      type: ToastNotificationType.Danger
    })
  } finally {
    mutating.value = false
  }
}

const executeReject = async () => {
  if (!flowInstance.value) return
  if (!reviewComment.value.trim()) {
    triggerNotification({
      title: '操作失败',
      description: '驳回意见不能为空',
      type: ToastNotificationType.Danger
    })
    return
  }
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: rejectFlowMutation,
      variables: {
        input: {
          instanceId: flowInstance.value.id,
          comment: reviewComment.value.trim(),
          // 若未指定退回步骤，默认传 0 退回到起点（发起人）
          rollbackToStep:
            selectedRollbackStep.value !== null ? Number(selectedRollbackStep.value) : 0
        }
      }
    })
    reviewComment.value = ''
    selectedRollbackStep.value = null
    rejectDialogOpen.value = false
    triggerNotification({
      title: '审批驳回成功',
      description: '已成功驳回当前审批步骤。',
      type: ToastNotificationType.Success
    })
    await loadBaseMeasurement()
    await refetchFlow()
  } catch (err: any) {
    triggerNotification({
      title: '操作失败',
      description: err.message || err || '未知错误',
      type: ToastNotificationType.Danger
    })
  } finally {
    mutating.value = false
  }
}

const executeCancel = async () => {
  if (!flowInstance.value) return
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: cancelFlowMutation,
      variables: {
        input: {
          instanceId: flowInstance.value.id,
          comment: reviewComment.value.trim() || null
        }
      }
    })
    reviewComment.value = ''
    triggerNotification({
      title: '流程取消成功',
      description: '已成功取消当前审批流程。',
      type: ToastNotificationType.Success
    })
    await loadBaseMeasurement()
    await refetchFlow()
  } catch (err: any) {
    triggerNotification({
      title: '操作失败',
      description: err.message || err || '未知错误',
      type: ToastNotificationType.Danger
    })
  } finally {
    mutating.value = false
  }
}

const confirmApprove = () => {
  const title = isStartStep.value ? '确认重新送审' : '确认通过审批'
  const text = isStartStep.value
    ? '您确定要重新送审当前月度验工单吗？'
    : '您确定要通过当前的审批步骤吗？'
  const confirmText = isStartStep.value ? '确认送审' : '确认通过'
  triggerConfirm(title, text, confirmText, executeApprove)
}

const confirmReject = () => {
  const pendingStep = flowInstance.value?.steps?.find(
    (s: any) => s.status === 'PENDING'
  )
  selectedRollbackStep.value = pendingStep ? Math.max(0, pendingStep.stepIndex - 1) : 0
  rejectDialogOpen.value = true
}

const confirmCancel = () => {
  triggerConfirm(
    '确认取消审批',
    '您确定要取消当前的审批流程吗？',
    '确认取消',
    executeCancel
  )
}

// 格式化与样式辅助函数
const getStatusColor = (status: string | null | undefined) => {
  const map: Record<string, string> = {
    START: 'bg-warning-lighter text-warning-darker',
    PENDING: 'bg-primary-muted text-primary',
    APPROVED: 'bg-success-lighter text-success-darker',
    REJECTED: 'bg-danger-lighter text-danger-darker',
    RETURNED: 'bg-warning-lighter text-warning-darker',
    CANCELED: 'bg-highlight-3 text-foreground-2'
  }
  return map[(status || '').toUpperCase()] || 'bg-foundation-3 text-foreground-2'
}

const formatFlowStatusLabel = (status?: string | null) => {
  const map: Record<string, string> = {
    PENDING: '审批中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    RETURNED: '已退回',
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
    TIMEOUT_REJECTED: '超时驳回',
    TRANSFERRED_ASSIGNEE: '转交待办'
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

const getCurrentFlowStepName = (instance: any) => {
  if (!instance?.steps) return '-'
  const byStatus = instance.steps.find((step: any) => step.status === 'PENDING')
  if (byStatus) return byStatus.name
  const byIndex = instance.steps.find(
    (step: any) => step.stepIndex === instance.currentStep
  )
  return byIndex?.name || '-'
}

const formatDate = (date?: string | number | null) => {
  if (!date) return '-'
  const num = Number(date)
  const parsed = Number.isNaN(num) ? date : num
  return dayjs(parsed).isValid()
    ? dayjs(parsed).format('YYYY-MM-DD HH:mm:ss')
    : '-'
}

// 查询项目名字以实现面包屑动态渲染
const { result: projectResult } = useQuery(
  gql`
    query ProjectNameForMonthlyMeasurement($id: String!) {
      project(id: $id) {
        id
        name
      }
    }
  `,
  () => ({
    id: projectId.value
  })
)
const projectName = computed(
  () => projectResult.value?.project?.name || '南北高速公路工程'
)

const loadBaseMeasurement = async () => {
  if (!projectId.value || !measurementId.value) return
  loading.value = true
  try {
    const data = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements/${measurementId.value}`
    )
    item.value = data
    currentStepName.value = data.currentStepName || ''
    currentStepApprovers.value = data.currentStepApprovers || []
  } catch (err) {
    console.error('获取主表数据失败', err)
  } finally {
    loading.value = false
  }
}

watch(
  [projectId, measurementId],
  () => {
    loadBaseMeasurement()
  },
  { immediate: true }
)

const tabs = computed(() => [
  {
    id: 'acceptance',
    name: '月度验工',
    to: {
      path: `/projects/${projectId.value}/work-valuation/monthly-measurement/${measurementId.value}/acceptance`,
      query: route.query
    }
  },
  {
    id: 'payment-details',
    name: '中间支付单',
    to: {
      path: `/projects/${projectId.value}/work-valuation/monthly-measurement/${measurementId.value}/payment-details`,
      query: route.query
    }
  },
  {
    id: 'payment-requests',
    name: '工程费用支付申请单',
    to: {
      path: `/projects/${projectId.value}/work-valuation/monthly-measurement/${measurementId.value}/payment-requests`,
      query: route.query
    }
  }
])

const isTabActive = (tabId: string) => {
  const path = route.path
  if (tabId === 'acceptance' && path.endsWith('/acceptance')) return true
  if (tabId === 'payment-details' && path.endsWith('/payment-details')) return true
  if (tabId === 'payment-requests' && path.endsWith('/payment-requests')) return true
  return false
}

const isEditMode = computed(() => route.path.includes('/acceptance-edit'))

const isReadOnly = computed(() => route.query.mode !== 'edit' || isAdminOperationMode.value)

const normalizeApprovalStatus = (status?: string | null) => {
  return String(status || 'START').trim().toUpperCase()
}

const currentDeleteStatus = computed(() =>
  normalizeApprovalStatus(flowInstance.value?.status || item.value?.approveStatus)
)

const canAdminDelete = computed(() => {
  if (!isServerAdmin.value || !item.value) return false
  return [
    'START',
    'RETURNED',
    'REJECTED',
    'CANCELED',
    'CANCELLED',
    'PENDING',
    'IN_REVIEW'
  ].includes(currentDeleteStatus.value)
})

const adminDeleteDisabledReason = computed(() => {
  if (!isServerAdmin.value || !item.value || canAdminDelete.value) return ''
  return '已审核通过单据暂不支持管理员删除'
})

const adminDeleteConfirmTitle = computed(() => {
  if (['PENDING', 'IN_REVIEW'].includes(currentDeleteStatus.value)) {
    return '确认强制取消流程并删除'
  }
  return '确认删除月度验工'
})

const adminDeleteConfirmText = computed(() => {
  if (['PENDING', 'IN_REVIEW'].includes(currentDeleteStatus.value)) {
    return '当前单据处于审批流程中，删除时会一并清理审批绑定和占用关系，且操作不可撤销，是否继续？'
  }
  return '确认删除该月度验工单据吗？此操作不可撤销。'
})

const deleteConfirmOpen = ref(false)
const deletingMeasurement = ref(false)

const buildQueryWithAdminMode = (enabled: boolean) => {
  const query = { ...route.query } as Record<string, string>
  if (enabled) query.adminMode = '1'
  else delete query.adminMode
  return query
}

const toggleAdminOperationMode = async () => {
  await navigateTo({
    path: route.path,
    query: buildQueryWithAdminMode(!isAdminOperationMode.value)
  })
}

// 基础信息编辑相关变量
const createDialogOpen = ref(false)
const createError = ref('')
const saveLoading = ref(false)

const createForm = ref({
  unit: '',
  code: '',
  baseDate: '',
  roundName: '',
  startDate: '',
  endDate: '',
  paymentPhase: '进度款',
  detailedDescription: '',
  safetyMeasureId: null as string | null
})

const paymentPhaseOptions = [
  { id: '预付款', label: '预付款' },
  { id: '进度款', label: '进度款' },
  { id: '尾款', label: '尾款' },
  { id: '验收款', label: '验收款' },
  { id: '审价款', label: '审价款' },
  { id: '退回质保金', label: '退回质保金' }
]

const isSubmitted = (item: { approveStatus?: string | null }) => {
  if (!item.approveStatus) return false
  const status = item.approveStatus.toUpperCase()
  return status !== 'START' && status !== 'RETURNED'
}

const openAdminDeleteConfirm = () => {
  if (!canAdminDelete.value || deletingMeasurement.value) return
  deleteConfirmOpen.value = true
}

const openAdminFlowDialog = (operation: AdminFlowOperation) => {
  adminFlowOperation.value = operation
  adminFlowComment.value = ''
  adminSelectedAssigneeId.value = ''
  if (operation === 'reject-step') {
    adminSelectedStep.value =
      previousStepOptions.value.length > 0 ? previousStepOptions.value[0].stepIndex : 0
  } else if (operation === 'reactivate') {
    adminSelectedStep.value =
      reactivateStepOptions.value.length > 0 ? reactivateStepOptions.value[0].stepIndex : 0
  } else {
    adminSelectedStep.value = null
  }
  if (operation === 'transfer') {
    adminSelectedAssigneeId.value = projectTeamCandidates.value[0]?.id || ''
  }
  adminFlowDialogOpen.value = true
}

const resetAdminFlowDialog = () => {
  adminFlowDialogOpen.value = false
  adminFlowOperation.value = null
  adminFlowComment.value = ''
  adminSelectedStep.value = null
  adminSelectedAssigneeId.value = ''
}

const executeAdminFlowOperation = async () => {
  if (!flowInstance.value || !adminFlowOperation.value) return
  const comment = adminFlowComment.value.trim()
  if (!comment) {
    triggerNotification({
      title: '操作失败',
      description: '管理员流程操作原因不能为空',
      type: ToastNotificationType.Danger
    })
    return
  }

  if (
    (adminFlowOperation.value === 'reject-step' || adminFlowOperation.value === 'reactivate') &&
    adminSelectedStep.value === null
  ) {
    triggerNotification({
      title: '操作失败',
      description: '请选择目标节点',
      type: ToastNotificationType.Danger
    })
    return
  }

  if (adminFlowOperation.value === 'transfer' && !adminSelectedAssigneeId.value) {
    triggerNotification({
      title: '操作失败',
      description: '请选择目标处理人',
      type: ToastNotificationType.Danger
    })
    return
  }

  mutating.value = true
  try {
    if (adminFlowOperation.value === 'approve') {
      await apollo.mutate({
        mutation: approveFlowMutation,
        variables: {
          input: {
            instanceId: flowInstance.value.id,
            comment,
            forceByAdmin: true
          }
        }
      })
    } else if (adminFlowOperation.value === 'reject-step') {
      await apollo.mutate({
        mutation: rejectFlowMutation,
        variables: {
          input: {
            instanceId: flowInstance.value.id,
            comment,
            rollbackToStep: Number(adminSelectedStep.value ?? 0),
            forceByAdmin: true
          }
        }
      })
    } else if (adminFlowOperation.value === 'cancel') {
      await apollo.mutate({
        mutation: cancelFlowMutation,
        variables: {
          input: {
            instanceId: flowInstance.value.id,
            comment,
            forceByAdmin: true
          }
        }
      })
    } else if (adminFlowOperation.value === 'reactivate') {
      await apollo.mutate({
        mutation: reactivateFlowMutation,
        variables: {
          input: {
            instanceId: flowInstance.value.id,
            targetStep: Number(adminSelectedStep.value ?? 0),
            comment
          }
        }
      })
    } else if (adminFlowOperation.value === 'transfer') {
      await apollo.mutate({
        mutation: transferAssigneeMutation,
        variables: {
          input: {
            instanceIds: [flowInstance.value.id],
            assigneeId: adminSelectedAssigneeId.value,
            comment
          }
        }
      })
    }

    const successMap: Record<AdminFlowOperation, string> = {
      approve: '已完成管理员强制通过。',
      'reject-step': '已驳回到指定节点。',
      cancel: '已完成管理员强制取消。',
      reactivate: '已重新激活流程。',
      transfer: '已完成待办转交。'
    }
    triggerNotification({
      title: '操作成功',
      description: successMap[adminFlowOperation.value],
      type: ToastNotificationType.Success
    })
    resetAdminFlowDialog()
    await loadBaseMeasurement()
    await refetchFlow()
  } catch (err: any) {
    triggerNotification({
      title: '操作失败',
      description: err.message || err || '未知错误',
      type: ToastNotificationType.Danger
    })
  } finally {
    mutating.value = false
  }
}

const executeAdminDelete = async () => {
  if (!item.value || !canAdminDelete.value) return
  deletingMeasurement.value = true
  try {
    await $fetch(`${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements/${measurementId.value}`, {
      method: 'DELETE'
    })
    deleteConfirmOpen.value = false
    triggerNotification({
      title: '删除成功',
      description: '月度验工单据已成功删除。',
      type: ToastNotificationType.Success
    })
    await navigateTo(`/projects/${projectId.value}/work-valuation/monthly-measurement`)
  } catch (err: any) {
    triggerNotification({
      title: '删除失败',
      description: err.data?.error || err.message || '删除失败，请重试。',
      type: ToastNotificationType.Danger
    })
  } finally {
    deletingMeasurement.value = false
  }
}

const availableSafetyMeasures = ref<any[]>([])
const fetchSafetyMeasures = async () => {
  if (!projectId.value) return
  const apiOrigin = useApiOrigin()
  try {
    const res = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/safety-measures`,
      {
        params: {
          unoccupied: 'true',
          excludeMeasurementId: measurementId.value
        }
      }
    )
    availableSafetyMeasures.value = res.items || []
  } catch (err) {
    console.error('拉取安全文明措施费失败', err)
  }
}

const formatMeasureLabel = (measure: any) => {
  if (!measure?.baseDate) return ''
  const dateStr = dayjs(Number(measure.baseDate)).format('YYYY-MM')
  const round = measure.roundName || '1'
  return `${dateStr} 第${round}期`
}

const selectOptions = computed(() => {
  const list = availableSafetyMeasures.value.map((m) => ({
    id: m.id,
    label: formatMeasureLabel(m)
  }))
  return [{ id: 'none', label: '不关联' }, ...list]
})

const selectedMeasureValue = computed({
  get: () => {
    const id = createForm.value.safetyMeasureId
    if (!id) return { id: 'none', label: '不关联' }
    const found = availableSafetyMeasures.value.find((m) => m.id === id)
    return found ? { id: found.id, label: formatMeasureLabel(found) } : { id: 'none', label: '不关联' }
  },
  set: (val: any) => {
    createForm.value.safetyMeasureId = val?.id === 'none' ? null : val?.id
  }
})

const selectedPaymentPhaseValue = computed({
  get: () => {
    const found = paymentPhaseOptions.find(
      (option) => option.id === createForm.value.paymentPhase
    )
    return found || paymentPhaseOptions[1]
  },
  set: (val: { id?: string } | null) => {
    createForm.value.paymentPhase = val?.id || ''
  }
})

const openEditDialog = () => {
  if (!item.value) return
  createError.value = ''
  createForm.value = {
    unit: item.value.unit || '',
    code: item.value.code || '',
    baseDate: dayjs(Number(item.value.baseDate)).format('YYYY-MM'),
    roundName: item.value.roundName || '',
    startDate: item.value.startDate
      ? dayjs(Number(item.value.startDate)).format('YYYY-MM-DD')
      : '',
    endDate: item.value.endDate
      ? dayjs(Number(item.value.endDate)).format('YYYY-MM-DD')
      : '',
    paymentPhase: item.value.paymentPhase || '进度款',
    detailedDescription: item.value.detailedDescription || '',
    safetyMeasureId: item.value.safetyMeasureId || null
  }
  void fetchSafetyMeasures()
  createDialogOpen.value = true
}

// 联动计算：年月改变自动算开始和结束时间
watch(
  () => createForm.value.baseDate,
  (nextBaseDate, prevBaseDate) => {
    if (!createDialogOpen.value) return
    if (nextBaseDate === prevBaseDate) return
    if (!nextBaseDate) return

    const m = dayjs(nextBaseDate, 'YYYY-MM')
    if (m.isValid()) {
      createForm.value.startDate = m.subtract(1, 'month').date(19).format('YYYY-MM-DD')
      createForm.value.endDate = m.date(20).format('YYYY-MM-DD')
    }
  }
)

watch(
  () => createForm.value.roundName,
  (newVal) => {
    if (newVal) {
      createForm.value.roundName = String(newVal).replace(/\D/g, '')
    }
  }
)

const submitDialog = async () => {
  if (!projectId.value || !measurementId.value) return
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
  if (!createForm.value.paymentPhase.trim()) {
    createError.value = '支付节点不能为空'
    return
  }
  if (!createForm.value.detailedDescription.trim()) {
    createError.value = '具体业务事项不能为空'
    return
  }

  createError.value = ''
  const baseDateTs = dayjs(createForm.value.baseDate, 'YYYY-MM')
    .endOf('month')
    .endOf('day')
    .valueOf()
  const startDateTs = dayjs(createForm.value.startDate).startOf('day').valueOf()
  const endDateTs = dayjs(createForm.value.endDate).endOf('day').valueOf()

  saveLoading.value = true
  try {
    await $fetch(
      `${apiOrigin}/api/v1/projects/${projectId.value}/monthly-measurements/${measurementId.value}`,
      {
        method: 'PUT',
        body: {
          unit: (createForm.value.unit || '').trim(),
          baseDate: baseDateTs,
          startDate: startDateTs,
          endDate: endDateTs,
          roundName: createForm.value.roundName.trim(),
          paymentPhase: createForm.value.paymentPhase.trim(),
          detailedDescription: createForm.value.detailedDescription.trim(),
          measuredItems: [],
          excludedAcceptanceIds: [],
          safetyMeasureId: createForm.value.safetyMeasureId
        }
      }
    )
    createDialogOpen.value = false
    await loadBaseMeasurement()
    triggerNotification({
      title: '修改成功',
      description: '月度验工基本信息已成功更新',
      type: ToastNotificationType.Success
    })
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
      createDialogOpen.value = false
    }
  },
  {
    text: '保存',
    props: {
      color: 'primary',
      loading: saveLoading.value
    },
    disabled: saveLoading.value,
    onClick: () => {
      submitDialog().catch(() => undefined)
    }
  }
])

// 驳回弹窗选择节点相关状态
const rejectDialogOpen = ref(false)
const selectedRollbackStep = ref<number | null>(null)

const rejectTargetSteps = computed(() => {
  if (!flowInstance.value?.steps) return []
  const pendingStep = flowInstance.value.steps.find((s: any) => s.status === 'PENDING')
  const currentIdx = pendingStep ? pendingStep.stepIndex : 999
  return flowInstance.value.steps.filter((s: any) => s.stepIndex < currentIdx)
})

const rejectDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      rejectDialogOpen.value = false
    }
  },
  {
    text: '确定驳回',
    props: {
      color: 'danger',
      loading: mutating.value
    },
    disabled: mutating.value,
    onClick: () => {
      executeReject().catch(() => undefined)
    }
  }
])
</script>
