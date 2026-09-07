<template>
  <div class="flex flex-col gap-4 text-foreground">
    <!-- Header with Title and Tabs -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-2 pb-3"
    >
      <div class="flex items-center gap-6">
        <h1 class="text-heading-lg">进度管理</h1>
        <div class="flex items-center border-b border-outline-2">
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'actual'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'actual'"
          >
            进度管理
          </button>
          <button
            type="button"
            :class="[
              'px-4 py-2 text-body-sm font-medium transition-colors border-b-2',
              activeTab === 'milestone'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-foreground-2 hover:text-foreground'
            ]"
            @click="activeTab = 'milestone'"
          >
            里程碑管理
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap items-center gap-3">
        <FormTextInput
          v-if="activeTab === 'actual'"
          v-model="actualSearchQuery"
          name="actual-search"
          placeholder="搜索任务名称/填报人..."
          :custom-icon="Search"
          color="foundation"
          class="w-64"
        />
        <FormTextInput
          v-else
          v-model="milestoneSearchQuery"
          name="milestone-search"
          placeholder="搜索里程碑/责任人..."
          :custom-icon="Search"
          color="foundation"
          class="w-64"
        />

        <FormButton
          v-if="activeTab === 'actual'"
          size="sm"
          color="primary"
          :icon-left="Plus"
          @click="openCreateActualDialog"
        >
          新增填报
        </FormButton>
        <FormButton
          v-else
          size="sm"
          color="primary"
          :icon-left="Plus"
          @click="openCreateMilestoneDialog"
        >
          新增里程碑
        </FormButton>
      </div>
    </div>

    <!-- ── Tab 1: 进度管理（实际填报记录） ── -->
    <div
      v-if="activeTab === 'actual'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingActual"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        正在加载施工进度记录...
      </div>
      <div
        v-else-if="!actualRecords.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        暂无进度填报记录，请点击右上角新增。
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-body-sm border-collapse">
          <thead>
            <tr
              class="border-b border-outline-2 bg-foundation-page/50 text-foreground-2 font-medium"
            >
              <th class="py-3 px-4">施工任务名称</th>
              <th class="py-3 px-4">构件编码</th>
              <th class="py-3 px-4 text-center">计划起止时间</th>
              <th class="py-3 px-4 text-center">实际起止时间</th>
              <th class="py-3 px-4 text-center">关联状态</th>
              <th class="py-3 px-4">备注说明</th>
              <th class="py-3 px-4">填报人</th>
              <th class="py-3 px-4">填报日期</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rec in actualRecords"
              :key="rec.id"
              class="border-b border-outline-2 hover:bg-primary-muted/20 transition-colors"
            >
              <td class="py-3 px-4 font-medium text-foreground">
                {{ rec.taskName }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs font-mono">
                {{ rec.componentCode || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs text-center">
                {{ formatYmd(rec.planStartDate) }} ~ {{ formatYmd(rec.planEndDate) }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs text-center">
                {{ formatYmd(rec.actualStartDate) }} ~
                {{ formatYmd(rec.actualEndDate) }}
              </td>
              <td class="py-3 px-4 text-center">
                <span
                  v-if="getRecordBimCount(rec) > 0"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-body-xs font-medium bg-success-lighter text-success-darker border border-success-lighter"
                >
                  <Check class="w-3 h-3" />
                  已关联 ({{ getRecordBimCount(rec) }}件)
                </span>
                <span
                  v-else
                  class="inline-flex items-center px-2 py-0.5 rounded text-body-xs bg-foundation-page text-foreground-2 border border-outline-2"
                >
                  未关联
                </span>
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs max-w-xs truncate">
                {{ rec.remark || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ rec.reporter || '-' }}
              </td>
              <td class="py-3 px-4 font-semibold text-primary">
                {{ rec.reportDate }}
              </td>
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-1">
                  <!-- 只有进度管理才有关联BIM的操作，点击按钮打开全局唯一的BIM构件选择抽屉 -->
                  <button
                    type="button"
                    :class="[
                      'p-1.5 rounded transition-colors',
                      getRecordBimCount(rec) > 0
                        ? 'text-primary bg-primary/10 border border-primary/30'
                        : 'text-foreground-2 hover:text-primary hover:bg-primary/10'
                    ]"
                    title="关联/查看BIM模型构件"
                    @click="openRowBimDrawer(rec)"
                  >
                    <Box class="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="编辑"
                    @click="openEditActualDialog(rec)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-danger hover:bg-danger/10 transition-colors"
                    title="删除"
                    @click="promptDeleteActual(rec)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Tab 2: 里程碑管理 ── -->
    <div
      v-else-if="activeTab === 'milestone'"
      class="bg-foundation rounded-lg shadow-sm border border-outline-2 overflow-hidden flex flex-col"
    >
      <div
        v-if="isLoadingMilestones"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        正在加载里程碑...
      </div>
      <div
        v-else-if="!milestones.length"
        class="px-4 py-10 text-center text-body-sm text-foreground-2"
      >
        暂无里程碑数据，请点击右上角新增。
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-body-sm border-collapse">
          <thead>
            <tr
              class="border-b border-outline-2 bg-foundation-page/50 text-foreground-2 font-medium"
            >
              <th class="py-3 px-4">里程碑名称</th>
              <th class="py-3 px-4">计划开始时间</th>
              <th class="py-3 px-4">计划完成时间</th>
              <th class="py-3 px-4">实际开始时间</th>
              <th class="py-3 px-4">实际完成时间</th>
              <th class="py-3 px-4">当前状态</th>
              <th class="py-3 px-4">标签类型</th>
              <th class="py-3 px-4">责任人</th>
              <th class="py-3 px-4">备注说明</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in milestones"
              :key="item.id"
              class="border-b border-outline-2 hover:bg-primary-muted/20 transition-colors"
            >
              <td class="py-3 px-4 font-semibold text-foreground">
                {{ item.taskName }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs">
                {{ formatYmd(item.plannedStart) }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs">
                {{ formatYmd(item.plannedEnd) }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs">
                {{ formatYmd(item.actualStart) }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs">
                {{ formatYmd(item.actualEnd) }}
              </td>
              <td class="py-3 px-4">
                <span
                  :class="[
                    'px-2 py-0.5 rounded text-body-xs font-medium',
                    item.status === '按期完成' || item.status === '已完成'
                      ? 'bg-success-lighter text-success-darker'
                      : item.status === '进行中'
                      ? 'bg-primary-muted text-primary'
                      : item.status === '已逾期'
                      ? 'bg-danger-lighter text-danger-darker'
                      : 'bg-foundation-page text-foreground-2 border border-outline-2'
                  ]"
                >
                  {{ item.status }}
                </span>
              </td>
              <td class="py-3 px-4 text-foreground-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span
                    v-if="item.tags?.includes('key')"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-danger-lighter text-danger-darker"
                  >
                    <Star class="w-3 h-3 fill-current" />
                    关键工序
                  </span>
                  <span
                    v-if="item.tags?.includes('milestone')"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary-muted text-primary"
                  >
                    <Flag class="w-3 h-3 fill-current" />
                    里程碑
                  </span>
                  <span
                    v-if="
                      !item.tags?.includes('key') && !item.tags?.includes('milestone')
                    "
                    class="text-body-xs text-foreground-2"
                  >
                    -
                  </span>
                </div>
              </td>
              <td class="py-3 px-4 text-foreground-2">
                {{ item.responsible || '-' }}
              </td>
              <td class="py-3 px-4 text-foreground-2 text-body-xs max-w-xs truncate">
                {{ item.remark || '-' }}
              </td>
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="编辑"
                    @click="openEditMilestoneDialog(item)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded text-foreground-2 hover:text-danger hover:bg-danger/10 transition-colors"
                    title="删除"
                    @click="promptDeleteMilestone(item)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── 弹窗 1: 新增/编辑进度情况 ── -->
    <LayoutDialog
      v-model:open="actualDialogOpen"
      :title="editingActualRecord ? '编辑进度情况' : '新增进度情况'"
      max-width="lg"
    >
      <form class="space-y-4 py-1" @submit.prevent="handleSaveActual">
        <!-- 任务名称 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">
            任务名称
            <span class="text-danger">*</span>
          </div>
          <FormTextInput
            v-model="actualForm.taskName"
            name="actual-taskName"
            placeholder="请输入任务名称"
            color="foundation"
            required
          />
        </div>

        <!-- 构件编码 + 从BIM模型中选择构件 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">构件编码</div>
          <FormTextInput
            v-model="actualForm.componentCode"
            name="actual-componentCode"
            placeholder="请输入构件编码"
            color="foundation"
          />

          <!-- 已选构件标签 -->
          <div
            v-if="actualFormPickedCodes.length > 0"
            class="flex flex-wrap gap-1.5 mt-1"
          >
            <span
              v-for="code in actualFormPickedCodes"
              :key="code"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-body-xs bg-primary/10 text-primary border border-primary/30"
            >
              {{ code }}
              <button
                type="button"
                class="hover:opacity-75"
                @click="removePickedComponent(code)"
              >
                <X class="w-3 h-3" />
              </button>
            </span>
          </div>

          <!-- 只有进度管理才有关联BIM的操作：从BIM模型中选择构件（调用 CommonModelObjectMultiModelSelectDrawer） -->
          <CommonModelObjectMultiModelSelectDrawer
            v-if="actualDialogOpen"
            v-model:selections="actualFormSelections"
            :project-id="projectId"
            @update:selections="onActualFormSelectionsChange"
          >
            <template #trigger="{ open }">
              <button
                type="button"
                class="flex items-center justify-center gap-2 w-full h-9 px-3 rounded-md border border-dashed border-outline-2 text-body-xs text-foreground-2 hover:bg-primary-muted/20 transition-colors"
                @click="open"
              >
                <Box class="w-4 h-4 shrink-0 text-primary" />
                <span>
                  {{
                    actualFormPickedCodes.length > 0
                      ? `已选 ${actualFormPickedCodes.length} 个模型构件`
                      : '从BIM模型中选择构件'
                  }}
                </span>
              </button>
            </template>
          </CommonModelObjectMultiModelSelectDrawer>
        </div>

        <!-- 计划开始时间 + 计划结束时间 -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              计划开始时间
            </div>
            <FormTextInput
              v-model="actualForm.planStartDate"
              name="actual-planStart"
              type="date"
              color="foundation"
            />
          </div>
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              计划结束时间
            </div>
            <FormTextInput
              v-model="actualForm.planEndDate"
              name="actual-planEnd"
              type="date"
              color="foundation"
            />
          </div>
        </div>

        <!-- 实际开始时间 + 实际结束时间 -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              实际开始时间
            </div>
            <FormTextInput
              v-model="actualForm.actualStartDate"
              name="actual-actualStart"
              type="date"
              color="foundation"
            />
          </div>
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              实际结束时间
            </div>
            <FormTextInput
              v-model="actualForm.actualEndDate"
              name="actual-actualEnd"
              type="date"
              color="foundation"
            />
          </div>
        </div>

        <!-- 备注 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">备注</div>
          <FormTextInput
            v-model="actualForm.remark"
            name="actual-remark"
            placeholder="可选"
            color="foundation"
          />
        </div>

        <!-- 上传人 + 上传时间 -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">上传人</div>
            <FormTextInput
              v-model="actualForm.reporter"
              name="actual-reporter"
              placeholder="请输入上传人"
              color="foundation"
            />
          </div>
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">上传时间</div>
            <FormTextInput
              v-model="actualForm.reportDate"
              name="actual-reportDate"
              type="date"
              color="foundation"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-outline-2">
          <FormButton color="outline" type="button" @click="actualDialogOpen = false">
            取消
          </FormButton>
          <FormButton
            color="primary"
            type="submit"
            :disabled="isSavingActual || !actualForm.taskName"
          >
            {{ isSavingActual ? '保存中...' : '保存' }}
          </FormButton>
        </div>
      </form>
    </LayoutDialog>

    <!-- ── 弹窗 2: 新增/编辑里程碑 ── -->
    <LayoutDialog
      v-model:open="milestoneDialogOpen"
      :title="editingMilestone ? '编辑里程碑' : '新增里程碑'"
      max-width="md"
    >
      <form class="space-y-4 py-1" @submit.prevent="handleSaveMilestone">
        <!-- 任务名称 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">
            任务名称
            <span class="text-danger">*</span>
          </div>
          <FormTextInput
            v-model="milestoneForm.taskName"
            name="ms-taskName"
            placeholder="请输入任务名称"
            color="foundation"
            required
          />
        </div>

        <!-- 计划开始时间 + 计划结束时间 -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              计划开始时间
            </div>
            <FormTextInput
              v-model="milestoneForm.plannedStart"
              name="ms-planStart"
              type="date"
              color="foundation"
            />
          </div>
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              计划结束时间
            </div>
            <FormTextInput
              v-model="milestoneForm.plannedEnd"
              name="ms-planEnd"
              type="date"
              color="foundation"
            />
          </div>
        </div>

        <!-- 实际开始时间 + 实际结束时间 -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              实际开始时间
            </div>
            <FormTextInput
              v-model="milestoneForm.actualStart"
              name="ms-actStart"
              type="date"
              color="foundation"
            />
          </div>
          <div class="space-y-1.5">
            <div class="block text-body-xs font-medium text-foreground-2">
              实际结束时间
            </div>
            <FormTextInput
              v-model="milestoneForm.actualEnd"
              name="ms-actEnd"
              type="date"
              color="foundation"
            />
          </div>
        </div>

        <!-- 备注 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">备注</div>
          <FormTextInput
            v-model="milestoneForm.remark"
            name="ms-remark"
            placeholder="可选"
            color="foundation"
          />
        </div>

        <!-- 标签：关键工序 / 里程碑 -->
        <div class="space-y-1.5">
          <div class="block text-body-xs font-medium text-foreground-2">标签</div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-body-xs font-medium transition-colors',
                milestoneForm.isKey
                  ? 'bg-danger-lighter text-danger-darker border-danger/40'
                  : 'bg-foundation-page text-foreground-2 border-outline-2 hover:text-foreground'
              ]"
              @click="milestoneForm.isKey = !milestoneForm.isKey"
            >
              <Star :class="['w-4 h-4', milestoneForm.isKey ? 'fill-current' : '']" />
              <span>关键工序</span>
            </button>
            <button
              type="button"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-body-xs font-medium transition-colors',
                milestoneForm.isMilestone
                  ? 'bg-primary-muted text-primary border-primary/40'
                  : 'bg-foundation-page text-foreground-2 border-outline-2 hover:text-foreground'
              ]"
              @click="milestoneForm.isMilestone = !milestoneForm.isMilestone"
            >
              <Flag
                :class="['w-4 h-4', milestoneForm.isMilestone ? 'fill-current' : '']"
              />
              <span>里程碑</span>
            </button>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-outline-2">
          <FormButton
            color="outline"
            type="button"
            @click="milestoneDialogOpen = false"
          >
            取消
          </FormButton>
          <FormButton
            color="primary"
            type="submit"
            :disabled="isSavingMilestone || !milestoneForm.taskName"
          >
            {{ isSavingMilestone ? '保存中...' : '保存' }}
          </FormButton>
        </div>
      </form>
    </LayoutDialog>

    <!-- ── 列表行操作栏共用 BIM 关联抽屉（按需挂载，避免列表循环请求） ── -->
    <CommonModelObjectMultiModelSelectDrawer
      v-if="rowBimDrawerOpen && activeRowForBim"
      v-model:open="rowBimDrawerOpen"
      v-model:model_ids="rowBimDraftModelIds"
      v-model:selections="rowBimDraftSelections"
      :project-id="projectId"
      @update:open="onRowBimDrawerOpenChange"
    />

    <!-- ── 二次确认删除弹窗 (CommonConfirmDialog) ── -->
    <CommonConfirmDialog
      v-model:open="showDeleteConfirm"
      :title="deleteConfirmTitle"
      :text="deleteConfirmText"
      confirm-button-text="确认删除"
      cancel-button-text="取消"
      confirm-button-color="danger"
      @confirm="executeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import {
  Plus,
  Search,
  Box,
  Pencil,
  Trash2,
  Star,
  Flag,
  Check,
  X
} from 'lucide-vue-next'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { CommonConfirmDialog } from '#components'
import {
  listProgressV2ActualRecords,
  createProgressV2ActualRecord,
  updateProgressV2ActualRecord,
  deleteProgressV2ActualRecord,
  listProgressV2Milestones,
  createProgressV2Milestone,
  updateProgressV2Milestone,
  deleteProgressV2Milestone,
  type ProgressV2ActualRecord,
  type ProgressV2Milestone
} from '~/lib/projects/api/progress-v2'

const route = useRoute()
const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const activeTab = ref<'actual' | 'milestone'>('actual')

// ── 通用工具函数 ──
const formatYmd = (value?: string | null) => {
  if (!value) return '-'
  return value.slice(0, 10)
}

type ModelObjectGroup = {
  modelId: string
  applicationIds?: string[]
}

const getRecordBimCount = (rec: ProgressV2ActualRecord) => {
  if (!rec.BIM) return 0
  try {
    const raw = rec.BIM
    const list = (
      Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : []
    ) as ModelObjectGroup[]
    if (!Array.isArray(list)) return 0
    return list.reduce(
      (total: number, g: ModelObjectGroup) => total + (g.applicationIds?.length || 0),
      0
    )
  } catch {
    return 0
  }
}

const getRecordModelIds = (rec: ProgressV2ActualRecord): string[] => {
  if (!rec.BIM) return []
  try {
    const raw = rec.BIM
    const list = (
      Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : []
    ) as ModelObjectGroup[]
    if (!Array.isArray(list)) return []
    return Array.from(
      new Set(list.map((g: ModelObjectGroup) => g.modelId).filter(Boolean))
    )
  } catch {
    return []
  }
}

const getRecordSelections = (
  rec: ProgressV2ActualRecord
): Array<{ modelId: string; applicationIds: string[] }> => {
  if (!rec.BIM) return []
  try {
    const raw = rec.BIM
    const list = (
      Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : []
    ) as Array<{ modelId: string; applicationIds: string[] }>
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

// ── 列表行级 BIM 抽屉控制（单例按需挂载） ──
const activeRowForBim = ref<ProgressV2ActualRecord | null>(null)
const rowBimDrawerOpen = ref(false)
const rowBimDraftSelections = ref<Array<{ modelId: string; applicationIds: string[] }>>(
  []
)
const rowBimDraftModelIds = ref<string[]>([])

const openRowBimDrawer = (rec: ProgressV2ActualRecord) => {
  activeRowForBim.value = rec
  rowBimDraftSelections.value = JSON.parse(JSON.stringify(getRecordSelections(rec)))
  rowBimDraftModelIds.value = [...getRecordModelIds(rec)]
  rowBimDrawerOpen.value = true
}

const onRowBimDrawerOpenChange = async (isOpen: boolean) => {
  // 当用户在抽屉中点击确定完成选择（Drawer 关闭）时执行保存
  if (!isOpen && activeRowForBim.value && projectId.value) {
    const rec = activeRowForBim.value
    const newSelections = rowBimDraftSelections.value
    const allCodes = newSelections.flatMap((g) => g.applicationIds || [])
    try {
      await updateProgressV2ActualRecord({
        projectId: projectId.value,
        recordId: rec.id,
        apiOrigin,
        data: {
          BIM: newSelections,
          componentCode: allCodes.length > 0 ? allCodes.join(', ') : rec.componentCode
        }
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '关联已更新',
        description: `已关联 ${allCodes.length} 个模型构件`
      })
      await loadActualRecords()
    } catch (err: unknown) {
      triggerNotification({
        type: ToastNotificationType.Danger,
        title: '更新BIM关联失败',
        description: (err as Error)?.message || '操作失败'
      })
    } finally {
      activeRowForBim.value = null
    }
  }
}

// ── 进度管理（实际填报） ──
const isLoadingActual = ref(false)
const actualRecords = ref<ProgressV2ActualRecord[]>([])
const actualSearchQuery = ref('')
const actualDialogOpen = ref(false)
const editingActualRecord = ref<ProgressV2ActualRecord | null>(null)
const isSavingActual = ref(false)

const actualForm = reactive({
  taskName: '',
  componentCode: '',
  planStartDate: '',
  planEndDate: '',
  actualStartDate: new Date().toISOString().slice(0, 10),
  actualEndDate: new Date().toISOString().slice(0, 10),
  reporter: '',
  reportDate: new Date().toISOString().slice(0, 10),
  remark: ''
})

const actualFormSelections = ref<Array<{ modelId: string; applicationIds: string[] }>>(
  []
)

const actualFormPickedCodes = computed(() => {
  return actualFormSelections.value.flatMap((g) => g.applicationIds || [])
})

const onActualFormSelectionsChange = (
  newSelections: Array<{ modelId: string; applicationIds: string[] }>
) => {
  actualFormSelections.value = newSelections || []
  const codes = actualFormPickedCodes.value
  if (codes.length > 0) {
    actualForm.componentCode = codes.join(', ')
  }
}

const removePickedComponent = (code: string) => {
  actualFormSelections.value = actualFormSelections.value
    .map((g) => ({
      ...g,
      applicationIds: (g.applicationIds || []).filter((id) => id !== code)
    }))
    .filter((g) => g.applicationIds.length > 0)

  const remaining = actualFormPickedCodes.value
  actualForm.componentCode = remaining.join(', ')
}

const loadActualRecords = async () => {
  if (!projectId.value) return
  isLoadingActual.value = true
  try {
    actualRecords.value = await listProgressV2ActualRecords({
      projectId: projectId.value,
      apiOrigin,
      search: actualSearchQuery.value
    })
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载实际进度失败',
      description: (err as Error)?.message || '加载失败'
    })
  } finally {
    isLoadingActual.value = false
  }
}

let actualSearchTimer: ReturnType<typeof setTimeout> | null = null
const debounceLoadActual = () => {
  if (actualSearchTimer) clearTimeout(actualSearchTimer)
  actualSearchTimer = setTimeout(loadActualRecords, 300)
}

const openCreateActualDialog = () => {
  editingActualRecord.value = null
  actualForm.taskName = ''
  actualForm.componentCode = ''
  actualForm.planStartDate = ''
  actualForm.planEndDate = ''
  actualForm.actualStartDate = new Date().toISOString().slice(0, 10)
  actualForm.actualEndDate = new Date().toISOString().slice(0, 10)
  actualForm.reporter = ''
  actualForm.reportDate = new Date().toISOString().slice(0, 10)
  actualForm.remark = ''
  actualFormSelections.value = []
  actualDialogOpen.value = true
}

const openEditActualDialog = (rec: ProgressV2ActualRecord) => {
  editingActualRecord.value = rec
  actualForm.taskName = rec.taskName
  actualForm.componentCode = rec.componentCode || ''
  actualForm.planStartDate = rec.planStartDate ? rec.planStartDate.slice(0, 10) : ''
  actualForm.planEndDate = rec.planEndDate ? rec.planEndDate.slice(0, 10) : ''
  actualForm.actualStartDate = rec.actualStartDate
    ? rec.actualStartDate.slice(0, 10)
    : ''
  actualForm.actualEndDate = rec.actualEndDate ? rec.actualEndDate.slice(0, 10) : ''
  actualForm.reporter = rec.reporter || ''
  actualForm.reportDate = rec.reportDate
    ? rec.reportDate.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  actualForm.remark = rec.remark || ''
  actualFormSelections.value = getRecordSelections(rec)
  actualDialogOpen.value = true
}

const handleSaveActual = async () => {
  if (!projectId.value) return
  isSavingActual.value = true
  try {
    const saveData = {
      taskName: actualForm.taskName,
      componentCode: actualForm.componentCode || null,
      planStartDate: actualForm.planStartDate || null,
      planEndDate: actualForm.planEndDate || null,
      actualStartDate: actualForm.actualStartDate || null,
      actualEndDate: actualForm.actualEndDate || null,
      reporter: actualForm.reporter || null,
      reportDate: actualForm.reportDate,
      remark: actualForm.remark || null,
      BIM: actualFormSelections.value
    }

    if (editingActualRecord.value) {
      await updateProgressV2ActualRecord({
        projectId: projectId.value,
        recordId: editingActualRecord.value.id,
        apiOrigin,
        data: saveData
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '进度情况已更新'
      })
    } else {
      await createProgressV2ActualRecord({
        projectId: projectId.value,
        apiOrigin,
        data: saveData
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '创建成功',
        description: '已新增进度情况'
      })
    }
    actualDialogOpen.value = false
    await loadActualRecords()
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: (err as Error)?.message || '保存失败'
    })
  } finally {
    isSavingActual.value = false
  }
}

// ── 里程碑管理 ──
const isLoadingMilestones = ref(false)
const milestones = ref<ProgressV2Milestone[]>([])
const milestoneSearchQuery = ref('')
const milestoneDialogOpen = ref(false)
const editingMilestone = ref<ProgressV2Milestone | null>(null)
const isSavingMilestone = ref(false)

const milestoneForm = reactive({
  taskName: '',
  plannedStart: '',
  plannedEnd: '',
  actualStart: '',
  actualEnd: '',
  remark: '',
  isKey: false,
  isMilestone: false
})

const loadMilestones = async () => {
  if (!projectId.value) return
  isLoadingMilestones.value = true
  try {
    milestones.value = await listProgressV2Milestones({
      projectId: projectId.value,
      apiOrigin,
      search: milestoneSearchQuery.value
    })
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载里程碑失败',
      description: (err as Error)?.message || '加载失败'
    })
  } finally {
    isLoadingMilestones.value = false
  }
}

