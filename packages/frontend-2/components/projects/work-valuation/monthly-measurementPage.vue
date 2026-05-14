<template>
  <div>
    <div class="flex flex-col h-full space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-heading-lg text-foreground mt-3">月度验工</h1>
        <div class="flex items-center space-x-2 text-sm">
          <FormTextInput
            v-model="searchQuery"
            name="monthly-measurement-search"
            placeholder="搜索验工编码/施工单位"
            show-clear
            class="w-72 text-sm"
          >
            <template #input-right>
              <div
                class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"
              >
                <MagnifyingGlassIcon class="h-5 w-5 text-foreground-2" />
              </div>
            </template>
          </FormTextInput>
          <FormButton :icon-left="PlusIcon" color="primary" @click="openCreateDialog">
            新增
          </FormButton>
        </div>
      </div>

      <div
        class="flex-grow overflow-hidden bg-foundation rounded-lg border border-outline-3 flex flex-col"
      >
        <LayoutTable
          :columns="columns"
          :items="tableItems"
          class="h-full"
          empty-message="暂无月度验工"
        >
          <template #code="{ item }">
            <button
              class="text-sm font-medium text-primary hover:underline"
              @click="viewItem(item)"
            >
              {{ item.code }}
            </button>
          </template>
          <template #unit="{ item }">
            <span class="text-sm text-foreground">{{ item.unit || '-' }}</span>
          </template>
          <template #baseDate="{ item }">
            <span class="text-sm text-foreground">{{ formatDate(Number(item.baseDate)) }}</span>
          </template>
          <template #status="{ item }">
            <button
              v-if="item.flowInstanceId"
              class="cursor-pointer text-sm"
              title="查看流程详情"
              @click="openFlowDetail(item)"
            >
              <CommonBadge
                :color-classes="getStatusColor(item.approveStatus)"
                class="text-sm font-medium"
                rounded
              >
                {{ getStatusText(item.approveStatus) }}
              </CommonBadge>
            </button>
            <CommonBadge
              v-else
              :color-classes="getStatusColor(item.approveStatus)"
              class="text-sm font-medium"
              rounded
            >
              {{ getStatusText(item.approveStatus) }}
            </CommonBadge>
          </template>
          <template #creator="{ item }">
            <span class="text-sm text-foreground">{{ item.creator?.name || '-' }}</span>
          </template>
          <template #actions="{ item }">
            <div class="flex items-center justify-end gap-1.5 text-sm">
              <button
                class="rounded p-1 text-primary transition-colors hover:text-primary-focus"
                title="查看详情"
                @click="viewItem(item)"
              >
                <EyeIcon class="h-4 w-4" />
              </button>
              <button
                class="rounded p-1 text-success transition-colors hover:text-success-darker disabled:cursor-not-allowed disabled:opacity-40"
                title="送审"
                :disabled="isSubmitted(item)"
                @click="openSubmitDialog(item)"
              >
                <PaperAirplaneIcon class="h-4 w-4" />
              </button>
              <button
                class="rounded p-1 text-warning transition-colors hover:text-warning-darker disabled:cursor-not-allowed disabled:opacity-40"
                title="编辑"
                :disabled="isSubmitted(item)"
                @click="editItem(item)"
              >
                <PencilSquareIcon class="h-4 w-4" />
              </button>
              <button
                class="rounded p-1 text-danger transition-colors hover:text-danger-darker disabled:cursor-not-allowed disabled:opacity-40"
                title="删除"
                :disabled="isSubmitted(item)"
                @click="deleteItem(item)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </template>
        </LayoutTable>

        <div
          class="flex items-center justify-between border-t border-outline-3 bg-foundation p-4 text-[13px] leading-5"
        >
          <div class="text-[13px] leading-5 text-foreground-2">
            每页显示
            <label for="monthly-measurement-page-size" class="sr-only">
              每页显示条数
            </label>
            <select
              id="monthly-measurement-page-size"
              v-model="pageSize"
              class="mx-1 rounded border border-outline-3 bg-foundation px-2 py-1 text-[13px] leading-5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
            条 &nbsp; 共 {{ totalItems }} 条，第 {{ startItem }}-{{ endItem }} 条
          </div>
          <div class="flex items-center space-x-2">
            <button
              class="rounded border border-outline-3 px-2 py-1 text-[13px] leading-5 text-foreground-2 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage === 1"
              @click="goPrevPage"
            >
              &lt; 上一页
            </button>
            <span class="px-2 text-[13px] leading-5 text-foreground-2">
              第 {{ currentPage }} / {{ totalPages || 1 }} 页
            </span>
            <button
              class="rounded border border-outline-3 px-2 py-1 text-[13px] leading-5 text-foreground-2 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!nextCursor"
              @click="goNextPage"
            >
              下一页 &gt;
            </button>
          </div>
        </div>
      </div>
    </div>

    <LayoutDialog
      v-model:open="createDialogOpen"
      max-width="xl"
      prevent-close-on-click-outside
      :buttons="createDialogButtons"
    >
      <template #header>{{ dialogTitle }}</template>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormTextInput
            v-model="createForm.unit"
            name="monthly-measurement-unit"
            label="施工单位"
            show-label
            show-required
            placeholder="请输入施工单位"
            :disabled="isViewMode"
          />
          <FormTextInput
            v-model="createForm.code"
            name="monthly-measurement-code"
            label="验工编号"
            show-label
            show-required
            placeholder="请输入验工编号"
            :disabled="isViewMode"
          />
          <FormTextInput
            v-model="createForm.baseDate"
            name="monthly-measurement-base-date"
            label="基准时间"
            type="date"
            show-label
            show-required
            :disabled="isViewMode"
          />
        </div>

        <div class="flex items-center gap-2">
          <FormButton
            :color="previewViewTag === 'list' ? 'primary' : 'outline'"
            :loading="previewLoading"
            @click="switchPreviewView('list')"
          >
            {{ isViewMode || dialogMode === 'edit' ? '验工列表' : '生成验工列表' }}
          </FormButton>
          <FormButton
            :color="previewViewTag === 'model' ? 'primary' : 'outline'"
            :loading="previewLoading"
            @click="switchPreviewView('model')"
          >
            验工模型
          </FormButton>
        </div>
        <div
          v-if="previewBaseDate && previewViewTag === 'list'"
          class="text-body-sm text-foreground-2"
        >
          基准时间 {{ formatDate(previewBaseDate) }} 前的清单项聚合结果
        </div>

        <div v-if="createError" class="text-body-sm text-danger">
          {{ createError }}
        </div>

        <div
          v-if="previewViewTag === 'list' && previewItems.length"
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
                <th class="text-right px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="row in previewItems"
                :key="row.boqItemId"
              >
                <tr class="border-t border-outline-3">
                  <td class="px-3 py-2">{{ row.boqCode }}</td>
                  <td class="px-3 py-2">
                    <div
                      :style="{ paddingLeft: `${Math.max(0, row.boqDepth - 1) * 16}px` }"
                      class="flex items-center"
                    >
                      <button
                        v-if="!row.isSummaryRow && row.sourceAcceptances?.length"
                        class="p-0.5 rounded hover:bg-highlight-1 focus:outline-none focus:ring-2 focus:ring-primary mr-1"
                        @click="toggleExpand(row.boqItemId)"
                      >
                        <ChevronRightIcon
                          class="h-4 w-4 transition-transform text-foreground-2"
                          :class="expandedBoqRowIds.has(row.boqItemId) ? 'rotate-90' : ''"
                        />
                      </button>
                      <span
                        :class="row.isSummaryRow ? 'font-medium text-foreground' : ''"
                      >
                        {{ row.boqName }}
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span
                      v-if="isBoqQuantityMissing(row)"
                      class="text-danger font-semibold"
                    >
                      未维护清单工程量
                    </span>
                    <template v-else-if="!row.isSummaryRow">
                      {{ formatQty(row.pendingTotalQty) }}
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
                      {{ formatQty(row.approvedCumulativeQty) }}
                      <span v-if="isCumulativeExceeded(row)">（超出工程总量）</span>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <template v-if="!row.isSummaryRow">
                      {{ formatPrice(row.price, row.isSummaryRow) }}
                    </template>
                  </td>
                  <td class="px-3 py-2">
                    <FormTextInput
                      v-if="!row.isSummaryRow && !isViewMode"
                      v-model="measuredQtyByBoq[row.boqItemId]"
                      :name="`measured-${row.boqItemId}`"
                      type="number"
                      step="any"
                      :disabled="row.isSummaryRow"
                      class="max-w-[140px] ml-auto"
                    />
                    <template v-else-if="!row.isSummaryRow">
                      {{
                        measuredQtyByBoq[row.boqItemId] ||
                        formatQty(row.measuredQtyDefault)
                      }}
                    </template>
                  </td>
                  <td class="px-3 py-2">
                    <FormTextInput
                      v-if="!row.isSummaryRow && !isViewMode"
                      v-model="remarkByBoq[row.boqItemId]"
                      :name="`remark-${row.boqItemId}`"
                      :disabled="row.isSummaryRow"
                      placeholder="可选"
                    />
                    <template v-else-if="!row.isSummaryRow">
                      {{ remarkByBoq[row.boqItemId] || '-' }}
                    </template>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <button
                      v-if="!row.isSummaryRow && !isViewMode"
                      class="text-danger hover:text-danger-darker transition-colors"
                      title="删除该验工行"
                      @click="removePreviewRow(row.boqItemId)"
                    >
                      <TrashIcon class="h-4 w-4" />
                    </button>
                  </td>
                </tr>
                <tr v-if="expandedBoqRowIds.has(row.boqItemId) && row.sourceAcceptances?.length" class="bg-highlight-1/30">
                  <td colspan="8" class="p-0 border-t border-outline-3">
                    <div class="px-8 py-3">
                      <div class="text-xs font-medium text-foreground-2 mb-2 flex items-center justify-between">
                        <span>关联的质量验收单</span>
                      </div>
                      <table class="w-full text-xs text-foreground-2 border border-outline-3 rounded overflow-hidden">
                        <thead class="bg-foundation text-left">
                          <tr>
                            <th class="px-2 py-1 border-b border-outline-3">区域部位</th>
                            <th class="px-2 py-1 border-b border-outline-3">检验批编号</th>
                            <th class="px-2 py-1 border-b border-outline-3">检验批内容</th>
                            <th class="px-2 py-1 border-b border-outline-3 w-24">验收日期</th>
                            <th class="px-2 py-1 border-b border-outline-3 text-right w-24">工程量</th>
                            <th v-if="!isViewMode" class="px-2 py-1 border-b border-outline-3 text-center w-12">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="acc in row.sourceAcceptances" :key="acc.id" class="border-b border-outline-3 last:border-b-0 hover:bg-highlight-1/50 transition-colors bg-foundation">
                            <td class="px-2 py-1.5">{{ acc.acceptancePart || '-' }}</td>
                            <td class="px-2 py-1.5">{{ acc.inspectionLotNumber || '-' }}</td>
                            <td class="px-2 py-1.5">{{ acc.acceptanceContent || '-' }}</td>
                            <td class="px-2 py-1.5">{{ acc.actualFinishDate ? formatDate(acc.actualFinishDate) : '-' }}</td>
                            <td class="px-2 py-1.5 text-right">{{ acc.workVolume != null ? acc.workVolume : '-' }} {{ acc.unit || '' }}</td>
                            <td v-if="!isViewMode" class="px-2 py-1.5 text-center">
                              <button
                                class="text-danger hover:text-danger-darker transition-colors inline-block"
                                title="移除此验收单（将从本次验工中剔除）"
                                @click.stop.prevent="removeSourceAcceptance(row.boqItemId, acc.id)"
                              >
                                <TrashIcon class="h-3.5 w-3.5" />
                              </button>
                            </td>
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

        <div
          v-else-if="previewViewTag === 'list'"
          class="text-body-sm text-foreground-2"
        >
          请先选择基准时间并生成验工列表
        </div>
        <div
          v-else-if="previewViewTag === 'model'"
          class="rounded border border-outline-3 h-[420px] relative overflow-hidden"
        >
          <div
            v-if="acceptanceFormsLoading"
            class="h-full flex items-center justify-center text-body-sm text-foreground-2"
          >
            关联模型加载中...
          </div>
          <div
            v-else-if="!selectedPreviewModelIds.length"
            class="h-full flex items-center justify-center text-body-sm text-foreground-2"
          >
            暂无可展示的验工模型
          </div>
          <CommonModelPropsViewer
            v-else
            :project-id="projectId"
            :model-ids="selectedPreviewModelIds"
            :filter-bims="selectedPreviewBimIds"
            :filter-application-ids="selectedPreviewApplicationIds"
          />
        </div>
      </div>
    </LayoutDialog>

    <LayoutDialog
      v-model:open="viewDialogOpen"
      max-width="xl"
      :buttons="viewDialogButtons"
    >
      <template #header>月度验工详情</template>
      <ProjectsWorkValuationMmDetail
        v-if="viewTargetItem"
        :item="viewTargetItem"
        :project-id="projectId"
      >
        <template #default />
      </ProjectsWorkValuationMmDetail>
    </LayoutDialog>

    <LayoutDialog
      v-model:open="submitDialogOpen"
      max-width="xl"
      :buttons="submitDialogButtons"
    >
      <template #header>送审验工单</template>
      <ProjectsWorkValuationMmDetail
        v-if="submitTargetItem"
        :item="submitTargetItem"
        :project-id="projectId"
      >
        <FormTextArea
          v-model="submitRemark"
          label="送审说明"
          placeholder="请输入送审说明"
          name="remark"
          show-label
        />
      </ProjectsWorkValuationMmDetail>
    </LayoutDialog>

    <div v-if="flowDetailDrawerOpen" class="fixed inset-0 z-50 flex justify-end">
      <button class="absolute inset-0 bg-black/40" @click="closeFlowDrawer" />
      <div
        class="relative h-full w-full max-w-3xl bg-foundation-page border-l border-outline-3 shadow-xl overflow-y-auto"
      >
        <div
          class="p-4 border-b border-outline-3 flex items-center justify-between gap-3"
        >
          <div class="min-w-0">
            <div class="text-body-sm font-medium truncate">
              {{ selectedFlowInstance?.definition?.name || '流程详情' }}
            </div>
            <div class="text-body-xs text-foreground-2">
              #{{ selectedFlowInstance?.id }}
            </div>
          </div>
          <button
            class="px-2 py-1 rounded border border-outline-3 text-body-xs"
            @click="closeFlowDrawer"
          >
            关闭
          </button>
        </div>
        <div class="p-4 space-y-4">
          <div v-if="flowDetailLoading" class="text-body-sm text-foreground-2">
            加载中...
          </div>
          <div v-else-if="!selectedFlowInstance" class="text-body-sm text-foreground-2">
            未找到流程详情
          </div>
          <template v-else>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="border border-outline-3 rounded-lg p-3">
                <div class="text-body-xs text-foreground-2">状态</div>
                <div class="text-body-sm">
                  {{ formatFlowStatusLabel(selectedFlowInstance.status) }}
                </div>
              </div>
              <div class="border border-outline-3 rounded-lg p-3">
                <div class="text-body-xs text-foreground-2">当前步骤</div>
                <div class="text-body-sm">
                  {{ getCurrentFlowStepName(selectedFlowInstance) }}
                </div>
              </div>
              <div class="border border-outline-3 rounded-lg p-3">
                <div class="text-body-xs text-foreground-2">发起时间</div>
                <div class="text-body-sm">
                  {{ formatDateTime(selectedFlowInstance.createdAt) }}
                </div>
              </div>
              <div class="border border-outline-3 rounded-lg p-3">
                <div class="text-body-xs text-foreground-2">更新时间</div>
                <div class="text-body-sm">
                  {{ formatDateTime(selectedFlowInstance.updatedAt) }}
                </div>
              </div>
            </div>
            <div
              v-if="isAdmin"
              class="space-y-2 border border-outline-3 rounded-lg p-3"
            >
              <div class="text-body-sm font-medium">管理员流程操作</div>
              <FormTextArea
                v-model="flowActionComment"
                label="操作说明"
                placeholder="强制操作/重置请填写说明"
                name="flow-admin-comment"
                show-label
              />
              <FormTextInput
                v-model="reactivateTargetStep"
                type="number"
                label="重开到步骤"
                placeholder="请输入步骤序号（如 1）"
                name="flow-reactivate-step"
                show-label
              />
              <div class="flex flex-wrap gap-2">
                <FormButton
                  color="primary"
                  :disabled="!canForceReviewFlow || flowActionLoading"
                  :loading="flowActionLoading"
                  @click="forceApproveFlow"
                >
                  强制通过
                </FormButton>
                <FormButton
                  color="danger"
                  :disabled="!canForceReviewFlow || flowActionLoading"
                  :loading="flowActionLoading"
                  @click="forceRejectFlow"
                >
                  强制驳回
                </FormButton>
                <FormButton
                  color="outline"
                  :disabled="!canForceReviewFlow || flowActionLoading"
                  :loading="flowActionLoading"
                  @click="forceCancelFlow"
                >
                  强制取消
                </FormButton>
                <FormButton
                  color="primary"
                  :disabled="!canReactivateFlow || flowActionLoading"
                  :loading="flowActionLoading"
                  @click="reactivateFlow"
                >
                  激活流程
                </FormButton>
                <FormButton
                  color="outline"
                  :disabled="flowActionLoading"
                  :loading="flowActionLoading"
                  @click="resetFlowToUnsubmitted"
                >
                  重置未送审
                </FormButton>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-body-sm font-medium">流程日志</div>
              <div
                v-if="!selectedFlowInstance.actions.length"
                class="text-body-sm text-foreground-2 border border-outline-3 rounded-lg p-3"
              >
                暂无流程日志
              </div>
              <div
                v-for="action in selectedFlowInstance.actions"
                :key="action.id"
                class="border border-outline-3 rounded-lg p-3 text-body-xs text-foreground-2"
              >
                {{ formatFlowActionLabel(action.action) }} ·
                {{ action.actor?.name || action.actorId || '-' }} ·
                {{ formatDateTime(action.createdAt) }}
                <span v-if="action.toStatus">
                  · {{ formatFlowStatusLabel(action.toStatus) }}
                </span>
                <span v-if="action.comment">· {{ action.comment }}</span>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-body-sm font-medium">流程步骤</div>
              <div
                v-for="step in selectedFlowInstance.steps"
                :key="step.id"
                class="border rounded-lg p-3"
                :class="getFlowStepCardClass(step.status)"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="text-body-sm font-medium">
                    Step {{ step.stepIndex }} · {{ step.name }}
                  </div>
                  <span
                    class="text-body-xs px-2 py-0.5 rounded-full"
                    :class="getFlowStepTagClass(step.status)"
                  >
                    {{ formatFlowStepStatusLabel(step.status) }}
                  </span>
                </div>
                <div class="text-body-xs text-foreground-2 mt-1">
                  审核：{{ step.approvedByIds.length }}/{{ step.requiredApprovals }}
                </div>
                <div class="text-body-xs text-foreground-2 mt-1">
                  审核人：{{
                    step.approverIds.length ? step.approverIds.join('、') : '任意审批人'
                  }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
    <CommonConfirmDialog
      v-model:open="removeDialogOpen"
      title="移除质量验收单"
      text="确认从此验工项中移除该质量验收单吗？移除后将重新加载验工数据。"
      confirm-text="确认移除"
      @confirm="confirmRemoveSourceAcceptance"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useApolloClient, useMutation, useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'
import dayjs from 'dayjs'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import {
  LayoutTable,
  FormTextInput,
  FormButton,
  CommonBadge
} from '@speckle/ui-components'
import {
  approvalFlowInstanceDetailsForMonthlyMeasurementQuery,
  projectQualityAcceptanceFormsQuery,
  projectMonthlyMeasurementsQuery
} from '~/lib/projects/graphql/queries'
import {
  createMonthlyMeasurementMutation,
  monthlyMeasurementPreviewMutation,
  updateMonthlyMeasurementMutation,
  deleteMonthlyMeasurementMutation,
  submitMonthlyMeasurementMutation
} from '~/lib/projects/graphql/mutations'
import type {
  ApprovalFlowInstanceDetailsForMonthlyMeasurementQuery,
  ProjectMonthlyMeasurementsQuery
} from '~/lib/common/generated/gql/graphql'

type PreviewItem = {
  boqItemId: string
  boqCode: string
  boqName: string
  boqParentId: string | null
  boqDepth: number
  uom: string | null
  price: number | null
  pendingTotalQty: number
  approvedCumulativeQty: number
  measuredQtyDefault: number
  sourceAcceptanceIds: string[]
  sourceAcceptances?: {
    id: string
    acceptancePart: string
    inspectionLotNumber: string
    acceptanceContent: string
    actualFinishDate: number | null
    workVolume: number | null
    unit: string | null
  }[]
  isSummaryRow: boolean
  sortIndex: number
}

type MonthlyMeasurementNode = NonNullable<
  NonNullable<
    NonNullable<ProjectMonthlyMeasurementsQuery['project']>['monthlyMeasurements']
  >['items'][number]
>
type FlowInstanceNode = NonNullable<
  ApprovalFlowInstanceDetailsForMonthlyMeasurementQuery['approvalFlowInstance']
>
type PreviewViewTag = 'list' | 'model'

const approveFlowMutation = gql`
  mutation ForceApproveFlow($input: ApproveApprovalFlowInput!) {
    approvalMutations {
      approve(input: $input) {
        id
        status
      }
    }
  }
`

const rejectFlowMutation = gql`
  mutation ForceRejectFlow($input: RejectApprovalFlowInput!) {
    approvalMutations {
      reject(input: $input) {
        id
        status
      }
    }
  }
`

const cancelFlowMutation = gql`
  mutation ForceCancelFlow($input: CancelApprovalFlowInput!) {
    approvalMutations {
      cancel(input: $input) {
        id
        status
      }
    }
  }
`

const reactivateFlowMutation = gql`
  mutation ReactivateFlow($input: ReactivateApprovalFlowInput!) {
    approvalMutations {
      reactivate(input: $input) {
        id
        status
        currentStep
      }
    }
  }
`

const resetFlowToUnsubmittedMutation = gql`
  mutation ResetFlowToUnsubmitted($input: ResetApprovalFlowToUnsubmittedInput!) {
    approvalMutations {
      resetToUnsubmitted(input: $input) {
        id
        status
      }
    }
  }
`

const apollo = useApolloClient().client
const { isAdmin } = useActiveUser()

const route = useRoute()
const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const pageCursors = ref<Record<number, string | null>>({ 1: null })
const currentCursor = computed(() => pageCursors.value[currentPage.value] || null)

const updateDebouncedSearch = useDebounceFn((value: string) => {
  debouncedSearchQuery.value = value.trim()
}, 300)
watch(searchQuery, (value) => updateDebouncedSearch(value), { immediate: true })

const columns = [
  { id: 'code', header: '验工编码', classes: 'col-span-3' },
  { id: 'unit', header: '施工单位', classes: 'col-span-2' },
  { id: 'baseDate', header: '基准时间', classes: 'col-span-2' },
  { id: 'status', header: '状态', classes: 'col-span-2' },
  { id: 'creator', header: '创建人', classes: 'col-span-1' },
  { id: 'actions', header: '操作', classes: 'col-span-2 text-right text-sm' }
]

const { result: monthlyResult, refetch: refetchMonthly } = useQuery(
  projectMonthlyMeasurementsQuery,
  () => ({
    projectId: projectId.value,
    search: debouncedSearchQuery.value || null,
    cursor: currentCursor.value,
    limit: pageSize.value
  }),
  {
    enabled: computed(() => !!projectId.value)
  }
)

const tableItems = computed<MonthlyMeasurementNode[]>(() =>
  (monthlyResult.value?.project?.monthlyMeasurements.items || []).filter(
    (item): item is MonthlyMeasurementNode => !!item
  )
)
const totalItems = computed(
  () => monthlyResult.value?.project?.monthlyMeasurements.totalCount || 0
)
const nextCursor = computed(
  () => monthlyResult.value?.project?.monthlyMeasurements.cursor || null
)
const totalPages = computed(() =>
  Math.ceil(totalItems.value / Number(pageSize.value || 1))
)
const startItem = computed(() =>
  totalItems.value === 0 ? 0 : (currentPage.value - 1) * Number(pageSize.value) + 1
)
const endItem = computed(() =>
  Math.min(currentPage.value * Number(pageSize.value), totalItems.value)
)

watch([projectId, debouncedSearchQuery, pageSize], () => {
  currentPage.value = 1
  pageCursors.value = { 1: null }
})

const goPrevPage = () => {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
}

const goNextPage = () => {
  const cursor = nextCursor.value
  if (!cursor) return
  const nextPage = currentPage.value + 1
  pageCursors.value[nextPage] = cursor
  currentPage.value = nextPage
}

const createDialogOpen = ref(false)
const createError = ref('')
const dialogMode = ref<'create' | 'edit' | 'view'>('create')
const editingMeasurementId = ref<string | null>(null)
const excludedAcceptanceIds = ref<string[]>([])
const expandedBoqRowIds = ref<Set<string>>(new Set())
const removeDialogOpen = ref(false)
const pendingRemoveItem = ref<{ boqItemId: string; acceptanceId: string } | null>(null)
const previewLoading = ref(false)
const previewBaseDate = ref(0)
const previewItems = ref<PreviewItem[]>([])
const previewViewTag = ref<PreviewViewTag>('list')
const measuredQtyByBoq = ref<Record<string, string>>({})
const remarkByBoq = ref<Record<string, string>>({})
const actionLoadingId = ref<string | null>(null)
const viewDialogOpen = ref(false)
const viewTargetItem = ref<MonthlyMeasurementNode | null>(null)
const submitDialogOpen = ref(false)
const submitTargetItem = ref<MonthlyMeasurementNode | null>(null)
const submitRemark = ref('')
const flowDetailDrawerOpen = ref(false)
const flowDetailLoading = ref(false)
const selectedFlowInstance = ref<FlowInstanceNode | null>(null)
const flowActionComment = ref('')
const reactivateTargetStep = ref('')
const flowActionLoading = ref(false)

type AcceptanceFormLite = {
  id: string
  bimElements?: {
    modelId?: string | null
    bimIds?: unknown[] | null
  } | null
}

const createForm = ref({
  unit: '',
  code: '',
  baseDate: dayjs().format('YYYY-MM-DD')
})

const { mutate: previewMutate, loading: previewMutationLoading } = useMutation(
  monthlyMeasurementPreviewMutation
)
const { mutate: createMutate, loading: createLoading } = useMutation(
  createMonthlyMeasurementMutation
)
const { mutate: updateMutate, loading: updateLoading } = useMutation(
  updateMonthlyMeasurementMutation
)
const { mutate: deleteMutate, loading: deleteLoading } = useMutation(
  deleteMonthlyMeasurementMutation
)
const { mutate: submitMutate, loading: submitLoading } = useMutation(
  submitMonthlyMeasurementMutation
)
const previewSourceAcceptanceIds = computed(() =>
  Array.from(
    new Set(
      previewItems.value
        .flatMap((item) => item.sourceAcceptanceIds || [])
        .filter((id) => !!id)
    )
  )
)
const { result: acceptanceFormsResult, loading: acceptanceFormsLoading } = useQuery(
  projectQualityAcceptanceFormsQuery,
  () => ({
    projectId: projectId.value,
    search: null,
    cursor: null,
    limit: 500
  }),
  {
    enabled: computed(
      () =>
        !!projectId.value &&
        createDialogOpen.value &&
        previewViewTag.value === 'model' &&
        previewSourceAcceptanceIds.value.length > 0
    )
  }
)

const selectedPreviewModelIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: unknown) => {
      const row = form as AcceptanceFormLite | null
      if (!row || !selectedIds.has(row.id)) return
      const modelId = row.bimElements?.modelId || ''
      if (modelId) ids.add(modelId)
    }
  )
  return Array.from(ids)
})

const selectedPreviewBimIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: unknown) => {
      const row = form as AcceptanceFormLite | null
      if (!row || !selectedIds.has(row.id)) return
      ;(row.bimElements?.bimIds || []).forEach((id) => {
        if (typeof id === 'string' && id) ids.add(id)
      })
    }
  )
  return Array.from(ids)
})

const selectedPreviewApplicationIds = computed(() => {
  const selectedIds = new Set(previewSourceAcceptanceIds.value)
  const ids = new Set<string>()
  ;(acceptanceFormsResult.value?.project?.qualityAcceptanceForms.items || []).forEach(
    (form: unknown) => {
      const row = form as AcceptanceFormLite | null
      if (!row || !selectedIds.has(row.id)) return
      ;(row.bimElements?.applicationIds || []).forEach((id) => {
        if (typeof id === 'string' && id) ids.add(id)
      })
    }
  )
  return Array.from(ids)
})

const isViewMode = computed(() => dialogMode.value === 'view')
const dialogTitle = computed(() => {
  if (dialogMode.value === 'view') return '月度验工详情'
  if (dialogMode.value === 'edit') return '编辑月度验工'
  return '新增月度验工'
})

const resetDialogState = () => {
  createError.value = ''
  previewItems.value = []
  previewViewTag.value = 'list'
  previewBaseDate.value = 0
  measuredQtyByBoq.value = {}
  remarkByBoq.value = {}
  excludedAcceptanceIds.value = []
  expandedBoqRowIds.value = new Set()
  editingMeasurementId.value = null
  createForm.value = {
    unit: '',
    code: '',
    baseDate: dayjs().format('YYYY-MM-DD')
  }
}

