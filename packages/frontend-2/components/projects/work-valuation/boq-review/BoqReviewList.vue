<template>
  <div class="space-y-4">
    <!-- 顶部工具栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-bold text-foreground">
          {{ meta.tabLabel }}
        </h2>
        <span class="text-xs text-foreground-2">
          共 {{ records.length }} 条
          <template v-if="draftCount > 0">（草稿 {{ draftCount }} 条）</template>
        </span>
      </div>

      <div class="flex items-center gap-2.5">
        <!-- 搜索框 -->
        <div class="relative w-64">
          <input
            v-model="searchQuery"
            type="text"
            aria-label="搜索"
            :placeholder="`搜索单号 / 原因 / 申请人`"
            class="w-full pl-8 pr-3 py-1.5 text-xs bg-foundation border border-outline-3 rounded-lg focus:outline-none focus:border-primary text-foreground transition-all"
            @keydown.enter="loadRecords"
          />
          <span
            class="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-foreground-2"
          >
            <MagnifyingGlassIcon class="w-3.5 h-3.5" />
          </span>
        </div>

        <!-- 刷新按钮 -->
        <FormButton color="outline" size="sm" :disabled="loading" @click="loadRecords">
          <ArrowPathIcon
            class="w-3.5 h-3.5 mr-1"
            :class="{ 'animate-spin': loading }"
          />
          刷新
        </FormButton>

        <!-- 新增按钮 -->
        <FormButton color="primary" size="sm" @click="handleCreate">
          <PlusIcon class="w-3.5 h-3.5 mr-1" />
          {{ meta.createLabel }}
        </FormButton>
      </div>
    </div>

    <!-- 列表表格 -->
    <div
      class="border border-outline-3 rounded-lg overflow-hidden bg-foundation shadow-sm"
    >
      <div class="overflow-x-auto">
        <div class="min-w-[1500px]">
          <!-- 表头 -->
          <div
            class="grid grid-cols-[140px_80px_1fr_90px_130px_140px_200px_140px_90px_160px] gap-2 px-3 py-2.5 bg-foundation-2 text-[12px] font-semibold text-foreground-2 border-b border-outline-3 select-none"
          >
            <div>{{ meta.short }}号</div>
            <div class="text-center">明细条数</div>
            <div>{{ meta.reasonLabel }}</div>
            <div>申请人</div>
            <div class="text-center">申请日期</div>
            <div class="text-center">审核状态</div>
            <div class="text-center">审核链 / 当前待审</div>
            <div class="text-center">生效时间</div>
            <div class="text-center">附件</div>
            <div class="text-center">操作</div>
          </div>

          <!-- 加载中 -->
          <div
            v-if="loading"
            class="py-16 text-center text-xs text-foreground-2 flex items-center justify-center gap-2"
          >
            <ArrowPathIcon class="w-4 h-4 animate-spin text-primary" />
            <span>加载{{ meta.short }}列表中...</span>
          </div>

          <!-- 空数据 -->
          <div
            v-else-if="records.length === 0"
            class="py-16 text-center text-xs text-foreground-2"
          >
            暂无{{ meta.short }}数据，点击右上角「{{ meta.createLabel }}」开始创建
          </div>

          <!-- 数据行 -->
          <div v-else class="divide-y divide-outline-3/60">
            <div
              v-for="record in records"
              :key="record.id"
              class="grid grid-cols-[140px_80px_1fr_90px_130px_140px_200px_140px_90px_160px] gap-2 px-3 py-2.5 text-[12px] items-center hover:bg-highlight-1/30 transition-colors"
              :class="isDraft(record) ? 'bg-warning-lighter/5' : 'bg-foundation'"
            >
              <!-- 1. 单号 -->
              <div
                class="font-mono text-primary font-medium truncate"
                :title="record.code"
              >
                <NuxtLink
                  :to="`/projects/${projectId}/work-valuation/boq-review/${record.id}?kind=${kind}`"
                  class="hover:underline"
                >
                  {{ record.code }}
                </NuxtLink>
              </div>

              <!-- 2. 明细条数 -->
              <div class="text-center font-mono tabular-nums text-foreground">
                {{ record.itemCount ?? record.rows?.length ?? 0 }}
                <span class="text-foreground-3 text-[11px] ml-0.5">项</span>
              </div>

              <!-- 3. 原因 -->
              <div class="truncate text-foreground" :title="record.reason">
                {{ record.reason || '（未填写）' }}
              </div>

              <!-- 4. 申请人 -->
              <div class="truncate text-foreground">
                {{ record.applicant || '—' }}
              </div>

              <!-- 5. 申请日期 -->
              <div class="text-center text-foreground-2 font-mono text-[11px]">
                {{ record.applyDate || '—' }}
              </div>

              <!-- 6. 审核状态 -->
              <div class="text-center">
                <span
                  class="inline-block px-2 py-0.5 rounded text-[11px] font-medium border"
                  :class="badgeClass(record)"
                >
                  {{ formatStatusText(record) }}
                </span>
              </div>

              <!-- 7. 审核链 / 当前待办 -->
              <div
                class="text-center truncate"
                :title="buildApprovalHoverTitle(record)"
              >
                <div
                  v-if="record.approvalChain && record.approvalChain.length"
                  class="inline-flex items-center gap-1 text-[11px]"
                >
                  <template v-for="(step, sIdx) in record.approvalChain" :key="step.id">
                    <span v-if="sIdx > 0" class="text-outline-3">›</span>
                    <span
                      :class="[
                        step.status === 'APPROVED'
                          ? 'text-success font-medium'
                          : step.status === 'PENDING'
                          ? 'text-primary font-bold bg-primary/10 px-1 py-0.2 rounded'
                          : 'text-foreground-3'
                      ]"
                    >
                      {{ step.name }}
                    </span>
                  </template>
                </div>
                <span v-else class="text-foreground-3 text-[11px]">
                  {{ isDraft(record) ? '尚未送审' : '—' }}
                </span>
              </div>

              <!-- 8. 生效时间 -->
              <div class="text-center text-foreground-2 font-mono text-[11px]">
                {{ record.effectiveAt ? formatDate(record.effectiveAt) : '—' }}
              </div>

              <!-- 9. 附件 -->
              <div class="text-center">
                <span
                  v-if="record.attachments && record.attachments.length"
                  class="inline-flex items-center gap-1 text-primary cursor-pointer hover:underline text-[11px]"
                  :title="record.attachments.map((a: any) => a.name).join('\n')"
                >
                  <PaperClipIcon class="w-3.5 h-3.5" />
                  {{ record.attachments.length }}
                </span>
                <span v-else class="text-foreground-3">—</span>
              </div>

              <!-- 10. 操作 -->
              <div class="flex items-center justify-center gap-2">
                <!-- 草稿或已退回：编辑、删除 -->
                <template v-if="isDraft(record) || record.approveStatus === 'RETURNED'">
                  <button
                    class="text-primary hover:underline text-[12px] inline-flex items-center gap-0.5"
                    @click="goDetail(record.id)"
                  >
                    <PencilSquareIcon class="w-3.5 h-3.5" />
                    编辑 / 送审
                  </button>
                  <button
                    class="text-danger hover:underline text-[12px] inline-flex items-center gap-0.5"
                    @click="confirmDelete(record)"
                  >
                    <TrashIcon class="w-3.5 h-3.5" />
                    删除
                  </button>
                </template>

                <!-- 审批中：当前用户若是待办人显示去审核，否则查看 -->
                <template v-else-if="isPending(record)">
                  <button
                    v-if="canCurrentUserApprove(record)"
                    class="text-primary font-bold hover:underline text-[12px] inline-flex items-center gap-0.5"
                    @click="goDetail(record.id)"
                  >
                    去审核
                  </button>
                  <button
                    v-else
                    class="text-foreground-2 hover:underline text-[12px] inline-flex items-center gap-0.5"
                    @click="goDetail(record.id)"
                  >
                    <EyeIcon class="w-3.5 h-3.5" />
                    查看
                  </button>
                </template>

                <!-- 已生效或已驳回：查看 -->
                <template v-else>
                  <button
                    class="text-foreground-2 hover:underline text-[12px] inline-flex items-center gap-0.5"
                    @click="goDetail(record.id)"
                  >
                    <EyeIcon class="w-3.5 h-3.5" />
                    查看
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除二次确认弹窗：严格使用 CommonConfirmDialog -->
    <CommonConfirmDialog
      v-model:open="deleteConfirmOpen"
      title="确定删除清单审核单据吗？"
      confirm-text="确认删除"
      :loading="deleting"
      @confirm="executeDelete"
    >
      <div class="text-sm text-foreground-2 py-2">
        确定要删除单据「
        <span class="font-bold text-foreground">{{ targetRecord?.code }}</span>
        」吗？
        <div class="text-xs text-foreground-3 mt-1">
          提示：该操作不可撤销，删除草稿不会影响项目现有的正式清单工程量。
        </div>
      </div>
    </CommonConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PlusIcon,
  PaperClipIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon
} from '@heroicons/vue/24/outline'
import { FormButton } from '@speckle/ui-components'
import dayjs from 'dayjs'
import {
  KIND_META,
  formatApproveStatusBadge,
  type BoqReviewRecord,
  type ReviewKind
} from './boqReviewTypes'
import { useAuthCookie } from '~~/lib/auth/composables/auth'
import { useApiOrigin } from '~~/composables/env'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'

