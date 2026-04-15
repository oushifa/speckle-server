<template>
  <div class="space-y-6">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="tag in headerTags"
        :key="tag.value"
        class="px-3 py-1.5 rounded-full text-body-xs border transition-colors"
        :class="
          currentTag === tag.value
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-outline-3 text-foreground-2'
        "
        @click="currentTag = tag.value"
      >
        {{ tag.label }}
      </button>
    </div>

    <div class="border border-outline-3 rounded-xl p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-heading-sm">{{ activeTagLabel }}流程实例</div>
        <div class="text-body-xs text-foreground-2">总数：{{ filteredTotalCount }}</div>
      </div>

      <div v-if="loadingInstances" class="text-body-sm text-foreground-2">
        加载中...
      </div>
      <div v-else-if="!filteredInstances.length" class="text-body-sm text-foreground-2">
        暂无数据
      </div>
      <div v-else class="space-y-3">
        <button
          v-for="instance in filteredInstances"
          :key="instance.id"
          class="w-full border border-outline-3 rounded-lg p-3 text-left hover:border-outline-5 transition-colors"
          @click="openInstanceDrawer(instance)"
        >
          <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <div class="text-body-xs text-foreground-2">名称</div>
              <div class="text-body-sm font-medium truncate">
                {{ instance.definition?.name || '未命名流程' }}
              </div>
            </div>
            <div>
              <div class="text-body-xs text-foreground-2">当前步骤</div>
              <div class="text-body-sm">
                {{ getCurrentStep(instance)?.name || '-' }}
              </div>
            </div>
            <div>
              <div class="text-body-xs text-foreground-2">当前审核人</div>
              <div class="text-body-sm truncate">
                {{ getCurrentApprovers(instance) }}
              </div>
            </div>
            <div>
              <div class="text-body-xs text-foreground-2">流程发起时间</div>
              <div class="text-body-sm">{{ formatDate(instance.createdAt) }}</div>
            </div>
          </div>
        </button>
      </div>

      <button
        v-if="cursor"
        class="px-3 py-2 rounded-md border border-outline-3 text-body-sm disabled:opacity-50"
        :disabled="loadingInstances"
        @click="loadInstances(cursor)"
      >
        加载更多
      </button>
    </div>

    <div v-if="selectedInstance" class="fixed inset-0 z-50 flex justify-end">
      <button class="absolute inset-0 bg-black/40" @click="closeDrawer" />
      <div
        class="relative h-full w-full max-w-3xl bg-foundation-page border-l border-outline-3 shadow-xl overflow-y-auto"
      >
        <div
          class="p-4 border-b border-outline-3 flex items-center justify-between gap-3"
        >
          <div class="min-w-0">
            <div class="text-body-sm font-medium truncate">
              {{ selectedInstance.definition?.name || '未命名流程' }}
            </div>
            <div class="text-body-xs text-foreground-2">#{{ selectedInstance.id }}</div>
          </div>
          <button
            class="px-2 py-1 rounded border border-outline-3 text-body-xs"
            @click="closeDrawer"
          >
            关闭
          </button>
        </div>

        <div class="p-4">
          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div
              class="xl:col-span-2 border border-outline-3 rounded-lg p-4 min-h-[520px]"
            >
              <div class="text-body-xs text-foreground-2">流程内容</div>
            </div>

            <div class="xl:col-span-1 border border-outline-3 rounded-lg">
              <div class="p-3 border-b border-outline-3">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="tab in detailTabs"
                    :key="tab.value"
                    class="px-3 py-1.5 rounded-full text-body-xs border transition-colors"
                    :class="
                      detailTab === tab.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-3 text-foreground-2'
                    "
                    @click="detailTab = tab.value"
                  >
                    {{ tab.label }}
                  </button>
                </div>
              </div>

              <div class="p-3 space-y-3">
                <div v-if="detailTab === 'logs'" class="space-y-2">
                  <div
                    v-if="!selectedInstance.actions.length"
                    class="text-body-sm text-foreground-2 border border-outline-3 rounded-lg p-3"
                  >
                    暂无流程日志
                  </div>
                  <div
                    v-for="action in selectedInstance.actions"
                    :key="action.id"
                    class="border border-outline-3 rounded-lg p-3 text-body-xs text-foreground-2"
                  >
                    {{ formatActionLabel(action.action) }} ·
                    {{ action.actor?.name || action.actorId }} ·
                    {{ formatDate(action.createdAt) }}
                    <span v-if="action.toStatus">
                      · {{ formatStatusLabel(action.toStatus) }}
                    </span>
                    <span v-if="action.comment">· {{ action.comment }}</span>
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
                    <span
                      class="px-2 py-1 rounded-full bg-foundation-2 text-foreground-2"
                    >
                      未开始
                    </span>
                    <span class="px-2 py-1 rounded-full bg-danger/10 text-danger">
                      已拒绝/已取消
                    </span>
                  </div>
                  <div
                    v-for="step in selectedInstance.steps"
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
                        step.approverIds.length
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
          </div>
        </div>
      </div>
    </div>

    <CommonFlowReviewDialog
      v-model:open="isReviewDialogOpen"
      :action="selectedReviewAction"
      :instance-id="selectedReviewInstanceId"
      :loading="mutating"
      @submit="submitReviewAction"
    />
  </div>