const openCreateDialog = () => {
  dialogMode.value = 'create'
  resetDialogState()
  createDialogOpen.value = true
}

const switchPreviewView = async (tag: PreviewViewTag) => {
  if (isViewMode.value) {
    previewViewTag.value = tag
    return
  }

  if (tag === 'list') {
    previewViewTag.value = 'list'
    if (!previewItems.value.length) await buildPreview()
    return
  }

  if (!previewItems.value.length) {
    await buildPreview()
  }
  previewViewTag.value = 'model'
}

const buildPreview = async () => {
  if (!projectId.value) return
  if (!createForm.value.baseDate) {
    createError.value = '请选择基准时间'
    return
  }
  createError.value = ''
  previewLoading.value = true
  const baseDate = dayjs(createForm.value.baseDate).endOf('day').valueOf()
  // In edit mode, collect the IDs of acceptances already in the current measurement
  // so the backend keeps them even though their approveStatus is PENDING
  const pinnedAcceptanceIds =
    dialogMode.value === 'edit'
      ? Array.from(
          new Set(
            previewItems.value
              .filter((r) => !r.isSummaryRow)
              .flatMap((r) => r.sourceAcceptanceIds || [])
              .filter((id) => !excludedAcceptanceIds.value.includes(id))
          )
        )
      : undefined
  try {
    const res = await previewMutate({
      input: {
        projectId: projectId.value,
        baseDate,
        excludedAcceptanceIds: excludedAcceptanceIds.value,
        pinnedAcceptanceIds
      }
    })
    const items =
      res?.data?.projectMutations?.monthlyMeasurementMutations?.preview.items || []
    previewItems.value = items.map((item) => ({
      boqItemId: item.boqItemId,
      boqCode: item.boqCode,
      boqName: item.boqName,
      boqParentId: item.boqParentId || null,
      boqDepth: item.boqDepth,
      uom: item.uom || null,
      price: item.price || null,
      pendingTotalQty: Number(item.pendingTotalQty || 0),
      approvedCumulativeQty: Number(item.approvedCumulativeQty || 0),
      measuredQtyDefault: Number(item.measuredQtyDefault || 0),
      sourceAcceptanceIds: item.sourceAcceptanceIds || [],
      sourceAcceptances: item.sourceAcceptances,
      isSummaryRow: !!item.isSummaryRow,
      sortIndex: Number(item.sortIndex || 0)
    }))
    previewItems.value.sort((a, b) => a.sortIndex - b.sortIndex)
    previewBaseDate.value = Number(
      res?.data?.projectMutations?.monthlyMeasurementMutations?.preview.baseDate || 0
    )
    measuredQtyByBoq.value = Object.fromEntries(
      previewItems.value.map((item) => [
        item.boqItemId,
        item.isSummaryRow 
          ? '' 
          : (measuredQtyByBoq.value[item.boqItemId] !== undefined 
              ? measuredQtyByBoq.value[item.boqItemId] 
              : `${item.measuredQtyDefault}`)
      ])
    )
    remarkByBoq.value = Object.fromEntries(
      previewItems.value.map((item) => [
        item.boqItemId,
        item.isSummaryRow 
          ? '' 
          : (remarkByBoq.value[item.boqItemId] || '')
      ])
    )
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '生成验工列表失败'
  } finally {
    previewLoading.value = false
  }
}

