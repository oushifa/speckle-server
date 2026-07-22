<template>
  <LayoutDialog v-model:open="isOpen" max-width="lg">
    <template #header>选择总进度计划任务</template>

    <div class="space-y-3 py-1">
      <div class="relative">
        <FormTextInput
          v-model="searchTerm"
          placeholder="搜索总进度任务名称..."
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
          暂无匹配的总进度任务
        </div>
        <div v-else class="space-y-1">
          <div
            v-for="task in visibleTasks"
            :key="task.id"
            class="flex items-center justify-between rounded-lg p-2 text-body-sm transition-colors cursor-pointer"
            :class="[
              task.hasChildren
                ? 'font-medium text-foreground bg-foundation-2/60'
                : selectedTaskId === task.id
                ? 'bg-primary-muted text-primary border border-primary/30'
                : 'hover:bg-foundation-2 text-foreground'
            ]"
            :style="{ paddingLeft: `${task.level * 16 + 8}px` }"
            @click="handleSelect(task)"
          >
            <div className="flex items-center gap-2 truncate">
              <span
                v-if="!task.hasChildren"
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                :class="
                  selectedTaskId === task.id
                    ? 'border-primary bg-primary text-white'
                    : 'border-outline-3'
                "
              >
                <Check v-if="selectedTaskId === task.id" class="h-3 w-3" />
              </span>
              <span class="truncate">{{ task.taskName }}</span>
            </div>

            <div
              v-if="!task.hasChildren"
              class="flex items-center gap-3 text-body-xs text-foreground-2 shrink-0"
            >
              <span>工程量：{{ task.volume ? `${task.volume}${task.unit}` : '-' }}</span>
              <span v-if="task.startDate && task.endDate">
                {{ task.startDate }} ~ {{ task.endDate }}
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
import { FormButton, FormTextInput, LayoutDialog } from '@speckle/ui-components'
import { Check } from 'lucide-vue-next'

export interface MasterTaskOption {
  id: string
  taskName: string
  level: number
  hasChildren: boolean
  parentId?: string
  volume?: string
  unit?: string
  startDate?: string
  endDate?: string
}

const props = defineProps<{
  open: boolean
  masterTasks: MasterTaskOption[]
  selectedTaskId?: string | null
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

const visibleTasks = computed(() => {
  if (!searchTerm.value.trim()) return props.masterTasks
  const term = searchTerm.value.trim().toLowerCase()
  return props.masterTasks.filter((t) => t.taskName.toLowerCase().includes(term))
})

const handleSelect = (task: MasterTaskOption) => {
  if (task.hasChildren) return
  tempSelectedTask.value = task
}

const handleConfirm = () => {
  if (tempSelectedTask.value) {
    emit('select', tempSelectedTask.value)
    isOpen.value = false
  }
}
</script>
