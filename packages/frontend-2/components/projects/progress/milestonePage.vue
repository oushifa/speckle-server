<template>
  <div class="flex flex-col h-full text-foreground gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <!-- 页面大标题与 Tab 导航 -->
      <div class="flex items-center gap-6">
        <h1 class="text-heading-lg mt-1 font-bold text-foreground">进度管理</h1>
        <div class="flex items-center border-b border-outline-2">
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-transparent text-foreground-2 hover:text-foreground"
            @click="navigateToActual"
          >
            进度管理
          </button>
          <button
            type="button"
            class="px-4 py-2 text-body-sm font-medium transition-colors border-b-2 border-primary text-primary font-semibold"
          >
            里程碑管理
          </button>
        </div>
      </div>

      <!-- 右侧操作栏：搜索与功能按钮 -->
      <div class="flex flex-wrap items-center gap-3">
        <FormTextInput
          v-model="milestoneSearchQuery"
          name="milestone-search"
          placeholder="搜索里程碑任务名称..."
          :custom-icon="Search"
          color="foundation"
          class="w-72"
        />
        <FormButton
          color="primary"
          :icon-left="Plus"
          @click="milestoneDialogOpen = true"
        >
          新增
        </FormButton>
        <FormButton color="outline" :icon-left="Upload" @click="handleMilestoneImport">
          导入
        </FormButton>
        <FormButton
          color="outline"
          :icon-left="Download"
          @click="handleMilestoneExport"
        >
          导出
        </FormButton>
      </div>
    </div>

    <!-- 里程碑管理内容表格 -->
    <div
      class="flex-1 overflow-hidden flex flex-col rounded-lg border border-outline-2 bg-foundation"
    >
      <LayoutTable
        :columns="milestoneColumns"
        :items="paginatedMilestones"
        class="flex-1"
      >
        <template #taskName="{ item }">
          <div class="font-medium text-body-sm text-foreground">
            {{ item.taskName }}
          </div>
        </template>

        <template #plannedStart="{ item }">
          <div class="text-body-sm text-foreground">{{ item.plannedStart }}</div>
        </template>

        <template #plannedEnd="{ item }">
          <div class="text-body-sm text-foreground">{{ item.plannedEnd }}</div>
        </template>

        <template #actualStart="{ item }">
          <div class="text-body-sm text-foreground">{{ item.actualStart }}</div>
        </template>

        <template #actualEnd="{ item }">
          <div class="text-body-sm text-foreground">{{ item.actualEnd }}</div>
        </template>

        <template #remark="{ item }">
          <div class="text-body-sm text-foreground-2">{{ item.remark }}</div>
        </template>

        <template #tags="{ item }">
          <div class="flex items-center gap-2">
            <span
              v-if="item.tags?.includes('critical')"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-outline-3 bg-foundation text-body-xs font-medium text-foreground-2 shadow-xs"
            >
              <Star class="h-3.5 w-3.5 text-foreground-2" />
              <span>关键工序</span>
            </span>
            <span
              v-if="item.tags?.includes('milestone')"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-outline-3 bg-foundation text-body-xs font-medium text-foreground-2 shadow-xs"
            >
              <Flag class="h-3.5 w-3.5 text-foreground-2" />
              <span>里程碑</span>
            </span>
            <span
              v-if="!item.tags || item.tags.length === 0"
              class="text-body-sm text-foreground-2"
            >
              -
            </span>
          </div>
        </template>
      </LayoutTable>
    </div>

    <!-- 里程碑分页组件 -->
    <div
      class="px-4 py-4 border border-outline-2 rounded-lg flex items-center justify-between bg-foundation"
    >
      <div class="flex items-center gap-4 text-sm text-foreground-2">
        <div class="flex items-center gap-2">
          <span>每页显示</span>
          <select
            v-model="milestoneItemsPerPage"
            aria-label="每页显示条数"
            class="bg-foundation-2 border border-outline-3 rounded px-2 py-1 outline-none"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          <span>条</span>
        </div>
        <div>
          共 {{ milestoneTotalItems }} 条，第 {{ milestoneStartItemIndex }}-{{
            milestoneEndItemIndex
          }}
          条
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          :disabled="milestoneCurrentPage === 1"
          class="p-1 rounded hover:bg-foundation-2 disabled:opacity-50 disabled:hover:bg-transparent"
          @click="milestoneCurrentPage > 1 && milestoneCurrentPage--"
        >
          <ChevronLeft class="h-5 w-5 text-foreground-2" />
        </button>

        <button
          v-for="page in milestoneTotalPages"
          :key="page"
          class="px-3 py-1 rounded text-sm transition-colors"
          :class="
            milestoneCurrentPage === page
              ? 'bg-primary text-white'
              : 'hover:bg-foundation-2 text-foreground'
          "
          @click="milestoneCurrentPage = page"
        >
          {{ page }}
        </button>

        <button
          :disabled="milestoneCurrentPage === milestoneTotalPages"
          class="p-1 rounded hover:bg-foundation-2 disabled:opacity-50 disabled:hover:bg-transparent"
          @click="milestoneCurrentPage < milestoneTotalPages && milestoneCurrentPage++"
        >
          <ChevronRight class="h-5 w-5 text-foreground-2" />
        </button>
      </div>
    </div>

    <!-- 新增里程碑弹窗 -->
    <ProjectsProgressMilestoneDialog
      v-model:open="milestoneDialogOpen"
      @submit="handleAddMilestone"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Flag,
  Plus,
  Search,
  Star,
  Upload
} from 'lucide-vue-next'
import type { MilestoneRecord } from '~/components/projects/progress/MilestoneDialog.vue'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

