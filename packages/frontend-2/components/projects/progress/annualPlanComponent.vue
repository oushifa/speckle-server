<template>
  <div class="flex flex-col gap-4 text-foreground">
    <!-- Header with Navigation Tabs -->
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
    </div>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-2"
          />
          <input
            v-model="searchKeyword"
            type="text"
            aria-label="搜索年份、名称、编制人"
            placeholder="搜索年份、名称、编制人..."
            class="h-8 w-64 rounded-md border border-outline-3 bg-foundation pl-8 pr-3 text-body-sm outline-none transition focus:border-primary"
            @input="handleSearchInput"
          />
        </div>
        <FormButton v-if="searchKeyword" size="sm" color="subtle" @click="clearSearch">
          清除筛选
        </FormButton>
      </div>

      <FormButton size="sm" color="primary" :icon-left="Plus" @click="openCreateDialog">
        + 新增年度计划
      </FormButton>
    </div>

    <!-- Annual Plan List -->
    <div
      v-if="isLoading"
      class="rounded-lg border border-outline-2 bg-foundation py-12 text-center text-body-sm text-foreground-2"
    >
      正在加载年度计划...
    </div>
    <div
      v-else-if="!plans.length"
      class="rounded-lg border border-outline-2 bg-foundation py-12 text-center text-body-sm text-foreground-2"
    >
      {{
        searchKeyword
          ? '没有匹配的年度计划'
          : '暂无年度计划，点击「+ 新增年度计划」创建'
      }}
    </div>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-outline-2 bg-foundation"
    >
      <div class="min-w-[900px]">
        <div
          class="grid grid-cols-[110px_1fr_120px_120px_110px_140px_120px] gap-3 border-b border-outline-2 bg-foundation-page px-4 py-3 text-body-xs font-semibold text-foreground-2 select-none"
        >
          <div>年份</div>
          <div>计划名称</div>
          <div class="text-center">开始日期</div>
          <div class="text-center">结束日期</div>
          <div class="text-center">编制人</div>
          <div class="text-center">创建时间</div>
          <div class="text-center">操作</div>
        </div>

        <div class="divide-y divide-outline-2">
          <div
            v-for="plan in plans"
            :key="plan.id"
            role="button"
            tabindex="0"
            class="grid cursor-pointer grid-cols-[110px_1fr_120px_120px_110px_140px_120px] items-center gap-3 px-4 py-3 transition-colors hover:bg-foundation-2/30"
            @click="openDetail(plan)"
            @keydown.enter="openDetail(plan)"
          >
            <div>
              <span
                class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                title="进入年度计划详情"
              >
                {{ plan.year }}
                <ChevronRight class="h-3 w-3" />
              </span>
            </div>
            <div class="min-w-0">
              <span
                class="truncate font-medium text-body-sm hover:text-primary hover:underline"
                :title="plan.name"
              >
                {{ plan.name }}
              </span>
              <span
                v-if="plan.remark"
                class="ml-2 hidden truncate text-body-3xs text-foreground-2 lg:inline"
                :title="plan.remark"
              >
                {{ plan.remark }}
              </span>
            </div>
            <div class="text-center text-body-sm text-foreground-2">
              {{ formatDate(plan.startDate) }}
            </div>
            <div class="text-center text-body-sm text-foreground-2">
              {{ formatDate(plan.endDate) }}
            </div>
            <div class="truncate text-center text-body-sm">
              {{ plan.preparedBy || '-' }}
            </div>
            <div class="text-center text-body-xs text-foreground-2">
              {{ formatDateTime(plan.createdAt) }}
            </div>
            <div class="flex items-center justify-center gap-1.5" @click.stop>
              <button
                type="button"
                class="rounded p-1.5 text-foreground-2 transition hover:bg-primary-muted hover:text-primary"
                title="查看详情"
                @click="openDetail(plan)"
              >
                <Eye class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded p-1.5 text-foreground-2 transition hover:bg-primary-muted hover:text-primary"
                title="编辑"
                @click="openEditDialog(plan)"
              >
                <Pencil class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded p-1.5 text-foreground-2 transition hover:bg-danger-lighter hover:text-danger"
                title="删除"
                @click="openDeleteConfirm(plan)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <AnnualPlanDialog
      v-model:open="isDialogOpen"
      :project-id="projectId"
      :initial-record="editingPlan"
      @save="handleSavePlan"
    />

    <!-- Delete Confirm Dialog -->
    <CommonConfirmDialog
      v-model:open="confirmDialogOpen"
      title="确认删除年度计划"
      :text="confirmDialogText"
      confirm-text="确认删除"
      :loading="isDeleting"
      @confirm="executeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { FormButton } from '@speckle/ui-components'
