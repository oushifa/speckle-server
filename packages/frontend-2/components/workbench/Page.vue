<template>
  <div class="h-full w-full text-slate-800 font-sans">
    <div class="mx-auto">
      <div class="flex items-center gap-2 mb-6">
        <IconHome class="h-5 w-5" />
        <h1 class="text-heading-lg">工作台</h1>
      </div>

      <!-- Metrics Cards -->
      <div class="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="rounded-xl bg-white p-6 shadow-sm border border-outline-3 relative overflow-hidden group hover:shadow-md transition-shadow"
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
        <!-- Todo List (Left Column - Spans 2 cols) -->
        <div
          class="rounded-xl bg-white p-6 shadow-sm border border-outline-3 lg:col-span-2"
        >
          <div class="mb-6 flex flex-col gap-4">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-bold text-slate-900">流程列表</h2>
              <div class="flex items-center gap-3">
                <span
                  class="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-600"
                >
                  {{ activeTodoTotalCount }} 项
                </span>
                <NuxtLink
                  :to="flowPageRoute"
                  class="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  进入流程页
                </NuxtLink>
              </div>
            </div>
            <LazyLayoutTabsHorizontal
              :items="todoTabItems"
              :active-item="activeTodoTabItem"
              @update:active-item="onTodoTabChange"
            />
          </div>

          <div v-if="activeTodoLoading" class="text-sm text-slate-500">加载中...</div>
          <div v-else-if="!activeTodoList.length" class="text-sm text-slate-500">
            {{ activeTodoEmptyText }}
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="instance in activeTodoList"
              :key="instance.id"
              class="flex items-center justify-between rounded-lg border border-outline-3 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div class="flex items-start gap-4">
                <div
                  class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500"
                >
                  <DocumentTextIcon class="h-5 w-5" />
                </div>
                <div class="min-w-0">
                  <h3 class="text-base font-semibold text-slate-900">
                    {{ getFlowItemTitle(instance) }}
                  </h3>
                  <p
                    v-if="instance.resourceType === 'MODEL'"
                    class="mt-1 truncate text-xs text-slate-500"
                  >
                    {{ instance.project?.name || '-' }} -
                    {{ instance.model?.name || '-' }}
                  </p>
                  <div
                    class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"
                  >
                    <span class="flex items-center gap-1">
                      <UserIcon class="h-3 w-3" />
                      发起人: {{ instance.createdByUser?.name || '-' }}
                    </span>
                    <span class="flex items-center gap-1">
                      <ClockIcon class="h-3 w-3" />
                      发起时间: {{ formatUpdateTime(instance.createdAt) }}
                    </span>
                    <span class="flex items-center gap-1">
                      <EyeIcon class="h-3 w-3" />
                      当前审核人: {{ getCurrentApprovers(instance) }}
                    </span>
                  </div>
                </div>
              </div>
              <span
                class="shrink-0 rounded px-2.5 py-1 text-xs font-medium"
                :class="getFlowStatusClass(instance.status)"
              >
                {{ formatFlowStatusLabel(instance.status) }}
              </span>
            </div>
          </div>
        </div>

        <div
          class="rounded-xl bg-white p-6 shadow-sm border border-outline-3 flex flex-col h-full"
        >
          <div class="mb-5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ArrowPathIcon class="h-5 w-5 text-blue-600" />
              <h2 class="text-lg font-bold text-slate-900">更新日志</h2>
            </div>
            <NuxtLink
              :to="workbenchPendingReviewsRoute"
              class="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              查看全部
            </NuxtLink>
          </div>

          <div
            class="mb-5 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 px-4 py-4 text-center"
          >
            <p class="mb-1 text-sm text-slate-600">最近更新</p>
            <p class="text-2xl font-bold text-blue-900">
              {{ totalReviewableModelCount }}
            </p>
            <p class="mt-1 text-sm text-slate-600">个模型</p>
          </div>

          <div class="mb-3 text-sm font-medium text-slate-600">待审核版本</div>
          <div class="flex-1 space-y-3 overflow-y-auto">
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
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
              v-if="!recentUpdates.length && !loadingUpdates"
              class="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500"
            >
              暂无可审核模型
            </div>
          </div>
        </div>
      </div>
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
  CubeTransparentIcon,
  DocumentTextIcon,
  UserIcon,
  ClockIcon,
  EyeIcon,
  PaperAirplaneIcon,
  ListBulletIcon,
  ClipboardDocumentCheckIcon,
  CalculatorIcon
} from '@heroicons/vue/24/outline'
import { useApolloClient } from '@vue/apollo-composable'
import type { TypedDocumentNode } from '@apollo/client/core'
import { graphql } from '~~/lib/common/generated/gql'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { workbenchPendingReviewsRoute } from '~~/lib/common/helpers/route'
import { useViewerRouteBuilder } from '~/lib/projects/composables/models'
import DynamicApprovalBasicField from '~/components/flow/fields/DynamicApprovalBasicField.vue'
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'
import {
  flowInstancesQuery,
  type FlowInstancesQueryResult,
  type FlowInstancesQueryVariables,
  type FlowListItem
} from '~/components/flow/flowInstances'
import type { WorkbenchReviewUpdatesQuery } from '~~/lib/common/generated/gql/graphql'

