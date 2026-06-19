<template>
  <div class="flex flex-col h-full space-y-4">
    <!-- 面包屑导航 Portal -->
    <Portal to="current-page">
      <div class="flex items-center space-x-1.5 text-body-sm text-foreground-2">
        <span>项目管理</span>
        <span>/</span>
        <span>验工计价</span>
        <span>/</span>
        <span class="text-foreground">安全文明措施费</span>
      </div>
    </Portal>

    <!-- 顶部项目页眉 -->
    <div class="flex items-center justify-between mt-3">
      <h1 class="text-heading-lg text-foreground font-bold">安全文明措施费</h1>
      <div class="flex items-center space-x-2 text-sm">
        <FormTextInput
          v-model="searchQuery"
          name="safety-measure-search"
          placeholder="搜索措施费编码/施工单位"
          show-clear
          class="w-72 text-sm"
        >
          <template #input-right>
            <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <MagnifyingGlassIcon class="h-5 w-5 text-foreground-2" />
            </div>
          </template>
        </FormTextInput>
        <FormButton :icon-left="PlusIcon" color="primary" @click="openCreateDialog">
          新增
        </FormButton>
      </div>
    </div>

    <!-- 列表展示区域 -->
    <div class="flex-grow overflow-hidden bg-foundation rounded-lg border border-outline-3 flex flex-col">
      <LayoutTable
        :columns="columns"
        :items="tableItems"
        class="h-full"
        empty-message="暂无安全文明措施费记录"
      >
        <template #index="{ item }">
          <span class="text-sm text-foreground-2 font-mono">{{ tableItems.indexOf(item) + startItem }}</span>
        </template>
        <template #code="{ item }">
          <NuxtLink
            :to="`/projects/${projectId}/work-valuation/safety-measure/${item.id}`"
            class="text-sm font-medium text-primary hover:underline font-mono"
          >
            {{ item.code }}
          </NuxtLink>
        </template>
        <template #unit="{ item }">
          <span class="text-sm text-foreground">{{ item.unit || '-' }}</span>
        </template>
        <template #roundName="{ item }">
          <span class="text-sm text-foreground">
            {{ item.roundName ? `第${item.roundName}期` : '-' }}
          </span>
        </template>
        <template #baseDate="{ item }">
          <span class="text-sm text-foreground font-mono">
            {{ dayjs(Number(item.baseDate)).format('YYYY-MM') }}
          </span>
        </template>
        <template #totalAmount="{ item }">
          <span class="text-sm text-foreground font-mono font-medium">
            {{ formatMoney(item.totalAmount) }}
          </span>
        </template>
        <template #cumulativeAmount="{ item }">
          <span class="text-sm text-foreground font-mono font-medium">
            {{ formatMoney(item.cumulativeAmount) }}
          </span>
        </template>
        <template #status="{ item }">
          <CommonBadge
            :color-classes="getStatusColor(item.approveStatus)"
            class="text-sm font-medium"
            rounded
          >
            {{ getStatusText(item.approveStatus) }}
          </CommonBadge>
        </template>
        <template #currentApprovers="{ item }">
          <span class="text-sm text-foreground">
            {{ item.currentStepApprovers?.join(', ') || '-' }}
          </span>
        </template>
        <template #actions="{ item }">
          <div class="flex items-center justify-end gap-1.5 text-sm">
            <NuxtLink
              :to="`/projects/${projectId}/work-valuation/safety-measure/${item.id}`"
              class="rounded p-1 text-primary transition-colors hover:text-primary-focus"
              title="查看详情"
            >
              <EyeIcon class="h-4 w-4" />
            </NuxtLink>
            <NuxtLink
              v-if="item.approveStatus === 'START'"
              :to="`/projects/${projectId}/work-valuation/safety-measure/${item.id}?mode=edit`"
              class="rounded p-1 text-primary transition-colors hover:text-primary-focus"
              title="编辑"
            >
              <PencilSquareIcon class="h-4 w-4" />
            </NuxtLink>
            <button
              v-if="item.approveStatus === 'START'"
              class="rounded p-1 text-success transition-colors hover:text-success-darker"
              title="送审"
              @click="triggerSubmitItem(item)"
            >
              <PaperAirplaneIcon class="h-4 w-4" />
            </button>
            <button
              v-if="item.approveStatus === 'START'"
              class="rounded p-1 text-danger transition-colors hover:text-danger-darker"
              title="删除"
              @click="deleteItem(item)"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </template>
      </LayoutTable>

      <!-- 分页控制 -->
      <div class="flex items-center justify-between border-t border-outline-3 bg-foundation p-4 text-[13px] leading-5">
        <div class="text-[13px] leading-5 text-foreground-2">
          每页显示
          <label for="safety-measure-page-size" class="sr-only">每页显示条数</label>
          <select
            id="safety-measure-page-size"
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

    <!-- 新增单据弹窗 -->
    <LayoutDialog
      v-model:open="createDialogOpen"
      max-width="xl"
      prevent-close-on-click-outside
      :buttons="createDialogButtons"
    >
      <template #header>新建安全文明措施费计量单</template>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormTextInput
            v-model="createForm.roundName"
            name="round-name"
            label="期数"
            show-label
            show-required
            placeholder="如：1"
          />
          <FormTextInput
            v-model="createForm.baseDate"
            name="base-date"
            label="选择年月"
            type="month"
            show-label
            show-required
          />
          <FormTextInput
            v-model="createForm.startDate"
            name="start-date"
            label="开始时间"
            type="date"
            show-label
            show-required
          />
          <FormTextInput
            v-model="createForm.endDate"
            name="end-date"
            label="结束时间"
            type="date"
            show-label
            show-required
          />
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">选择分部工程 * (展开清单多选)</label>
            <BoqTreeSelect
              v-model="createForm.boqSectionIds"
              :project-id="projectId"
              multiple
              leaf="section"
              placeholder="点击展开清单并多选分部工程"
            />
          </div>
        </div>
        <div v-if="createError" class="text-body-sm text-danger mt-2">
          {{ createError }}
        </div>
      </div>
    </LayoutDialog>

    <!-- 送审二次确认弹窗 -->
    <LayoutDialog
      v-model:open="submitConfirmOpen"
      max-width="lg"
      :buttons="submitConfirmButtons"
    >
      <template #header>送审安全文明措施费计量单</template>
      <div v-if="submitTargetItem" class="space-y-4 text-sm">
        <div class="text-foreground-2">
          请确认本次送审将使用当前已启用的安全文明措施费审批流程。
          <p class="mt-2 font-semibold text-foreground">
            单据编码：<span class="font-mono">{{ submitTargetItem.code }}</span>
          </p>
        </div>
        <div class="rounded-lg border border-outline-3 bg-foundation p-3">
          <div v-if="submitFlowLoading" class="text-foreground-2">
            正在读取当前已启用的流程配置...
          </div>
          <div v-else-if="activeSubmitFlow" class="space-y-2">
            <div class="font-medium text-foreground">
              流程名称：{{ activeSubmitFlow.name }}
              <span class="ml-2 text-foreground-2">V{{ activeSubmitFlow.version }}</span>
            </div>
            <div class="text-foreground-2">
              审批节点：{{ activeSubmitFlow.steps.map((s: any) => s.role).join(' -> ') }}
            </div>
          </div>
          <div v-else class="text-danger">
            未找到启用的【安全文明措施费】审批流程，请去项目设置中创建并启用。
          </div>
        </div>
        <FormTextArea
          v-model="submitRemark"
          label="送审说明"
          placeholder="请输入送审说明(选填)"
          name="remark"
          show-label
        />
      </div>
    </LayoutDialog>

    <!-- 删除确认弹窗 -->
    <CommonConfirmDialog
      v-model:open="deleteConfirmOpen"
      title="确认删除计量单吗？"
      text="确认删除该安全文明措施费计量单吗？此操作不可撤销。"
      confirm-text="确认删除"
      @confirm="confirmDeleteItem"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Portal } from 'portal-vue'
