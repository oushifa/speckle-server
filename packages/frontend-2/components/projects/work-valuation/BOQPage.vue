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
          color="outline"
          :icon-left="ArrowDownTrayIcon"
          :disabled="boqItemsLoading || exportingExcel || !allItems.length"
          @click="handleExportExcel"
        >
          导出Excel
        </FormButton>
        <FormButton
          color="outline"
          :icon-left="ArrowUpTrayIcon"
          :disabled="rowMutationLoading || importingExcel"
          @click="triggerImportExcel"
        >
          导入Excel
        </FormButton>
        <FormButton
          v-if="!canInitializeBoq"
          color="outline"
          :icon-left="DocumentTextIcon"
        >
          清单模板
        </FormButton>
        <FormButton
          v-if="canInitializeBoq"
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
    <!-- Table -->
    <LayoutTable
      :columns="columns"
      :items="items"
      :loading="boqItemsLoading"
      empty-message="暂无清单数据"
      class="w-full"
    >
      <template #code="{ item }">
        <a href="#" class="text-primary hover:underline font-medium">
          {{ item.code }}
        </a>
      </template>

      <template #name="{ item }">
        <a href="#" class="text-primary hover:underline font-medium">
          {{ item.name }}
        </a>
      </template>

      <template #unit="{ item }">
        <span class="text-foreground">{{ item.unit }}</span>
      </template>

      <template #type="{ item }">
        <span class="text-foreground">{{ childTypeLabelMap[item.type] }}</span>
      </template>

      <template #quantity="{ item }">
        <span class="text-foreground">{{ formatNumber(item.quantity, 2) }}</span>
      </template>

      <template #price="{ item }">
        <span class="text-foreground">{{ formatNumber(item.price, 2) }}</span>
      </template>

      <template #actions="{ item }">
        <div class="flex items-center justify-end gap-2">
          <FormButton
            color="outline"
            size="sm"
            hide-text
            :icon-left="PencilSquareIcon"
            :disabled="rowMutationLoading"
            @click.stop="handleEditItem(item)"
          />
          <FormButton
            color="outline"
            size="sm"
            hide-text
            :icon-left="TrashIcon"
            :disabled="rowMutationLoading"
            @click.stop="handleDeleteItem(item)"
          />
          <FormButton
            color="outline"
            size="sm"
            hide-text
            :icon-left="PlusIcon"
            :disabled="rowMutationLoading || !canCreateChild(item.type)"
            @click.stop="handleCreateChildItem(item)"
          />
        </div>
      </template>
    </LayoutTable>
    <LayoutDialog
      v-model:open="boqDialogOpen"
      max-width="sm"
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
          <FormTextInput
            v-model="boqDialogQuantityInput"
            name="boq-quantity"
            label="工程量"
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
  TrashIcon
} from '@heroicons/vue/24/outline'
import { useMutation, useQuery } from '@vue/apollo-composable'
import { useDebounceFn } from '@vueuse/core'
import * as XLSX from 'xlsx'
import type {
  BoqItemType,
  ProjectBoqItemsQuery
} from '~/lib/common/generated/gql/graphql'
import { projectBoqItemsQuery } from '~/lib/projects/graphql/queries'
import {
  createBoqItemMutation,
  deleteBoqItemMutation,
  importBoqItemsMutation,
  updateBoqItemMutation
} from '~/lib/projects/graphql/mutations'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { isRequired } from '~/lib/common/helpers/validation'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const route = useRoute()
const projectId = computed(() => route.params.id as string)
const { triggerNotification } = useGlobalToast()
const boqImportInputRef = ref<HTMLInputElement | null>(null)
const exportingExcel = ref(false)
const importingExcel = ref(false)

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
const { mutate: importBoqItems } = useMutation(importBoqItemsMutation)

const columns = [
  { id: 'code', header: '清单编码', classes: 'col-span-3' },
  { id: 'name', header: '名称', classes: 'col-span-2' },
  { id: 'type', header: '类型', classes: 'col-span-1' },
  { id: 'unit', header: '计量单位', classes: 'col-span-1' },
  { id: 'quantity', header: '工程量', classes: 'col-span-2' },
  { id: 'price', header: '综合单价（元）', classes: 'col-span-2' },
  { id: 'actions', header: '操作', classes: 'col-span-1 text-right' }
]

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

type ImportBoqRow = {
  rowNumber: number
  code: string
  name: string
  type: BoqItemType
  parentCode: string | null
  unit: string | null
  quantity: number | null
  price: number | null
}

const boqTypeByLabel: Record<string, BoqItemType> = {
  PROJECT: 'PROJECT',
  SUBPROJECT: 'SUBPROJECT',
  CATEGORY: 'CATEGORY',
  SECTION: 'SECTION',
  SUBSECTION: 'SUBSECTION',
  ITEM: 'ITEM',
  单位工程: 'PROJECT',
  子单位工程: 'SUBPROJECT',
  分类工程: 'CATEGORY',
  分部工程: 'SECTION',
  分项工程: 'SUBSECTION',
  清单项: 'ITEM'
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

const parseType = (value: string): BoqItemType | null => {
  const normalized = value.trim()
  if (!normalized.length) return null
  const upperValue = normalized.toUpperCase()
  return boqTypeByLabel[upperValue] || boqTypeByLabel[normalized] || null
}

const parseOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed.length) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isNaN(parsed) ? Number.NaN : parsed
}

const triggerImportExcel = () => {
  if (importingExcel.value) return
  boqImportInputRef.value?.click()
}