</template>

<script setup lang="ts">
import { graphql } from '~~/lib/common/generated/gql'
import { useApolloClient } from '@vue/apollo-composable'
import type { TypedDocumentNode } from '@apollo/client/core'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import type {
  FlowDefinitionsQuery,
  FlowDefinitionsQueryVariables,
  FlowInstancesQuery,
  FlowInstancesQueryVariables
} from '~~/lib/common/generated/gql/graphql'

const flowDefinitionsQuery = graphql(`
  query FlowDefinitions($resourceType: ApprovalFlowResourceType) {
    approvalFlowDefinitions(resourceType: $resourceType) {
      id
      templateId
      name
      resourceType
      isActive
      version
      previousVersionId
      effectConfig
      formSchema {
        key
        name
        type
        required
        placeholder
        options {
          label
          value
        }
      }
      steps {
        id
        name
        stepIndex
        requiredApprovals
        approverIds
        timeoutHours
      }
    }
  }
`) as unknown as TypedDocumentNode<
  { approvalFlowDefinitions: FlowDefinitionsQuery['approvalFlowDefinitions'] },
  { resourceType: string | null }
>

const flowInstancesQuery = graphql(`
  query FlowInstances($cursor: String, $status: ApprovalFlowStatus) {
    approvalFlowStats(rangeDays: 30) {
      totalCount
      pendingCount
      approvedCount
      rejectedCount
      canceledCount
      averageResolutionHours
    }
    approvalFlowInstances(limit: 20, cursor: $cursor, status: $status) {
      totalCount
      cursor
      items {
        id
        resourceType
        resourceId
        formData
        status
        currentStep
        createdBy
        createdAt
        updatedAt
        definition {
          id
          name
          resourceType
          isActive
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
          approvedByIds
          startedAt
          dueAt
          completedAt
        }
      }
    }
  }
`)

const approveFlowMutation = graphql(`
  mutation FlowApprove($input: ApproveApprovalFlowInput!) {
    approvalMutations {
      approve(input: $input) {
        id
        status
      }
    }
  }
`)

const rejectFlowMutation = graphql(`
  mutation FlowReject($input: RejectApprovalFlowInput!) {
    approvalMutations {
      reject(input: $input) {
        id
        status
      }
    }
  }
`)

const cancelFlowMutation = graphql(`
  mutation FlowCancel($input: CancelApprovalFlowInput!) {
    approvalMutations {
      cancel(input: $input) {
        id
        status
      }
    }
  }
`)

type FlowListItem = FlowInstancesQuery['approvalFlowInstances']['items'][number]
type FlowStats = FlowInstancesQuery['approvalFlowStats']
type FlowDefinitionListItem = FlowDefinitionsQuery['approvalFlowDefinitions'][number]
type FlowReviewAction = 'approve' | 'reject' | 'cancel'
type FlowDetailTab = 'logs' | 'diagram'
type FlowHeaderTag = 'pending' | 'initiated' | 'handled'

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const { userId } = useActiveUser()

const loadingInstances = ref(false)
const mutating = ref(false)
const currentTag = ref<FlowHeaderTag>('pending')
const instances = ref<FlowListItem[]>([])
const cursor = ref<string | null>(null)
const totalCount = ref(0)
const isReviewDialogOpen = ref(false)
const selectedReviewAction = ref<FlowReviewAction>('approve')
const selectedReviewInstanceId = ref<string | null>(null)
const selectedInstance = ref<FlowListItem | null>(null)
const definitions = ref<FlowDefinitionListItem[]>([])
const detailTab = ref<FlowDetailTab>('logs')
const stats = ref<FlowStats>({
  totalCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  canceledCount: 0,
  averageResolutionHours: 0
})

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

const formatStatusLabel = (status?: string | null) => {
  const statusMap: Record<string, string> = {
    PENDING: '进行中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELED: '已取消'
  }
  if (!status) return '-'
  return statusMap[status] || status
}

const formatStepStatusLabel = (status?: string | null) => {
  const statusMap: Record<string, string> = {
    WAITING: '未开始',
    PENDING: '当前步骤',
    APPROVED: '已完成',
    REJECTED: '已驳回',
    CANCELED: '已取消'
  }
  if (!status) return '-'
  return statusMap[status] || status
}

