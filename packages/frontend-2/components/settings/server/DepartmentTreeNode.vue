<template>
  <div class="relative" :class="[depth > 0 ? 'pl-6 mt-1.5' : 'mt-2.5']">
    <!-- 导轨连线设计：利用 isLast 绘制完美的直角弯折树枝线 -->
    <template v-if="depth > 0">
      <!-- 竖向引导线 -->
      <div
        class="absolute left-2.5 top-0 border-l border-outline-3"
        :class="isLast ? 'h-[18px]' : 'bottom-0'"
      ></div>
      <!-- 横向拐角线 -->
      <div class="absolute left-2.5 top-[18px] w-3.5 border-t border-outline-3"></div>
    </template>

    <!-- 节点内容卡片 -->
    <div
      class="group relative px-4 py-2.5 flex items-center justify-between rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden"
      :class="[
        selectedId === node.id
          ? 'bg-blue-600/5 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/5'
          : 'bg-foundation hover:bg-foundation-page/60 border-outline-3 hover:border-foreground-3 text-foreground'
      ]"
      @click.stop="emit('select', node.id)"
    >
      <!-- 选中指示边缘条 -->
      <div
        class="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300"
        :class="selectedId === node.id ? 'bg-blue-600' : 'bg-transparent'"
      ></div>

      <div class="flex items-center gap-2 min-w-0 flex-1">
        <!-- 展开 / 折叠小三角 -->
        <button
          v-if="node.children && node.children.length > 0"
          type="button"
          class="p-0.5 hover:bg-foreground-5 rounded transition text-foreground-2 shrink-0 mr-0.5"
          @click.stop="emit('toggle', node.id)"
        >
          <ChevronDownIcon v-if="isExpanded" class="h-3.5 w-3.5" />
          <ChevronRightIcon v-else class="h-3.5 w-3.5" />
        </button>
        <span v-else class="w-3.5 h-3.5 shrink-0 mr-0.5" />

        <!-- 文件夹图标：深浅色层级视觉效果 -->
        <FolderIcon
          class="h-4 w-4 shrink-0"
          :class="[
            selectedId === node.id
              ? 'text-blue-600 dark:text-blue-400'
              : (depth === 0 ? 'text-indigo-500' : 'text-foreground-3')
          ]"
        />

        <span class="truncate text-sm font-semibold tracking-tight">{{ node.name }}</span>
      </div>

      <!-- 操作浮动按钮组：悬浮显现，微芯片精致感 -->
      <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all duration-300 pl-2 shrink-0">
        <button
          title="添加子部门"
          class="p-1 hover:bg-blue-600 hover:text-white text-foreground-2 rounded-lg transition"
          @click.stop="emit('add', node.id)"
        >
          <PlusIcon class="h-3.5 w-3.5" />
        </button>
        <button
          title="重命名"
          class="p-1 hover:bg-amber-500 hover:text-white text-foreground-2 rounded-lg transition"
          @click.stop="emit('edit', node)"
        >
          <PencilIcon class="h-3.5 w-3.5" />
        </button>
        <button
          title="删除部门"
          class="p-1 hover:bg-red-600 hover:text-white text-foreground-2 rounded-lg transition"
          @click.stop="emit('delete', node)"
        >
          <TrashIcon class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <!-- 递归子节点渲染 -->
    <div
      v-if="node.children && node.children.length > 0 && isExpanded"
      class="relative"
    >
      <!-- 为子节点画一条延伸下去的纵向树枝主干线（如果当前不是最后一个节点，或者子节点未结束） -->
      <div
        v-if="!isLast"
        class="absolute left-2.5 top-0 bottom-0 border-l border-outline-3"
      ></div>
      <DepartmentTreeNode
        v-for="(child, idx) in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :selected-id="selectedId"
        :expanded-ids="expandedIds"
        :is-last="idx === node.children.length - 1"
        @select="(id) => emit('select', id)"
        @toggle="(id) => emit('toggle', id)"
        @add="(id) => emit('add', id)"
        @edit="(n) => emit('edit', n)"
        @delete="(n) => emit('delete', n)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  FolderIcon
} from '@heroicons/vue/24/outline'

export type Department = {
  id: string
  name: string
  parentId: string | null
  path: string
  children: Department[]
  createdAt: string
  updatedAt: string
}

const props = withDefaults(
  defineProps<{
    node: Department
    depth?: number
    selectedId: string | null
    expandedIds: Set<string>
    isLast?: boolean
  }>(),
  {
    depth: 0,
    isLast: false
  }
)

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'toggle', id: string): void
  (e: 'add', parentId: string | null): void
  (e: 'edit', node: any): void
  (e: 'delete', node: any): void
}>()

const isExpanded = computed(() => props.expandedIds.has(props.node.id))
</script>
