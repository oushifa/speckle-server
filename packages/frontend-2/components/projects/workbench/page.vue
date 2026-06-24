<template>
  <div class="h-full w-full font-sans text-slate-800">
    <div class="mx-auto">
      <div class="mb-4 mt-3 flex items-center gap-2">
        <IconHome class="h-5 w-5" />
        <h1 class="text-heading-lg">工作台</h1>
      </div>

      <div class="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="group relative overflow-hidden rounded-xl border border-outline-3 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-4">
              <div
                :class="`flex h-12 w-12 items-center justify-center rounded-full ${metric.iconBg}`"
              >
                <component :is="metric.icon" :class="`h-6 w-6 ${metric.iconColor}`" />
              </div>
              <div>
                <p class="text-sm font-medium text-slate-500">{{ metric.label }}</p>
                <p class="mt-1 text-2xl font-bold text-slate-900">{{ metric.value }}</p>
              </div>
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <button
              class="flex items-center text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              查看详情
              <ArrowRightIcon class="ml-1 h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div
          class="rounded-xl border border-outline-3 bg-white p-6 shadow-sm lg:col-span-2"
        >
          <div class="mb-6 flex flex-col gap-4">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-bold text-slate-900">流程列表</h2>
              <span
                class="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-600"
              >
                {{ projectTodoTotalCount }} 项
              </span>
            </div>
            <LazyLayoutTabsHorizontal
              :items="todoTabItems"
              :active-item="activeTodoTabItem"
              @update:active-item="onTodoTabChange"
            />
          </div>

          <div v-if="loadingTodos" class="text-sm text-slate-500">加载中...</div>
          <div v-else-if="!projectTodoList.length" class="text-sm text-slate-500">
            {{ activeTodoEmptyText }}
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="todo in projectTodoList"
              :key="todo.id"
              class="flex cursor-pointer items-center justify-between rounded-lg border border-outline-3 bg-white p-4 transition-shadow hover:shadow-md"
              role="button"
              tabindex="0"
              @click="openInstanceDrawer(todo)"
              @keydown.enter="openInstanceDrawer(todo)"
              @keydown.space.prevent="openInstanceDrawer(todo)"
            >
              <div class="flex items-start gap-4">
                <div
                  class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500"
                >
                  <DocumentTextIcon class="h-5 w-5" />
                </div>
                <div class="min-w-0">
                  <h3 class="text-base font-semibold text-slate-900">
                    {{ getFlowItemTitle(todo) }}
                  </h3>
                  <p
                    v-if="todo.resourceType === 'MODEL'"
                    class="mt-1 truncate text-xs text-slate-500"
                  >
                    {{ todo.project?.name || projectName || '-' }} -
                    {{ todo.model?.name || '-' }}
                  </p>
                  <div
                    class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"
                  >
                    <span class="flex items-center gap-1">
                      <DocumentTextIcon class="h-3.5 w-3.5" />
                      流程名称: {{ todo.definition?.name || '-' }}
                    </span>
                    <span class="flex items-center gap-1">
                      <UserIcon class="h-3 w-3" />
                      发起人: {{ todo.createdByUser?.name || '-' }}
                    </span>
                    <span class="flex items-center gap-1">
                      <ClockIcon class="h-3 w-3" />
                      发起时间: {{ formatUpdateTime(todo.createdAt) }}
                    </span>
                    <span class="flex items-center gap-1">
                      <EyeIcon class="h-3 w-3" />
                      当前审核人: {{ getCurrentApprovers(todo) }}
                    </span>
                  </div>
                </div>
              </div>
              <span
                class="shrink-0 rounded px-2.5 py-1 text-xs font-medium"
                :class="getFlowStatusClass(todo.status)"
              >
                {{ formatFlowStatusLabel(todo.status) }}
              </span>
            </div>
          </div>
        </div>

        <div
          class="flex h-full flex-col rounded-xl border border-outline-3 bg-white p-6 shadow-sm"
        >
          <div class="mb-5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ArrowPathIcon class="h-5 w-5 text-blue-600" />
              <h2 class="text-lg font-bold text-slate-900">模型审核</h2>
            </div>
            <span class="text-sm text-slate-500">
              共 {{ totalReviewableModelCount }} 项
            </span>
          </div>

          <div
            class="mb-5 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 px-4 py-4 text-center"
          >
            <p class="mb-1 text-sm text-slate-600">待发起审核</p>
            <p class="text-2xl font-bold text-blue-900">
              {{ totalReviewableModelCount }}
            </p>
            <p class="mt-1 text-sm text-slate-600">个模型版本</p>
          </div>

          <div class="mb-3 text-sm font-medium text-slate-600">最近待审核版本</div>
          <div v-if="loadingUpdates" class="text-sm text-slate-500">加载中...</div>
          <div v-else class="flex-1 space-y-3 overflow-y-auto">
            <div
              v-for="update in recentUpdates"
              :key="update.id"
              class="border-b border-outline-3 pb-3 last:border-0 last:pb-0"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="mb-1.5 flex items-center gap-2">
                    <CubeTransparentIcon class="h-4 w-4 shrink-0 text-blue-600" />
                    <p class="truncate text-sm font-medium text-slate-900">
                      {{ update.title }}
                    </p>
                    <span
                      class="h-5 shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                    >
                      {{ update.version }}
                    </span>
                  </div>
                  <p class="mb-1.5 text-sm text-slate-500">
                    {{ update.description }}
                  </p>
                  <p class="text-sm text-slate-400">
                    {{ update.initiator }} ・ {{ update.time }}
                  </p>
                </div>
                <button
                  class="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    canStartFlowForModel(update.approveStatus) &&
                    !mutating &&
                    !loadingUpdates
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  "
                  :disabled="
                    !canStartFlowForModel(update.approveStatus) ||
                    mutating ||
                    loadingUpdates
                  "
                  @click="openReviewDialog(update)"
                >
                  <PaperAirplaneIcon class="h-4 w-4" />
                  审核
                </button>
              </div>
            </div>
            <div
              v-if="!recentUpdates.length"
              class="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500"
            >
              暂无可审核模型
            </div>
          </div>
        </div>
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
          <span class="text-body-xs text-foreground-2">
            #{{ selectedInstance?.id }}
          </span>
        </template>

        <div v-if="selectedInstance" class="flex h-full gap-4">
          <div class="min-h-[520px] flex-grow rounded-lg border border-outline-3 p-4">
            <div class="relative size-full text-body-xs text-foreground-2">
              <div
                v-if="selectedInstance.resourceType === 'MODEL'"
                class="flex size-full flex-col"
              >
                <div class="relative flex-grow">
                  <CommonModelPropsViewer
                    :project-id="selectedInstance.projectId"
                    :model="modelViewerResources"
                  ></CommonModelPropsViewer>
                </div>
              </div>
              <FlowMonthMeasure
                v-else-if="selectedInstance.definition?.templateId === 'm_measure'"
                :instance="selectedInstance"
              />
            </div>
          </div>

          <div class="flex flex-col xl:col-span-1">
            <div class="flex-grow rounded-lg border border-outline-3">
              <div class="p-3">
                <LazyLayoutTabsHorizontal
                  :items="layoutTabs"
                  :active-item="activeDetailTabItem"
                  @update:active-item="onDetailTabChange"
                />
              </div>

              <div class="space-y-3 p-3">
                <div v-if="detailTab === 'logs'" class="space-y-2">
                  <div
                    v-if="!selectedInstance.actions.length"
                    class="rounded-lg border border-outline-3 p-3 text-body-sm text-foreground-2"
                  >
                    暂无流程日志
                  </div>
                  <div
                    v-for="action in selectedInstance.actions"
                    :key="action.id"
                    class="rounded-lg border border-outline-3 p-3 text-body-xs text-foreground-2"
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
                    <span class="rounded-full bg-success/10 px-2 py-1 text-success">
                      已完成
                    </span>
                    <span class="rounded-full bg-primary/10 px-2 py-1 text-primary">
                      当前步骤
                    </span>
                    <span
                      class="rounded-full bg-foundation-2 px-2 py-1 text-foreground-2"
                    >
                      未开始
                    </span>
                    <span class="rounded-full bg-danger/10 px-2 py-1 text-danger">
                      已拒绝/已取消
                    </span>
                  </div>
                  <div
                    v-for="step in selectedInstance.steps"
                    :key="step.id"
                    class="rounded-lg border p-3"
                    :class="getStepCardClass(step.status)"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-body-sm font-medium">
                        Step {{ step.stepIndex }} · {{ step.name }}
                      </div>
                      <span
                        class="rounded-full px-2 py-0.5 text-body-xs"
                        :class="getStepTagClass(step.status)"
                      >
                        {{ formatStepStatusLabel(step.status) }}
                      </span>
                    </div>
                    <div class="mt-1 text-body-xs text-foreground-2">
                      审核：{{ step.approvedByIds.length }}/{{ step.requiredApprovals }}
                    </div>
                    <div class="mt-1 text-body-xs text-foreground-2">
                      审核人：{{
                        step.approvers?.length
                          ? step.approvers.map((e) => e?.name).join('、')
                          : '任意审批人'
                      }}
                    </div>
                    <div class="mt-1 text-body-xs text-foreground-2">
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

      <CommonConfirmDialog
        v-model:open="isStartDialogOpen"
        title="发起审核"
        confirm-text="发起审核"
        :loading="mutating"
        :confirm-disabled="mutating || !selectedResourceId"
        :close-on-confirm="false"
        @confirm="submitReviewApproval"
      >
        <div class="space-y-4">
          <!-- eslint-disable-next-line -->
          <div
            v-if="selectedUpdate"
            class="cursor-pointer rounded-lg border border-blue-100 bg-blue-50 p-4 hover:border-sky-400"
            @click="openModelPage(selectedUpdate)"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <div class="text-sm font-semibold text-slate-900">待审核模型</div>
              <span class="rounded bg-white px-2 py-1 text-xs text-blue-600">
                {{ selectedUpdate.version }}
              </span>
            </div>
            <div class="mb-2 text-sm font-medium text-slate-900">
              {{ selectedUpdate.title }}
            </div>
            <div class="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span>{{ selectedUpdate.projectName }}</span>
              <span>{{ selectedUpdate.initiator }}</span>
              <span>{{ selectedUpdate.time }}</span>
            </div>
          </div>
          <DynamicApprovalBasicField
            :field="titleField"
            :value="titleFieldValue"
            @update:value="titleFieldValue = $event"
          />
        </div>
      </CommonConfirmDialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArchiveBoxIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  CalculatorIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  CubeTransparentIcon,
  DocumentTextIcon,
  EyeIcon,
  ListBulletIcon,
  PaperAirplaneIcon,
  UserIcon
} from '@heroicons/vue/24/outline'
import { useApolloClient } from '@vue/apollo-composable'
import type { TypedDocumentNode } from '@apollo/client/core'
import { graphql } from '~~/lib/common/generated/gql'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import type { ProjectPageProjectFragment } from '~/lib/common/generated/gql/graphql'
import FlowOpButtons from '~/components/flow/FlowOpButtons.vue'
import DynamicApprovalBasicField from '~/components/flow/fields/DynamicApprovalBasicField.vue'
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'
import type { FlowListItem } from '~/components/flow/flowInstances'
import { useViewerRouteBuilder } from '~/lib/projects/composables/models'