import dayjs from 'dayjs'
import { useDebounceFn } from '@vueuse/core'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PencilSquareIcon,
  PaperAirplaneIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'
import BoqTreeSelect from '~/components/common/checklist/BoqTreeSelect.vue'
import {
  LayoutTable,
  FormTextInput,
  FormTextArea,
  FormButton,
  LayoutDialog,
  CommonBadge
} from '@speckle/ui-components'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'

const route = useRoute()
const projectId = computed(() => route.params.id as string)

const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

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
  { id: 'index', header: '序号', classes: 'col-span-0.5 font-mono' },
  { id: 'code', header: '单据编码', classes: 'col-span-2' },
  { id: 'unit', header: '施工单位', classes: 'col-span-2' },
  { id: 'roundName', header: '期数', classes: 'col-span-1' },
  { id: 'baseDate', header: '基准年月', classes: 'col-span-1 font-mono' },
  { id: 'totalAmount', header: '本期金额(元)', classes: 'col-span-1.5 text-right pr-4 font-mono' },
  { id: 'cumulativeAmount', header: '累计金额(元)', classes: 'col-span-1.5 text-right pr-4 font-mono' },
  { id: 'status', header: '审核状态', classes: 'col-span-1' },
  { id: 'currentApprovers', header: '当前负责人', classes: 'col-span-1.5' },
  { id: 'actions', header: '操作', classes: 'col-span-1 text-right text-sm' }
]

