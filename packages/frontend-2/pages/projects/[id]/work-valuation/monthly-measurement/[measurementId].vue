<template>
  <div class="flex flex-col h-full space-y-4">
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
    <div class="flex items-center justify-between mt-3">
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
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && !item" class="p-6 text-center text-foreground-2">
      详情加载中...
    </div>

    <template v-else-if="item">
      <div class="flex-grow min-h-0 w-full relative">
        <!-- 左侧主体内容：页签与子页面视图 -->
        <div class="h-full flex flex-col space-y-4 overflow-hidden pr-0">
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
          <div class="flex-grow min-w-0 overflow-y-auto">
            <NuxtPage :item="item" :project-id="projectId" :flow-instance="flowInstance" @refetch="loadBaseMeasurement" />
          </div>
        </div>

        <!-- 右侧绝对定位审批面板 (Slide-over overlay) -->
        <div
          v-if="item.flowInstanceId"
          class="fixed right-0 top-12 bottom-0 z-40 flex flex-col border-l border-outline-3 bg-foundation h-[calc(100vh-48px)] overflow-hidden transition-transform duration-300 ease-in-out shadow-2xl w-[320px]"
          :class="[isSidebarExpanded ? 'translate-x-0' : 'translate-x-full pointer-events-none']"
        >
          <!-- 面板头部 / 折叠控制 -->
          <div
            class="p-3 border-b border-outline-3 flex items-center justify-between flex-shrink-0 bg-foundation-2 h-[48px]"
          >
            <span class="text-sm font-bold text-foreground">
              审批流程
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
          <div
            class="flex-grow flex flex-col min-h-0 overflow-y-auto p-4 space-y-5"
          >
            <!-- 流程总体状态 -->
            <div class="flex items-center justify-between text-xs pb-3 border-b border-outline-3">
              <span class="text-foreground-2">流程状态:</span>
              <CommonBadge
                :color-classes="getStatusColor(flowInstance?.status || item.approveStatus)"
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
                待办人: {{ flowInstance.steps?.find((s: any) => s.status === 'PENDING')?.approvers?.map((u: any) => u?.name).filter(Boolean).join(', ') || '所有人' }}
              </div>
            </div>

            <!-- 审核意见与操作按钮区 -->
            <div
              v-if="flowInstance?.status === 'PENDING' && (isTodoUser || isCreator)"
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
                    通过
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
                    审核进度: {{ step.approvedByIds?.length || 0 }} / {{ step.requiredApprovals }}
                  </div>
                  <div v-if="step.approvers?.length" class="text-foreground-2 mt-0.5">
                    审核人: {{ step.approvers.map((u: any) => u?.name).filter(Boolean).join('、') }}
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
                      action.action === 'APPROVED' || action.action === 'STEP_APPROVED' ? 'bg-success' : '',
                      action.action === 'REJECTED' || action.action === 'TIMEOUT_REJECTED' ? 'bg-danger' : '',
                      action.action === 'CANCELED' ? 'bg-foreground-2' : ''
                    ]"
                  />
                  <div class="font-medium text-foreground">
                    {{ formatFlowActionLabel(action.action) }}
                  </div>
                  <div class="text-[11px] text-foreground-2 flex flex-wrap gap-x-2">
                    <span>处理人: {{ action.actor?.name || action.actorId || '-' }}</span>
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
          <span class="text-[10px] font-bold tracking-widest" style="writing-mode: vertical-rl;">
            审批流程
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { FormButton, FormTextArea, CommonBadge } from '@speckle/ui-components'
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
const { userId } = useActiveUser()
const { triggerNotification } = useGlobalToast()

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

// 权限校验计算属性
const isTodoUser = computed(() => {
  if (flowInstance.value?.status !== 'PENDING') return false
  const step = flowInstance.value?.steps?.find((s: any) => s.status === 'PENDING')
  if (!step) return false
  const uid = userId.value || ''
  if (!step.approverIds || !step.approverIds.length) return true
  return step.approverIds.includes(uid)
})

const isCreator = computed(() => {
  return flowInstance.value?.createdBy === userId.value
})

// 统一确认弹窗状态
const confirmDialogOpen = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogText = ref('')
const confirmDialogConfirmText = ref('')
const confirmDialogAction = ref<(() => Promise<void>) | null>(null)

const triggerConfirm = (title: string, text: string, confirmText: string, action: () => Promise<void>) => {
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
  mutating.value = true
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
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: rejectFlowMutation,
      variables: {
        input: {
          instanceId: flowInstance.value.id,
          comment: reviewComment.value.trim() || '',
          rollbackToStep: null
        }
      }
    })
    reviewComment.value = ''
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
  triggerConfirm('确认通过审批', '您确定要通过当前的审批步骤吗？', '确认通过', executeApprove)
}

const confirmReject = () => {
  triggerConfirm('确认驳回审批', '您确定要驳回当前的审批步骤吗？', '确认驳回', executeReject)
}

const confirmCancel = () => {
  triggerConfirm('确认取消审批', '您确定要取消当前的审批流程吗？', '确认取消', executeCancel)
}

// 格式化与样式辅助函数
const getStatusColor = (status: string | null | undefined) => {
  const map: Record<string, string> = {
    START: 'bg-warning-lighter text-warning-darker',
    PENDING: 'bg-primary-muted text-primary',
    APPROVED: 'bg-success-lighter text-success-darker',
    REJECTED: 'bg-danger-lighter text-danger-darker',
    CANCELED: 'bg-highlight-3 text-foreground-2'
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

const getCurrentFlowStepName = (instance: any) => {
  if (!instance?.steps) return '-'
  const byStatus = instance.steps.find((step: any) => step.status === 'PENDING')
  if (byStatus) return byStatus.name
  const byIndex = instance.steps.find((step: any) => step.stepIndex === instance.currentStep)
  return byIndex?.name || '-'
}

const formatDate = (date?: string | number | null) => {
  if (!date) return '-'
  return dayjs(Number(date)).isValid() ? dayjs(Number(date)).format('YYYY-MM-DD HH:mm:ss') : '-'
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
    to: `/projects/${projectId.value}/work-valuation/monthly-measurement/${measurementId.value}/acceptance`
  },
  {
    id: 'payment-details',
    name: '中间支付单',
    to: `/projects/${projectId.value}/work-valuation/monthly-measurement/${measurementId.value}/payment-details`
  },
  {
    id: 'payment-requests',
    name: '工程费用支付申请单',
    to: `/projects/${projectId.value}/work-valuation/monthly-measurement/${measurementId.value}/payment-requests`
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
</script>
