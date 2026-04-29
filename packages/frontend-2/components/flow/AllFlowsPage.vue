<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="text-heading-sm">全部流程实例</div>
      <div class="text-body-xs text-foreground-2">总数：{{ totalCount }}</div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="space-y-1">
        <label for="flow-all-status-filter" class="text-body-xs text-foreground-2">
          状态筛选
        </label>
        <select
          id="flow-all-status-filter"
          v-model="statusFilter"
          class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page text-body-sm"
        >
          <option value="">全部状态</option>
          <option value="PENDING">进行中</option>
          <option value="APPROVED">已通过</option>
          <option value="REJECTED">已驳回</option>
          <option value="CANCELED">已取消</option>
        </select>
      </div>
      <div class="space-y-1 md:col-span-2">
        <label for="flow-all-keyword-filter" class="text-body-xs text-foreground-2">
          关键字筛选
        </label>
        <input
          id="flow-all-keyword-filter"
          v-model.trim="keywordFilter"
          class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page text-body-sm"
          placeholder="按流程名称、发起人、ID、项目/模型名称筛选"
        />
      </div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <label class="inline-flex items-center gap-2 text-body-sm text-foreground-2">
        <input
          type="checkbox"
          class="rounded border-outline-3"
          :checked="allVisibleSelected"
          @change="onToggleSelectAll"
        />
        选择当前结果（{{ selectedCount }}）
      </label>
      <FormButton
        color="outline"
        :disabled="!selectedCount"
        @click="transferDialogOpen = true"
      >
        转交代办
      </FormButton>
    </div>

    <div v-if="loading" class="text-body-sm text-foreground-2">加载中...</div>
    <div v-else-if="!filteredInstances.length" class="text-body-sm text-foreground-2">
      暂无数据
    </div>
    <div v-else class="space-y-3">
      <button
        v-for="instance in filteredInstances"
        :key="instance.id"
        class="w-full border border-outline-3 rounded-lg p-3 text-left hover:border-outline-5 transition-colors"
        @click="$emit('open-instance', instance)"
      >
        <div class="grid grid-cols-1 md:grid-cols-5 gap-2 items-start">
          <label class="pt-4" @click.stop>
            <input
              type="checkbox"
              class="rounded border-outline-3"
              :checked="selectedIdSet.has(instance.id)"
              @change="onRowCheckboxChange(instance.id, $event)"
            />
          </label>
          <div>
            <div class="text-body-xs text-foreground-2">名称</div>
            <div class="text-body-sm font-medium truncate">
              {{ instance.definition?.name || '未命名流程' }}
            </div>
            <div
              v-if="instance.resourceType === 'MODEL'"
              class="text-sm text-foreground-2"
            >
              {{ instance.project?.name }} - {{ instance.model?.name }}
            </div>
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">状态</div>
            <div class="text-body-sm">{{ formatFlowStatusLabel(instance.status) }}</div>
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">当前审核人</div>
            <div class="text-body-sm truncate">{{ getCurrentApprovers(instance) }}</div>
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">发起人</div>
            <div class="text-body-sm truncate">
              {{ instance.createdByUser?.name || instance.createdBy }}
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
      :disabled="loading"
      @click="loadInstances(cursor)"
    >
      加载更多
    </button>

    <LayoutDialog
      v-model:open="transferDialogOpen"
      max-width="sm"
      :buttons="transferDialogButtons"
    >
      <template #header>代办转交</template>
      <div class="space-y-3">
        <div class="text-body-sm text-foreground-2">
          已选择流程：
          <span class="font-medium">{{ selectedCount }}</span>
        </div>
        <FormSelectBase
          v-model="selectedAssignee"
          :items="assigneeOptions"
          :label="'转交给'"
          :show-label="false"
          name="transfer-assignee"
          :search="true"
          :search-placeholder="'输入用户名搜索'"
          :get-search-results="searchAssignees"
          by="id"
        >
          <template #nothing-selected>请选择接收人</template>
          <template #something-selected="{ value }">
            <span class="truncate">
              {{ Array.isArray(value) ? value[0]?.name : value?.name }}
            </span>
          </template>
          <template #option="{ item }">
            <span class="truncate">{{ item.name }} ({{ item.id }})</span>
          </template>
        </FormSelectBase>
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import type { DocumentNode } from 'graphql'
import { gql } from '@apollo/client/core'
import { useApolloClient } from '@vue/apollo-composable'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import {
  flowInstancesQuery,
  type FlowInstancesQueryResult,
  type FlowInstancesQueryVariables,
  type FlowListItem
} from './flowInstances'

type FlowStatusFilter = '' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'
type UserOption = { id: string; name: string }

type TransferAssigneeMutationResult = {
  approvalMutations: { transferAssignee: number }
}

type TransferAssigneeMutationVariables = {
  input: { instanceIds: string[]; assigneeId: string; comment?: string | null }
}

type SearchUsersQueryResult = {
  users?: { items?: Array<{ id: string; name: string | null }> | null } | null
}

defineEmits<{
  (e: 'open-instance', instance: FlowListItem): void
}>()

const transferAssigneeMutation = gql`
  mutation FlowTransferAssignee($input: TransferApprovalFlowAssigneeInput!) {
    approvalMutations {
      transferAssignee(input: $input)
    }
  }
`

const searchUsersQuery = gql`
  query FlowTransferSearchUsers($query: String!, $limit: Int!, $cursor: String) {
    users(input: { query: $query, limit: $limit, cursor: $cursor, projectId: null }) {
      cursor
      items {
        id
        name
      }
    }
  }
`

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()

