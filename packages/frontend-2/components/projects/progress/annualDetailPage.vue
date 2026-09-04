<template>
  <div class="flex flex-col gap-4 text-foreground">
    <!-- Breadcrumb -->
    <nav
      class="flex flex-wrap items-center gap-1 text-body-xs text-foreground-2"
      aria-label="面包屑导航"
    >
      <NuxtLink to="/projects" class="transition hover:text-primary hover:underline">
        项目管理
      </NuxtLink>
      <ChevronRight class="h-3 w-3 shrink-0 text-outline-3" />
      <NuxtLink
        :to="`/projects/${projectId}/progress/schedule`"
        class="transition hover:text-primary hover:underline"
      >
        进度管理
      </NuxtLink>
      <ChevronRight class="h-3 w-3 shrink-0 text-outline-3" />
      <NuxtLink
        :to="`/projects/${projectId}/progress/schedule`"
        class="transition hover:text-primary hover:underline"
      >
        进度计划
      </NuxtLink>
      <ChevronRight class="h-3 w-3 shrink-0 text-outline-3" />
      <NuxtLink
        :to="`/projects/${projectId}/progress/annual`"
        class="transition hover:text-primary hover:underline"
      >
        年度计划
      </NuxtLink>
      <ChevronRight class="h-3 w-3 shrink-0 text-outline-3" />
      <span class="truncate font-medium text-foreground" :title="plan?.name">
        {{ plan?.name || '年度计划详情' }}
      </span>
    </nav>

    <!-- Module Tabs -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-2 pb-3"
    >
      <div class="flex items-center gap-6">
        <h1 class="text-heading-lg">进度计划</h1>
        <div class="flex items-center border-b border-outline-2">
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-transparent text-foreground-2 hover:text-foreground"
            @click="navigateToSchedule"
          >
            总进度计划
          </button>
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-primary text-primary font-semibold"
          >
            年度计划
          </button>
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-transparent text-foreground-2 hover:text-foreground"
            @click="navigateToMonthly"
          >
            月度计划
          </button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <FormButton
          size="sm"
          color="subtle"
          :icon-left="ArrowLeft"
          @click="navigateToAnnualList"
        >
          返回年度计划列表
        </FormButton>
      </div>
    </div>

    <div v-if="isLoadingPlan" class="py-12 text-center text-body-sm text-foreground-2">
      正在加载年度计划详情...
    </div>

    <template v-else>
      <div v-if="!plan" class="py-12 text-center text-body-sm text-foreground-2">
        未找到该年度计划，可能已被删除。请返回列表页查看。
      </div>

      <template v-else>
        <!-- 年度计划信息卡片 -->
        <div class="rounded-lg border border-outline-2 bg-foundation shadow-sm">
          <div
            class="flex flex-wrap items-start justify-between gap-4 border-b border-outline-2 px-4 py-4"
          >
            <div class="flex min-w-0 flex-1 flex-wrap items-start gap-4">
              <div>
                <span
                  class="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-body-sm font-semibold text-primary"
                >
                  {{ plan.year }} 年度
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-heading-md text-foreground">{{ plan.name }}</h2>
                  <span
                    v-if="plan.fileName"
                    v-tippy="
                      '该附件为创建时存档，下载任务文件请使用右上角「下载计划文件」'
                    "
                    class="inline-flex items-center gap-1 rounded bg-foundation-2 px-2 py-0.5 text-body-3xs text-foreground-2"
                  >
                    <Paperclip class="h-3 w-3" />
                    {{ plan.fileName }}
                  </span>
                </div>
                <div
                  class="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-body-xs text-foreground-2"
                >
                  <span>
                    编制人：
                    <span class="font-medium text-foreground">
                      {{ plan.preparedBy || '-' }}
                    </span>
                  </span>
                  <span>
                    起止日期：
                    <span class="font-medium text-foreground">
                      {{ formatDate(plan.startDate) }} ~ {{ formatDate(plan.endDate) }}
                    </span>
                  </span>
                  <span v-if="latestPlanFile">
                    计划文件：
                    <span class="font-medium text-foreground">
                      {{ latestPlanFile.fileName }}
                    </span>
                  </span>
                </div>
                <div
                  v-if="plan.remark"
                  class="mt-2 max-w-3xl text-body-xs text-foreground-2"
                >
                  {{ plan.remark }}
                </div>
              </div>
            </div>
            <div class="flex shrink-0 flex-wrap items-center gap-2">
              <FormButton
                v-if="hasFunctionalPerm('progress-plan:import')"
                size="sm"
                color="primary"
                :icon-left="Upload"
                :disabled="isImporting"
                @click="triggerPlanImport"
              >
                {{ isImporting ? '上传中...' : '导入 / 更新 计划' }}
              </FormButton>
              <FormButton
                v-if="hasFunctionalPerm('progress-plan:download')"
                size="sm"
                color="outline"
                :icon-left="Download"
                :disabled="!latestPlanFile"
                @click="handleDownloadPlanFile"
              >
                下载计划文件
              </FormButton>
            </div>
          </div>

          <!-- 任务树 -->
          <div class="overflow-x-auto">
            <div
              v-if="isLoadingTasks"
              class="px-4 py-10 text-center text-body-sm text-foreground-2"
            >
              正在加载年度计划任务...
            </div>
            <div
              v-else-if="!treeItems.length"
              class="px-4 py-10 text-center text-body-sm text-foreground-2"
            >
              {{
                latestPlanFile
                  ? '当前已上传该年度计划文件，等待后端解析并写入任务树。'
                  : '该年度计划还没有任务，请先通过「导入 / 更新 计划」上传 `.mpp` 文件。'
              }}
            </div>
            <LayoutTable
              v-else
              :columns="columns"
              :items="treeItems"
              class="w-full"
              expand-all-by-default
            >
              <template #wbs="{ item }">
                <span class="text-body-sm text-foreground-2">{{ item.wbs }}</span>
              </template>

              <template #taskName="{ item }">
                <div class="min-w-0 py-1">
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      class="truncate text-left font-medium text-body-sm transition-colors hover:text-primary hover:underline focus:outline-none"
                      :title="`点击查看【${item.taskName}】实际进度列表`"
                      @click.stop="openTaskActualProgressModal(item)"
                    >
                      {{ item.taskName }}
                    </button>
                    <span
                      v-if="item.milestoneType"
                      v-tippy="getMilestoneTooltipProps(item)"
                      class="inline-flex shrink-0"
                      :class="getMilestoneIconClass(item.milestoneType)"
                    >
                      <Flag class="h-3.5 w-3.5" />
                    </span>
                    <span
                      v-if="item.isCriticalTask"
                      v-tippy="criticalTaskTooltipProps"
                      class="inline-flex shrink-0 text-warning-darker"
                    >
                      <Star class="h-3.5 w-3.5 fill-current" />
                    </span>
                  </div>
                </div>
              </template>

              <template #duration="{ item }">
                <span class="text-body-sm">{{ item.duration }}</span>
              </template>

              <template #startDate="{ item }">
                <span class="text-body-sm">{{ item.startDate }}</span>
              </template>

              <template #endDate="{ item }">
                <span class="text-body-sm">{{ item.endDate }}</span>
              </template>

              <template #volume="{ item }">
                <span class="text-body-sm">{{ item.volume || '-' }}</span>
              </template>

              <template #unit="{ item }">
                <span class="text-body-sm">{{ item.unit || '-' }}</span>
              </template>

              <template #cumulativeVolume="{ item }">
                <span class="text-body-sm">
                  {{ item.hasChildren ? '-' : item.cumulativeVolume || '-' }}
                </span>
              </template>

              <template #taskStatus="{ item }">
                <div class="flex items-center justify-center">
                  <span v-if="item.hasChildren" class="text-body-xs text-foreground-2">
                    -
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-nowrap"
                    :class="getCalculatedStatusBadgeClass(item)"
                  >
                    {{ getCalculatedStatusText(item) }}
                  </span>
                </div>
              </template>

              <template #status="{ item }">
                <template v-if="item.hasChildren">
                  <div
                    class="inline-flex items-center rounded-full bg-foundation-2 px-2 py-0.5 text-xs font-medium text-nowrap text-foreground-2"
                  >
                    -
                  </div>
                </template>
                <template v-else>
                  <!-- 已关联 BIM：点击查看构件 -->
                  <div
                    v-if="item.applicationIds && item.applicationIds.length > 0"
                    role="button"
                    tabindex="0"
                    class="inline-flex cursor-pointer items-center rounded-full bg-success-lighter px-2 py-0.5 text-xs font-medium text-nowrap text-success-darker"
                    @click="openAssociatedModelDrawer(item)"
                    @keydown.enter="openAssociatedModelDrawer(item)"
                    @keydown.space="openAssociatedModelDrawer(item)"
                  >
                    已关联BIM模型
                  </div>
                  <!-- 未关联 BIM：点击进入绑定 -->
                  <div
                    v-else
                    role="button"
                    tabindex="0"
                    class="inline-flex cursor-pointer items-center rounded-full bg-foundation-2 px-2 py-0.5 text-xs font-medium text-nowrap text-foreground-2 transition hover:border hover:border-outline-3 hover:text-foreground"
                    :title="item.canEditBimAssociation ? '点击为任务绑定 BIM 构件' : ''"
                    @click="item.canEditBimAssociation && openLinkDialog(item)"
                    @keydown.enter="item.canEditBimAssociation && openLinkDialog(item)"
                  >
                    未关联
                  </div>
                </template>
              </template>

              <template #operation="{ item }">
                <div class="flex items-center justify-center gap-2">
                  <button
                    v-if="
                      hasFunctionalPerm('progress-plan:edit') &&
                      item.canEditBimAssociation
                    "
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-outline-3 bg-foundation text-foreground-2 transition hover:bg-primary-muted hover:text-primary"
                    :class="
                      item.applicationIds?.length ? 'border-primary text-primary' : ''
                    "
                    :aria-label="`BIM关联：${item.taskName}`"
                    title="绑定 BIM 构件"
                    @click.stop="openLinkDialog(item)"
                  >
                    <Link2 class="h-4 w-4" />
                  </button>
                  <button
                    v-if="hasFunctionalPerm('progress-plan:edit')"
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-outline-3 bg-foundation text-foreground-2 transition hover:bg-primary-muted hover:text-primary"
                    :class="item.milestoneType ? 'border-primary text-primary' : ''"
                    :aria-label="`设置里程碑：${item.taskName}`"
                    title="设置里程碑"
                    @click.stop="openMarkerDialog(item)"
                  >
                    <Flag class="h-4 w-4" />
                  </button>
                  <button
                    v-if="hasFunctionalPerm('progress-plan:edit')"
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-outline-3 bg-foundation text-foreground-2 transition hover:bg-warning-lighter hover:text-warning-darker"
                    :class="
                      item.isCriticalTask
                        ? 'border-warning bg-warning-lighter text-warning-darker'
                        : ''
                    "
                    :aria-label="`${item.isCriticalTask ? '取消' : '标记'}关键任务：${
                      item.taskName
                    }`"
                    title="关键任务"
                    @click.stop="toggleCriticalTask(item)"
                  >
                    <Star
                      class="h-4 w-4"
                      :class="item.isCriticalTask ? 'fill-current' : ''"
                    />
                  </button>
                </div>
              </template>
            </LayoutTable>
          </div>
        </div>
      </template>
    </template>

    <input
      ref="planImportInputRef"
      type="file"
      class="hidden"
      accept=".mpp"
      aria-label="导入年度计划文件"
      @change="handlePlanImportChange"
    />

    <!-- 里程碑弹窗 -->
    <LayoutDialog
      v-model:open="markerDialogOpen"
      max-width="lg"
      :buttons="markerDialogButtons"
    >
      <template #header>
        {{
          selectedMarkerTask
            ? `设置里程碑：${selectedMarkerTask.taskName}`
            : '设置里程碑'
        }}
      </template>
      <div v-if="selectedMarkerTask" class="space-y-4">
        <div class="rounded border border-outline-2 bg-foundation-page p-3">
          <div class="text-body-xs text-foreground-2">任务信息</div>
          <div class="mt-1 text-body-sm font-medium text-foreground">
            {{ selectedMarkerTask.taskName }}
          </div>
          <div class="mt-1 text-body-xs text-foreground-2">
            层级：{{ selectedMarkerTask.wbs || '-' }}
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <div class="text-body-sm font-medium text-foreground">里程碑</div>
            <div class="mt-1 text-body-xs text-foreground-2">
              选择里程碑类型后，可填写节点说明。
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
            <button
              v-for="option in milestoneTypeOptions"
              :key="option.value || 'none'"
              type="button"
              class="rounded-lg border px-3 py-3 text-left transition"
              :class="
                markerFormMilestoneType === option.value
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-outline-2 bg-foundation-page text-foreground hover:border-outline-3'
              "
              @click="markerFormMilestoneType = option.value"
            >
              <div class="text-body-sm font-medium">{{ option.label }}</div>
              <div class="mt-1 text-body-3xs text-foreground-2">
                {{ option.description }}
              </div>
            </button>
          </div>

          <div v-if="markerFormMilestoneType" class="space-y-2">
            <label
              for="annual-task-milestone-description"
              class="text-body-sm font-medium text-foreground"
            >
              里程碑描述
            </label>
            <textarea
              id="annual-task-milestone-description"
              v-model="markerFormMilestoneDescription"
              rows="4"
              maxlength="500"
              class="w-full rounded-lg border border-outline-3 bg-foundation-page px-3 py-2 text-body-sm outline-none transition focus:border-primary"
              placeholder="输入里程碑说明，例如项目整体竣工、阶段验收完成等"
            />
            <div class="text-right text-body-3xs text-foreground-2">
              {{ markerFormMilestoneDescription.length }}/500
            </div>
          </div>
        </div>
      </div>
    </LayoutDialog>

    <!-- BIM 关联编辑弹窗 -->
    <LayoutDialog
      v-model:open="linkDialogOpen"
      max-width="lg"
      :buttons="linkDialogButtons"
    >
      <template #header>
        {{ selectedTask ? `BIM关联：${selectedTask.taskName}` : 'BIM关联' }}
      </template>
      <div v-if="selectedTask" class="space-y-4">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="rounded border border-outline-2 bg-foundation-page p-3">
            <div class="text-body-xs text-foreground-2">计划开始</div>
            <div class="mt-1 text-body-sm font-medium">
              {{ selectedTask.startDate }}
            </div>
          </div>
          <div class="rounded border border-outline-2 bg-foundation-page p-3">
            <div class="text-body-xs text-foreground-2">计划完成</div>
            <div class="mt-1 text-body-sm font-medium">{{ selectedTask.endDate }}</div>
          </div>
        </div>
        <div
          class="rounded border border-dashed border-outline-3 bg-foundation-page p-4"
        >
          <CommonModelObjectMultiModelSelectDrawer
            v-model:model_ids="draftModelIds"
            v-model:selections="draftSelections"
            :project-id="projectId"
            placeholder="选择与计划任务关联的模型构件"
          />
        </div>
        <div class="text-body-xs text-foreground-2">
          当前已选择 {{ draftSelectedObjectCount }} 个构件，涉及
          {{ draftSelectedModelCount }} 个模型，保存后将按 `modelId + applicationId`
          建立任务与模型的关联关系。
        </div>
      </div>
    </LayoutDialog>

    <!-- BIM 关联查看抽屉 -->
    <LayoutDrawer
      v-model:open="associatedModelDrawerOpen"
      placement="right"
      width="95%"
      body-classes="p-4"
    >
      <template #title>
        关联模型查看
        <span v-if="selectedAssociationTask" class="text-sm text-foreground-2">
          | {{ selectedAssociationTask.taskName || selectedAssociationTask.wbs || '-' }}
        </span>
      </template>
      <div class="relative h-[85vh]">
        <CommonModelPropsViewer
          v-if="selectedAssociationModelIds.length"
          :project-id="projectId"
          :model-ids="selectedAssociationModelIds"
          :filter-bims="selectedAssociationBimIds"
          :filter-application-ids="selectedAssociationApplicationIds"
        />
        <div v-else class="flex h-full items-center justify-center text-foreground-2">
          未找到关联模型
        </div>
      </div>
    </LayoutDrawer>

    <!-- 实际进度列表弹窗 -->
    <LayoutDialog v-model:open="isActualModalOpen" max-width="xl">
      <template #header>
        <div class="flex items-center gap-2">
          <span>实际进度列表</span>
          <span
            v-if="selectedTaskForActual"
            class="text-body-sm font-normal text-foreground-2"
          >
            （{{ selectedTaskForActual.taskName }}）
          </span>
        </div>
      </template>
      <div v-if="selectedTaskForActual" class="space-y-4 py-1">
        <div
          class="grid grid-cols-2 gap-3 rounded-lg border border-outline-2 bg-foundation-page p-3 text-body-xs md:grid-cols-4"
        >
          <div>
            <div class="text-foreground-2">WBS / 层级</div>
            <div class="mt-0.5 font-medium text-foreground">
              {{ selectedTaskForActual.wbs || '-' }}
            </div>
          </div>
          <div>
            <div class="text-foreground-2">计划时间</div>
            <div
              class="mt-0.5 truncate font-medium text-foreground"
              :title="`${selectedTaskForActual.startDate} ~ ${selectedTaskForActual.endDate}`"
            >
              {{ selectedTaskForActual.startDate || '-' }} ~
              {{ selectedTaskForActual.endDate || '-' }}
            </div>
          </div>
          <div>
            <div class="text-foreground-2">计划工程量</div>
            <div class="mt-0.5 font-medium text-foreground">
              {{
                selectedTaskForActual.volume
                  ? `${selectedTaskForActual.volume}${selectedTaskForActual.unit || ''}`
                  : '-'
              }}
            </div>
          </div>
          <div>
            <div class="text-foreground-2">累计实际完成</div>
            <div class="mt-0.5 font-medium text-primary">
              {{ taskActualSummary.totalCompleted }} {{ taskActualSummary.unit }}
              <span
                v-if="taskActualSummary.completionRateText !== '-'"
                class="ml-1 font-normal text-foreground-2"
              >
                ({{ taskActualSummary.completionRateText }})
              </span>
            </div>
          </div>
        </div>

        <div
          class="max-h-[400px] overflow-x-auto overflow-y-auto rounded-lg border border-outline-2"
        >
          <table class="w-full text-left text-body-sm">
            <thead
              class="sticky top-0 border-b border-outline-2 bg-foundation-2 text-foreground-2"
            >
              <tr>
                <th class="w-10 px-3 py-2 text-center">#</th>
                <th class="w-28 px-3 py-2">填报日期</th>
                <th class="w-20 px-3 py-2">月份</th>
                <th class="w-28 px-3 py-2 text-center">本次完成量</th>
                <th class="w-24 px-3 py-2 text-center">现场负责人</th>
                <th class="w-24 px-3 py-2 text-center">记录人</th>
                <th class="w-24 px-3 py-2 text-center">BIM关联</th>
                <th class="min-w-[120px] px-3 py-2">备注</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-2 bg-foundation">
              <tr v-if="isLoadingActualProgressRecords">
                <td colspan="8" class="px-3 py-8 text-center text-foreground-2">
                  正在加载实际进度明细...
                </td>
              </tr>
              <tr v-else-if="!taskMatchingActualEntries.length">
                <td colspan="8" class="px-3 py-8 text-center text-foreground-2">
                  该任务暂无实际进度填报记录
                </td>
              </tr>
              <tr
                v-for="(entry, idx) in taskMatchingActualEntries"
                :key="entry.recordId + '-' + idx"
                class="transition-colors hover:bg-foundation-2/40"
              >
                <td class="px-3 py-2 text-center text-body-xs text-foreground-2">
                  {{ idx + 1 }}
                </td>
                <td class="px-3 py-2">
                  <div class="font-medium text-body-xs">{{ entry.reportDate }}</div>
                  <div class="text-body-3xs text-foreground-2">{{ entry.weekDay }}</div>
                </td>
                <td class="px-3 py-2 text-body-xs text-foreground-2">
                  {{ entry.yearMonth }}
                </td>
                <td
                  class="px-3 py-2 text-center font-semibold text-primary text-body-xs"
                >
                  {{ entry.completedVolume }} {{ entry.unit }}
                </td>
                <td class="px-3 py-2 text-center text-body-xs">
                  {{ entry.siteLeader }}
                </td>
                <td class="px-3 py-2 text-center text-body-xs">{{ entry.reporter }}</td>
                <td class="px-3 py-2 text-center">
                  <span
                    v-if="entry.bimCount > 0"
                    class="inline-flex items-center rounded-full bg-success-lighter px-2 py-0.5 text-body-3xs font-medium text-success-darker"
                  >
                    {{ entry.bimCount }} 件构件
                  </span>
                  <span v-else class="text-body-3xs text-foreground-2">-</span>
                </td>
                <td
                  class="max-w-[150px] truncate px-3 py-2 text-body-xs text-foreground-2"
                  :title="entry.remark"
                >
                  {{ entry.remark }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <template #buttons>
        <FormButton color="outline" @click="isActualModalOpen = false">关闭</FormButton>
      </template>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Flag,
  Link2,
  Paperclip,
  Star,
  Upload
} from 'lucide-vue-next'
import {
  CommonModelObjectMultiModelSelectDrawer,
  CommonModelPropsViewer
} from '#components'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'
import {
  getProgressAnnualPlan,
  getProgressAnnualPlanTasks,
  getLatestProgressAnnualPlanFile,
  uploadProgressAnnualPlanFile,
  downloadProgressAnnualPlanFile,
  updateProgressAnnualPlanTaskBimAssociation,
  updateProgressAnnualPlanTaskMarker,
  getProgressMonthlyPlans,
  getActualProgressRecords,
  type AnnualPlan,
  type ProgressPlanFile,
  type ProgressPlanTask,
  type ProgressPlanTaskBimSelection,
  type ProgressPlanTaskMilestoneType,
  type MonthlyRecordItem,
  type ActualProgressRecord
} from '~/lib/projects/api/progress'

interface ScheduleItem {
  id: string
  wbs?: string
  taskName: string
  duration: string
  startDate: string
  endDate: string
  volume?: string
  cumulativeVolume?: string
  unit?: string
  milestoneType: ProgressPlanTaskMilestoneType | null
  milestoneDescription: string | null
  isCriticalTask: boolean
  sortOrder: number
  level: number
  parentId?: string
  children?: ScheduleItem[]
  modelId: string | null
  modelIds: string[]
  applicationIds: string[]
  selections: ProgressPlanTaskBimSelection[]
  BIM?: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  hasChildren: boolean
  canEditBimAssociation: boolean
}

const route = useRoute()
const router = useRouter()

const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const planId = computed(() => {
  const id = route.params.planId
  return typeof id === 'string' ? id : ''
})

const plan = ref<AnnualPlan | null>(null)
const isLoadingPlan = ref(false)
const latestPlanFile = ref<ProgressPlanFile | null>(null)
const items = ref<ScheduleItem[]>([])
const treeItems = ref<ScheduleItem[]>([])
const planImportInputRef = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)
const isLoadingTasks = ref(false)
const isSavingLink = ref(false)
const isSavingMarker = ref(false)
const linkDialogOpen = ref(false)
const markerDialogOpen = ref(false)
const selectedTaskId = ref<string | null>(null)
const selectedMarkerTaskId = ref<string | null>(null)
const draftModelIds = ref<string[]>([])
const draftSelections = ref<ProgressPlanTaskBimSelection[]>([])
const markerFormMilestoneType = ref<ProgressPlanTaskMilestoneType | null>(null)
const markerFormMilestoneDescription = ref('')
const associatedModelDrawerOpen = ref(false)
const selectedAssociationTaskId = ref<string | null>(null)
const selectedAssociationModelIds = ref<string[]>([])
const selectedAssociationBimIds = ref<string[]>([])
const selectedAssociationApplicationIds = ref<string[]>([])

const { hasFunctionalPerm } = useCustomPermissions()
const { triggerNotification } = useGlobalToast()
const apiOrigin = useApiOrigin()
const { getTooltipProps } = useSmartTooltipDelay()

const criticalTaskTooltipProps = getTooltipProps(
  {
    content: '<div>关键任务（中优先级）</div><div>项目关键路径任务，需重点关注</div>',
    allowHTML: true
  },
  {
    maxWidth: 320
  }
)

const milestoneTypeOptions: Array<{
  value: ProgressPlanTaskMilestoneType | null
  label: string
  description: string
}> = [
  { value: null, label: '不设置', description: '移除当前里程碑标记' },
  { value: 'project', label: '项目级', description: '整个项目的重要节点' },
  { value: 'phase', label: '阶段级', description: '工程阶段完成节点' },
  { value: 'acceptance', label: '验收级', description: '质量或专项验收节点' }
]

const columns = [
  { id: 'wbs', header: '层级', classes: 'col-span-1' },
  { id: 'taskName', header: '任务名称', classes: 'col-span-2' },
  { id: 'duration', header: '工期', classes: 'col-span-1' },
  { id: 'startDate', header: '开始时间', classes: 'col-span-1' },
  { id: 'endDate', header: '完成时间', classes: 'col-span-1' },
  { id: 'volume', header: '工程量', classes: 'col-span-1 text-center' },
  { id: 'unit', header: '单位', classes: 'col-span-1 text-center' },
  { id: 'cumulativeVolume', header: '累计完成量', classes: 'col-span-1 text-center' },
  { id: 'taskStatus', header: '任务状态', classes: 'col-span-1 text-center' },
  { id: 'status', header: '关联状态', classes: 'col-span-1 text-center' },
  { id: 'operation', header: '操作', classes: 'col-span-1 flex justify-center' }
]

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const uniqueStrings = (values: unknown[]) => {
  const seen = new Set<string>()
  return values.reduce<string[]>((acc, value) => {
    const normalized = normalizeString(value)
    if (!normalized || seen.has(normalized)) return acc
    seen.add(normalized)
    acc.push(normalized)
    return acc
  }, [])
}

const getTaskBimSummary = (task: {
  BIM?: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
}) => {
  const BIM = task.BIM || []
  const modelIds = uniqueStrings(BIM.map((e) => e.modelId))
  const applicationIds = uniqueStrings(BIM.flatMap((e) => e.applicationIds))
  const selections = BIM.map((e) => ({
    modelId: e.modelId,
    applicationIds: e.applicationIds
  }))
  return {
    BIM,
    modelId: modelIds.length === 1 ? modelIds[0] : null,
    modelIds,
    applicationIds,
    selections
  }
}

const normalizeSelections = (
  selections: ProgressPlanTaskBimSelection[] | null | undefined
): ProgressPlanTaskBimSelection[] =>
  (Array.isArray(selections) ? selections : [])
    .map((group) => ({
      modelId: normalizeString(group?.modelId),
      applicationIds: uniqueStrings(group?.applicationIds || [])
    }))
    .filter((group) => group.modelId && group.applicationIds.length > 0)

const formatPlanDate = (value: string | null) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('zh-CN')
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

const mapTaskRecordToItem = (task: ProgressPlanTask): ScheduleItem => ({
  id: task.id,
  wbs: task.wbs || undefined,
  taskName: task.taskName,
  volume: task.quantity || undefined,
  unit: task.unit || undefined,
  duration: task.duration || '-',
  startDate: formatPlanDate(task.startDate),
  endDate: formatPlanDate(task.endDate),
  milestoneType: task.milestoneType,
  milestoneDescription: task.milestoneDescription,
  isCriticalTask: task.isCriticalTask,
  sortOrder: task.sortOrder,
  level: task.level || 0,
  parentId: task.parentId || undefined,
  children: [],
  ...getTaskBimSummary(task),
  hasChildren: task.hasChildren,
  canEditBimAssociation: task.canEditBimAssociation
})

const getParentWbs = (wbs?: string) => {
  if (!wbs) return null
  const segments = wbs.split('.').filter(Boolean)
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('.')
}

const getWbsLevel = (wbs?: string, fallbackLevel = 0) => {
  if (!wbs) return fallbackLevel
  const segments = wbs.split('.').filter(Boolean)
  return Math.max(segments.length - 1, 0)
}

const parseWbsSegments = (wbs?: string) => {
  if (!wbs) return []
  return wbs
    .split('.')
    .filter(Boolean)
    .map((segment) => Number.parseInt(segment, 10))
}

const compareWbs = (left?: string, right?: string) => {
  if (!left && !right) return 0
  if (left && !right) return -1
  if (!left && right) return 1

  const leftSegments = parseWbsSegments(left)
  const rightSegments = parseWbsSegments(right)
  const maxLength = Math.max(leftSegments.length, rightSegments.length)

  for (let index = 0; index < maxLength; index++) {
    const leftSegment = leftSegments[index]
    const rightSegment = rightSegments[index]

    if (leftSegment === undefined) return -1
    if (rightSegment === undefined) return 1
    if (leftSegment !== rightSegment) return leftSegment - rightSegment
  }

  return 0
}

const rebuildTaskTree = (taskItems: ScheduleItem[]) => {
  const orderedItems = [...taskItems]
    .map((item) => ({
      ...item,
      ...getTaskBimSummary(item),
      children: item.children || []
    }))
    .sort((left, right) => {
      const wbsOrder = compareWbs(left.wbs, right.wbs)
      if (wbsOrder !== 0) return wbsOrder
      if (!left.wbs && !right.wbs && left.taskName !== right.taskName) {
        return left.taskName.localeCompare(right.taskName, 'zh-CN')
      }
      return left.sortOrder - right.sortOrder
    })

  const originalParentIds = new Map(
    orderedItems.map((item) => [item.id, item.parentId || undefined])
  )
  const itemMap = new Map(orderedItems.map((item) => [item.id, item]))
  const itemByWbs = new Map(
    orderedItems.flatMap((item) => (item.wbs ? [[item.wbs, item] as const] : []))
  )

  itemMap.forEach((item) => {
    item.children = []
    item.parentId = undefined
    item.level = getWbsLevel(item.wbs, item.level)
  })

  const rootItems: ScheduleItem[] = []

  orderedItems.forEach((item) => {
    const wbsParent = getParentWbs(item.wbs)
    const originalParentId = originalParentIds.get(item.id)
    const parent = item.wbs
      ? wbsParent
        ? itemByWbs.get(wbsParent)
        : undefined
      : originalParentId
      ? itemMap.get(originalParentId)
      : undefined

    if (!parent) {
      rootItems.push(item)
      return
    }

    item.parentId = parent.id
    item.level = parent.level + 1
    parent.children = [...(parent.children || []), item]
  })

  items.value = orderedItems as ScheduleItem[]
  treeItems.value = rootItems as ScheduleItem[]
}

const navigateToSchedule = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/schedule`)
  }
}