const props = defineProps<{
  projectId: string
  kind: ReviewKind
}>()

const meta = computed(() => KIND_META[props.kind])
const apiOrigin = useApiOrigin()
const authToken = useAuthCookie()
const { activeUser } = useActiveUser()
const { triggerNotification } = useGlobalToast()

const records = ref<BoqReviewRecord[]>([])
const loading = ref(false)
const searchQuery = ref('')

const deleteConfirmOpen = ref(false)
const targetRecord = ref<BoqReviewRecord | null>(null)
const deleting = ref(false)

const draftCount = computed(() => {
  return records.value.filter((r) => isDraft(r)).length
})

const isDraft = (record: BoqReviewRecord) => {
  const s = String(record.approveStatus || '').toUpperCase()
  return s === 'START' || s === 'DRAFT'
}

const isPending = (record: BoqReviewRecord) => {
  const s = String(record.approveStatus || '').toUpperCase()
  return s === 'PENDING' || s === 'IN_REVIEW'
}

const formatStatusText = (record: BoqReviewRecord) => {
  const badge = formatApproveStatusBadge(record.approveStatus, record.currentStepName)
  return badge.label
}

const badgeClass = (record: BoqReviewRecord) => {
  const badge = formatApproveStatusBadge(record.approveStatus, record.currentStepName)
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

const buildApprovalHoverTitle = (record: BoqReviewRecord) => {
  if (!record.approvalChain || !record.approvalChain.length) {
    return isDraft(record) ? '尚未提交送审' : '—'
  }
  const lines = record.approvalChain.map((step) => {
    const approvers = step.approverNames?.length
      ? ` [审批人: ${step.approverNames.join('、')}]`
      : ''
    const approved = step.approvedByNames?.length
      ? ` (已通过: ${step.approvedByNames.join('、')})`
      : ''
    return `Step ${step.stepIndex} ${step.name}: ${step.status}${approvers}${approved}`
  })
  return lines.join('\n')
}

const canCurrentUserApprove = (record: BoqReviewRecord) => {
  if (!isPending(record)) return false
  const currentUserName = activeUser.value?.name
  const currentUserId = activeUser.value?.id
  if (!currentUserName && !currentUserId) return false

  const approvers = record.currentStepApprovers || []
  return (
    approvers.includes(currentUserName!) ||
    approvers.includes(currentUserId!) ||
    activeUser.value?.role === 'server:admin'
  )
}

const formatDate = (val: string | null | undefined) => {
  if (!val) return '—'
  return dayjs(val).format('YYYY-MM-DD HH:mm')
}

const getErrorDescription = (err: unknown, fallback: string) => {
  const detail = err as { data?: { error?: string }; message?: string } | null
  return detail?.data?.error || detail?.message || fallback
}

const loadRecords = async () => {
  loading.value = true
  try {
    const query = new URLSearchParams()
    query.set('kind', props.kind)
    if (searchQuery.value.trim()) {
      query.set('search', searchQuery.value.trim())
    }

    const res = await $fetch<{
      items?: BoqReviewRecord[]
      records?: BoqReviewRecord[]
    }>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/boq/reviews?${query.toString()}`,
      {
        headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}
      }
    )
    records.value = res.items || res.records || []
  } catch (err) {
    triggerNotification({
      title: '加载失败',
      description: getErrorDescription(err, '获取审核单据列表失败'),
      type: ToastNotificationType.Danger
    })
  } finally {
    loading.value = false
  }
}

const handleCreate = () => {
  navigateTo(
    `/projects/${props.projectId}/work-valuation/boq-review/new?kind=${props.kind}`
  )
}

const goDetail = (recordId: string) => {
  navigateTo(
    `/projects/${props.projectId}/work-valuation/boq-review/${recordId}?kind=${props.kind}`
  )
}

const confirmDelete = (record: BoqReviewRecord) => {
  targetRecord.value = record
  deleteConfirmOpen.value = true
}

const executeDelete = async () => {
  if (!targetRecord.value) return
  deleting.value = true
  try {
    await $fetch(
      `${apiOrigin}/api/v1/projects/${props.projectId}/boq/reviews/${targetRecord.value.id}`,
      {
        method: 'DELETE',
        headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}
      }
    )
    triggerNotification({
      title: '删除成功',
      description: `单据「${targetRecord.value.code}」已成功删除`,
      type: ToastNotificationType.Success
    })
    deleteConfirmOpen.value = false
    targetRecord.value = null
    await loadRecords()
  } catch (err) {
    triggerNotification({
      title: '删除失败',
      description: getErrorDescription(err, '删除单据失败'),
      type: ToastNotificationType.Danger
    })
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadRecords()
})
</script>
