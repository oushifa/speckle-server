<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-heading-lg text-foreground mt-3">进度计划</h1>
      <div class="flex gap-3">
        <FormButton size="sm" color="primary">
          <template #icon-left>
            <ArrowPathIcon class="h-4 w-4" />
          </template>
          更新进度计划
        </FormButton>
        <FormButton
          size="sm"
          color="outline"
          class="bg-white hover:bg-gray-50 border border-outline-2"
        >
          <template #icon-left>
            <ArrowDownTrayIcon class="h-4 w-4" />
          </template>
          下载计划文件
        </FormButton>
      </div>
    </div>

    <!-- Table -->
    <div
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden"
    >
      <LayoutTable :columns="columns" :items="visibleItems" class="w-full">
        <!-- Task Name Column (Tree View) -->
        <template #taskName="{ item }">
          <div
            class="flex items-center gap-2 cursor-pointer select-none"
            :style="{ paddingLeft: `${item.level * 1.5}rem` }"
            @click="toggleExpand(item)"
          >
            <component
              :is="item.expanded ? ChevronDownIcon : ChevronRightIcon"
              v-if="item.children && item.children.length > 0"
              class="h-4 w-4 text-foreground-2 flex-shrink-0"
            />
            <span v-else class="w-4 h-4 flex-shrink-0"></span>
            <!-- Spacer -->
            <span class="truncate font-medium text-foreground text-body-sm">
              {{ item.taskName }}
            </span>
          </div>
        </template>

        <!-- Duration -->
        <template #duration="{ item }">
          <span class="text-body-sm text-foreground">{{ item.duration }}</span>
        </template>

        <!-- Dates -->
        <template #startDate="{ item }">
          <span class="text-body-sm text-foreground">{{ item.startDate }}</span>
        </template>
        <template #endDate="{ item }">
          <span class="text-body-sm text-foreground">{{ item.endDate }}</span>
        </template>

        <!-- Predecessor -->
        <template #predecessor="{ item }">
          <span class="text-body-sm text-foreground">
            {{ item.predecessor || '-' }}
          </span>
        </template>

        <!-- Inspection -->
        <template #inspection="{ item }">
          <span class="text-body-sm text-foreground">{{ item.inspection || '-' }}</span>
        </template>

        <!-- Status -->
        <template #status="{ item }">
          <div
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-nowrap"
            :class="
              item.linked
                ? 'bg-success-lighter text-success-darker'
                : 'bg-gray-100 text-gray-500'
            "
          >
            {{ item.linked ? '已关联BIM模型' : '未关联' }}
          </div>
        </template>

        <!-- Operation -->
        <template #operation>
          <button
            class="p-1 rounded hover:bg-foundation-2 text-foreground-2 transition-colors border border-outline-2 rounded-full"
          >
            <LinkIcon class="h-4 w-4" />
          </button>
        </template>
      </LayoutTable>

      <!-- Pagination -->
      <div
        class="flex items-center justify-between px-4 py-3 border-t border-outline-2"
      >
        <div class="text-body-xs text-foreground-2">
          每页显示
          <select
            class="mx-1 border-outline-2 rounded text-xs py-0.5 px-1 bg-foundation"
          >
            <option>20</option>
          </select>
          条 共9条，第1-9条
        </div>
        <div class="flex gap-2">
          <button
            class="px-3 py-1 text-xs border border-outline-2 rounded text-foreground-2 hover:bg-foundation-2"
            disabled
          >
            <ChevronLeftIcon class="h-3 w-3 inline mr-1" />
            上一页
          </button>
          <button class="px-3 py-1 text-xs bg-primary text-white rounded">1</button>
          <button
            class="px-3 py-1 text-xs border border-outline-2 rounded text-foreground-2 hover:bg-foundation-2"
          >
            下一页
            <ChevronRightIcon class="h-3 w-3 inline ml-1" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  LinkIcon,
  ChevronLeftIcon
} from '@heroicons/vue/24/outline'

// Types
interface ScheduleItem {
  id: string
  taskName: string
  duration: string
  startDate: string
  endDate: string
  predecessor?: string
  inspection?: string
  linked: boolean
  level: number
  expanded: boolean
  parentId?: string
  children?: string[] // IDs of children
}

// Columns definition
const columns = [
  { id: 'taskName', header: '任务名称', classes: 'col-span-3' },
  { id: 'duration', header: '工期', classes: 'col-span-1' },
  { id: 'startDate', header: '开始时间', classes: 'col-span-2' },
  { id: 'endDate', header: '完成时间', classes: 'col-span-2' },
  { id: 'predecessor', header: '前置任务', classes: 'col-span-1' },
  { id: 'inspection', header: '检验批', classes: 'col-span-1' },
  { id: 'status', header: '关联状态', classes: 'col-span-1' },
  { id: 'operation', header: '操作', classes: 'col-span-1 flex justify-center' }
]

// Mock Data
const rawData: ScheduleItem[] = [
  {
    id: '1',
    taskName: '南北高速公路工程总计',
    duration: '720天',
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    linked: true,
    level: 0,
    expanded: true,
    children: ['2', '5']
  },
  {
    id: '2',
    parentId: '1',
    taskName: '路基工程',
    duration: '360天',
    startDate: '2025-01-01',
    endDate: '2025-12-26',
    linked: true,
    level: 1,
    expanded: true,
    children: ['3', '4']
  },
  {
    id: '3',
    parentId: '2',
    taskName: 'K0+000~K5+000段路基施工',
    duration: '180天',
    startDate: '2025-01-01',
    endDate: '2025-06-29',
    linked: true,
    level: 2,
    expanded: false
  },
  {
    id: '4',
    parentId: '2',
    taskName: 'K5+000~K10+000段路基施工',
    duration: '180天',
    startDate: '2025-06-30',
    endDate: '2025-12-26',
    predecessor: '1-1-1',
    linked: false,
    level: 2,
    expanded: false
  },
  {
    id: '5',
    parentId: '1',
    taskName: '路面工程',
    duration: '240天',
    startDate: '2026-01-01',
    endDate: '2026-08-28',
    predecessor: '1-1',
    linked: true,
    level: 1,
    expanded: true,
    children: ['6', '7']
  },
  {
    id: '6',
    parentId: '5',
    taskName: '基层施工',
    duration: '120天',
    startDate: '2026-01-01',
    endDate: '2026-04-30',
    predecessor: '1-1',
    linked: true,
    level: 2,
    expanded: false
  },
  {
    id: '7',
    parentId: '5',
    taskName: '面层施工',
    duration: '120天',
    startDate: '2026-05-01',
    endDate: '2026-08-28',
    predecessor: '1-2-1',
    linked: false,
    level: 2,
    expanded: false
  }
]

const items = ref<ScheduleItem[]>(rawData)

// Flatten the tree for display, respecting 'expanded' state
const visibleItems = computed(() => {
  const result: ScheduleItem[] = []

  // Helper to process nodes recursively
  const processNode = (nodeId: string) => {
    const node = items.value.find((i) => i.id === nodeId)
    if (!node) return

    result.push(node)

    if (node.expanded && node.children) {
      node.children.forEach((childId) => processNode(childId))
    }
  }

  // Find root nodes (level 0 or no parent)
  const roots = items.value.filter((i) => !i.parentId)
  roots.forEach((root) => processNode(root.id))

  return result
})

const toggleExpand = (item: ScheduleItem) => {
  const index = items.value.findIndex((i) => i.id === item.id)
  if (index !== -1 && items.value[index].children?.length) {
    items.value[index].expanded = !items.value[index].expanded
  }
}
</script>
