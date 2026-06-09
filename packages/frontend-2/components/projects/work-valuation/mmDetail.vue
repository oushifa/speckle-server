<template>
  <div class="space-y-4">
    <CommonAlert color="primary" :hide-icon="true">
      <template #description>
        <div class="flex justify-between px-5">
          <div>验工编号：{{ item?.code || '-' }}</div>
          <div>发起时间：{{ formatDate(Number(item?.baseDate || 0)) }}</div>
        </div>
      </template>
    </CommonAlert>

    <div class="p-2 border rounded-md border-outline-2">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CommonAlert color="primary" :hide-icon="true">
          <template #description>
            <div class="flex flex-col items-center justify-center">
              <div class="text-body-xs text-foreground-2">本期完成金额</div>
              <div class="text-body-lg font-semibold text-primary mt-1">
                {{ formatMoney(submitCurrentAmount) }}
              </div>
              <div>元</div>
            </div>
          </template>
        </CommonAlert>
        <CommonAlert color="success" :hide-icon="true">
          <template #description>
            <div class="flex flex-col items-center justify-center">
              <div class="text-body-xs text-foreground-2">累计完成金额</div>
              <div
                v-if="costSummaryLoading"
                class="text-body-lg font-semibold text-success mt-1 min-h-[28px] flex items-center"
              >
                <CommonLoadingIcon class="h-5 w-5" />
              </div>
              <div v-else class="text-body-lg font-semibold text-success mt-1">
                {{ formatMoney(submitCumulativeAmount) }}
              </div>
              <div>元</div>
            </div>
          </template>
        </CommonAlert>
        <CommonAlert color="danger" :hide-icon="true">
          <template #description>
            <div class="flex flex-col items-center justify-center">
              <div class="text-body-xs text-foreground-2">合同总金额</div>
              <div
                v-if="costSummaryLoading"
                class="text-body-lg font-semibold mt-1 min-h-[28px] flex items-center"
              >
                <CommonLoadingIcon class="h-5 w-5" />
              </div>
              <div v-else class="text-body-lg font-semibold mt-1">
                {{ formatMoney(submitContractAmount) }}
              </div>
              <div>元</div>
            </div>
          </template>
        </CommonAlert>
      </div>
      <div class="text-center mt-2">完成进度：{{ submitProgress }}%</div>
    </div>
    <slot />
    <div
      class="text-body-xs text-warning bg-warning-lighter/20 border border-warning/40 rounded-md px-3 py-2"
    >
      提醒：送审后该验工单将无法编辑和删除，请确认信息无误后提交。
    </div>

    <div class="mt-2">
      <LayoutTabsHorizontal v-model:active-item="activeTab" :items="tabItems" />
    </div>

    <div
      v-if="activeTab.id === 'list' && submitRows.length"
      class="rounded border border-outline-3 overflow-auto max-h-[420px]"
    >
      <table class="w-full text-sm">
        <thead class="bg-foundation-2 sticky top-0">
          <tr>
            <th class="text-left px-3 py-2">清单编码</th>
            <th class="text-left px-3 py-2">清单名称</th>
            <th class="text-right px-3 py-2">工程总量</th>
            <th class="text-right px-3 py-2">累计验工</th>
            <th class="text-right px-3 py-2">综合单价</th>
            <th class="text-right px-3 py-2">本次验工量</th>
            <th class="text-left px-3 py-2">备注</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="row in submitRows"
            :key="row.boqItemId"
          >
            <tr class="border-t border-outline-3">
              <td class="px-3 py-2">{{ row.boqCode }}</td>
              <td class="px-3 py-2">
                <div
                  :style="{ paddingLeft: `${Math.max(0, row.boqDepth - 1) * 16}px` }"
                  class="flex items-center gap-1"
                >
                  <button
                    v-if="!row.isSummaryRow && row.sourceAcceptances?.length"
                    class="p-0.5 rounded hover:bg-highlight-1 shrink-0"
                    @click="toggleExpand(row.boqItemId)"
                  >
                    <ChevronRightIcon
                      class="h-3.5 w-3.5 transition-transform duration-150"
                      :class="expandedRowIds.has(row.boqItemId) ? 'rotate-90' : ''"
                    />
                  </button>
                  <span :class="row.isSummaryRow ? 'font-medium text-foreground' : ''">
                    {{ row.boqName }}
                  </span>
                </div>
              </td>
              <td class="px-3 py-2 text-right">
                <span v-if="isBoqQuantityMissing(row)" class="text-danger font-semibold">
                  未维护清单工程量
                </span>
                <template v-else-if="!row.isSummaryRow">
                  {{ formatQty(Number(row.pendingTotalQty || 0)) }}
                </template>
              </td>
              <td class="px-3 py-2 text-right">
                <div
                  v-if="!row.isSummaryRow"
                  :class="
                    isCumulativeExceeded(row)
                      ? 'text-danger font-semibold'
                      : 'text-foreground'
                  "
                >
                  {{ formatQty(Number(row.approvedCumulativeQty || 0)) }}
                  <span v-if="isCumulativeExceeded(row)">（超出工程总量）</span>
                </div>
              </td>
              <td class="px-3 py-2 text-right">
                <template v-if="!row.isSummaryRow">
                  {{ formatPrice(row.price, row.isSummaryRow) }}
                </template>
              </td>
              <td class="px-3 py-2 text-right">
                <template v-if="!row.isSummaryRow">
                  {{ formatQty(Number(row.measuredQty || 0)) }}
                </template>
              </td>
              <td class="px-3 py-2">
                <template v-if="!row.isSummaryRow">
                  {{ row.remark || '-' }}
                </template>
              </td>
            </tr>
            <!-- 细分项（质量验收单）展开行 -->
            <tr v-if="expandedRowIds.has(row.boqItemId) && row.sourceAcceptances?.length" class="bg-highlight-1/30">
              <td colspan="8" class="p-0 border-t border-outline-3">
                <div class="px-8 py-3">
                  <div class="text-xs font-medium text-foreground-2 mb-2">关联的质量验收单</div>
                  <table class="w-full text-xs text-foreground-2 border border-outline-3 rounded overflow-hidden">
                    <thead class="bg-foundation text-left">
                      <tr>
                        <th class="px-2 py-1 border-b border-outline-3">区域部位</th>
                        <th class="px-2 py-1 border-b border-outline-3">检验批编号</th>
                        <th class="px-2 py-1 border-b border-outline-3">检验批内容</th>
                        <th class="px-2 py-1 border-b border-outline-3 w-24">验收日期</th>
                        <th class="px-2 py-1 border-b border-outline-3 text-right w-24">工程量</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="acc in row.sourceAcceptances"
                        :key="acc.id"
                        class="border-b border-outline-3 last:border-b-0 bg-foundation hover:bg-highlight-1/50 transition-colors"
                      >
                        <td class="px-2 py-1.5">{{ acc.acceptancePart || '-' }}</td>
                        <td class="px-2 py-1.5">{{ acc.inspectionLotNumber || '-' }}</td>
                        <td class="px-2 py-1.5">{{ acc.acceptanceContent || '-' }}</td>
                        <td class="px-2 py-1.5">{{ acc.actualFinishDate ? formatDate(Number(acc.actualFinishDate)) : '-' }}</td>
                        <td class="px-2 py-1.5 text-right">{{ acc.workVolume != null ? acc.workVolume : '-' }} {{ acc.unit || '' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-else-if="activeTab.id === 'list'" class="text-body-sm text-foreground-2">
      暂无验工列表
    </div>

    <div
      v-else-if="activeTab.id === 'model'"
      class="rounded border border-outline-3 h-[420px] relative overflow-hidden"
    >
      <div
        v-if="modelLoading"
        class="h-full flex items-center justify-center text-body-sm text-foreground-2"
      >
        关联模型加载中...
      </div>
      <div
        v-else-if="!modelIds.length"
        class="h-full flex items-center justify-center text-body-sm text-foreground-2"
      >
        暂无可展示的验工模型
      </div>
      <CommonModelPropsViewer
        v-else
        :project-id="props.projectId"
        :model-ids="modelIds"
        :filter-bims="bimIds"
        :filter-application-ids="applicationIds"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { projectQualityAcceptanceFormsQuery } from '~/lib/projects/graphql/queries'
import type {
  ProjectMonthlyMeasurementsQuery,
  ProjectQualityAcceptanceFormsQuery
} from '~/lib/common/generated/gql/graphql'

type MonthlyMeasurementNode = NonNullable<
  NonNullable<
    NonNullable<ProjectMonthlyMeasurementsQuery['project']>['monthlyMeasurements']
  >['items'][number]
>

type ProjectCostSummaryResponse = {
  totalContractAmount: number
  completedAmount: number
}

const props = defineProps<{
  item: MonthlyMeasurementNode | null
  projectId: string
}>()
const apiOrigin = useApiOrigin()

const tabItems = [
  { title: '验工列表', id: 'list' },
  { title: '关联模型', id: 'model' }
]
const activeTab = ref(tabItems[0])
const expandedRowIds = ref(new Set<string>())

const toggleExpand = (boqItemId: string) => {
  if (expandedRowIds.value.has(boqItemId)) {
    expandedRowIds.value.delete(boqItemId)
  } else {
    expandedRowIds.value.add(boqItemId)
  }
  expandedRowIds.value = new Set(expandedRowIds.value)
}

const submitSourceAcceptanceIds = computed(() =>
  Array.from(
    new Set(
      (props.item?.items || [])
        .flatMap((row) => row.sourceAcceptanceIds || [])
        .filter((id) => !!id)
    )
  )
)

const { result: acceptanceFormsResult, loading: modelLoading } = useQuery(
  projectQualityAcceptanceFormsQuery,
  () => ({
    projectId: props.projectId,
    search: null,
    cursor: null,
    limit: 500
  }),
  {
    enabled: computed(
      () =>
        !!props.projectId &&
        activeTab.value.id === 'model' &&
        submitSourceAcceptanceIds.value.length > 0
    )
  }
)

const modelIds = computed(() => {
  const selectedIds = new Set(submitSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: any) => {
      if (!form || !selectedIds.has(form.id)) return
      const BIM = (form as unknown as { BIM?: Array<{ modelId?: string | null }> | null }).BIM || []
      BIM.forEach((entry) => {
        if (entry.modelId) ids.add(entry.modelId)
      })
    }
  )
  return Array.from(ids)
})

const bimIds = computed(() => {
  const selectedIds = new Set(submitSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: any) => {
      if (!form || !selectedIds.has(form.id)) return
      const BIM = (form as unknown as { BIM?: Array<{ bimIds?: Array<string | null> | null }> | null }).BIM || []
      BIM.forEach((entry) => {
        ;(entry.bimIds || []).forEach((id) => {
          if (typeof id === 'string' && id) ids.add(id)
        })
      })
    }
  )
  return Array.from(ids)
})

