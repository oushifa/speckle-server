<template>
  <div
    class="flex-1 min-h-0 border border-outline-3 rounded-lg overflow-hidden flex flex-col bg-foundation"
  >
    <div
      ref="tableContainerRef"
      class="h-full overflow-auto overscroll-contain select-none"
    >
      <div :style="{ minWidth: `${totalBaseWidth}px` }">
        <!-- ── 表头（吸顶） ── -->
        <div
          class="flex bg-foundation-2 border-b border-outline-3 text-[12px] font-semibold text-foreground-2 sticky top-0 z-10 shadow-sm"
        >
          <div
            v-for="(c, i) in cols"
            :key="c.key"
            class="relative px-2 py-2.5 flex items-center shrink-0"
            :class="[alignClass(c.align)]"
            :style="colStyle(i)"
          >
            <span class="truncate w-full">{{ c.label }}</span>
            <!-- 拖拽手柄 -->
            <button
              v-if="i < cols.length - 1"
              type="button"
              class="absolute right-0 top-0 h-full w-1.5 block cursor-col-resize hover:bg-primary/50 transition-colors z-20"
              title="按住拖拽调整列宽"
              @mousedown.prevent="onMouseDown(i, $event)"
            />
          </div>
        </div>

        <!-- ── 表体 ── -->
        <div
          v-if="rows.length === 0"
          class="min-h-[220px] flex flex-col items-center justify-center text-xs text-foreground-3 py-16"
        >
          <p>暂无明细数据</p>
          <p v-if="isDraftEditable" class="mt-1 text-foreground-2">
            请点击右上角「新增清单项」添加明细
          </p>
        </div>

        <div v-else class="divide-y divide-outline-3/60">
          <div
            v-for="(row, idx) in rows"
            :key="row.id"
            class="flex items-center hover:bg-highlight-1/30 transition-colors text-[12px] group"
            :class="[hasRowIssue(row) ? 'bg-danger/5' : '']"
          >
            <!-- 逐列渲染 -->
            <div
              v-for="(c, i) in cols"
              :key="c.key"
              class="px-2 py-1.5 flex items-center shrink-0"
              :class="[alignClass(c.align)]"
              :style="colStyle(i)"
            >
              <!-- 1. 序号 -->
              <template v-if="c.key === 'idx'">
                <span class="text-foreground-3 font-mono text-center w-full">
                  {{ idx + 1 }}
                </span>
              </template>

              <!-- 2. 清单编码（含来源角标） -->
              <template v-else-if="c.key === 'code'">
                <div class="w-full flex flex-col">
                  <input
                    v-if="canEditField(row, 'code')"
                    :value="row.code"
                    aria-label="清单编码"
                    type="text"
                    class="w-full h-7 px-1.5 border rounded font-mono text-[11px] focus:border-primary outline-none bg-foundation text-primary"
                    :class="[
                      fieldIssue(row, 'code')
                        ? 'border-danger ring-1 ring-danger'
                        : 'border-outline-3'
                    ]"
                    @input="
                      handleCellInput(
                        row.id,
                        'code',
                        ($event.target as HTMLInputElement).value
                      )
                    "
                  />
                  <span
                    v-else
                    class="font-mono text-primary font-medium truncate"
                    :title="row.code"
                  >
                    {{ row.code }}
                  </span>
                  <!-- 来源角标 -->
                  <div class="mt-0.5 flex items-center gap-1">
                    <span
                      class="px-1 py-0.2 rounded border text-[10px] leading-tight"
                      :class="sourceBadgeClass(row.source)"
                      :title="sourceTooltip(row)"
                    >
                      {{ sourceBadgeLabel(row.source) }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- 3. 清单名称 -->
              <template v-else-if="c.key === 'name'">
                <div class="w-full">
                  <input
                    v-if="canEditField(row, 'name')"
                    :value="row.name"
                    aria-label="清单名称"
                    type="text"
                    class="w-full h-7 px-1.5 border rounded text-[11px] focus:border-primary outline-none bg-foundation text-foreground"
                    :class="[
                      fieldIssue(row, 'name')
                        ? 'border-danger ring-1 ring-danger'
                        : 'border-outline-3'
                    ]"
                    @input="
                      handleCellInput(
                        row.id,
                        'name',
                        ($event.target as HTMLInputElement).value
                      )
                    "
                  />
                  <span
                    v-else
                    class="text-foreground font-medium truncate block"
                    :title="row.name"
                  >
                    {{ row.name }}
                  </span>
                </div>
              </template>

              <!-- 4. 计量单位 -->
              <template v-else-if="c.key === 'unit'">
                <div class="w-full text-center">
                  <input
                    v-if="canEditField(row, 'unit')"
                    :value="row.unit"
                    aria-label="计量单位"
                    type="text"
                    class="w-full h-7 px-1 border rounded text-center text-[11px] focus:border-primary outline-none bg-foundation text-foreground"
                    :class="[
                      fieldIssue(row, 'unit')
                        ? 'border-danger ring-1 ring-danger'
                        : 'border-outline-3'
                    ]"
                    @input="
                      handleCellInput(
                        row.id,
                        'unit',
                        ($event.target as HTMLInputElement).value
                      )
                    "
                  />
                  <span v-else class="text-foreground-2">{{ row.unit || '—' }}</span>
                </div>
              </template>

              <!-- 5. 现值 / 基数列 (只读) -->
              <template v-else-if="c.key === 'reviewQtyRO'">
                <span class="font-mono text-foreground-2 text-center w-full">
                  {{ formatNumber(row.reviewQty) }}
                </span>
              </template>

              <template v-else-if="c.key === 'changeBase'">
                <span
                  class="font-mono text-foreground-2 text-center w-full"
                  title="当前累计变更量"
                >
                  {{ formatNumber(row.baseChangeQty) }}
                </span>
              </template>

              <!-- 6. 三方量列：施工单位填报 / 财务监理审核 / 合约部审核 -->
              <template v-else-if="isQtyField(c.key)">
                <div class="w-full text-center">
                  <input
                    v-if="canEditQtyColumn(c.key)"
                    :value="getQtyDisplay(row, c.key)"
                    :aria-label="c.label"
                    type="number"
                    step="any"
                    class="w-full h-7 px-1 border rounded text-center font-mono text-[11px] outline-none shadow-sm transition-all"
                    :class="[
                      isCurrentActiveEditingCol(c.key)
                        ? 'border-primary ring-1 ring-primary bg-primary/5 text-primary font-bold'
                        : 'border-outline-3 bg-foundation text-foreground focus:border-primary',
                      fieldIssue(row, c.key) ? 'border-danger ring-1 ring-danger' : ''
                    ]"
                    @input="
                      handleQtyChange(
                        row,
                        c.key,
                        ($event.target as HTMLInputElement).value
                      )
                    "
                  />
                  <span
                    v-else
                    class="font-mono text-center block w-full"
                    :class="[
                      isQtyDiff(row, c.key)
                        ? 'font-bold text-warning-darker'
                        : 'text-foreground',
                      isChangeColumn(c.key)
                        ? changeAmountColor(getQtyDisplay(row, c.key))
                        : ''
                    ]"
                  >
                    {{ formatQtyDisplay(row, c.key) }}
                  </span>
                </div>
              </template>

              <!-- 7. 累计签证量 -->
              <template v-else-if="c.key === 'changeQtyTotal'">
                <span
                  class="font-mono text-foreground font-semibold text-center w-full"
                >
                  {{ calcRow(row).changeQtyTotalText }}
                </span>
              </template>

              <!-- 8. 工程量(含变更)（自动计算） -->
              <template v-else-if="c.key === 'finAuditQty'">
                <span
                  class="font-mono text-foreground font-semibold text-center w-full bg-foundation-2/60 py-0.5 rounded"
                >
                  {{ calcRow(row).finAuditQtyText }}
                </span>
              </template>

              <!-- 9. 复核单价（元） -->
              <template v-else-if="c.key === 'reviewUnitPrice'">
                <div class="w-full text-right">
                  <input
                    v-if="canEditField(row, 'reviewUnitPrice')"
                    :value="row.reviewUnitPrice"
                    aria-label="复核单价"
                    type="number"
                    step="any"
                    class="w-full h-7 px-1.5 border rounded text-right font-mono text-[11px] focus:border-primary outline-none bg-foundation text-primary"
                    :class="[
                      fieldIssue(row, 'reviewUnitPrice')
                        ? 'border-danger ring-1 ring-danger'
                        : 'border-outline-3'
                    ]"
                    @input="
                      handleCellInput(
                        row.id,
                        'reviewUnitPrice',
                        ($event.target as HTMLInputElement).value
                      )
                    "
                  />
                  <span
                    v-else
                    class="font-mono text-primary font-medium text-right block pr-1"
                  >
                    {{ formatMoney(row.reviewUnitPrice) }}
                  </span>
                </div>
              </template>

              <!-- 10. 复核总价（元） -->
              <template v-else-if="c.key === 'reviewTotal'">
                <span class="font-mono font-bold text-primary text-right w-full pr-1">
                  {{ calcRow(row).reviewTotalText }}
                </span>
              </template>

              <!-- 11. 本次变更金额（元） -->
              <template v-else-if="c.key === 'changeAmount'">
                <span
                  class="font-mono font-bold text-right w-full pr-1"
                  :class="
                    calcRow(row).changeAmount < 0 ? 'text-danger' : 'text-success'
                  "
                >
                  {{ calcRow(row).changeAmount > 0 ? '+' : ''
                  }}{{ calcRow(row).changeAmountText }}
                </span>
              </template>

              <!-- 12. 操作列 (删除) -->
              <template v-else-if="c.key === 'op'">
                <div class="w-full text-center">
                  <button
                    v-if="canDeleteRow"
                    type="button"
                    class="p-1 rounded text-foreground-3 hover:text-danger hover:bg-danger/10 transition-colors"
                    title="移除本行明细"
                    @click="$emit('delete', row.id)"
                  >
                    <TrashIcon class="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <span v-else class="text-foreground-3">—</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- ── 底部合计行（吸底） ── -->
        <div
          v-if="rows.length > 0"
          class="flex bg-foundation-2 border-t-2 border-primary/30 text-[12px] font-bold text-foreground sticky bottom-0 z-10 shadow-[0_-2px_6px_rgba(0,0,0,0.05)]"
        >
          <div
            v-for="(c, i) in cols"
            :key="c.key"
            class="px-2 py-2 flex items-center shrink-0"
            :class="[alignClass(c.align)]"
            :style="colStyle(i)"
          >
            <template v-if="c.key === 'idx'">
              <span class="text-foreground font-semibold">合计</span>
            </template>
            <template v-else-if="c.key === 'code'">
              <span class="text-xs text-foreground-2">共 {{ rows.length }} 项</span>
            </template>
            <template v-else-if="c.key === 'finAuditQty'">
              <span class="font-mono text-center w-full">
                {{ formatNumber(summarySums.finAuditQty) }}
              </span>
            </template>
            <template v-else-if="c.key === 'reviewTotal'">
              <span class="font-mono text-right w-full text-primary font-bold pr-1">
                ¥ {{ formatMoney(summarySums.reviewTotal) }}
              </span>
            </template>
            <template v-else-if="c.key === 'changeAmount'">
              <span
                class="font-mono text-right w-full font-bold pr-1"
                :class="summarySums.changeAmount < 0 ? 'text-danger' : 'text-success'"
              >
                ¥ {{ summarySums.changeAmount > 0 ? '+' : ''
                }}{{ formatMoney(summarySums.changeAmount) }}
              </span>
            </template>
            <template v-else>
              <span></span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { TrashIcon } from '@heroicons/vue/24/outline'
