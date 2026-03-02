<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center gap-2">
      <IconCalculator class="h-5 w-5" />
      <h1 class="text-heading-lg">质量验收总览</h1>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div
        v-for="(stat, index) in stats"
        :key="index"
        class="bg-foundation p-6 rounded-lg shadow-sm border border-outline-3 flex items-center gap-4"
      >
        <!-- Icon -->
        <div
          :class="[
            'p-3 rounded-full flex items-center justify-center shrink-0',
            stat.bg
          ]"
        >
          <component :is="stat.icon" :class="['w-8 h-8', stat.color]" />
        </div>
        <!-- Text -->
        <div class="flex flex-col">
          <p class="text-body-xs text-foreground-2">{{ stat.label }}</p>
          <p class="text-heading-xl font-bold text-foreground">{{ stat.value }}</p>
        </div>
      </div>
    </div>

    <!-- Table Section -->
    <div class="flex flex-col gap-4">
      <h2 class="text-xl font-bold text-foreground">项目质量详情</h2>
      <div class="bg-foundation rounded-lg border border-outline-3 overflow-hidden">
        <LayoutTable :columns="columns" :items="projects" :buttons="[]">
          <template #name="{ item }">
            <span class="font-medium text-foreground">{{ item.name }}</span>
          </template>
          <template #total="{ item }">
            <span class="text-foreground">{{ item.total }}</span>
          </template>
          <template #qualified="{ item }">
            <span class="text-success font-bold">{{ item.qualified }}</span>
          </template>
          <template #unqualified="{ item }">
            <span class="text-danger font-bold">{{ item.unqualified }}</span>
          </template>
          <template #pending="{ item }">
            <span class="text-warning font-bold">{{ item.pending }}</span>
          </template>
          <template #rate="{ item }">
            <span class="text-primary font-bold">{{ item.rate }}</span>
          </template>
          <template #action="{ item }">
            <button
              class="text-primary hover:underline font-medium text-sm"
              @click="viewDetails(item)"
            >
              查看详情
            </button>
          </template>
        </LayoutTable>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/vue/24/outline'

// Mock Data for Stats Cards
const stats = [
  {
    label: '验收总数',
    value: 145,
    icon: ClipboardDocumentCheckIcon,
    color: 'text-primary',
    bg: 'bg-primary-muted'
  },
  {
    label: '合格数',
    value: 127,
    icon: CheckCircleIcon,
    color: 'text-success',
    bg: 'bg-success-lighter'
  },
  {
    label: '不合格数',
    value: 6,
    icon: XCircleIcon,
    color: 'text-danger',
    bg: 'bg-danger-lighter'
  },
  {
    label: '待验收',
    value: 12,
    icon: ClockIcon,
    color: 'text-warning',
    bg: 'bg-warning-lighter'
  }
]

// Mock Data for Table
const projects = [
  {
    id: 1,
    name: '南北高速公路工程',
    total: 45,
    qualified: 38,
    unqualified: 3,
    pending: 4,
    rate: '84%'
  },
  {
    id: 2,
    name: '城市地铁3号线工程',
    total: 32,
    qualified: 28,
    unqualified: 1,
    pending: 3,
    rate: '88%'
  },
  {
    id: 3,
    name: '跨江大桥建设工程',
    total: 56,
    qualified: 52,
    unqualified: 2,
    pending: 2,
    rate: '93%'
  },
  {
    id: 4,
    name: '产业园区基础设施工程',
    total: 12,
    qualified: 9,
    unqualified: 0,
    pending: 3,
    rate: '75%'
  }
]

// Table Columns Configuration
const columns = [
  { id: 'name', header: '项目名称', classes: 'col-span-4' },
  { id: 'total', header: '验收总数', classes: 'col-span-2' },
  { id: 'qualified', header: '合格数', classes: 'col-span-1' },
  { id: 'unqualified', header: '不合格数', classes: 'col-span-2' },
  { id: 'pending', header: '待验收', classes: 'col-span-1' },
  { id: 'rate', header: '合格率', classes: 'col-span-1' },
  { id: 'action', header: '操作', classes: 'col-span-1' }
]

const viewDetails = (item: any) => {
  console.log('View details for', item.name)
}
</script>
