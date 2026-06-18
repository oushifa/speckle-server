<template>
  <div>
    <button
      type="button"
      class="w-full px-3 py-2 border border-outline-3 rounded-md bg-foundation-page text-left flex items-center justify-between gap-2 disabled:opacity-50"
      :disabled="disabled || !resolvedProjectId"
      @click="openDialog"
    >
      <span
        class="truncate text-body-sm"
        :class="displayValue ? 'text-foreground' : 'text-foreground-2'"
      >
        {{ displayValue || placeholder }}
      </span>
      <ChevronDownIcon class="h-4 w-4 text-foreground-2 shrink-0" />
    </button>
    <LayoutDialog v-model:open="isOpen" max-width="lg" :buttons="dialogButtons">
      <template #header>选择清单项</template>
      <div class="space-y-3 max-h-[70vh]">
        <div class="text-body-sm text-foreground-2">
          提示：当前仅可选择{{ leafLabel }}层级
        </div>
        <FormTextInput
          v-model="searchText"
          name="checklist-search"
          placeholder="搜索编码或名称..."
          :icon-left="MagnifyingGlassIcon"
          :show-label="false"
        />
        <div class="border border-outline-3 rounded-lg max-h-[520px] overflow-auto">
          <div
            v-for="row in visibleRows"
            :key="row.id"
            class="px-3 py-2 flex items-center gap-2"
            :class="
              canSelect(row)
                ? 'hover:bg-highlight-1 cursor-pointer'
                : 'text-foreground-2 cursor-not-allowed'
            "
            role="button"
            tabindex="0"
            @click="handleRowClick(row)"
            @keydown.enter="handleRowClick(row)"
            @keydown.space.prevent="handleRowClick(row)"
          >
            <button
              v-if="row.children.length"
              type="button"
              class="text-success"
              :style="{ marginLeft: `${row.depth * 24}px` }"
              @click.stop="toggleExpand(row.id)"
            >
              <ChevronDownIcon v-if="isExpanded(row.id)" class="h-4 w-4" />
              <ChevronRightIcon v-else class="h-4 w-4" />
            </button>
            <span
              v-else
              class="inline-block"
              :style="{ marginLeft: `${row.depth * 24 + 16}px` }"
            />
            <span
              class="font-medium"
              :class="!canSelect(row) ? 'text-[rgba(19,108,255,0.5)]' : 'text-primary'"
            >
              {{ row.code }}
            </span>
            <span :class="canSelect(row) ? 'text-foreground' : 'text-foreground-3'">
              {{ row.name }}
            </span>
            <CheckIcon
              v-if="draftSelectedIds.has(row.id)"
              class="h-5 w-5 text-success ml-auto"
            />
          </div>
          <div
            v-if="!visibleRows.length && !loading"
            class="py-10 text-center text-body-sm text-foreground-2"
          >
            暂无可选清单项
          </div>
          <div v-if="loading" class="py-10 text-center text-body-sm text-foreground-2">
            加载中...
          </div>
        </div>
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useQuery } from '@vue/apollo-composable'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon
} from '@heroicons/vue/24/outline'
import type {
  BoqItemType,
  ProjectBoqItemsQuery
} from '~/lib/common/generated/gql/graphql'
import { projectBoqItemsQuery } from '~/lib/projects/graphql/queries'

type BoqNode = NonNullable<
  NonNullable<ProjectBoqItemsQuery['project']>['boqItems'][number]
>
type SelectLeafType = 'category' | 'section' | 'subsection' | 'item'

type ChecklistNode = {
  id: string
  parentId: string | null
  type: BoqItemType
  code: string
  name: string
  unit: string
  depth: number
  hasChildren: boolean
  children: ChecklistNode[]
}

const props = withDefaults(
  defineProps<{
    multiple?: boolean
    projectId?: string | null
    disabled?: boolean
    placeholder?: string
    leaf?: SelectLeafType
  }>(),
  {
    multiple: false,
    projectId: null,
    disabled: false,
    placeholder: '点击选择清单项（支持层级展开）',
    leaf: 'item'
  }
)

const emit = defineEmits<{
  (
    e: 'selected',
    payload: Array<{
      id: string
      code: string
      name: string
      unit: string
    }>
  ): void
}>()

const model = defineModel<string[] | string | null>('modelValue', { default: null })

const resolvedProjectId = computed(() => props.projectId || '')
const isOpen = ref(false)
const searchText = ref('')
const expandedIds = ref<Set<string>>(new Set())
const draftSelectedIds = ref<Set<string>>(new Set())

const leafTypeMap: Record<SelectLeafType, BoqItemType> = {
  category: 'CATEGORY',
  section: 'SECTION',
  subsection: 'SUBSECTION',
  item: 'ITEM'
}

const leafLabel = computed(() => {
  if (props.leaf === 'category') return '分类'
  if (props.leaf === 'section') return '分部'
  if (props.leaf === 'subsection') return '分项'
  return '具体项'
})

const selectableType = computed(() => leafTypeMap[props.leaf])

