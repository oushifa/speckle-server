<template>
  <div class="flex flex-col gap-4">
    <!-- Header & Toolbar -->
    <div class="flex items-center justify-between">
      <h1 class="text-heading-lg text-foreground mt-3">清单管理</h1>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <FormTextInput
            v-model="searchQuery"
            name="search"
            placeholder="搜索清单"
            class="w-64"
          />
          <FormButton color="subtle" :icon-left="MagnifyingGlassIcon" hide-text />
        </div>
        <FormButton color="outline" :icon-left="DocumentTextIcon">清单模板</FormButton>
        <FormButton color="primary" :icon-left="PlusIcon">新增</FormButton>
      </div>
    </div>

    <!-- Table -->
    <LayoutTable
      :columns="columns"
      :items="items"
      empty-message="暂无清单数据"
      class="w-full"
    >
      <template #name="{ item }">
        <a href="#" class="text-primary hover:underline font-medium">
          {{ item.name }}
        </a>
      </template>

      <template #section="{ item }">
        <span class="text-foreground">{{ item.section }}</span>
      </template>

      <template #contractCode="{ item }">
        <span class="text-foreground">{{ item.contractCode }}</span>
      </template>

      <template #uploadTime="{ item }">
        <span class="text-foreground">{{ item.uploadTime }}</span>
      </template>

      <template #attachment="{ item }">
        <a href="#" class="text-primary hover:underline">
          {{ item.attachmentName }}
        </a>
      </template>

      <template #status="{ item }">
        <CommonBadge
          :color-classes="
            item.status === 'decomposed'
              ? 'bg-success text-white'
              : 'bg-gray-200 text-gray-700'
          "
          rounded
        >
          {{ item.status === 'decomposed' ? '已拆解' : '未拆解' }}
        </CommonBadge>
      </template>

      <template #actions>
        <div class="flex items-center justify-end gap-2">
          <button class="text-warning hover:text-warning-dark transition">
            <PencilSquareIcon class="h-5 w-5" />
          </button>
          <button class="text-success hover:text-success-dark transition">
            <LinkIcon class="h-5 w-5" />
          </button>
        </div>
      </template>
    </LayoutTable>
  </div>
</template>

<script setup lang="ts">
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  PlusIcon,
  PencilSquareIcon,
  LinkIcon
} from '@heroicons/vue/24/outline'

// Mock Data Type
interface BOQItem {
  id: string
  name: string
  section: string
  contractCode: string
  uploadTime: string
  attachmentName: string
  status: 'decomposed' | 'undecomposed'
}

// Search Query
const searchQuery = ref('')

// Table Columns Configuration
const columns = [
  { id: 'name', header: '清单名称', classes: 'col-span-3' },
  { id: 'section', header: '标段', classes: 'col-span-1' },
  { id: 'contractCode', header: '合约码', classes: 'col-span-2' },
  { id: 'uploadTime', header: '上传时间', classes: 'col-span-2' },
  { id: 'attachment', header: '附件', classes: 'col-span-2' },
  { id: 'status', header: '拆解状态', classes: 'col-span-1' },
  { id: 'actions', header: '操作', classes: 'col-span-1 text-right' }
]

// Mock Data
const items = ref<BOQItem[]>([
  {
    id: '1',
    name: '盾构区间工程清单',
    section: '标段A',
    contractCode: 'DT-2025-001',
    uploadTime: '2025-01-15',
    attachmentName: '清单.xlsx',
    status: 'decomposed'
  },
  {
    id: '2',
    name: '车站主体工程清单',
    section: '标段A',
    contractCode: 'DT-2025-002',
    uploadTime: '2025-01-18',
    attachmentName: '清单.xlsx',
    status: 'decomposed'
  },
  {
    id: '3',
    name: '工作井工程清单',
    section: '标段B',
    contractCode: 'DT-2025-003',
    uploadTime: '2025-02-01',
    attachmentName: '清单.xlsx',
    status: 'undecomposed'
  },
  {
    id: '4',
    name: '道路恢复工程清单',
    section: '标段C',
    contractCode: 'DT-2025-004',
    uploadTime: '2025-02-05',
    attachmentName: '清单.xlsx',
    status: 'undecomposed'
  }
])
</script>