const applicationIds = computed(() => {
  const selectedIds = new Set(submitSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: any) => {
      if (!form || !selectedIds.has(form.id)) return
      const BIM = (form as unknown as { BIM?: Array<{ applicationIds?: string[] | null }> | null }).BIM || []
      BIM.forEach((entry) => {
        ;(entry.applicationIds || []).forEach((id) => {
          if (typeof id === 'string' && id) ids.add(id)
        })
      })
    }
  )
  return Array.from(ids)
})

const submitRows = computed(() =>
  [...(props.item?.items || [])].sort(
    (a, b) => Number(a.sortIndex || 0) - Number(b.sortIndex || 0)
  )
)

const submitCurrentAmount = computed(() => {
  if (!props.item) return 0
  return (props.item.items || [])
    .filter((row) => !row.isSummaryRow)
    .reduce((sum, row) => {
      const qty = Number(row.measuredQty || 0)
      const price = Number(row.price || 0)
      return sum + qty * price
    }, 0)
})

const projectCostSummary = ref<ProjectCostSummaryResponse>({
  totalContractAmount: 0,
  completedAmount: 0
})
const costSummaryLoading = ref(false)

const loadProjectCostSummary = async () => {
  costSummaryLoading.value = true
  if (!props.projectId) {
    projectCostSummary.value = {
      totalContractAmount: 0,
      completedAmount: 0
    }
    costSummaryLoading.value = false
    return
  }

  try {
    const result = await $fetch<ProjectCostSummaryResponse>(
      `${apiOrigin}/api/stream/${props.projectId}/cost-summary`
    )
    projectCostSummary.value = {
      totalContractAmount: Number(result.totalContractAmount || 0),
      completedAmount: Number(result.completedAmount || 0)
    }
  } catch {
    projectCostSummary.value = {
      totalContractAmount: 0,
      completedAmount: 0
    }
  } finally {
    costSummaryLoading.value = false
  }
}