type DashboardStatsResponse = {
  projectCount: number
  modelCount: number
  boqCount: number
  qualityAcceptanceCount: number
  workValuationCount: number
}

type ProjectWorkbenchResponse = {
  stats: DashboardStatsResponse
  todos: {
    totalCount: number
    items: FlowListItem[]
  }
  reviewUpdates: {
    totalCount: number
    items: UpdateItem[]
  }
}

type UpdateItem = {
  id: string
  resourceId: string
  modelId: string
  projectId: string
  projectName: string
  title: string
  version: string
  description: string
  initiator: string
  time: string
  updatedAt: number
  approveStatus: string | null | undefined
}

type WorkbenchMetricKey =
  | 'modelCount'
  | 'boqCount'
  | 'qualityAcceptanceCount'
  | 'workValuationCount'
type FlowReviewAction = 'approve' | 'reject' | 'cancel'
type FlowDetailTab = 'logs' | 'diagram'
type FlowOpActionKey = 'approve' | 'rollback' | 'reject' | 'cancel'
type WorkbenchFlowTab = 'pending' | 'initiated' | 'handled'
type WorkbenchFlowTabItem = { id: WorkbenchFlowTab; title: string }

const metricCards: Array<{
  key: WorkbenchMetricKey
  label: string
  icon: unknown
  iconBg: string
  iconColor: string
}> = [
  {
    key: 'modelCount',
    label: '模型总数',
    icon: ArchiveBoxIcon,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600'
  },
  {
    key: 'boqCount',
    label: '清单数量',
    icon: ListBulletIcon,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600'
  },
  {
    key: 'qualityAcceptanceCount',
    label: '质量验收数量',
    icon: ClipboardDocumentCheckIcon,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600'
  },
  {
    key: 'workValuationCount',
    label: '验工数量',
    icon: CalculatorIcon,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600'
  }
]

