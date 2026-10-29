<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
  >
    <div
      class="bg-foundation rounded-xl shadow-2xl w-full max-w-[1280px] h-[86vh] flex flex-col border border-outline-3 overflow-hidden text-foreground"
    >
      <!-- 弹窗顶栏 -->
      <div
        class="border-b border-outline-3 px-6 flex items-center justify-between shrink-0 bg-foundation-2"
      >
        <div class="flex items-center gap-2">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            class="px-4 py-3.5 text-sm font-semibold border-b-2 -mb-px transition-all"
            :class="[
              activeTab === t.key
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-foreground-2 hover:text-foreground hover:border-outline-3'
            ]"
            @click="activeTab = t.key"
          >
            {{ t.label }}
          </button>
        </div>
        <button
          type="button"
          class="p-1 rounded-md text-foreground-2 hover:text-foreground hover:bg-outline-3/20 transition-colors"
          @click="handleClose"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- 弹窗主体内容 -->
      <div class="flex-1 min-h-0 bg-foundation">
        <!-- ── Tab 1: 创建清单项 ── -->
        <div v-if="activeTab === 'create'" class="h-full flex min-h-0">
          <!-- 左侧：选择挂接/来源清单树 -->
          <div class="flex-1 min-w-0 border-r border-outline-3 flex flex-col">
            <div
              class="p-3.5 border-b border-outline-3 space-y-2 shrink-0 bg-foundation-2/50"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-foreground">
                  ① 选择编码来源与挂接清单项
                </span>
                <span class="text-[11px] text-foreground-3">
                  选中后自动挂接到同级分项下
                </span>
              </div>
              <div class="relative">
                <input
                  v-model="createTreeKeyword"
                  type="text"
                  aria-label="搜索编码或名称"
                  placeholder="搜索编码 / 名称"
                  class="w-full pl-8 pr-3 py-1 text-xs bg-foundation border border-outline-3 rounded focus:outline-none focus:border-primary text-foreground"
                />
                <MagnifyingGlassIcon
                  class="w-3.5 h-3.5 absolute left-2.5 top-2 text-foreground-2"
                />
              </div>
            </div>
            <!-- 清单树单选列表 -->
            <div class="flex-1 min-h-0 overflow-auto p-2 space-y-0.5">
              <div
                class="grid grid-cols-[minmax(270px,1fr)_60px_105px_105px] gap-2 min-w-[650px] px-2 py-1.5 text-[11px] font-semibold text-foreground-2 bg-foundation-2 sticky top-0 z-10"
              >
                <span>清单编码 / 名称</span>
                <span class="text-center">单位</span>
                <span class="text-right">合同工程量</span>
                <span class="text-right">综合单价</span>
              </div>
              <label
                v-for="row in filteredCreateTreeRows"
                :key="row.id"
                class="grid grid-cols-[minmax(270px,1fr)_60px_105px_105px] gap-2 min-w-[650px] items-center py-1.5 px-2 rounded cursor-pointer text-xs transition-colors hover:bg-highlight-1/40"
                :class="
                  selectedSourceItem?.id === row.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground'
                "
              >
                <span
                  class="flex items-center gap-2 min-w-0"
                  :style="{ paddingLeft: `${row.depth * 16}px` }"
                >
                  <input
                    type="radio"
                    name="source-boq"
                    :checked="selectedSourceItem?.id === row.id"
                    class="accent-primary shrink-0"
                    @change="selectSourceItem(row.item)"
                  />
                  <span class="font-mono text-primary font-medium shrink-0">
                    {{ row.item.code }}
                  </span>
                  <span class="truncate" :title="row.item.name">
                    {{ row.item.name }}
                  </span>
                  <span
                    class="text-[10px] text-foreground-3 shrink-0 bg-foundation-3 px-1 rounded"
                  >
                    {{ boqTypeLabel(row.item.type) }}
                  </span>
                </span>
                <span class="text-center text-foreground-2">
                  {{ row.item.unit || '—' }}
                </span>
                <span class="text-right font-mono">
                  {{ formatNumber(row.item.quantity) }}
                </span>
                <span class="text-right font-mono">
                  {{ formatNumber(row.item.price) }}
                </span>
              </label>
            </div>
          </div>

          <!-- 右侧：填写新清单表单 -->
          <div
            class="w-[450px] shrink-0 flex flex-col border-l border-outline-3 bg-foundation"
          >
            <div
              class="p-3.5 border-b border-outline-3 text-xs font-bold text-foreground shrink-0 bg-foundation-2/50"
            >
              ② 填写新清单项数据
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
              <!-- 来源提示卡片 -->
              <div
                v-if="selectedSourceItem"
                class="p-2.5 rounded border border-primary/20 bg-primary/5 text-xs text-foreground space-y-1"
              >
                <div class="flex items-center gap-1.5 font-medium">
                  <span class="text-primary font-mono">
                    {{ selectedSourceItem.code }}
                  </span>
                  <span class="truncate">{{ selectedSourceItem.name }}</span>
                </div>
                <div class="text-[11px] text-foreground-2">
                  生效后新项将作为同级节点插入到该分部分项下，不会覆盖原清单数据。
                </div>
              </div>
              <div
                v-else
                class="text-xs text-foreground-3 italic p-2 border border-dashed rounded text-center"
              >
                请先在左侧选择一条清单项作为编码参考
              </div>

              <!-- 清单编码 -->
              <div>
                <label
                  for="pick-code"
                  class="block text-xs font-medium text-foreground mb-1"
                >
                  清单编码
                  <span class="text-danger">*</span>
                  <span class="text-[11px] text-foreground-3 font-normal ml-1">
                    （默认原编码+b，可修改）
                  </span>
                </label>
                <input
                  id="pick-code"
                  v-model="createForm.code"
                  type="text"
                  placeholder="如：040101001001b"
                  class="w-full px-2.5 py-1.5 text-xs font-mono bg-foundation border rounded focus:outline-none focus:border-primary text-foreground"
                  :class="
                    isCodeConflict ? 'border-danger text-danger' : 'border-outline-3'
                  "
                />
                <p v-if="isCodeConflict" class="text-[11px] text-danger mt-1">
                  该编码已存在于正式清单或当前单据明细中，请修改
                </p>
              </div>

              <!-- 清单名称 -->
              <div>
                <label
                  for="pick-name"
                  class="block text-xs font-medium text-foreground mb-1"
                >
                  清单名称
                  <span class="text-danger">*</span>
                </label>
                <input
                  id="pick-name"
                  v-model="createForm.name"
                  type="text"
                  placeholder="请输入清单项名称"
                  class="w-full px-2.5 py-1.5 text-xs bg-foundation border border-outline-3 rounded focus:outline-none focus:border-primary text-foreground"
                />
              </div>

              <!-- 计量单位 -->
              <div>
                <label
                  for="pick-unit"
                  class="block text-xs font-medium text-foreground mb-1"
                >
                  计量单位
                  <span class="text-danger">*</span>
                </label>
                <div class="flex gap-2">
                  <input
                    id="pick-unit"
                    v-model="createForm.unit"
                    type="text"
                    placeholder="如：m³ / t / 项"
                    class="flex-1 px-2.5 py-1.5 text-xs bg-foundation border border-outline-3 rounded focus:outline-none focus:border-primary text-foreground"
                  />
                  <select
                    aria-label="常用单位选择"
                    class="w-24 px-1.5 py-1.5 text-xs bg-foundation border border-outline-3 rounded text-foreground focus:outline-none"
                    @change="(e) => createForm.unit = (e.target as HTMLSelectElement).value"
                  >
                    <option value="">常用单位</option>
                    <option v-for="u in commonUnits" :key="u" :value="u">
                      {{ u }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- 工程量输入 -->
              <div :class="isChange ? 'grid grid-cols-2 gap-3' : ''">
                <div>
                  <label
                    for="pick-review-qty"
                    class="block text-xs font-medium text-foreground mb-1"
                  >
                    复核量
                    <span class="text-danger">*</span>
                  </label>
                  <input
                    id="pick-review-qty"
                    v-model="createForm.reviewQty"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    class="w-full px-2.5 py-1.5 text-xs font-mono text-right bg-foundation border border-outline-3 rounded focus:outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div v-if="isChange">
                  <label
                    for="pick-change-qty"
                    class="block text-xs font-medium text-foreground mb-1"
                  >
                    {{ isChange ? '本次签证量 (+/−)' : '变更/签证量' }}
                    <span v-if="isChange" class="text-danger">*</span>
                  </label>
                  <input
                    id="pick-change-qty"
                    v-model="createForm.changeQty"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    class="w-full px-2.5 py-1.5 text-xs font-mono text-right bg-foundation border border-outline-3 rounded focus:outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>

              <!-- 复核单价 -->
              <div>
                <label
                  for="pick-price"
                  class="block text-xs font-medium text-foreground mb-1"
                >
                  复核单价（元）
                  <span class="text-danger">*</span>
                </label>
                <input
                  id="pick-price"
                  v-model="createForm.reviewUnitPrice"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  class="w-full px-2.5 py-1.5 text-xs font-mono text-right bg-foundation border border-outline-3 rounded focus:outline-none focus:border-primary text-foreground"
                />
              </div>

              <!-- 实时预览卡片 -->
              <div class="grid grid-cols-2 gap-3 pt-2">
                <div class="p-2 bg-foundation-2 rounded border border-outline-3">
                  <div class="text-[11px] text-foreground-3">工程量(含变更)</div>
                  <div class="text-sm font-bold font-mono text-foreground mt-0.5">
                    {{ createPreview.finAuditQtyText }}
                  </div>
                </div>
                <div class="p-2 bg-primary/10 rounded border border-primary/20">
                  <div class="text-[11px] text-primary">复核总价（元）</div>
                  <div class="text-sm font-bold font-mono text-primary mt-0.5">
                    {{ createPreview.reviewTotalText }}
                  </div>
                </div>
              </div>

              <!-- 错误提示 -->
              <div
                v-if="createError"
                class="p-2 rounded bg-danger/10 border border-danger/20 text-danger text-xs"
              >
                {{ createError }}
              </div>
            </div>

            <!-- 右侧底部操作栏 -->
            <div
              class="p-3 border-t border-outline-3 flex items-center justify-end gap-2 shrink-0 bg-foundation-2"
            >
              <FormButton color="outline" size="sm" @click="handleClose">
                取消
              </FormButton>
              <FormButton color="outline" size="sm" @click="handleCreateRow(true)">
                确认并继续添加
              </FormButton>
              <FormButton color="primary" size="sm" @click="handleCreateRow(false)">
                确认添加
              </FormButton>
            </div>
          </div>
        </div>

        <!-- ── Tab 2: 引入清单项 ── -->
        <div v-else-if="activeTab === 'import'" class="h-full flex flex-col min-h-0">
          <div
            class="p-3.5 border-b border-outline-3 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-foundation-2/50"
          >
            <div class="flex items-center gap-3">
              <div class="relative w-72">
                <input
                  v-model="importTreeKeyword"
                  type="text"
                  aria-label="搜索清单编码或名称"
                  placeholder="搜索清单编码 / 名称"
                  class="w-full pl-8 pr-3 py-1.5 text-xs bg-foundation border border-outline-3 rounded focus:outline-none focus:border-primary text-foreground"
                />
                <MagnifyingGlassIcon
                  class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-foreground-2"
                />
              </div>
              <FormButton color="outline" size="sm" @click="selectAllLeaves">
                全选叶子项
              </FormButton>
              <FormButton color="outline" size="sm" @click="clearSelectedLeaves">
                清空勾选
              </FormButton>
            </div>
            <div class="text-xs text-foreground-2">
              已勾选
              <span class="text-primary font-bold">{{ selectedImportCodes.size }}</span>
              项
            </div>
          </div>

          <!-- 清单列表（带层级与级联勾选） -->
          <div class="flex-1 min-h-0 overflow-auto">
            <table class="w-full text-xs text-left border-collapse min-w-[900px]">
              <thead
                class="bg-foundation-2 sticky top-0 text-[11px] font-semibold text-foreground-2 border-b border-outline-3 z-10 select-none"
              >
                <tr>
                  <th class="w-12 py-2 px-3 text-center">选择</th>
                  <th class="w-48 py-2 px-3">清单编码</th>
                  <th class="py-2 px-3">清单名称</th>
                  <th class="w-20 py-2 px-3 text-center">类型</th>
                  <th class="w-20 py-2 px-3 text-center">单位</th>
                  <th class="w-28 py-2 px-3 text-right">合同工程量</th>
                  <th class="w-28 py-2 px-3 text-right">综合单价</th>
                  <th class="w-24 py-2 px-3 text-center">状态</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-3/60">
                <tr
                  v-for="row in filteredImportTreeRows"
                  :key="row.item.id"
                  class="hover:bg-highlight-1/30 transition-colors"
                  :class="[
                    isAlreadyInDetail(row.item.code)
                      ? 'opacity-50 bg-foundation-2/30'
                      : '',
                    selectedImportCodes.has(row.item.code) ? 'bg-primary/5' : ''
                  ]"
                >
                  <td class="py-2 px-3 text-center">
                    <input
                      type="checkbox"
                      :aria-label="`选择 ${row.item.code}`"
                      :checked="selectedImportCodes.has(row.item.code)"
                      :disabled="isAlreadyInDetail(row.item.code)"
                      class="accent-primary"
                      @change="toggleImportItem(row.item)"
                    />
                  </td>
                  <td class="py-2 px-3 font-mono font-medium text-primary">
                    <div :style="{ paddingLeft: `${row.depth * 14}px` }">
                      {{ row.item.code }}
                    </div>
                  </td>
                  <td
                    class="py-2 px-3 font-medium text-foreground truncate max-w-xs"
                    :title="row.item.name"
                  >
                    {{ row.item.name }}
                  </td>
                  <td class="py-2 px-3 text-center text-foreground-3 text-[11px]">
                    {{ boqTypeLabel(row.item.type) }}
                  </td>
                  <td class="py-2 px-3 text-center text-foreground-2">
                    {{ row.item.unit || '—' }}
                  </td>
                  <td class="py-2 px-3 text-right font-mono text-foreground">
                    {{ formatNumber(row.item.quantity) }}
                  </td>
                  <td class="py-2 px-3 text-right font-mono text-foreground">
                    {{ formatNumber(row.item.price) }}
                  </td>
                  <td class="py-2 px-3 text-center">
                    <span
                      v-if="isAlreadyInDetail(row.item.code)"
                      class="text-[10px] text-foreground-3 px-1 py-0.5 rounded bg-foundation-3 border border-outline-3"
                    >
                      已引入
                    </span>
                    <span v-else class="text-[10px] text-success">可选</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 底部引入按钮栏 -->
          <div
            class="p-3 border-t border-outline-3 flex items-center justify-between gap-3 shrink-0 bg-foundation-2"
          >
            <span class="text-xs text-foreground-2">
              提示：引入后将带出正式清单现有复核量与单价，重复清单会自动跳过。
            </span>
            <div class="flex gap-2">
              <FormButton color="outline" size="sm" @click="handleClose">
                取消
              </FormButton>
              <FormButton
                color="primary"
                size="sm"
                :disabled="selectedImportCodes.size === 0"
                @click="executeBatchImport"
              >
                批量引入（{{ selectedImportCodes.size }} 项）
              </FormButton>
            </div>
          </div>
        </div>

        <!-- ── Tab 3: 导出 / 导入 ── -->
        <div v-else class="h-full flex flex-col min-h-0 p-4 space-y-4 overflow-y-auto">
          <!-- 上半部分：导出模板 -->
          <div
            class="p-4 rounded-xl border border-outline-3 bg-foundation-2/40 space-y-3"
          >
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-foreground">① 导出导入模板</h3>
                <p class="text-xs text-foreground-2 mt-0.5">
                  将当前工程的清单结构导出为 .xlsx 文件，在表格中离线填报工程量后导入。
                </p>
              </div>
              <FormButton color="primary" size="sm" @click="handleExportTemplate">
                <ArrowDownTrayIcon class="w-3.5 h-3.5 mr-1" />
                导出 Excel 模板
              </FormButton>
            </div>
          </div>

          <!-- 下半部分：解析上传 -->
          <div
            class="p-4 rounded-xl border border-outline-3 bg-foundation-2/40 space-y-3 flex-1 flex flex-col"
          >
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-foreground">② 导入 Excel 填报文件</h3>
                <p class="text-xs text-foreground-2 mt-0.5">
                  选择填好的 .xlsx 文件，系统会自动校验清单编码、数值格式与必填项。
                </p>
              </div>
              <label class="inline-flex items-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  class="hidden"
                  @change="handleFileSelected"
                />
                <span
                  class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg cursor-pointer hover:bg-primary-focus transition-colors inline-flex items-center gap-1"
                >
                  <ArrowUpTrayIcon class="w-3.5 h-3.5" />
                  选择 Excel 文件
                </span>
              </label>
            </div>

            <!-- 解析状态展示 -->
            <div v-if="parseResult" class="flex-1 min-h-0 flex flex-col space-y-3 pt-2">
              <div
                class="p-3 rounded-lg text-xs font-medium border"
                :class="[
                  parseResult.failedRows.length === 0
                    ? 'bg-success-lighter/20 border-success/30 text-success-darker'
                    : 'bg-warning-lighter/20 border-warning/30 text-warning-darker'
                ]"
              >
                解析完成：成功可导入 {{ parseResult.successRows.length }} 条
                <template v-if="parseResult.failedRows.length > 0">
                  ，校验失败 {{ parseResult.failedRows.length }} 条
                </template>
                <template v-if="parseResult.skippedCount > 0">
                  ，跳过空行/目录行 {{ parseResult.skippedCount }} 条
                </template>
              </div>

              <!-- 失败行明细 -->
              <div
                v-if="parseResult.failedRows.length > 0"
                class="flex-1 min-h-0 overflow-y-auto border border-danger/20 rounded-lg p-2.5 bg-danger/5 text-xs"
              >
                <div class="font-bold text-danger mb-1.5">失败原因明细：</div>
                <div class="space-y-1">
                  <div
                    v-for="(fail, fIdx) in parseResult.failedRows"
                    :key="fIdx"
                    class="text-danger flex items-start gap-1"
                  >
                    <span>· 第 {{ fail.rowNumber }} 行</span>
                    <span v-if="fail.code" class="font-mono">({{ fail.code }})</span>
                    :
                    <span>{{ fail.reason }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 导入确定按钮 -->
          <div class="flex items-center justify-end gap-2 pt-2">
            <FormButton color="outline" size="sm" @click="handleClose">取消</FormButton>
            <FormButton
              color="primary"
              size="sm"
              :disabled="!parseResult || parseResult.successRows.length === 0"
              @click="confirmApplyImport"
            >
              确认将成功条目加入明细 ({{ parseResult?.successRows?.length || 0 }} 条)
            </FormButton>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/vue/24/outline'
import { FormButton } from '@speckle/ui-components'
import {
  calcReviewRow,
  collectBoqCodes,
  collectBoqLeafItems,
  flattenBoqTree,
  boqTypeLabel,
  formatNumber,
  suggestCreatedCode,
  toNum,
  withQtyDefaults,
  type BoqReviewRow,
  type BoqTreeItem,
  type ReviewKind
} from './boqReviewTypes'
import {
  exportReviewTemplateXlsx,
  parseReviewImportXlsx,
  type ParseOutcome
} from './boqReviewXlsx'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'

const props = defineProps<{
  open: boolean
  projectId: string
  kind: ReviewKind
  existingRows: BoqReviewRow[]
  allBoqItems: BoqTreeItem[]
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'close'): void
  (e: 'append', rows: BoqReviewRow[]): void
}>()