const navigateToAnnualList = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/annual`)
  }
}

const navigateToMonthly = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/monthly`)
  }
}

const showSuccess = (title: string, description: string) => {
  triggerNotification({
    type: ToastNotificationType.Success,
    title,
    description
  })
}

const showMessage = (
  title: string,
  description: string,
  type: ToastNotificationType = ToastNotificationType.Danger
) => {
  triggerNotification({
    type,
    title,
    description
  })
}

const getMilestoneTypeLabel = (type: ProgressPlanTaskMilestoneType | null) => {
  switch (type) {
    case 'project':
      return '项目级里程碑'
    case 'phase':
      return '阶段级里程碑'
    case 'acceptance':
      return '验收级里程碑'
    default:
      return '里程碑'
  }
}

const getMilestoneIconClass = (type: ProgressPlanTaskMilestoneType | null) => {
  switch (type) {
    case 'project':
      return 'text-primary'
    case 'phase':
      return 'text-info'
    case 'acceptance':
      return 'text-success'
    default:
      return 'text-foreground-2'
  }
}

const getMilestoneTooltipProps = (item: ScheduleItem) =>
  getTooltipProps(
    {
      content: [
        `<div>${getMilestoneTypeLabel(item.milestoneType)}</div>`,
        item.milestoneDescription ? `<div>${item.milestoneDescription}</div>` : ''
      ].join(''),
      allowHTML: true
    },
    {
      maxWidth: 360
    }
  )