const startFlowMutation = graphql(`
  mutation FlowStart($input: StartApprovalFlowInput!) {
    approvalMutations {
      start(input: $input) {
        id
      }
    }
  }
`) as unknown as TypedDocumentNode<
  { approvalMutations: { start: { id: string } } },
  {
    input: {
      projectId?: string
      templateId: string
      resourceId: string
      formData: Record<string, unknown>
    }
  }
>

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

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const { userId } = useActiveUser()
const apiOrigin = useApiOrigin()
const route = useRoute()
const props = defineProps<{
  project?: ProjectPageProjectFragment
}>()

const project = computed(() => props.project || null)
const projectId = computed(() => {
  const queryProjectId =
    typeof route.query.project_id === 'string' ? route.query.project_id.trim() : ''
  return queryProjectId || project.value?.id || ''
})
const projectName = computed(() =>
  project.value?.id === projectId.value ? project.value?.name || '' : ''
)
const dashboardStats = ref<DashboardStatsResponse>({
  projectCount: 0,
  modelCount: 0,
  boqCount: 0,
  qualityAcceptanceCount: 0,
  workValuationCount: 0
})
const refreshToken = ref(0)
const loadingTodos = ref(false)
const loadingUpdates = ref(false)
const mutating = ref(false)
const projectTodoTotalCount = ref(0)
const projectTodoList = ref<FlowListItem[]>([])
const recentUpdates = ref<UpdateItem[]>([])
const totalReviewableModelCount = ref(0)
const activeFlowTemplateId = ref<string | null>(null)
const isStartDialogOpen = ref(false)
const selectedResourceId = ref<string | null>(null)
const selectedUpdate = ref<UpdateItem | null>(null)
const selectedInstance = ref<FlowListItem | null>(null)
const titleFieldValue = ref<unknown>('')
const detailTab = ref<FlowDetailTab>('logs')
const reviewComment = ref('')
const layoutTabs = [
  { id: 'logs' as FlowDetailTab, title: '流程日志' },
  { id: 'diagram' as FlowDetailTab, title: '流程图' }
]