const { triggerNotification } = useGlobalToast()
const isChange = computed(() => props.kind === 'change')

const tabs = [
  { key: 'create', label: '创建清单项' },
  { key: 'import', label: '引入清单项' },
  { key: 'file', label: '导出 / 导入' }
] as const
type TabKey = (typeof tabs)[number]['key']
const activeTab = ref<TabKey>('create')

const commonUnits = ['m', '㎡', 'm³', 't', 'kg', '项', '座', '套', '个', '组', '根']

const allCodesSet = computed(() => {
  const codes = collectBoqCodes(props.allBoqItems)
  props.existingRows.forEach((r) => {
    if (r.code) codes.add(r.code.trim())
  })
  return codes
})

const existingDetailCodes = computed(() => {
  return new Set(props.existingRows.map((r) => (r.code || '').trim()))
})

const isAlreadyInDetail = (code: string) => {
  return existingDetailCodes.value.has(code.trim())
}

// ── Tab 1: 创建清单项状态 ──
const createTreeKeyword = ref('')
const selectedSourceItem = ref<BoqTreeItem | null>(null)
const createError = ref('')

const createForm = ref({
  code: '',
  name: '',
  unit: '',
  reviewQty: '0',
  changeQty: '0',
  reviewUnitPrice: '0'
})