const selectedTask = computed(
  () => items.value.find((item) => item.id === selectedTaskId.value) || null
)

const selectedMarkerTask = computed(
  () => items.value.find((item) => item.id === selectedMarkerTaskId.value) || null
)

const selectedAssociationTask = computed(
  () => items.value.find((item) => item.id === selectedAssociationTaskId.value) || null
)

const draftSelectedObjectCount = computed(() =>
  draftSelections.value.reduce((count, group) => count + group.applicationIds.length, 0)
)

const draftSelectedModelCount = computed(() => draftModelIds.value.length)

const fetchPlan = async () => {
  if (!projectId.value || !planId.value) return
  isLoadingPlan.value = true
  try {
    plan.value = await getProgressAnnualPlan({
      projectId: projectId.value,
      planId: planId.value,
      apiOrigin
    })
    if (!plan.value) {
      return
    }
  } catch (error) {
    plan.value = null
    showMessage(
      '加载年度计划失败',
      error instanceof Error ? error.message : '未能获取年度计划详情'
    )
  } finally {
    isLoadingPlan.value = false
  }
}

const fetchLatestPlanFile = async () => {
  if (!projectId.value || !planId.value) {
    latestPlanFile.value = null
    return
  }
  try {
    latestPlanFile.value = await getLatestProgressAnnualPlanFile({
      projectId: projectId.value,
      planId: planId.value,
      apiOrigin
    })
  } catch (error) {
    latestPlanFile.value = null
    showMessage(
      '加载计划文件失败',
      error instanceof Error ? error.message : '未能获取该年度计划文件信息'
    )
  }
}