const todoTab = ref<WorkbenchFlowTab>('pending')
const todoTabItems: WorkbenchFlowTabItem[] = [
  { id: 'pending', title: '待办' },
  { id: 'initiated', title: '我发起的' },
  { id: 'handled', title: '我处理的' }
]

const activeTodoTabItem = computed(
  () => todoTabItems.find((item) => item.id === todoTab.value) || todoTabItems[0]
)

const activeTodoEmptyText = computed(() => {
  const emptyTextMap: Record<WorkbenchFlowTab, string> = {
    pending: '暂无待办',
    initiated: '暂无我发起的流程',
    handled: '暂无我处理的流程'
  }
  return emptyTextMap[todoTab.value]
})

const onTodoTabChange = (item: { id: string }) => {
  todoTab.value = item.id as WorkbenchFlowTab
}

const titleField = computed<DynamicFormSchemaField>(() => ({
  key: 'title',
  name: '备注说明',
  type: 'string',
  required: true,
  placeholder: '请输入备注说明',
  options: []
}))

const metrics = computed(() =>
  metricCards.map((item) => ({
    ...item,
    value: dashboardStats.value[item.key].toLocaleString('zh-CN')
  }))
)

const activeDetailTabItem = computed(
  () => layoutTabs.find((tab) => tab.id === detailTab.value) || layoutTabs[0]
)

