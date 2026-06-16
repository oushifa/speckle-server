<template>
  <div
    class="space-y-6 pb-6 relative bg-foundation p-4 rounded-b-lg border border-t-0 border-outline-3"
  >
    <!-- 汇总展示 -->
    <div class="space-y-6">
      <!-- 表格上方单据元数据区 -->
      <div class="text-center space-y-2 relative">
        <h2 class="text-xl font-bold text-foreground">
          {{ contractName }}
        </h2>
        <div class="text-xs text-foreground-2 flex justify-center space-x-6">
          <span>合同编号：{{ projectContractCode }}</span>
          <span>基准年月：{{ formatDateMonth(item?.baseDate) }}</span>
          <span>{{ item?.roundName || '1' }} 验工月报汇总</span>
        </div>
        <div
          class="flex justify-between items-center text-xs text-foreground-2 px-1 pt-2 border-b border-outline-3 pb-1.5"
        >
          <div>
            承建单位（盖章）：
            <span class="font-medium text-foreground">
              {{ item?.unit || '上海建工集团股份有限公司' }}
            </span>
          </div>
          <div class="flex items-center space-x-3">
            <span>单位：元</span>
          </div>
        </div>
      </div>

      <!-- 经典深蓝色双层表头表格 -->
      <div
        class="border border-outline-3 rounded-lg overflow-auto max-h-[420px] shadow-sm"
      >
        <table class="w-full text-[11px] text-left min-w-[1050px] border-collapse">
          <thead class="bg-[#0f4c9c] text-white text-center sticky top-0 z-10">
            <tr class="border-b border-blue-800">
              <th rowspan="2" class="px-2 py-2 border-r border-blue-800 w-10">序号</th>
              <th rowspan="2" class="px-2 py-2 border-r border-blue-800 w-16">
                清单章节
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-left pl-3 w-56"
              >
                内容名称
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-right pr-3 w-28"
              >
                合同价
              </th>
              <th colspan="4" class="px-2 py-1.5 border-b border-blue-800 border-r">
                本期完成工作量
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-right pr-3 w-28"
              >
                本年完成工作量
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-right pr-3 w-28"
              >
                累计完成工作量
              </th>
              <th
                rowspan="2"
                class="px-2 py-2 border-r border-blue-800 text-right pr-3 w-20"
              >
                合同累计完成比例%
              </th>
              <th rowspan="2" class="px-2 py-2 w-20">备注</th>
            </tr>
            <tr class="bg-[#1a5ba8]">
              <th class="px-2 py-1.5 border-r border-blue-800 text-right pr-3 w-24">
                施工单位
              </th>
              <th class="px-2 py-1.5 border-r border-blue-800 text-right pr-3 w-24">
                施工监理
              </th>
              <th class="px-2 py-1.5 border-r border-blue-800 text-right pr-3 w-24">
                现场指挥部
              </th>
              <th class="px-2 py-1.5 border-r border-blue-800 text-right pr-3 w-24">
                投资监理
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in acceptanceGroups" :key="group.groupKey">
              <tr
                v-for="row in group.rows"
                :key="row.boqItemId"
                class="border-b border-outline-3 bg-foundation hover:bg-highlight-1/20 transition-colors"
              >
                <td class="px-2 py-2 text-center text-foreground-2">
                  {{ row.displayIndex }}
                </td>
                <td class="px-2 py-2 text-center font-mono">{{ row.boqCode }}</td>
                <td class="px-2 py-2 text-left pl-3 font-medium">
                  <button
                    class="text-primary hover:underline text-left"
                    title="点击编辑清单明细"
                    @click="openTreeEdit(row.boqItemId, row.boqName)"
                  >
                    {{ row.boqName }}
                  </button>
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono">
                  {{ formatMoney(row.contractAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono">
                  {{ formatMoney(row.contractorAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono text-foreground-2">
                  {{ formatMoney(row.supervisionAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono text-foreground-2">
                  {{ formatMoney(row.headquartersAmount) }}
                </td>
                <td
                  class="px-2 py-2 text-right pr-3 font-mono text-primary font-medium"
                >
                  {{ formatMoney(row.investmentAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono">
                  {{ formatMoney(row.yearlyAmount) }}
                </td>
                <td
                  class="px-2 py-2 text-right pr-3 font-mono font-medium text-success-darker"
                >
                  {{ formatMoney(row.cumulativeAmount) }}
                </td>
                <td class="px-2 py-2 text-right pr-3 font-mono">
                  {{ row.cumulativeRate }}%
                </td>
                <td
                  class="px-2 py-2 text-center text-foreground-2 truncate max-w-[80px]"
                >
                  {{ row.remark || '-' }}
                </td>
              </tr>

              <tr
                class="bg-foundation-2 font-bold text-foreground border-b border-outline-3"
              >
                <td class="px-2 py-2.5 text-center" />
                <td class="px-2 py-2.5 text-center" />
                <td class="px-2 py-2.5 text-left pl-3">
                  {{ group.groupBoqName }} 小计
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.contractAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.contractorAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.supervisionAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.headquartersAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono text-primary">
                  {{ formatMoney(group.subtotal.investmentAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ formatMoney(group.subtotal.yearlyAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono text-success-darker">
                  {{ formatMoney(group.subtotal.cumulativeAmount) }}
                </td>
                <td class="px-2 py-2.5 text-right pr-3 font-mono">
                  {{ group.subtotal.cumulativeRate }}%
                </td>
                <td class="px-2 py-2.5 text-center" />
              </tr>
            </template>

            <!-- 总价行 -->
            <tr
              class="bg-[#0f4c9c] font-bold text-white border-t border-blue-900 sticky bottom-0 z-10"
            >
              <td class="px-2 py-2.5 text-center" />
              <td class="px-2 py-2.5 text-center" />
              <td class="px-2 py-2.5 text-left pl-3">总价</td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.contractAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.contractorAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.supervisionAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.headquartersAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono text-white">
                {{ formatMoney(totalSums.investmentAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ formatMoney(totalSums.yearlyAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono text-white">
                {{ formatMoney(totalSums.cumulativeAmount) }}
              </td>
              <td class="px-2 py-2.5 text-right pr-3 font-mono">
                {{ totalSums.cumulativeRate }}%
              </td>
              <td class="px-2 py-2.5 text-center" />
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 四方审核意见签署区 -->
      <div class="bg-foundation space-y-4 shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <!-- 施工监理意见 -->
          <div
            class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
          >
            <span class="text-xs font-semibold text-foreground-2">施工监理意见</span>
            <textarea
              v-model="acceptanceDetails.supervisionOpinion"
              placeholder="审核意见..."
              :disabled="!permissions.supervision"
              class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
            />
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">经办人</div>
                <div class="text-xs font-medium text-foreground">
                  {{ getAcceptanceAuditUser('supervision') }}
                </div>
              </div>
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">日期</div>
                <div class="text-xs font-mono text-foreground">
                  {{ getAcceptanceOperatorDate('施工监理经办人') || '\u00A0' }}
                </div>
              </div>
            </div>
          </div>

          <!-- 现场指挥部意见 -->
          <div
            class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
          >
            <span class="text-xs font-semibold text-foreground-2">现场指挥部意见</span>
            <textarea
              v-model="acceptanceDetails.headquartersOpinion"
              placeholder="审核意见..."
              :disabled="!permissions.headquarters"
              class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
            />
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">经办人</div>
                <div class="text-xs font-medium text-foreground">
                  {{ getAcceptanceAuditUser('headquarters') }}
                </div>
              </div>
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">日期</div>
                <div class="text-xs font-mono text-foreground">
                  {{ getAcceptanceOperatorDate('现场指挥部经办人') || '\u00A0' }}
                </div>
              </div>
            </div>
          </div>

          <!-- 投资监理意见 -->
          <div
            class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
          >
            <span class="text-xs font-semibold text-foreground-2">投资监理意见</span>
            <textarea
              v-model="acceptanceDetails.investmentOpinion"
              placeholder="审核意见..."
              :disabled="!permissions.investment"
              class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
            />
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">经办人</div>
                <div class="text-xs font-medium text-foreground">
                  {{ getAcceptanceAuditUser('investment') }}
                </div>
              </div>
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">日期</div>
                <div class="text-xs font-mono text-foreground">
                  {{ getAcceptanceOperatorDate('投资监理经办人') || '\u00A0' }}
                </div>
              </div>
            </div>
          </div>

          <!-- 业主单位意见 -->
          <div
            class="p-4 border border-outline-3 rounded-lg bg-foundation-2 space-y-3 flex flex-col justify-between"
          >
            <span class="text-xs font-semibold text-foreground-2">业主单位意见</span>
            <textarea
              v-model="acceptanceDetails.ownerOpinion"
              placeholder="审核意见..."
              :disabled="!permissions.owner"
              class="w-full bg-foundation border border-outline-3 rounded p-2 text-xs focus:outline-none focus:border-primary disabled:opacity-60 h-20"
            />
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">经办人</div>
                <div class="text-xs font-medium text-foreground">
                  {{ getAcceptanceAuditUser('owner') }}
                </div>
              </div>
              <div class="rounded border border-outline-3 bg-foundation px-2 py-1.5">
                <div class="text-[10px] text-foreground-2">日期</div>
                <div class="text-xs font-mono text-foreground">
                  {{ getAcceptanceOperatorDate('合约管理部经办人') || '\u00A0' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部固定浮动操作栏 -->
    <div
      class="sticky bottom-0 bg-foundation border-t border-outline-3 p-3 flex justify-end items-center gap-3 z-30 shadow-md"
    >
      <FormButton
        color="outline"
        class="border-primary text-primary"
        @click="openModelViewer"
      >
        验工模型查看
      </FormButton>

      <FormButton color="outline" @click="openAttachmentsDialog">
        <PaperClipIcon class="h-4 w-4 mr-1 text-foreground-2" />
        附件 ({{ acceptanceDetails.acceptanceAttachments?.length || 0 }})
      </FormButton>

      <FormButton
        v-if="isCurrentApprover"
        color="primary"
        :loading="acceptanceSaving"
        @click="saveTab1Acceptance"
      >
        <span class="flex items-center gap-1">
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
          保存
        </span>
      </FormButton>

      <FormButton color="outline" @click="goBackToList">
        <span>关闭</span>
      </FormButton>
    </div>

    <!-- 附件弹出层 LayoutDialog -->
    <LayoutDialog v-model:open="attachmentsDialogOpen" max-width="md">
      <template #header>验工附件管理</template>
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <span class="text-sm font-semibold">
            附件列表 ({{ acceptanceDetails.acceptanceAttachments?.length || 0 }} 个)
          </span>
          <input
            ref="acceptanceFileRef"
            type="file"
            class="hidden"
            multiple
            @change="handleAcceptanceFileUpload"
          />
          <FormButton
            v-if="isCurrentApprover"
            size="sm"
            color="primary"
            @click="triggerAcceptanceUpload"
          >
            上传新文件
          </FormButton>
        </div>

        <div
          v-if="acceptanceDetails.acceptanceAttachments?.length"
          class="space-y-2 max-h-[300px] overflow-y-auto pr-1"
        >
          <div
            v-for="(attachment, aIdx) in acceptanceDetails.acceptanceAttachments"
            :key="aIdx"
            class="flex justify-between items-center p-2 rounded bg-foundation-2 border border-outline-3 text-xs"
          >
            <div class="flex items-center gap-1.5 min-w-0 pr-3">
              <PaperClipIcon class="h-4 w-4 text-foreground-2 flex-shrink-0" />
              <span class="truncate" :title="attachment.name">
                {{ attachment.name || attachment.blobId }}
              </span>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <a
                :href="getBlobDownloadUrl(attachment.blobId)"
                target="_blank"
                class="text-primary hover:underline font-medium"
              >
                下载
              </a>
              <button
                v-if="isCurrentApprover"
                class="text-danger hover:underline font-medium"
                @click="removeAcceptanceAttachment(Number(aIdx))"
              >
                删除
              </button>
            </div>
          </div>
        </div>
        <div
          v-else
          class="text-center text-xs text-foreground-2 py-6 border border-dashed rounded-lg border-outline-3"
        >
          暂无上传的附件文件
        </div>
      </div>
    </LayoutDialog>

    <!-- 验工三维模型查看弹窗 -->
    <LayoutDialog v-model:open="modelViewerOpen" max-width="xl">
      <template #header>月度验工模型查看</template>
      <div class="h-[500px] w-full relative">
        <div
          v-if="acceptanceFormsLoading"
          class="h-full w-full flex items-center justify-center text-sm text-foreground-2"
        >
          加载项目构件信息中...
        </div>
        <div
          v-else-if="!selectedPreviewModelIds.length"
          class="h-full w-full flex items-center justify-center text-sm text-foreground-2"
        >
          该月度验工单下暂无关联的构件模型
        </div>
        <CommonModelPropsViewer
          v-else
          :project-id="projectId"
          :model-ids="selectedPreviewModelIds"
          :filter-bims="selectedPreviewBimIds"
          :filter-application-ids="selectedPreviewApplicationIds"
        />
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PaperClipIcon } from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import { FormButton, LayoutDialog } from '@speckle/ui-components'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { projectQualityAcceptanceFormsQuery } from '~/lib/projects/graphql/queries'
import {
  getMonthlyMeasurementAuditDisplayStatus,
  getMonthlyMeasurementPermissions
} from '~/lib/projects/helpers/monthlyMeasurementApproval'
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

const emit = defineEmits(['refetch'])
const apiOrigin = useApiOrigin()
const { userId } = useActiveUser()
const { triggerNotification } = useGlobalToast()

// 数据缓存
const aggregatedItems = ref<any[]>([])
const acceptanceSummary = ref({ current: 0, cumulative: 0, contract: 0 })

const sumAggregatedRows = (rows: any[]) => {
  let contractAmount = 0
  let contractorAmount = 0
  let supervisionAmount = 0
  let headquartersAmount = 0
  let investmentAmount = 0
  let yearlyAmount = 0
  let cumulativeAmount = 0

  for (const row of rows) {
    contractAmount += Number(row.contractAmount || 0)
    contractorAmount += Number(row.contractorAmount || 0)
    supervisionAmount += Number(row.supervisionAmount || 0)
    headquartersAmount += Number(row.headquartersAmount || 0)
    investmentAmount += Number(row.investmentAmount || 0)
    yearlyAmount += Number(row.yearlyAmount || 0)
    cumulativeAmount += Number(row.cumulativeAmount || 0)
  }

  return {
    contractAmount,
    contractorAmount,
    supervisionAmount,
    headquartersAmount,
    investmentAmount,
    yearlyAmount,
    cumulativeAmount,
    cumulativeRate:
      contractAmount > 0
        ? Math.round((cumulativeAmount / contractAmount) * 10000) / 100
        : 0
  }
}

const acceptanceGroups = computed(() => {
  const groups = new Map<
    string,
    {
      groupKey: string
      groupBoqCode: string
      groupBoqName: string
      rows: Array<any>
      subtotal: ReturnType<typeof sumAggregatedRows>
    }
  >()

  let displayIndex = 1
  for (const row of aggregatedItems.value) {
    const groupKey = row.groupBoqItemId || row.boqParentId || row.boqItemId
    const groupBoqCode = row.groupBoqCode || row.boqCode || '-'
    const groupBoqName = row.groupBoqName || row.boqName || '未分类'
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        groupBoqCode,
        groupBoqName,
        rows: [],
        subtotal: sumAggregatedRows([])
      })
    }
    groups.get(groupKey)!.rows.push({
      ...row,
      displayIndex
    })
    displayIndex += 1
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    subtotal: sumAggregatedRows(group.rows)
  }))
})

// 查询项目信息（用于显示元数据大标题）
const { result: projectResult } = useQuery(
  gql`
    query ProjectNameForAcceptance($id: String!) {
      project(id: $id) {
        id
        name
        contractName
        contractCode
      }
    }
  `,
  () => ({
    id: props.projectId
  })
)
const contractName = computed(() => {
  const contract = projectResult.value?.project?.contractName
  if (contract && contract.trim().length) return contract
  return projectResult.value?.project?.name || '项目合同'
})
const projectContractCode = computed(() => {
  const code = projectResult.value?.project?.contractCode
  if (code && code.trim().length) return code
  return '-'
})

const totalSums = computed(() => {
  return sumAggregatedRows(aggregatedItems.value)
})

// Tab 1 签署意见数据
const acceptanceDetails = ref<any>({
  measurementId: '',
  acceptanceAttachments: [],
  supervisionOpinion: '',
  supervisionAuditor: '',
  supervisionDateStr: '',
  headquartersOpinion: '',
  headquartersAuditor: '',
  headquartersDateStr: '',
  investmentOpinion: '',
  investmentAuditor: '',
  investmentDateStr: '',
  ownerOpinion: '',
  ownerAuditor: '',
  ownerDateStr: ''
})
const acceptanceSaving = ref(false)

// 弹出层管理
const attachmentsDialogOpen = ref(false)
const modelViewerOpen = ref(false)

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
        if (isStep(['施工监理经办人', '施工监理总监'])) result.supervision = true
        if (isStep(['现场指挥部经办人', '现场指挥'])) result.headquarters = true
        if (isStep(['投资监理经办人', '投资监理总监'])) result.investment = true
        if (isStep(['合约管理部经办人', '合约管理部负责人'])) result.contract = true
        if (isStep(['分管领导'])) result.leader = true
        if (isStep(['合约管理部负责人', '分管领导'])) result.owner = true
      }
    }
  }

  return result
})

const isCurrentApprover = computed(() => {
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

const acceptanceAuditStepMap = {
  supervision: ['施工监理经办人', '施工监理总监'],
  headquarters: ['现场指挥部经办人', '现场指挥'],
  investment: ['投资监理经办人', '投资监理总监'],
  owner: ['合约管理部经办人', '合约管理部负责人', '分管领导']
} as const

type AcceptanceAuditKey = keyof typeof acceptanceAuditStepMap

const getAuditUserDisplay = (stepNames: readonly string[]) => {
  if (!props.flowInstance) return ''
  const steps = props.flowInstance.steps || []
  const actions = props.flowInstance.actions || []

  const matchingSteps = steps.filter((s: any) =>
    stepNames.map((n) => n.trim()).includes(s.name?.trim())
  )

  const names: string[] = []
  for (const s of matchingSteps) {
    if (s.status === 'APPROVED' || s.status === 'REJECTED') {
      const action = actions.find(
        (a: any) =>
          a.stepId === s.id &&
          (a.action === 'APPROVED' ||
            a.action === 'STEP_APPROVED' ||
            a.action === 'REJECTED')
      )
      if (action && action.actor?.name) {
        names.push(action.actor.name)
      } else if (s.approvers && s.approvers.length > 0) {
        names.push(...s.approvers.map((u: any) => u.name).filter(Boolean))
      }
    }
  }

  const uniqueNames = Array.from(new Set(names))
  return uniqueNames.join('、') || '\u00A0'
}

const getAcceptanceAuditUser = (key: AcceptanceAuditKey) => {
  return getAuditUserDisplay(acceptanceAuditStepMap[key])
}

const getAcceptanceOperatorDate = (stepName: string) => {
  if (!props.flowInstance) return ''
  const steps = props.flowInstance.steps || []
  const step = steps.find((s: any) => s.name?.trim() === stepName.trim())
  if (step && step.status === 'APPROVED' && step.completedAt) {
    const parsed = dayjs(step.completedAt)
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
  }
  return ''
}

const getAcceptanceAuditDate = (value: string | null | undefined) => {
  if (!value) return '-'
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '-'
}

// 载入聚合工程列表数据
const loadAggregatedItems = async () => {
  if (!props.item?.id || !props.projectId) return
  try {
    const items = await $fetch<any[]>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/aggregated-items?level=section`
    )
    aggregatedItems.value = items

    let current = 0
    let cumulative = 0
    let contract = 0
    for (const row of items) {
      current += row.investmentAmount || 0
      cumulative += row.cumulativeAmount || 0
      contract += row.contractAmount || 0
    }
    acceptanceSummary.value = { current, cumulative, contract }
  } catch {
    aggregatedItems.value = []
  }
}

// 载入 Tab 1 意见及附件数据
const loadTab1Data = async () => {
  if (!props.item?.id || !props.projectId) return
  try {
    const data = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/acceptance`
    )

    // 初始化日期选择器格式，将大整数/字符串转化为 YYYY-MM-DD
    const formatDateForInput = (d: any) => {
      if (!d) return ''
      return dayjs(Number(d)).isValid() ? dayjs(Number(d)).format('YYYY-MM-DD') : ''
    }

    acceptanceDetails.value = {
      ...data,
      acceptanceAttachments: data.acceptanceAttachments || [],
      supervisionDateStr: formatDateForInput(data.supervisionDate),
      headquartersDateStr: formatDateForInput(data.headquartersDate),
      investmentDateStr: formatDateForInput(data.investmentDate),
      ownerDateStr: formatDateForInput(data.ownerDate)
    }
  } catch {
    // 默认空结构
  }
}

const saveTab1Acceptance = async () => {
  if (!props.item?.id || !props.projectId) return
  acceptanceSaving.value = true

  try {
    await $fetch(
      `${apiOrigin}/api/v1/projects/${props.projectId}/monthly-measurements/${props.item.id}/acceptance`,
      {
        method: 'PATCH',
        body: {
          supervisionOpinion: acceptanceDetails.value.supervisionOpinion,
          headquartersOpinion: acceptanceDetails.value.headquartersOpinion,
          investmentOpinion: acceptanceDetails.value.investmentOpinion,
          ownerOpinion: acceptanceDetails.value.ownerOpinion,
          acceptanceAttachments: acceptanceDetails.value.acceptanceAttachments
        }
      }
    )
    await loadTab1Data()
    emit('refetch')
    triggerNotification({
      title: '保存成功',
      description: '保存成功！',
      type: ToastNotificationType.Success
    })
  } catch (err: any) {
    triggerNotification({
      title: '保存失败',
      description: err.data?.error || '保存失败',
      type: ToastNotificationType.Danger
    })
  } finally {
    acceptanceSaving.value = false
  }
}

const openAttachmentsDialog = () => {
  attachmentsDialogOpen.value = true
}

const acceptanceFileRef = ref<HTMLInputElement | null>(null)
const triggerAcceptanceUpload = () => {
  acceptanceFileRef.value?.click()
}
const handleAcceptanceFileUpload = async (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return
  try {
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      const res = await $fetch<any>(`${apiOrigin}/api/stream/${props.projectId}/blob`, {
        method: 'POST',
        body: formData
      })
      const list = acceptanceDetails.value.acceptanceAttachments || []
      list.push({ blobId: res.blobId, name: file.name })
      acceptanceDetails.value.acceptanceAttachments = [...list]
    }
    await saveTab1Acceptance()
  } catch (err) {
    triggerNotification({
      title: '文件上传失败',
      description: '文件上传失败：' + err,
      type: ToastNotificationType.Danger
    })
  }
}
const removeAcceptanceAttachment = async (idx: number) => {
  const list = [...(acceptanceDetails.value.acceptanceAttachments || [])]
  list.splice(idx, 1)
  acceptanceDetails.value.acceptanceAttachments = list
  await saveTab1Acceptance()
}

// -------------------------------------------------------------
// 三维模型构件 ID 解析及查询加载
// -------------------------------------------------------------
const previewSourceAcceptanceIds = computed(() => {
  const ids = new Set<string>()
  aggregatedItems.value.forEach((row) => {
    ;(row.sourceAcceptanceIds || []).forEach((id: string) => ids.add(id))
  })
  return Array.from(ids)
})

const { result: acceptanceFormsResult, loading: acceptanceFormsLoading } = useQuery(
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
        modelViewerOpen.value &&
        previewSourceAcceptanceIds.value.length > 0
    )
  }
)

const selectedPreviewModelIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: any) => {
      if (!form || !selectedIds.has(form.id)) return
      const BIM = form.BIM || []
      BIM.forEach((entry: any) => {
        if (entry.modelId) ids.add(entry.modelId)
      })
    }
  )
  return Array.from(ids)
})

const selectedPreviewBimIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: any) => {
      if (!form || !selectedIds.has(form.id)) return
      const BIM = form.BIM || []
      BIM.forEach((entry: any) => {
        ;(entry.bimIds || []).forEach((id: any) => {
          if (typeof id === 'string' && id) ids.add(id)
        })
      })
    }
  )
  return Array.from(ids)
})

const selectedPreviewApplicationIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: any) => {
      if (!form || !selectedIds.has(form.id)) return
      const BIM = form.BIM || []
      BIM.forEach((entry: any) => {
        ;(entry.applicationIds || []).forEach((id: any) => {
          if (typeof id === 'string' && id) ids.add(id)
        })
      })
    }
  )
  return Array.from(ids)
})

