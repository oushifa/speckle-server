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
        <FormButton
          v-if="hasFunctionalPerm('bill-management:export')"
          color="outline"
          :icon-left="ArrowDownTrayIcon"
          :disabled="boqItemsLoading || exportingExcel || !allItems.length"
          @click="handleExportExcel"
        >
          导出Excel
        </FormButton>
        <FormButton
          v-if="hasFunctionalPerm('bill-management:import')"
          color="outline"
          :icon-left="ArrowUpTrayIcon"
          :disabled="rowMutationLoading || importingExcel"
          @click="triggerImportExcel"
        >
          导入Excel
        </FormButton>
        <FormButton
          v-if="!canInitializeBoq && hasFunctionalPerm('bill-management:download')"
          color="outline"
          :icon-left="DocumentTextIcon"
          @click="handleDownloadTemplate"
        >
          清单模板
        </FormButton>
        <FormButton
          v-if="canInitializeBoq && hasFunctionalPerm('bill-management:create')"
          color="primary"
          :icon-left="PlusIcon"
          :disabled="createBoqItemLoading"
          @click="initializeBoq"
        >
          初始化清单
        </FormButton>
        <input
          id="boq-import-excel-file"
          ref="boqImportInputRef"
          type="file"
          class="hidden"
          aria-label="导入清单Excel文件"
          accept=".xlsx,.xls"
          @change="handleImportFileChange"
        />
      </div>
    </div>

    <!-- Tree Table Container -->
    <div
      class="w-full overflow-x-auto rounded-lg border border-outline-3 bg-foundation text-sm shadow-sm"
    >
      <table class="w-full text-xs text-left min-w-[1520px] border-collapse">
        <thead
          class="bg-foundation-2 sticky top-0 font-semibold text-foreground-2 border-b border-outline-3 z-10 select-none"
        >
          <tr class="divide-x divide-outline-3/60">
            <th class="py-2.5 px-3 w-[220px]">清单编码</th>
            <th class="py-2.5 px-3 w-[220px]">清单名称</th>
            <th class="py-2.5 px-3 w-[90px] text-center">类型</th>
            <th class="py-2.5 px-3 w-[70px] text-center">计量单位</th>
            <th class="py-2.5 px-3 w-[100px] text-right">合同工程量</th>
            <th class="py-2.5 px-3 w-[110px] text-right">综合单价(元)</th>
            <th class="py-2.5 px-3 w-[110px] text-right">合价(元)</th>
            <th class="py-2.5 px-3 w-[120px] text-right text-primary bg-primary/5">
              复核量
            </th>
            <th class="py-2.5 px-3 w-[120px] text-right text-primary bg-primary/5">
              变更/签证量
            </th>
            <th class="py-2.5 px-3 w-[130px] text-right bg-primary/10">
              工程量(含变更)
            </th>
            <th class="py-2.5 px-3 w-[120px] text-right text-primary bg-primary/5">
              复核单价
            </th>
            <th class="py-2.5 px-3 w-[130px] text-right bg-primary/10">复核总价</th>
            <th
              class="py-2.5 px-3 w-[110px] text-right sticky right-0 bg-foundation-2 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]"
            >
              操作
            </th>
          </tr>
        </thead>

        <!-- Loading State -->
        <tbody v-if="isInitialLoading" class="divide-y divide-outline-3 font-normal">
          <tr>
            <td colspan="13" class="py-12 text-center text-foreground-2">
              <div class="flex items-center justify-center gap-2">
                <CommonLoadingIcon class="w-5 h-5 text-primary animate-spin" />
                <span>加载清单数据中...</span>
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Empty State -->
        <tbody
          v-else-if="!flatItems.length"
          class="divide-y divide-outline-3 font-normal"
        >
          <tr>
            <td colspan="13" class="py-12 text-center text-foreground-2 italic">
              暂无清单数据
            </td>
          </tr>
        </tbody>

        <!-- Data Rows -->
        <tbody v-else class="divide-y divide-outline-3 font-normal">
          <tr
            v-for="row in flatItems"
            :key="row.item.id"
            class="hover:bg-highlight-1/50 transition-colors divide-x divide-outline-3/40"
          >
            <!-- 清单编码 -->
            <td class="py-2 px-3">
              <div
                class="flex items-center"
                :style="{ paddingLeft: `${row.depth * 20}px` }"
              >
                <button
                  v-if="row.hasChildren"
                  type="button"
                  class="w-4 h-4 mr-1.5 text-foreground-2 hover:text-foreground transition inline-flex items-center justify-center shrink-0"
                  @click.stop="toggleRow(row.item)"
                >
                  <ChevronRightIcon
                    class="h-3.5 w-3.5 transition-transform duration-150"
                    :class="[isRowExpanded(row.item) ? 'rotate-90' : '']"
                  />
                </button>
                <span v-else class="w-4 h-4 mr-1.5 shrink-0" />
                <button
                  type="button"
                  class="font-mono text-primary hover:underline font-medium cursor-pointer truncate text-left"
                  @click="openEditDialog(row.item)"
                >
                  {{ row.item.code }}
                </button>
              </div>
            </td>

            <!-- 清单名称 -->
            <td class="py-2 px-3">
              <span
                class="font-medium text-foreground truncate block max-w-[210px]"
                :title="row.item.name"
              >
                {{ row.item.name }}
              </span>
            </td>

            <!-- 类型 -->
            <td class="py-2 px-3 text-center">
              <span
                class="inline-block px-1.5 py-0.5 rounded text-[11px] bg-foundation-3 text-foreground-2 border border-outline-3 whitespace-nowrap"
              >
                {{ childTypeLabelMap[row.item.type] }}
              </span>
            </td>

            <!-- 计量单位 -->
            <td class="py-2 px-3 text-center text-foreground-2">
              {{ row.item.unit || '-' }}
            </td>

            <!-- 合同工程量 -->
            <td class="py-2 px-3 text-right font-mono text-foreground">
              {{ formatNumber(row.item.quantity, 2) }}
            </td>

            <!-- 综合单价 -->
            <td class="py-2 px-3 text-right font-mono text-foreground">
              {{ formatNumber(row.item.price, 2) }}
            </td>

            <!-- 合价 -->
            <td class="py-2 px-3 text-right font-mono text-foreground font-medium">
              {{ formatNumber(row.item.amount, 2) }}
            </td>

            <!-- 复核量（可编辑） -->
            <td class="py-1 px-2 text-right bg-primary/5">
              <div
                v-if="row.item.type === 'ITEM'"
                class="flex items-center justify-end relative"
              >
                <input
                  type="number"
                  step="any"
                  aria-label="复核量"
                  class="w-24 px-2 py-1 text-xs font-mono text-right bg-foundation rounded border transition shadow-inner"
                  :class="[
                    savedItemIds.has(row.item.id)
                      ? 'border-success ring-1 ring-success/40 bg-success-lighter/10 text-success'
                      : 'border-outline-3 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none'
                  ]"
                  :value="getInlineReviewQuantity(row.item)"
                  placeholder="复核量"
                  :disabled="savingItemId === row.item.id"
                  @input="
                    onInlineInput(
                      row.item,
                      'reviewQuantity',
                      ($event.target as HTMLInputElement).value
                    )
                  "
                  @blur="saveInlineReview(row.item)"
                  @keydown.enter=";($event.target as HTMLInputElement).blur()"
                />
              </div>
              <span v-else class="text-foreground-3 block text-center">-</span>
            </td>

            <!-- 变更/签证量（可编辑） -->
            <td class="py-1 px-2 text-right bg-primary/5">
              <div
                v-if="row.item.type === 'ITEM'"
                class="flex items-center justify-end relative"
              >
                <input
                  type="number"
                  step="any"
                  aria-label="变更/签证量"
                  class="w-24 px-2 py-1 text-xs font-mono text-right bg-foundation rounded border transition shadow-inner"
                  :class="[
                    savedItemIds.has(row.item.id)
                      ? 'border-success ring-1 ring-success/40 bg-success-lighter/10 text-success'
                      : 'border-outline-3 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none'
                  ]"
                  :value="getInlineChangeQuantity(row.item)"
                  placeholder="变更量"
                  :disabled="savingItemId === row.item.id"
                  @input="
                    onInlineInput(
                      row.item,
                      'changeQuantity',
                      ($event.target as HTMLInputElement).value
                    )
                  "
                  @blur="saveInlineReview(row.item)"
                  @keydown.enter=";($event.target as HTMLInputElement).blur()"
                />
              </div>
              <span v-else class="text-foreground-3 block text-center">-</span>
            </td>

            <!-- 工程量（含签证变更）（不可编辑计算列） -->
            <td
              class="py-2 px-3 text-right font-mono font-medium text-foreground bg-primary/10"
            >
              {{ formatNumber(computeItemTotalQuantity(row.item), 2) }}
            </td>

            <!-- 复核单价（可编辑） -->
            <td class="py-1 px-2 text-right bg-primary/5">
              <div
                v-if="row.item.type === 'ITEM'"
                class="flex items-center justify-end relative"
              >
                <input
                  type="number"
                  step="any"
                  aria-label="复核单价"
                  class="w-24 px-2 py-1 text-xs font-mono text-right bg-foundation rounded border transition shadow-inner"
                  :class="[
                    savedItemIds.has(row.item.id)
                      ? 'border-success ring-1 ring-success/40 bg-success-lighter/10 text-success'
                      : 'border-outline-3 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none'
                  ]"
                  :value="getInlineReviewPrice(row.item)"
                  placeholder="复核单价"
                  :disabled="savingItemId === row.item.id"
                  @input="
                    onInlineInput(
                      row.item,
                      'reviewPrice',
                      ($event.target as HTMLInputElement).value
                    )
                  "
                  @blur="saveInlineReview(row.item)"
                  @keydown.enter=";($event.target as HTMLInputElement).blur()"
                />
              </div>
              <span v-else class="text-foreground-3 block text-center">-</span>
            </td>

            <!-- 复核总价（不可编辑计算列，上级汇总） -->
            <td
              class="py-2 px-3 text-right font-mono font-semibold text-primary bg-primary/10"
            >
              {{ formatNumber(computeItemReviewAmount(row.item), 2) }}
            </td>

            <!-- 操作 -->
            <td
              class="py-2 px-3 text-right sticky right-0 bg-foundation shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]"
            >
              <div class="flex items-center justify-end gap-1.5">
                <FormButton
                  v-if="hasFunctionalPerm('bill-management:edit')"
                  color="outline"
                  size="sm"
                  hide-text
                  :icon-left="PencilSquareIcon"
                  :disabled="rowMutationLoading"
                  @click.stop="handleEditItem(row.item)"
                />
                <FormButton
                  v-if="hasFunctionalPerm('bill-management:delete')"
                  color="outline"
                  size="sm"
                  hide-text
                  :icon-left="TrashIcon"
                  :disabled="rowMutationLoading"
                  @click.stop="handleDeleteItem(row.item)"
                />
                <FormButton
                  v-if="hasFunctionalPerm('bill-management:create')"
                  color="outline"
                  size="sm"
                  hide-text
                  :icon-left="PlusIcon"
                  :disabled="rowMutationLoading || !canCreateChild(row.item.type)"
                  @click.stop="handleCreateChildItem(row.item)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit/Delete/AddChild Dialog -->
    <LayoutDialog
      v-model:open="boqDialogOpen"
      max-width="md"
      :buttons="boqDialogButtons"
    >
      <template #header>{{ boqDialogTitle }}</template>
      <div v-if="boqDialogMode === 'delete'" class="text-body-sm text-foreground">
        确认删除清单「{{ boqDialogTarget?.name }}」及其子级吗？
      </div>
      <div v-else class="flex flex-col gap-3">
        <FormSelectBase
          v-if="showChildTypeSelect"
          v-model="boqDialogChildType"
          name="boq-child-type"
          label="下级类型"
          show-label
          show-required
          :rules="[isRequired]"
          :items="projectChildTypeOptions"
          :allow-unset="false"
        >
          <template #nothing-selected>请选择下级类型</template>
          <template #something-selected="{ value }">
            {{
              childTypeLabelMap[
                (Array.isArray(value) ? value[0] : value) as UiBoqItemType
              ]
            }}
          </template>
          <template #option="{ item }">
            {{ childTypeLabelMap[item as UiBoqItemType] }}
          </template>
        </FormSelectBase>
        <FormTextInput
          v-model="boqDialogCode"
          class="flex-1"
          :name="isCodePrefixLocked ? 'boq-code-suffix' : 'boq-code'"
          :label="isCodePrefixLocked ? '编码后缀' : '清单编码'"
          show-label
          show-required
          :rules="[isRequired]"
          :placeholder="isCodePrefixLocked ? activeCodeSuffixPlaceholder : '请输入编码'"
        >
          <template v-if="isCodePrefixLocked" #prefix>
            <span class="whitespace-nowrap">{{ activeCodePrefix }}</span>
          </template>
        </FormTextInput>
        <div v-if="boqDialogCodeError" class="text-body-3xs text-danger">
          {{ boqDialogCodeError }}
        </div>
        <FormTextInput
          v-model="boqDialogName"
          name="boq-name"
          label="清单名称"
          show-label
          show-required
          :rules="[isRequired]"
          placeholder="请输入名称"
        />
        <template v-if="isItemDetailsRequired">
          <FormSelectBase
            v-model="boqDialogUnit"
            name="boq-unit"
            label="计量单位"
            show-label
            show-required
            :rules="[isRequired]"
            :items="units"
            :allow-unset="false"
          >
            <template #nothing-selected>请选择计量单位</template>
            <template #something-selected="{ value }">
              {{ Array.isArray(value) ? value[0] : value }}
            </template>
            <template #option="{ item }">
              {{ item }}
            </template>
          </FormSelectBase>
          <div class="grid grid-cols-2 gap-3">
            <FormTextInput
              v-model="boqDialogQuantityInput"
              name="boq-quantity"
              label="合同工程量"
              type="number"
              step="any"
              show-label
              show-required
              :rules="[isRequired]"
              placeholder="请输入工程量"
            />
            <FormTextInput
              v-model="boqDialogPriceInput"
              name="boq-price"
              label="综合单价（元）"
              type="number"
              step="any"
              show-label
              show-required
              :rules="[isRequired]"
              placeholder="请输入综合单价"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <FormTextInput
              v-model="boqDialogReviewQuantityInput"
              name="boq-review-quantity"
              label="复核量"
              type="number"
              step="any"
              show-label
              placeholder="默认取合同量"
            />
            <FormTextInput
              v-model="boqDialogChangeQuantityInput"
              name="boq-change-quantity"
              label="变更/签证量"
              type="number"
              step="any"
              show-label
              placeholder="默认0"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <FormTextInput
              v-model="boqDialogReviewPriceInput"
              name="boq-review-price"
              label="复核单价（元）"
              type="number"
              step="any"
              show-label
              placeholder="默认取综合单价"
            />
            <div
              class="flex flex-col justify-center bg-foundation-2 p-2.5 rounded border border-outline-3"
            >
              <span class="text-xs text-foreground-2">工程量(含变更)</span>
              <span class="text-sm font-mono font-medium text-foreground">
                {{ formatNumber(dialogCalculatedTotalQty, 2) }}
              </span>
            </div>
          </div>
          <div
            class="p-2.5 bg-primary/10 rounded border border-primary/20 flex justify-between items-center"
          >
            <span class="text-xs text-primary font-medium">复核总价预估</span>
            <span class="text-base font-mono font-semibold text-primary">
              {{ formatNumber(dialogCalculatedReviewAmount, 2) }} 元
            </span>
          </div>
          <div v-if="boqDialogNumericError" class="text-body-3xs text-danger">
            {{ boqDialogNumericError }}
          </div>
        </template>
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline'
import { CommonLoadingIcon } from '@speckle/ui-components'
import { useMutation, useQuery } from '@vue/apollo-composable'
import { useDebounceFn } from '@vueuse/core'
import type {
  BoqItemType,
  ProjectBoqItemsQuery
} from '~/lib/common/generated/gql/graphql'
import { projectBoqItemsQuery } from '~/lib/projects/graphql/queries'
import {
  createBoqItemMutation,
  deleteBoqItemMutation,
  updateBoqItemMutation
} from '~/lib/projects/graphql/mutations'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { isRequired } from '~/lib/common/helpers/validation'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'
import { useAuthCookie } from '~~/lib/auth/composables/auth'
import { useApiOrigin } from '~~/composables/env'