const modelViewerResources = computed(() => {
  const instance = selectedInstance.value
  if (!instance) return []
  if (
    instance.model?.id &&
    instance.resourceId &&
    instance.resourceId !== instance.model.id
  ) {
    return [`${instance.model.id}@${instance.resourceId}`]
  }
  return instance.resourceId ? [instance.resourceId] : []
})

const isTodoUser = computed(() => {
  const step =
    selectedInstance.value?.steps.find((item) => item.status === 'PENDING') || null
  const uid = userId.value || ''
  if (!step || !uid) return false
  if (!step.approverIds.length) return true
  return step.approverIds.includes(uid)
})

const drawerOpen = computed({
  get: () => !!selectedInstance.value,
  set: (value: boolean) => {
    if (!value) {
      selectedInstance.value = null
      reviewComment.value = ''
    }
  }
})

const notify = (title: string, description: string, type: ToastNotificationType) => {
  triggerNotification({
    title,
    description,
    type
  })
}

const nextRefreshToken = () => {
  refreshToken.value += 1
  return refreshToken.value
}

const isTokenActive = (token: number) => refreshToken.value === token

const normalizeApproveStatus = (status?: string | null) => {
  if (typeof status !== 'string') return null
  const normalized = status.trim().toLowerCase()
  return normalized || null
}

const canStartFlowForModel = (status?: string | null) => {
  const normalizedStatus = normalizeApproveStatus(status)
  return (
    !normalizedStatus ||
    normalizedStatus === 'undefine' ||
    normalizedStatus === 'undefined' ||
    normalizedStatus === 'null'
  )
}

