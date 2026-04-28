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
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">待办列表</h2>
            <span
              class="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-600"
            >
              {{ todoTotalCount }} 项待处理
            </span>
          </div>

          <div v-if="loadingTodos" class="text-sm text-slate-500">加载中...</div>
          <div v-else-if="!todoList.length" class="text-sm text-slate-500">
            暂无待办
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="todo in todoList"
              :key="todo.id"
              class="flex items-center justify-between rounded-lg border border-outline-3 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div class="flex items-start gap-4">
                <div
                  class="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500"
                >
                  <DocumentTextIcon class="h-5 w-5" />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-slate-900">
                    {{ todo.title }}
                  </h3>
                  <div
                    class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"
                  >
                    <span class="flex items-center gap-1">
                      <UserIcon class="h-3 w-3" />
                      发起人: {{ todo.initiator }}
                    </span>
                    <span class="flex items-center gap-1">
                      <ClockIcon class="h-3 w-3" />
                      发起时间: {{ todo.time }}
                    </span>
                    <span v-if="todo.supervisor" class="flex items-center gap-1">
                      <EyeIcon class="h-3 w-3" />
                      监: {{ todo.supervisor }}
                    </span>
                  </div>
                </div>
              </div>
              <span
                class="shrink-0 rounded px-2.5 py-1 text-xs font-medium"
                :class="
                  todo.status === '进行中'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-orange-100 text-orange-700'
                "
              >
                {{ todo.status }}
              </span>
            </div>
          </div>
        </div>

        <div
          class="rounded-xl bg-white p-6 shadow-sm border border-outline-3 flex flex-col h-full"
        >
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ArrowPathIcon class="h-5 w-5 text-blue-600" />
              <h2 class="text-lg font-bold text-slate-900">更新日志</h2>
            </div>
            <NuxtLink
              :to="workbenchPendingReviewsRoute"
              class="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              查看全部
            </NuxtLink>
          </div>

          <div class="mb-4 rounded-xl bg-blue-50 py-5 text-center">
            <p class="text-xl font-bold text-slate-900">最近更新</p>
            <p class="mt-1 text-4xl font-extrabold text-blue-700">
              {{ totalReviewableModelCount }}
            </p>
            <p class="mt-1 text-base font-semibold text-slate-700">个模型</p>
          </div>

          <div class="mb-2 text-lg font-bold text-slate-900">最新动态</div>
          <div class="flex-1 overflow-y-auto pr-1">
            <div
              v-for="update in recentUpdates"
              :key="update.id"
              class="group border-b border-outline-3 px-1 py-2.5 last:border-0"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <CubeTransparentIcon class="h-5 w-5 text-blue-600" />
                    <p class="text-base font-bold text-slate-900 leading-tight">
                      {{ update.title }}
                    </p>
                    <span
                      class="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700"
                    >
                      {{ update.version }}
                    </span>
                  </div>
                  <p class="mt-0.5 text-sm font-medium text-slate-700">
                    {{ update.description }}
                  </p>
                  <p class="mt-1 text-xs font-semibold text-slate-400">
                    {{ update.initiator }} ・ {{ update.time }}
                  </p>
                </div>
                <button
                  class="inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
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
            class="rounded-lg border border-outline-3 bg-blue-50 p-3 hover:border-sky-400 cursor-pointer"
            @click="openModelPage(selectedUpdate)"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-semibold text-slate-900">待审核模型</div>
              <span
                class="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700"
              >
                {{ selectedUpdate.version }}
              </span>
            </div>
            <div class="mt-1 text-sm font-semibold text-slate-900">
              {{ selectedUpdate.title }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              {{ selectedUpdate.projectName }} ・ {{ selectedUpdate.initiator }} ・
              {{ selectedUpdate.time }}
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
import DynamicApprovalBasicField from '~/components/flow/fields/DynamicApprovalBasicField.vue'
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'
import {
  flowInstancesQuery,
  type FlowInstancesQueryResult,
  type FlowInstancesQueryVariables,
  type FlowListItem
} from '~/components/flow/flowInstances'
import type {
  FlowDefinitionsQuery,
  FlowDefinitionsQueryVariables
} from '~~/lib/common/generated/gql/graphql'

const metrics = [
  {
    label: '模型总数',
    value: '156',
    icon: ArchiveBoxIcon,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600'
  },
  {
    label: '清单数量',
    value: '1,247',
    icon: ListBulletIcon,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600'
  },
  {
    label: '质量验收数量',
    value: '342',
    icon: ClipboardDocumentCheckIcon,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600'
  },
  {
    label: '验工数量',
    value: '89',
    icon: CalculatorIcon,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600'
  }
]

const templateId = 'model_aprv'

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
              versions(limit: 1) {
                totalCount
              }
            }
          }
        }
      }
    }
  }
