<template>
  <div class="h-full">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-6">
      <IconFile class="h-5 w-5" />
      <h1 class="text-heading-lg">档案管理</h1>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <div
        v-for="(stat, index) in stats"
        :key="index"
        class="bg-white p-6 rounded-lg shadow-sm border border-outline-3 flex items-center gap-5"
      >
        <div
          :class="[
            'p-3 rounded-xl flex items-center justify-center',
            stat.iconBg,
            stat.color
          ]"
        >
          <component :is="stat.icon" class="w-8 h-8" stroke-width="1.5" />
        </div>
        <div class="flex flex-col">
          <span class="text-sm text-gray-500 font-medium mb-1">{{ stat.label }}</span>
          <span class="text-3xl font-bold text-gray-900">{{ stat.value }}</span>
        </div>
      </div>
    </div>

    <!-- Project List -->
    <div class="bg-white rounded-lg shadow-sm border border-outline-3">
      <div class="p-6 border-b border-outline-3">
        <h2 class="text-lg font-bold text-gray-900">项目档案详情</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50/50 text-slate-500">
            <tr>
              <th class="px-6 py-4 font-medium w-1/4">项目名称</th>
              <th class="px-6 py-4 font-medium text-center">档案总数</th>
              <th class="px-6 py-4 font-medium text-center">完整档案</th>
              <th class="px-6 py-4 font-medium text-center">待完善</th>
              <th class="px-6 py-4 font-medium text-center">检查中</th>
              <th class="px-6 py-4 font-medium text-center">完整率</th>
              <th class="px-6 py-4 font-medium text-center">最近检查</th>
              <th class="px-6 py-4 font-medium text-center">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="(project, index) in projects"
              :key="index"
              class="hover:bg-gray-50/50 transition-colors"
            >
              <td class="px-6 py-5 font-medium text-gray-900">{{ project.name }}</td>
              <td class="px-6 py-5 text-gray-900 text-center">{{ project.total }}</td>
              <td class="px-6 py-5 text-green-600 font-bold text-center">
                {{ project.complete }}
              </td>
              <td class="px-6 py-5 text-orange-500 font-bold text-center">
                {{ project.improvement }}
              </td>
              <td class="px-6 py-5 text-purple-600 font-bold text-center">
                {{ project.review }}
              </td>
              <td class="px-6 py-5 text-center">
                <span :class="['font-bold', getRateColor(project.rate)]">
                  {{ project.rate }}%
                </span>
              </td>
              <td class="px-6 py-5 text-gray-500 text-center">
                {{ project.lastChecked }}
              </td>
              <td class="px-6 py-5 text-center">
                <button class="text-blue-600 hover:text-blue-800 font-bold text-sm">
                  查看详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IconFile } from '#components'
import { Package, CheckCircle, AlertTriangle, FileText } from 'lucide-vue-next'

const stats = [
  {
    label: '档案总数',
    value: 835,
    icon: Package,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100'
  },
  {
    label: '完整档案',
    value: 677,
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    iconBg: 'bg-green-100'
  },
  {
    label: '待完善',
    value: 117,
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100'
  },
  {
    label: '检查中',
    value: 41,
    icon: FileText,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-100'
  }
]

const projects = [
  {
    name: '南北高速公路工程',
    total: 256,
    complete: 198,
    improvement: 42,
    review: 16,
    rate: 77,
    lastChecked: '2025-02-20'
  },
  {
    name: '城市地铁3号线工程',
    total: 189,
    complete: 145,
    improvement: 32,
    review: 12,
    rate: 77,
    lastChecked: '2025-02-22'
  },
  {
    name: '跨江大桥建设工程',
    total: 312,
    complete: 289,
    improvement: 15,
    review: 8,
    rate: 93,
    lastChecked: '2025-02-23'
  },
  {
    name: '产业园区基础设施工程',
    total: 78,
    complete: 45,
    improvement: 28,
    review: 5,
    rate: 58,
    lastChecked: '2025-02-18'
  }
]

const getRateColor = (rate: number) => {
  if (rate >= 90) return 'text-green-600'
  if (rate >= 70) return 'text-blue-600'
  return 'text-red-500'
}
</script>
