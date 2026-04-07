<!-- eslint-disable vuejs-accessibility/no-static-element-interactions -->
<template>
  <div :class="tableClasses">
    <div :class="headerRowClasses" :style="{ paddingRight: paddingRightStyle }">
      <div
        v-for="(column, colIndex) in columns"
        :key="column.id"
        :class="getHeaderClasses(column.id, colIndex)"
      >
        {{ column.header }}
      </div>
    </div>
    <div :class="resultContainerClasses">
      <div
        v-if="loading || !items"
        class="flex items-center justify-center py-3"
        tabindex="0"
      >
        <CommonLoadingIcon />
      </div>
      <template v-else-if="flatItems.length">
        <div
          v-for="row in flatItems"
          :key="row.item.id"
          :style="{ paddingRight: paddingRightStyle }"
          :class="rowsWrapperClasses"
          tabindex="0"
          @click="handleRowClick(row.item)"
          @keypress="handleRowClick(row.item)"
        >
          <template v-for="(column, colIndex) in columns" :key="column.id">
            <div :class="getClasses(column.id, colIndex)" tabindex="0">
              <div
                v-if="colIndex === 0"
                class="flex items-center min-w-0"
                :style="{ paddingLeft: `${row.depth * 20}px` }"
              >
                <button
                  v-if="row.hasChildren"
                  type="button"
                  class="w-5 h-5 mr-1 text-foreground-2 hover:text-foreground transition"
                  @click.stop="toggleRow(row.item)"
                >
                  <ChevronRightIcon
                    class="h-4 w-4 transition-transform duration-150"
                    :class="[isRowExpanded(row.item) ? 'rotate-90' : '']"
                  />
                </button>
                <span v-else class="w-5 h-5 mr-1" />
                <div class="min-w-0 flex-1">
                  <slot
                    :name="column.id"
                    :item="row.item"
                    :depth="row.depth"
                    :has-children="row.hasChildren"
                    :expanded="isRowExpanded(row.item)"
                  >
                    <div class="text-foreground-2 font-medium order-1">Placeholder</div>
                  </slot>
                </div>
              </div>
              <slot
                v-else
                :name="column.id"
                :item="row.item"
                :depth="row.depth"
                :has-children="row.hasChildren"
                :expanded="isRowExpanded(row.item)"
              >
                <div class="text-foreground-2 font-medium order-1">Placeholder</div>
              </slot>
            </div>
          </template>
          <div
            v-if="buttons"
            class="absolute right-1.5 space-x-1 flex items-center p-0 h-full"
          >
            <div v-for="button in buttons" :key="button.label">
              <FormButton
                v-tippy="button.tooltip"
                :icon-left="button.icon"
                size="sm"
                color="outline"
                hide-text
                :disabled="button.disabled"
                :class="button.class"
                :to="isString(button.action) ? button.action : undefined"
                @click.stop="!isString(button.action) ? button.action(row.item) : noop"
              />
            </div>
          </div>
        </div>
      </template>
      <div
        v-else
        tabindex="0"
        :style="{ paddingRight: paddingRightStyle }"
        :class="rowsWrapperClasses"
      >
        <div :class="getClasses(undefined, 0)" tabindex="0">
          <slot name="empty">
            <div class="w-full text-center label-light text-foreground-2 italic">
              {{ emptyMessage }}
            </div>
          </slot>
        </div>
      </div>
      <slot name="loader" />
    </div>
  </div>
</template>
<script setup lang="ts" generic="T extends {id: string}, C extends string">
import { noop, isString } from '#lodash'
import { computed, ref, watch } from 'vue'
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import type { PropAnyComponent } from '~~/src/helpers/common/components'
import { CommonLoadingIcon, FormButton } from '~~/src/lib'
import { directive as vTippy } from 'vue-tippy'

export type TableColumn<I> = {
  id: I
  header: string
  classes: string
}

export type RowButton<T = unknown> = {
  icon: PropAnyComponent
  label: string
  action: (item: T) => unknown
  class?: string
  tooltip?: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    items: T[] | undefined | null
    buttons?: RowButton<T>[]
    columns: TableColumn<C>[]
    overflowCells?: boolean
    onRowClick?: (item: T) => void
    rowItemsAlign?: 'center' | 'stretch'
    emptyMessage?: string
    loading?: boolean
    childrenKey?: string
    expandAllByDefault?: boolean
  }>(),
  {
    rowItemsAlign: 'center',
    emptyMessage: '暂无数据',
    childrenKey: 'children',
    expandAllByDefault: true
  }
)