const formatActionLabel = (action?: string | null) => {
  const actionMap: Record<string, string> = {
    STARTED: '发起流程',
    STEP_APPROVED: '步骤通过',
    APPROVED: '流程通过',
    REJECTED: '流程驳回',
    CANCELED: '流程取消',
    TIMEOUT_REJECTED: '超时驳回'
  }
  if (!action) return '-'
  return actionMap[action] || action
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

const notify = (title: string, description: string, type: ToastNotificationType) => {
  triggerNotification({
    title,
    description,
    type
  })
}

const headerTags = [
  { value: 'pending' as FlowHeaderTag, label: '待处理' },
  { value: 'initiated' as FlowHeaderTag, label: '我发起的' },
  { value: 'handled' as FlowHeaderTag, label: '我处理的' }
]

const activeTagLabel = computed(
  () => headerTags.find((tag) => tag.value === currentTag.value)?.label || ''
)

const filteredInstances = computed(() => {
  if (!userId.value) return instances.value
  if (currentTag.value === 'initiated') {
    return instances.value.filter((instance) => instance.createdBy === userId.value)
  }
  if (currentTag.value === 'handled') {
    return instances.value.filter((instance) =>
      instance.actions.some((action) => action.actorId === userId.value)
    )
  }
  return instances.value
})

const filteredTotalCount = computed(() => {
  if (currentTag.value === 'pending') return totalCount.value
  return filteredInstances.value.length
})

const detailTabs = [
  { value: 'logs' as FlowDetailTab, label: '流程日志' },
  { value: 'diagram' as FlowDetailTab, label: '流程图' }
]

const getCurrentStep = (
  instance: FlowListItem
): FlowListItem['steps'][number] | null => {
  const byStatus = instance.steps.find((step) => step.status === 'WAITING') || null
  if (byStatus) return byStatus
  const byIndex = instance.steps.find((step) => step.stepIndex === instance.currentStep)
  return byIndex || null
}

const getCurrentApprovers = (instance: FlowListItem) => {
  const step = getCurrentStep(instance)
  if (!step) return '-'
  return step.approverIds.length ? step.approverIds.join('、') : '任意审批人'
}

const loadDefinitions = async () => {
  const res = await apollo.query<FlowDefinitionsQuery, FlowDefinitionsQueryVariables>({
    query: flowDefinitionsQuery,
    variables: {
      resourceType: null
    },
    fetchPolicy: 'network-only'
  })
  definitions.value = (res.data.approvalFlowDefinitions ||
    []) as FlowDefinitionListItem[]
}

const loadInstances = async (nextCursor?: string | null) => {
  loadingInstances.value = true
  try {
    const res = await apollo.query<FlowInstancesQuery, FlowInstancesQueryVariables>({
      query: flowInstancesQuery,
      variables: {
        cursor: nextCursor || null,
        status: currentTag.value === 'pending' ? 'PENDING' : null
      },
      fetchPolicy: 'network-only'
    })
    const page = res.data.approvalFlowInstances
    stats.value = res.data.approvalFlowStats || {
      totalCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      canceledCount: 0,
      averageResolutionHours: 0
    }
    totalCount.value = page?.totalCount || 0
    cursor.value = page?.cursor || null
    const items = (page?.items || []) as FlowListItem[]
    if (nextCursor) {
      instances.value = [...instances.value, ...items]
    } else {
      instances.value = items
    }
  } finally {
    loadingInstances.value = false
  }
}

const openInstanceDrawer = (instance: FlowListItem) => {
  selectedInstance.value = instance
  detailTab.value = 'logs'
}

const closeDrawer = () => {
  selectedInstance.value = null
}

const submitReviewAction = async (payload: {
  action: FlowReviewAction
  instanceId: string
  comment: string | null
  rollbackToStep: number | null
}) => {
  mutating.value = true
  try {
    if (payload.action === 'approve') {
      await apollo.mutate({
        mutation: approveFlowMutation,
        variables: {
          input: {
            instanceId: payload.instanceId,
            comment: payload.comment
          }
        }
      })
      notify('操作成功', '审批已通过', ToastNotificationType.Success)
    } else if (payload.action === 'reject') {
      await apollo.mutate({
        mutation: rejectFlowMutation,
        variables: {
          input: {
            instanceId: payload.instanceId,
            comment: payload.comment || '',
            rollbackToStep: payload.rollbackToStep
          }
        }
      })
      notify('操作成功', '审批已驳回', ToastNotificationType.Success)
    } else {
      await apollo.mutate({
        mutation: cancelFlowMutation,
        variables: {
          input: {
            instanceId: payload.instanceId,
            comment: payload.comment
          }
        }
      })
      notify('操作成功', '审批已取消', ToastNotificationType.Success)
    }
  } catch (e) {
    notify('操作失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
    await loadInstances()
  }
}

const refreshAll = async () => {
  await Promise.all([loadDefinitions(), loadInstances()])
}

watch(
  () => currentTag.value,
  async () => {
    await loadInstances()
  }
)

onMounted(async () => {
  await refreshAll()
})
</script>
