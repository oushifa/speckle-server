<template>
  <div v-if="open" class="fixed inset-0 z-50 flex justify-end">
    <!-- 蒙层 -->
    <button
      type="button"
      aria-label="关闭追溯抽屉"
      class="fixed inset-0 block w-full bg-black/50 backdrop-blur-xs transition-opacity cursor-default"
      @click="handleClose"
    />

    <!-- 右侧抽屉主体 -->
    <div
      class="relative w-full max-w-2xl lg:max-w-3xl bg-foundation border-l border-outline-3 shadow-2xl h-full flex flex-col z-10 overflow-hidden text-foreground"
    >
      <!-- 抽屉头部 -->
      <div
        class="px-5 py-4 border-b border-outline-3 bg-foundation-2 flex items-center justify-between shrink-0"
      >
        <div class="flex items-center gap-2">
          <DocumentMagnifyingGlassIcon class="w-5 h-5 text-primary shrink-0" />
          <div>
            <h2 class="text-sm font-bold text-foreground">清单变更与审核流程追溯</h2>
            <div class="flex items-center gap-2 text-xs text-foreground-2 mt-0.5">
              <span class="font-mono text-primary font-bold">{{ boqItem?.code }}</span>
              <span>{{ boqItem?.name }}</span>
              <span v-if="boqItem?.unit" class="text-foreground-3">
                ({{ boqItem.unit }})
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="p-1 rounded text-foreground-2 hover:text-foreground hover:bg-outline-3/20 transition-colors"
          @click="handleClose"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- 当前生效量价指标卡片 -->
      <div
        v-if="traceData?.item"
        class="p-4 bg-foundation border-b border-outline-3 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs"
      >
        <div class="p-2 rounded bg-foundation-2 border border-outline-3">
          <span class="text-[11px] text-foreground-3 block">合同工程量 / 单价</span>
          <span class="font-mono font-medium text-foreground block mt-0.5">
            {{ formatNumber(traceData.item.quantity) }} {{ traceData.item.unit }} / ¥{{
              formatMoney(traceData.item.price)
            }}
          </span>
        </div>
        <div class="p-2 rounded bg-foundation-2 border border-outline-3">
          <span class="text-[11px] text-foreground-3 block">现行复核量 / 单价</span>
          <span class="font-mono font-medium text-primary block mt-0.5">
            {{
              traceData.item.reviewQuantity !== null
                ? formatNumber(traceData.item.reviewQuantity)
                : '—'
            }}
            / ¥{{
              traceData.item.reviewPrice !== null
                ? formatMoney(traceData.item.reviewPrice)
                : '—'
            }}
          </span>
        </div>
        <div class="p-2 rounded bg-foundation-2 border border-outline-3">
          <span class="text-[11px] text-foreground-3 block">累计变更/签证量</span>
          <span class="font-mono font-medium text-foreground block mt-0.5">
            {{
              traceData.item.changeQuantity !== null
                ? formatNumber(traceData.item.changeQuantity)
                : '0.00'
            }}
          </span>
        </div>
        <div class="p-2 rounded bg-primary/10 border border-primary/20">
          <span class="text-[11px] text-primary block">现行复核总价</span>
          <span class="font-mono font-bold text-primary block mt-0.5">
            ¥
            {{
              traceData.item.reviewAmount !== null
                ? formatMoney(traceData.item.reviewAmount)
                : '—'
            }}
          </span>
        </div>
      </div>

      <!-- 追溯记录列表主体 -->
      <div class="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        <!-- 加载中 -->
        <div
          v-if="loading"
          class="py-20 text-center text-xs text-foreground-2 flex items-center justify-center gap-2"
        >
          <ArrowPathIcon class="w-4 h-4 animate-spin text-primary" />
          <span>正在检索变更与审核流程追溯记录...</span>
        </div>

        <!-- 无记录 -->
        <div
          v-else-if="!traceData?.records?.length"
          class="py-24 text-center text-xs text-foreground-3 space-y-1"
        >
          <p>该清单项暂无审核流转记录</p>
          <p class="text-[11px] text-foreground-3">
            若需调整工程量或单价，请通过「复核工程量管理」或「签证变更管理」发起审核。
          </p>
        </div>

        <!-- 历次变更单据列表 -->
        <div v-else class="space-y-4">
          <div
            class="text-xs font-bold text-foreground-2 flex items-center justify-between"
          >
            <span>历次审核流转轨迹（共 {{ traceData.records.length }} 次）</span>
            <span class="text-[11px] text-foreground-3 font-normal">
              按送审时间倒序排列
            </span>
          </div>

          <div
            v-for="(rec, rIdx) in traceData.records"
            :key="rec.recordId || rIdx"
            class="rounded-xl border border-outline-3 bg-foundation shadow-sm p-4 space-y-3.5 transition-all hover:border-primary/40"
          >
            <!-- 1. 单据头部 -->
            <div
              class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-outline-3/60"
            >
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-primary text-sm">
                  {{ rec.code }}
                </span>
                <!-- 类型标签 -->
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium border"
                  :class="[
                    rec.kind === 'change'
                      ? 'bg-warning-lighter/20 text-warning-darker border-warning/30'
                      : 'bg-primary-muted/20 text-primary border-primary/30'
                  ]"
                >
                  {{ rec.kind === 'change' ? '签证变更量' : '复核工程量' }}
                </span>
                <!-- 来源标签 -->
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium border"
                  :class="sourceBadgeClass(rec.source)"
                  :title="rec.sourceCode ? `来源编码: ${rec.sourceCode}` : undefined"
                >
                  {{ sourceBadgeLabel(rec.source) }}
                </span>
                <!-- 审核状态徽标 -->
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium border"
                  :class="badgeClass(rec.approveStatus, rec.currentStepName)"
                >
                  {{
                    formatApproveStatusBadge(rec.approveStatus, rec.currentStepName)
                      .label
                  }}
                </span>
              </div>

              <!-- 查看详情跳转按钮 -->
              <button
                type="button"
                class="text-xs text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                @click="goToRecordDetail(rec)"
              >
                查看单据详情
                <ArrowTopRightOnSquareIcon class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- 2. 三方工程量核定与变更对比表 -->
            <div
              class="rounded-lg border border-outline-3/80 overflow-hidden bg-foundation-2/30"
            >
              <table class="w-full text-xs text-left border-collapse">
                <thead
                  class="bg-foundation-2 text-[11px] font-semibold text-foreground-2 border-b border-outline-3"
                >
                  <tr>
                    <th class="py-1.5 px-2.5">核定阶段</th>
                    <th class="py-1.5 px-2.5 text-center">施工单位填报</th>
                    <th class="py-1.5 px-2.5 text-center">财务监理审核</th>
                    <th class="py-1.5 px-2.5 text-center">合约部终审</th>
                    <th class="py-1.5 px-2.5 text-right">核定单价</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-outline-3/60 text-[11px] font-mono">
                  <tr>
                    <td class="py-1.5 px-2.5 font-sans font-medium text-foreground">
                      {{ rec.kind === 'change' ? '本次签证增量' : '复核工程量' }}
                    </td>
                    <td class="py-1.5 px-2.5 text-center text-foreground">
                      {{
                        rec.kind === 'change'
                          ? formatQtyWithSign(rec.changeQty)
                          : formatNumber(rec.reviewQty)
                      }}
                    </td>
                    <td class="py-1.5 px-2.5 text-center text-primary font-medium">
                      {{
                        rec.kind === 'change'
                          ? formatQtyWithSign(rec.changeQtySupervisor)
                          : formatNumber(rec.reviewQtySupervisor)
                      }}
                    </td>
                    <td class="py-1.5 px-2.5 text-center text-success font-bold">
                      {{
                        rec.kind === 'change'
                          ? formatQtyWithSign(rec.changeQtyContract)
                          : formatNumber(rec.reviewQtyContract)
                      }}
                    </td>
                    <td class="py-1.5 px-2.5 text-right text-foreground font-medium">
                      ¥ {{ formatMoney(rec.reviewUnitPrice) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 3. 生效变更前后快照对比 (若已生效) -->
            <div
              v-if="rec.beforeSnapshot && rec.afterSnapshot"
              class="p-2.5 rounded-lg border border-success/30 bg-success-lighter/10 text-xs space-y-1.5"
            >
              <div
                class="font-bold text-success-darker flex items-center justify-between text-[11px]"
              >
                <span>● 本单生效对该清单项的写入变更：</span>
                <span v-if="rec.effectiveAt" class="font-mono text-foreground-3">
                  生效于 {{ formatDate(rec.effectiveAt) }}
                </span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div>
                  <span class="text-foreground-3 block">复核量：</span>
                  <span>
                    {{ formatNumber(rec.beforeSnapshot.reviewQuantity) }} →
                    <b class="text-primary">
                      {{ formatNumber(rec.afterSnapshot.reviewQuantity) }}
                    </b>
                  </span>
                </div>
                <div>
                  <span class="text-foreground-3 block">变更量：</span>
                  <span>
                    {{ formatNumber(rec.beforeSnapshot.changeQuantity) }} →
                    <b class="text-primary">
                      {{ formatNumber(rec.afterSnapshot.changeQuantity) }}
                    </b>
                  </span>
                </div>
                <div>
                  <span class="text-foreground-3 block">复核单价：</span>
                  <span>
                    ¥{{ formatMoney(rec.beforeSnapshot.reviewPrice) }} →
                    <b class="text-primary">
                      ¥{{ formatMoney(rec.afterSnapshot.reviewPrice) }}
                    </b>
                  </span>
                </div>
                <div>
                  <span class="text-foreground-3 block">复核总价：</span>
                  <span>
                    ¥{{ formatMoney(rec.beforeSnapshot.reviewAmount) }} →
                    <b class="text-success font-bold">
                      ¥{{ formatMoney(rec.afterSnapshot.reviewAmount) }}
                    </b>
                  </span>
                </div>
              </div>
            </div>

            <!-- 4. 申请信息与附件 -->
            <div
              class="text-xs text-foreground-2 flex flex-wrap items-center justify-between gap-2 pt-0.5"
            >
              <div class="flex items-center gap-3">
                <span>
                  申请人：
                  <b class="text-foreground font-medium">{{ rec.applicant || '—' }}</b>
                </span>
                <span>
                  申请时间：
                  <span class="font-mono">{{ rec.applyDate || '—' }}</span>
                </span>
              </div>
              <div
                v-if="rec.reason"
                class="text-foreground-2 truncate max-w-sm"
                :title="rec.reason"
              >
                原因：{{ rec.reason }}
              </div>
            </div>

            <!-- 附件 -->
            <div
              v-if="rec.attachments && rec.attachments.length"
              class="text-xs flex items-center gap-2"
            >
              <span class="text-foreground-3 shrink-0 flex items-center gap-1">
                <PaperClipIcon class="w-3.5 h-3.5" />
                附件 ({{ rec.attachments.length }})：
              </span>
              <div class="flex flex-wrap gap-2">
                <a
                  v-for="(att, aIdx) in rec.attachments"
                  :key="aIdx"
                  :href="getBlobDownloadUrl(att)"
                  target="_blank"
                  class="text-primary hover:underline font-mono text-[11px]"
                  :title="att.name"
                >
                  {{ att.name }}
                </a>
              </div>
            </div>

            <!-- 5. 关联审批流程节点链与流转时间轴 (核心要求：追踪到流程) -->
            <div class="border-t border-outline-3/60 pt-2.5 space-y-2">
              <!-- 审批步骤进度节点 -->
              <div class="space-y-1">
                <span class="text-[11px] font-bold text-foreground block">
                  审批流程步骤链：
                </span>
                <div
                  v-if="rec.steps && rec.steps.length"
                  class="flex flex-wrap items-center gap-1.5 text-xs"
                >
                  <template v-for="(step, sIdx) in rec.steps" :key="step.id || sIdx">
                    <span v-if="sIdx > 0" class="text-outline-3">›</span>
                    <div
                      class="px-2 py-1 rounded border text-[11px] flex items-center gap-1.5"
                      :class="[
                        step.status === 'APPROVED'
                          ? 'border-success/30 bg-success-lighter/10 text-success-darker'
                          : step.status === 'PENDING'
                          ? 'border-primary/40 bg-primary/10 text-primary font-bold'
                          : 'border-outline-3 bg-foundation text-foreground-3'
                      ]"
                    >
                      <span>{{ step.name }}</span>
                      <span
                        v-if="step.approvedByNames?.length"
                        class="font-normal text-success"
                      >
                        ({{ step.approvedByNames.join('、') }})
                      </span>
                      <span
                        v-else-if="step.approverNames?.length"
                        class="font-normal text-foreground-3"
                      >
                        ({{ step.approverNames.join('、') }})
                      </span>
                    </div>
                  </template>
                </div>
                <div v-else class="text-xs text-foreground-3">未关联审批流实例</div>
              </div>

              <!-- 审批日志流水 -->
              <div v-if="rec.actions && rec.actions.length" class="space-y-1 pt-1">
                <span class="text-[11px] font-bold text-foreground block">
                  审批操作日志：
                </span>
                <div
                  class="space-y-1 bg-foundation-2/50 rounded-lg p-2 border border-outline-3 text-[11px]"
                >
                  <div
                    v-for="act in rec.actions"
                    :key="act.id"
                    class="flex items-start justify-between gap-2"
                  >
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-foreground">{{ act.actorName }}</span>
                      <span class="text-primary font-medium">{{ act.action }}</span>
                      <span v-if="act.comment" class="text-foreground-2 italic">
                        “{{ act.comment }}”
                      </span>
                    </div>
                    <span class="text-foreground-3 font-mono shrink-0">
                      {{ formatDate(act.createdAt) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  XMarkIcon,
  DocumentMagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  PaperClipIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import {
  formatApproveStatusBadge,
  formatMoney,
  formatNumber,
  toNum,
  type BoqReviewActionItem,
  type BoqReviewAttachment,
  type BoqReviewStepChainItem,
  type ReviewKind,
  type ReviewRowSource
} from './boqReviewTypes'
import { useAuthCookie } from '~~/lib/auth/composables/auth'
import { useApiOrigin } from '~~/composables/env'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'

const props = defineProps<{
  open: boolean
  projectId: string
  boqItem: { id: string; code: string; name: string; unit?: string | null } | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const apiOrigin = useApiOrigin()
const authToken = useAuthCookie()
const { triggerNotification } = useGlobalToast()

const loading = ref(false)

interface BoqAuditTraceItem {
  id: string
  code: string
  name: string
  unit?: string | null
  quantity?: number | string | null
  price?: number | string | null
  reviewQuantity?: number | string | null
  reviewPrice?: number | string | null
  changeQuantity?: number | string | null
  reviewAmount?: number | string | null
}

interface BoqQtySnapshot {
  reviewQuantity?: unknown
  changeQuantity?: unknown
  reviewPrice?: unknown
  reviewAmount?: unknown
}

interface BoqAuditTraceRecord {
  recordId: string
  kind: ReviewKind
  source: ReviewRowSource
  sourceCode?: string | null
  code: string
  approveStatus: string
  currentStepName?: string | null
  changeQty?: number | string | null
  changeQtySupervisor?: number | string | null
  changeQtyContract?: number | string | null
  reviewQty?: number | string | null
  reviewQtySupervisor?: number | string | null
  reviewQtyContract?: number | string | null
  reviewUnitPrice?: number | string | null
  beforeSnapshot?: BoqQtySnapshot | null
  afterSnapshot?: BoqQtySnapshot | null
  effectiveAt?: string | null
  applicant?: string
  applyDate?: string
  reason?: string
  attachments?: BoqReviewAttachment[]
  steps?: BoqReviewStepChainItem[]
  actions?: BoqReviewActionItem[]
}

interface BoqAuditTraceResponse {
  item?: BoqAuditTraceItem | null
  records?: BoqAuditTraceRecord[]
}

const traceData = ref<BoqAuditTraceResponse | null>(null)

const handleClose = () => {
  emit('update:open', false)
}

const loadAuditTrace = async () => {
  if (!props.projectId || !props.boqItem?.id) return
  loading.value = true
  try {
    const res = await $fetch<BoqAuditTraceResponse>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/boq/items/${props.boqItem.id}/audit-trace`,
      {
        headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}
      }
    )
    traceData.value = res
  } catch (err) {
    const detail = err as { data?: { error?: string }; message?: string } | null
    triggerNotification({
      title: '追溯记录加载失败',
      description:
        detail?.data?.error ||
        (err instanceof Error ? err.message : '') ||
        '无法获取清单项的审核流转记录',
      type: ToastNotificationType.Danger
    })
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.boqItem?.id],
  ([isOpen, itemId]) => {
    if (isOpen && itemId) {
      loadAuditTrace()
    } else {
      traceData.value = null
    }
  }
)

const formatDate = (val: string | null | undefined) => {
  if (!val) return '—'
  return dayjs(val).format('YYYY-MM-DD HH:mm')
}

const formatQtyWithSign = (val: number | string | null | undefined) => {
  if (val === undefined || val === null || val === '') return '—'
  const n = toNum(val)
  return n > 0 ? `+${formatNumber(n)}` : formatNumber(n)
}

const sourceBadgeLabel = (source: ReviewRowSource) => {
  switch (source) {
    case 'create':
      return '创建清单项'
    case 'file':
      return '文件导入'
    default:
      return '引入清单项'
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

const badgeClass = (status: string, currentStepName?: string) => {
  const badge = formatApproveStatusBadge(status, currentStepName)
  switch (badge.tone) {
    case 'warning':
      return 'bg-warning-lighter/20 text-warning-darker border-warning/30'
    case 'primary':
      return 'bg-primary-muted/20 text-primary border-primary/30'
    case 'success':
      return 'bg-success-lighter/20 text-success-darker border-success/30'
    case 'danger':
      return 'bg-danger-lighter/20 text-danger-darker border-danger/30'
    default:
      return 'bg-foundation-2 text-foreground-2 border-outline-3'
  }
}

const getBlobDownloadUrl = (att: BoqReviewAttachment) => {
  if (att.url) return att.url
  if (att.blobId) return `${apiOrigin}/api/stream/${props.projectId}/blob/${att.blobId}`
  return '#'
}

const goToRecordDetail = (rec: { recordId: string; kind: ReviewKind }) => {
  handleClose()
  navigateTo(
    `/projects/${props.projectId}/work-valuation/boq-review/${rec.recordId}?kind=${rec.kind}`
  )
}
</script>
