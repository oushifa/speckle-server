<template>
  <div
    class="h-full flex flex-col overflow-hidden bg-foundation border border-outline-3 rounded-lg shadow-sm"
  >
    <!-- 面包屑导航 -->
    <Portal to="current-page">
      <div class="flex items-center space-x-1.5 text-xs text-foreground-2">
        <NuxtLink :to="`/projects/${projectId}/work-valuation/BOQ`">验工计价</NuxtLink>
        <span>/</span>
        <NuxtLink
          :to="`/projects/${projectId}/work-valuation/BOQ?tab=${currentKind}`"
          class="hover:text-primary transition-colors"
        >
          {{ meta.tabLabel }}
        </NuxtLink>
        <span>/</span>
        <span class="text-foreground truncate max-w-[200px] font-mono">
          {{ displayCode }}
        </span>
      </div>
    </Portal>

    <!-- 顶部页头 -->
    <div
      class="px-5 py-3 border-b border-outline-3 bg-foundation flex items-center justify-between shrink-0 sticky top-0 z-20"
    >
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-xs text-foreground-2 hover:text-primary transition-colors"
          @click="handleBack"
        >
          <ArrowLeftIcon class="w-4 h-4" />
          返回列表
        </button>
        <span class="text-outline-3">|</span>
        <h1 class="text-base font-bold text-foreground flex items-center gap-2">
          <span>{{ meta.title }}</span>
          <span class="font-mono text-primary font-semibold text-sm">
            {{ displayCode }}
          </span>
        </h1>
        <!-- 审批状态徽标 -->
        <span
          class="px-2 py-0.5 rounded text-[11px] font-medium border"
          :class="statusBadge.class"
        >
          {{ statusBadge.label }}
        </span>
        <!-- 当前角色身份提示 -->
        <span
          v-if="currentStageLabel"
          class="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20"
        >
          {{ currentStageLabel }}
        </span>
      </div>

      <!-- 右侧快捷按钮 -->
      <div class="flex items-center gap-2">
        <FormButton color="outline" size="sm" @click="toggleSidebar">
          <Bars3Icon class="w-4 h-4 mr-1" />
          {{ isSidebarOpen ? '收起审批面板' : '展开审批面板' }}
        </FormButton>
      </div>
    </div>

    <!-- 主体左右分栏布局 -->
    <div class="flex-1 min-h-0 flex overflow-hidden">
      <!-- ── 左侧主内容区（单据信息 + 明细表） ── -->
      <div class="flex-1 min-w-0 flex flex-col p-4 gap-3 overflow-hidden">
        <!-- 1. 单据基本信息卡片 -->
        <div
          class="bg-foundation border border-outline-3 rounded-lg shadow-sm shrink-0 p-4 space-y-3"
        >
          <!-- 卡片头部标题与折叠开关 -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-xs font-bold text-foreground">单据基本信息</span>
              <!-- 折叠时展示的一行简要摘要 -->
              <div
                v-if="!isInfoExpanded"
                class="flex items-center gap-3 text-xs text-foreground-2 flex-wrap"
              >
                <span class="text-outline-3">|</span>
                <span>
                  {{ meta.short }}单号:
                  <span class="font-mono text-primary font-medium">
                    {{ displayCode }}
                  </span>
                </span>
                <span>
                  申请人:
                  <span class="text-foreground">{{ applicant || '-' }}</span>
                </span>
                <span>
                  申请日期:
                  <span class="font-mono text-foreground">{{ applyDate || '-' }}</span>
                </span>
                <span v-if="attachments.length > 0" class="text-foreground-3">
                  (附件 {{ attachments.length }} 个)
                </span>
              </div>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs text-foreground-2 hover:text-primary transition-colors py-1 px-2 rounded hover:bg-foundation-2"
              @click="isInfoExpanded = !isInfoExpanded"
            >
              <ChevronUpIcon v-if="isInfoExpanded" class="w-3.5 h-3.5" />
              <ChevronDownIcon v-else class="w-3.5 h-3.5" />
              <span>{{ isInfoExpanded ? '收起信息' : '展开信息' }}</span>
            </button>
          </div>

          <!-- 展开内容 -->
          <div
            v-show="isInfoExpanded"
            class="space-y-3 pt-1 border-t border-outline-3/60"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <span class="block text-[11px] text-foreground-3 mb-1">
                  {{ meta.short }}单号
                </span>
                <input
                  :value="displayCode"
                  readonly
                  class="w-full px-2.5 py-1.5 text-xs font-mono bg-foundation-2 border border-outline-3 rounded text-foreground outline-none"
                />
              </div>
              <div>
                <span class="block text-[11px] text-foreground-3 mb-1">申请人</span>
                <input
                  v-model="applicant"
                  :readonly="!isDraftEditable"
                  type="text"
                  aria-label="申请人"
                  class="w-full px-2.5 py-1.5 text-xs bg-foundation border rounded text-foreground outline-none focus:border-primary"
                  :class="
                    isDraftEditable
                      ? 'border-outline-3'
                      : 'bg-foundation-2 border-outline-3'
                  "
                  @input="markDirty"
                />
              </div>
              <div>
                <span class="block text-[11px] text-foreground-3 mb-1">申请日期</span>
                <input
                  v-model="applyDate"
                  :readonly="!isDraftEditable"
                  type="text"
                  aria-label="申请日期"
                  placeholder="YYYY-MM-DD HH:mm"
                  class="w-full px-2.5 py-1.5 text-xs font-mono bg-foundation border rounded text-foreground outline-none focus:border-primary"
                  :class="
                    isDraftEditable
                      ? 'border-outline-3'
                      : 'bg-foundation-2 border-outline-3'
                  "
                  @input="markDirty"
                />
              </div>
              <div>
                <span class="block text-[11px] text-foreground-3 mb-1">生效时间</span>
                <input
                  :value="
                    record?.effectiveAt ? formatDate(record.effectiveAt) : '尚未生效'
                  "
                  readonly
                  class="w-full px-2.5 py-1.5 text-xs font-mono bg-foundation-2 border border-outline-3 rounded text-foreground-2 outline-none"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <!-- 原因填写 -->
              <div class="lg:col-span-2">
                <span class="block text-[11px] text-foreground-3 mb-1">
                  {{ meta.reasonLabel }}
                </span>
                <textarea
                  v-model="reason"
                  :readonly="!isDraftEditable"
                  :aria-label="meta.reasonLabel"
                  rows="2"
                  :placeholder="`请填写本次${
                    isChange ? '签证变更' : '工程量复核'
                  }的具体原因及依据...`"
                  class="w-full px-2.5 py-1.5 text-xs bg-foundation border rounded text-foreground outline-none focus:border-primary resize-none"
                  :class="
                    isDraftEditable
                      ? 'border-outline-3'
                      : 'bg-foundation-2 border-outline-3'
                  "
                  @input="markDirty"
                />
              </div>

              <!-- 附件管理 -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] text-foreground-3">
                    相关附件 ({{ attachments.length }})
                  </span>
                  <label
                    v-if="isDraftEditable"
                    class="cursor-pointer text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <input
                      type="file"
                      multiple
                      class="hidden"
                      @change="handleUploadAttachment"
                    />
                    <PaperClipIcon class="w-3.5 h-3.5" />
                    上传附件
                  </label>
                </div>
                <div
                  class="border border-outline-3 rounded bg-foundation p-2 h-16 overflow-y-auto space-y-1"
                >
                  <div
                    v-if="attachments.length === 0"
                    class="text-xs text-foreground-3 text-center py-2"
                  >
                    暂无附件
                  </div>
                  <div
                    v-for="(att, aIdx) in attachments"
                    :key="aIdx"
                    class="flex items-center justify-between text-xs p-1 bg-foundation-2 rounded"
                  >
                    <span
                      class="truncate flex-1 font-mono text-[11px] text-foreground"
                      :title="att.name"
                    >
                      {{ att.name }}
                    </span>
                    <div class="flex items-center gap-1.5 shrink-0 ml-2">
                      <a
                        v-if="att.blobId || att.url"
                        :href="getBlobUrl(att)"
                        target="_blank"
                        class="text-primary hover:underline text-[11px]"
                      >
                        下载
                      </a>
                      <button
                        v-if="isDraftEditable"
                        type="button"
                        class="text-danger hover:underline text-[11px]"
                        @click="removeAttachment(aIdx)"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 清单明细表格卡片 -->
        <div
          class="flex-1 min-h-0 bg-foundation border border-outline-3 rounded-lg shadow-sm flex flex-col p-4 overflow-hidden gap-2.5"
        >
          <!-- 明细工具栏 -->
          <div class="flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <h2 class="text-sm font-bold text-foreground">清单明细列表</h2>
              <span class="text-xs text-foreground-2">共 {{ rows.length }} 项</span>
              <span
                v-if="isDirty"
                class="text-xs text-warning-darker font-medium bg-warning-lighter/30 px-1.5 py-0.5 rounded"
              >
                有未保存的修改
              </span>
            </div>

            <!-- 草稿阶段操作按钮 -->
            <div v-if="isDraftEditable" class="flex items-center gap-2">
              <FormButton
                color="outline"
                size="sm"
                :disabled="rows.length === 0"
                @click="confirmClearRows"
              >
                <TrashIcon class="w-3.5 h-3.5 mr-1" />
                清空明细
              </FormButton>
              <FormButton color="primary" size="sm" @click="pickerOpen = true">
                <PlusIcon class="w-3.5 h-3.5 mr-1" />
                + 创建 / 引入 / 导入清单项
              </FormButton>
            </div>
          </div>

          <!-- 校验失败提示栏 -->
          <div
            v-if="validationIssues.length > 0"
            class="p-2.5 rounded-lg border border-danger/30 bg-danger/10 text-xs text-danger shrink-0 space-y-1"
          >
            <div class="font-bold flex items-center gap-1">
              <span>存在 {{ validationIssues.length }} 项校验问题，请修正后提交：</span>
            </div>
            <ul class="list-disc pl-5 space-y-0.5 max-h-24 overflow-y-auto">
              <li v-for="(iss, iIdx) in validationIssues" :key="iIdx">
                {{ iss.message }}
              </li>
            </ul>
          </div>

          <!-- 明细表格组件 -->
          <BoqReviewDetailTable
            :kind="currentKind"
            :rows="rows"
            :editable-stage="activeEditableStage"
            :is-draft-editable="isDraftEditable"
            :read-only="isReadOnlyView"
            :validation-issues="validationIssues"
            @change="handleRowChange"
            @delete="handleRowDelete"
          />

          <!-- 底部汇总金额栏 -->
          <div
            class="p-3 bg-foundation-2 rounded-lg border border-outline-3 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs text-foreground"
          >
            <div class="flex items-center gap-4">
              <span>
                明细总数：
                <b class="text-foreground">{{ rows.length }}</b>
                项
              </span>
              <span v-if="isChange">
                本次签证金额合计：
                <b
                  :class="
                    summaryTotals.changeAmount < 0 ? 'text-danger' : 'text-success'
                  "
                >
                  ¥ {{ summaryTotals.changeAmount > 0 ? '+' : ''
                  }}{{ formatMoney(summaryTotals.changeAmount) }}
                </b>
              </span>
              <span>
                复核总价合计：
                <b class="text-primary text-sm font-bold">
                  ¥ {{ formatMoney(summaryTotals.reviewTotal) }}
                </b>
              </span>
            </div>

            <!-- 底部保存/送审提示 -->
            <div class="text-foreground-3 text-[11px]">
              <span v-if="record?.status === 'APPROVED'">
                已完成终审，数据已写回正式工程清单
              </span>
              <span v-else-if="activeEditableStage === 'supervisor'">
                财务监理审核阶段：请核定复核/签证量并点击右侧通过
              </span>
              <span v-else-if="activeEditableStage === 'contract'">
                合约部终审阶段：确认审定后将自动生效并写回清单
              </span>
              <span v-else>草稿填报阶段：请核对清单后在右侧送审</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 右侧项目标准审批流程面板 ── -->
      <div
        v-if="isSidebarOpen"
        class="w-[360px] shrink-0 border-l border-outline-3 bg-foundation flex flex-col min-h-0 shadow-lg transition-all"
      >
        <!-- 审批面板标题栏 -->
        <div
          class="p-4 border-b border-outline-3 flex items-center justify-between shrink-0 bg-foundation-2"
        >
          <div class="flex items-center gap-2">
            <QueueListIcon class="w-4 h-4 text-primary" />
            <h3 class="text-sm font-bold text-foreground">审批流程与待办</h3>
          </div>
          <button
            type="button"
            class="text-foreground-2 hover:text-foreground p-1 rounded"
            title="收起面板"
            @click="isSidebarOpen = false"
          >
            <ChevronRightIcon class="w-4 h-4" />
          </button>
        </div>

        <!-- 审批面板可滚动区域 -->
        <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
          <!-- 流程状态卡片 -->
          <div class="p-3 bg-foundation-2 border border-outline-3 rounded-lg space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-foreground-3">当前流程状态</span>
              <span
                class="px-2 py-0.5 rounded text-[11px] font-medium border"
                :class="statusBadge.class"
              >
                {{ statusBadge.label }}
              </span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-foreground-3">流程定义</span>
              <span class="text-foreground font-medium">清单审核（模版1）</span>
            </div>
            <div
              v-if="record?.currentStepName"
              class="flex items-center justify-between text-xs"
            >
              <span class="text-foreground-3">当前待办节点</span>
              <span class="text-primary font-bold">{{ record.currentStepName }}</span>
            </div>
            <div
              v-if="record?.currentStepApprovers?.length"
              class="flex items-center justify-between text-xs"
            >
              <span class="text-foreground-3">待审批人</span>
              <span
                class="text-foreground font-mono truncate max-w-[180px]"
                :title="record.currentStepApprovers.join('、')"
              >
                {{ record.currentStepApprovers.join('、') }}
              </span>
            </div>
          </div>

          <!-- 审批动作操作区 -->
          <div
            class="p-3.5 border border-outline-3 rounded-lg bg-foundation space-y-3 shadow-sm"
          >
            <h4
              class="text-xs font-bold text-foreground flex items-center justify-between"
            >
              <span>业务操作</span>
              <span v-if="canAct" class="text-[11px] text-success font-normal">
                ● 您拥有当前操作权限
              </span>
              <span v-else class="text-[11px] text-foreground-3 font-normal">
                只读查看
              </span>
            </h4>

            <!-- 1. 草稿 / 退回阶段：保存草稿 与 提交审核 -->
            <div v-if="isDraftEditable" class="space-y-2.5">
              <FormButton
                color="outline"
                size="sm"
                class="w-full justify-center"
                :loading="savingDraft"
                @click="handleSaveDraft"
              >
                保存草稿
              </FormButton>

              <FormButton
                color="primary"
                size="sm"
                class="w-full justify-center"
                :loading="submittingFlow"
                @click="openSubmitConfirm"
              >
                提交审核 (进入流程)
              </FormButton>
            </div>

            <!-- 2. 审批中阶段且当前用户具备审批权限：审批通过 与 退回 -->
            <div v-else-if="canCurrentUserApprove" class="space-y-3">
              <div>
                <label
                  class="block text-xs font-medium text-foreground mb-1"
                  for="approval-comment-input"
                >
                  审批意见 / 批注
                </label>
                <textarea
                  id="approval-comment-input"
                  v-model="approvalComment"
                  rows="3"
                  placeholder="请输入您的审核意见..."
                  class="w-full px-2.5 py-1.5 text-xs bg-foundation border border-outline-3 rounded focus:outline-none focus:border-primary text-foreground resize-none"
                />
              </div>

              <div class="flex flex-col gap-2">
                <FormButton
                  color="primary"
                  size="sm"
                  class="w-full justify-center"
                  :loading="approvingFlow"
                  @click="openApproveConfirm"
                >
                  {{
                    isFinalStep
                      ? '最终审定并通过（正式生效）'
                      : '审核通过，流转下一节点'
                  }}
                </FormButton>

                <div class="grid grid-cols-2 gap-2">
                  <FormButton
                    color="outline"
                    size="sm"
                    class="justify-center text-warning-darker border-warning/50 hover:bg-warning-lighter/20"
                    :disabled="approvingFlow || returningFlow"
                    @click="openReturnDialog(0)"
                  >
                    退回发起人
                  </FormButton>
                  <FormButton
                    color="outline"
                    size="sm"
                    class="justify-center text-danger border-danger/50 hover:bg-danger/10"
                    :disabled="approvingFlow || returningFlow"
                    @click="openReturnDialog(-1)"
                  >
                    驳回流程
                  </FormButton>
                </div>
              </div>
            </div>

            <!-- 3. 已通过 / 无权限 / 纯查看模式 -->
            <div v-else class="text-xs text-foreground-3 text-center py-2">
              <span v-if="record?.approveStatus === 'APPROVED'">
                单据已通过审核并生效
              </span>
              <span v-else>当前节点由其他指定人员审批</span>
            </div>
          </div>

          <!-- 审批步骤节点进度列表（steps） -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold text-foreground">流程节点进度</h4>
            <div
              class="space-y-2 border border-outline-3 rounded-lg p-2.5 bg-foundation-2/40"
            >
              <div
                v-for="(step, sIdx) in flowSteps"
                :key="step.id || sIdx"
                class="p-2 rounded border text-xs space-y-1 transition-all"
                :class="[
                  step.status === 'APPROVED'
                    ? 'border-success/30 bg-success-lighter/10'
                    : step.status === 'PENDING'
                    ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/30'
                    : 'border-outline-3/60 bg-foundation text-foreground-3'
                ]"
              >
                <div class="flex items-center justify-between font-medium">
                  <span class="flex items-center gap-1.5">
                    <span class="font-mono text-[11px] text-foreground-3">
                      #{{ step.stepIndex }}
                    </span>
                    <span class="font-bold text-foreground">{{ step.name }}</span>
                  </span>
                  <span
                    class="text-[10px] px-1.5 py-0.2 rounded font-medium"
                    :class="[
                      step.status === 'APPROVED'
                        ? 'bg-success text-white'
                        : step.status === 'PENDING'
                        ? 'bg-primary text-white'
                        : 'bg-foundation-3 text-foreground-3'
                    ]"
                  >
                    {{
                      step.status === 'APPROVED'
                        ? '已通过'
                        : step.status === 'PENDING'
                        ? '待审核'
                        : '未到达'
                    }}
                  </span>
                </div>
                <div
                  class="text-[11px] text-foreground-2 flex items-center justify-between"
                >
                  <span>审批人：{{ step.approverNames?.join('、') || '—' }}</span>
                  <span v-if="step.completedAt" class="font-mono text-foreground-3">
                    {{ formatDate(step.completedAt) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 审批流转日志时间线（actions） -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold text-foreground">审批流转日志</h4>
            <div
              class="space-y-2 border border-outline-3 rounded-lg p-2.5 bg-foundation-2/40 max-h-56 overflow-y-auto"
            >
              <div
                v-if="!flowActions.length"
                class="text-xs text-foreground-3 text-center py-2"
              >
                暂无审批流转记录
              </div>
              <div
                v-for="act in flowActions"
                :key="act.id"
                class="text-xs border-l-2 border-primary/40 pl-2.5 py-1 space-y-0.5"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-foreground">{{ act.actorName }}</span>
                  <span class="text-[10px] text-foreground-3 font-mono">
                    {{ formatDate(act.createdAt) }}
                  </span>
                </div>
                <div class="text-primary font-medium text-[11px]">{{ act.action }}</div>
                <div
                  v-if="act.comment"
                  class="text-foreground-2 text-[11px] bg-foundation p-1.5 rounded border border-outline-3/60"
                >
                  “{{ act.comment }}”
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗：清单项选择器 -->
    <BoqReviewItemPicker
      v-model:open="pickerOpen"
      :project-id="projectId"
      :kind="currentKind"
      :existing-rows="rows"
      :all-boq-items="allBoqTreeItems"
      @append="handleAppendRows"
    />

    <!-- 弹窗：二次确认弹窗（严格遵循用户规则 7，使用 CommonConfirmDialog） -->
    <CommonConfirmDialog
      v-model:open="confirmDialogOpen"
      :title="confirmDialogTitle"
      confirm-text="确认执行"
      :loading="confirmDialogLoading"
      @confirm="handleConfirmAction"
    >
      <div class="text-sm text-foreground-2 py-2">
        {{ confirmDialogText }}
      </div>
    </CommonConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Portal } from 'portal-vue'
import {
  ArrowLeftIcon,
  Bars3Icon,
  PaperClipIcon,
  TrashIcon,
  PlusIcon,
  QueueListIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/vue/24/outline'
import { FormButton } from '@speckle/ui-components'
import dayjs from 'dayjs'
import { useQuery } from '@vue/apollo-composable'
import { projectBoqItemsQuery } from '~/lib/projects/graphql/queries'
import {
  KIND_META,
  formatApproveStatusBadge,
  formatMoney,
  sumReviewRows,
  validateReviewRows,
  type BoqReviewActionItem,
  type BoqReviewAttachment,
  type BoqReviewRecord,
  type BoqReviewRow,
  type BoqReviewStepChainItem,
  type BoqTreeItem,
  type ReviewKind,
  type ReviewStage,
  type ReviewValidationIssue
} from './boqReviewTypes'
import BoqReviewDetailTable from './BoqReviewDetailTable.vue'
import BoqReviewItemPicker from './BoqReviewItemPicker.vue'
import { useAuthCookie } from '~~/lib/auth/composables/auth'
import { useApiOrigin } from '~~/composables/env'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'

const props = withDefaults(
  defineProps<{
    projectId: string
    recordId: string
    kind?: ReviewKind
  }>(),
  {
    kind: 'review'
  }
)

const isNew = computed(() => props.recordId === 'new')
const apiOrigin = useApiOrigin()
const authToken = useAuthCookie()
const { activeUser } = useActiveUser()
const { triggerNotification } = useGlobalToast()

const record = ref<BoqReviewRecord | null>(null)
const currentKind = computed<ReviewKind>(() => {
  return record.value?.kind || props.kind || 'review'
})
const isChange = computed(() => currentKind.value === 'change')
const meta = computed(() => KIND_META[currentKind.value])

// 表单与明细编辑态
const reason = ref('')
const applicant = ref('')
const applyDate = ref('')
const attachments = ref<BoqReviewAttachment[]>([])
const rows = ref<BoqReviewRow[]>([])
const isDirty = ref(false)

const markDirty = () => {
  isDirty.value = true
}

// 单据基本信息折叠状态
const isInfoExpanded = ref(true)

// 侧边栏与弹窗状态
const isSidebarOpen = ref(true)
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}
const pickerOpen = ref(false)
const validationIssues = ref<ReviewValidationIssue[]>([])

// 异步提交状态
const savingDraft = ref(false)
const submittingFlow = ref(false)
const approvingFlow = ref(false)
const returningFlow = ref(false)
const approvalComment = ref('')

// 统一二次确认弹窗
const confirmDialogOpen = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogText = ref('')
const confirmDialogLoading = ref(false)
const confirmDialogAction = ref<(() => Promise<void>) | null>(null)

const triggerConfirm = (title: string, text: string, action: () => Promise<void>) => {
  confirmDialogTitle.value = title
  confirmDialogText.value = text
  confirmDialogAction.value = action
  confirmDialogOpen.value = true
}

const handleConfirmAction = async () => {
  if (confirmDialogAction.value) {
    confirmDialogLoading.value = true
    try {
      await confirmDialogAction.value()
    } finally {
      confirmDialogLoading.value = false
    }
  }
}

// 查询项目正式清单树，供 Picker 和校验使用
const { result: boqResult } = useQuery(
  projectBoqItemsQuery,
  () => ({
    projectId: props.projectId,
    search: null
  }),
  {
    enabled: computed(() => !!props.projectId)
  }
)

const allBoqTreeItems = computed<BoqTreeItem[]>(() => {
  return (boqResult.value?.project?.boqItems || []).filter(Boolean) as BoqTreeItem[]
})

const existingFormalCodes = computed(() => {
  const set = new Set<string>()
  function walk(nodes: BoqTreeItem[]) {
    for (const n of nodes) {
      if (n.code) set.add(n.code.trim())
      if (n.children?.length) walk(n.children)
    }
  }
  walk(allBoqTreeItems.value)
  return set
})

// ── 流程与权限判定 ──
const displayCode = computed(() => {
  if (isNew.value) return `${meta.value.prefix}-新单据`
  return record.value?.code || '—'
})

const isDraftEditable = computed(() => {
  if (isNew.value) return true
  const s = String(record.value?.approveStatus || 'START').toUpperCase()
  return s === 'START' || s === 'DRAFT' || s === 'RETURNED'
})

const isReadOnlyView = computed(() => {
  if (isDraftEditable.value) return false
  return !canCurrentUserApprove.value
})

const statusBadge = computed(() => {
  if (isNew.value) {
    return {
      label: '新建草稿',
      class: 'bg-warning-lighter/20 text-warning-darker border-warning/30'
    }
  }
  const badge = formatApproveStatusBadge(
    record.value?.approveStatus,
    record.value?.currentStepName
  )
  let cls = 'bg-foundation-2 text-foreground-2 border-outline-3'
  if (badge.tone === 'warning')
    cls = 'bg-warning-lighter/20 text-warning-darker border-warning/30'
  if (badge.tone === 'primary')
    cls = 'bg-primary-muted/20 text-primary border-primary/30'
  if (badge.tone === 'success')
    cls = 'bg-success-lighter/20 text-success-darker border-success/30'
  if (badge.tone === 'danger')
    cls = 'bg-danger-lighter/20 text-danger-darker border-danger/30'
  return { label: badge.label, class: cls }
})

const currentStageLabel = computed(() => {
  if (isNew.value || isDraftEditable.value) return '填报角色：施工单位'
  const stepName = record.value?.currentStepName || ''
  if (/监理|财务|投资/.test(stepName)) return '当前核定：财务监理'
  if (/合约|合同|造价/.test(stepName)) return '当前审定：合约部'
  return ''
})

const activeEditableStage = computed<ReviewStage | null>(() => {
  if (isDraftEditable.value) return 'contractor'
  const stepName = record.value?.currentStepName || ''
  if (/监理|财务|投资/.test(stepName)) return 'supervisor'
  if (/合约|合同|造价/.test(stepName)) return 'contract'
  return null
})

const canCurrentUserApprove = computed(() => {
  if (isNew.value || isDraftEditable.value) return false
  const s = String(record.value?.approveStatus || '').toUpperCase()
  if (s !== 'PENDING' && s !== 'IN_REVIEW') return false

  const currentUserName = activeUser.value?.name
  const currentUserId = activeUser.value?.id
  const approvers = record.value?.currentStepApprovers || []

  return (
    (currentUserName && approvers.includes(currentUserName)) ||
    (currentUserId && approvers.includes(currentUserId)) ||
    activeUser.value?.role === 'server:admin'
  )
})

const canAct = computed(() => {
  return isDraftEditable.value || canCurrentUserApprove.value
})

const flowSteps = computed<BoqReviewStepChainItem[]>(() => {
  return record.value?.steps || record.value?.approvalChain || []
})

const flowActions = computed<BoqReviewActionItem[]>(() => {
  return record.value?.actions || []
})

const isFinalStep = computed(() => {
  const steps = flowSteps.value
  if (!steps.length) return false
  const pendingStep = steps.find((s) => s.status === 'PENDING')
  if (!pendingStep) return false
  const maxIndex = Math.max(...steps.map((s) => s.stepIndex))
  return pendingStep.stepIndex === maxIndex
})

const summaryTotals = computed(() => {
  return sumReviewRows(rows.value, currentKind.value)
})

const formatDate = (val: string | null | undefined) => {
  if (!val) return '—'
  return dayjs(val).format('YYYY-MM-DD HH:mm')
}

const getErrorDescription = (err: unknown, fallback: string) => {
  const detail = err as { data?: { error?: string }; message?: string } | null
  return detail?.data?.error || (err instanceof Error ? err.message : '') || fallback
}

// ── 数据获取 ──
const loadDetail = async () => {
  if (isNew.value) {
    applicant.value = activeUser.value?.name || '施工单位'
    applyDate.value = dayjs().format('YYYY-MM-DD HH:mm')
    reason.value = ''
    attachments.value = []
    rows.value = []
    isDirty.value = false
    return
  }

  try {
    const res = await $fetch<{ record?: BoqReviewRecord } & BoqReviewRecord>(
      `${apiOrigin}/api/v1/projects/${props.projectId}/boq/reviews/${props.recordId}`,
      {
        headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}
      }
    )
    const data = res.record || res
    record.value = data
    reason.value = data.reason || ''
    applicant.value = data.applicant || ''
    applyDate.value = data.applyDate || ''
    attachments.value = data.attachments || []
    rows.value = data.rows || []
    isDirty.value = false
  } catch (err) {
    triggerNotification({
      title: '加载失败',
      description: getErrorDescription(err, '无法获取单据详情'),
      type: ToastNotificationType.Danger
    })
  }
}

// ── 明细行更新与删除 ──
const handleRowChange = (
  rowId: string,
  field: keyof BoqReviewRow,
  value: string | number
) => {
  const idx = rows.value.findIndex((r) => r.id === rowId)
  if (idx >= 0) {
    rows.value[idx] = {
      ...rows.value[idx],
      [field]: value
    }
    isDirty.value = true
  }
}

const handleRowDelete = (rowId: string) => {
  rows.value = rows.value.filter((r) => r.id !== rowId)
  isDirty.value = true
}

const handleAppendRows = (added: BoqReviewRow[]) => {
  rows.value = [...rows.value, ...added]
  isDirty.value = true
  validationIssues.value = []
}

const confirmClearRows = () => {
  triggerConfirm('清空明细', '确定要清空本单所有的清单明细吗？', async () => {
    rows.value = []
    isDirty.value = true
    confirmDialogOpen.value = false
  })
}

// ── 附件处理 ──
const handleUploadAttachment = async (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return

  try {
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      const res = await $fetch<{
        uploadResults?: Array<{ formKey?: string; blobId?: string }>
      }>(`${apiOrigin}/api/stream/${props.projectId}/blob`, {
        method: 'POST',
        headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {},
        body: formData
      })
      const uploadResults = res?.uploadResults || []
      const result = uploadResults.find((r) => r.formKey === 'file')
      const blobId = result?.blobId
      if (blobId) {
        attachments.value.push({
          id: `att-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          blobId,
          name: file.name,
          size: file.size,
          uploadedAt: dayjs().toISOString(),
          uploadedBy: activeUser.value?.name
        })
        isDirty.value = true
      }
    }
    triggerNotification({
      title: '上传成功',
      description: '附件已添加，请保存草稿',
      type: ToastNotificationType.Success
    })
  } catch (err) {
    triggerNotification({
      title: '上传失败',
      description: getErrorDescription(err, '附件上传出错'),
      type: ToastNotificationType.Danger
    })
  } finally {
    ;(event.target as HTMLInputElement).value = ''
  }
}