import {
  calcReviewRow,
  editQtyField,
  formatMoney,
  formatNumber,
  sumReviewRows,
  toNum,
  type BoqReviewRow,
  type ReviewKind,
  type ReviewRowSource,
  type ReviewStage,
  type ReviewValidationIssue
} from './boqReviewTypes'

interface ColDef {
  key: string
  label: string
  w: number
  align: 'left' | 'center' | 'right'
}

type QtyKey =
  | 'reviewQty'
  | 'reviewQtySupervisor'
  | 'reviewQtyContract'
  | 'changeQty'
  | 'changeQtySupervisor'
  | 'changeQtyContract'
  | 'baseChangeQty'
  | 'reviewUnitPrice'

const props = withDefaults(
  defineProps<{
    kind?: ReviewKind
    rows: BoqReviewRow[]
    editableStage?: ReviewStage | null
    isDraftEditable?: boolean
    readOnly?: boolean
    validationIssues?: ReviewValidationIssue[]
  }>(),
  {
    kind: 'review',
    editableStage: null,
    isDraftEditable: false,
    readOnly: false,
    validationIssues: () => []
  }
)

const emit = defineEmits<{
  (
    e: 'change',
    rowId: string,
    field: keyof BoqReviewRow,
    value: string | number | null | undefined
  ): void
  (e: 'delete', rowId: string): void
}>()

