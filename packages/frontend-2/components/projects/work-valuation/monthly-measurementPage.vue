<template>
  <div class="flex flex-col h-full space-y-4">
    <!-- Header & Actions -->
    <div class="flex justify-between items-center">
      <h1 class="text-heading-lg text-foreground mt-3">月度验工</h1>
      <div class="flex items-center space-x-2">
        <FormTextInput
          v-model="searchQuery"
          name="search"
          placeholder="搜索验工"
          show-clear
          class="w-64"
        >
          <template #input-right>
            <div
              class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"
            >
              <MagnifyingGlassIcon class="h-5 w-5 text-foreground-2" />
            </div>
          </template>
        </FormTextInput>
        <FormButton :icon-left="PlusIcon" color="primary">新增</FormButton>
      </div>
    </div>

    <!-- Table -->
    <div
      class="flex-grow overflow-hidden bg-foundation rounded-lg border border-outline-3 flex flex-col"
    >
      <LayoutTable :columns="columns" :items="paginatedItems" class="h-full">
        <template #code="{ item }">
          <button
            class="text-primary hover:underline font-medium"
            @click="viewItem(item)"
          >
            {{ item.code }}
          </button>
        </template>

        <template #unit="{ item }">
          <span class="text-foreground">{{ item.unit }}</span>
        </template>

        <template #time="{ item }">
          <span class="text-foreground">{{ item.time }}</span>
        </template>

        <template #contract="{ item }">
          <span class="text-foreground">{{ item.contract }}</span>
        </template>

        <template #status="{ item }">
          <CommonBadge :color-classes="getStatusColor(item.status)" rounded>
            {{ getStatusText(item.status) }}
          </CommonBadge>
        </template>

        <template #person="{ item }">
          <span class="text-foreground">{{ item.person || '-' }}</span>
        </template>

        <template #actions="{ item }">
          <div class="flex items-center space-x-2">
            <button
              class="text-primary hover:text-primary-focus transition-colors"
              title="查看"
              @click="viewItem(item)"
            >
              <EyeIcon class="h-5 w-5" />
            </button>

            <template v-if="item.status === 'pending'">
              <button
                class="text-success hover:text-success-darker transition-colors"
                title="送审"
                @click="submitItem(item)"
              >
                <PaperAirplaneIcon class="h-5 w-5" />
              </button>
              <button
                class="text-warning hover:text-warning-darker transition-colors"
                title="编辑"
                @click="editItem(item)"
              >
                <PencilSquareIcon class="h-5 w-5" />
              </button>
              <button
                class="text-danger hover:text-danger-darker transition-colors"
                title="删除"
                @click="deleteItem(item)"
              >
                <TrashIcon class="h-5 w-5" />
              </button>
            </template>
          </div>
        </template>
      </LayoutTable>

      <!-- Pagination -->
      <div
        class="p-4 border-t border-outline-3 flex items-center justify-between bg-foundation"
      >
        <div class="text-sm text-foreground-2">
          每页显示
          <select
            v-model="pageSize"
            class="mx-1 border border-outline-3 rounded px-2 py-1 bg-foundation text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          条 &nbsp; 共 {{ totalItems }} 条，第 {{ startItem }}-{{ endItem }} 条
        </div>

        <div class="flex items-center space-x-2">
          <button
            class="px-2 py-1 border border-outline-3 rounded text-foreground-2 hover:bg-highlight-1 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            &lt; 上一页
          </button>
          <button
            class="w-8 h-8 bg-primary text-white rounded flex items-center justify-center font-medium"
          >
            1
          </button>
          <button
            class="px-2 py-1 border border-outline-3 rounded text-foreground-2 hover:bg-highlight-1 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="currentPage * pageSize >= totalItems"
            @click="currentPage++"
          >
            下一页 &gt;
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'
import {
  LayoutTable,
  FormTextInput,
  FormButton,
  CommonBadge
} from '@speckle/ui-components'

// Types
type Status = 'passed' | 'auditing' | 'pending'

interface WorkValuation {
  id: string
  code: string
  unit: string
  time: string
  contract: string
  status: Status
  person: string | null
}

// State
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