const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const route = useRoute()
const { hasFunctionalPerm } = useCustomPermissions()
const projectId = computed(() => route.params.id as string)
const { triggerNotification } = useGlobalToast()
const boqImportInputRef = ref<HTMLInputElement | null>(null)
const exportingExcel = ref(false)
const importingExcel = ref(false)
const authToken = useAuthCookie()
const apiOrigin = useApiOrigin()

const updateDebouncedSearch = useDebounceFn((query: string) => {
  debouncedSearchQuery.value = query.trim()
}, 300)

watch(
  searchQuery,
  (newQuery) => {
    updateDebouncedSearch(newQuery)
  },
  { immediate: true }
)

const {
  result: boqItemsResult,
  loading: boqItemsLoading,
  refetch: boqItemsRefetch
} = useQuery(
  projectBoqItemsQuery,
  () => ({
    projectId: projectId.value,
    search: debouncedSearchQuery.value || null
  }),
  {
    enabled: computed(() => !!projectId.value)
  }
)
const { mutate: createBoqItem, loading: createBoqItemLoading } =
  useMutation(createBoqItemMutation)
const { mutate: updateBoqItem, loading: updateBoqItemLoading } =
  useMutation(updateBoqItemMutation)
const { mutate: deleteBoqItem, loading: deleteBoqItemLoading } =
  useMutation(deleteBoqItemMutation)