const tableItems = ref<any[]>([])
const totalItems = ref(0)
const nextCursor = ref<string | null>(null)
const listLoading = ref(false)

const loadList = async () => {
  if (!projectId.value) return
  listLoading.value = true
  try {
    const res: any = await $fetch(
      `${apiOrigin}/api/v1/projects/${projectId.value}/safety-measures`,
      {
        params: {
          search: debouncedSearchQuery.value || '',
          cursor: currentCursor.value || '',
          limit: pageSize.value
        }
      }
    )
    tableItems.value = res.items || []
    nextCursor.value = res.cursor || null
    totalItems.value = res.totalCount || 0
  } catch (err) {
    console.error('加载安全文明措施费列表失败', err)
  } finally {
    listLoading.value = false
  }
}

watch(
  [projectId, debouncedSearchQuery, pageSize, currentCursor],
  () => {
    loadList()
  },
  { immediate: true }
)

watch([projectId, debouncedSearchQuery, pageSize], () => {
  currentPage.value = 1
  pageCursors.value = { 1: null }
})

watch(
  () => createForm.value.roundName,
  (newVal) => {
    if (newVal) {
      createForm.value.roundName = String(newVal).replace(/\D/g, '')
    }
  }
)

const totalPages = computed(() => Math.ceil(totalItems.value / Number(pageSize.value || 1)))
const startItem = computed(() => totalItems.value === 0 ? 0 : (currentPage.value - 1) * Number(pageSize.value) + 1)
const endItem = computed(() => Math.min(currentPage.value * Number(pageSize.value), totalItems.value))

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

// 弹窗状态
const createDialogOpen = ref(false)
const createError = ref('')
const createForm = ref({
  roundName: '',
  baseDate: dayjs().format('YYYY-MM'),
  startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
  endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
  boqSectionIds: [] as string[]
})

const openCreateDialog = () => {
  createError.value = ''
  createForm.value = {
    roundName: '',
    baseDate: dayjs().format('YYYY-MM'),
    startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
    boqSectionIds: []
  }
  createDialogOpen.value = true
}

const createDialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => { createDialogOpen.value = false }
  },
  {
    text: '创建',
    props: { color: 'primary' },
    onClick: handleCreate
  }
])

