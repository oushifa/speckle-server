<template>
  <div class="flex flex-col h-[calc(100vh-120px)]">
    <!-- Main Title -->
    <h1 class="text-heading-lg text-foreground mt-3 mb-4">形象进度</h1>

    <!-- Content Area -->
    <div class="flex flex-1 gap-6 min-h-0">
      <!-- Left Sidebar: File Tree -->
      <div
        class="w-80 flex flex-col bg-foundation rounded-lg border border-outline-2 shadow-sm flex-shrink-0"
      >
        <!-- Tree Header -->
        <div class="p-4 border-b border-outline-2 flex items-center gap-2">
          <FolderOpenIcon class="w-5 h-5 text-foreground-2" />
          <span class="font-bold text-foreground">文件树</span>
        </div>

        <!-- Tree Content -->
        <div class="flex-1 overflow-y-auto p-2">
          <div
            v-for="item in visibleItems"
            :key="item.id"
            class="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer select-none transition-colors"
            :class="[
              selectedId === item.id
                ? 'bg-primary-muted text-primary'
                : 'hover:bg-foundation-2 text-foreground'
            ]"
            :style="{ paddingLeft: `${item.level * 1.5 + 0.5}rem` }"
            @click="handleItemClick(item)"
          >
            <!-- Expand/Collapse Icon -->
            <div
              class="w-4 h-4 flex items-center justify-center flex-shrink-0 text-foreground-2"
              @click.stop="toggleExpand(item)"
            >
              <component
                :is="item.expanded ? ChevronDownIcon : ChevronRightIcon"
                v-if="item.children && item.children.length > 0"
                class="w-3.5 h-3.5"
              />
            </div>

            <!-- Type Icon -->
            <component
              :is="item.type === 'folder' ? FolderIcon : DocumentIcon"
              class="w-5 h-5 flex-shrink-0"
              :class="item.type === 'folder' ? 'text-foreground-2' : 'text-primary'"
            />

            <!-- Label -->
            <span class="truncate text-body-sm">{{ item.label }}</span>
          </div>
        </div>

        <!-- Legend -->
        <div class="p-4 border-t border-outline-2 bg-foundation-2/50 rounded-b-lg">
          <h3 class="font-bold text-foreground mb-3 text-body-sm">图例</h3>
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-success"></span>
              <span class="text-body-xs text-foreground-2">已完成</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-warning"></span>
              <span class="text-body-xs text-foreground-2">正常进行中</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-danger"></span>
              <span class="text-body-xs text-foreground-2">已延期</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-gray-300"></span>
              <span class="text-body-xs text-foreground-2">未开始</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Content: 3D Viewer Placeholder -->
      <div
        class="flex-1 bg-foundation-page rounded-lg border border-outline-2 flex flex-col items-center justify-center relative overflow-hidden"
      >
        <!-- Background grid pattern (optional decoration) -->
        <div
          class="absolute inset-0 opacity-[0.03]"
          style="
            background-image: radial-gradient(#000 1px, transparent 1px);
            background-size: 20px 20px;
          "
        ></div>

        <div class="text-center z-10 flex flex-col items-center p-8">
          <CubeIcon class="w-24 h-24 text-foreground-3 mb-4 stroke-1" />
          <h3 class="text-heading-md font-bold text-foreground-2 mb-2">
            形象进度三维展示
          </h3>
          <p class="text-body-sm text-foreground-3">
            选择文件后以不同颜色显示不同进度状态
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  FolderIcon,
  DocumentIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CubeIcon
} from '@heroicons/vue/24/solid'

// --- Types ---
interface TreeItem {
  id: string
  label: string
  type: 'folder' | 'file'
  level: number
  expanded: boolean
  parentId?: string
  children?: string[] // IDs of children
}

// --- State ---
const selectedId = ref<string | null>(null)

// --- Mock Data ---
const rawData: TreeItem[] = [
  {
    id: 'root',
    label: 'BIM模型文件',
    type: 'folder',
    level: 0,
    expanded: true,
    children: ['arch', 'struct', 'mep', 'deco']
  },
  // Architecture
  {
    id: 'arch',
    parentId: 'root',
    label: '建筑模型',
    type: 'folder',
    level: 1,
    expanded: true,
    children: ['arch_v1', 'arch_v2']
  },
  {
    id: 'arch_v1',
    parentId: 'arch',
    label: '建筑模型_v1.rvt',
    type: 'file',
    level: 2,
    expanded: false
  },
  {
    id: 'arch_v2',
    parentId: 'arch',
    label: '建筑模型_v2.rvt',
    type: 'file',
    level: 2,
    expanded: false
  },
  // Structure
  {
    id: 'struct',
    parentId: 'root',
    label: '结构模型',
    type: 'folder',
    level: 1,
    expanded: true,
    children: ['struct_v1']
  },
  {
    id: 'struct_v1',
    parentId: 'struct',
    label: '结构模型_v1.rvt',
    type: 'file',
    level: 2,
    expanded: false
  },
  // MEP
  {
    id: 'mep',
    parentId: 'root',
    label: '机电模型',
    type: 'folder',
    level: 1,
    expanded: false, // collapsed by default
    children: ['mep_v1']
  },
  {
    id: 'mep_v1',
    parentId: 'mep',
    label: '机电模型_v1.rvt',
    type: 'file',
    level: 2,
    expanded: false
  },
  // Decoration
  {
    id: 'deco',
    parentId: 'root',
    label: '装饰模型',
    type: 'folder',
    level: 1,
    expanded: false, // collapsed by default
    children: ['deco_v1']
  },
  {
    id: 'deco_v1',
    parentId: 'deco',
    label: '装饰模型_v1.rvt',
    type: 'file',
    level: 2,
    expanded: false
  }
]

const items = ref<TreeItem[]>(rawData)

// --- Logic ---

// Flatten the tree for display, respecting 'expanded' state
const visibleItems = computed(() => {
  const result: TreeItem[] = []

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

const toggleExpand = (item: TreeItem) => {
  if (item.type === 'file') return

  const index = items.value.findIndex((i) => i.id === item.id)
  if (index !== -1) {
    items.value[index].expanded = !items.value[index].expanded
  }
}

const handleItemClick = (item: TreeItem) => {
  selectedId.value = item.id
  // If it's a folder, also toggle expand
  if (item.type === 'folder') {
    toggleExpand(item)
  }
}
</script>
