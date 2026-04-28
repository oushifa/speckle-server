<template>
  <div class="flex flex-col gap-6">
    <!-- Header Section -->
    <div>
      <div class="flex items-center gap-2 mb-6">
        <IconCalculator class="h-5 w-5" />
        <h1 class="text-heading-lg">验工计价</h1>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <!-- Card 1 -->
        <div
          class="bg-foundation p-6 rounded-lg border border-outline-3 flex items-center gap-4"
        >
          <div class="p-3 rounded-lg bg-primary-muted text-primary">
            <CurrencyDollarIcon class="w-8 h-8" />
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">合同总额</div>
            <div class="text-heading-xl font-bold">{{ contractTotalText }}</div>
          </div>
        </div>

        <!-- Card 2 -->
        <div
          class="bg-foundation p-6 rounded-lg border border-outline-3 flex items-center gap-4"
        >
          <div class="p-3 rounded-lg bg-success-lighter text-success">
            <CheckCircleIcon class="w-8 h-8" />
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">已完成金额</div>
            <div class="text-heading-xl font-bold">{{ completedTotalText }}</div>
          </div>
        </div>

        <!-- Card 3 -->
        <div
          class="bg-foundation p-6 rounded-lg border border-outline-3 flex items-center gap-4"
        >
          <div class="p-3 rounded-lg bg-info-lighter text-info">
            <ChartBarIcon class="w-8 h-8" />
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">本月验工</div>
            <div class="text-heading-xl font-bold">{{ currentMonthTotalText }}</div>
          </div>
        </div>

        <!-- Card 4 -->
        <div
          class="bg-foundation p-6 rounded-lg border border-outline-3 flex items-center gap-4"
        >
          <div class="p-3 rounded-lg bg-warning-lighter text-warning">
            <ClockIcon class="w-8 h-8" />
          </div>
          <div>
            <div class="text-body-xs text-foreground-2">待审核</div>
            <div class="text-heading-xl font-bold">{{ pendingTotalText }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Details Section -->
    <div class="bg-foundation rounded-lg border border-outline-3 p-6">
      <h2 class="text-heading-md mb-4">项目验工详情</h2>
      <LayoutTable
        :columns="columns"
        :items="projects"
        :buttons="[]"
        empty-message="暂无项目数据"
      >
        <template #name="{ item }">
          <span class="font-medium text-foreground">{{ item.name }}</span>
        </template>

        <template #contractAmount="{ item }">
          <span>{{ item.contractAmount }}</span>
        </template>

        <template #completedAmount="{ item }">
          <span>{{ item.completedAmount }}</span>
        </template>

        <template #rate="{ item }">
          <div class="flex items-center gap-2 w-full pr-4">
            <div class="flex-grow h-2 bg-outline-3 rounded-full overflow-hidden">
              <div
                class="h-full bg-primary rounded-full"
                :style="{ width: `${item.rate}%` }"
              ></div>
            </div>
            <span class="text-body-xs w-10 text-right">{{ item.rate }}%</span>
          </div>
        </template>

        <template #monthValuation="{ item }">
          <span>{{ item.monthValuation }}</span>
        </template>

        <template #status="{ item }">
          <CommonBadge :color-classes="getStatusClasses(item.status)" rounded>
            {{ item.status }}
          </CommonBadge>
        </template>

        <template #action>
          <button
            class="text-primary hover:text-primary-focus text-body-xs font-medium cursor-pointer"
          >
            查看详情
          </button>
        </template>
      </LayoutTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CurrencyDollarIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ClockIcon
} from '@heroicons/vue/24/outline'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

// Types
type ProjectStatus = '已审核' | '审核中' | '待提交'

interface Project {
  id: string
  name: string
  contractAmount: string
  completedAmount: string
  rate: number
  monthValuation: string
  status: ProjectStatus
}

type CostSummaryItem = {
  projectId: string
  projectName: string | null
  totalContractAmount: number
  completedAmount: number
  currentMonthCompletedAmount: number
  completionRate: number
}

type CostSummaryPage = {
  items: CostSummaryItem[]
  cursor: string | null
  limit: number
}