const units = [
  'm',
  '㎡',
  'm³',
  't',
  'kg',
  '项',
  '座',
  '套',
  '个',
  '组',
  '根',
  '块',
  '株/丛'
]

type BoqTreeItem = NonNullable<
  NonNullable<ProjectBoqItemsQuery['project']>['boqItems'][number]
>
type UiBoqItemType = BoqItemType | 'SUBPROJECT'

const items = computed(() => {
  return (boqItemsResult.value?.project?.boqItems || []).filter(
    (item): item is BoqTreeItem => !!item
  )
})
const isInitialLoading = computed(() => boqItemsLoading.value && !items.value.length)
const allItems = computed(() => {
  const flattened: BoqTreeItem[] = []
  const walk = (list: BoqTreeItem[]) => {
    list.forEach((item) => {
      flattened.push(item)
      if (item.children?.length) {
        walk(item.children as BoqTreeItem[])
      }
    })
  }
  walk(items.value)
  return flattened
})
const canInitializeBoq = computed(
  () => !boqItemsLoading.value && items.value.length === 0
)
const rowMutationLoading = computed(
  () =>
    createBoqItemLoading.value ||
    updateBoqItemLoading.value ||
    deleteBoqItemLoading.value
)

const refreshBoq = async () => {
  await boqItemsRefetch()
}

