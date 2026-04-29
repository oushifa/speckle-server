<template>
  <div class="space-y-6">
    <div class="flex flex-wrap gap-2">
      <LazyLayoutTabsHorizontal
        :items="headerTags"
        :active-item="activeTagItem"
        @update:active-item="onTagChange"
      />
    </div>

    <div class="border border-outline-3 rounded-xl p-4">
      <TodoPage
        v-if="currentTag === 'pending'"
        ref="todoPageRef"
        @open-instance="openInstanceDrawer"
      />
      <InitiatedPage
        v-else-if="currentTag === 'initiated'"
        ref="initiatedPageRef"
        @open-instance="openInstanceDrawer"
      />
      <HandledPage
        v-else-if="currentTag === 'handled'"
        ref="handledPageRef"
        @open-instance="openInstanceDrawer"
      />
      <AllFlowsPage v-else ref="allPageRef" @open-instance="openInstanceDrawer" />
    </div>

    <LayoutDrawer
      v-model:open="drawerOpen"
      placement="right"
      :width="'95%'"
      body-classes="p-4"
    >
      <template #title>
        {{ selectedInstance?.definition?.name || '未命名流程' }}
        <span
          v-if="selectedInstance?.resourceType === 'MODEL'"
          class="text-sm text-primary"
        >
          | {{ selectedInstance.project?.name }} - {{ selectedInstance.model?.name }}
        </span>
      </template>
      <template #extra>
        <span class="text-body-xs text-foreground-2">#{{ selectedInstance?.id }}</span>
      </template>

      <div v-if="selectedInstance" class="flex gap-4 h-full">
        <div class="flex-grow border border-outline-3 rounded-lg p-4 min-h-[520px]">
          <div class="text-body-xs text-foreground-2 size-full relative">
            <div
              v-if="selectedInstance.resourceType === 'MODEL'"
              class="size-full flex flex-col"
            >
              <div class="flex-grow relative">
                <CommonModelPropsViewer
                  :project-id="selectedInstance.projectId"
                  :model="[selectedInstance.resourceId]"
                ></CommonModelPropsViewer>
              </div>
            </div>
            <FlowMonthMeasure
              v-else-if="selectedInstance.definition?.templateId === 'm_measure'"
              :instance="selectedInstance"
            />
          </div>
        </div>

        <div class="xl:col-span-1 flex flex-col">
          <div class="flex-grow border border-outline-3 rounded-lg">
            <div class="p-3">
              <LazyLayoutTabsHorizontal
                :items="layoutTabs"
                :active-item="activeDetailTabItem"
                @update:active-item="onDetailTabChange"
              />
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
                      step.approvers?.length
                        ? step.approvers.map((e) => e?.name).join('、')
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
          <div v-if="isTodoUser" class="pt-1">
            <FormTextArea
              v-model="reviewComment"
              name="review-comment"
              label="审核意见"
              placeholder="请输入审核意见（选填）"
              :rows="4"
              bordered
            />
          </div>
        </div>
      </div>

      <template #footer>
        <FlowOpButtons
          :instance="selectedInstance"
          :user-id="userId"
          :loading="mutating"
          @action="openReviewDialogFromOp"
        />
      </template>
    </LayoutDrawer>
  </div>
</template>

<script setup lang="ts">
import { graphql } from '~~/lib/common/generated/gql'
import { useApolloClient } from '@vue/apollo-composable'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import FlowOpButtons from './FlowOpButtons.vue'
import TodoPage from './TodoPage.vue'
import InitiatedPage from './InitiatedPage.vue'
import HandledPage from './HandledPage.vue'
import AllFlowsPage from './AllFlowsPage.vue'
import type { FlowListItem } from './flowInstances'

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

type FlowReviewAction = 'approve' | 'reject' | 'cancel'
type FlowDetailTab = 'logs' | 'diagram'
type FlowHeaderTag = 'pending' | 'initiated' | 'handled' | 'all'
type FlowOpActionKey = 'approve' | 'rollback' | 'reject' | 'cancel'
type FlowHeaderTabItem = { id: FlowHeaderTag; title: string }
type FlowDetailTabItem = { id: FlowDetailTab; title: string }
type RefreshablePage = { refresh: () => Promise<void> }

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const { userId, isAdmin } = useActiveUser()