type DashboardStatsResponse = {
  projectCount: number
  modelCount: number
  boqCount: number
  qualityAcceptanceCount: number
  workValuationCount: number
}

const metricCards = [
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
] as const

const activeFlowTemplateId = ref<string | null>(null)

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
      templateId: string
      resourceId: string
      formData: Record<string, unknown>
    }
  }
>

const workbenchReviewUpdatesQuery = graphql(`
  query WorkbenchReviewUpdates($cursor: String) {
    activeUser {
      id
      projects(limit: 25, cursor: $cursor) {
        cursor
        items {
          id
          name
          responsible
          team {
            user {
              name
            }
          }
          models(limit: 25) {
            items {
              id
              name
              displayName
              description
              updatedAt
              approveStatus
              versions(limit: 25) {
                totalCount
                items {
                  id
                  message
                  createdAt
                  sourceApplication
                  authorUser {
                    id
                    name
                  }
                  approveStatus
                }
              }
            }
          }
        }
      }
    }
  }
`) as TypedDocumentNode<WorkbenchReviewUpdatesQuery, { cursor: string | null }>

type ReviewableProject = NonNullable<
  WorkbenchReviewUpdatesQuery['activeUser']
>['projects']['items'][number]
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
type WorkbenchFlowTab = 'pending' | 'initiated' | 'handled'
type WorkbenchFlowTabItem = { id: WorkbenchFlowTab; title: string }
type WorkbenchFlowTabState = {
  loading: boolean
  loaded: boolean
  totalCount: number
  items: FlowListItem[]
}

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const apiOrigin = useApiOrigin()
const route = useRoute()
const loadingUpdates = ref(false)
const mutating = ref(false)
const dashboardStats = ref<DashboardStatsResponse>({
  projectCount: 0,
  modelCount: 0,
  boqCount: 0,
  qualityAcceptanceCount: 0,
  workValuationCount: 0
})
const todoTab = ref<WorkbenchFlowTab>('pending')
const recentUpdates = ref<UpdateItem[]>([])
const totalReviewableModelCount = ref(0)
const isStartDialogOpen = ref(false)
const selectedResourceId = ref<string | null>(null)
const selectedUpdate = ref<UpdateItem | null>(null)
const titleFieldValue = ref<unknown>('')
const todoTabItems: WorkbenchFlowTabItem[] = [
  { id: 'pending', title: '待办' },
  { id: 'initiated', title: '我发起的' },
  { id: 'handled', title: '我处理的' }
]
const flowTabStates = reactive<Record<WorkbenchFlowTab, WorkbenchFlowTabState>>({
  pending: {
    loading: false,
    loaded: false,
    totalCount: 0,
    items: []
  },
  initiated: {
    loading: false,
    loaded: false,
    totalCount: 0,
    items: []
  },
  handled: {
    loading: false,
    loaded: false,
    totalCount: 0,
    items: []
  }
})

const titleField = computed<DynamicFormSchemaField>(() => ({
  key: 'title',
  name: '备注说明',
  type: 'string',
  required: true,
  placeholder: '请输入备注说明',
  options: []
}))

const notify = (title: string, description: string, type: ToastNotificationType) => {
  triggerNotification({
    title,
    description,
    type
  })
}

const formatMetricValue = (value: number) => value.toLocaleString('zh-CN')

const metrics = computed(() =>
  metricCards.map((item) => ({
    ...item,
    value: formatMetricValue(dashboardStats.value[item.key])
  }))
)

const activeTodoState = computed(() => flowTabStates[todoTab.value])

const activeTodoList = computed(() => activeTodoState.value.items)

const activeTodoLoading = computed(() => activeTodoState.value.loading)

const activeTodoTotalCount = computed(() => activeTodoState.value.totalCount)

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

const flowPageRoute = computed(() => ({
  path: '/flow',
  query: todoTab.value === 'pending' ? {} : { tab: todoTab.value }
}))

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

