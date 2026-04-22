<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="text-heading-sm">待办流程实例</div>
      <div class="text-body-xs text-foreground-2">总数：{{ totalCount }}</div>
    </div>

    <div v-if="loading" class="text-body-sm text-foreground-2">加载中...</div>
    <div v-else-if="!instances.length" class="text-body-sm text-foreground-2">
      暂无数据
    </div>
    <div v-else class="space-y-3">
      <button
        v-for="instance in instances"
        :key="instance.id"
        class="w-full border border-outline-3 rounded-lg p-3 text-left hover:border-outline-5 transition-colors"
        @click="$emit('open-instance', instance)"
      >
        <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
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
            <div class="text-body-xs text-foreground-2">当前步骤</div>
            <div class="text-body-sm">{{ getCurrentStep(instance)?.name || '-' }}</div>
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">当前审核人</div>
            <div class="text-body-sm truncate">{{ getCurrentApprovers(instance) }}</div>
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
  </div>
</template>

<script setup lang="ts">
import { useApolloClient } from '@vue/apollo-composable'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import {
  flowInstancesQuery,
  type FlowInstancesQueryResult,
  type FlowInstancesQueryVariables,
  type FlowListItem
} from './flowInstances'

defineEmits<{
  (e: 'open-instance', instance: FlowListItem): void
}>()

const apollo = useApolloClient().client
const { triggerNotification } = useGlobalToast()

const loading = ref(false)
const instances = ref<FlowListItem[]>([])
const cursor = ref<string | null>(null)
const totalCount = ref(0)

const notifyLoadError = (e: unknown) => {
  triggerNotification({
    title: '加载失败',
    description: (e as Error).message,
    type: ToastNotificationType.Danger
  })
}

const formatDate = (date?: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

const getCurrentStep = (instance: FlowListItem) => {
  const byStatus = instance.steps.find((step) => step.status === 'WAITING') || null
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
        status: 'PENDING',
        scope: 'TODO',
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
    notifyLoadError(e)
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  await loadInstances()
}

defineExpose({ refresh })

onMounted(async () => {
  await loadInstances()
})
</script>
