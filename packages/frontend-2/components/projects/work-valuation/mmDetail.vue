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
              <div class="text-body-lg font-semibold text-success mt-1">
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
              <div class="text-body-lg font-semibold mt-1">
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
          <tr
            v-for="row in submitRows"
            :key="row.boqItemId"
            class="border-t border-outline-3"
          >
            <td class="px-3 py-2">{{ row.boqCode }}</td>
            <td class="px-3 py-2">
              <div :style="{ paddingLeft: `${Math.max(0, row.boqDepth - 1) * 16}px` }">
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
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useQuery } from '@vue/apollo-composable'
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

const props = defineProps<{
  item: MonthlyMeasurementNode | null
  projectId: string
}>()

const tabItems = [
  { title: '验工列表', id: 'list' },
  { title: '关联模型', id: 'model' }
]
const activeTab = ref(tabItems[0])

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
    (
      form: NonNullable<
        NonNullable<
          NonNullable<
            ProjectQualityAcceptanceFormsQuery['project']
          >['qualityAcceptanceForms']
        >['items'][number]
      > | null
    ) => {
      if (!form || !selectedIds.has(form.id)) return
      const modelId = form.bimElements?.modelId || ''
      if (modelId) ids.add(modelId)
    }
  )
  return Array.from(ids)
})

const bimIds = computed(() => {
  const selectedIds = new Set(submitSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (
      form: NonNullable<
        NonNullable<
          NonNullable<
            ProjectQualityAcceptanceFormsQuery['project']
          >['qualityAcceptanceForms']
        >['items'][number]
      > | null
    ) => {
      if (!form || !selectedIds.has(form.id)) return
      ;(form.bimElements?.bimIds || []).forEach((id) => {
        if (id) ids.add(id)
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

const submitCumulativeAmount = computed(() => {
  if (!props.item) return 0
  return (props.item.items || [])
    .filter((row) => !row.isSummaryRow)
    .reduce((sum, row) => {
      const qty = Number(row.approvedCumulativeQty || 0)
      const price = Number(row.price || 0)
      return sum + qty * price
    }, 0)
})

const submitContractAmount = computed(() => {
  if (!props.item) return 0
  return (props.item.items || [])
    .filter((row) => !row.isSummaryRow)
    .reduce((sum, row) => {
      const qty = Number(row.pendingTotalQty || 0)
      const price = Number(row.price || 0)
      return sum + Math.max(qty, 0) * price
    }, 0)
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