const getCurrentTodoStep = (instance: FlowListItem) => {
  const byStatus = instance.steps.find((step) => step.status === 'WAITING') || null
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

const todoTabQueryConfig: Record<
  WorkbenchFlowTab,
  Pick<FlowInstancesQueryVariables, 'scope' | 'status'>
> = {
  pending: {
    scope: 'TODO',
    status: 'PENDING'
  },
  initiated: {
    scope: 'INITIATED',
    status: null
  },
  handled: {
    scope: 'HANDLED',
    status: null
  }
}

const loadTodoList = async (tab: WorkbenchFlowTab) => {
  const state = flowTabStates[tab]
  state.loading = true
  try {
    const config = todoTabQueryConfig[tab]
    const res = await apollo.query<
      FlowInstancesQueryResult,
      FlowInstancesQueryVariables
    >({
      query: flowInstancesQuery,
      variables: {
        cursor: null,
        status: config.status,
        scope: config.scope,
        limit: 5
      },
      fetchPolicy: 'network-only'
    })
    const page = res.data?.approvalFlowInstances
    state.totalCount = page?.totalCount || 0
    state.items = (page?.items || []) as FlowListItem[]
    state.loaded = true
  } catch (e) {
    state.totalCount = 0
    state.items = []
    state.loaded = false
    notify('加载失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    state.loading = false
  }
}

const ensureTodoTabLoaded = async (tab: WorkbenchFlowTab) => {
  if (flowTabStates[tab].loaded || flowTabStates[tab].loading) return
  await loadTodoList(tab)
}

const buildRecentUpdates = (projects: ReviewableProject[]): UpdateItem[] => {
  const items: UpdateItem[] = []
  projects.forEach((project) => {
    project.models.items.forEach((model) => {
      const versions = model.versions?.items || []
      const totalCount = model.versions?.totalCount || 0
      versions.forEach((version, idx) => {
        if (!canStartFlowForModel(version.approveStatus)) return
        const updateTimestamp = new Date(version.createdAt).getTime() || 0
        items.push({
          id: `${project.id}-${model.id}-${version.id}`,
          resourceId: version.id,
          modelId: model.id,
          projectId: project.id,
          projectName: project.name,
          title: model.displayName || model.name,
          version: `v${totalCount - idx}`,
          description: version.message?.trim() || `来自项目 ${project.name}`,
          initiator: version.authorUser?.name || project.responsible?.trim() || '系统',
          time: formatUpdateTime(version.createdAt),
          updatedAt: updateTimestamp,
          approveStatus: version.approveStatus
        })
      })
    })
  })
  return items.sort((a, b) => b.updatedAt - a.updatedAt)
}

const loadRecentUpdates = async () => {
  loadingUpdates.value = true
  try {
    const projects: ReviewableProject[] = []
    let cursor: string | null = null
    do {
      const result = (await apollo.query({
        query: workbenchReviewUpdatesQuery,
        variables: {
          cursor
        },
        fetchPolicy: 'no-cache'
      })) as { data: WorkbenchReviewUpdatesQuery }
      projects.push(
        ...((result.data.activeUser?.projects.items || []) as ReviewableProject[])
      )
      cursor = result.data.activeUser?.projects.cursor || null
    } while (cursor)
    const allUpdates = buildRecentUpdates(projects)
    totalReviewableModelCount.value = allUpdates.length
    recentUpdates.value = allUpdates.slice(0, 5)
  } catch (e) {
    notify('加载失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    loadingUpdates.value = false
  }
}

const loadDashboardStats = async () => {
  try {
    const queryProjectId =
      typeof route.query.projectId === 'string' ? route.query.projectId.trim() : ''
    const query = queryProjectId ? { projectId: queryProjectId } : undefined
    const stats = await $fetch<DashboardStatsResponse>(`${apiOrigin}/api/dashboard`, {
      query
    })
    dashboardStats.value = {
      projectCount: stats.projectCount || 0,
      modelCount: stats.modelCount || 0,
      boqCount: stats.boqCount || 0,
      qualityAcceptanceCount: stats.qualityAcceptanceCount || 0,
      workValuationCount: stats.workValuationCount || 0
    }
  } catch (e) {
    dashboardStats.value = {
      projectCount: 0,
      modelCount: 0,
      boqCount: 0,
      qualityAcceptanceCount: 0,
      workValuationCount: 0
    }
    notify('加载失败', (e as Error).message, ToastNotificationType.Danger)
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
    await loadRecentUpdates()
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

const onTodoTabChange = (item: { id: string }) => {
  todoTab.value = item.id as WorkbenchFlowTab
}

watch(
  todoTab,
  (tab) => {
    void ensureTodoTabLoaded(tab)
  },
  { immediate: true }
)

onMounted(async () => {
  await Promise.all([loadRecentUpdates(), loadDashboardStats()])
})
</script>
