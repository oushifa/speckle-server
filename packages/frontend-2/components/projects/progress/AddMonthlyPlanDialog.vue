<template>
  <div>
    <LayoutDialog v-model:open="isOpen" max-width="xl" prevent-close-on-click-outside>
      <template #header>
        {{ initialRecord ? '编辑月度计划' : '新增月度计划' }}
      </template>

      <div class="space-y-4 py-2">
        <!-- Form Header -->
        <div
          class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-outline-2 bg-foundation-page p-3"
        >
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-2">
              <label for="monthly-plan-yearmonth" class="text-body-sm font-medium">
                年月 <span class="text-danger">*</span>
              </label>
              <input
                id="monthly-plan-yearmonth"
                v-model="yearMonth"
                type="month"
                class="h-8 rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none transition focus:border-primary"
              />
            </div>

            <div class="w-60 shrink-0">
              <FlowFieldsDynamicApprovalUserField
                v-model:value="selectedCreatorUserId"
                layout="horizontal"
                :field="{
                  name: '编制人',
                  key: 'createdBy',
                  type: 'user',
                  required: true,
                  placeholder: '输入用户名搜索'
                }"
              />
            </div>
          </div>

          <FormButton size="sm" color="subtle" :icon-left="Sparkles" @click="handleFetchMonthlyTasks">
            获取本月计划
          </FormButton>
        </div>

        <!-- Task Items Table -->
        <div class="overflow-x-auto rounded-lg border border-outline-2">
          <table class="w-full text-left text-body-sm">
            <thead class="bg-foundation-2 text-foreground-2 border-b border-outline-2">
              <tr>
                <th class="px-3 py-2 w-10">#</th>
                <th class="px-3 py-2 min-w-[220px]">
                  任务名称 <span class="text-danger">*</span>
                </th>
                <th class="px-3 py-2 w-36">
                  开始时间 <span class="text-danger">*</span>
                </th>
                <th class="px-3 py-2 w-36">
                  结束时间 <span class="text-danger">*</span>
                </th>
                <th class="px-3 py-2 w-28">总工程量</th>
                <th class="px-3 py-2 w-24">
                  单位 <span class="text-danger">*</span>
                </th>
                <th class="px-3 py-2 w-32">本月计划量</th>
                <th class="px-3 py-2 min-w-[150px]">备注</th>
                <th class="px-3 py-2 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-2 bg-foundation">
              <tr
                v-for="(task, index) in tasks"
                :key="task.id"
                class="hover:bg-foundation-2/50 transition-colors"
              >
                <td class="px-3 py-2 text-foreground-2 text-center">{{ index + 1 }}</td>

                <!-- Select task from master schedule -->
                <td class="px-2 py-1.5">
                  <button
                    type="button"
                    class="flex h-8 w-full items-center justify-between rounded-md border border-outline-3 bg-foundation px-2 text-left text-body-sm transition hover:border-primary"
                    @click="activeRowIndex = index"
                  >
                    <span className="truncate font-medium">
                      {{ task.taskName || '选择总计划任务...' }}
                    </span>
                    <ExternalLink class="h-3.5 w-3.5 text-foreground-2 shrink-0 ml-1" />
                  </button>
                </td>

                <td class="px-2 py-1.5">
                  <input
                    v-model="task.startDate"
                    type="date"
                    class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none focus:border-primary"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    v-model="task.endDate"
                    type="date"
                    class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none focus:border-primary"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    :value="task.totalVolume || '-'"
                    readonly
                    class="h-8 w-full rounded-md border border-outline-2 bg-foundation-2 px-2 text-body-sm text-foreground-2 cursor-not-allowed"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    :value="task.unit || '-'"
                    readonly
                    class="h-8 w-full rounded-md border border-outline-2 bg-foundation-2 px-2 text-body-sm text-foreground-2 cursor-not-allowed"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    v-model="task.plannedVolume"
                    type="number"
                    placeholder="0"
                    class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none focus:border-primary"
                  />
                </td>

                <td class="px-2 py-1.5">
                  <input
                    v-model="task.remark"
                    type="text"
                    placeholder="备注"
                    class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none focus:border-primary"
                  />
                </td>

                <td class="px-2 py-1.5 text-center">
                  <button
                    v-if="tasks.length > 1"
                    type="button"
                    class="inline-flex h-7 w-7 items-center justify-center rounded text-danger hover:bg-danger-lighter transition"
                    @click="removeTask(index)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <FormButton size="sm" color="outline" :icon-left="Plus" @click="addTask">
          添加任务行
        </FormButton>
      </div>

      <template #buttons>
        <FormButton color="outline" @click="isOpen = false">取消</FormButton>
        <FormButton color="primary" :disabled="!isValid" @click="handleSave">
          {{ initialRecord ? '保存修改' : '保存月度计划' }}
        </FormButton>
      </template>
    </LayoutDialog>

    <!-- Task Selection Dialog -->
    <TaskSelectDialog
      v-if="activeRowIndex !== null"
      :open="activeRowIndex !== null"
      :master-tasks="masterTasks"
      :selected-task-id="tasks[activeRowIndex]?.linkedPlanTaskId"
      @update:open="activeRowIndex = null"
      @select="handleMasterTaskSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { FormButton, LayoutDialog } from '@speckle/ui-components'
import { ExternalLink, Plus, Sparkles, Trash2 } from 'lucide-vue-next'
import { useActiveUser } from '~~/lib/auth/composables/activeUser'
import TaskSelectDialog, { type MasterTaskOption } from './TaskSelectDialog.vue'
import type { MonthlyRecordItem, MonthlyPlanTaskItem as MonthlyTaskItem } from '~~/lib/projects/api/progress'
import { searchSystemUsers, type UserSearchResult } from '~~/lib/organizations/api'