const isCodeConflict = computed(() => {
  const c = createForm.value.code.trim()
  if (!c) return false
  return allCodesSet.value.has(c)
})

const createPreview = computed(() => {
  return calcReviewRow(
    {
      id: 'tmp',
      source: 'create',
      code: createForm.value.code,
      name: createForm.value.name,
      unit: createForm.value.unit,
      baseChangeQty: 0,
      reviewQty: createForm.value.reviewQty,
      changeQty: createForm.value.changeQty,
      reviewUnitPrice: createForm.value.reviewUnitPrice
    },
    props.kind
  )
})

const allFlattenedItems = computed(() => flattenBoqTree(props.allBoqItems))

const filteredCreateTreeRows = computed(() => {
  const kw = createTreeKeyword.value.trim().toLowerCase()
  const rows: Array<{ item: BoqTreeItem; depth: number; id: string }> = []

  function walk(nodes: BoqTreeItem[], depth = 0) {
    for (const node of nodes) {
      const match =
        !kw ||
        node.code.toLowerCase().includes(kw) ||
        node.name.toLowerCase().includes(kw)
      if (match) {
        rows.push({ item: node, depth, id: node.id })
      }
      if (node.children && node.children.length > 0) {
        walk(node.children, depth + 1)
      }
    }
  }
  walk(props.allBoqItems)
  return rows
})

