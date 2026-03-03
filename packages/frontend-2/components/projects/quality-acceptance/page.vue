<template>
  <div>
    <div class="flex flex-col gap-4 h-full">
      <!-- Title and Controls -->
      <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <h1 class="text-heading-lg text-foreground mt-3">质量验收</h1>
        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div class="flex gap-2 w-full sm:w-auto">
            <FormTextInput
              v-model="searchQuery"
              name="search"
              placeholder="搜索验收单"
              :show-label="false"
              class="w-full sm:w-64"
            />
            <FormButton :icon-left="MagnifyingGlassIcon" color="outline" hide-text />
          </div>
          <FormButton color="primary" :icon-left="PlusIcon" @click="onAdd">
            新增
          </FormButton>
        </div>
      </div>

      <!-- Table -->
      <div
        class="bg-foundation rounded-lg border border-outline-3 flex flex-col flex-grow overflow-hidden"
      >
        <LayoutTable
          :columns="columns"
          :items="paginatedItems"
          :buttons="tableButtons"
          empty-message="暂无验收单"
          class="flex-grow"
        >
          <template #inspectionLotNumber="{ item }">
            <a
              href="#"
              class="text-primary hover:underline font-medium"
              @click.prevent="viewDetails(item)"
            >
              {{ item.inspectionLotNumber }}
            </a>
          </template>

          <template #status="{ item }">
            <CommonBadge :color-classes="getStatusColor(item.status)" rounded>
              {{ item.status }}
            </CommonBadge>
          </template>

          <template #associationStatus="{ item }">
            <CommonBadge
              :color-classes="getAssociationStatusColor(item.associationStatus)"
              rounded
            >
              {{ item.associationStatus }}
            </CommonBadge>
          </template>
        </LayoutTable>

        <!-- Pagination -->
        <div
          class="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-outline-3 gap-4 text-sm text-foreground-2"
        >
          <div class="flex items-center gap-2">
            <span>每页显示</span>
            <select
              v-model="pageSize"
              class="bg-foundation border border-outline-3 rounded px-2 py-1 focus:outline-none focus:border-primary"
            >
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
            <span>条</span>
            <span class="ml-2">
              共 {{ filteredItems.length }} 条，第 {{ startItemIndex }}-{{
                endItemIndex
              }}
              条
            </span>
          </div>

          <div class="flex items-center gap-1">
            <button
              class="px-2 py-1 rounded hover:bg-highlight-1 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              &lt; 上一页
            </button>

            <button
              v-for="page in displayedPages"
              :key="page"
              class="w-8 h-8 rounded flex items-center justify-center"
              :class="
                currentPage === page
                  ? 'bg-primary text-foreground-on-primary'
                  : 'hover:bg-highlight-1'
              "
              @click="currentPage = page"
            >
              {{ page }}
            </button>

            <button
              class="px-2 py-1 rounded hover:bg-highlight-1 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              下一页 &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  LinkIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'
import { ref, computed } from 'vue'

// Mock Data Type
interface AcceptanceItem {
  id: string
  name: string
  inspectionLotNumber: string
  date: string
  acceptor: string
  status: '已通过' | '待验收' | '整改中'
  associationStatus: '已关联' | '未关联'
}

// Columns Configuration
const columns = [
  { id: 'name', header: '验收单名称', classes: 'col-span-3 font-medium' },
  { id: 'inspectionLotNumber', header: '检验批编号', classes: 'col-span-2' },
  { id: 'date', header: '验收日期', classes: 'col-span-2' },
  { id: 'acceptor', header: '验收人', classes: 'col-span-1' },
  { id: 'status', header: '状态', classes: 'col-span-1' },
  { id: 'associationStatus', header: '关联状态', classes: 'col-span-1' }
]