const props = defineProps<{
  open: boolean
  masterTasks: MasterTaskOption[]
  initialRecord?: MonthlyRecordItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', record: MonthlyRecordItem): void
}>()

const { activeUser } = useActiveUser()

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const emptyTask = (): MonthlyTaskItem => ({
  id: generateUUID(),
  taskName: '',
  linkedPlanTaskId: '',
  linkedPlanTaskName: '',
  startDate: '',
  endDate: '',
  totalVolume: '',
  unit: 'm³',
  plannedVolume: '',
  actualVolume: '0',
  progressPercent: 0,
  remark: '',
  bimComponentCount: 0,
  bimLinked: false
})

const yearMonth = ref('')
const createdBy = ref('')
const tasks = ref<MonthlyTaskItem[]>([emptyTask()])
const activeRowIndex = ref<number | null>(null)

const apiOrigin = useApiOrigin()
const selectedCreatorUserId = ref('')

watch(selectedCreatorUserId, async (newId) => {
  if (!newId) {
    createdBy.value = ''
    return
  }
  if (newId === activeUser.value?.id) {
    createdBy.value = activeUser.value?.name || ''
    return
  }
  try {
    const results = await searchSystemUsers({ query: newId, apiOrigin })
    const target = results.find((u) => u.id === newId)
    if (target) {
      createdBy.value = target.name
    } else {
      createdBy.value = newId
    }
  } catch (err) {
    console.error('根据ID获取用户名出错:', err)
    createdBy.value = newId
  }
})

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

watch(
  () => props.open,
  (val) => {
    if (val) {
      if (props.initialRecord) {
        yearMonth.value = props.initialRecord.yearMonth
        createdBy.value = props.initialRecord.createdBy
        selectedCreatorUserId.value = ''
        tasks.value = JSON.parse(JSON.stringify(props.initialRecord.tasks || []))

        // 异步查匹配的ID回显
        const creatorName = props.initialRecord.createdBy
        if (creatorName) {
          searchSystemUsers({ query: creatorName, apiOrigin }).then((results) => {
            const found = results.find((u) => u.name === creatorName)
            if (found) {
              selectedCreatorUserId.value = found.id
            }
          }).catch((err) => {
            console.error('根据名称查询用户ID出错:', err)
          })
        }
      } else {
        const now = new Date()
        yearMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const defaultUser = activeUser.value?.name || '张三'
        createdBy.value = defaultUser
        selectedCreatorUserId.value = activeUser.value?.id || ''
        tasks.value = [emptyTask()]
      }
    }
  },
  { immediate: true }
)

const isValid = computed(() => {
  return (
    !!yearMonth.value &&
    !!createdBy.value &&
    tasks.value.length > 0 &&
    tasks.value.every((t) => t.taskName && t.startDate && t.endDate && t.unit)
  )
})

const addTask = () => tasks.value.push(emptyTask())

const removeTask = (idx: number) => tasks.value.splice(idx, 1)

const handleMasterTaskSelected = (masterTask: MasterTaskOption) => {
  if (activeRowIndex.value === null) return
  const idx = activeRowIndex.value

  const task = tasks.value[idx]
  task.linkedPlanTaskId = masterTask.id
  task.linkedPlanTaskName = masterTask.taskName
  task.taskName = masterTask.taskName
  if (masterTask.volume) task.totalVolume = masterTask.volume
  if (masterTask.unit) task.unit = masterTask.unit
  if (masterTask.startDate) {
    task.startDate = masterTask.startDate.includes('T')
      ? masterTask.startDate.split('T')[0]
      : masterTask.startDate.substring(0, 10)
  }
  if (masterTask.endDate) {
    task.endDate = masterTask.endDate.includes('T')
      ? masterTask.endDate.split('T')[0]
      : masterTask.endDate.substring(0, 10)
  }

  activeRowIndex.value = null
}

const handleFetchMonthlyTasks = () => {
  if (!yearMonth.value) return
  const [y, m] = yearMonth.value.split('-')
  const currentYm = `${y}-${m}`

  const matches = props.masterTasks.filter((mt) => {
    if (mt.hasChildren || !mt.startDate || !mt.endDate) return false
    const taskStart = mt.startDate.substring(0, 7)
    const taskEnd = mt.endDate.substring(0, 7)
    return currentYm >= taskStart && currentYm <= taskEnd
  })

  if (matches.length > 0) {
    tasks.value = matches.map((mt) => {
      const t = emptyTask()
      t.linkedPlanTaskId = mt.id
      t.linkedPlanTaskName = mt.taskName
      t.taskName = mt.taskName
      t.startDate = mt.startDate
        ? mt.startDate.includes('T')
          ? mt.startDate.split('T')[0]
          : mt.startDate.substring(0, 10)
        : ''
      t.endDate = mt.endDate
        ? mt.endDate.includes('T')
          ? mt.endDate.split('T')[0]
          : mt.endDate.substring(0, 10)
        : ''
      t.totalVolume = mt.volume || ''
      t.unit = mt.unit || 'm³'
      return t
    })
  }
}

const handleSave = () => {
  if (!isValid.value) return

  const record: MonthlyRecordItem = {
    id: props.initialRecord?.id || generateUUID(),
    projectId: props.initialRecord?.projectId || '',
    yearMonth: yearMonth.value,
    tasks: tasks.value,
    createdAt: props.initialRecord?.createdAt || new Date().toLocaleString('zh-CN'),
    updatedAt: props.initialRecord?.updatedAt || new Date().toLocaleString('zh-CN'),
    createdBy: createdBy.value
  }

  emit('save', record)
  isOpen.value = false
}
</script>