function buildCols(kind: ReviewKind): ColDef[] {
  if (kind === 'change') {
    return [
      { key: 'idx', label: '序号', w: 46, align: 'center' },
      { key: 'code', label: '清单编码', w: 140, align: 'left' },
      { key: 'name', label: '清单名称', w: 260, align: 'left' },
      { key: 'unit', label: '单位', w: 60, align: 'center' },
      { key: 'reviewQtyRO', label: '复核量(现值)', w: 90, align: 'center' },
      { key: 'changeBase', label: '原签证量', w: 90, align: 'center' },
      { key: 'changeQty', label: '本次-施工单位', w: 105, align: 'center' },
      { key: 'changeQtySupervisor', label: '本次-财务监理', w: 105, align: 'center' },
      { key: 'changeQtyContract', label: '本次-合约部', w: 105, align: 'center' },
      { key: 'changeQtyTotal', label: '累计签证量', w: 95, align: 'center' },
      { key: 'finAuditQty', label: '工程量(含变更)', w: 105, align: 'center' },
      { key: 'reviewUnitPrice', label: '复核单价(元)', w: 100, align: 'right' },
      { key: 'reviewTotal', label: '复核总价(元)', w: 115, align: 'right' },
      { key: 'changeAmount', label: '本次变更金额(元)', w: 120, align: 'right' },
      { key: 'op', label: '操作', w: 55, align: 'center' }
    ]
  }

  // review
  return [
    { key: 'idx', label: '序号', w: 46, align: 'center' },
    { key: 'code', label: '清单编码', w: 140, align: 'left' },
    { key: 'name', label: '清单名称', w: 320, align: 'left' },
    { key: 'unit', label: '单位', w: 64, align: 'center' },
    { key: 'reviewQty', label: '复核量-施工单位', w: 115, align: 'center' },
    { key: 'reviewQtySupervisor', label: '复核量-财务监理', w: 115, align: 'center' },
    { key: 'reviewQtyContract', label: '复核量-合约部', w: 115, align: 'center' },
    { key: 'changeBase', label: '变更/签证量(现值)', w: 110, align: 'center' },
    { key: 'finAuditQty', label: '工程量(含变更)', w: 110, align: 'center' },
    { key: 'reviewUnitPrice', label: '复核单价(元)', w: 105, align: 'right' },
    { key: 'reviewTotal', label: '复核总价(元)', w: 125, align: 'right' },
    { key: 'op', label: '操作', w: 55, align: 'center' }
  ]
}