const selectSourceItem = (item: BoqTreeItem) => {
  selectedSourceItem.value = item
  createError.value = ''
  const suggestedCode = suggestCreatedCode(item.code, allCodesSet.value)
  createForm.value.code = suggestedCode
  createForm.value.name = item.name ? `${item.name}-增` : ''
  createForm.value.unit = item.unit || '项'
  createForm.value.reviewUnitPrice = isChange.value
    ? String(item.reviewPrice ?? item.price ?? 0)
    : '0'
  createForm.value.reviewQty = isChange.value
    ? String(item.reviewQuantity ?? item.quantity ?? 0)
    : '0'
  createForm.value.changeQty = '0'
}

const handleCreateRow = (keepOpen: boolean) => {
  createError.value = ''
  if (!selectedSourceItem.value) {
    createError.value = '请先在左侧选择一条清单项作为挂接参考'
    return
  }
  const code = createForm.value.code.trim()
  if (!code) {
    createError.value = '清单编码不能为空'
    return
  }
  if (isCodeConflict.value) {
    createError.value = `清单编码「${code}」已被占用，请修改`
    return
  }
  if (!createForm.value.name.trim()) {
    createError.value = '清单名称不能为空'
    return
  }
  if (!createForm.value.unit.trim()) {
    createError.value = '计量单位不能为空'
    return
  }

  const newRow: BoqReviewRow = withQtyDefaults({
    id: `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    source: 'create',
    sourceCode: selectedSourceItem.value.code,
    parentCode: selectedSourceItem.value.parentCode || selectedSourceItem.value.code,
    code,
    name: createForm.value.name.trim(),
    unit: createForm.value.unit.trim(),
    baseChangeQty: 0,
    reviewQty: toNum(createForm.value.reviewQty),
    changeQty: toNum(createForm.value.changeQty),
    reviewUnitPrice: toNum(createForm.value.reviewUnitPrice)
  })

  emit('append', [newRow])
  triggerNotification({
    title: '添加成功',
    description: `新清单项「${code}」已添加到明细中`,
    type: ToastNotificationType.Success
  })

  if (keepOpen) {
    // 自动为下一条推荐新后缀
    const nextCode = suggestCreatedCode(
      selectedSourceItem.value.code,
      allCodesSet.value
    )
    createForm.value.code = nextCode
    if (!isChange.value) {
      createForm.value.reviewQty = '0'
      createForm.value.reviewUnitPrice = '0'
    }
  } else {
    handleClose()
  }
}

// ── Tab 2: 引入清单项状态 ──
const importTreeKeyword = ref('')
const selectedImportCodes = ref<Set<string>>(new Set())

const leafItems = computed(() => collectBoqLeafItems(props.allBoqItems))

const filteredImportTreeRows = computed(() => {
  const kw = importTreeKeyword.value.trim().toLowerCase()
  const rows: Array<{ item: BoqTreeItem; depth: number }> = []

  function walk(nodes: BoqTreeItem[], depth = 0) {
    for (const node of nodes) {
      const match =
        !kw ||
        node.code.toLowerCase().includes(kw) ||
        node.name.toLowerCase().includes(kw)
      if (match) {
        rows.push({ item: node, depth })
      }
      if (node.children && node.children.length > 0) {
        walk(node.children, depth + 1)
      }
    }
  }
  walk(props.allBoqItems)
  return rows
})

const toggleImportItem = (node: BoqTreeItem) => {
  // 如果是父级，级联勾选/取消勾选其下所有可用的 ITEM 叶子
  const leavesUnder = collectBoqLeafItems([node])
  const nextSet = new Set(selectedImportCodes.value)
  const isAllChecked =
    leavesUnder.length > 0 && leavesUnder.every((l) => nextSet.has(l.code))

  for (const leaf of leavesUnder) {
    if (isAlreadyInDetail(leaf.code)) continue
    if (isAllChecked) {
      nextSet.delete(leaf.code)
    } else {
      nextSet.add(leaf.code)
    }
  }
  selectedImportCodes.value = nextSet
}

const selectAllLeaves = () => {
  const nextSet = new Set<string>()
  leafItems.value.forEach((l) => {
    if (!isAlreadyInDetail(l.code)) {
      nextSet.add(l.code)
    }
  })
  selectedImportCodes.value = nextSet
}

const clearSelectedLeaves = () => {
  selectedImportCodes.value = new Set()
}

const executeBatchImport = () => {
  if (selectedImportCodes.value.size === 0) return
  const toAdd: BoqReviewRow[] = []

  leafItems.value.forEach((item) => {
    if (selectedImportCodes.value.has(item.code) && !isAlreadyInDetail(item.code)) {
      toAdd.push(
        withQtyDefaults({
          id: `imp-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          source: 'import',
          boqItemId: item.id,
          sourceCode: item.code,
          code: item.code,
          name: item.name,
          unit: item.unit || '',
          baseChangeQty: item.changeQuantity ?? 0,
          reviewQty: item.reviewQuantity ?? item.quantity ?? 0,
          changeQty: 0,
          reviewUnitPrice: item.reviewPrice ?? item.price ?? 0
        })
      )
    }
  })

  if (toAdd.length > 0) {
    emit('append', toAdd)
    triggerNotification({
      title: '引入成功',
      description: `已成功引入 ${toAdd.length} 条清单明细`,
      type: ToastNotificationType.Success
    })
  }
  handleClose()
}

