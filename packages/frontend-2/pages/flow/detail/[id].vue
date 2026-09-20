<template>
  <div class="min-h-screen w-full bg-foundation p-4 md:p-8">
    <div v-if="loading" class="text-body-sm text-foreground-2">加载中...</div>

    <div
      v-else-if="!instance"
      class="max-w-3xl mx-auto border border-outline-3 rounded-xl p-6 space-y-2"
    >
      <div class="text-heading-sm">未找到该流程</div>
      <div class="text-body-xs text-foreground-2">
        流程可能已被删除，或你没有查看权限。流程 ID：{{ instanceId }}
      </div>
    </div>

    <div v-else class="max-w-5xl mx-auto space-y-4 pb-8">
      <!-- 流程头 -->
      <div class="border border-outline-3 rounded-xl p-5 bg-foundation">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-heading-sm truncate">{{ flowTitle }}</div>
            <div class="mt-1 text-body-xs text-foreground-2">
              <span class="font-mono">#{{ instance.id }}</span>
              <span v-if="instance.project?.name">· {{ instance.project.name }}</span>
            </div>
          </div>
          <span
            class="px-2.5 py-1 rounded-full text-body-xs font-medium whitespace-nowrap"
            :class="statusTagClass(instance.status)"
          >
            {{ formatFlowStatusLabel(instance.status) }}
          </span>
        </div>

        <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
          <div>
            <div class="text-body-xs text-foreground-2">发起人</div>
            <div class="text-body-sm truncate">
              {{ instance.createdByUser?.name || instance.createdBy }}
            </div>
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">发起时间</div>
            <div class="text-body-sm">{{ formatDate(instance.createdAt) }}</div>
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">当前步骤</div>
            <div class="text-body-sm truncate">
              {{ currentStep ? currentStep.name : '-' }}
            </div>
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">截止时间</div>
            <div class="text-body-sm">{{ formatDate(currentStep?.dueAt) }}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 lg:gap-5 gap-4">
        <!-- 左：流程信息 -->
        <div class="lg:col-span-2 space-y-4">
          <!-- 步骤 -->
          <div class="border border-outline-3 rounded-xl p-5 bg-foundation">
            <div class="flex items-center justify-between">
              <div class="text-heading-sm">审批步骤</div>
              <div class="text-body-xs text-foreground-2">
                {{ approvedStepCount }}/{{ instance.steps.length }} 已完成
              </div>
            </div>

            <ol class="mt-5">
              <li
                v-for="(step, index) in instance.steps"
                :key="step.id"
                class="relative pl-8"
                :class="index === instance.steps.length - 1 ? '' : 'pb-5'"
              >
                <span
                  v-if="index !== instance.steps.length - 1"
                  class="absolute left-[5px] top-4 bottom-0 w-px"
                  :class="stepLineClass(step.status)"
                ></span>
                <span
                  class="absolute left-0 top-1 h-3 w-3 rounded-full ring-4"
                  :class="stepDotClass(step.status)"
                ></span>

                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="text-body-sm font-medium">
                    {{ step.name }}
                    <span class="text-body-xs text-foreground-2 font-normal">
                      · 第 {{ step.stepIndex + 1 }} 步
                    </span>
                  </div>
                  <span
                    class="text-body-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                    :class="statusTagClass(stepStatusToFlowStatus(step.status))"
                  >
                    {{ formatStepStatusLabel(step.status) }}
                  </span>
                </div>

                <div class="mt-1 text-body-xs text-foreground-2">
                  审核人：{{ stepApprovers(step) }}
                </div>
                <div class="mt-0.5 text-body-xs text-foreground-2">
                  进度：{{ step.approvedByIds.length }}/{{ step.requiredApprovals }}
                  <template v-if="step.startedAt">
                    · 开始 {{ formatDate(step.startedAt) }}
                  </template>
                  <template v-if="step.completedAt">
                    · 完成 {{ formatDate(step.completedAt) }}
                  </template>
                </div>
              </li>
            </ol>
          </div>

          <!-- 日志 -->
          <div class="border border-outline-3 rounded-xl p-5 bg-foundation">
            <div class="text-heading-sm">流程日志</div>
            <div
              v-if="!instance.actions.length"
              class="mt-3 text-body-xs text-foreground-2"
            >
              暂无流程日志
            </div>
            <ul v-else class="mt-4 space-y-3">
              <li
                v-for="action in instance.actions"
                :key="action.id"
                class="flex gap-3 text-body-xs"
              >
                <span
                  class="mt-1.5 h-1.5 w-1.5 rounded-full bg-outline-5 shrink-0"
                ></span>
                <div class="min-w-0">
                  <div class="text-foreground">
                    {{ formatActionLabel(action.action) }}
                    <span class="text-foreground-2">
                      · {{ action.actor?.name || action.actorId }}
                    </span>
                  </div>
                  <div
                    v-if="action.comment && action.action !== 'APPROVED'"
                    class="mt-0.5 text-foreground-2 break-words"
                  >
                    {{ action.comment }}
                  </div>
                  <div class="mt-0.5 text-foreground-2/70">
                    {{ formatDate(action.createdAt) }}
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- 右：处理卡片 -->
        <div class="lg:col-span-1">
          <div class="lg:sticky lg:top-4 space-y-4">
            <div
              class="border rounded-xl p-5 bg-foundation"
              :class="actionCardBorderClass"
            >
              <div class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full" :class="actionDotClass"></span>
                <div class="text-heading-sm">{{ actionTitle }}</div>
              </div>
              <div class="mt-2 text-body-xs text-foreground-2">
                {{ actionHint }}
              </div>

              <div v-if="canComment" class="mt-4">
                <FormTextArea
                  v-model="reviewComment"
                  name="flow-detail-review-comment"
                  label="审批意见"
                  placeholder="请输入审批意见（选填）"
                  :rows="3"
                  bordered
                />
              </div>

              <div class="mt-4">
                <FlowOpButtons
                  :instance="instance"
                  :user-id="userId"
                  :loading="mutating"
                  @action="onAction"
                />
              </div>
            </div>

            <div
              v-if="resourceRoute"
              class="border border-outline-3 rounded-xl p-5 bg-foundation"
            >
              <div class="text-heading-sm">业务单据</div>
              <div class="mt-2 text-body-xs text-foreground-2">
                在新窗口打开对应单据查看明细，本页只处理流程。
              </div>
              <FormButton
                class="mt-4"
                color="outline"
                size="sm"
                @click="openResourceInNewWindow"
              >
                <span class="inline-flex items-center gap-1">
                  新窗口打开
                  <svg
                    class="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                  >
                    <path
                      d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16h8a1.5 1.5 0 0 0 1.5-1.5V12"
                    />
                    <path d="M11 4h5v5" />
                    <path d="M16 4l-6 6" />
                  </svg>
                </span>
              </FormButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { gql } from '@apollo/client/core'