const removeAttachment = (index: number) => {
  attachments.value.splice(index, 1)
  isDirty.value = true
}

const getBlobUrl = (att: BoqReviewAttachment) => {
  if (att.url) return att.url
  if (att.blobId) return `${apiOrigin}/api/stream/${props.projectId}/blob/${att.blobId}`
  return '#'
}

// ── 保存草稿 ──
const handleSaveDraft = async () => {
  savingDraft.value = true
  try {
    if (isNew.value) {
      const res = await $fetch<BoqReviewRecord & { record?: BoqReviewRecord }>(
        `${apiOrigin}/api/v1/projects/${props.projectId}/boq/reviews`,
        {
          method: 'POST',
          headers: authToken.value
            ? { Authorization: `Bearer ${authToken.value}` }
            : {},
          body: {
            kind: currentKind.value,
            reason: reason.value.trim(),
            applicant: applicant.value.trim(),
            applyDate: applyDate.value.trim(),
            attachments: attachments.value,
            rows: rows.value
          }
        }
      )
      const created = res.record || res
      triggerNotification({
        title: '保存草稿成功',
        description: `新单据「${created.code}」草稿已保存`,
        type: ToastNotificationType.Success
      })
      isDirty.value = false
      await navigateTo(
        `/projects/${props.projectId}/work-valuation/boq-review/${created.id}?kind=${currentKind.value}`
      )
      return
    }

    // 更新已有草稿
    await $fetch(
      `${apiOrigin}/api/v1/projects/${props.projectId}/boq/reviews/${props.recordId}`,
      {
        method: 'PUT',
        headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {},
        body: {
          reason: reason.value.trim(),
          applicant: applicant.value.trim(),
          applyDate: applyDate.value.trim(),
          attachments: attachments.value,
          rows: rows.value
        }
      }
    )

    triggerNotification({
      title: '保存草稿成功',
      description: '草稿与明细数据已成功保存',
      type: ToastNotificationType.Success
    })
    isDirty.value = false
    await loadDetail()
  } catch (err) {
    triggerNotification({
      title: '保存失败',
      description: getErrorDescription(err, '保存草稿失败'),
      type: ToastNotificationType.Danger
    })
  } finally {
    savingDraft.value = false
  }
}