watch(
  () => createForm.value.baseDate,
  async (nextBaseDate, prevBaseDate) => {
    if (!createDialogOpen.value || isViewMode.value) return
    if (nextBaseDate === prevBaseDate) return

    // 基准时间变化后，原预览结果失效，需要重新生成列表并联动更新模型
    // 编辑模式下保留已有验收单 IDs 作为 pinnedAcceptanceIds，传给后端合并
    previewItems.value = []
    previewBaseDate.value = 0
    measuredQtyByBoq.value = {}
    remarkByBoq.value = {}

    if (!nextBaseDate) return
    await buildPreview()
  }
)

const buildPreviewFromMeasurement = (item: MonthlyMeasurementNode) => {
  const rows = (item.items || [])
    .map((row) => ({
      boqItemId: row.boqItemId,
      boqCode: row.boqCode || '',
      boqName: row.boqName || '',
      boqParentId: row.boqParentId || null,
      boqDepth: row.boqDepth,
      uom: row.uom || null,
      price: row.price || null,
      pendingTotalQty: Number(row.pendingTotalQty || 0),
      approvedCumulativeQty: Number(row.approvedCumulativeQty || 0),
      measuredQtyDefault: Number(row.measuredQty || 0),
      sourceAcceptanceIds: row.sourceAcceptanceIds || [],
      sourceAcceptances: row.sourceAcceptances,
      isSummaryRow: !!row.isSummaryRow,
      sortIndex: Number(row.sortIndex || 0)
    }))
    .sort((a, b) => a.sortIndex - b.sortIndex)
  previewItems.value = rows
  previewBaseDate.value = Number(item.baseDate || 0)
  previewViewTag.value = 'list'
  measuredQtyByBoq.value = Object.fromEntries(
    rows.map((row) => [
      row.boqItemId,
      row.isSummaryRow ? '' : `${row.measuredQtyDefault}`
    ])
  )
  remarkByBoq.value = Object.fromEntries(
    rows
      .filter((row) => !row.isSummaryRow)
      .map((row) => {
        const matched = item.items?.find(
          (itemRow) => itemRow.boqItemId === row.boqItemId
        )
        return [row.boqItemId, matched?.remark || '']
      })
  )
}