const fetchPlanTasks = async () => {
  if (!projectId.value || !planId.value) {
    items.value = []
    treeItems.value = []
    return
  }

  isLoadingTasks.value = true
  try {
    const tasks = await getProgressAnnualPlanTasks({
      projectId: projectId.value,
      planId: planId.value,
      apiOrigin
    })
    rebuildTaskTree(tasks.map(mapTaskRecordToItem))

    // 加载月度计划，按任务ID聚合累计完成量
    try {
      const monthlyPlans = await getProgressMonthlyPlans({
        projectId: projectId.value,
        apiOrigin
      })
      applyMonthlyVolumes(monthlyPlans)
    } catch {
      // 月度计划为辅助数据，加载失败时累计完成量保持为空
    }
  } catch (error) {
    items.value = []
    treeItems.value = []
    showMessage(
      '加载年度计划任务失败',
      error instanceof Error ? error.message : '未能获取该年度计划任务'
    )
  } finally {
    isLoadingTasks.value = false
  }
}

const applyMonthlyVolumes = (records: MonthlyRecordItem[]) => {
  const cumMap = new Map<string, number>()

  records.forEach((r) => {
    r.tasks.forEach((t) => {
      if (t.linkedPlanTaskId) {
        const actualVolumeNum = Number.parseFloat(String(t.actualVolume ?? ''))
        const val = Number.isFinite(actualVolumeNum) ? actualVolumeNum : 0
        cumMap.set(t.linkedPlanTaskId, (cumMap.get(t.linkedPlanTaskId) || 0) + val)
      }
    })
  })

  items.value.forEach((item) => {
    const cumVal = cumMap.get(item.id)
    if (cumVal !== undefined) {
      item.cumulativeVolume = String(cumVal)
    }
  })
}

const markerDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      markerDialogOpen.value = false
    }
  },
  {
    text: isSavingMarker.value ? '保存中...' : '保存标记',
    props: { color: 'primary' },
    onClick: () => {
      saveTaskMarker()
    }
  }
])

const linkDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      linkDialogOpen.value = false
    }
  },
  {
    text: '保存关联',
    props: { color: 'primary' },
    onClick: () => {
      saveTaskLink()
    }
  }
])

const openLinkDialog = (item: ScheduleItem) => {
  if (!item.canEditBimAssociation || item.hasChildren) return
  selectedTaskId.value = item.id
  draftModelIds.value = [...(item.modelIds || [])]
  draftSelections.value = normalizeSelections(item.selections)
  linkDialogOpen.value = true
}

const openMarkerDialog = (item: ScheduleItem) => {
  selectedMarkerTaskId.value = item.id
  markerFormMilestoneType.value = item.milestoneType
  markerFormMilestoneDescription.value = item.milestoneDescription || ''
  markerDialogOpen.value = true
}

const openAssociatedModelDrawer = (item: ScheduleItem) => {
  if (item.hasChildren) return
  selectedAssociationTaskId.value = item.id
  selectedAssociationModelIds.value = uniqueStrings(item.modelIds || [])
  selectedAssociationApplicationIds.value = uniqueStrings(item.applicationIds || [])
  // Plan links persist applicationIds without separate bimIds.
  // Reuse applicationIds as fallback lookup keys so CommonModelPropsViewer can isolate them.
  selectedAssociationBimIds.value = [...selectedAssociationApplicationIds.value]
  associatedModelDrawerOpen.value = true
}