import type { TypedDocumentNode } from '@apollo/client/core'
import { useQuery, useApolloClient } from '@vue/apollo-composable'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import FlowOpButtons from '~/components/flow/FlowOpButtons.vue'

useHead({ title: '处理流程' })

definePageMeta({
  // 独立页面：不套用后台布局（不要顶栏 / 侧边栏），只呈现流程本身
  layout: 'empty',
  middleware: ['auth']
})

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

const flowDetailQuery = gql`
  query FlowDetailPage($id: ID!) {
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
  mutation FlowDetailApprove($input: ApproveApprovalFlowInput!) {
    approvalMutations {
      approve(input: $input) {
        id
        status
      }
    }
  }
`

const rejectMutation = gql`
  mutation FlowDetailReject($input: RejectApprovalFlowInput!) {
    approvalMutations {
      reject(input: $input) {
        id
        status
      }
    }
  }
`

const cancelMutation = gql`
  mutation FlowDetailCancel($input: CancelApprovalFlowInput!) {
    approvalMutations {
      cancel(input: $input) {
        id
        status
      }
    }
  }
`

const route = useRoute()
const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const { userId } = useActiveUser()

const instanceId = computed(() => String(route.params.id || ''))
const mutating = ref(false)
const reviewComment = ref('')

const { result, loading, refetch } = useQuery<
  FlowDetailQueryResult,
  FlowDetailQueryVariables
>(flowDetailQuery, () => ({ id: instanceId.value }), {
  enabled: computed(() => !!instanceId.value),
  fetchPolicy: 'network-only'
})

const instance = computed(() => result.value?.approvalFlowInstance || null)

