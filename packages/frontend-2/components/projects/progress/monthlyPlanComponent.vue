<template>
  <div class="space-y-4">
    <!-- Header Controls -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <FormTextInput
          v-model="searchKeyword"
          placeholder="搜索任务名称..."
          name="monthly-search"
          size="sm"
          class="w-64"
        />
        <input
          v-model="filterYearMonth"
          type="month"
          class="h-8 rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none transition focus:border-primary"
        />
        <FormButton
          v-if="searchKeyword || filterYearMonth"
          size="sm"
          color="subtle"
          @click="clearFilters"
        >
          清除筛选
        </FormButton>
      </div>

      <FormButton size="sm" color="primary" :icon-left="Plus" @click="isAddDialogOpen = true">
        新增月度计划
      </FormButton>
    </div>

    <!-- Monthly Plan List by Month -->
    <div v-if="!filteredRecords.length" class="rounded-lg border border-outline-2 bg-foundation py-12 text-center text-body-sm text-foreground-2">
      暂无月度计划，点击「新增月度计划」开始
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="record in filteredRecords"
        :key="record.id"
        class="overflow-hidden rounded-lg border border-outline-2 bg-foundation transition-shadow hover:shadow-sm"
      >
        <!-- Record Header / Summary Bar -->
        <div
          class="flex items-center justify-between bg-foundation-2/60 px-4 py-3 cursor-pointer select-none"
          @click="toggleExpand(record.id)"
        >
          <div class="flex items-center gap-3">
            <component
              :is="expandedRecordIds.includes(record.id) ? ChevronDown : ChevronRight"
              class="h-4 w-4 text-foreground-2 transition-transform"
            />
            <span
              class="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white"
            >
              {{ record.yearMonth }}
            </span>
            <div class="flex flex-wrap gap-1.5 ml-2">
              <span
                v-for="t in record.tasks.slice(0, 3)"
                :key="t.id"
                class="rounded bg-foundation px-2 py-0.5 text-xs text-foreground-2 border border-outline-2"
              >
                {{ t.taskName }}
              </span>
              <span v-if="record.tasks.length > 3" class="text-xs text-foreground-2">
                +{{ record.tasks.length - 3 }} 项
              </span>
            </div>
          </div>

          <div class="flex items-center gap-4 text-body-xs text-foreground-2">
            <span>任务数：{{ record.tasks.length }}</span>
            <span>编制人：{{ record.createdBy }}</span>
            <span>时间：{{ record.createdAt }}</span>
            <div class="flex items-center gap-1" @click.stop>
              <button
                type="button"
                class="rounded p-1 text-foreground-2 hover:bg-foundation-3 hover:text-primary transition"
                title="编辑"
                @click="openEditDialog(record)"
              >
                <Pencil class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-foreground-2 hover:bg-danger-lighter hover:text-danger transition"
                title="删除"
                @click="deleteRecord(record.id)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Expanded Tasks List -->
        <div v-if="expandedRecordIds.includes(record.id)" class="border-t border-outline-2">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-body-sm">
              <thead class="bg-foundation-page text-foreground-2 border-b border-outline-2">
                <tr>
                  <th class="px-3 py-2 w-10">#</th>
                  <th class="px-3 py-2 min-w-[200px]">任务名称</th>
                  <th class="px-3 py-2 w-28">开始时间</th>
                  <th class="px-3 py-2 w-28">结束时间</th>
                  <th class="px-3 py-2 w-24">总工程量</th>
                  <th class="px-3 py-2 w-20">单位</th>
                  <th class="px-3 py-2 w-28">本月计划</th>
                  <th class="px-3 py-2 w-32 text-center">BIM关联</th>
                  <th class="px-3 py-2 min-w-[150px]">备注</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-2 bg-foundation">
                <tr
                  v-for="(task, idx) in record.tasks"
                  :key="task.id"
                  class="hover:bg-foundation-2/30 transition-colors"
                >
                  <td class="px-3 py-2 text-foreground-2 text-center">{{ idx + 1 }}</td>
                  <td class="px-3 py-2 font-medium">{{ task.taskName }}</td>
                  <td class="px-3 py-2 text-foreground-2">{{ task.startDate }}</td>
                  <td class="px-3 py-2 text-foreground-2">{{ task.endDate }}</td>
                  <td class="px-3 py-2 text-foreground-2">{{ task.totalVolume || '-' }}</td>
                  <td class="px-3 py-2 text-foreground-2">{{ task.unit }}</td>
                  <td class="px-3 py-2 font-medium">{{ task.plannedVolume || '-' }}</td>

                  <!-- BIM Association Action Button -->
                  <td class="px-3 py-2 text-center">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition"
                      :class="
                        task.bimLinked || (task.selections && task.selections.length > 0)
                          ? 'border-success-darker/30 bg-success-lighter text-success-darker'
                          : 'border-outline-3 bg-foundation hover:bg-foundation-2 text-foreground-2'
                      "
                      @click="openBimLinkDrawer(record.id, task)"
                    >
                      <Box class="h-3.5 w-3.5" />
                      <span>
                        {{
                          task.bimLinked || (task.selections && task.selections.length > 0)
                            ? `已关联 (${getSelectionsCount(task)}件)`
                            : '关联BIM'
                        }}
                      </span>
                    </button>
                  </td>

                  <td class="px-3 py-2 text-foreground-2">{{ task.remark || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Monthly Plan Dialog -->
    <AddMonthlyPlanDialog
      v-model:open="isAddDialogOpen"
      :master-tasks="masterTasks"
      :initial-record="editingRecord"
      @save="handleSaveRecord"
    />

    <!-- Multi-Model BIM Object Association Drawer -->
    <LayoutDialog v-model:open="isBimDrawerOpen" max-width="lg" :buttons="bimDialogButtons">
      <template #header>
        {{ activeBimTask ? `BIM关联：${activeBimTask.taskName}` : 'BIM关联' }}
      </template>
      <div v-if="activeBimTask" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded border border-outline-2 bg-foundation-page p-3">
            <div class="text-body-xs text-foreground-2">计划开始</div>
            <div class="text-body-sm font-medium mt-1">{{ activeBimTask.startDate }}</div>
          </div>
          <div class="rounded border border-outline-2 bg-foundation-page p-3">
            <div class="text-body-xs text-foreground-2">计划完成</div>
            <div class="text-body-sm font-medium mt-1">{{ activeBimTask.endDate }}</div>
          </div>
        </div>

        <div class="rounded border border-dashed border-outline-3 p-4 bg-foundation-page">
          <CommonModelObjectMultiModelSelectDrawer
            v-model:model_ids="draftModelIds"
            v-model:selections="draftSelections"
            :project-id="projectId"
            placeholder="选择与月度计划关联的模型构件"
          />
        </div>
        <div class="text-body-xs text-foreground-2">
          已关联构件将实时同步更新总进度计划对应的BIM构件关联结果。
        </div>
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import { FormButton, FormTextInput, LayoutDialog, type LayoutDialogButton } from '@speckle/ui-components'
import { Box, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { CommonModelObjectMultiModelSelectDrawer } from '#components'
import AddMonthlyPlanDialog, { type MonthlyRecordItem, type MonthlyTaskItem } from './AddMonthlyPlanDialog.vue'
import type { MasterTaskOption } from './TaskSelectDialog.vue'

const props = defineProps<{
  projectId: string
  masterTasks: MasterTaskOption[]
}>()

const emit = defineEmits<{
  (e: 'sync-records', records: MonthlyRecordItem[]): void
}>()

const records = ref<MonthlyRecordItem[]>([
  {
    id: 'mp-001',
    yearMonth: '2025-01',
    createdAt: '2025-01-05 09:00',
    createdBy: '张三',
    tasks: [
      {
        id: 't1',
        taskName: '路基土方开挖',
        linkedPlanTaskId: '1-1-1-1',
        linkedPlanTaskName: '路基土方开挖',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        totalVolume: '120000',
        unit: 'm³',
        plannedVolume: '40000',
        actualVolume: '38500',
        progressPercent: 96,
        remark: '施工顺利',
        bimComponentCount: 3,
        bimLinked: true,
        selections: [{ modelId: 'model-1', applicationIds: ['app-1', 'app-2', 'app-3'] }]
      }
    ]
  }
])

const expandedRecordIds = ref<string[]>(['mp-001'])
const searchKeyword = ref('')
const filterYearMonth = ref('')
const isAddDialogOpen = ref(false)
const editingRecord = ref<MonthlyRecordItem | null>(null)

// BIM Drawer State
const isBimDrawerOpen = ref(false)
const activeRecordId = ref<string | null>(null)
const activeBimTask = ref<MonthlyTaskItem | null>(null)
const draftModelIds = ref<string[]>([])
const draftSelections = ref<Array<{ modelId: string; applicationIds: string[] }>>([])

const filteredRecords = computed(() => {
  return records.value.filter((r) => {
    if (filterYearMonth.value && r.yearMonth !== filterYearMonth.value) return false
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      const hasMatch = r.tasks.some((t) => t.taskName.toLowerCase().includes(kw))
      if (!hasMatch) return false
    }
    return true
  })
})

const clearFilters = () => {
  searchKeyword.value = ''
  filterYearMonth.value = ''
}

const toggleExpand = (id: string) => {
  if (expandedRecordIds.value.includes(id)) {
    expandedRecordIds.value = expandedRecordIds.value.filter((i) => i !== id)
  } else {
    expandedRecordIds.value.push(id)
  }
}

const getSelectionsCount = (task: MonthlyTaskItem) => {
  if (task.selections && task.selections.length > 0) {
    return task.selections.reduce((sum, item) => sum + item.applicationIds.length, 0)
  }
  return task.bimComponentCount || 0
}

const openEditDialog = (record: MonthlyRecordItem) => {
  editingRecord.value = record
  isAddDialogOpen.value = true
}

const deleteRecord = (id: string) => {
  records.value = records.value.filter((r) => r.id !== id)
  emit('sync-records', records.value)
}

const handleSaveRecord = (record: MonthlyRecordItem) => {
  const existingIdx = records.value.findIndex((r) => r.id === record.id)
  if (existingIdx !== -1) {
    records.value[existingIdx] = record
  } else {
    records.value.unshift(record)
    expandedRecordIds.value.push(record.id)
  }
  editingRecord.value = null
  emit('sync-records', records.value)
}

const openBimLinkDrawer = (recordId: string, task: MonthlyTaskItem) => {
  activeRecordId.value = recordId
  activeBimTask.value = task
  draftSelections.value = JSON.parse(JSON.stringify(task.selections || []))
  draftModelIds.value = draftSelections.value.map((s) => s.modelId)
  isBimDrawerOpen.value = true
}

const bimDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      isBimDrawerOpen.value = false
    }
  },
  {
    text: '保存关联',
    props: { color: 'primary' },
    onClick: () => {
      saveBimAssociation()
    }
  }
])

const saveBimAssociation = () => {
  if (!activeRecordId.value || !activeBimTask.value) return

  const rec = records.value.find((r) => r.id === activeRecordId.value)
  if (rec) {
    const t = rec.tasks.find((item) => item.id === activeBimTask.value?.id)
    if (t) {
      t.selections = JSON.parse(JSON.stringify(draftSelections.value))
      t.bimLinked = t.selections.length > 0 && t.selections.some((s) => s.applicationIds.length > 0)
      t.bimComponentCount = getSelectionsCount(t)
    }
  }

  emit('sync-records', records.value)
  isBimDrawerOpen.value = false
  activeRecordId.value = null
  activeBimTask.value = null
}
</script>