import { ChevronRight, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-vue-next'
import { CommonConfirmDialog } from '#components'
import AnnualPlanDialog from './AnnualPlanDialog.vue'
import {
  deleteProgressAnnualPlan,
  createProgressAnnualPlan,
  updateProgressAnnualPlan,
  getProgressAnnualPlans,
  type AnnualPlan,
  type AnnualPlanInput
} from '~~/lib/projects/api/progress'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

const route = useRoute()
const router = useRouter()
const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const plans = ref<AnnualPlan[]>([])
const searchKeyword = ref('')
const isLoading = ref(false)
const isDialogOpen = ref(false)
const editingPlan = ref<AnnualPlan | null>(null)

// 二次确认弹窗 State
const confirmDialogOpen = ref(false)
const confirmDialogText = ref('')
const isDeleting = ref(false)
const planToDelete = ref<AnnualPlan | null>(null)

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const navigateToSchedule = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/schedule`)
  }
}

const navigateToMonthly = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/monthly`)
  }
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('zh-CN', { hour12: false })
}

const loadPlans = async () => {
  if (!projectId.value) return
  isLoading.value = true
  try {
    plans.value = await getProgressAnnualPlans({
      projectId: projectId.value,
      apiOrigin,
      search: searchKeyword.value
    })
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载年度计划失败',
      description: error instanceof Error ? error.message : '加载失败，请重试'
    })
  } finally {
    isLoading.value = false
  }
}

const handleSearchInput = () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    loadPlans()
  }, 300)
}

const clearSearch = () => {
  searchKeyword.value = ''
  loadPlans()
}

const openDetail = (plan: AnnualPlan) => {
  if (!projectId.value) return
  router.push(`/projects/${projectId.value}/progress/annual/${plan.id}`)
}

const openCreateDialog = () => {
  editingPlan.value = null
  isDialogOpen.value = true
}

const openEditDialog = (plan: AnnualPlan) => {
  editingPlan.value = plan
  isDialogOpen.value = true
}

const handleSavePlan = async (payload: AnnualPlanInput) => {
  try {
    if (editingPlan.value) {
      await updateProgressAnnualPlan({
        projectId: projectId.value,
        planId: editingPlan.value.id,
        apiOrigin,
        input: payload
      })
      triggerNotification({
        type: ToastNotificationType.Info,
        title: '更新成功',
        description: `已保存年度计划「${payload.name}」的修改。`
      })
    } else {
      await createProgressAnnualPlan({
        projectId: projectId.value,
        apiOrigin,
        input: payload
      })
      triggerNotification({
        type: ToastNotificationType.Info,
        title: '新增成功',
        description: `已创建 ${payload.year} 年度计划「${payload.name}」。`
      })
    }
    isDialogOpen.value = false
    editingPlan.value = null
    await loadPlans()
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '保存失败',
      description: error instanceof Error ? error.message : '保存失败，请检查数据。'
    })
  }
}

const openDeleteConfirm = (plan: AnnualPlan) => {
  planToDelete.value = plan
  confirmDialogText.value = `你确定要删除 ${plan.year} 年度计划「${plan.name}」吗？该计划下的任务树与上传文件记录将一并删除，此操作不可撤销。`
  confirmDialogOpen.value = true
}

const executeDelete = async () => {
  if (!planToDelete.value) return
  isDeleting.value = true
  try {
    await deleteProgressAnnualPlan({
      projectId: projectId.value,
      planId: planToDelete.value.id,
      apiOrigin
    })
    triggerNotification({
      type: ToastNotificationType.Info,
      title: '删除成功',
      description: '年度计划已删除。'
    })
    await loadPlans()
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除失败',
      description: error instanceof Error ? error.message : '删除失败，请重试'
    })
  } finally {
    isDeleting.value = false
    confirmDialogOpen.value = false
    planToDelete.value = null
  }
}

watch(projectId, () => {
  plans.value = []
  loadPlans()
})

onMounted(() => {
  loadPlans()
})
</script>