let milestoneSearchTimer: ReturnType<typeof setTimeout> | null = null
const debounceLoadMilestones = () => {
  if (milestoneSearchTimer) clearTimeout(milestoneSearchTimer)
  milestoneSearchTimer = setTimeout(loadMilestones, 300)
}

const openCreateMilestoneDialog = () => {
  editingMilestone.value = null
  milestoneForm.taskName = ''
  milestoneForm.plannedStart = ''
  milestoneForm.plannedEnd = ''
  milestoneForm.actualStart = ''
  milestoneForm.actualEnd = ''
  milestoneForm.remark = ''
  milestoneForm.isKey = false
  milestoneForm.isMilestone = true
  milestoneDialogOpen.value = true
}

const openEditMilestoneDialog = (m: ProgressV2Milestone) => {
  editingMilestone.value = m
  milestoneForm.taskName = m.taskName
  milestoneForm.plannedStart = m.plannedStart ? m.plannedStart.slice(0, 10) : ''
  milestoneForm.plannedEnd = m.plannedEnd ? m.plannedEnd.slice(0, 10) : ''
  milestoneForm.actualStart = m.actualStart ? m.actualStart.slice(0, 10) : ''
  milestoneForm.actualEnd = m.actualEnd ? m.actualEnd.slice(0, 10) : ''
  milestoneForm.remark = m.remark || ''
  const tagList = Array.isArray(m.tags)
    ? m.tags
    : typeof m.tags === 'string'
    ? JSON.parse(m.tags || '[]')
    : []
  milestoneForm.isKey = tagList.includes('key')
  milestoneForm.isMilestone = tagList.includes('milestone')
  milestoneDialogOpen.value = true
}

