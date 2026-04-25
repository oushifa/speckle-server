<template>
  <div class="space-y-6">
    <Portal to="navigation">
      <div>数智南北</div>
    </Portal>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink
          :to="workbenchRoute"
          class="rounded-md border border-outline-3 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          返回工作台
        </NuxtLink>
        <h1 class="text-heading-lg">待审核模型</h1>
      </div>
      <div class="text-sm text-slate-500">共 {{ totalCount }} 个待审核模型</div>
    </div>

    <div
      class="rounded-xl bg-white p-6 shadow-sm border border-outline-3 flex flex-col gap-4 min-h-[420px]"
    >
      <div v-if="loading" class="text-sm text-slate-500">加载中...</div>
      <div v-else-if="!pagedItems.length" class="text-sm text-slate-500">
        暂无待审核模型
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="item in pagedItems"
          :key="item.id"
          class="flex items-start justify-between gap-4 rounded-lg border border-outline-3 p-4"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-base font-bold text-slate-900">{{ item.title }}</p>
              <span
                class="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700"
              >
                {{ item.version }}
              </span>
            </div>
            <p class="mt-1 text-sm text-slate-700">{{ item.description }}</p>
            <div class="mt-1 text-xs text-slate-400">
              {{ item.projectName }} ・ {{ item.initiator }} ・ {{ item.time }}
            </div>
          </div>
          <button
            class="inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
            :class="
              canStartFlowForModel(item.approveStatus) && !mutating
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            "
            :disabled="!canStartFlowForModel(item.approveStatus) || mutating"
            @click="openReviewDialog(item)"
          >
            <PaperAirplaneIcon class="h-4 w-4" />
            审核
          </button>
        </div>
      </div>

      <div class="mt-auto flex items-center justify-between pt-2">
        <div class="text-xs text-slate-500">
          第 {{ currentPage }} / {{ totalPages }} 页
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded border border-outline-3 px-3 py-1.5 text-sm disabled:opacity-50"
            :disabled="currentPage <= 1"
            @click="currentPage--"
          >
            上一页
          </button>
          <button
            class="rounded border border-outline-3 px-3 py-1.5 text-sm disabled:opacity-50"
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          >
            下一页
          </button>
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
</template>

<script setup lang="ts">
import { useApolloClient } from '@vue/apollo-composable'
import { PaperAirplaneIcon } from '@heroicons/vue/24/outline'
import type { TypedDocumentNode } from '@apollo/client/core'
import { graphql } from '~~/lib/common/generated/gql'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { workbenchRoute } from '~~/lib/common/helpers/route'
import DynamicApprovalBasicField from '~/components/flow/fields/DynamicApprovalBasicField.vue'
import type { DynamicFormSchemaField } from '~/components/flow/fields/types'
import {
  WorkbenchReviewUpdatesDocument,
  type FlowDefinitionsQuery,
  type WorkbenchReviewUpdatesQuery
} from '~~/lib/common/generated/gql/graphql'

useHead({
  title: '待审核模型'
})

definePageMeta({
  middleware: ['auth']
})

const targetFlowId = '5408aa67ee'
const pageSize = 20

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
      resourceId: string | null
      formData: Record<string, unknown>
    }
  }
>

type ReviewableProject = NonNullable<
  WorkbenchReviewUpdatesQuery['activeUser']
>['projects']['items'][number]
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

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()
const loading = ref(false)
const mutating = ref(false)
const allItems = ref<UpdateItem[]>([])
const flowDefinitions = ref<FlowDefinitionsQuery['approvalFlowDefinitions']>([])
const isStartDialogOpen = ref(false)
const selectedResourceId = ref<string | null>(null)
const selectedUpdate = ref<UpdateItem | null>(null)
const titleFieldValue = ref<unknown>('')
const currentPage = ref(1)

const targetFlowDefinitions = computed(() =>
  flowDefinitions.value.filter(
    (definition) =>
      (definition as { templateId?: string }).templateId === targetFlowId ||
      definition.id === targetFlowId
  )
)
const targetFlowDefinition = computed(() => targetFlowDefinitions.value[0] || null)
const titleField = computed<DynamicFormSchemaField>(() => ({
  key: 'title',
  name: '备注说明',
  type: 'string',
  required: true,
  placeholder: '请输入备注说明',
  options: []
}))

const totalCount = computed(() => allItems.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))
const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return allItems.value.slice(start, start + pageSize)
})

watch(
  () => totalPages.value,
  (pageTotal) => {
    if (currentPage.value > pageTotal) {
      currentPage.value = pageTotal
    }
  }
)

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

const buildItems = (projects: ReviewableProject[]): UpdateItem[] => {
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

const loadAllItems = async () => {
  loading.value = true
  try {
    const projects: ReviewableProject[] = []
    let cursor: string | null = null
    do {
      const result = (await apollo.query({
        query: WorkbenchReviewUpdatesDocument,
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
    allItems.value = buildItems(projects)
  } catch (e) {
    notify('加载失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    loading.value = false
  }
}

const loadFlowDefinitions = async () => {
  try {
    const res = await apollo.query({
      query: flowDefinitionsQuery,
      variables: {
        resourceType: 'MODEL'
      },
      fetchPolicy: 'network-only'
    })
    flowDefinitions.value = (res.data?.approvalFlowDefinitions ||
      []) as FlowDefinitionsQuery['approvalFlowDefinitions']
  } catch (e) {
    notify('加载失败', (e as Error).message, ToastNotificationType.Danger)
  }
}

const openReviewDialog = (item: UpdateItem) => {
  if (!targetFlowDefinitions.value.length) {
    notify(
      '流程不可用',
      `未找到流程定义 ${targetFlowId}`,
      ToastNotificationType.Warning
    )
    return
  }
  selectedResourceId.value = item.resourceId
  selectedUpdate.value = item
  titleFieldValue.value = ''
  isStartDialogOpen.value = true
}

const submitReviewApproval = async () => {
  const titleValue = `${titleFieldValue.value || ''}`.trim()
  if (titleField.value.required && !titleValue) {
    notify('校验失败', '请输入备注说明', ToastNotificationType.Warning)
    return
  }
  const templateId =
    targetFlowDefinition.value?.templateId ||
    targetFlowDefinition.value?.id ||
    targetFlowId
  if (!templateId || !selectedResourceId.value) return

  mutating.value = true
  try {
    await apollo.mutate({
      mutation: startFlowMutation,
      variables: {
        input: {
          templateId,
          resourceId: selectedResourceId.value,
          formData: {
            [titleField.value.key]: titleValue
          }
        }
      }
    })
    notify('发起成功', '审批实例已创建', ToastNotificationType.Success)
    isStartDialogOpen.value = false
    selectedUpdate.value = null
    selectedResourceId.value = null
    titleFieldValue.value = ''
    await loadAllItems()
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
  await loadFlowDefinitions()
  await loadAllItems()
})
</script>
