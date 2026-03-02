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
            <div class="text-heading-xl font-bold">16.3亿</div>
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
            <div class="text-heading-xl font-bold">8.9亿</div>
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
            <div class="text-heading-xl font-bold">4000万</div>
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
            <div class="text-heading-xl font-bold">1200万</div>
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

// Mock Data
const projects = ref<Project[]>([
  {
    id: '1',
    name: '南北高速公路工程',
    contractAmount: '4.50亿',
    completedAmount: '3.06亿',
    rate: 68,
    monthValuation: '1500万',
    status: '已审核'
  },
  {
    id: '2',
    name: '城市地铁3号线工程',
    contractAmount: '6.80亿',
    completedAmount: '2.86亿',
    rate: 42,
    monthValuation: '1200万',
    status: '审核中'
  },
  {
    id: '3',
    name: '跨江大桥建设工程',
    contractAmount: '3.20亿',
    completedAmount: '2.72亿',
    rate: 85,
    monthValuation: '800万',
    status: '已审核'
  },
  {
    id: '4',
    name: '产业园区基础设施工程',
    contractAmount: '1.80亿',
    completedAmount: '2700万',
    rate: 15,
    monthValuation: '500万',
    status: '待提交'
  }
])

const columns = [
  { id: 'name', header: '项目名称', classes: 'col-span-3' },
  { id: 'contractAmount', header: '合同总额', classes: 'col-span-2' },
  { id: 'completedAmount', header: '已完成金额', classes: 'col-span-2' },
  { id: 'rate', header: '完成率', classes: 'col-span-3' },
  { id: 'monthValuation', header: '本月验工', classes: 'col-span-1' },
  { id: 'status', header: '状态', classes: 'col-span-1' },
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