const removePreviewRow = (boqItemId: string, skipConfirm = false) => {
  if (!skipConfirm) {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm('确认删除该验工行吗？删除后该清单项不参与本次验工。')
    if (!confirmed) return
  }

  const nextRows = previewItems.value.filter((row) => row.boqItemId !== boqItemId)
  const rowById = new Map(nextRows.map((row) => [row.boqItemId, row]))
  const keepIds = new Set<string>()

  for (const row of nextRows) {
    if (row.isSummaryRow) continue
    let cursor: string | null = row.boqItemId
    while (cursor) {
      if (keepIds.has(cursor)) break
      keepIds.add(cursor)
      cursor = rowById.get(cursor)?.boqParentId || null
    }
  }

  const filteredRows = nextRows.filter((row) => keepIds.has(row.boqItemId))
  const childrenMap = new Map<string | null, PreviewItem[]>()
  for (const row of filteredRows) {
    const parentId = row.boqParentId || null
    const list = childrenMap.get(parentId) || []
    list.push(row)
    childrenMap.set(parentId, list)
  }

  const rebuiltRows = filteredRows
    .map((row) => ({ ...row }))
    .sort((a, b) => a.sortIndex - b.sortIndex)
  // const rebuiltRowById = new Map(rebuiltRows.map((row) => [row.boqItemId, row]))
  // for (const row of rebuiltRows) {
  //   if (!row.isSummaryRow) continue
  //   row.pendingTotalQty = 0
  //   row.approvedCumulativeQty = 0
  //   row.measuredQtyDefault = 0
  // }
  // for (const row of [...rebuiltRows].sort((a, b) => b.sortIndex - a.sortIndex)) {
  //   if (!row.isSummaryRow) continue
  //   const children = childrenMap.get(row.boqItemId) || []
  //   const current = rebuiltRowById.get(row.boqItemId)
  //   if (!current) continue
  //   for (const child of children) {
  //     current.pendingTotalQty += Math.max(child.pendingTotalQty, 0)
  //     current.approvedCumulativeQty += child.approvedCumulativeQty
  //   }
  // }

  previewItems.value = rebuiltRows
  measuredQtyByBoq.value = Object.fromEntries(
    rebuiltRows.map((row) => [
      row.boqItemId,
      row.isSummaryRow
        ? ''
        : measuredQtyByBoq.value[row.boqItemId] || `${row.measuredQtyDefault}`
    ])
  )
  remarkByBoq.value = Object.fromEntries(
    rebuiltRows
      .filter((row) => !row.isSummaryRow)
      .map((row) => [row.boqItemId, remarkByBoq.value[row.boqItemId] || ''])
  )
}