const flowTitle = computed(() => {
  const formTitle =
    typeof instance.value?.formData?.title === 'string'
      ? instance.value.formData.title
      : ''
  return formTitle || instance.value?.definition?.name || '审批流程'
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

const approvedStepCount = computed(
  () => instance.value?.steps.filter((step) => step.status === 'APPROVED').length || 0
)

const isTodoUser = computed(() => {
  const step = currentStep.value
  const uid = userId.value || ''
  if (!step || !uid) return false
  if (!step.approverIds.length) return true
  return step.approverIds.includes(uid)
})

const isCreator = computed(
  () => !!instance.value && instance.value.createdBy === (userId.value || '')
)

const isPending = computed(() => instance.value?.status === 'PENDING')
const canOperate = computed(() => isPending.value && isTodoUser.value)
const canComment = computed(
  () => canOperate.value || (isPending.value && isCreator.value)
)

const actionTitle = computed(() => {
  if (!isPending.value) return '流程已结束'
  if (canOperate.value) return '待你审批'
  if (isCreator.value) return '你发起的流程'
  return '仅可查看'
})

const actionHint = computed(() => {
  if (!isPending.value) {
    return `当前状态：${formatFlowStatusLabel(instance.value?.status)}`
  }
  if (canOperate.value) {
    const step = currentStep.value
    const due = step?.dueAt ? ` · 截止 ${formatDate(step.dueAt)}` : ''
    return `当前步骤：${step?.name || '-'}${due}`
  }
  if (isCreator.value) {
    return '审批由当前审核人处理，你可以取消该流程。'
  }
  return '你不是当前步骤的审核人，无法操作该流程。'
})

const actionCardBorderClass = computed(() => {
  if (!isPending.value) return 'border-outline-3'
  if (canOperate.value) return 'border-primary'
  return 'border-outline-3'
})

const actionDotClass = computed(() => {
  if (!isPending.value) return 'bg-outline-5'
  if (canOperate.value) return 'bg-primary'
  return 'bg-outline-5'
})

const stepApprovers = (step: FlowStep) => {
  const names = (step.approvers || [])
    .map((user) => user?.name)
    .filter((name): name is string => Boolean(name))
  if (names.length) return names.join('、')
  return step.approverIds.length ? step.approverIds.join('、') : '任意审批人'
}

const getFormResource = () => {
  const resourceId = instance.value?.resourceId
  if (!resourceId) return null
  const separatorIndex = resourceId.indexOf(':')
  if (separatorIndex === -1) return null
  return {
    formTable: resourceId.slice(0, separatorIndex),
    formId: resourceId.slice(separatorIndex + 1)
  }
}

const resourceRoute = computed(() => {
  const item = instance.value
  const formResource = getFormResource()
  if (!item || !item.projectId || !formResource) return null

  if (formResource.formTable === 'monthly_measurements') {
    return `/projects/${item.projectId}/work-valuation/monthly-measurement/${formResource.formId}/acceptance?mode=edit`
  }
  if (formResource.formTable === 'safety_measures') {
    return `/projects/${item.projectId}/work-valuation/safety-measure/${formResource.formId}?mode=edit`
  }
  return null
})

const openResourceInNewWindow = () => {
  if (!resourceRoute.value) return
  const url = new URL(resourceRoute.value, window.location.origin).toString()
  window.open(url, '_blank', 'noopener,noreferrer')
}

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

/** 步骤状态 -> 复用流程状态的颜色语义（仅用于配色） */
const stepStatusToFlowStatus = (status?: string | null) => {
  if (status === 'APPROVED') return 'APPROVED'
  if (status === 'PENDING') return 'PENDING'
  if (status === 'REJECTED' || status === 'CANCELED') return 'REJECTED'
  return 'WAITING'
}

const statusTagClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'bg-success/10 text-success'
  if (status === 'PENDING') return 'bg-primary/10 text-primary'
  if (status === 'REJECTED' || status === 'CANCELED') return 'bg-danger/10 text-danger'
  return 'bg-foundation-2 text-foreground-2'
}

const stepDotClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'bg-success ring-success/20'
  if (status === 'PENDING') return 'bg-primary ring-primary/20'
  if (status === 'REJECTED' || status === 'CANCELED') return 'bg-danger ring-danger/20'
  return 'bg-outline-5 ring-foundation-2'
}

const stepLineClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'bg-success/40'
  if (status === 'REJECTED' || status === 'CANCELED') return 'bg-danger/40'
  return 'bg-outline-3'
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