type CostSummaryStats = {
  projectCount: number
  totalContractAmount: number
  completedAmount: number
  currentMonthCompletedAmount: number
  pendingAmount: number
}

const summaryItems = ref<CostSummaryItem[]>([])
const summaryStats = ref<CostSummaryStats>({
  projectCount: 0,
  totalContractAmount: 0,
  completedAmount: 0,
  currentMonthCompletedAmount: 0,
  pendingAmount: 0
})
const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const formatAmount = (amount: number) => {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(2)}亿`
  if (amount >= 10000) return `${(amount / 10000).toFixed(0)}万`
  return `${amount.toFixed(2)}元`
}

const toProjectStatus = (item: CostSummaryItem): ProjectStatus => {
  if (item.completedAmount <= 0) return '待提交'
  if (item.completionRate >= 1) return '已审核'
  return '审核中'
}

const projects = computed<Project[]>(() =>
  summaryItems.value.map((item) => ({
    id: item.projectId,
    name: item.projectName || item.projectId,
    contractAmount: formatAmount(item.totalContractAmount),
    completedAmount: formatAmount(item.completedAmount),
    rate: Math.min(100, Math.max(0, Math.round(item.completionRate * 100))),
    monthValuation: formatAmount(item.currentMonthCompletedAmount),
    status: toProjectStatus(item)
  }))
)

const contractTotalText = computed(() => formatAmount(summaryStats.value.totalContractAmount))
const completedTotalText = computed(() => formatAmount(summaryStats.value.completedAmount))
const currentMonthTotalText = computed(() =>
  formatAmount(summaryStats.value.currentMonthCompletedAmount)
)
const pendingTotalText = computed(() => formatAmount(summaryStats.value.pendingAmount))

const loadProjectCostSummaries = async () => {
  const allItems: CostSummaryItem[] = []
  let cursor: string | null = null

  do {
    const params = new URLSearchParams({ limit: '100' })
    if (cursor) params.set('cursor', cursor)

    const page = await $fetch<CostSummaryPage>(`${apiOrigin}/api/stream/cost-summary`, {
      query: Object.fromEntries(params.entries())
    })
    allItems.push(...(page.items || []))
    cursor = page.cursor || null
  } while (cursor)

  summaryItems.value = allItems
}

const loadProjectCostSummaryStats = async () => {
  const stats = await $fetch<CostSummaryStats>(`${apiOrigin}/api/stream/cost-summary/stats`)
  summaryStats.value = {
    projectCount: stats.projectCount || 0,
    totalContractAmount: stats.totalContractAmount || 0,
    completedAmount: stats.completedAmount || 0,
    currentMonthCompletedAmount: stats.currentMonthCompletedAmount || 0,
    pendingAmount: stats.pendingAmount || 0
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadProjectCostSummaries(), loadProjectCostSummaryStats()])
  } catch {
    summaryItems.value = []
    summaryStats.value = {
      projectCount: 0,
      totalContractAmount: 0,
      completedAmount: 0,
      currentMonthCompletedAmount: 0,
      pendingAmount: 0
    }
    triggerNotification({
      title: '加载失败',
      type: ToastNotificationType.Danger,
      description: '验工计价数据获取失败，请稍后重试。'
    })
  }
})

const columns = [
  { id: 'name', header: '项目名称', classes: 'col-span-3' },
  { id: 'contractAmount', header: '合同总额', classes: 'col-span-2' },
  { id: 'completedAmount', header: '已完成金额', classes: 'col-span-2' },
  { id: 'rate', header: '完成率', classes: 'col-span-3' },
  { id: 'monthValuation', header: '本月验工', classes: 'col-span-1' },
  { id: 'action', header: '操作', classes: 'col-span-1' }
]

const getStatusClasses = (status: ProjectStatus) => {
  switch (status) {
    case '已审核':
      return 'bg-success-lighter text-success-darker'
    case '审核中':
      return 'bg-primary-muted text-primary'
    case '待提交':
      return 'bg-warning-lighter text-warning-darker'
    default:
      return 'bg-foundation-2 text-foreground-2'
  }
}
</script>