const initializeBoq = async () => {
  if (!canInitializeBoq.value || createBoqItemLoading.value) return
  const projectName = boqItemsResult.value?.project?.name?.trim() || '项目'
  await createBoqItem({
    input: {
      projectId: projectId.value,
      type: 'PROJECT' as BoqItemType,
      code: 'C01',
      name: projectName
    }
  })
  await refreshBoq()
}

const childTypeMap: Partial<Record<UiBoqItemType, UiBoqItemType[]>> = {
  PROJECT: ['SUBPROJECT', 'CATEGORY'],
  SUBPROJECT: ['CATEGORY'],
  CATEGORY: ['SECTION'],
  SECTION: ['SUBSECTION'],
  SUBSECTION: ['ITEM']
}

const childTypeLabelMap: Record<UiBoqItemType, string> = {
  PROJECT: '单位工程',
  SUBPROJECT: '子单位工程',
  CATEGORY: '分类工程',
  SECTION: '分部工程',
  SUBSECTION: '分项工程',
  ITEM: '清单项'
}

type BoqDialogMode = 'edit' | 'delete' | 'addChild'

const boqDialogOpen = ref(false)
const boqDialogMode = ref<BoqDialogMode>('edit')
const boqDialogTarget = ref<BoqTreeItem>()
const boqDialogCode = ref('')
const boqDialogName = ref('')
const boqDialogUnit = ref('')
const boqDialogQuantity = ref('')
const boqDialogPrice = ref('')
const boqDialogReviewQuantity = ref('')
const boqDialogChangeQuantity = ref('')
const boqDialogReviewPrice = ref('')
const boqDialogChildType = ref<UiBoqItemType | undefined>(undefined)
const boqDialogCodeError = ref('')
const boqDialogNumericError = ref('')

const itemById = computed(() => {
  return new Map(allItems.value.map((item) => [item.id, item]))
})
const notify = (title: string, type: ToastNotificationType, description?: string) => {
  triggerNotification({
    title,
    description,
    type
  })
}

// 树形表格展开与平铺
const expandedRows = ref<Set<string>>(new Set())

const collectExpandableIds = (list: BoqTreeItem[] = []): string[] => {
  return list.flatMap((item) => {
    const children = (item.children || []).filter((c): c is BoqTreeItem => !!c)
    if (!children.length) return []
    return [item.id, ...collectExpandableIds(children)]
  })
}

watch(
  items,
  (newItems) => {
    if (newItems.length && expandedRows.value.size === 0) {
      expandedRows.value = new Set(collectExpandableIds(newItems))
    }
  },
  { immediate: true, deep: true }
)

const isRowExpanded = (item: BoqTreeItem): boolean => {
  return expandedRows.value.has(item.id)
}

const toggleRow = (item: BoqTreeItem) => {
  const updated = new Set(expandedRows.value)
  if (updated.has(item.id)) {
    updated.delete(item.id)
  } else {
    updated.add(item.id)
  }
  expandedRows.value = updated
}

type FlatRowItem = {
  item: BoqTreeItem
  depth: number
  hasChildren: boolean
}

const flatItems = computed<FlatRowItem[]>(() => {
  const rows: FlatRowItem[] = []
  const traverse = (list: BoqTreeItem[], depth: number) => {
    list.forEach((item) => {
      const children = (item.children || []).filter((c): c is BoqTreeItem => !!c)
      const hasChildren = children.length > 0
      rows.push({ item, depth, hasChildren })
      if (hasChildren && expandedRows.value.has(item.id)) {
        traverse(children, depth + 1)
      }
    })
  }
  traverse(items.value, 0)
  return rows
})

// 行内编辑数据缓存与响应式计算
const inlineEditValues = reactive<
  Record<
    string,
    {
      reviewQuantity?: string
      changeQuantity?: string
      reviewPrice?: string
    }
  >