const toggleExpand = (boqItemId: string) => {
  if (expandedBoqRowIds.value.has(boqItemId)) {
    expandedBoqRowIds.value.delete(boqItemId)
  } else {
    expandedBoqRowIds.value.add(boqItemId)
  }
}

const removeSourceAcceptance = (boqItemId: string, acceptanceId: string) => {
  pendingRemoveItem.value = { boqItemId, acceptanceId }
  removeDialogOpen.value = true
}

const confirmRemoveSourceAcceptance = async () => {
  if (!pendingRemoveItem.value) return
  const { boqItemId, acceptanceId } = pendingRemoveItem.value
  excludedAcceptanceIds.value.push(acceptanceId)
  
  if (dialogMode.value === 'edit') {
    // 处于编辑模式时，仅在本地数据中剔除细分项，不重新向后端请求全新列表
    const row = previewItems.value.find((r) => r.boqItemId === boqItemId)
    if (row && row.sourceAcceptances) {
      const accIndex = row.sourceAcceptances.findIndex((a) => a.id === acceptanceId)
      if (accIndex >= 0) {
        const acc = row.sourceAcceptances[accIndex]
        const workVolume = Number(acc.workVolume || 0)
        row.sourceAcceptances = row.sourceAcceptances.filter((a) => a.id !== acceptanceId)
        row.sourceAcceptanceIds = row.sourceAcceptanceIds.filter((id) => id !== acceptanceId)
        row.measuredQtyDefault = Math.max(0, row.measuredQtyDefault - workVolume)

        const currentVal = Number(measuredQtyByBoq.value[boqItemId])
        if (!Number.isNaN(currentVal) && measuredQtyByBoq.value[boqItemId] !== '') {
          measuredQtyByBoq.value[boqItemId] = `${Math.max(0, currentVal - workVolume)}`
        }
      }

      if (row.sourceAcceptanceIds.length === 0) {
        removePreviewRow(boqItemId, true)
      }
    }
  } else {
    // 新建模式下，请求后端根据当前的 excludedAcceptanceIds 重新生成全部明细
    await buildPreview()
  }

  pendingRemoveItem.value = null
  removeDialogOpen.value = false
}