watch(
  () => props.projectId,
  () => {
    void loadProjectCostSummary()
  },
  { immediate: true }
)

const submitCumulativeAmount = computed(() => {
  return projectCostSummary.value.completedAmount
})

const submitContractAmount = computed(() => {
  return projectCostSummary.value.totalContractAmount
})

const submitProgress = computed(() => {
  if (!props.item) return 0
  return (
    Math.round((submitCurrentAmount.value / submitContractAmount.value) * 10000) / 100
  )
})

const formatMoney = (value: number) => {
  if (!Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

const formatDate = (value: number) => {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD')
}

const formatQty = (value: number) => {
  if (Number.isInteger(value)) return `${value}`
  return value.toFixed(2)
}

const formatPrice = (value: number | null | undefined, isSummaryRow: boolean) => {
  if (isSummaryRow) return '-'
  if (value === null || value === undefined) return '-'
  if (Number.isInteger(value)) return `${value}`
  return value.toFixed(2)
}

const isBoqQuantityMissing = (row: MonthlyMeasurementNode['items'][number]) =>
  !row.isSummaryRow && Number(row.pendingTotalQty || 0) < 0

const isCumulativeExceeded = (row: MonthlyMeasurementNode['items'][number]) =>
  !row.isSummaryRow &&
  !isBoqQuantityMissing(row) &&
  Number(row.approvedCumulativeQty || 0) > Number(row.pendingTotalQty || 0)
</script>