// Mock Data Generation
const mockData: AcceptanceItem[] = [
  {
    id: '1',
    name: '路基土方开挖质量验收',
    inspectionLotNumber: 'JYP-RJ-001',
    date: '2025-01-05',
    acceptor: '张三',
    status: '已通过',
    associationStatus: '已关联'
  },
  {
    id: '2',
    name: '路基填筑压实质量验收',
    inspectionLotNumber: 'JYP-RJ-002',
    date: '2025-03-15',
    acceptor: '李四',
    status: '已通过',
    associationStatus: '已关联'
  },
  {
    id: '3',
    name: '路基边坡防护质量验收',
    inspectionLotNumber: 'JYP-RJ-003',
    date: '2025-06-20',
    acceptor: '王五',
    status: '待验收',
    associationStatus: '未关联'
  },
  {
    id: '4',
    name: 'K5+000段路基土方开挖验收',
    inspectionLotNumber: 'JYP-RJ-004',
    date: '2025-07-10',
    acceptor: '赵六',
    status: '已通过',
    associationStatus: '已关联'
  },
  {
    id: '5',
    name: 'K5+000段路基填筑验收',
    inspectionLotNumber: 'JYP-RJ-005',
    date: '2025-09-20',
    acceptor: '张三',
    status: '整改中',
    associationStatus: '未关联'
  },
  {
    id: '6',
    name: 'K5+000段边坡防护验收',
    inspectionLotNumber: 'JYP-RJ-006',
    date: '2025-12-15',
    acceptor: '李四',
    status: '待验收',
    associationStatus: '未关联'
  },
  {
    id: '7',
    name: '水稳碎石基层铺筑验收',
    inspectionLotNumber: 'JYP-LM-001',
    date: '2026-02-18',
    acceptor: '王五',
    status: '已通过',
    associationStatus: '已关联'
  },
  {
    id: '8',
    name: '基层质量检测验收',
    inspectionLotNumber: 'JYP-LM-002',
    date: '2026-04-05',
    acceptor: '赵六',
    status: '已通过',
    associationStatus: '未关联'
  },
  {
    id: '9',
    name: '基层养护验收',
    inspectionLotNumber: 'JYP-LM-003',
    date: '2026-04-25',
    acceptor: '张三',
    status: '已通过',
    associationStatus: '未关联'
  },
  // Generate more mock data for pagination
  ...Array.from({ length: 16 }).map((_, i) => ({
    id: `${10 + i}`,
    name: `示例验收单项 ${10 + i}`,
    inspectionLotNumber: `JYP-EX-${100 + i}`,
    date: '2026-05-01',
    acceptor: ['张三', '李四', '王五'][i % 3],
    status: ['已通过', '待验收', '整改中'][i % 3] as any,
    associationStatus: ['已关联', '未关联'][i % 2] as any
  }))
]

// State
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

// Computed Properties
const filteredItems = computed(() => {
  if (!searchQuery.value) return mockData
  const query = searchQuery.value.toLowerCase()
  return mockData.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      item.inspectionLotNumber.toLowerCase().includes(query)
  )
})

const totalPages = computed(() =>
  Math.ceil(filteredItems.value.length / pageSize.value)
)

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredItems.value.slice(start, end)
})

const startItemIndex = computed(() =>
  filteredItems.value.length === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1
)
const endItemIndex = computed(() =>
  Math.min(currentPage.value * pageSize.value, filteredItems.value.length)
)

const displayedPages = computed(() => {
  const pages = []
  const maxPagesToShow = 5
  let startPage = Math.max(1, currentPage.value - Math.floor(maxPagesToShow / 2))
  const endPage = Math.min(totalPages.value, startPage + maxPagesToShow - 1)

  if (endPage - startPage + 1 < maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1)
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }
  return pages
})

// Table Actions
const tableButtons = [
  {
    icon: EyeIcon,
    label: '查看',
    action: (item: AcceptanceItem) => console.log('View', item),
    class: 'text-primary'
  },
  {
    icon: LinkIcon,
    label: '关联',
    action: (item: AcceptanceItem) => console.log('Link', item),
    class: 'text-primary'
  },
  {
    icon: PencilIcon,
    label: '编辑',
    action: (item: AcceptanceItem) => console.log('Edit', item),
    class: 'text-warning' // Orange/Yellowish
  },
  {
    icon: TrashIcon,
    label: '删除',
    action: (item: AcceptanceItem) => console.log('Delete', item),
    class: 'text-danger'
  }
]

// Methods
const onAdd = () => {
  console.log('Add new item')
}

const viewDetails = (item: AcceptanceItem) => {
  console.log('View details', item)
}

const getStatusColor = (status: string) => {
  switch (status) {
    case '已通过':
      return 'bg-success-lighter text-success'
    case '待验收':
      return 'bg-primary-lighter text-primary'
    case '整改中':
      return 'bg-warning-lighter text-warning'
    default:
      return 'bg-foundation text-foreground-2'
  }
}

const getAssociationStatusColor = (status: string) => {
  switch (status) {
    case '已关联':
      return 'bg-success-lighter text-success'
    case '未关联':
      return 'bg-foundation-3 text-foreground-2' // Grayish
    default:
      return 'bg-foundation text-foreground-2'
  }
}
</script>
