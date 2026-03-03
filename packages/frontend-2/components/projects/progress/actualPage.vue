<template>
  <div class="flex flex-col h-full text-foreground">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-heading-lg text-foreground mt-3 mb-4">实际进度</h1>

      <div class="flex items-center gap-4">
        <div class="relative">
          <FormTextInput
            v-model="searchQuery"
            name="search"
            placeholder="搜索任务"
            :custom-icon="MagnifyingGlassIcon"
            color="foundation"
            class="w-64"
          />
        </div>
        <FormButton
          color="primary"
          class="flex items-center gap-2"
          @click="handleCreate"
        >
          <PlusIcon class="h-4 w-4" />
          新增
        </FormButton>
      </div>
    </div>

    <!-- Table -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <LayoutTable
        :columns="columns"
        :items="paginatedItems"
        :buttons="[]"
        class="flex-1"
      >
        <template #name="{ item }">
          <div class="font-medium text-foreground">{{ item.name }}</div>
        </template>

        <template #planStart="{ item }">
          <div class="text-foreground">{{ item.planStart }}</div>
        </template>

        <template #planEnd="{ item }">
          <div class="text-foreground">{{ item.planEnd }}</div>
        </template>

        <template #reportDate="{ item }">
          <div class="text-foreground">{{ item.reportDate }}</div>
        </template>

        <template #progress="{ item }">
          <div class="font-bold text-primary">{{ item.progress }}%</div>
        </template>

        <template #actualEnd="{ item }">
          <div class="text-foreground">{{ item.actualEnd }}</div>
        </template>

        <template #reporter="{ item }">
          <div class="text-foreground">{{ item.reporter }}</div>
        </template>

        <template #status="{ item }">
          <div
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="
              item.status === 'linked'
                ? 'bg-success-lighter text-success-darker'
                : 'bg-neutral-light text-foreground-2'
            "
          >
            {{ item.status === 'linked' ? '已关联BIM模型' : '未关联' }}
          </div>
        </template>

        <template #actions="{ item }">
          <div class="flex items-center justify-end gap-2">
            <button
              class="p-1 text-primary hover:text-primary-focus transition-colors"
              title="查看"
            >
              <EyeIcon class="h-4 w-4" />
            </button>
            <button
              class="p-1 text-warning hover:text-warning-focus transition-colors"
              title="编辑"
            >
              <PencilSquareIcon class="h-4 w-4" />
            </button>
            <button
              class="p-1 text-foreground hover:text-foreground-2 transition-colors"
              title="关联"
            >
              <LinkIcon class="h-4 w-4" />
            </button>
            <button
              class="p-1 text-danger hover:text-danger-focus transition-colors"
              title="删除"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </template>
      </LayoutTable>
    </div>

    <!-- Pagination -->
    <div
      class="px-4 py-4 border-t border-outline-3 flex items-center justify-between bg-foundation"
    >
      <div class="flex items-center gap-4 text-sm text-foreground-2">
        <div class="flex items-center gap-2">
          <span>每页显示</span>
          <select
            v-model="itemsPerPage"
            class="bg-foundation-2 border border-outline-3 rounded px-2 py-1 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          <span>条</span>
        </div>
        <div>共 {{ totalItems }} 条，第 {{ startItemIndex }}-{{ endItemIndex }} 条</div>
      </div>

      <div class="flex items-center gap-2">
        <button
          :disabled="currentPage === 1"
          class="p-1 rounded hover:bg-foundation-2 disabled:opacity-50 disabled:hover:bg-transparent"
          @click="currentPage > 1 && currentPage--"
        >
          <ChevronLeftIcon class="h-5 w-5 text-foreground-2" />
        </button>

        <button
          v-for="page in totalPages"
          :key="page"
          class="px-3 py-1 rounded text-sm transition-colors"
          :class="
            currentPage === page
              ? 'bg-primary text-white'
              : 'hover:bg-foundation-2 text-foreground'
          "
          @click="currentPage = page"
        >
          {{ page }}
        </button>

        <button
          :disabled="currentPage === totalPages"
          class="p-1 rounded hover:bg-foundation-2 disabled:opacity-50 disabled:hover:bg-transparent"
          @click="currentPage < totalPages && currentPage++"
        >
          <ChevronRightIcon class="h-5 w-5 text-foreground-2" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  PencilSquareIcon,
  LinkIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline'

// Mock Data
const generateMockData = () => {
  const data = []
  const statuses = ['linked', 'unlinked']
  const reporters = ['张三', '李四', '王五', '赵六']
  const tasks = [
    '基础施工',
    '主体施工',
    '路基土方开挖',
    '路基填筑压实',
    '路基边坡防护',
    '水稳碎石基层',
    '沥青混凝土面层',
    '桥梁桩基施工',
    '墩柱施工',
    '盖梁施工'
  ]

  for (let i = 1; i <= 25; i++) {
    const taskIndex = (i - 1) % tasks.length
    data.push({
      id: i,
      name: tasks[taskIndex] + (i > 10 ? ` ${i}` : ''),
      planStart: `2025-0${(i % 5) + 1}-01`,
      planEnd: `2025-0${(i % 5) + 3}-30`,
      reportDate: `2025-0${(i % 5) + 2}-15`,
      progress: Math.floor(Math.random() * 100),
      actualEnd: i % 3 === 0 ? `2025-0${(i % 5) + 3}-28` : '-',
      reporter: reporters[i % reporters.length],
      status: i % 3 === 1 ? 'unlinked' : 'linked'
    })
  }
  return data
}

const allItems = ref(generateMockData())
const searchQuery = ref('')
const itemsPerPage = ref(20)
const currentPage = ref(1)

// Columns Configuration
const columns = [
  { id: 'name', header: '任务名称', classes: 'col-span-2' },
  { id: 'planStart', header: '计划开始', classes: 'col-span-1' },
  { id: 'planEnd', header: '计划完成', classes: 'col-span-1' },
  { id: 'reportDate', header: '填报日期', classes: 'col-span-1' },
  { id: 'progress', header: '完成进度', classes: 'col-span-1' },
  { id: 'actualEnd', header: '实际完成', classes: 'col-span-1' },
  { id: 'reporter', header: '填报人', classes: 'col-span-1' },
  { id: 'status', header: '关联状态', classes: 'col-span-2' },
  { id: 'actions', header: '操作', classes: 'col-span-2 text-right' }
]

// Computed Properties for Pagination and Filtering
const filteredItems = computed(() => {
  if (!searchQuery.value) return allItems.value
  return allItems.value.filter(
    (item) =>
      item.name.includes(searchQuery.value) || item.reporter.includes(searchQuery.value)
  )
})

const totalItems = computed(() => filteredItems.value.length)
const totalPages = computed(() => Math.ceil(totalItems.value / itemsPerPage.value))

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredItems.value.slice(start, end)
})

const startItemIndex = computed(() =>
  totalItems.value === 0 ? 0 : (currentPage.value - 1) * itemsPerPage.value + 1
)
const endItemIndex = computed(() =>
  Math.min(currentPage.value * itemsPerPage.value, totalItems.value)
)

// Handlers
const handleCreate = () => {
  console.log('Create new item')
}
</script>
