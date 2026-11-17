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
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { useAuthCookie } from '~~/lib/auth/composables/auth'
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

type FlowInstanceApiResponse = {
  instance?: Omit<FlowInstanceDetail, 'steps' | 'actions'> | null
  binding?: unknown
  steps?: FlowStep[] | null
  actions?: FlowAction[] | null
}

type ReviewAction = 'approve' | 'reject' | 'cancel'
type FlowDetailTab = 'logs' | 'diagram'
type FlowDetailTabItem = { id: FlowDetailTab; title: string }

const props = defineProps<{
  instanceId: string
}>()

const apiOrigin = useApiOrigin()
const authCookie = useAuthCookie()
const { triggerNotification } = useGlobalToast()
const { userId } = useActiveUser()

const mutating = ref(false)
const loading = ref(false)
const instance = ref<FlowInstanceDetail | null>(null)
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

const getHeaders = (includeJsonContentType = false): Record<string, string> => {
  const headers: Record<string, string> = {}
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json'
  }
  if (authCookie.value) {
    headers.Authorization = `Bearer ${authCookie.value}`
  }
  return headers
}

const extractErrorMessage = async (res: Response, fallback: string) => {
  try {
    const text = await res.text()
    if (!text) return `${fallback} (${res.status})`
    try {
      const parsed = JSON.parse(text) as
        | { message?: string; error?: string; err?: string }
        | Array<{ message?: string }>
      if (Array.isArray(parsed)) {
        const msg = parsed
          .map((item) => item?.message)
          .filter(Boolean)
          .join('; ')
        if (msg) return msg
      } else if (parsed && typeof parsed === 'object') {
        if (typeof parsed.message === 'string' && parsed.message.trim()) {
          return parsed.message
        }
        if (typeof parsed.error === 'string' && parsed.error.trim()) {
          return parsed.error
        }
        if (typeof parsed.err === 'string' && parsed.err.trim()) {
          return parsed.err
        }
      }
    } catch {
      // 非 JSON 文本直接返回
    }
    return text
  } catch {
    return `${fallback} (${res.status})`
  }
}

let latestFetchSeq = 0

const refetch = async () => {
  const id = props.instanceId?.trim()
  if (!id) {
    instance.value = null
    loading.value = false
    return
  }

  const seq = ++latestFetchSeq
  loading.value = true
  try {
    const res = await fetch(
      `${apiOrigin}/api/approval-instances/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      }
    )

    if (!res.ok) {
      if (seq !== latestFetchSeq) return
      instance.value = null
      return
    }

    const text = await res.text()
    const data = text ? (JSON.parse(text) as FlowInstanceApiResponse | null) : null
    if (seq !== latestFetchSeq) return

    if (data?.instance) {
      instance.value = {
        ...data.instance,
        steps: data.steps || [],
        actions: data.actions || []
      }
    } else {
      instance.value = null
    }
  } catch (e) {
    if (seq !== latestFetchSeq) return
    // eslint-disable-next-line no-console
    console.error('加载模型审批详情失败:', e)
    instance.value = null
  } finally {
    if (seq === latestFetchSeq) {
      loading.value = false
    }
  }
}

watch(
  () => props.instanceId,
  () => {
    void refetch()
  },
  { immediate: true }
)

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
  const comment = reviewComment.value.trim() || null
  if (payload.action === 'reject' && !comment) {
    notify('提示', '请输入审核意见后再拒绝或驳回', ToastNotificationType.Warning)
    return
  }

  mutating.value = true
  try {
    const id = encodeURIComponent(instance.value.id)
    let url = ''
    let body: Record<string, unknown> = { comment }
    let successMsg = ''

    if (payload.action === 'approve') {
      url = `${apiOrigin}/api/approval-instances/${id}/approve`
      body = { comment }
      successMsg = '审批已通过'
    } else if (payload.action === 'reject') {
      if (payload.rollbackToStep === 0) {
        url = `${apiOrigin}/api/approval-instances/${id}/return-to-start`
        body = { comment }
      } else if (payload.rollbackToStep && payload.rollbackToStep > 0) {
        url = `${apiOrigin}/api/approval-instances/${id}/return-to-step`
        body = { targetStep: payload.rollbackToStep, comment }
      } else {
        url = `${apiOrigin}/api/approval-instances/${id}/reject`
        body = { comment }
      }
      successMsg = '审批已驳回'
    } else {
      url = `${apiOrigin}/api/approval-instances/${id}/cancel`
      body = { comment }
      successMsg = '审批已取消'
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errorMessage = await extractErrorMessage(res, '操作失败')
      throw new Error(errorMessage)
    }

    notify('操作成功', successMsg, ToastNotificationType.Success)
    reviewComment.value = ''
    await refetch()
  } catch (e) {
    notify('操作失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
  }
}
</script>