const applyLocalTaskMarkerState = (task: ProgressPlanTask) => {
  const target = items.value.find((item) => item.id === task.id)
  if (!target) return
  target.milestoneType = task.milestoneType
  target.milestoneDescription = task.milestoneDescription
  target.isCriticalTask = task.isCriticalTask
}

const saveTaskLink = async () => {
  if (!selectedTask.value) return
  if (!projectId.value || !planId.value) return

  isSavingLink.value = true
  try {
    const BIM = draftSelections.value.map((sel) => ({
      modelId: sel.modelId,
      applicationIds: sel.applicationIds,
      bimIds: sel.applicationIds.map(() => null)
    }))
    const updated = await updateProgressAnnualPlanTaskBimAssociation({
      projectId: projectId.value,
      planId: planId.value,
      taskId: selectedTask.value.id,
      BIM,
      apiOrigin
    })
    await fetchPlanTasks()
    linkDialogOpen.value = false
    showSuccess(
      'BIM关联已更新',
      `任务“${updated.taskName}”已保存 ${
        getTaskBimSummary(updated).applicationIds.length
      } 个构件关联。`
    )
  } catch (error) {
    showMessage(
      'BIM关联保存失败',
      error instanceof Error ? error.message : '保存任务 BIM 关联失败'
    )
  } finally {
    isSavingLink.value = false
  }
}

