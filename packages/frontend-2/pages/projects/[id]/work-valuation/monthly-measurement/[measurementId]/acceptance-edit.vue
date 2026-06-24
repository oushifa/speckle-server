<template>
  <div class="flex flex-col h-full relative bg-foundation w-full max-w-full overflow-hidden p-1">
    <div class="flex flex-col h-full rounded-lg bg-foundation min-h-0">
      <div class="flex-shrink-0 flex items-center mb-4">
        <button
          class="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus:outline-none"
          @click="closeTreeEdit"
        >
          <ChevronLeftIcon class="h-4 w-4" />
          返回汇总（当前{{ isReadOnly ? '查看' : '录入' }}：{{ activeParentBoqName }}）
        </button>
      </div>

      <!-- 25列三层表头树形清单表格 -->
      <div class="flex-grow min-h-0 overflow-auto rounded border border-outline-3">
        <table class="w-full text-xs text-left min-w-[2200px] border-collapse">
          <thead
            class="bg-foundation-2 sticky top-0 font-semibold text-foreground-2 border-b border-outline-3 text-center z-10"
          >
            <!-- 行 1 -->
            <tr class="border-b border-outline-3 text-[11px] bg-foundation-2">
              <th
                rowspan="3"
                class="px-2 py-2 border-r border-outline-3 w-28 align-middle"
              >
                清单编号
              </th>
              <th
                rowspan="3"
                class="px-2 py-2 border-r border-outline-3 w-64 align-middle text-left pl-3"
              >
                项目名称
              </th>
              <th
                rowspan="3"
                class="px-2 py-2 border-r border-outline-3 w-12 align-middle"
              >
                单位
              </th>
              <th
                rowspan="3"
                class="px-2 py-2 border-r border-outline-3 w-24 align-middle text-right pr-3"
              >
                上期累计完成量
              </th>
              <th
                colspan="3"
                class="px-2 py-1.5 border-r border-outline-3 align-middle"
              >
                合同量
              </th>
              <th
                colspan="3"
                class="px-2 py-1.5 border-r border-outline-3 align-middle"
              >
                复核量
              </th>
              <th
                colspan="9"
                class="px-2 py-1.5 border-r border-outline-3 align-middle"
              >
                本月完成数
              </th>
              <th
                colspan="2"
                class="px-2 py-1.5 border-r border-outline-3 align-middle"
              >
                本年完成工程量
              </th>
              <th
                colspan="3"
                class="px-2 py-1.5 border-r border-outline-3 align-middle"
              >
                累计完成数
              </th>
              <th rowspan="3" class="px-2 py-2 w-28 align-middle text-center">备注</th>
            </tr>
            <!-- 行 2 -->
            <tr class="border-b border-outline-3 text-[11px] bg-foundation-3">
              <!-- 合同量 -->
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                单价
              </th>
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                数量
              </th>
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                合同价
              </th>
              <!-- 复核量 -->
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                单价
              </th>
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                数量
              </th>
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                合价
              </th>
              <!-- 本月完成数 -->
              <th class="px-2 py-1 border-r border-outline-3 text-right pr-3">
                辅助验工量
              </th>
              <th colspan="2" class="px-2 py-1 border-r border-outline-3">施工单位</th>
              <th colspan="2" class="px-2 py-1 border-r border-outline-3">施工监理</th>
              <th colspan="2" class="px-2 py-1 border-r border-outline-3">
                现场指挥部
              </th>
              <th colspan="2" class="px-2 py-1 border-r border-outline-3">投资监理</th>
              <!-- 本年完成工程量 -->
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                数量
              </th>
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                本年完成工作量
              </th>
              <!-- 累计完成数 -->
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                数量
              </th>
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3 text-success-darker"
              >
                累计完成工作量
              </th>
              <th
                rowspan="2"
                class="px-2 py-1 border-r border-outline-3 text-right pr-3"
              >
                合同累计完成比例%
              </th>
            </tr>
            <!-- 行 3 -->
            <tr class="border-b border-outline-3 text-[10px] bg-foundation-3">
              <!-- 本月完成数下级 -->
              <th class="px-2 py-0.5 border-r border-outline-3 text-right pr-3">
                数量
              </th>
              <th class="px-2 py-0.5 border-r border-outline-3 text-right pr-3">
                数量
              </th>
              <th class="px-2 py-0.5 border-r border-outline-3 text-right pr-3">
                金额 (元)
              </th>
              <th class="px-2 py-0.5 border-r border-outline-3 text-right pr-3">
                数量
              </th>
              <th class="px-2 py-0.5 border-r border-outline-3 text-right pr-3">
                金额 (元)
              </th>
              <th class="px-2 py-0.5 border-r border-outline-3 text-right pr-3">
                数量
              </th>
              <th class="px-2 py-0.5 border-r border-outline-3 text-right pr-3">
                金额 (元)
              </th>
              <th
                class="px-2 py-0.5 border-r border-outline-3 text-right pr-3 text-primary"
              >
                数量
              </th>
              <th
                class="px-2 py-0.5 border-r border-outline-3 text-right pr-3 text-primary"
              >
                金额 (元)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in visibleTreeRows"
              :key="row.boqItemId"
              class="border-b border-outline-3 hover:bg-highlight-1/20 transition-colors text-[11px]"
              :class="
                row.isSummaryRow ? 'bg-highlight-1/5 font-medium' : 'bg-foundation'
              "
            >
              <!-- 1. 清单编号 -->
              <td class="px-2 py-2 truncate font-mono border-r border-outline-3">
                {{ row.boqCode }}
              </td>

              <!-- 2. 项目名称 (含折叠/展开和缩进) -->
              <td class="px-2 py-2 border-r border-outline-3">
                <div
                  class="flex items-center"
                  :style="{ paddingLeft: `${Math.max(0, row.boqDepth - 1) * 12}px` }"
                >
                  <button
                    v-if="hasChildren(row)"
                    class="mr-1 hover:bg-highlight-1/30 rounded p-0.5 transition-colors focus:outline-none flex-shrink-0"
                    @click.stop="toggleExpand(row)"
                  >
                    <svg
                      v-if="row.isExpanded"
                      class="h-3 w-3 text-foreground-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="3"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                    <svg
                      v-else
                      class="h-3 w-3 text-foreground-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="3"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <span v-else class="w-4 inline-block flex-shrink-0"></span>
                  <span class="truncate" :title="row.boqName">{{ row.boqName }}</span>
                </div>
              </td>

              <!-- 3. 单位 -->
              <td class="px-2 py-2 text-center border-r border-outline-3">
                {{ row.uom || '-' }}
              </td>

              <!-- 4. 上期累计完成量 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatQty(row.lastCumulativeQty) }}
              </td>

              <!-- 5. 合同量 -->
              <!-- 单价 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                <template v-if="!row.isSummaryRow">
                  {{ formatMoney(row.price) }}
                </template>
                <span v-else>-</span>
              </td>
              <!-- 数量 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatQty(row.pendingTotalQty) }}
              </td>
              <!-- 合同价 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(row.contractAmount) }}
              </td>

              <!-- 6. 复核量 -->
              <!-- 单价 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                <template v-if="!row.isSummaryRow">
                  {{ formatMoney(row.price) }}
                </template>
                <span v-else>-</span>
              </td>
              <!-- 数量 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatQty(row.pendingTotalQty) }}
              </td>
              <!-- 合价 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(row.contractAmount) }}
              </td>

              <!-- 7. 本月完成数 -->
              <!-- 辅助验工量数量 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatQty(row.measuredQtyDefault) }}
              </td>

              <!-- 施工单位数量 -->
              <td class="px-2 py-1 border-r border-outline-3 w-24">
                <input
                  v-if="!row.isSummaryRow"
                  v-model.number="row.contractorQty"
                  type="number"
                  step="any"
                  :disabled="!permissions.contractor"
                  class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
                  @input="handleQtyInput(row, 'contractor')"
                />
                <span v-else class="font-mono pr-3 inline-block w-full text-right">
                  {{ formatQty(row.contractorQty) }}
                </span>
              </td>
              <!-- 施工单位金额 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(row.contractorAmount) }}
              </td>

              <!-- 施工监理数量 -->
              <td class="px-2 py-1 border-r border-outline-3 w-24">
                <input
                  v-if="!row.isSummaryRow"
                  v-model.number="row.supervisionQty"
                  type="number"
                  step="any"
                  :disabled="!permissions.supervision"
                  class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
                  @input="handleQtyInput(row, 'supervision')"
                />
                <span v-else class="font-mono pr-3 inline-block w-full text-right">
                  {{ formatQty(row.supervisionQty) }}
                </span>
              </td>
              <!-- 施工监理金额 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(row.supervisionAmount) }}
              </td>

              <!-- 现场指挥部数量 -->
              <td class="px-2 py-1 border-r border-outline-3 w-24">
                <input
                  v-if="!row.isSummaryRow"
                  v-model.number="row.headquartersQty"
                  type="number"
                  step="any"
                  :disabled="!permissions.headquarters"
                  class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
                  @input="handleQtyInput(row, 'headquarters')"
                />
                <span v-else class="font-mono pr-3 inline-block w-full text-right">
                  {{ formatQty(row.headquartersQty) }}
                </span>
              </td>
              <!-- 现场指挥部金额 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(row.headquartersAmount) }}
              </td>

              <!-- 投资监理数量 -->
              <td class="px-2 py-1 border-r border-outline-3 w-24 text-primary">
                <input
                  v-if="!row.isSummaryRow"
                  v-model.number="row.investmentQty"
                  type="number"
                  step="any"
                  :disabled="!permissions.investment"
                  class="w-full text-right bg-foundation border border-outline-3 rounded px-1 py-0.5 focus:outline-none focus:border-primary disabled:opacity-60 font-mono text-[11px]"
                  @input="handleQtyInput(row, 'investment')"
                />
                <span
                  v-else
                  class="font-mono pr-3 inline-block w-full text-right text-primary font-semibold"
                >
                  {{ formatQty(row.investmentQty) }}
                </span>
              </td>
              <!-- 投资监理金额 -->
              <td
                class="px-2 py-2 text-right border-r border-outline-3 font-mono text-primary font-semibold pr-3"
              >
                {{ formatMoney(row.investmentAmount) }}
              </td>

              <!-- 8. 本年完成工程量 -->
              <!-- 数量 (本年累计 = 本年历史累计 + 本期投资监理量) -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{
                  formatQty((row.yearlyCumulativeQty || 0) + (row.investmentQty || 0))
                }}
              </td>
              <!-- 工作量 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatMoney(row.yearlyAmount) }}
              </td>

              <!-- 9. 累计完成数 -->
              <!-- 数量 -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ formatQty((row.lastCumulativeQty || 0) + (row.investmentQty || 0)) }}
              </td>
              <!-- 累计完成工作量 -->
              <td
                class="px-2 py-2 text-right border-r border-outline-3 font-mono text-success-darker pr-3"
              >
                {{ formatMoney(row.cumulativeAmount) }}
              </td>
              <!-- 合同累计完成比例% -->
              <td class="px-2 py-2 text-right border-r border-outline-3 font-mono pr-3">
                {{ getCumulativeRate(row) }}%
              </td>

              <!-- 10. 备注 -->
              <td
                class="px-2 py-2 text-center text-foreground-2 truncate max-w-[100px]"
              >
                {{ row.remark || '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 右下角取消和保存操作区 -->
      <div v-if="!isReadOnly" class="flex-shrink-0 flex justify-end items-center gap-2 mt-4">
        <FormButton color="outline" @click="closeTreeEdit">取消</FormButton>
        <FormButton
          v-if="isCurrentApprover"
          color="primary"
          :loading="treeSaving"
          @click="saveTreeItems"
        >
          保存数据
        </FormButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, onMounted } from 'vue'
import { preciseAdd } from '~~/lib/common/helpers/preciseMath'
import { ChevronLeftIcon } from '@heroicons/vue/24/outline'
import { FormButton } from '@speckle/ui-components'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { getMonthlyMeasurementPermissions } from '~/lib/projects/helpers/monthlyMeasurementApproval'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'

type MonthlyMeasurementNode = {
  id: string
  code: string
  baseDate: string
  approveStatus?: string | null
  flowInstanceId?: string | null
  currentStepName?: string | null
  currentStepApprovers?: string[] | null
  unit?: string | null
  roundName?: string | null
  creator?: {
    id: string
    name: string
  } | null
}

const props = defineProps<{
  item: MonthlyMeasurementNode | null
  projectId: string
  flowInstance?: any
}>()

const apiOrigin = useApiOrigin()
const { userId } = useActiveUser()
const { triggerNotification } = useGlobalToast()
const route = useRoute()

const activeParentBoqItemId = ref<string | null>(null)
const activeParentBoqName = ref<string>('全部章节')
const treeRows = ref<any[]>([])
const originalRows = ref<any[]>([])
const treeSaving = ref(false)
const rowById = shallowRef<Map<string, any>>(new Map())
const rowsByDepth = shallowRef<Map<number, any[]>>(new Map())
const hasChildrenSet = shallowRef<Set<string>>(new Set())



const buildTreeIndex = (rows: any[]) => {
  const byId = new Map<string, any>()
  const depthMap = new Map<number, any[]>()
  const children = new Set<string>()

  rows.forEach((row) => {
    byId.set(row.boqItemId, row)
    const depth = Number(row.boqDepth || 0)
    const bucket = depthMap.get(depth)
    if (bucket) bucket.push(row)
    else depthMap.set(depth, [row])
  })

  rows.forEach((row) => {
    if (row.boqParentId) children.add(row.boqParentId)
  })

  rowById.value = byId
  rowsByDepth.value = depthMap
  hasChildrenSet.value = children
}

const isReadOnly = computed(() => route.query.mode !== 'edit')

const permissions = computed(() => {
  const result = {
    contractor: false,
    supervision: false,
    headquarters: false,
    investment: false,
    contract: false,
    leader: false,
    owner: false
  }

  if (isReadOnly.value) return result

  const isDraft = !props.item?.approveStatus || props.item?.approveStatus === 'START'
  const currentUserId = userId.value

  if (!currentUserId) return result

  if (isDraft) {
    const creatorId = props.item?.creator?.id
    if (creatorId === currentUserId) {
      result.contractor = true
    }
    return result
  }

  if (props.flowInstance && props.flowInstance.status === 'PENDING') {
    const pendingStep = props.flowInstance.steps?.find(
      (s: any) => s.status === 'PENDING'
    )
    if (pendingStep) {
      const stepName = (pendingStep.name || '').trim()
      const approverIds = pendingStep.approverIds || []

      if (approverIds.includes(currentUserId)) {
        const isStep = (names: string[]) => names.includes(stepName)

        if (isStep(['施工单位'])) result.contractor = true
        if (isStep(['施工监理经办人', '施工监理总监', '施工监理', '监理', '专业监理']))
          result.supervision = true
        if (isStep(['现场指挥部经办人', '现场指挥', '现场指挥部', '指挥部']))
          result.headquarters = true
        if (isStep(['投资监理经办人', '投资监理总监', '投资监理']))
          result.investment = true
        if (
          isStep([
            '合约管理部经办人',
            '合约管理部负责人',
            '计划合同部',
            '合约部',
            '合约管理部'
          ])
        )
          result.contract = true
        if (isStep(['分管领导'])) result.leader = true
        if (
          isStep(['合约管理部负责人', '分管领导', '计划合同部', '合约部', '合约管理部'])
        )
          result.owner = true
      }
    }
  }

  return result
})

const isCurrentApprover = computed(() => {
  if (isReadOnly.value) return false
  const isDraft = !props.item?.approveStatus || props.item?.approveStatus === 'START'
  const currentUserId = userId.value
  if (!currentUserId) return false

  if (isDraft) {
    const creatorId = props.item?.creator?.id
    return creatorId === currentUserId
  }

  if (props.flowInstance && props.flowInstance.status === 'PENDING') {
    const pendingStep = props.flowInstance.steps?.find(
      (s: any) => s.status === 'PENDING'
    )
    if (pendingStep) {
      const approverIds = pendingStep.approverIds || []
      return approverIds.includes(currentUserId)
    }
  }

  return false
})

// 寻找子树 ID
const getSubtreeItemIds = (rootId: string, allItems: any[]): Set<string> => {
  const childMap = new Map<string, string[]>()
  allItems.forEach((item) => {
    if (item.boqParentId) {
      if (!childMap.has(item.boqParentId)) childMap.set(item.boqParentId, [])
      childMap.get(item.boqParentId)!.push(item.boqItemId)
    }
  })
  const subtreeIds = new Set<string>()
  const traverse = (id: string) => {
    subtreeIds.add(id)
    const children = childMap.get(id) || []
    children.forEach((cId) => traverse(cId))
  }
  traverse(rootId)
  return subtreeIds
}

// 供 template 渲染的可见行（折叠隐藏逻辑）
const visibleTreeRows = computed(() => {
  const collapsedSet = new Set<string>()
  treeRows.value.forEach((row) => {
    if (row.isExpanded === false) {
      collapsedSet.add(row.boqItemId)
    }
  })

  return treeRows.value.filter((row) => {
    let pId = row.boqParentId
    while (pId && pId !== activeParentBoqItemId.value) {
      if (collapsedSet.has(pId)) {
        return false
      }
      const parentRow = rowById.value.get(pId)
      pId = parentRow ? parentRow.boqParentId : null
    }
    if (activeParentBoqItemId.value && row.boqItemId !== activeParentBoqItemId.value) {
      if (collapsedSet.has(activeParentBoqItemId.value)) {
        return false
      }
    }
    return true
  })
})

const hasChildren = (row: any) => {
  return hasChildrenSet.value.has(row.boqItemId)
}

const toggleExpand = (row: any) => {
  row.isExpanded = !row.isExpanded
}

const toSafeNumber = (value: any) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const getCumulativeRate = (row: any) => {
  const contractQty = toSafeNumber(row.pendingTotalQty)
  if (contractQty <= 0) return '0.00'
  const cumulativeQty =
    toSafeNumber(row.lastCumulativeQty) + toSafeNumber(row.investmentQty)
  return ((cumulativeQty / contractQty) * 100).toFixed(2)
}

let recalcRaf: number | null = null
const scheduleRecalculate = () => {
  if (recalcRaf) return
  recalcRaf = requestAnimationFrame(() => {
    recalcRaf = null
    recalculateTreeRows()
  })
}

const handleQtyInput = (
  row: any,
  type: 'contractor' | 'supervision' | 'headquarters' | 'investment'
) => {
  const val = row[`${type}Qty`]

  if (type === 'contractor') {
    row.supervisionQty = val
    row.headquartersQty = val
    row.investmentQty = val
  } else if (type === 'supervision') {
    row.headquartersQty = val
    row.investmentQty = val
  } else if (type === 'headquarters') {
    row.investmentQty = val
  }

  scheduleRecalculate()
}

// 自底向上重新计算汇总
const recalculateTreeRows = () => {
  if (!treeRows.value.length) return

  treeRows.value.forEach((row) => {
    if (row.isSummaryRow) {
      row.contractorQty = 0
      row.supervisionQty = 0
      row.headquartersQty = 0
      row.investmentQty = 0
      row.measuredQtyDefault = 0
      row.lastCumulativeQty = 0
      row.yearlyCumulativeQty = 0
      row.pendingTotalQty = 0

      // 汇总行金额初始化
      row.contractAmount = 0
      row.contractorAmount = 0
      row.supervisionAmount = 0
      row.headquartersAmount = 0
      row.investmentAmount = 0
      row.yearlyAmount = 0
      row.cumulativeAmount = 0
    } else {
      // 明细行金额初始化
      const price = toSafeNumber(row.price)
      const pendingTotalQty = toSafeNumber(row.pendingTotalQty)
      const contractorQty = toSafeNumber(row.contractorQty)
      const supervisionQty = toSafeNumber(row.supervisionQty)
      const headquartersQty = toSafeNumber(row.headquartersQty)
      const investmentQty = toSafeNumber(row.investmentQty)
      const yearlyCumulativeQty = toSafeNumber(row.yearlyCumulativeQty)
      const lastCumulativeQty = toSafeNumber(row.lastCumulativeQty)
      const boqAmount = toSafeNumber(row.boqAmount)

      row.contractAmount =
        row.boqAmount !== undefined && row.boqAmount !== null
          ? boqAmount
          : pendingTotalQty * price
      row.contractorAmount = contractorQty * price
      row.supervisionAmount = supervisionQty * price
      row.headquartersAmount = headquartersQty * price
      row.investmentAmount = investmentQty * price
      row.yearlyAmount = (yearlyCumulativeQty + investmentQty) * price
      row.cumulativeAmount = (lastCumulativeQty + investmentQty) * price
    }
  })

  const depths = Array.from(rowsByDepth.value.keys()).sort((a, b) => b - a)
  depths.forEach((depth) => {
    const rows = rowsByDepth.value.get(depth)
    if (!rows) return
    rows.forEach((row) => {
      if (!row.boqParentId) return
      const parent = rowById.value.get(row.boqParentId)
      if (!parent || !parent.isSummaryRow) return
      parent.contractorQty = preciseAdd(parent.contractorQty || 0, row.contractorQty || 0)
      parent.supervisionQty = preciseAdd(parent.supervisionQty || 0, row.supervisionQty || 0)
      parent.headquartersQty = preciseAdd(parent.headquartersQty || 0, row.headquartersQty || 0)
      parent.investmentQty = preciseAdd(parent.investmentQty || 0, row.investmentQty || 0)
      parent.measuredQtyDefault = preciseAdd(parent.measuredQtyDefault || 0, row.measuredQtyDefault || 0)
      parent.lastCumulativeQty = preciseAdd(parent.lastCumulativeQty || 0, row.lastCumulativeQty || 0)
      parent.yearlyCumulativeQty = preciseAdd(parent.yearlyCumulativeQty || 0, row.yearlyCumulativeQty || 0)
      parent.pendingTotalQty = preciseAdd(parent.pendingTotalQty || 0, row.pendingTotalQty || 0)

      // 累加金额
      parent.contractAmount = preciseAdd(parent.contractAmount || 0, row.contractAmount || 0)
      parent.contractorAmount = preciseAdd(parent.contractorAmount || 0, row.contractorAmount || 0)
      parent.supervisionAmount = preciseAdd(parent.supervisionAmount || 0, row.supervisionAmount || 0)
      parent.headquartersAmount = preciseAdd(parent.headquartersAmount || 0, row.headquartersAmount || 0)
      parent.investmentAmount = preciseAdd(parent.investmentAmount || 0, row.investmentAmount || 0)
      parent.yearlyAmount = preciseAdd(parent.yearlyAmount || 0, row.yearlyAmount || 0)
      parent.cumulativeAmount = preciseAdd(parent.cumulativeAmount || 0, row.cumulativeAmount || 0)
    })
  })
}

// 加载数据
const loadTreeData = async () => {
  if (!props.item?.id || !props.projectId) return
  try {
    const list = await $fetch<any[]>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/detail-items`
    )

    const boqItemId = (route.query.boqItemId as string) || null
    const boqName = (route.query.boqName as string) || '全部章节'

    activeParentBoqItemId.value = boqItemId
    activeParentBoqName.value = boqName

    list.forEach((row) => {
      row.isExpanded = true
    })

    originalRows.value = JSON.parse(JSON.stringify(list))

    if (boqItemId) {
      const subtreeSet = getSubtreeItemIds(boqItemId, list)
      treeRows.value = list.filter((row) => subtreeSet.has(row.boqItemId))
    } else {
      treeRows.value = list
    }

    buildTreeIndex(treeRows.value)
    recalculateTreeRows()
  } catch {
    triggerNotification({
      title: '加载失败',
      description: '明细清单获取失败',
      type: ToastNotificationType.Danger
    })
  }
}

const closeTreeEdit = () => {
  navigateTo({
    path: `/projects/${props.projectId}/work-valuation/monthly-measurement/${props.item?.id}/acceptance`,
    query: {
      mode: route.query.mode || ''
    }
  })
}

const saveTreeItems = async () => {
  if (!props.item?.id || !props.projectId || !treeRows.value.length) return
  treeSaving.value = true
  try {
    const changedRows = treeRows.value
      .filter((row) => !row.isSummaryRow)
      .filter((row) => {
        const orig = originalRows.value.find((o) => o.boqItemId === row.boqItemId)
        if (!orig) return true
        return (
          Number(row.contractorQty || 0) !== Number(orig.contractorQty || 0) ||
          Number(row.supervisionQty || 0) !== Number(orig.supervisionQty || 0) ||
          Number(row.headquartersQty || 0) !== Number(orig.headquartersQty || 0) ||
          Number(row.investmentQty || 0) !== Number(orig.investmentQty || 0)
        )
      })

    if (changedRows.length === 0) {
      triggerNotification({
        title: '提示',
        description: '未检测到任何修改',
        type: ToastNotificationType.Info
      })
      closeTreeEdit()
      return
    }

    const itemsPayload = changedRows.map((row) => ({
      boqItemId: row.boqItemId,
      contractorQty: Number(row.contractorQty || 0),
      supervisionQty: Number(row.supervisionQty || 0),
      headquartersQty: Number(row.headquartersQty || 0),
      investmentQty: Number(row.investmentQty || 0)
    }))

    await $fetch(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/detail-items`,
      {
        method: 'PATCH',
        body: { items: itemsPayload }
      }
    )
    triggerNotification({
      title: '保存成功',
      description: '明细清单数据保存成功！',
      type: ToastNotificationType.Success
    })
    closeTreeEdit()
  } catch (err: any) {
    triggerNotification({
      title: '保存失败',
      description: err.data?.error || '明细保存失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    treeSaving.value = false
  }
}

onMounted(() => {
  void loadTreeData()
})

const moneyFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const formatMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  if (!Number.isFinite(Number(value))) return '-'
  return moneyFormatter.format(value)
}

const formatQty = (value: any) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  if (Number.isInteger(num)) return `${num}`
  return num.toFixed(2)
}
</script>

<style scoped>
/* 微调日期输入框 */
:deep(input[type='date']) {
  font-size: 11px;
  padding: 3px 6px;
}
</style>
