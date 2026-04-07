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
              {{ todoCount }} 项待处理
            </span>
          </div>

          <div class="space-y-4">
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
          <div
            v-if="selectedUpdate"
            class="rounded-lg border border-outline-3 bg-blue-50 p-3"
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
          <FlowFieldsDynamicApprovalUserField
            :field="reviewerField"
            :value="reviewerFieldValue"
            @update:value="reviewerFieldValue = $event"
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
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'
import type {
  FlowDefinitionsQuery,
  FlowDefinitionsQueryVariables,
  FlowStartMutationVariables
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

const todoCount = 4
const targetFlowId = 'test1'

const flowDefinitionsQuery = graphql(`
  query FlowDefinitions($resourceType: ApprovalFlowResourceType) {
    approvalFlowDefinitions(resourceType: $resourceType) {
      id
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
`)

const startFlowMutation = graphql(`
  mutation FlowStart($input: StartApprovalFlowInput!) {
    approvalMutations {
      start(input: $input) {
        id
      }
    }
  }
`)

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

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const loadingUpdates = ref(false)
const mutating = ref(false)
const flowDefinitions = ref<FlowDefinitionsQuery['approvalFlowDefinitions']>([])
const recentUpdates = ref<UpdateItem[]>([])
const totalReviewableModelCount = ref(0)
const isStartDialogOpen = ref(false)
const selectedResourceId = ref<string | null>(null)
const selectedUpdate = ref<UpdateItem | null>(null)
const reviewerFieldValue = ref<unknown>('')

const activeFlowDefinitions = computed(() =>
  flowDefinitions.value
    .filter((definition) => definition.isActive)
    .sort((a, b) => b.version - a.version)
)
const targetFlowDefinitions = computed(() => activeFlowDefinitions.value.slice(0, 1))
const hasActiveTargetFlow = computed(() => Boolean(targetFlowDefinitions.value.length))
const resolvedTargetFlowId = computed(
  () => targetFlowDefinitions.value[0]?.id || targetFlowId
)
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

const todoList = [
  {
    id: 1,
    title: '审批主楼3层质量验收单',
    initiator: '张三',
    supervisor: '张三',
    time: '2025-02-22 10:30',
    status: '待处理'
  },
  {
    id: 2,
    title: '完成1月份验工计价',
    initiator: '李四',
    supervisor: '李四',
    time: '2025-02-21 14:20',
    status: '进行中'
  },
  {
    id: 3,
    title: '上传建筑模型v2.0版本',
    initiator: '王五',
    supervisor: '王五',
    time: '2025-02-23 09:15',
    status: '待处理'
  },
  {
    id: 4,
    title: '检查模型档案完整性',
    initiator: '赵六',
    supervisor: '赵六',
    time: '2025-02-20 16:45',
    status: '待处理'
  },
  {
    id: 5,
    title: '更新进度计划',
    initiator: '张三',
    supervisor: '张三',
    time: '2025-02-23 11:00',
    status: '待处理'
  }
]

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
  isStartDialogOpen.value = true
}

const submitReviewApproval = async () => {
  const selectedValue = reviewerFieldValue.value
  const hasReviewer = Array.isArray(selectedValue)
    ? selectedValue.length > 0
    : Boolean(selectedValue)
  if (reviewerField.value.required && !hasReviewer) {
    notify('校验失败', '请选择审核人', ToastNotificationType.Warning)
    return
  }
  const definitionId = resolvedTargetFlowId.value
  if (!definitionId || !selectedResourceId.value) return
  mutating.value = true
  try {
    await apollo.mutate({
      mutation: startFlowMutation,
      variables: {
        input: {
          definitionId,
          resourceId: selectedResourceId.value,
          formData: {
            [reviewerField.value.key]: reviewerFieldValue.value
          }
        }
      } as FlowStartMutationVariables
    })
    notify('发起成功', '审批实例已创建', ToastNotificationType.Success)
    isStartDialogOpen.value = false
    selectedUpdate.value = null
    selectedResourceId.value = null
    reviewerFieldValue.value = reviewerField.value.multiple ? [] : ''
    await loadRecentUpdates()
  } catch (e) {
    notify('发起失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    mutating.value = false
  }
}

onMounted(async () => {
  await loadFlowDefinitions()
  await loadRecentUpdates()
})
</script>
