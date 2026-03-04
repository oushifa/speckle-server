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

        <!-- Time Assistant (Right Column - Spans 1 col) -->
        <div
          class="rounded-xl bg-white p-6 shadow-sm border border-outline-3 flex flex-col h-full"
        >
          <div class="mb-6 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <CalendarDaysIcon class="h-5 w-5 text-blue-600" />
              <h2 class="text-lg font-bold text-slate-900">时间助手</h2>
            </div>
            <button
              class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              + 新建日程
            </button>
          </div>

          <!-- Today Box -->
          <div class="mb-6 rounded-lg bg-blue-50 py-6 text-center">
            <p class="text-sm font-medium text-slate-500">今天</p>
            <p class="mt-1 text-2xl font-bold text-slate-900">2月24日</p>
            <p class="text-sm text-slate-500">星期二</p>
          </div>

          <!-- Schedule List -->
          <div class="flex-1 space-y-0">
            <div class="mb-2 text-sm font-semibold text-slate-900">今日日程</div>
            <div
              v-for="schedule in scheduleList"
              :key="schedule.id"
              class="group flex items-start justify-between border-b border-slate-50 py-3 last:border-0 hover:bg-slate-50 px-2 rounded transition-colors"
            >
              <div class="flex gap-4">
                <span class="text-sm font-bold text-blue-600">{{ schedule.time }}</span>
                <div>
                  <p class="text-sm font-medium text-slate-900">{{ schedule.title }}</p>
                  <p class="text-xs text-slate-500">{{ schedule.location }}</p>
                </div>
              </div>
              <button
                class="text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              >
                <XMarkIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArchiveBoxIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  UserIcon,
  ClockIcon,
  EyeIcon,
  CalendarDaysIcon,
  XMarkIcon,
  ListBulletIcon,
  ClipboardDocumentCheckIcon,
  CalculatorIcon
} from '@heroicons/vue/24/outline'

// Mock Data
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

const scheduleList = [
  {
    id: 1,
    time: '09:00',
    title: '项目晨会',
    location: '会议室A'
  },
  {
    id: 2,
    time: '14:00',
    title: '质量检查验收',
    location: '主楼3层'
  },
  {
    id: 3,
    time: '16:30',
    title: '进度协调会',
    location: '线上会议'
  }
]
</script>