const formatUpdateTime = (dateString?: string | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

const getCurrentTodoStep = (instance: FlowListItem) => {
  const byStatus = instance.steps.find((step) => step.status === 'PENDING') || null
  if (byStatus) return byStatus
  const byIndex = instance.steps.find((step) => step.stepIndex === instance.currentStep)
  return byIndex || null
}

const getCurrentApprovers = (instance: FlowListItem) => {
  const step = getCurrentTodoStep(instance)
  if (!step) return '-'
  const approverNames = (step.approvers || [])
    .map((user) => user?.name)
    .filter((name): name is string => Boolean(name))
  if (approverNames.length) return approverNames.join('、')
  return step.approverIds.length ? step.approverIds.join('、') : '任意审批人'
}

const getFlowItemTitle = (instance: FlowListItem) =>
  instance.definition?.name ||
  instance.model?.name ||
  (typeof instance.formData?.title === 'string' ? instance.formData.title : '') ||
  '未命名流程'

const formatFlowStatusLabel = (status?: string | null) => {
  const statusMap: Record<string, string> = {
    PENDING: '进行中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELED: '已取消',
    WAITING: '未开始'
  }
  if (!status) return '-'
  return statusMap[status] || status
}

const getFlowStatusClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'bg-green-100 text-green-700'
  if (status === 'REJECTED' || status === 'CANCELED') {
    return 'bg-red-100 text-red-700'
  }
  if (status === 'WAITING') return 'bg-slate-100 text-slate-700'
  return 'bg-blue-100 text-blue-700'
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

const loadWorkbenchData = async (targetProjectId: string, token: number) => {
  if (!targetProjectId) return
  loadingTodos.value = true
  loadingUpdates.value = true
  try {
    const scopeMap: Record<WorkbenchFlowTab, string> = {
      pending: 'TODO',
      initiated: 'INITIATED',
      handled: 'HANDLED'
    }
    const targetScope = scopeMap[todoTab.value] || 'TODO'
    const data = await $fetch<ProjectWorkbenchResponse>(
      `${apiOrigin}/api/v1/projects/${targetProjectId}/workbench`,
      {
        query: {
          scope: targetScope
        }
      }
    )
    if (!isTokenActive(token)) return

    dashboardStats.value = {
      projectCount: data.stats?.projectCount || 0,
      modelCount: data.stats?.modelCount || 0,
      boqCount: data.stats?.boqCount || 0,
      qualityAcceptanceCount: data.stats?.qualityAcceptanceCount || 0,
      workValuationCount: data.stats?.workValuationCount || 0
    }
    projectTodoList.value = data.todos?.items || []
    projectTodoTotalCount.value = data.todos?.totalCount || 0
    recentUpdates.value = data.reviewUpdates?.items || []
    totalReviewableModelCount.value = data.reviewUpdates?.totalCount || 0
  } catch (e) {
    if (!isTokenActive(token)) return
    dashboardStats.value = {
      projectCount: 0,
      modelCount: 0,
      boqCount: 0,
      qualityAcceptanceCount: 0,
      workValuationCount: 0
    }
    projectTodoList.value = []
    projectTodoTotalCount.value = 0
    recentUpdates.value = []
    totalReviewableModelCount.value = 0
    notify('加载失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    if (isTokenActive(token)) {
      loadingTodos.value = false
      loadingUpdates.value = false
    }
  }
}

const openReviewDialog = async (item: UpdateItem) => {
  if (!canStartFlowForModel(item.approveStatus)) {
    notify(
      '不可发起',
      '仅 approve_status 为 undefine 或 null 的模型可发起流程',
      ToastNotificationType.Warning
    )
    return
  }

  mutating.value = true
  try {
    const activeDef = await $fetch<{ templateId: string }>(
      `${apiOrigin}/api/projects/${item.projectId}/approval-definitions/active?category=MODEL_REVIEW`
    )
    if (!activeDef?.templateId) {
      notify(
        '流程不可用',
        '未找到该项目下已启用的模型审核流程配置',
        ToastNotificationType.Warning
      )
      return
    }
    activeFlowTemplateId.value = activeDef.templateId
    selectedResourceId.value = item.resourceId
    selectedUpdate.value = item
    titleFieldValue.value = ''
    isStartDialogOpen.value = true
  } catch {
    notify(
      '流程不可用',
      '未找到该项目下已启用的模型审核流程配置，或获取流程失败',
      ToastNotificationType.Warning
    )
  } finally {
    mutating.value = false
  }
}

const submitReviewApproval = async () => {
  const titleValue = `${titleFieldValue.value || ''}`.trim()
  if (titleField.value.required && !titleValue) {
    notify('校验失败', '请输入备注说明', ToastNotificationType.Warning)
    return
  }
  if (!activeFlowTemplateId.value || !selectedResourceId.value) return
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: startFlowMutation,
      variables: {
        input: {
          projectId: selectedUpdate.value?.projectId,
          templateId: activeFlowTemplateId.value,
          resourceId: selectedResourceId.value,
          formData: {
            title: titleValue
          }
        }
      }
    })
    notify('发起成功', '审批流程已创建', ToastNotificationType.Success)
    isStartDialogOpen.value = false
    selectedUpdate.value = null
    selectedResourceId.value = null
    titleFieldValue.value = ''
    const token = nextRefreshToken()
    await loadWorkbenchData(projectId.value, token)
  } catch (e) {
    notify('发起失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
  }
}