const handleSaveMilestone = async () => {
  if (!projectId.value) return
  isSavingMilestone.value = true
  try {
    const tags: string[] = []
    if (milestoneForm.isKey) tags.push('key')
    if (milestoneForm.isMilestone) tags.push('milestone')

    const saveData = {
      taskName: milestoneForm.taskName,
      plannedStart: milestoneForm.plannedStart || null,
      plannedEnd: milestoneForm.plannedEnd || null,
      actualStart: milestoneForm.actualStart || null,
      actualEnd: milestoneForm.actualEnd || null,
      status: milestoneForm.actualEnd ? '已完成' : '进行中',
      milestoneType: 'phase',
      responsible: null,
      remark: milestoneForm.remark || null,
      tags
    }

    if (editingMilestone.value) {
      await updateProgressV2Milestone({
        projectId: projectId.value,
        milestoneId: editingMilestone.value.id,
        apiOrigin,
        data: saveData
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '更新成功',
        description: '里程碑信息已更新'
      })
    } else {
      await createProgressV2Milestone({
        projectId: projectId.value,
        apiOrigin,
        data: saveData
      })
      triggerNotification({
        type: ToastNotificationType.Success,
        title: '创建成功',
        description: '已新建里程碑'
      })
    }
    milestoneDialogOpen.value = false
    await loadMilestones()
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: (err as Error)?.message || '保存失败'
    })
  } finally {
    isSavingMilestone.value = false
  }
}