const route = useRoute()
const router = useRouter()
const { triggerNotification } = useGlobalToast()

const projectId = computed(() => (route.params.id as string) || '')

const navigateToActual = () => {
  if (projectId.value) {
    router.push(`/projects/${projectId.value}/progress/actual`)
  }
}

const milestoneColumns = [
  { id: 'taskName', header: '任务名称', classes: 'col-span-3' },
  { id: 'plannedStart', header: '计划开始时间', classes: 'col-span-1' },
  { id: 'plannedEnd', header: '计划结束时间', classes: 'col-span-1' },
  { id: 'actualStart', header: '实际开始时间', classes: 'col-span-1' },
  { id: 'actualEnd', header: '实际结束时间', classes: 'col-span-1' },
  { id: 'remark', header: '备注', classes: 'col-span-2' },
  { id: 'tags', header: '标签', classes: 'col-span-3' }
]

const milestoneDialogOpen = ref(false)
const milestoneSearchQuery = ref('')
const milestoneItemsPerPage = ref(10)
const milestoneCurrentPage = ref(1)

const milestoneRecords = ref<MilestoneRecord[]>([
  {
    id: 'm-1',
    taskName: '路基土方填筑完成',
    plannedStart: '2026-03-01',
    plannedEnd: '2026-05-31',
    actualStart: '2026-03-05',
    actualEnd: '2026-06-10',
    remark: '-',
    tags: ['critical', 'milestone']
  },
  {
    id: 'm-2',
    taskName: '桥梁下部结构施工',
    plannedStart: '2026-04-01',
    plannedEnd: '2026-07-31',
    actualStart: '2026-04-08',
    actualEnd: '-',
    remark: '-',
    tags: ['critical', 'milestone']
  },
  {
    id: 'm-3',
    taskName: '路面基层施工完成',
    plannedStart: '2026-06-01',
    plannedEnd: '2026-08-31',
    actualStart: '-',
    actualEnd: '-',
    remark: '-',
    tags: ['critical', 'milestone']
  },
  {
    id: 'm-4',
    taskName: '交通工程设施安装',
    plannedStart: '2026-09-01',
    plannedEnd: '2026-10-31',
    actualStart: '-',
    actualEnd: '-',
    remark: '-',
    tags: ['critical', 'milestone']
  },
  {
    id: 'm-5',
    taskName: '竣工验收',
    plannedStart: '2026-11-01',
    plannedEnd: '2026-11-30',
    actualStart: '-',
    actualEnd: '-',
    remark: '-',
    tags: ['critical', 'milestone']
  }
])

const filteredMilestones = computed(() => {
  const q = milestoneSearchQuery.value.trim().toLowerCase()
  if (!q) return milestoneRecords.value
  return milestoneRecords.value.filter(
    (item) =>
      item.taskName.toLowerCase().includes(q) || item.remark.toLowerCase().includes(q)
  )
})

const milestoneTotalItems = computed(() => filteredMilestones.value.length)
const milestoneTotalPages = computed(() =>
  Math.max(1, Math.ceil(milestoneTotalItems.value / milestoneItemsPerPage.value))
)
const milestoneStartItemIndex = computed(() =>
  milestoneTotalItems.value === 0
    ? 0
    : (milestoneCurrentPage.value - 1) * milestoneItemsPerPage.value + 1
)
const milestoneEndItemIndex = computed(() =>
  Math.min(
    milestoneCurrentPage.value * milestoneItemsPerPage.value,
    milestoneTotalItems.value
  )
)
const paginatedMilestones = computed(() => {
  const start = (milestoneCurrentPage.value - 1) * milestoneItemsPerPage.value
  return filteredMilestones.value.slice(start, start + milestoneItemsPerPage.value)
})

watch(milestoneSearchQuery, () => {
  milestoneCurrentPage.value = 1
})

watch(milestoneItemsPerPage, () => {
  milestoneCurrentPage.value = 1
})

watch(milestoneTotalPages, (pages) => {
  if (milestoneCurrentPage.value > pages) {
    milestoneCurrentPage.value = pages
  }
})

const handleAddMilestone = (record: MilestoneRecord) => {
  milestoneRecords.value.unshift(record)
}

const handleMilestoneExport = () => {
  if (!milestoneRecords.value.length) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '当前无里程碑数据可导出'
    })
    return
  }
  const headers = [
    '任务名称',
    '计划开始时间',
    '计划结束时间',
    '实际开始时间',
    '实际结束时间',
    '备注',
    '标签'
  ]
  const rows = milestoneRecords.value.map((r) => [
    `"${r.taskName.replace(/"/g, '""')}"`,
    r.plannedStart,
    r.plannedEnd,
    r.actualStart,
    r.actualEnd,
    `"${(r.remark || '-').replace(/"/g, '""')}"`,
    `"${r.tags.map((t) => (t === 'critical' ? '关键工序' : '里程碑')).join('、')}"`
  ])
  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    `里程碑台账_${new Date().toISOString().slice(0, 10)}.csv`
  )
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  triggerNotification({
    type: ToastNotificationType.Success,
    title: '里程碑台账导出成功'
  })
}

const handleMilestoneImport = () => {
  triggerNotification({
    type: ToastNotificationType.Info,
    title: '里程碑Excel导入功能待后端接口就绪后开放'
  })
}
</script>