// ── 提交送审 ──
const openSubmitConfirm = () => {
  const issues = validateReviewRows(
    rows.value,
    existingFormalCodes.value,
    currentKind.value
  )
  if (issues.length > 0) {
    validationIssues.value = issues
    triggerNotification({
      title: '校验未通过',
      description: `明细存在 ${issues.length} 项问题，请查看下方红框提示修改后送审`,
      type: ToastNotificationType.Danger
    })
    return
  }
  validationIssues.value = []

  const msg = isChange.value
    ? `确认提交本次签证变更单吗？共 ${
        rows.value.length
      } 条明细，金额合计 ¥${formatMoney(
        summaryTotals.value.changeAmount
      )}。提交后将进入财务监理与合约部审核流程。`
    : `确认提交本次复核单吗？共 ${
        rows.value.length
      } 条明细，复核总价合计 ¥${formatMoney(
        summaryTotals.value.reviewTotal
      )}。提交后将进入财务监理与合约部审核流程。`

  triggerConfirm('确认提交审核', msg, executeSubmit)
}

const executeSubmit = async () => {
  submittingFlow.value = true
  try {
    let targetId = props.recordId
    if (isNew.value) {
      // 先创建
      const createdRes = await $fetch<BoqReviewRecord & { record?: BoqReviewRecord }>(
        `${apiOrigin}/api/v1/projects/${props.projectId}/boq/reviews`,
        {
          method: 'POST',
          headers: authToken.value
            ? { Authorization: `Bearer ${authToken.value}` }
            : {},
          body: {
            kind: currentKind.value,
            reason: reason.value.trim(),
            applicant: applicant.value.trim(),
            applyDate: applyDate.value.trim(),
            attachments: attachments.value,
            rows: rows.value
          }
        }
      )
      const created = createdRes.record || createdRes
      targetId = created.id
    }

    // 提交送审
    await $fetch(
      `${apiOrigin}/api/v1/projects/${props.projectId}/boq/reviews/${targetId}/submit`,
      {
        method: 'POST',
        headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {},
        body: {
          reason: reason.value.trim(),
          applicant: applicant.value.trim(),
          applyDate: applyDate.value.trim(),
          attachments: attachments.value,
          rows: rows.value,
          comment: '施工单位提交送审'
        }
      }
    )

    confirmDialogOpen.value = false
    triggerNotification({
      title: '送审成功',
      description: '单据已提交，等待财务监理审核',
      type: ToastNotificationType.Success
    })

    if (isNew.value) {
      await navigateTo(
        `/projects/${props.projectId}/work-valuation/boq-review/${targetId}?kind=${currentKind.value}`
      )
    } else {
      await loadDetail()
    }
  } catch (err) {
    triggerNotification({
      title: '送审失败',
      description: getErrorDescription(err, '提交审批流失败'),
      type: ToastNotificationType.Danger
    })
  } finally {
    submittingFlow.value = false
  }
}