type FlatItem<TItem> = {
  item: TItem
  depth: number
  hasChildren: boolean
}

const tableClasses = computed(() => {
  const classParts = [
    'w-full text-foreground text-sm border border-outline-3 rounded-lg',
    'overflow-x-auto simple-scrollbar',
    'h-full flex flex-col'
  ]
  return classParts.join(' ')
})

const sharedContainerClasses = computed(() => {
  const classParts = ['w-full min-w-[750px]']
  return classParts.join(' ')
})

const resultContainerClasses = computed(() => {
  const classParts = [
    'divide-y divide-outline-3 overflow-y-auto overflow-x-hidden simple-scrollbar',
    sharedContainerClasses.value
  ]

  if (props.overflowCells) {
    classParts.push('pb-32')
  }

  return classParts.join(' ')
})

const buttonCount = computed(() => {
  return (props.buttons || []).length
})
const paddingRightStyle = computed(() => {
  let padding = 16
  if (buttonCount.value > 0) {
    padding = 48 + (buttonCount.value - 1) * 42
  }
  return `${padding}px`
})

const rowsWrapperClasses = computed(() => {
  const classParts = [
    'relative grid grid-cols-12 items-center space-x-6 px-4 py-0.5 min-w-[750px] text-body-xs'
  ]

  if (props.onRowClick && props.items?.length) {
    classParts.push('cursor-pointer hover:bg-highlight-1')
  }

  switch (props.rowItemsAlign) {
    case 'center':
      classParts.push('items-center')
      break
    case 'stretch':
      classParts.push('items-stretch')
      break
  }

  return classParts.join(' ')
})

const getHeaderClasses = (
  column: C | undefined,
  colIndex: number,
  options?: Partial<{
    noPadding: boolean
  }>
): string => {
  const columnClasses = column
    ? props.columns.find((c) => c.id === column)?.classes
    : ''
  const classParts = [columnClasses || '']

  if (!options?.noPadding) {
    if (colIndex === 0) {
      classParts.push('px-1')
    } else {
      classParts.push('lg:p-0 px-1')
    }
  }

  return classParts.join(' ')
}

const getClasses = (
  column: C | undefined,
  colIndex: number,
  options?: Partial<{
    noPadding: boolean
  }>
): string => {
  const classParts = [getHeaderClasses(column, colIndex, options)]

  if (colIndex === 0) {
    classParts.push(`bg-transparent py-2 ${column ? 'pr-5' : 'col-span-full'}`)
  } else {
    classParts.push(`my-2`)
  }

  return classParts.join(' ')
}

const expandedRows = ref<Set<string>>(new Set())

const getChildren = (item: T): T[] => {
  const children = (item as Record<string, unknown>)[props.childrenKey]
  return Array.isArray(children) ? (children as T[]) : []
}

const collectExpandableIds = (items: T[] = []): string[] => {
  return items.flatMap((item) => {
    const children = getChildren(item)
    if (!children.length) return []
    return [item.id, ...collectExpandableIds(children)]
  })
}

const syncExpandedRows = () => {
  if (!props.expandAllByDefault) {
    expandedRows.value = new Set()
    return
  }
  expandedRows.value = new Set(collectExpandableIds(props.items || []))
}

watch(
  () => props.items,
  () => {
    syncExpandedRows()
  },
  { immediate: true, deep: true }
)

const isRowExpanded = (item: T): boolean => {
  return expandedRows.value.has(item.id)
}

const toggleRow = (item: T) => {
  const children = getChildren(item)
  if (!children.length) return
  const updated = new Set(expandedRows.value)
  if (updated.has(item.id)) {
    updated.delete(item.id)
  } else {
    updated.add(item.id)
  }
  expandedRows.value = updated
}

const flatItems = computed<FlatItem<T>[]>(() => {
  const rows: FlatItem<T>[] = []
  const traverse = (items: T[], depth: number) => {
    items.forEach((item) => {
      const children = getChildren(item)
      const hasChildren = children.length > 0
      rows.push({ item, depth, hasChildren })
      if (hasChildren && expandedRows.value.has(item.id)) {
        traverse(children, depth + 1)
      }
    })
  }
  traverse(props.items || [], 0)
  return rows
})

const handleRowClick = (item: T) => {
  props.onRowClick?.(item)
}

const headerRowClasses = computed(() => [
  'z-10 grid grid-cols-12 items-center',
  'space-x-6',
  'px-4 py-3',
  'bg-foundation-2 rounded-t-lg',
  'font-medium text-body-2xs text-foreground-2',
  'border-b border-outline-3',
  sharedContainerClasses.value
])
</script>