const mutating = ref(false)
const currentTag = ref<FlowHeaderTag>('pending')
const selectedInstance = ref<FlowListItem | null>(null)
const detailTab = ref<FlowDetailTab>('logs')
const reviewComment = ref('')
const todoPageRef = ref<RefreshablePage | null>(null)
const initiatedPageRef = ref<RefreshablePage | null>(null)
const handledPageRef = ref<RefreshablePage | null>(null)
const allPageRef = ref<RefreshablePage | null>(null)

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
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
    STEP_APPROVED: '通过',
    APPROVED: '流程结束',
    REJECTED: '驳回',
    CANCELED: '取消',
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

const headerTags = computed(() => {
  const tabs: FlowHeaderTabItem[] = [
    { id: 'pending', title: '待办' },
    { id: 'initiated', title: '我发起的' },
    { id: 'handled', title: '我处理的' }
  ]
  if (isAdmin.value) tabs.push({ id: 'all', title: '全部流程' })
  return tabs
})

const activeTagItem = computed(
  () =>
    headerTags.value.find((tag) => tag.id === currentTag.value) || headerTags.value[0]
)

const layoutTabs = [
  { id: 'logs' as FlowDetailTab, title: '流程日志' },
  { id: 'diagram' as FlowDetailTab, title: '流程图' }
] as FlowDetailTabItem[]

const activeDetailTabItem = computed(
  () => layoutTabs.find((tab) => tab.id === detailTab.value) || layoutTabs[0]
)

const isTodoUser = computed(() => {
  const step =
    selectedInstance.value?.steps.find((step) => step.status === 'PENDING') || null
  const uid = userId.value || ''
  if (!step || !uid) return false
  if (!step.approverIds.length) return true
  return step.approverIds.includes(uid)
})

const onTagChange = (item: { id: string }) => {
  currentTag.value = item.id as FlowHeaderTag
}

watch(isAdmin, (admin) => {
  if (!admin && currentTag.value === 'all') {
    currentTag.value = 'pending'
  }
})

const onDetailTabChange = (item: { id: string }) => {
  detailTab.value = item.id as FlowDetailTab
}

const refreshCurrentTagPage = async () => {
  if (currentTag.value === 'pending') {
    await todoPageRef.value?.refresh()
    return
  }
  if (currentTag.value === 'initiated') {
    await initiatedPageRef.value?.refresh()
    return
  }
  if (currentTag.value === 'handled') {
    await handledPageRef.value?.refresh()
    return
  }
  if (currentTag.value === 'all') {
    await allPageRef.value?.refresh()
    return
  }
  await handledPageRef.value?.refresh()
}

const drawerOpen = computed({
  get: () => !!selectedInstance.value,
  set: (value: boolean) => {
    if (!value) closeDrawer()
  }
})

const openInstanceDrawer = (instance: FlowListItem) => {
  if (!instance.projectId && instance.resourceType === 'MODEL') {
    notify('流程审核失败', '旧流程已弃置，请重新发起', ToastNotificationType.Warning)
    return
  }
  selectedInstance.value = instance
  detailTab.value = 'logs'
  reviewComment.value = ''
}

const closeDrawer = () => {
  selectedInstance.value = null
  reviewComment.value = ''
}

const openReviewDialogFromOp = (payload: {
  action: FlowReviewAction
  operation: FlowOpActionKey
  rollbackToStep: number | null
}) => {
  if (!selectedInstance.value) return
  void submitReviewAction({
    action: payload.action,
    instanceId: selectedInstance.value.id,
    comment: reviewComment.value.trim() || null,
    rollbackToStep:
      payload.action === 'reject' && payload.operation === 'rollback'
        ? payload.rollbackToStep
        : null
  })
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
    closeDrawer()
    try {
      await refreshCurrentTagPage()
    } catch {
      notify('刷新失败', '操作已成功，请手动刷新列表', ToastNotificationType.Warning)
    }
  } catch (e) {
    notify('操作失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
  }
}
</script>