// ── 审批通过 ──
const openApproveConfirm = () => {
  const issues = validateReviewRows(
    rows.value,
    existingFormalCodes.value,
    currentKind.value
  )
  if (issues.length > 0) {
    validationIssues.value = issues
    triggerNotification({
      title: '校验未通过',
      description: `审核数据存在 ${issues.length} 项问题，请核对后再通过`,
      type: ToastNotificationType.Danger
    })
    return
  }

  const prompt = isFinalStep.value
    ? '您当前处于合约部终审环节，审批通过后将正式生效，并自动将核定工程量与单价写回正式清单。确认通过吗？'
    : '确认通过当前的审核步骤并流转到下一阶段吗？'

  triggerConfirm('确认通过审批', prompt, executeApprove)
}

const executeApprove = async () => {
  approvingFlow.value = true
  try {
    await $fetch(
      `${apiOrigin}/api/v1/projects/${props.projectId}/boq/reviews/${props.recordId}/approve`,
      {
        method: 'POST',
        headers: authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {},
        body: {
          comment: approvalComment.value.trim() || '审核通过',
          rows: rows.value
        }
      }
    )
    confirmDialogOpen.value = false
    approvalComment.value = ''
    triggerNotification({
      title: '审批通过成功',
      description: isFinalStep.value
        ? '单据已正式生效，清单已更新！'
        : '当前节点已核准，流转至下一节点',
      type: ToastNotificationType.Success
    })
    await loadDetail()
  } catch (err) {
    triggerNotification({
      title: '审批失败',
      description: getErrorDescription(err, '审核处理出错'),
      type: ToastNotificationType.Danger
    })
  } finally {
    approvingFlow.value = false
  }
}