`) as TypedDocumentNode<WorkbenchReviewUpdatesResult, { cursor: string | null }>

type ReviewableModel = {
  id: string
  name: string
  displayName: string
  description?: string | null
  updatedAt: string
  approveStatus?: string | null
  versions: {
    totalCount: number
  }
}
type ReviewableProject = {
  id: string
  name: string
  responsible?: string | null
  team: Array<{ user: { name: string } }>
  models: {
    items: ReviewableModel[]
  }
}
type WorkbenchReviewUpdatesResult = {
  activeUser: {
    projects: {
      cursor?: string | null
      items: ReviewableProject[]
    }
  } | null
}
type UpdateItem = {
  id: string
  resourceId: string
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
type DefinitionItem = FlowDefinitionsQuery['approvalFlowDefinitions'][number]
type TodoItem = {
  id: string
  title: string
  initiator: string
  supervisor: string
  time: string
  status: '进行中' | '待处理'
}

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const loadingTodos = ref(false)
const loadingUpdates = ref(false)
const mutating = ref(false)
const todoTotalCount = ref(0)
const todoList = ref<TodoItem[]>([])
const flowDefinitions = ref<FlowDefinitionsQuery['approvalFlowDefinitions']>([])
const recentUpdates = ref<UpdateItem[]>([])
const totalReviewableModelCount = ref(0)
const isStartDialogOpen = ref(false)
const selectedResourceId = ref<string | null>(null)
const selectedUpdate = ref<UpdateItem | null>(null)
const reviewerFieldValue = ref<unknown>('')
const titleFieldValue = ref<unknown>('')

const activeFlowDefinitions = computed(() =>
  flowDefinitions.value
    .filter((definition) => definition.isActive)
    .sort((a, b) => b.version - a.version)
)
const targetFlowDefinitions = computed(() => activeFlowDefinitions.value.slice(0, 1))
const hasActiveTargetFlow = computed(() => Boolean(targetFlowDefinitions.value.length))

const targetFlowDefinition = computed<DefinitionItem | null>(
  () => targetFlowDefinitions.value[0] || null
)
const reviewerField = computed<DynamicFormSchemaField>(() => {
  const userFields = (targetFlowDefinition.value?.formSchema || [])
    .filter((field) => field.type === 'user')
    .map((field) => ({
      key: field.key,
      name: field.name,
      type: field.type,
      required: field.required || false,
      multiple: false,
      placeholder: field.placeholder || '请选择审核人',
      options: []
    }))
  const preferredField =
    userFields.find((field) =>
      /approver|reviewer|审核人/i.test(`${field.key}${field.name}`)
    ) || userFields[0]
  return (
    preferredField || {
      key: 'nextApproverId',
      name: '审核人',
      type: 'user',
      required: true,
      multiple: false,
      placeholder: '请选择审核人',
      options: []
    }
  )
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

const mapTodoItems = (items: FlowListItem[]): TodoItem[] =>
  items.map((instance) => {
    const currentStep = getCurrentTodoStep(instance)
    const isInProgress = Boolean((currentStep?.approvedByIds || []).length)
    return {
      id: instance.id,
      title:
        instance.definition?.name ||
        instance.model?.name ||
        (typeof instance.formData?.title === 'string' ? instance.formData.title : '') ||
        '未命名流程',
      initiator: instance.createdByUser?.name || '-',
      supervisor: getCurrentApprovers(instance),
      time: formatUpdateTime(instance.createdAt),
      status: isInProgress ? '进行中' : '待处理'
    }
  })

const loadTodoList = async () => {
  loadingTodos.value = true
  try {
    const res = await apollo.query<
      FlowInstancesQueryResult,
      FlowInstancesQueryVariables
    >({
      query: flowInstancesQuery,
      variables: {
        cursor: null,
        status: 'PENDING',
        scope: 'TODO',
        limit: 5
      },
      fetchPolicy: 'network-only'
    })
    const page = res.data?.approvalFlowInstances
    todoTotalCount.value = page?.totalCount || 0
    todoList.value = mapTodoItems((page?.items || []) as FlowListItem[])
  } catch (e) {
    todoTotalCount.value = 0
    todoList.value = []
    notify('加载失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    loadingTodos.value = false
  }
}

const buildRecentUpdates = (projects: ReviewableProject[]): UpdateItem[] => {
  const items: UpdateItem[] = []
  projects.forEach((project) => {
    project.models.items.forEach((model) => {
      if (!canStartFlowForModel(model.approveStatus)) return
      const updateTimestamp = new Date(model.updatedAt).getTime() || 0
      items.push({
        id: `${project.id}-${model.id}`,
        resourceId: model.id,
        projectId: project.id,
        projectName: project.name,
        title: model.displayName || model.name,
        version: `v${Math.max(1, model.versions.totalCount)}`,
        description: model.description?.trim() || `来自项目 ${project.name}`,
        initiator: project.responsible?.trim() || project.team[0]?.user.name || '系统',
        time: formatUpdateTime(model.updatedAt),
        updatedAt: updateTimestamp,
        approveStatus: model.approveStatus
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
      })) as { data: WorkbenchReviewUpdatesResult }
      projects.push(...(result.data.activeUser?.projects.items || []))
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

const loadFlowDefinitions = async () => {
  try {
    const res = await apollo.query<FlowDefinitionsQuery, FlowDefinitionsQueryVariables>(
      {
        query: flowDefinitionsQuery,
        variables: {
          resourceType: 'MODEL'
        },
        fetchPolicy: 'network-only'
      }
    )
    flowDefinitions.value = res.data.approvalFlowDefinitions || []
  } catch (e) {
    notify('加载失败', (e as Error).message, ToastNotificationType.Danger)
  }
}

const openReviewDialog = (item: UpdateItem) => {
  if (!canStartFlowForModel(item.approveStatus)) {
    notify(
      '不可发起',
      '仅 approve_status 为 undefine 或 null 的模型可发起流程',
      ToastNotificationType.Warning
    )
    return
  }
  if (!targetFlowDefinitions.value.length || !hasActiveTargetFlow.value) {
    notify(
      '流程不可用',
      '未找到已启用的模型审批流程定义',
      ToastNotificationType.Warning
    )
    return
  }
  selectedResourceId.value = item.resourceId
  selectedUpdate.value = item
  reviewerFieldValue.value = reviewerField.value.multiple ? [] : ''
  titleFieldValue.value = ''
  isStartDialogOpen.value = true
}

const submitReviewApproval = async () => {
  const titleValue = `${titleFieldValue.value || ''}`.trim()
  if (!templateId || !selectedResourceId.value) return
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: startFlowMutation,
      variables: {
        input: {
          projectId: selectedUpdate.value?.projectId,
          templateId,
          resourceId: selectedResourceId.value,
          formData: {
            [reviewerField.value.key]: reviewerFieldValue.value,
            [titleField.value.key]: titleValue
          }
        }
      }
    })
    notify('发起成功', '审批流程已创建', ToastNotificationType.Success)
    isStartDialogOpen.value = false
    selectedUpdate.value = null
    selectedResourceId.value = null
    reviewerFieldValue.value = reviewerField.value.multiple ? [] : ''
    titleFieldValue.value = ''
    await loadRecentUpdates()
  } catch (e) {
    notify('发起失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
  }
}

const openModelPage = (item: UpdateItem) => {
  window.open(`/projects/${item.projectId}/models/${item.resourceId}`)
}

onMounted(async () => {
  await Promise.all([loadFlowDefinitions(), loadRecentUpdates(), loadTodoList()])
})
</script>