const loading = ref(false)
const transferring = ref(false)
const instances = ref<FlowListItem[]>([])
const cursor = ref<string | null>(null)
const totalCount = ref(0)
const statusFilter = ref<FlowStatusFilter>('')
const keywordFilter = ref('')
const selectedIds = ref<string[]>([])
const transferDialogOpen = ref(false)
const assigneeOptions = ref<UserOption[]>([])
const selectedAssignee = ref<UserOption | undefined>(undefined)

const selectedIdSet = computed(() => new Set(selectedIds.value))
const selectedCount = computed(() => selectedIds.value.length)

const filteredInstances = computed(() => {
  const keyword = keywordFilter.value.trim().toLowerCase()
  if (!keyword) return instances.value
  return instances.value.filter((instance) => {
    const target = [
      instance.id,
      instance.definition?.name || '',
      instance.createdByUser?.name || '',
      instance.project?.name || '',
      instance.model?.name || ''
    ]
      .join(' ')
      .toLowerCase()
    return target.includes(keyword)
  })
})

const allVisibleSelected = computed(
  () =>
    !!filteredInstances.value.length &&
    filteredInstances.value.every((item) => selectedIdSet.value.has(item.id))
)

const notify = (title: string, description: string, type: ToastNotificationType) => {
  triggerNotification({ title, description, type })
}

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

const formatFlowStatusLabel = (status?: string | null) => {
  const statusMap: Record<string, string> = {
    PENDING: '进行中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELED: '已取消'
  }
  if (!status) return '-'
  return statusMap[status] || status
}

const getCurrentStep = (instance: FlowListItem) => {
  const byStatus = instance.steps.find((step) => step.status === 'PENDING') || null
  if (byStatus) return byStatus
  const byIndex = instance.steps.find((step) => step.stepIndex === instance.currentStep)
  return byIndex || null
}

const getCurrentApprovers = (instance: FlowListItem) => {
  const step = getCurrentStep(instance)
  if (!step) return '-'
  const approverNames = (step.approvers || [])
    .map((user) => user?.name)
    .filter((name): name is string => Boolean(name))
  if (approverNames.length) return approverNames.join('、')
  return step.approverIds.length ? step.approverIds.join('、') : '任意审批人'
}

const loadInstances = async (nextCursor?: string | null) => {
  loading.value = true
  try {
    const res = await apollo.query<
      FlowInstancesQueryResult,
      FlowInstancesQueryVariables
    >({
      query: flowInstancesQuery,
      variables: {
        cursor: nextCursor || null,
        status: statusFilter.value || null,
        scope: 'ALL',
        limit: 10
      },
      fetchPolicy: 'network-only'
    })
    const page = res.data?.approvalFlowInstances
    totalCount.value = page?.totalCount || 0
    cursor.value = page?.cursor || null
    const items = (page?.items || []) as FlowListItem[]
    instances.value = nextCursor ? [...instances.value, ...items] : items
  } catch (e) {
    if (!nextCursor) {
      instances.value = []
      totalCount.value = 0
      cursor.value = null
    }
    notify('加载失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  selectedIds.value = []
  await loadInstances()
}

const searchAssignees = async (searchKeyword: string) => {
  const normalizedQuery = searchKeyword.trim().length ? searchKeyword.trim() : '%'
  const res = await apollo.query<SearchUsersQueryResult>({
    query: searchUsersQuery as unknown as DocumentNode,
    variables: {
      query: normalizedQuery,
      limit: 50,
      cursor: null
    },
    fetchPolicy: 'network-only'
  })
  const items = res.data?.users?.items || []
  assigneeOptions.value = items.map((item) => ({
    id: item.id,
    name: item.name || item.id
  }))
  return assigneeOptions.value
}

const onRowCheckboxChange = (instanceId: string, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  const next = new Set(selectedIds.value)
  if (checked) next.add(instanceId)
  else next.delete(instanceId)
  selectedIds.value = Array.from(next)
}

const onToggleSelectAll = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  const next = new Set(selectedIds.value)
  for (const item of filteredInstances.value) {
    if (checked) next.add(item.id)
    else next.delete(item.id)
  }
  selectedIds.value = Array.from(next)
}

const canTransfer = computed(
  () =>
    !!selectedIds.value.length && !!selectedAssignee.value?.id && !transferring.value
)

const submitTransfer = async () => {
  if (!canTransfer.value || !selectedAssignee.value?.id) return
  transferring.value = true
  try {
    const res = await apollo.mutate<
      TransferAssigneeMutationResult,
      TransferAssigneeMutationVariables
    >({
      mutation: transferAssigneeMutation,
      variables: {
        input: {
          instanceIds: selectedIds.value,
          assigneeId: selectedAssignee.value.id
        }
      }
    })
    const successCount = res.data?.approvalMutations.transferAssignee || 0
    notify(
      '转交成功',
      `已成功转交 ${successCount} 条流程`,
      ToastNotificationType.Success
    )
    transferDialogOpen.value = false
    selectedAssignee.value = undefined
    selectedIds.value = []
    await loadInstances()
  } catch (e) {
    notify('转交失败', (e as Error).message, ToastNotificationType.Danger)
  } finally {
    transferring.value = false
  }
}

const transferDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      transferDialogOpen.value = false
    }
  },
  {
    text: '确认转交',
    props: { color: 'primary', loading: transferring.value },
    disabled: !canTransfer.value,
    onClick: submitTransfer
  }
])

watch(statusFilter, async () => {
  selectedIds.value = []
  await loadInstances()
})

watch(transferDialogOpen, async (open, wasOpen) => {
  if (open && !wasOpen) {
    selectedAssignee.value = undefined
    await searchAssignees('')
  }
})

defineExpose({ refresh })

onMounted(async () => {
  await loadInstances()
})
</script>