// ── 删除二次确认 ──
const showDeleteConfirm = ref(false)
const deleteConfirmTitle = ref('确认删除')
const deleteConfirmText = ref('确定要删除该项吗？此操作不可逆。')
let pendingDeleteAction: (() => Promise<void>) | null = null

const promptDeleteActual = (rec: ProgressV2ActualRecord) => {
  deleteConfirmTitle.value = '删除进度情况'
  deleteConfirmText.value = `确定要删除「${rec.taskName}」的进度记录吗？`
  pendingDeleteAction = async () => {
    await deleteProgressV2ActualRecord({
      projectId: projectId.value,
      recordId: rec.id,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '进度记录已删除'
    })
    await loadActualRecords()
  }
  showDeleteConfirm.value = true
}

const promptDeleteMilestone = (m: ProgressV2Milestone) => {
  deleteConfirmTitle.value = '删除里程碑'
  deleteConfirmText.value = `确定要删除「${m.taskName}」里程碑吗？`
  pendingDeleteAction = async () => {
    await deleteProgressV2Milestone({
      projectId: projectId.value,
      milestoneId: m.id,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '删除成功',
      description: '里程碑已删除'
    })
    await loadMilestones()
  }
  showDeleteConfirm.value = true
}

const executeDelete = async () => {
  if (!pendingDeleteAction) return
  try {
    await pendingDeleteAction()
  } catch (err: unknown) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除失败',
      description: (err as Error)?.message || '删除失败'
    })
  } finally {
    pendingDeleteAction = null
    showDeleteConfirm.value = false
  }
}

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'actual') loadActualRecords()
    else if (tab === 'milestone') loadMilestones()
  }
)

watch(
  () => actualSearchQuery.value,
  () => {
    debounceLoadActual()
  }
)

watch(
  () => milestoneSearchQuery.value,
  () => {
    debounceLoadMilestones()
  }
)

onMounted(() => {
  loadActualRecords()
})
</script>