// ── 退回 / 驳回 ──
const openReturnDialog = (targetStep: number) => {
  if (!approvalComment.value.trim()) {
    triggerNotification({
      title: '缺少意见',
      description: '退回或驳回时，必须在上方填写原因/意见',
      type: ToastNotificationType.Warning
    })
    return
  }

  const isReject = targetStep === -1
  const title = isReject ? '确认驳回流程' : '确认退回发起人'
  const text = isReject
    ? `确定驳回该单据吗？审批流将被终止。驳回意见：“${approvalComment.value.trim()}”`
    : `确定退回给施工单位重新修改吗？退回意见：“${approvalComment.value.trim()}”`

  triggerConfirm(title, text, async () => {
    returningFlow.value = true
    try {
      await $fetch(
        `${apiOrigin}/api/v1/projects/${props.projectId}/boq/reviews/${props.recordId}/return`,
        {
          method: 'POST',
          headers: authToken.value
            ? { Authorization: `Bearer ${authToken.value}` }
            : {},
          body: {
            mode: isReject ? 'reject' : 'return',
            targetStep: targetStep > 0 ? targetStep : 0,
            comment: approvalComment.value.trim(),
            rows: rows.value
          }
        }
      )
      confirmDialogOpen.value = false
      approvalComment.value = ''
      triggerNotification({
        title: isReject ? '流程已驳回' : '已退回修改',
        description: isReject ? '单据流程已终止' : '已退回施工单位重新修改',
        type: ToastNotificationType.Success
      })
      await loadDetail()
    } catch (err) {
      triggerNotification({
        title: '操作失败',
        description: getErrorDescription(err, '退回出错'),
        type: ToastNotificationType.Danger
      })
    } finally {
      returningFlow.value = false
    }
  })
}

const handleBack = () => {
  navigateTo(`/projects/${props.projectId}/work-valuation/BOQ?tab=${currentKind.value}`)
}

onMounted(() => {
  loadDetail()
})
</script>