const handleCreate = async () => {
  createError.value = ''
  if (!createForm.value.roundName.trim()) {
    createError.value = '期数不能为空'
    return
  }
  if (!createForm.value.baseDate) {
    createError.value = '请选择年月'
    return
  }
  if (!createForm.value.startDate || !createForm.value.endDate) {
    createError.value = '请选择计量时间段'
    return
  }
  if (createForm.value.boqSectionIds.length === 0) {
    createError.value = '请至少选择一个分部工程'
    return
  }

  try {
    const payload = {
      roundName: createForm.value.roundName.trim(),
      baseDate: dayjs(createForm.value.baseDate).valueOf(),
      startDate: dayjs(createForm.value.startDate).valueOf(),
      endDate: dayjs(createForm.value.endDate).valueOf(),
      boqSectionIds: createForm.value.boqSectionIds
    }
    const created: any = await $fetch(`${apiOrigin}/api/v1/projects/${projectId.value}/safety-measures`, {
      method: 'POST',
      body: payload
    })
    triggerNotification({
      title: '创建成功',
      description: `成功创建安全文明措施费计量单 ${created.code}`,
      type: ToastNotificationType.Success
    })
    createDialogOpen.value = false
    await loadList()
    navigateTo(`/projects/${projectId.value}/work-valuation/safety-measure/${created.id}?mode=edit`)
  } catch (err: any) {
    createError.value = err.data?.error || err.message || '创建失败，请重试'
  }
}

// 送审流程
const submitConfirmOpen = ref(false)
const submitTargetItem = ref<any>(null)
const submitRemark = ref('')
const submitFlowLoading = ref(false)
const activeSubmitFlow = ref<any>(null)

const triggerSubmitItem = async (item: any) => {
  submitTargetItem.value = item
  submitRemark.value = ''
  submitConfirmOpen.value = true
  submitFlowLoading.value = true
  activeSubmitFlow.value = null
  try {
    const list = await $fetch<any[]>(`${apiOrigin}/api/projects/${projectId.value}/approval-definitions`)
    const active = list.find((flow: any) => flow.category.id === 'SAFETY_MEASURE' && flow.isActive)
    activeSubmitFlow.value = active || null
  } catch (err) {
    console.error('获取审批流定义失败', err)
  } finally {
    submitFlowLoading.value = false
  }
}

const submitConfirmButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => { submitConfirmOpen.value = false }
  },
  {
    text: '确认送审',
    props: { color: 'primary', disabled: !activeSubmitFlow.value },
    onClick: handleConfirmSubmit
  }
])

const handleConfirmSubmit = async () => {
  if (!submitTargetItem.value) return
  try {
    await $fetch(`${apiOrigin}/api/v1/projects/${projectId.value}/safety-measures/${submitTargetItem.value.id}/submit`, {
      method: 'POST',
      body: {
        remark: submitRemark.value.trim()
      }
    })
    triggerNotification({
      title: '送审成功',
      description: '已成功送审并绑定流程配置。',
      type: ToastNotificationType.Success
    })
    submitConfirmOpen.value = false
    await loadList()
  } catch (err: any) {
    triggerNotification({
      title: '送审失败',
      description: err.data?.error || err.message || '送审出错，请重试',
      type: ToastNotificationType.Danger
    })
  }
}

// 删除逻辑
const deleteConfirmOpen = ref(false)
const itemToDelete = ref<any>(null)

const deleteItem = (item: any) => {
  itemToDelete.value = item
  deleteConfirmOpen.value = true
}

const confirmDeleteItem = async () => {
  if (!itemToDelete.value) return
  try {
    await $fetch(`${apiOrigin}/api/v1/projects/${projectId.value}/safety-measures/${itemToDelete.value.id}`, {
      method: 'DELETE'
    })
    triggerNotification({
      title: '删除成功',
      description: '已成功删除该条安全文明措施费记录。',
      type: ToastNotificationType.Success
    })
    await loadList()
  } catch (err: any) {
    triggerNotification({
      title: '删除失败',
      description: err.data?.error || err.message || '删除失败，请重试。',
      type: ToastNotificationType.Danger
    })
  } finally {
    deleteConfirmOpen.value = false
    itemToDelete.value = null
  }
}

// 辅助方法
const formatMoney = (val: any) => {
  if (val == null) return '-'
  return Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

const getStatusText = (status: string | null | undefined) => {
  const map: Record<string, string> = {
    START: '草稿',
    PENDING: '审核中',
    APPROVED: '审核通过',
    REJECTED: '已驳回',
    CANCELED: '已取消'
  }
  return map[(status || '').toUpperCase()] || '草稿'
}
</script>