const openModelPage = (item: UpdateItem) => {
  const { versionUrl } = useViewerRouteBuilder()
  window.open(
    versionUrl({
      projectId: item.projectId,
      modelId: item.modelId,
      versionId: item.resourceId
    })
  )
}

const onDetailTabChange = (item: { id: string }) => {
  detailTab.value = item.id as FlowDetailTab
}

const getMonthlyMeasurementId = (instance: FlowListItem) => {
  if (instance.resourceType === 'MODEL') return null

  const formTable =
    typeof instance.formData?.formTable === 'string'
      ? instance.formData.formTable
      : null
  const formId =
    typeof instance.formData?.formId === 'string' ? instance.formData.formId : null
  if (formTable === 'monthly_measurements' && formId) return formId

  const resourceId =
    typeof instance.resourceId === 'string' ? instance.resourceId : null
  if (resourceId?.startsWith('monthly_measurements:')) {
    return resourceId.split(':')[1] || null
  }

  return null
}

const getSafetyMeasureId = (instance: FlowListItem) => {
  if (instance.resourceType === 'MODEL') return null

  const formTable =
    typeof instance.formData?.formTable === 'string'
      ? instance.formData.formTable
      : null
  const formId =
    typeof instance.formData?.formId === 'string' ? instance.formData.formId : null
  if (formTable === 'safety_measures' && formId) return formId

  const resourceId =
    typeof instance.resourceId === 'string' ? instance.resourceId : null
  if (resourceId?.startsWith('safety_measures:')) {
    return resourceId.split(':')[1] || null
  }

  return null
}

const openInstanceDrawer = (instance: FlowListItem) => {
  const monthlyMeasurementId = getMonthlyMeasurementId(instance)
  if (monthlyMeasurementId) {
    if (!instance.projectId) {
      notify('流程打开失败', '未找到月度验工详情数据', ToastNotificationType.Warning)
      return
    }
    void navigateTo(
      `/projects/${instance.projectId}/work-valuation/monthly-measurement/${monthlyMeasurementId}/acceptance?mode=edit`
    )
    return
  }

  const safetyMeasureId = getSafetyMeasureId(instance)
  if (safetyMeasureId) {
    if (!instance.projectId) {
      notify('流程打开失败', '未找到安全文明措施详情数据', ToastNotificationType.Warning)
      return
    }
    void navigateTo(
      `/projects/${instance.projectId}/work-valuation/safety-measure/${safetyMeasureId}?mode=edit`
    )
    return
  }

  if (!instance.projectId && instance.resourceType === 'MODEL') {
    notify('流程审核失败', '旧流程已弃置，请重新发起', ToastNotificationType.Warning)
    return
  }
  selectedInstance.value = instance
  detailTab.value = 'logs'
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
      try {
        await apollo.resetStore()
      } catch {
        // resetStore 可能因活跃订阅失败，这里忽略即可
      }
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
    selectedInstance.value = null
    reviewComment.value = ''
    const token = nextRefreshToken()
    await loadWorkbenchData(projectId.value, token)
  } catch (e) {
    notify('操作失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
  }
}

watch(
  projectId,
  async (id) => {
    const token = nextRefreshToken()
    if (!id) {
      dashboardStats.value = {
        projectCount: 0,
        modelCount: 0,
        boqCount: 0,
        qualityAcceptanceCount: 0,
        workValuationCount: 0
      }
      projectTodoList.value = []
      projectTodoTotalCount.value = 0
      recentUpdates.value = []
      totalReviewableModelCount.value = 0
      return
    }
    dashboardStats.value = {
      projectCount: 0,
      modelCount: 0,
      boqCount: 0,
      qualityAcceptanceCount: 0,
      workValuationCount: 0
    }
    projectTodoList.value = []
    projectTodoTotalCount.value = 0
    recentUpdates.value = []
    totalReviewableModelCount.value = 0
    await loadWorkbenchData(id, token)
  },
  { immediate: true }
)

watch(
  todoTab,
  async () => {
    if (!projectId.value) return
    const token = nextRefreshToken()
    await loadWorkbenchData(projectId.value, token)
  }
)
</script>