// ── Tab 3: 导出 / 导入状态 ──
const parseResult = ref<ParseOutcome | null>(null)

const handleExportTemplate = () => {
  exportReviewTemplateXlsx(props.kind, leafItems.value, '项目清单')
  triggerNotification({
    title: '导出成功',
    description: '清单模板已下载，填写后可从下方导入',
    type: ToastNotificationType.Success
  })
}

const handleFileSelected = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const outcome = await parseReviewImportXlsx(
      file,
      props.kind,
      allFlattenedItems.value,
      existingDetailCodes.value
    )
    parseResult.value = outcome
  } catch (err) {
    const detail = err as { message?: string } | null
    triggerNotification({
      title: '解析失败',
      description: detail?.message || '文件读取错误',
      type: ToastNotificationType.Danger
    })
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

const confirmApplyImport = () => {
  if (!parseResult.value || parseResult.value.successRows.length === 0) return
  emit('append', parseResult.value.successRows)
  triggerNotification({
    title: '导入成功',
    description: `已成功导入 ${parseResult.value.successRows.length} 条清单项`,
    type: ToastNotificationType.Success
  })
  handleClose()
}

const handleClose = () => {
  emit('update:open', false)
  emit('close')
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      activeTab.value = 'create'
      parseResult.value = null
      selectedImportCodes.value = new Set()
      selectedSourceItem.value = null
      createError.value = ''
      createForm.value = {
        code: '',
        name: '',
        unit: '',
        reviewQty: '0',
        changeQty: '0',
        reviewUnitPrice: '0'
      }
    }
  }
)
</script>
