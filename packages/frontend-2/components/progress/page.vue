<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-6">
      <IconProgress class="h-5 w-5" />
      <h1 class="text-heading-lg">进度管理</h1>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div
        v-for="(card, index) in summaryCards"
        :key="index"
        class="border border-outline-3 rounded-xl p-6 flex items-center shadow-sm"
      >
        <div
          class="p-4 rounded-xl mr-4 flex items-center justify-center"
          :class="card.iconBgClass"
        >
          <component :is="card.icon" class="w-8 h-8" :class="card.iconColorClass" />
        </div>
        <div>
          <div class="text-body-sm text-foreground-2 mb-1">{{ card.label }}</div>
          <div class="text-heading-lg font-bold text-foreground">
            {{ card.value }}
          </div>
        </div>
      </div>
    </div>

    <!-- Project Progress Details -->
    <div class="border border-outline-3 rounded-xl p-6">
      <h2 class="text-heading-md font-bold text-foreground mb-6">项目进度详情</h2>

      <LayoutTable
        :columns="tableColumns"
        :items="projectList"
        empty-message="暂无项目数据"
      >
        <!-- Project Name -->
        <template #name="{ item }">
          <span class="font-medium text-foreground">{{ item.name }}</span>
        </template>

        <!-- Overall Progress -->
        <template #progress="{ item }">
          <div class="flex items-center gap-3 w-full max-w-[300px]">
            <div class="flex-grow h-2 bg-foundation-3 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full"
                :class="getProgressColor(item.progress)"
                :style="{ width: `${item.progress}%` }"
              ></div>
            </div>
            <span class="text-body-sm font-medium text-foreground">
              {{ item.progress }}%
            </span>
          </div>
        </template>

        <!-- Status -->
        <template #status="{ item }">
          <div
            class="inline-flex items-center px-2.5 py-0.5 rounded text-body-xs font-medium"
            :class="
              item.status === 'normal'
                ? 'bg-success-lighter text-success-darker'
                : 'bg-danger-lighter text-danger-darker'
            "
          >
            {{ item.status === 'normal' ? '正常' : '延期' }}
          </div>
        </template>

        <!-- Delayed Days -->
        <template #delayedDays="{ item }">
          <span :class="item.delayedDays !== '-' ? 'text-danger' : 'text-foreground'">
            {{ item.delayedDays }}
          </span>
        </template>

        <!-- On-time Tasks -->
        <template #onTimeTasks="{ item }">
          <span class="text-foreground">{{ item.onTimeTasks }}</span>
        </template>

        <!-- Delayed Tasks -->
        <template #delayedTasks="{ item }">
          <span :class="item.delayedTasks > 0 ? 'text-danger' : 'text-foreground'">
            {{ item.delayedTasks }}
          </span>
        </template>

        <!-- Actions -->
        <template #actions>
          <button
            class="text-primary hover:text-primary-focus font-medium text-body-sm hover:underline"
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
  DocumentDuplicateIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/vue/24/outline'

// Mock Data for Summary Cards
const summaryCards = [
  {
    label: '项目总数',
    value: '4',
    icon: DocumentDuplicateIcon,
    iconBgClass: 'bg-primary-muted',
    iconColorClass: 'text-primary'
  },
  {
    label: '平均进度',
    value: '52.5%',
    icon: ChartBarIcon,
    iconBgClass: 'bg-success-lighter',
    iconColorClass: 'text-success'
  },
  {
    label: '正常项目',
    value: '3',
    icon: CheckCircleIcon,
    iconBgClass: 'bg-success-lighter',
    iconColorClass: 'text-success'
  },
  {
    label: '延期项目',
    value: '1',
    icon: ExclamationCircleIcon,
    iconBgClass: 'bg-danger-lighter',
    iconColorClass: 'text-danger'
  }
]

// Mock Data for Project List
interface Project {
  id: string
  name: string
  progress: number
  status: string
  delayedDays: string
  onTimeTasks: number
  delayedTasks: number
}

const projectList: Project[] = [
  {
    id: '1',
    name: '南北高速公路工程',
    progress: 68,
    status: 'normal',
    delayedDays: '-',
    onTimeTasks: 15,
    delayedTasks: 2
  },
  {
    id: '2',
    name: '城市地铁3号线工程',
    progress: 42,
    status: 'normal',
    delayedDays: '-',
    onTimeTasks: 12,
    delayedTasks: 1
  },
  {
    id: '3',
    name: '跨江大桥建设工程',
    progress: 85,
    status: 'delayed',
    delayedDays: '5 天',
    onTimeTasks: 8,
    delayedTasks: 3
  },
  {
    id: '4',
    name: '产业园区基础设施工程',
    progress: 15,
    status: 'normal',
    delayedDays: '-',
    onTimeTasks: 5,
    delayedTasks: 0
  }
]

// Table Columns Configuration
const tableColumns = [
  { id: 'name', header: '项目名称', classes: 'col-span-3' },
  { id: 'progress', header: '总体进度', classes: 'col-span-4' },
  { id: 'status', header: '状态', classes: 'col-span-1' },
  { id: 'delayedDays', header: '延期天数', classes: 'col-span-1' },
  { id: 'onTimeTasks', header: '按时任务', classes: 'col-span-1' },
  { id: 'delayedTasks', header: '延期任务', classes: 'col-span-1' },
  { id: 'actions', header: '操作', classes: 'col-span-1 text-right' }
]

// Helper function for progress bar color
const getProgressColor = (progress: number) => {
  if (progress < 30) return 'bg-danger'
  if (progress < 60) return 'bg-warning'
  return 'bg-primary' // Using primary blue as per image
}
</script>