const cols = computed(() => buildCols(props.kind))
const colWidths = ref<number[]>(cols.value.map((c) => c.w))

const totalBaseWidth = computed(() => colWidths.value.reduce((s, w) => s + w, 0))

// 拖拽列宽状态
const resizing = ref<{ colIndex: number; startX: number; startWidth: number } | null>(
  null
)

const onMouseDown = (index: number, e: MouseEvent) => {
  resizing.value = {
    colIndex: index,
    startX: e.clientX,
    startWidth: colWidths.value[index] || cols.value[index].w
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (e: MouseEvent) => {
  if (!resizing.value) return
  const delta = e.clientX - resizing.value.startX
  const newWidth = Math.max(48, resizing.value.startWidth + delta)
  colWidths.value[resizing.value.colIndex] = newWidth
}

const onMouseUp = () => {
  resizing.value = null
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

const colStyle = (index: number) => {
  const w = colWidths.value[index] || cols.value[index].w
  return {
    width: `${w}px`,
    minWidth: `${w}px`,
    maxWidth: `${w}px`
  }
}

const alignClass = (align: 'left' | 'center' | 'right') => {
  if (align === 'right') return 'text-right justify-end'
  if (align === 'center') return 'text-center justify-center'
  return 'text-left justify-start'
}

// ── 单元格编辑权限控制 ──
const canDeleteRow = computed(() => {
  if (props.readOnly) return false
  return props.isDraftEditable && props.editableStage === 'contractor'
})

const canEditField = (
  row: BoqReviewRow,
  field: 'code' | 'name' | 'unit' | 'reviewUnitPrice'
) => {
  if (props.readOnly) return false
  if (field === 'code' || field === 'name' || field === 'unit') {
    // 只有施工草稿阶段且 source === 'create' 或 'file' 的新项可改
    return (
      props.isDraftEditable &&
      props.editableStage === 'contractor' &&
      (row.source === 'create' || row.source === 'file')
    )
  }
  if (field === 'reviewUnitPrice') {
    // 复核单价在施工草稿或退回阶段可编辑（review单均可编辑；change单仅新建项可填单价）
    if (!props.isDraftEditable || props.editableStage !== 'contractor') return false
    return props.kind === 'review' || row.source === 'create'
  }
  return false
}

const canEditQtyColumn = (colKey: string) => {
  if (props.readOnly) return false
  if (props.editableStage === 'contractor') {
    return colKey === 'reviewQty' || colKey === 'changeQty'
  }
  if (props.editableStage === 'supervisor') {
    return colKey === 'reviewQtySupervisor' || colKey === 'changeQtySupervisor'
  }
  if (props.editableStage === 'contract') {
    return colKey === 'reviewQtyContract' || colKey === 'changeQtyContract'
  }
  return false
}

const isCurrentActiveEditingCol = (colKey: string) => {
  if (props.editableStage === 'supervisor') {
    return colKey === 'reviewQtySupervisor' || colKey === 'changeQtySupervisor'
  }
  if (props.editableStage === 'contract') {
    return colKey === 'reviewQtyContract' || colKey === 'changeQtyContract'
  }
  return false
}

const isQtyField = (key: string) => {
  return [
    'reviewQty',
    'reviewQtySupervisor',
    'reviewQtyContract',
    'changeQty',
    'changeQtySupervisor',
    'changeQtyContract'
  ].includes(key)
}

const isChangeColumn = (key: string) => {
  return ['changeQty', 'changeQtySupervisor', 'changeQtyContract'].includes(key)
}

const getQtyDisplay = (row: BoqReviewRow, key: string): string | number => {
  const val = row[key as QtyKey]
  if (val !== undefined && val !== null && val !== '') return val
  // 监理或合约列为空时，退回到施工填报值显示
  if (key === 'reviewQtySupervisor' || key === 'reviewQtyContract')
    return row.reviewQty ?? 0
  if (key === 'changeQtySupervisor' || key === 'changeQtyContract')
    return row.changeQty ?? 0
  return 0
}

const formatQtyDisplay = (row: BoqReviewRow, key: string) => {
  const v = getQtyDisplay(row, key)
  if (v === '' || v === null || v === undefined) return '—'
  const num = toNum(v)
  if (isChangeColumn(key)) {
    return num > 0 ? `+${formatNumber(num)}` : formatNumber(num)
  }
  return formatNumber(num)
}

const isQtyDiff = (row: BoqReviewRow, key: string) => {
  if (key === 'reviewQtySupervisor' || key === 'reviewQtyContract') {
    return toNum(row[key]) !== toNum(row.reviewQty)
  }
  if (key === 'changeQtySupervisor' || key === 'changeQtyContract') {
    return toNum(row[key]) !== toNum(row.changeQty)
  }
  return false
}

const changeAmountColor = (val: string | number) => {
  const n = toNum(val)
  if (n > 0) return 'text-success font-semibold'
  if (n < 0) return 'text-danger font-semibold'
  return 'text-foreground-2'
}

const handleCellInput = (
  rowId: string,
  field: keyof BoqReviewRow,
  value: string | number | null | undefined
) => {
  emit('change', rowId, field, value)
}

const handleQtyChange = (row: BoqReviewRow, colKey: string, value: string) => {
  const stage = props.editableStage || 'contractor'
  const updatedRow = editQtyField(row, stage, value, props.kind)

  if (props.kind === 'review') {
    emit('change', row.id, 'reviewQty', updatedRow.reviewQty)
    emit('change', row.id, 'reviewQtySupervisor', updatedRow.reviewQtySupervisor)
    emit('change', row.id, 'reviewQtyContract', updatedRow.reviewQtyContract)
  } else {
    emit('change', row.id, 'changeQty', updatedRow.changeQty)
    emit('change', row.id, 'changeQtySupervisor', updatedRow.changeQtySupervisor)
    emit('change', row.id, 'changeQtyContract', updatedRow.changeQtyContract)
  }
}

// ── 来源样式与文案 ──
const sourceBadgeLabel = (source: ReviewRowSource) => {
  switch (source) {
    case 'create':
      return '创建'
    case 'file':
      return '导入'
    default:
      return '引入'
  }
}

const sourceBadgeClass = (source: ReviewRowSource) => {
  switch (source) {
    case 'create':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'file':
      return 'bg-teal-50 text-teal-700 border-teal-200'
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200'
  }
}

const sourceTooltip = (row: BoqReviewRow) => {
  if (row.source === 'create') {
    return row.sourceCode
      ? `依据「${row.sourceCode}」创建，挂接在同级分项下`
      : '新建清单项'
  }
  if (row.source === 'file') {
    return 'Excel 文件导入新清单项'
  }
  return '自正式清单引入'
}

// ── 校验高亮 ──
const hasRowIssue = (row: BoqReviewRow) => {
  return props.validationIssues.some((issue) => issue.rowCode === row.code)
}

const fieldIssue = (row: BoqReviewRow, fieldKey: string) => {
  return props.validationIssues.some(
    (issue) => issue.rowCode === row.code && issue.field === fieldKey
  )
}

// ── 计算与合计 ──
const calcRow = (row: BoqReviewRow) => {
  return calcReviewRow(row, props.kind)
}

const summarySums = computed(() => {
  return sumReviewRows(props.rows, props.kind)
})
</script>