>({})
const localItemOverrides = reactive<
  Record<
    string,
    {
      reviewQuantity?: number | null
      changeQuantity?: number | null
      totalQuantityWithChanges?: number | null
      reviewPrice?: number | null
      reviewAmount?: number | null
    }
  >
>({})
const savingItemId = ref<string | null>(null)
const savedItemIds = ref<Set<string>>(new Set())

const getInlineReviewQuantity = (item: BoqTreeItem): string => {
  if (inlineEditValues[item.id]?.reviewQuantity !== undefined) {
    return inlineEditValues[item.id].reviewQuantity!
  }
  const override = localItemOverrides[item.id]?.reviewQuantity
  if (override !== undefined && override !== null) {
    return `${override}`
  }
  if (item.reviewQuantity !== null && item.reviewQuantity !== undefined) {
    return `${item.reviewQuantity}`
  }
  return item.quantity !== null && item.quantity !== undefined ? `${item.quantity}` : ''
}

const getInlineChangeQuantity = (item: BoqTreeItem): string => {
  if (inlineEditValues[item.id]?.changeQuantity !== undefined) {
    return inlineEditValues[item.id].changeQuantity!
  }
  const override = localItemOverrides[item.id]?.changeQuantity
  if (override !== undefined && override !== null) {
    return `${override}`
  }
  if (item.changeQuantity !== null && item.changeQuantity !== undefined) {
    return `${item.changeQuantity}`
  }
  return '0'
}

const getInlineReviewPrice = (item: BoqTreeItem): string => {
  if (inlineEditValues[item.id]?.reviewPrice !== undefined) {
    return inlineEditValues[item.id].reviewPrice!
  }
  const override = localItemOverrides[item.id]?.reviewPrice
  if (override !== undefined && override !== null) {
    return `${override}`
  }
  if (item.reviewPrice !== null && item.reviewPrice !== undefined) {
    return `${item.reviewPrice}`
  }
  return item.price !== null && item.price !== undefined ? `${item.price}` : ''
}

const onInlineInput = (
  item: BoqTreeItem,
  field: 'reviewQuantity' | 'changeQuantity' | 'reviewPrice',
  value: string
) => {
  if (!inlineEditValues[item.id]) {
    inlineEditValues[item.id] = {}
  }
  inlineEditValues[item.id][field] = value
}

const computeItemTotalQuantity = (item: BoqTreeItem): number | null => {
  if (item.type !== 'ITEM') return null
  const rqStr = getInlineReviewQuantity(item)
  const cqStr = getInlineChangeQuantity(item)
  if (rqStr === '' && cqStr === '') return null
  const rq = rqStr === '' ? 0 : Number.parseFloat(rqStr)
  const cq = cqStr === '' ? 0 : Number.parseFloat(cqStr)
  if (Number.isNaN(rq) || Number.isNaN(cq)) return null
  return Number((rq + cq).toFixed(6))
}

const computeItemReviewAmount = (item: BoqTreeItem): number | null => {
  if (item.type === 'ITEM') {
    const rpStr = getInlineReviewPrice(item)
    const totalQty = computeItemTotalQuantity(item)
    if (rpStr === '' || totalQty === null) return null
    const rp = Number.parseFloat(rpStr)
    if (Number.isNaN(rp)) return null
    return Number((rp * totalQty).toFixed(2))
  }
  if (item.children && item.children.length > 0) {
    let sum = 0
    let hasVal = false
    const walk = (childList: (BoqTreeItem | null | undefined)[]) => {
      childList.forEach((c) => {
        if (!c) return
        const val = computeItemReviewAmount(c)
        if (val !== null && !Number.isNaN(val)) {
          sum += val
          hasVal = true
        }
      })
    }
    walk(item.children as (BoqTreeItem | null | undefined)[])
    return hasVal ? Number(sum.toFixed(2)) : null
  }
  const overrideAmount = localItemOverrides[item.id]?.reviewAmount
  if (overrideAmount !== undefined && overrideAmount !== null) {
    return overrideAmount
  }
  return item.reviewAmount ?? null
}