const openModelViewer = () => {
  modelViewerOpen.value = true
}

// 明细清单录入导航跳转入口
const openTreeEdit = (
  boqItemId: string | null = null,
  boqName: string = '全部章节'
) => {
  navigateTo({
    path: `/projects/${props.projectId}/work-valuation/monthly-measurement/${props.item?.id}/acceptance-edit`,
    query: {
      boqItemId: boqItemId || '',
      boqName: boqName || ''
    }
  })
}

const goBackToList = () => {
  navigateTo(`/projects/${props.projectId}/work-valuation/monthly-measurement`)
}

// -------------------------------------------------------------
// 通用辅助方法
// -------------------------------------------------------------
const getBlobDownloadUrl = (blobId: string) => {
  return `${apiOrigin}/api/stream/${props.projectId}/blob/${blobId}`
}

const formatMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '0.00'
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatDate = (value: any) => {
  if (!value) return '-'
  const ts = Number(value)
  if (!Number.isNaN(ts) && ts > 0) {
    return dayjs(ts).format('YYYY-MM-DD')
  }
  return dayjs(String(value)).format('YYYY-MM-DD')
}

const formatDateMonth = (value: any) => {
  if (!value) return '-'
  const ts = Number(value)
  if (!Number.isNaN(ts) && ts > 0) {
    return dayjs(ts).format('YYYY年MM月')
  }
  return dayjs(String(value)).format('YYYY年MM月')
}

const formatQty = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  if (Number.isInteger(value)) return `${value}`
  return value.toFixed(2)
}

watch(
  () => props.item?.id,
  () => {
    if (props.item?.id) {
      void loadAggregatedItems()
      void loadTab1Data()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
/* 微调日期输入框 */
:deep(input[type='date']) {
  font-size: 11px;
  padding: 3px 6px;
}
/* 给大标题增加 subtle animation */
.animate-pulse-once {
  animation: pulse-once 1.2s ease-out;
}
@keyframes pulse-once {
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}
</style>