const isSubmitted = (item: { approveStatus?: string | null }) =>
  Boolean(item.approveStatus && item.approveStatus.toUpperCase() !== 'START')

const viewItem = (item: MonthlyMeasurementNode) => {
  viewTargetItem.value = item
  viewDialogOpen.value = true
}

const openSubmitDialog = (item: MonthlyMeasurementNode) => {
  if (isSubmitted(item)) return
  submitTargetItem.value = item
  submitRemark.value = ''
  submitDialogOpen.value = true
}

const editItem = async (item: MonthlyMeasurementNode) => {
  if (isSubmitted(item)) return
  resetDialogState()
  dialogMode.value = 'edit'
  editingMeasurementId.value = item.id
  createForm.value = {
    unit: item.unit || '',
    code: item.code,
    baseDate: dayjs(Number(item.baseDate)).format('YYYY-MM-DD')
  }
  previewBaseDate.value = Number(item.baseDate || 0)
  buildPreviewFromMeasurement(item)
  // Wait for Vue to flush all watchers triggered by resetDialogState / createForm changes
  // while createDialogOpen is still false (so the baseDate watcher returns early).
  // Without this, the watcher fires AFTER createDialogOpen=true and clears previewItems.
  await nextTick()
  createDialogOpen.value = true
}

const submitDialog = async () => {
  if (!projectId.value || createLoading.value || updateLoading.value) return
  if (!createForm.value.unit.trim()) {
    createError.value = '施工单位不能为空'
    return
  }
  if (!createForm.value.code.trim()) {
    createError.value = '验工编号不能为空'
    return
  }
  if (!createForm.value.baseDate) {
    createError.value = '基准时间不能为空'
    return
  }
  if (!previewItems.value.length) {
    createError.value = '请先生成验工列表'
    return
  }

  createError.value = ''
  const measuredItems = previewItems.value
    .filter((item) => !item.isSummaryRow)
    .map((item) => {
      const rawQty = measuredQtyByBoq.value[item.boqItemId]
      const parsedQty = Number(rawQty)
      return {
        boqItemId: item.boqItemId,
        measuredQty: Number.isNaN(parsedQty) ? item.measuredQtyDefault : parsedQty,
        remark: (remarkByBoq.value[item.boqItemId] || '').trim() || null
      }
    })

  try {
    if (dialogMode.value === 'edit' && editingMeasurementId.value) {
      await updateMutate({
        input: {
          projectId: projectId.value,
          id: editingMeasurementId.value,
          unit: createForm.value.unit.trim(),
          code: createForm.value.code.trim(),
          baseDate: dayjs(createForm.value.baseDate).endOf('day').valueOf(),
          measuredItems,
          excludedAcceptanceIds: excludedAcceptanceIds.value
        }
      })
    } else {
      await createMutate({
        input: {
          projectId: projectId.value,
          unit: createForm.value.unit.trim(),
          code: createForm.value.code.trim(),
          baseDate: dayjs(createForm.value.baseDate).endOf('day').valueOf(),
          measuredItems,
          excludedAcceptanceIds: excludedAcceptanceIds.value
        }
      })
    }
    createDialogOpen.value = false
    await refetchMonthly()
    if (currentPage.value !== 1) currentPage.value = 1
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '保存失败'
  }
}

const createDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      resetDialogState()
      createDialogOpen.value = false
    }
  },
  {
    text: dialogMode.value === 'edit' ? '保存' : '提交',
    props: {
      color: 'primary',
      loading:
        createLoading.value ||
        updateLoading.value ||
        previewMutationLoading.value ||
        submitLoading.value ||
        deleteLoading.value
    },
    disabled:
      isViewMode.value ||
      createLoading.value ||
      updateLoading.value ||
      previewMutationLoading.value ||
      submitLoading.value ||
      deleteLoading.value,
    onClick: () => {
      submitDialog().catch(() => undefined)
    }
  }
])

const viewDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '关闭',
    props: { color: 'outline' },
    onClick: () => {
      viewDialogOpen.value = false
      viewTargetItem.value = null
    }
  }
])

const submitDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      submitDialogOpen.value = false
    }
  },
  {
    text: '确认送审',
    props: {
      color: 'primary',
      loading: submitLoading.value
    },
    disabled: submitLoading.value || !submitTargetItem.value,
    onClick: () => {
      if (!submitTargetItem.value) return
      submitItem(submitTargetItem.value).catch(() => undefined)
    }
  }
])

const submitItem = async (item: MonthlyMeasurementNode) => {
  if (!projectId.value || isSubmitted(item)) return
  actionLoadingId.value = item.id
  try {
    await submitMutate({
      input: {
        projectId: projectId.value,
        id: item.id,
        remark: submitRemark.value.trim() || null
      }
    })
    await refetchMonthly()
    submitDialogOpen.value = false
    submitTargetItem.value = null
    submitRemark.value = ''
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '送审失败'
  } finally {
    actionLoadingId.value = null
  }
}

const openFlowDetail = async (item: MonthlyMeasurementNode) => {
  if (!item.flowInstanceId) return
  flowDetailDrawerOpen.value = true
  flowDetailLoading.value = true
  selectedFlowInstance.value = null
  try {
    const res = await apollo.query({
      query: approvalFlowInstanceDetailsForMonthlyMeasurementQuery,
      variables: {
        id: item.flowInstanceId
      },
      fetchPolicy: 'network-only'
    })
    selectedFlowInstance.value = (res.data?.approvalFlowInstance ||
      null) as FlowInstanceNode
  } finally {
    flowDetailLoading.value = false
  }
}

const closeFlowDrawer = () => {
  flowDetailDrawerOpen.value = false
  selectedFlowInstance.value = null
  flowActionComment.value = ''
  reactivateTargetStep.value = ''
}

const refreshSelectedFlowInstance = async () => {
  if (!selectedFlowInstance.value?.id) return
  flowDetailLoading.value = true
  try {
    const res = await apollo.query({
      query: approvalFlowInstanceDetailsForMonthlyMeasurementQuery,
      variables: {
        id: selectedFlowInstance.value.id
      },
      fetchPolicy: 'network-only'
    })
    selectedFlowInstance.value = (res.data?.approvalFlowInstance ||
      null) as FlowInstanceNode
  } finally {
    flowDetailLoading.value = false
  }
}

const canReactivateFlow = computed(() => {
  const status = selectedFlowInstance.value?.status
  return status === 'APPROVED' || status === 'REJECTED' || status === 'CANCELED'
})

const canForceReviewFlow = computed(
  () => selectedFlowInstance.value?.status === 'PENDING'
)

const ensureAdminComment = () => {
  const comment = flowActionComment.value.trim()
  if (!comment) {
    createError.value = '管理员操作请填写说明'
    return null
  }
  return comment
}

