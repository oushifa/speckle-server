<!-- eslint-disable -->
<template>
  <LayoutDialog v-model:open="isOpen" max-width="lg" prevent-close-on-click-outside>
    <template #header>
      {{ props.title || '选择总进度计划任务' }}
    </template>

    <div class="space-y-3 py-1">
      <div class="relative">
        <FormTextInput
          v-model="searchTerm"
          :placeholder="props.searchPlaceholder || '搜索总进度任务名称...'"
          name="task-search"
          size="sm"
          class="w-full"
        />
      </div>

      <div
        class="max-h-[360px] min-h-[220px] overflow-y-auto rounded-lg border border-outline-2 bg-foundation p-2"
      >
        <div
          v-if="!visibleTasks.length"
          class="py-8 text-center text-body-sm text-foreground-2"
        >
          {{ props.emptyText || '暂无匹配的总进度任务' }}
        </div>
        <div v-else class="space-y-1">
          <div
            v-for="(task, index) in visibleTasks"
            :key="task.id"
            class="flex items-center justify-between rounded-lg p-2 text-body-sm transition-colors"
            :class="[
              checkIsParentTask(task, index, visibleTasks)
                ? 'font-medium text-foreground bg-foundation-2/60 cursor-not-allowed opacity-75'
                : tempSelectedTask?.id === task.id
                ? 'bg-primary-muted text-primary border border-primary/30 cursor-pointer'
                : 'hover:bg-foundation-2 text-foreground cursor-pointer'
            ]"
            :style="{ paddingLeft: `${task.level * 16 + 8}px` }"
            @click="handleSelect(task, index)"
          >
            <div class="flex items-center gap-2 truncate">
              <span
                v-if="!checkIsParentTask(task, index, visibleTasks)"
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                :class="
                  tempSelectedTask?.id === task.id
                    ? 'border-primary bg-primary text-white'
                    : 'border-outline-3'
                "
              >
                <Check v-if="tempSelectedTask?.id === task.id" class="h-3 w-3" />
              </span>
              <span class="truncate">{{ task.taskName }}</span>
            </div>

            <div
              v-if="!checkIsParentTask(task, index, visibleTasks)"
              class="flex items-center gap-3 text-body-xs text-foreground-2 shrink-0"
            >
              <span>
                工程量：{{ task.volume ? `${task.volume}${task.unit}` : '-' }}
              </span>
              <span v-if="task.startDate && task.endDate">
                {{ task.startDate.substring(0, 10) }} ~
                {{ task.endDate.substring(0, 10) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #buttons>
      <FormButton color="outline" @click="isOpen = false">取消</FormButton>
      <FormButton color="primary" :disabled="!tempSelectedTask" @click="handleConfirm">
        确认选择
      </FormButton>
    </template>
  </LayoutDialog>
</template>

<script setup lang="ts">
/* eslint-disable */
import { computed, ref, watch } from 'vue'
import { FormButton, FormTextInput, LayoutDialog } from '@speckle/ui-components'
import { Check } from 'lucide-vue-next'

export interface MasterTaskOption {
  id: string
  taskName: string
  level: number
  hasChildren: boolean
  parentId?: string
  wbs?: string
  volume?: string
  unit?: string
  startDate?: string
  endDate?: string
}

const checkIsParentTask = (
  mt: MasterTaskOption,
  index: number,
  allTasks: MasterTaskOption[]
): boolean => {
  if (!allTasks || !allTasks.length) return false
  if (mt.hasChildren) return true
  if (allTasks.some((other) => other.id !== mt.id && other.parentId === mt.id))
    return true
  if (
    mt.wbs &&
    allTasks.some(
      (other) => other.id !== mt.id && other.wbs && other.wbs.startsWith(mt.wbs + '.')
    )
  ) {
    return true
  }
  if (index < allTasks.length - 1) {
    const nextTask = allTasks[index + 1]
    if (
      typeof nextTask.level === 'number' &&
      typeof mt.level === 'number' &&
      nextTask.level > mt.level
    ) {
      return true
    }
  }
  const minLevel = Math.min(...allTasks.map((t) => t.level ?? 0))
  const maxLevel = Math.max(...allTasks.map((t) => t.level ?? 0))
  if (minLevel < maxLevel && mt.level === minLevel) {
    return true
  }
  return false
}

const props = defineProps<{
  open: boolean
  masterTasks: MasterTaskOption[]
  selectedTaskId?: string | null
  title?: string
  searchPlaceholder?: string
  emptyText?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'select', task: MasterTaskOption): void
}>()

const searchTerm = ref('')
const tempSelectedTask = ref<MasterTaskOption | null>(null)

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

watch(
  () => props.open,
  (val) => {
    if (val) {
      searchTerm.value = ''
      const existing = props.masterTasks.find((t) => t.id === props.selectedTaskId)
      tempSelectedTask.value = existing || null
    }
  },
  { immediate: true }
)

const visibleTasks = computed(() => {
  if (!searchTerm.value.trim()) return props.masterTasks
  const term = searchTerm.value.trim().toLowerCase()
  return props.masterTasks.filter((t) => t.taskName.toLowerCase().includes(term))
})

const handleSelect = (task: MasterTaskOption, index: number) => {
  if (checkIsParentTask(task, index, visibleTasks.value)) return
  tempSelectedTask.value = task
}

const handleConfirm = () => {
  if (tempSelectedTask.value) {
    emit('select', tempSelectedTask.value)
    isOpen.value = false
  }
}
</script>