const saveInlineReview = async (item: BoqTreeItem) => {
  if (item.type !== 'ITEM') return
  const currentEdit = inlineEditValues[item.id]
  if (!currentEdit) return

  const rqStr = getInlineReviewQuantity(item)
  const cqStr = getInlineChangeQuantity(item)
  const rpStr = getInlineReviewPrice(item)

  const parseVal = (str: string) => {
    if (str.trim() === '') return null
    const parsed = Number.parseFloat(str.trim())
    return Number.isNaN(parsed) ? null : parsed
  }

  const reviewQuantity = parseVal(rqStr)
  const changeQuantity = parseVal(cqStr)
  const reviewPrice = parseVal(rpStr)

  try {
    savingItemId.value = item.id
    const res = await $fetch<{
      success: boolean
      item: {
        reviewQuantity?: number | null
        changeQuantity?: number | null
        totalQuantityWithChanges?: number | null
        reviewPrice?: number | null
        reviewAmount?: number | null
      }
    }>(`${apiOrigin}/api/v1/projects/${projectId.value}/boq/items/${item.id}/review`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken.value}`,
        'Content-Type': 'application/json'
      },
      body: {
        reviewQuantity,
        changeQuantity,
        reviewPrice
      }
    })
    if (res?.success && res.item) {
      // 1. 使用 localItemOverrides 就地响应，完全避开直接向 Apollo 冻结对象属性赋值
      localItemOverrides[item.id] = {
        reviewQuantity: res.item.reviewQuantity,
        changeQuantity: res.item.changeQuantity,
        totalQuantityWithChanges: res.item.totalQuantityWithChanges,
        reviewPrice: res.item.reviewPrice,
        reviewAmount: res.item.reviewAmount
      }
      delete inlineEditValues[item.id]

      // 2. 触发微状态成功动画（轻微绿框提示），无需任何粗暴弹窗
      savedItemIds.value.add(item.id)
      setTimeout(() => {
        savedItemIds.value.delete(item.id)
      }, 1500)

      // 3. 在后台静默触发数据拉取以同步上级汇总，不重新销毁/卸载表格
      boqItemsRefetch?.().catch(() => {})
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    notify('保存失败', ToastNotificationType.Danger, message)
  } finally {
    savingItemId.value = null
  }
}

const getRequestErrorMessage = (error: unknown) => {
  const fetchError = error as
    | (Error & {
        data?: {
          error?: string
          message?: string
        }
        statusMessage?: string
      })
    | null

  const serverMessage =
    fetchError?.data?.error || fetchError?.data?.message || fetchError?.statusMessage

  if (typeof serverMessage === 'string' && serverMessage.trim().length) {
    return serverMessage.trim()
  }

  return error instanceof Error ? error.message : String(error)
}

const formatBoqImportErrorMessage = (error: unknown) => {
  const message = getRequestErrorMessage(error)
  const rowMatch = message.match(/第\s*(\d+)\s*行/)

  if (message.includes('缺少必要字段（清单编码/清单名称/类型）')) {
    const rowHint = rowMatch?.[1]
      ? `请检查 Excel 第 ${rowMatch[1]} 行是否填写了“清单编码”“清单名称”“类型”三列。`
      : '请检查 Excel 中是否填写了“清单编码”“清单名称”“类型”三列。'
    return `${message} ${rowHint}`
  }

  if (message.includes('模板缺少必要列')) {
    return `${message} 请使用“清单模板”按钮下载最新模板，并确认表头包含“清单编码”“清单名称”“类型”。`
  }

  return message
}

const triggerImportExcel = () => {
  if (importingExcel.value) return
  boqImportInputRef.value?.click()
}

const handleExportExcel = async () => {
  if (exportingExcel.value) return
  exportingExcel.value = true
  try {
    const res = await $fetch<Blob>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/boq/export-excel`,
      {
        headers: {
          Authorization: `Bearer ${authToken.value}`
        },
        responseType: 'blob'
      }
    )
    const blob = new Blob([res], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const projectName = boqItemsResult.value?.project?.name?.trim() || '项目'
    const safeProjectName = projectName.replace(/[\\/:*?"<>|]/g, '_')
    link.href = url
    link.download = `${safeProjectName}-清单.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    notify('清单导出成功', ToastNotificationType.Success)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    notify('清单导出失败', ToastNotificationType.Danger, message)
  } finally {
    exportingExcel.value = false
  }
}

const handleDownloadTemplate = async () => {
  try {
    const res = await $fetch<Blob>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/boq/export-excel?template=true`,
      {
        headers: {
          Authorization: `Bearer ${authToken.value}`
        },
        responseType: 'blob'
      }
    )
    const blob = new Blob([res], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const projectName = boqItemsResult.value?.project?.name?.trim() || '项目'
    const safeProjectName = projectName.replace(/[\\/:*?"<>|]/g, '_')
    link.href = url
    link.download = `${safeProjectName}-清单模板.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    notify('清单模板下载成功', ToastNotificationType.Success)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    notify('模板下载失败', ToastNotificationType.Danger, message)
  }
}

const handleImportFileChange = async (event: Event) => {
  if (importingExcel.value) return
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  importingExcel.value = true
  try {
    const body = new FormData()
    body.append('file', file)

    const res = await $fetch<{
      success: boolean
      createdCount: number
      updatedCount: number
    }>(`${apiOrigin}/api/v1/projects/${projectId.value}/boq/import-excel`, {
      method: 'POST',
      body,
      headers: {
        Authorization: `Bearer ${authToken.value}`
      }
    })

    if (!res?.success) {
      throw new Error('导入失败，服务器没有返回成功状态')
    }

    await refreshBoq()
    notify(
      '清单导入成功',
      ToastNotificationType.Success,
      `新增 ${res.createdCount} 条，更新 ${res.updatedCount} 条`
    )
  } catch (error) {
    const message = formatBoqImportErrorMessage(error)
    notify('清单导入失败', ToastNotificationType.Danger, message)
  } finally {
    importingExcel.value = false
    if (input) input.value = ''
  }
}

const boqDialogQuantityInput = computed({
  get: () => `${boqDialogQuantity.value ?? ''}`,
  set: (val: string | number) => {
    boqDialogQuantity.value = `${val ?? ''}`
  }
})

const boqDialogPriceInput = computed({
  get: () => `${boqDialogPrice.value ?? ''}`,
  set: (val: string | number) => {
    boqDialogPrice.value = `${val ?? ''}`
  }
})

const boqDialogReviewQuantityInput = computed({
  get: () => `${boqDialogReviewQuantity.value ?? ''}`,
  set: (val: string | number) => {
    boqDialogReviewQuantity.value = `${val ?? ''}`
  }
})

const boqDialogChangeQuantityInput = computed({
  get: () => `${boqDialogChangeQuantity.value ?? ''}`,
  set: (val: string | number) => {
    boqDialogChangeQuantity.value = `${val ?? ''}`
  }
})

const boqDialogReviewPriceInput = computed({
  get: () => `${boqDialogReviewPrice.value ?? ''}`,
  set: (val: string | number) => {
    boqDialogReviewPrice.value = `${val ?? ''}`
  }
})

const dialogCalculatedTotalQty = computed(() => {
  const rq = Number.parseFloat(boqDialogReviewQuantity.value || '0') || 0
  const cq = Number.parseFloat(boqDialogChangeQuantity.value || '0') || 0
  return Number((rq + cq).toFixed(6))
})

const dialogCalculatedReviewAmount = computed(() => {
  const rp =
    Number.parseFloat(boqDialogReviewPrice.value || boqDialogPrice.value || '0') || 0
  return Number((rp * dialogCalculatedTotalQty.value).toFixed(2))
})

const dialogWorkingType = computed<UiBoqItemType | undefined>(() => {
  if (!boqDialogTarget.value) return undefined
  if (boqDialogMode.value === 'addChild') {
    if (boqDialogTarget.value.type === 'PROJECT') {
      const selectedType = boqDialogChildType.value
      return selectedType ? selectedType : undefined
    }
    return childTypeMap[boqDialogTarget.value.type]?.[0]
  }
  return boqDialogTarget.value.type as UiBoqItemType
})

const projectChildTypeOptions = computed<UiBoqItemType[]>(() => {
  return ['SUBPROJECT', 'CATEGORY']
})

const showChildTypeSelect = computed(() => {
  return boqDialogMode.value === 'addChild' && boqDialogTarget.value?.type === 'PROJECT'
})

const activeCodePrefix = computed(() => {
  if (!boqDialogTarget.value) return ''
  if (boqDialogMode.value === 'addChild') return ''
  const workingType = dialogWorkingType.value
  if (!workingType) return ''
  if (!['SECTION', 'SUBSECTION', 'ITEM'].includes(workingType)) return ''

  const parent = boqDialogTarget.value.parentId
    ? itemById.value.get(boqDialogTarget.value.parentId)
    : undefined
  return parent?.code || ''
})

const activeCodeSuffixLength = computed(() => {
  const workingType = dialogWorkingType.value
  if (workingType === 'SECTION') return 2
  if (workingType === 'SUBSECTION') return 2
  if (workingType === 'ITEM') return 6
  return null
})

const isCodePrefixLocked = computed(() => {
  return !!activeCodePrefix.value.length && activeCodeSuffixLength.value !== null
})
const isItemDetailsRequired = computed(() => dialogWorkingType.value === 'ITEM')

const activeCodeSuffixPlaceholder = computed(() => {
  const len = activeCodeSuffixLength.value
  return len ? `请输入${len}位数字` : '请输入编码'
})

const boqDialogTitle = computed(() => {
  if (boqDialogMode.value === 'delete') return '删除清单'
  if (boqDialogMode.value === 'addChild') {
    const targetType = boqDialogTarget.value?.type as UiBoqItemType | undefined
    if (targetType === 'PROJECT') {
      if (boqDialogChildType.value === 'SUBPROJECT') return '新增子项目'
      if (boqDialogChildType.value === 'CATEGORY') return '新增分类'
      return '新增下级'
    }
    if (targetType === 'SUBPROJECT') return '新增分类'
    if (targetType === 'CATEGORY') return '新增分部'
    if (targetType === 'SECTION') return '新增分项'
    if (targetType === 'SUBSECTION') return '新增具体项'
    return '新增下级'
  }
  return '编辑清单'
})

const openEditDialog = (item: BoqTreeItem) => {
  boqDialogMode.value = 'edit'
  boqDialogTarget.value = item
  boqDialogCodeError.value = ''
  boqDialogNumericError.value = ''
  if (isCodePrefixLocked.value) {
    const prefix = activeCodePrefix.value
    boqDialogCode.value = item.code.startsWith(prefix)
      ? item.code.slice(prefix.length)
      : ''
  } else {
    boqDialogCode.value = item.code
  }
  boqDialogName.value = item.name
  boqDialogUnit.value = item.unit || ''
  boqDialogQuantity.value =
    item.quantity === null || item.quantity === undefined ? '' : `${item.quantity}`
  boqDialogPrice.value =
    item.price === null || item.price === undefined ? '' : `${item.price}`
  boqDialogReviewQuantity.value =
    item.reviewQuantity !== null && item.reviewQuantity !== undefined
      ? `${item.reviewQuantity}`
      : item.quantity !== null && item.quantity !== undefined
      ? `${item.quantity}`
      : ''
  boqDialogChangeQuantity.value =
    item.changeQuantity !== null && item.changeQuantity !== undefined
      ? `${item.changeQuantity}`
      : '0'
  boqDialogReviewPrice.value =
    item.reviewPrice !== null && item.reviewPrice !== undefined
      ? `${item.reviewPrice}`
      : item.price !== null && item.price !== undefined
      ? `${item.price}`
      : ''
  boqDialogOpen.value = true
}

const openDeleteDialog = (item: BoqTreeItem) => {
  boqDialogMode.value = 'delete'
  boqDialogTarget.value = item
  boqDialogCodeError.value = ''
  boqDialogNumericError.value = ''
  boqDialogCode.value = ''
  boqDialogName.value = ''
  boqDialogUnit.value = ''
  boqDialogQuantity.value = ''
  boqDialogPrice.value = ''
  boqDialogReviewQuantity.value = ''
  boqDialogChangeQuantity.value = ''
  boqDialogReviewPrice.value = ''
  boqDialogChildType.value = undefined
  boqDialogOpen.value = true
}

const openAddChildDialog = (item: BoqTreeItem) => {
  if (!childTypeMap[item.type]) return
  boqDialogMode.value = 'addChild'
  boqDialogTarget.value = item
  boqDialogCodeError.value = ''
  boqDialogNumericError.value = ''
  boqDialogCode.value = ''
  boqDialogName.value = ''
  boqDialogUnit.value = ''
  boqDialogQuantity.value = ''
  boqDialogPrice.value = ''
  boqDialogReviewQuantity.value = ''
  boqDialogChangeQuantity.value = ''
  boqDialogReviewPrice.value = ''
  boqDialogChildType.value = undefined
  boqDialogOpen.value = true
}

const canCreateChild = (type: UiBoqItemType) => {
  return !!childTypeMap[type]?.length
}

const handleEditItem = async (item: BoqTreeItem) => {
  openEditDialog(item)
}

const handleDeleteItem = async (item: BoqTreeItem) => {
  openDeleteDialog(item)
}

const handleCreateChildItem = async (item: BoqTreeItem) => {
  openAddChildDialog(item)
}

watch(boqDialogCode, () => {
  boqDialogCodeError.value = ''
})
watch(
  [
    boqDialogQuantity,
    boqDialogPrice,
    boqDialogReviewQuantity,
    boqDialogChangeQuantity,
    boqDialogReviewPrice
  ],
  () => {
    boqDialogNumericError.value = ''
  }
)

const submitBoqDialog = async () => {
  const target = boqDialogTarget.value
  if (!target) return

  if (boqDialogMode.value === 'delete') {
    await deleteBoqItem({
      input: {
        projectId: projectId.value,
        itemId: target.id,
        cascade: true
      }
    })
    boqDialogOpen.value = false
    await refreshBoq()
    return
  }

  const codeInput = boqDialogCode.value.trim()
  const nextName = boqDialogName.value.trim()
  if (!codeInput.length || !nextName.length) return

  let nextCode = codeInput
  boqDialogCodeError.value = ''
  if (isCodePrefixLocked.value) {
    const suffixLength = activeCodeSuffixLength.value || 0
    if (codeInput.length !== suffixLength || !/^\d+$/.test(codeInput)) {
      boqDialogCodeError.value = `编码后缀必须是${suffixLength}位数字`
      return
    }
    nextCode = `${activeCodePrefix.value}${codeInput}`
  }

  const duplicatedItem = allItems.value.find(
    (item) =>
      item.code === nextCode &&
      (boqDialogMode.value !== 'edit' || item.id !== target.id)
  )
  if (duplicatedItem) {
    boqDialogCodeError.value = '清单编码已存在，请修改后重试'
    return
  }

  let nextUnit: string | null = null
  let nextQuantity: number | null = null
  let nextPrice: number | null = null
  let nextReviewQuantity: number | null = null
  let nextChangeQuantity: number | null = null
  let nextReviewPrice: number | null = null

  boqDialogNumericError.value = ''
  if (isItemDetailsRequired.value) {
    const unitInput = boqDialogUnit.value.trim()
    const quantityInput = boqDialogQuantity.value.trim()
    const priceInput = boqDialogPrice.value.trim()
    if (!unitInput.length || !quantityInput.length || !priceInput.length) return

    const quantity = Number.parseFloat(quantityInput)
    const price = Number.parseFloat(priceInput)
    if (Number.isNaN(quantity) || Number.isNaN(price)) {
      boqDialogNumericError.value = '工程量和综合单价必须为数字'
      return
    }

    nextUnit = unitInput
    nextQuantity = quantity
    nextPrice = price

    if (boqDialogReviewQuantity.value.trim().length) {
      const parsed = Number.parseFloat(boqDialogReviewQuantity.value.trim())
      if (!Number.isNaN(parsed)) nextReviewQuantity = parsed
    }
    if (boqDialogChangeQuantity.value.trim().length) {
      const parsed = Number.parseFloat(boqDialogChangeQuantity.value.trim())
      if (!Number.isNaN(parsed)) nextChangeQuantity = parsed
    }
    if (boqDialogReviewPrice.value.trim().length) {
      const parsed = Number.parseFloat(boqDialogReviewPrice.value.trim())
      if (!Number.isNaN(parsed)) nextReviewPrice = parsed
    }
  }

  try {
    if (boqDialogMode.value === 'edit') {
      await updateBoqItem({
        input: {
          projectId: projectId.value,
          itemId: target.id,
          code: nextCode,
          name: nextName,
          unit: nextUnit,
          quantity: nextQuantity,
          price: nextPrice,
          reviewQuantity: nextReviewQuantity,
          changeQuantity: nextChangeQuantity,
          reviewPrice: nextReviewPrice
        }
      })
      boqDialogOpen.value = false
      await refreshBoq()
      return
    }

    const childType =
      target.type === 'PROJECT'
        ? boqDialogChildType.value || undefined
        : childTypeMap[target.type]?.[0]
    if (!childType) return

    await createBoqItem({
      input: {
        projectId: projectId.value,
        parentId: target.id,
        type: childType as unknown as BoqItemType,
        code: nextCode,
        name: nextName,
        unit: nextUnit,
        quantity: nextQuantity,
        price: nextPrice,
        reviewQuantity: nextReviewQuantity,
        changeQuantity: nextChangeQuantity,
        reviewPrice: nextReviewPrice
      }
    })
    boqDialogOpen.value = false
    await refreshBoq()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('boq_items_projectid_code_unique')) {
      boqDialogCodeError.value = '清单编码已存在，请修改后重试'
      return
    }
    throw error
  }
}

const boqDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: {},
    onClick: () => {
      boqDialogOpen.value = false
    }
  },
  {
    text: boqDialogMode.value === 'delete' ? '删除' : '保存',
    props: {
      disabled:
        rowMutationLoading.value ||
        (boqDialogMode.value !== 'delete' &&
          ((showChildTypeSelect.value && !boqDialogChildType.value) ||
            !boqDialogCode.value.trim().length ||
            !boqDialogName.value.trim().length ||
            (isItemDetailsRequired.value &&
              (!boqDialogUnit.value.trim().length ||
                !boqDialogQuantity.value.trim().length ||
                !boqDialogPrice.value.trim().length)) ||
            !!boqDialogNumericError.value.length ||
            !!boqDialogCodeError.value.length))
    },
    onClick: () => {
      submitBoqDialog()
    }
  }
])

const formatNumber = (value: number | null | undefined, fractionDigits?: number) => {
  if (value === null || value === undefined) return '-'
  if (fractionDigits === undefined) return value
  return value.toFixed(fractionDigits)
}
</script>