const forceApproveFlow = async () => {
  if (
    !selectedFlowInstance.value ||
    !canForceReviewFlow.value ||
    flowActionLoading.value
  )
    return
  const comment = ensureAdminComment()
  if (!comment) return
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: approveFlowMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          comment,
          forceByAdmin: true
        }
      }
    })
    await Promise.all([refreshSelectedFlowInstance(), refetchMonthly()])
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '强制通过失败'
  } finally {
    flowActionLoading.value = false
  }
}

const forceRejectFlow = async () => {
  if (
    !selectedFlowInstance.value ||
    !canForceReviewFlow.value ||
    flowActionLoading.value
  )
    return
  const comment = ensureAdminComment()
  if (!comment) return
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: rejectFlowMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          comment,
          forceByAdmin: true
        }
      }
    })
    await Promise.all([refreshSelectedFlowInstance(), refetchMonthly()])
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '强制驳回失败'
  } finally {
    flowActionLoading.value = false
  }
}

const forceCancelFlow = async () => {
  if (
    !selectedFlowInstance.value ||
    !canForceReviewFlow.value ||
    flowActionLoading.value
  )
    return
  const comment = ensureAdminComment()
  if (!comment) return
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: cancelFlowMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          comment,
          forceByAdmin: true
        }
      }
    })
    await Promise.all([refreshSelectedFlowInstance(), refetchMonthly()])
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '强制取消失败'
  } finally {
    flowActionLoading.value = false
  }
}

const reactivateFlow = async () => {
  if (
    !selectedFlowInstance.value ||
    !canReactivateFlow.value ||
    flowActionLoading.value
  )
    return
  const comment = ensureAdminComment()
  if (!comment) return
  const targetStep = Number(reactivateTargetStep.value || 0)
  if (!targetStep || Number.isNaN(targetStep) || targetStep < 1) {
    createError.value = '请输入有效的重开步骤'
    return
  }
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: reactivateFlowMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          targetStep,
          comment
        }
      }
    })
    await Promise.all([refreshSelectedFlowInstance(), refetchMonthly()])
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '流程激活失败'
  } finally {
    flowActionLoading.value = false
  }
}

const resetFlowToUnsubmitted = async () => {
  if (!selectedFlowInstance.value || flowActionLoading.value) return
  const comment = ensureAdminComment()
  if (!comment) return
  flowActionLoading.value = true
  try {
    await apollo.mutate({
      mutation: resetFlowToUnsubmittedMutation,
      variables: {
        input: {
          instanceId: selectedFlowInstance.value.id,
          comment
        }
      }
    })
    await refetchMonthly()
    closeFlowDrawer()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '重置未送审失败'
  } finally {
    flowActionLoading.value = false
  }
}

const deleteItem = async (item: MonthlyMeasurementNode) => {
  if (!projectId.value || isSubmitted(item)) return
  actionLoadingId.value = item.id
  try {
    await deleteMutate({
      input: {
        projectId: projectId.value,
        id: item.id
      }
    })
    await refetchMonthly()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : '删除失败'
  } finally {
    actionLoadingId.value = null
  }
}

const getStatusText = (status: string | null | undefined) => {
  const map: Record<string, string> = {
    START: '待送审',
    PENDING: '审批中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELED: '已取消'
  }
  return map[(status || '').toUpperCase()] || '未送审'
}

const getStatusColor = (status: string | null | undefined) => {
  const map: Record<string, string> = {
    START: 'bg-warning-lighter text-warning-darker',
    PENDING: 'bg-primary-muted text-primary',
    APPROVED: 'bg-success-lighter text-success-darker',
    REJECTED: 'bg-danger-lighter text-danger-darker',
    CANCELED: 'bg-highlight-3 text-foreground-2'
  }
  return map[(status || '').toUpperCase()] || 'bg-foundation-3 text-foreground-2'
}

const formatFlowStatusLabel = (status?: string | null) => {
  const map: Record<string, string> = {
    PENDING: '审批中',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    CANCELED: '已取消',
    CANCELLED: '已取消'
  }
  if (!status) return '-'
  return map[status] || status
}

const formatFlowStepStatusLabel = (status?: string | null) => {
  const map: Record<string, string> = {
    WAITING: '未开始',
    PENDING: '当前步骤',
    APPROVED: '已完成',
    REJECTED: '已驳回',
    CANCELED: '已取消',
    CANCELLED: '已取消'
  }
  if (!status) return '-'
  return map[status] || status
}

const formatFlowActionLabel = (action?: string | null) => {
  const map: Record<string, string> = {
    STARTED: '发起流程',
    STEP_APPROVED: '步骤通过',
    APPROVED: '流程通过',
    REJECTED: '流程驳回',
    CANCELED: '流程取消',
    REACTIVATED: '流程激活',
    RESET_TO_UNSUBMITTED: '重置未送审',
    TIMEOUT_REJECTED: '超时驳回'
  }
  if (!action) return '-'
  return map[action] || action
}

const getFlowStepCardClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'border-success bg-success/5'
  if (status === 'PENDING') return 'border-primary bg-primary/5'
  if (status === 'REJECTED' || status === 'CANCELED' || status === 'CANCELLED') {
    return 'border-danger bg-danger/5'
  }
  return 'border-outline-3 bg-foundation'
}

const getFlowStepTagClass = (status?: string | null) => {
  if (status === 'APPROVED') return 'bg-success/10 text-success'
  if (status === 'PENDING') return 'bg-primary/10 text-primary'
  if (status === 'REJECTED' || status === 'CANCELED' || status === 'CANCELLED') {
    return 'bg-danger/10 text-danger'
  }
  return 'bg-foundation-2 text-foreground-2'
}

const getCurrentFlowStepName = (instance: FlowInstanceNode) => {
  const byStatus = instance.steps.find((step) => step.status === 'PENDING')
  if (byStatus) return byStatus.name
  const byIndex = instance.steps.find((step) => step.stepIndex === instance.currentStep)
  return byIndex?.name || '-'
}

const formatQty = (value: number) => {
  if (Number.isInteger(value)) return `${value}`
  return value.toFixed(2)
}

const formatPrice = (value: number | null, isSummaryRow: boolean) => {
  if (isSummaryRow) return '-'
  if (value === null || value === undefined) return '-'
  if (Number.isInteger(value)) return `${value}`
  return value.toFixed(2)
}

const isBoqQuantityMissing = (row: PreviewItem) =>
  !row.isSummaryRow && row.pendingTotalQty < 0

const isCumulativeExceeded = (row: PreviewItem) =>
  !row.isSummaryRow &&
  !isBoqQuantityMissing(row) &&
  row.approvedCumulativeQty > row.pendingTotalQty

const formatDate = (value: number) => {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD')
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}
</script>