// Columns configuration
const columns = [
  { id: 'code', header: '验工编码', classes: 'col-span-2' },
  { id: 'unit', header: '发起单位', classes: 'col-span-2' },
  { id: 'time', header: '发起时间', classes: 'col-span-2' },
  { id: 'contract', header: '合约名称', classes: 'col-span-2' },
  { id: 'status', header: '审核状态', classes: 'col-span-1' },
  { id: 'person', header: '当前负责人', classes: 'col-span-1' },
  { id: 'actions', header: '操作', classes: 'col-span-2' }
]

// Mock Data
const mockData: WorkValuation[] = [
  {
    id: '1',
    code: 'YG-2025-001',
    unit: '施工单位A',
    time: '2025-01-15',
    contract: '主楼建筑工程',
    status: 'passed',
    person: '张三'
  },
  {
    id: '2',
    code: 'YG-2025-002',
    unit: '施工单位B',
    time: '2025-01-20',
    contract: '机电安装工程',
    status: 'auditing',
    person: '李四'
  },
  {
    id: '3',
    code: 'YG-2025-003',
    unit: '施工单位C',
    time: '2025-01-22',
    contract: '装饰装修工程',
    status: 'pending',
    person: null
  },
  {
    id: '4',
    code: 'YG-2025-004',
    unit: '施工单位A',
    time: '2025-02-05',
    contract: '主楼建筑工程',
    status: 'passed',
    person: '张三'
  },
  {
    id: '5',
    code: 'YG-2025-005',
    unit: '施工单位D',
    time: '2025-02-10',
    contract: '景观绿化工程',
    status: 'auditing',
    person: '王五'
  },
  {
    id: '6',
    code: 'YG-2025-006',
    unit: '施工单位B',
    time: '2025-02-12',
    contract: '机电安装工程',
    status: 'pending',
    person: null
  },
  {
    id: '7',
    code: 'YG-2025-007',
    unit: '施工单位E',
    time: '2025-02-15',
    contract: '智能化系统工程',
    status: 'passed',
    person: '赵六'
  },
  {
    id: '8',
    code: 'YG-2025-008',
    unit: '施工单位C',
    time: '2025-02-18',
    contract: '装饰装修工程',
    status: 'auditing',
    person: '李四'
  },
  {
    id: '9',
    code: 'YG-2025-009',
    unit: '施工单位A',
    time: '2025-02-20',
    contract: '主楼建筑工程',
    status: 'pending',
    person: null
  },
  {
    id: '10',
    code: 'YG-2025-010',
    unit: '施工单位F',
    time: '2025-02-22',
    contract: '消防系统工程',
    status: 'passed',
    person: '张三'
  },
  {
    id: '11',
    code: 'YG-2025-011',
    unit: '施工单位B',
    time: '2025-02-25',
    contract: '机电安装工程',
    status: 'auditing',
    person: '李四'
  },
  {
    id: '12',
    code: 'YG-2025-012',
    unit: '施工单位C',
    time: '2025-02-28',
    contract: '装饰装修工程',
    status: 'pending',
    person: null
  }
]

// Computed
const filteredItems = computed(() => {
  if (!searchQuery.value) return mockData
  const query = searchQuery.value.toLowerCase()
  return mockData.filter(
    (item) =>
      item.code.toLowerCase().includes(query) ||
      item.contract.toLowerCase().includes(query) ||
      item.unit.toLowerCase().includes(query)
  )
})

const totalItems = computed(() => filteredItems.value.length)

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredItems.value.slice(start, end)
})

const startItem = computed(() => (currentPage.value - 1) * pageSize.value + 1)
const endItem = computed(() =>
  Math.min(currentPage.value * pageSize.value, totalItems.value)
)

// Helpers
const getStatusText = (status: Status) => {
  const map: Record<Status, string> = {
    passed: '已通过',
    auditing: '审核中',
    pending: '待送审'
  }
  return map[status]
}

const getStatusColor = (status: Status) => {
  const map: Record<Status, string> = {
    passed: 'bg-success-lighter text-success-darker',
    auditing: 'bg-primary-muted text-primary',
    pending: 'bg-highlight-3 text-foreground-2'
  }
  return map[status]
}

// Actions
const viewItem = (item: WorkValuation) => {
  console.log('View item', item)
}

const submitItem = (item: WorkValuation) => {
  console.log('Submit item', item)
}

const editItem = (item: WorkValuation) => {
  console.log('Edit item', item)
}

const deleteItem = (item: WorkValuation) => {
  console.log('Delete item', item)
}
</script>