const saveTaskMarker = async () => {
  if (!selectedMarkerTask.value) return
  if (!projectId.value || !planId.value) return

  isSavingMarker.value = true
  try {
    const updated = await updateProgressAnnualPlanTaskMarker({
      projectId: projectId.value,
      planId: planId.value,
      taskId: selectedMarkerTask.value.id,
      milestoneType: markerFormMilestoneType.value,
      milestoneDescription: markerFormMilestoneType.value
        ? markerFormMilestoneDescription.value.trim()
        : null,
      isCriticalTask: selectedMarkerTask.value.isCriticalTask,
      apiOrigin
    })
    applyLocalTaskMarkerState(updated)
    markerDialogOpen.value = false

    showSuccess(
      '里程碑已更新',
      updated.milestoneType
        ? `任务“${updated.taskName}”已设置为${getMilestoneTypeLabel(
            updated.milestoneType
          )}。`
        : `任务“${updated.taskName}”已移除里程碑标记。`
    )
  } catch (error) {
    showMessage(
      '里程碑保存失败',
      error instanceof Error ? error.message : '保存里程碑失败'
    )
  } finally {
    isSavingMarker.value = false
  }
}

const toggleCriticalTask = async (item: ScheduleItem) => {
  if (!projectId.value || !planId.value) return

  isSavingMarker.value = true
  try {
    const updated = await updateProgressAnnualPlanTaskMarker({
      projectId: projectId.value,
      planId: planId.value,
      taskId: item.id,
      milestoneType: item.milestoneType,
      milestoneDescription: item.milestoneDescription,
      isCriticalTask: !item.isCriticalTask,
      apiOrigin
    })
    applyLocalTaskMarkerState(updated)
    showSuccess(
      updated.isCriticalTask ? '已标记关键任务' : '已取消关键任务',
      `任务“${updated.taskName}”${
        updated.isCriticalTask ? '已标记为关键任务。' : '已取消关键任务标记。'
      }`
    )
  } catch (error) {
    showMessage(
      '关键任务更新失败',
      error instanceof Error ? error.message : '更新关键任务标记失败'
    )
  } finally {
    isSavingMarker.value = false
  }
}

const triggerPlanImport = () => {
  planImportInputRef.value?.click()
}

const handlePlanImportChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!projectId.value || !planId.value) {
    showMessage(
      '上传失败',
      '当前未识别年度计划，无法上传计划文件。',
      ToastNotificationType.Warning
    )
    input.value = ''
    return
  }

  if (!file.name.toLowerCase().endsWith('.mpp')) {
    showMessage(
      '上传失败',
      '仅支持上传 `.mpp` 格式的计划文件。',
      ToastNotificationType.Warning
    )
    input.value = ''
    return
  }

  isImporting.value = true
  try {
    const uploadResult = await uploadProgressAnnualPlanFile({
      projectId: projectId.value,
      planId: planId.value,
      file,
      apiOrigin
    })
    applyPlanFileState(uploadResult.data)
    await fetchPlanTasks()
    const summary = uploadResult.importSummary

    if (summary?.status === 'completed') {
      showSuccess(
        '年度计划文件已上传并解析',
        `已保存 ${uploadResult.data.fileName}，导入 ${summary.importedTaskCount} 条计划任务。`
      )
    } else if (summary?.status === 'failed') {
      showMessage(
        '年度计划文件已上传，但解析失败',
        summary.error || '原始文件已保存，请检查后端解析日志。',
        ToastNotificationType.Warning
      )
    } else {
      showSuccess('年度计划文件已上传', `已保存计划文件：${uploadResult.data.fileName}`)
    }
  } catch (error) {
    showMessage(
      '年度计划文件上传失败',
      error instanceof Error ? error.message : '上传失败'
    )
  } finally {
    isImporting.value = false
    input.value = ''
  }
}