const { result, loading, refetch } = useQuery(
  projectBoqItemsQuery,
  () => ({
    projectId: resolvedProjectId.value,
    search: null
  }),
  {
    enabled: computed(() => !!resolvedProjectId.value)
  }
)

const toChecklistNode = (node: BoqNode): ChecklistNode => {
  const isLeafSelectable = node.type === selectableType.value
  const childNodes = isLeafSelectable
    ? []
    : (node.children || []).filter((child): child is BoqNode => !!child)
  expandedIds.value.add(node.id)
  return {
    id: node.id,
    parentId: node.parentId || null,
    type: node.type,
    code: node.code,
    name: node.name,
    unit: node.unit || '',
    depth: node.depth,
    hasChildren: isLeafSelectable ? false : node.hasChildren,
    children: childNodes.map(toChecklistNode)
  }
}

const treeNodes = computed<ChecklistNode[]>(() => {
  const rows = result.value?.project?.boqItems || []
  return rows.filter((row): row is BoqNode => !!row).map(toChecklistNode)
})

const nodeMap = computed(() => {
  const map = new Map<string, ChecklistNode>()
  const walk = (nodes: ChecklistNode[]) => {
    nodes.forEach((node) => {
      map.set(node.id, node)
      if (node.children.length) walk(node.children)
    })
  }
  walk(treeNodes.value)
  return map
})

const isExpanded = (id: string) => expandedIds.value.has(id)

const canSelect = (node: ChecklistNode) => node.type === selectableType.value

const selectedIdsFromModel = computed<string[]>(() => {
  if (props.multiple) {
    return Array.isArray(model.value) ? model.value : []
  }
  if (typeof model.value === 'string' && model.value) {
    return [model.value]
  }
  return []
})

const getPathToRoot = (nodeId: string) => {
  const ids: string[] = []
  let current = nodeMap.value.get(nodeId)
  while (current?.parentId) {
    ids.push(current.parentId)
    current = nodeMap.value.get(current.parentId)
  }
  return ids
}

const matchedIds = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return null
  const ids = new Set<string>()
  nodeMap.value.forEach((node) => {
    if (
      node.code.toLowerCase().includes(keyword) ||
      node.name.toLowerCase().includes(keyword)
    ) {
      ids.add(node.id)
      getPathToRoot(node.id).forEach((ancestorId) => ids.add(ancestorId))
    }
  })
  return ids
})

const visibleRows = computed(() => {
  const rows: ChecklistNode[] = []
  const walk = (nodes: ChecklistNode[]) => {
    nodes.forEach((node) => {
      const matched = matchedIds.value
      if (matched && !matched.has(node.id)) return
      rows.push(node)
      const shouldExpandBySearch = Boolean(matchedIds.value)
      if (
        node.children.length &&
        (shouldExpandBySearch || expandedIds.value.has(node.id))
      ) {
        walk(node.children)
      }
    })
  }
  walk(treeNodes.value)
  return rows
})

const selectedNodes = computed(() =>
  Array.from(draftSelectedIds.value)
    .map((id) => nodeMap.value.get(id))
    .filter((node): node is ChecklistNode => !!node)
)

const displayValue = computed(() => {
  const labels = selectedIdsFromModel.value
    .map((id) => nodeMap.value.get(id))
    .filter((node): node is ChecklistNode => !!node)
    .map((node) => `${node.code} ${node.name}`)
  return labels.join('，')
})

const syncDraftFromModel = () => {
  draftSelectedIds.value = new Set(
    selectedIdsFromModel.value.filter((id) => {
      const node = nodeMap.value.get(id)
      return !!node && canSelect(node)
    })
  )
}

const openDialog = async () => {
  if (!resolvedProjectId.value) return
  if (!treeNodes.value.length) await refetch()
  syncDraftFromModel()
  isOpen.value = true
}

const toggleExpand = (id: string) => {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else expandedIds.value.add(id)
}

const handleRowClick = (node: ChecklistNode) => {
  if (!canSelect(node)) return
  if (props.multiple) {
    if (draftSelectedIds.value.has(node.id)) draftSelectedIds.value.delete(node.id)
    else draftSelectedIds.value.add(node.id)
  } else {
    draftSelectedIds.value = new Set([node.id])
  }
}

const submitSelection = () => {
  const ids = Array.from(draftSelectedIds.value)
  if (props.multiple) model.value = ids
  else model.value = ids[0] || null
  emit(
    'selected',
    selectedNodes.value.map((node) => ({
      id: node.id,
      code: node.code,
      name: node.name,
      unit: node.unit
    }))
  )
  isOpen.value = false
}

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      isOpen.value = false
    }
  },
  {
    text: '确定',
    props: { color: 'primary' },
    onClick: submitSelection
  }
])

watch([resolvedProjectId, selectableType], () => {
  searchText.value = ''
  expandedIds.value = new Set()
  draftSelectedIds.value = new Set()
  if (props.multiple) model.value = []
  else model.value = null
})
</script>