const handleExportExcel = async () => {
  if (!allItems.value.length || exportingExcel.value) return
  exportingExcel.value = true
  try {
    const header = [
      '清单编码',
      '清单名称',
      '类型',
      '上级编码',
      '计量单位',
      '工程量',
      '综合单价（元）'
    ]
    const rows = allItems.value.map((item) => {
      const parentCode = item.parentId
        ? itemById.value.get(item.parentId)?.code || ''
        : ''
      return [
        item.code,
        item.name,
        childTypeLabelMap[item.type as UiBoqItemType],
        parentCode,
        item.unit || '',
        item.quantity ?? '',
        item.price ?? ''
      ]
    })
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BOQ')
    const fileContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([fileContent], {
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

const parseImportRows = (sheet: XLSX.WorkSheet) => {
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: ''
  })
  if (matrix.length < 2) {
    throw new Error('Excel 中没有可导入的数据')
  }

  const headerRow = matrix[0].map((cell: string | number | null) =>
    String(cell ?? '').trim()
  )
  const findHeaderIndex = (keys: string[]) => {
    const idx = headerRow.findIndex((cell: string) => keys.includes(cell))
    return idx
  }

  const codeIndex = findHeaderIndex(['清单编码', '编码'])
  const nameIndex = findHeaderIndex(['清单名称', '名称'])
  const typeIndex = findHeaderIndex(['类型'])
  const parentCodeIndex = findHeaderIndex(['上级编码', '父级编码'])
  const unitIndex = findHeaderIndex(['计量单位', '单位'])
  const quantityIndex = findHeaderIndex(['工程量'])
  const priceIndex = findHeaderIndex(['综合单价（元）', '综合单价', '单价'])

  if (codeIndex < 0 || nameIndex < 0 || typeIndex < 0) {
    throw new Error('模板缺少必要列：清单编码、清单名称、类型')
  }

  const importRows: ImportBoqRow[] = []
  const codesInFile = new Set<string>()

  matrix.slice(1).forEach((row: Array<string | number | null>, index: number) => {
    const rowNumber = index + 2
    const readValue = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return String(row[cellIndex] ?? '').trim()
    }

    const code = readValue(codeIndex)
    const name = readValue(nameIndex)
    const rawType = readValue(typeIndex)
    const parentCode = readValue(parentCodeIndex)
    const unit = readValue(unitIndex)
    const quantityValue = readValue(quantityIndex)
    const priceValue = readValue(priceIndex)

    if (
      !code &&
      !name &&
      !rawType &&
      !parentCode &&
      !unit &&
      !quantityValue &&
      !priceValue
    )
      return
    if (!code || !name || !rawType) {
      throw new Error(`第 ${rowNumber} 行缺少必要字段（清单编码/清单名称/类型）`)
    }
    if (codesInFile.has(code)) {
      throw new Error(`第 ${rowNumber} 行清单编码重复：${code}`)
    }
    codesInFile.add(code)

    const type = parseType(rawType)
    if (!type) {
      throw new Error(`第 ${rowNumber} 行类型无法识别：${rawType}`)
    }

    const quantity = parseOptionalNumber(quantityValue)
    const price = parseOptionalNumber(priceValue)

    if (
      (quantityValue && Number.isNaN(quantity)) ||
      (priceValue && Number.isNaN(price))
    ) {
      throw new Error(`第 ${rowNumber} 行工程量或综合单价不是有效数字`)
    }

    if (type === 'ITEM') {
      if (!unit.length || quantity === null || price === null) {
        throw new Error(`第 ${rowNumber} 行清单项需填写计量单位、工程量、综合单价`)
      }
    }

    if (type !== 'PROJECT' && !parentCode.length) {
      throw new Error(`第 ${rowNumber} 行非单位工程必须填写上级编码`)
    }

    if (type === 'PROJECT' && parentCode.length) {
      throw new Error(`第 ${rowNumber} 行单位工程不能填写上级编码`)
    }

    importRows.push({
      rowNumber,
      code,
      name,
      type,
      parentCode: parentCode || null,
      unit: type === 'ITEM' ? unit : null,
      quantity: type === 'ITEM' ? quantity : null,
      price: type === 'ITEM' ? price : null
    })
  })

  if (!importRows.length) {
    throw new Error('Excel 中没有可导入的数据')
  }

  return importRows
}

const handleImportFileChange = async (event: Event) => {
  if (importingExcel.value) return
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  importingExcel.value = true
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('Excel 中未找到工作表')
    }
    const sheet = workbook.Sheets[firstSheetName]
    const rows = parseImportRows(sheet)
    const result = await importBoqItems({
      input: {
        projectId: projectId.value,
        items: rows.map((row) => ({
          rowNumber: row.rowNumber,
          code: row.code,
          name: row.name,
          type: row.type,
          parentCode: row.parentCode,
          unit: row.unit,
          quantity: row.quantity,
          price: row.price
        }))
      }
    })
    const importResult = result?.data?.projectMutations?.boqMutations?.importItems
    if (!importResult) {
      throw new Error('导入失败，请稍后重试')
    }
    await refreshBoq()
    notify(
      '清单导入成功',
      ToastNotificationType.Success,
      `新增 ${importResult.createdCount} 条，更新 ${importResult.updatedCount} 条`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
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
watch([boqDialogQuantity, boqDialogPrice], () => {
  boqDialogNumericError.value = ''
})

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
          price: nextPrice
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
        price: nextPrice
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