const handleDownloadPlanFile = async () => {
  if (!projectId.value || !planId.value || !latestPlanFile.value) {
    showMessage(
      '无法下载',
      '该年度计划还没有可下载的计划文件。',
      ToastNotificationType.Warning
    )
    return
  }

  try {
    await downloadProgressAnnualPlanFile({
      projectId: projectId.value,
      planId: planId.value,
      apiOrigin,
      fallbackFileName: latestPlanFile.value.fileName.replace(/\.mpp$/i, '.xml')
    })
    showSuccess('下载成功', `已下载 ${latestPlanFile.value.fileName}`)
  } catch (error) {
    showMessage('计划文件下载失败', error instanceof Error ? error.message : '下载失败')
  }
}

const applyPlanFileState = (file: ProgressPlanFile | null) => {
  latestPlanFile.value = file
}

// 进度百分比：累计完成量 / 工程量，保留 2 位小数
const getCalculatedStatusText = (item: ScheduleItem) => {
  const totalVol = parseFloat(item.volume || '0')
  const cumVol = parseFloat(item.cumulativeVolume || '0')
  const pct = totalVol > 0 ? Math.min((cumVol / totalVol) * 100, 100) : 0

  if (cumVol > 0 && pct >= 100) return `已完成 (${pct.toFixed(2)}%)`
  if (cumVol > 0) return `进行中 (${pct.toFixed(2)}%)`
  return `未开始 (0%)`
}

const getCalculatedStatusBadgeClass = (item: ScheduleItem) => {
  const totalVol = parseFloat(item.volume || '0')
  const cumVol = parseFloat(item.cumulativeVolume || '0')
  const pct = totalVol > 0 ? Math.min((cumVol / totalVol) * 100, 100) : 0

  if (pct >= 100 && cumVol > 0) return 'bg-success-lighter text-success-darker'
  if (cumVol > 0) return 'bg-info-lighter text-info-darker'
  return 'bg-foundation-2 text-foreground-2'
}

// 实际进度列表弹窗 State
const isActualModalOpen = ref(false)
const selectedTaskForActual = ref<ScheduleItem | null>(null)
const actualProgressRecords = ref<ActualProgressRecord[]>([])
const isLoadingActualProgressRecords = ref(false)

const loadActualProgressRecords = async () => {
  if (!projectId.value) return
  isLoadingActualProgressRecords.value = true
  try {
    const data = await getActualProgressRecords({
      projectId: projectId.value,
      apiOrigin
    })
    actualProgressRecords.value = data
  } catch {
    // 实际进度记录为辅助数据，加载失败时仅提示空态
  } finally {
    isLoadingActualProgressRecords.value = false
  }
}

const openTaskActualProgressModal = (task: ScheduleItem) => {
  selectedTaskForActual.value = task
  isActualModalOpen.value = true
  loadActualProgressRecords()
}

const taskMatchingActualEntries = computed(() => {
  if (!selectedTaskForActual.value) return []
  const task = selectedTaskForActual.value

  const entries: Array<{
    recordId: string
    reportDate: string
    weekDay: string
    yearMonth: string
    siteLeader: string
    reporter: string
    remark: string
    completedVolume: string | number
    unit: string
    bimCount: number
  }> = []

  for (const record of actualProgressRecords.value) {
    if (!record.tasks || !Array.isArray(record.tasks)) continue
    for (const t of record.tasks) {
      const isMatch =
        (t.linkedPlanTaskId && t.linkedPlanTaskId === task.id) ||
        (t.taskName && t.taskName === task.taskName)

      if (isMatch) {
        let bimCount = 0
        if (t.selections && Array.isArray(t.selections)) {
          bimCount = t.selections.reduce(
            (sum: number, sel: { applicationIds?: string[] }) =>
              sum + (sel.applicationIds?.length || 0),
            0
          )
        }
        entries.push({
          recordId: record.id,
          reportDate: record.reportDate,
          weekDay: record.weekDay,
          yearMonth: record.yearMonth || '-',
          siteLeader: record.siteLeader || '-',
          reporter: record.reporter || '-',
          remark: record.remark || '-',
          completedVolume: t.completedVolume ?? 0,
          unit: t.unit || task.unit || '',
          bimCount
        })
      }
    }
  }

  return entries
})

const taskActualSummary = computed(() => {
  if (!selectedTaskForActual.value) {
    return { totalCompleted: 0, unit: '', plannedVolume: '-', completionRateText: '-' }
  }
  const task = selectedTaskForActual.value
  const entries = taskMatchingActualEntries.value

  const totalCompleted = entries.reduce((sum, e) => {
    const val =
      typeof e.completedVolume === 'number'
        ? e.completedVolume
        : parseFloat(String(e.completedVolume) || '0')
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  let completionRateText = '-'
  const plannedVol = task.volume ? parseFloat(task.volume) : 0
  if (plannedVol > 0) {
    const rate = ((totalCompleted / plannedVol) * 100).toFixed(1)
    completionRateText = `${rate}%`
  }

  return {
    totalCompleted,
    unit: task.unit || '',
    plannedVolume: task.volume || '-',
    completionRateText
  }
})

watch(
  () => [projectId.value, planId.value],
  () => {
    plan.value = null
    latestPlanFile.value = null
    items.value = []
    treeItems.value = []
    fetchPlan()
    fetchLatestPlanFile()
    fetchPlanTasks()
  }
)

onMounted(() => {
  fetchPlan()
  fetchLatestPlanFile()
  fetchPlanTasks()
})

watch(markerDialogOpen, (isOpen) => {
  if (isOpen) return
  selectedMarkerTaskId.value = null
  markerFormMilestoneType.value = null
  markerFormMilestoneDescription.value = ''
})

watch(associatedModelDrawerOpen, (isOpen) => {
  if (isOpen) return
  selectedAssociationTaskId.value = null
  selectedAssociationModelIds.value = []
  selectedAssociationBimIds.value = []
  selectedAssociationApplicationIds.value = []
})

watch(linkDialogOpen, (isOpen) => {
  if (isOpen) return
  selectedTaskId.value = null
  draftModelIds.value = []
  draftSelections.value = []
})
</script>
