<template>
  <div
    v-if="loading"
    class="h-screen w-full flex items-center justify-center bg-foundation"
  >
    <CommonLoadingIcon class="w-8 h-8 text-primary animate-spin" />
  </div>

  <div
    v-else-if="!instance"
    class="h-screen w-full flex flex-col items-center justify-center p-4 bg-foundation"
  >
    <div
      class="max-w-md w-full border border-outline-3 rounded-xl p-6 text-center space-y-2 bg-foundation shadow-sm"
    >
      <div class="text-heading-sm font-semibold text-foreground">未找到该流程</div>
      <div class="text-body-xs text-foreground-2">
        流程可能已被删除，或你没有查看权限。流程 ID：{{ instanceId }}
      </div>
    </div>
  </div>

  <div v-else class="h-screen flex flex-col bg-foundation overflow-hidden">
    <!-- 顶部信息栏 -->
    <header class="border-b border-outline-3 bg-foundation px-4 py-3 shrink-0">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="text-heading-sm font-semibold truncate text-foreground">
            {{ instance.definition?.name || '模型审核流程' }}
          </div>
          <span
            v-if="instance.project?.name || instance.model?.name"
            class="text-body-xs text-primary font-medium truncate"
          >
            {{ instance.project?.name || '-' }} - {{ instance.model?.name || '-' }}
          </span>
          <span
            class="text-body-2xs px-2 py-0.5 rounded-full font-medium"
            :class="statusTagClass(instance.status)"
          >
            {{ formatFlowStatusLabel(instance.status) }}
          </span>
        </div>
        <div class="flex items-center gap-4 text-body-xs text-foreground-2 shrink-0">
          <span class="font-mono text-foreground-3">#{{ instance.id }}</span>
          <span v-if="instance.createdByUser?.name || instance.createdBy">
            发起人：
            <span class="text-foreground">
              {{ instance.createdByUser?.name || instance.createdBy }}
            </span>
          </span>
          <span v-if="instance.createdAt">
            发起时间：{{ formatDate(instance.createdAt) }}
          </span>
        </div>
      </div>
    </header>

    <!-- 主体左右分栏 -->
    <main class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4">
      <!-- 左侧模型预览区 -->
      <div
        class="flex-1 min-h-[420px] border border-outline-3 rounded-xl overflow-hidden relative bg-foundation"
      >
        <CommonModelPropsViewer
          v-if="instance.projectId"
          :project-id="instance.projectId"
          :model-ids="modelViewerResources"
        />
        <div
          v-else
          class="flex items-center justify-center size-full text-body-sm text-foreground-2"
        >
          缺少项目信息，无法加载模型预览
        </div>
      </div>

      <!-- 右侧审批操作与流程信息区 -->
      <div
        class="w-full lg:w-[400px] xl:w-[440px] flex flex-col gap-3 min-h-0 shrink-0"
      >
        <!-- 上部卡片：流程日志 / 流程图 -->
        <div
          class="flex-1 min-h-0 flex flex-col border border-outline-3 rounded-xl overflow-hidden bg-foundation"
        >
          <div class="p-3 border-b border-outline-3 shrink-0">
            <LazyLayoutTabsHorizontal
              :items="layoutTabs"
              :active-item="activeDetailTabItem"
              @update:active-item="onDetailTabChange"
            />
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            <div v-if="detailTab === 'logs'" class="space-y-2">
              <div
                v-if="!instance.actions.length"
                class="text-body-sm text-foreground-2 border border-outline-3 rounded-lg p-3 text-center"
              >
                暂无流程日志
              </div>
              <div
                v-for="action in instance.actions"
                :key="action.id"
                class="border border-outline-3 rounded-lg p-3 text-body-xs text-foreground-2"
              >
                {{ formatActionLabel(action.action) }} ·
                {{ action.actor?.name || action.actorId }} ·
                {{ formatDate(action.createdAt) }}
                <span v-if="action.comment && action.action !== 'APPROVED'">
                  · {{ action.comment }}
                </span>
              </div>
            </div>

            <div v-else class="space-y-3">
              <div class="flex flex-wrap gap-2 text-body-xs">
                <span class="px-2 py-1 rounded-full bg-success/10 text-success">
                  已完成
                </span>
                <span class="px-2 py-1 rounded-full bg-primary/10 text-primary">
                  当前步骤
                </span>
                <span class="px-2 py-1 rounded-full bg-foundation-2 text-foreground-2">
                  未开始
                </span>
                <span class="px-2 py-1 rounded-full bg-danger/10 text-danger">
                  已拒绝/已取消
                </span>
              </div>
              <div
                v-for="step in instance.steps"
                :key="step.id"
                class="border rounded-lg p-3"
                :class="getStepCardClass(step.status)"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="text-body-sm font-medium">
                    Step {{ step.stepIndex }} · {{ step.name }}
                  </div>
                  <span
                    class="text-body-xs px-2 py-0.5 rounded-full"
                    :class="getStepTagClass(step.status)"
                  >
                    {{ formatStepStatusLabel(step.status) }}
                  </span>
                </div>
                <div class="text-body-xs text-foreground-2 mt-1">
                  审核：{{ step.approvedByIds.length }}/{{ step.requiredApprovals }}
                </div>
                <div class="text-body-xs text-foreground-2 mt-1">
                  审核人：{{
                    step.approvers?.length
                      ? step.approvers
                          .map((e) => e?.name)
                          .filter(Boolean)
                          .join('、')
                      : step.approverIds.length
                      ? step.approverIds.join('、')
                      : '任意审批人'
                  }}
                </div>
                <div class="text-body-xs text-foreground-2 mt-1">
                  开始：{{ formatDate(step.startedAt) }} · 截止：{{
                    formatDate(step.dueAt)
                  }}
                  · 完成：{{ formatDate(step.completedAt) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 审核意见 -->
        <div v-if="isTodoUser && instance.status === 'PENDING'" class="shrink-0">
          <FormTextArea
            v-model="reviewComment"
            name="review-comment"
            label="审核意见"
            placeholder="请输入审核意见（选填）"
            :rows="3"
            bordered
          />
        </div>

        <!-- 底部操作按钮 -->
        <div class="shrink-0 flex items-center justify-end">
          <FlowOpButtons
            :instance="instance"
            :user-id="userId"
            :loading="mutating"
            @action="onAction"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { gql } from '@apollo/client/core'
import type { TypedDocumentNode } from '@apollo/client/core'
import { useQuery, useApolloClient } from '@vue/apollo-composable'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { CommonLoadingIcon, FormTextArea } from '@speckle/ui-components'
import FlowOpButtons from '~/components/flow/FlowOpButtons.vue'

type FlowAction = {
  id: string
  stepId?: string | null
  action: string
  fromStatus?: string | null
  toStatus?: string | null
  comment?: string | null
  metadata?: Record<string, unknown> | null
  actorId: string
  createdAt: string
  actor?: { id: string; name: string | null } | null
}

type FlowStep = {
  id: string
  name: string
  stepIndex: number
  status: string
  requiredApprovals: number
  approverIds: string[]
  approvers?: Array<{ id: string; name: string | null } | null>
  approvedByIds: string[]
  approvedBy?: Array<{ id: string; name: string | null } | null>
  startedAt?: string | null
  dueAt?: string | null
  completedAt?: string | null
}

type FlowInstanceDetail = {
  id: string
  projectId?: string | null
  resourceType: string
  resourceId?: string | null
  status: string
  currentStep: number
  createdBy: string
  createdAt: string
  updatedAt: string
  templateId: string
  formData?: Record<string, unknown> | null
  project?: { id: string; name: string | null } | null
  model?: { id: string; name: string | null } | null
  createdByUser?: { id: string; name: string | null } | null
  definition?: {
    id: string
    name: string
    resourceType: string
    isActive: boolean
    templateId: string
  } | null
  actions: FlowAction[]
  steps: FlowStep[]
}

type FlowDetailQueryResult = {
  approvalFlowInstance?: FlowInstanceDetail | null
}
type FlowDetailQueryVariables = { id: string }

type ReviewAction = 'approve' | 'reject' | 'cancel'
type FlowDetailTab = 'logs' | 'diagram'
type FlowDetailTabItem = { id: FlowDetailTab; title: string }

const props = defineProps<{
  instanceId: string
}>()

const flowDetailQuery = gql`
  query FlowModelApprovePage($id: ID!) {
    approvalFlowInstance(id: $id) {
      id
      projectId
      resourceType
      resourceId
      status
      currentStep
      createdBy
      createdAt
      updatedAt
      templateId
      formData
      project {
        id
        name
      }
      model {
        id
        name
      }
      createdByUser {
        id
        name
      }
      definition {
        id
        name
        resourceType
        isActive
        templateId
      }
      actions {
        id
        stepId
        action
        fromStatus
        toStatus
        comment
        metadata
        actorId
        createdAt
        actor {
          id
          name
        }
      }
      steps {
        id
        name
        stepIndex
        status
        requiredApprovals
        approverIds
        approvers {
          id
          name
        }
        approvedByIds
        approvedBy {
          id
          name
        }
        startedAt
        dueAt
        completedAt
      }
    }
  }
` as unknown as TypedDocumentNode<FlowDetailQueryResult, FlowDetailQueryVariables>

const approveMutation = gql`
  mutation FlowModelApproveAction($input: ApproveApprovalFlowInput!) {
    approvalMutations {
      approve(input: $input) {
        id
        status
      }
    }
  }
`

const rejectMutation = gql`
  mutation FlowModelRejectAction($input: RejectApprovalFlowInput!) {
    approvalMutations {
      reject(input: $input) {
        id
        status
      }
    }
  }
`

const cancelMutation = gql`
  mutation FlowModelCancelAction($input: CancelApprovalFlowInput!) {
    approvalMutations {
      cancel(input: $input) {
        id
        status
      }
    }
  }
`

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const { userId } = useActiveUser()

const mutating = ref(false)
const reviewComment = ref('')
const detailTab = ref<FlowDetailTab>('logs')

const layoutTabs = [
  { id: 'logs' as FlowDetailTab, title: '流程日志' },
  { id: 'diagram' as FlowDetailTab, title: '流程图' }
] as FlowDetailTabItem[]

const activeDetailTabItem = computed(
  () => layoutTabs.find((tab) => tab.id === detailTab.value) || layoutTabs[0]
)

const onDetailTabChange = (item: { id: string }) => {
  detailTab.value = item.id as FlowDetailTab
}

const { result, loading, refetch } = useQuery<
  FlowDetailQueryResult,
  FlowDetailQueryVariables
>(flowDetailQuery, () => ({ id: props.instanceId }), {
  enabled: computed(() => !!props.instanceId),
  fetchPolicy: 'network-only'
})

const instance = computed(() => result.value?.approvalFlowInstance || null)

const modelViewerResources = computed(() => {
  const item = instance.value
  if (!item) return []
  if (item.model?.id && item.resourceId && item.resourceId !== item.model.id) {
    return [`${item.model.id}@${item.resourceId}`]
  }
  return item.resourceId ? [item.resourceId] : []
})

const currentStep = computed(() => {
  const item = instance.value
  if (!item) return null
  return (
    item.steps.find((step) => step.status === 'PENDING') ||
    item.steps.find((step) => step.stepIndex === item.currentStep) ||
    null
  )
})

const isTodoUser = computed(() => {
  const step = currentStep.value
  const uid = userId.value || ''
  if (!step || !uid) return false
  if (!step.approverIds.length) return true
  return step.approverIds.includes(uid)
})

const notify = (title: string, description: string, type: ToastNotificationType) => {
  triggerNotification({ title, description, type })
}

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

const formatFlowStatusLabel = (status?: string | null) => {
  const map: Record<string, string> = {
    PENDING: '进行中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELED: '已取消'
  }
  if (!status) return '-'
  return map[status] || status
}

const formatStepStatusLabel = (status?: string | null) => {
  const map: Record<string, string> = {
    WAITING: '未开始',
    PENDING: '当前步骤',
    APPROVED: '已完成',
    REJECTED: '已驳回',
    CANCELED: '已取消'
  }
  if (!status) return '-'
  return map[status] || status
}

const formatActionLabel = (action?: string | null) => {
  const map: Record<string, string> = {
    STARTED: '发起流程',
    STEP_APPROVED: '通过',
    APPROVED: '流程结束',
    REJECTED: '驳回',
    RETURNED_TO_START: '退回发起人',
    RETURNED_TO_STEP: '退回指定步骤',
    CANCELED: '取消',
    TIMEOUT_REJECTED: '超时驳回',
    REACTIVATED: '重新激活',
    RESET_TO_UNSUBMITTED: '重置为未提交',
    TRANSFERRED_ASSIGNEE: '转交待办'
  }
  if (!action) return '-'
  return map[action] || action
}

const statusTagClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'bg-success/10 text-success'
  if (status === 'PENDING') return 'bg-primary/10 text-primary'
  if (status === 'REJECTED' || status === 'CANCELED') return 'bg-danger/10 text-danger'
  return 'bg-foundation-2 text-foreground-2'
}

const getStepCardClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'border-success bg-success/5'
  if (status === 'PENDING') return 'border-primary bg-primary/5'
  if (status === 'REJECTED' || status === 'CANCELED') return 'border-danger bg-danger/5'
  return 'border-outline-3 bg-foundation'
}

const getStepTagClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'bg-success/10 text-success'
  if (status === 'PENDING') return 'bg-primary/10 text-primary'
  if (status === 'REJECTED' || status === 'CANCELED') return 'bg-danger/10 text-danger'
  return 'bg-foundation-2 text-foreground-2'
}

const onAction = (payload: {
  action: ReviewAction
  operation: string
  rollbackToStep: number | null
}) => {
  void submitReviewAction(payload)
}

const submitReviewAction = async (payload: {
  action: ReviewAction
  rollbackToStep: number | null
}) => {
  if (!instance.value) return
  mutating.value = true
  try {
    const comment = reviewComment.value.trim() || null
    if (payload.action === 'approve') {
      await apollo.mutate({
        mutation: approveMutation,
        variables: { input: { instanceId: instance.value.id, comment } }
      })
      notify('操作成功', '审批已通过', ToastNotificationType.Success)
      try {
        await apollo.resetStore()
      } catch {
        // resetStore 可能因活跃订阅抛出，忽略即可
      }
    } else if (payload.action === 'reject') {
      await apollo.mutate({
        mutation: rejectMutation,
        variables: {
          input: {
            instanceId: instance.value.id,
            comment: comment || '',
            rollbackToStep: payload.rollbackToStep
          }
        }
      })
      notify('操作成功', '审批已驳回', ToastNotificationType.Success)
    } else {
      await apollo.mutate({
        mutation: cancelMutation,
        variables: { input: { instanceId: instance.value.id, comment } }
      })
      notify('操作成功', '审批已取消', ToastNotificationType.Success)
    }
    reviewComment.value = ''
    await refetch()
  } catch (e) {
    notify('操作失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
  }
}
</script>
