<template>
  <LayoutDialog v-model:open="isOpen" max-width="md" prevent-close-on-click-outside>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="text-heading-sm font-semibold text-foreground">新增里程碑</span>
      </div>
    </template>

    <div class="space-y-4 py-2">
      <!-- 任务名称 (必填) -->
      <div class="flex flex-col gap-1.5">
        <label
          for="milestone-task-name"
          class="text-body-sm font-medium text-foreground"
        >
          任务名称
          <span class="text-danger">*</span>
        </label>
        <input
          id="milestone-task-name"
          v-model="form.taskName"
          type="text"
          placeholder="请输入任务名称"
          class="h-10 w-full rounded-lg border border-outline-3 bg-foundation px-3 text-body-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <!-- 计划开始时间 & 计划结束时间 -->
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label
            for="milestone-planned-start"
            class="text-body-sm font-medium text-foreground"
          >
            计划开始时间
          </label>
          <input
            id="milestone-planned-start"
            v-model="form.plannedStart"
            type="date"
            placeholder="年 / 月 / 日"
            class="h-10 w-full rounded-lg border border-outline-3 bg-foundation px-3 text-body-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label
            for="milestone-planned-end"
            class="text-body-sm font-medium text-foreground"
          >
            计划结束时间
          </label>
          <input
            id="milestone-planned-end"
            v-model="form.plannedEnd"
            type="date"
            :min="form.plannedStart || undefined"
            placeholder="年 / 月 / 日"
            class="h-10 w-full rounded-lg border border-outline-3 bg-foundation px-3 text-body-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <!-- 实际开始时间 & 实际结束时间 -->
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label
            for="milestone-actual-start"
            class="text-body-sm font-medium text-foreground"
          >
            实际开始时间
          </label>
          <input
            id="milestone-actual-start"
            v-model="form.actualStart"
            type="date"
            placeholder="年 / 月 / 日"
            class="h-10 w-full rounded-lg border border-outline-3 bg-foundation px-3 text-body-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label
            for="milestone-actual-end"
            class="text-body-sm font-medium text-foreground"
          >
            实际结束时间
          </label>
          <input
            id="milestone-actual-end"
            v-model="form.actualEnd"
            type="date"
            :min="form.actualStart || undefined"
            placeholder="年 / 月 / 日"
            class="h-10 w-full rounded-lg border border-outline-3 bg-foundation px-3 text-body-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <!-- 备注 -->
      <div class="flex flex-col gap-1.5">
        <label for="milestone-remark" class="text-body-sm font-medium text-foreground">
          备注
        </label>
        <input
          id="milestone-remark"
          v-model="form.remark"
          type="text"
          placeholder="可选"
          class="h-10 w-full rounded-lg border border-outline-3 bg-foundation px-3 text-body-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <!-- 标签 -->
      <div class="flex flex-col gap-2">
        <span class="text-body-sm font-medium text-foreground">标签</span>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-body-sm font-medium transition-colors"
            :class="
              form.tags.includes('critical')
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-outline-3 bg-foundation text-foreground-2 hover:border-outline-2'
            "
            @click="toggleTag('critical')"
          >
            <Star
              class="h-4 w-4"
              :class="
                form.tags.includes('critical')
                  ? 'fill-primary/20 text-primary'
                  : 'text-foreground-2'
              "
            />
            <span>关键工序</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-body-sm font-medium transition-colors"
            :class="
              form.tags.includes('milestone')
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-outline-3 bg-foundation text-foreground-2 hover:border-outline-2'
            "
            @click="toggleTag('milestone')"
          >
            <Flag
              class="h-4 w-4"
              :class="
                form.tags.includes('milestone')
                  ? 'fill-primary/20 text-primary'
                  : 'text-foreground-2'
              "
            />
            <span>里程碑</span>
          </button>
        </div>
      </div>
    </div>

    <template #buttons>
      <div class="flex items-center justify-end gap-3 w-full">
        <FormButton color="outline" class="px-5" @click="closeDialog">取消</FormButton>
        <FormButton color="primary" class="px-5" @click="handleSubmit">保存</FormButton>
      </div>
    </template>
  </LayoutDialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Star, Flag } from 'lucide-vue-next'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

export type MilestoneRecord = {
  id: string
  taskName: string
  plannedStart: string
  plannedEnd: string
  actualStart: string
  actualEnd: string
  remark: string
  tags: ('critical' | 'milestone')[]
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'submit', record: MilestoneRecord): void
}>()

const { triggerNotification } = useGlobalToast()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const defaultForm = () => ({
  taskName: '',
  plannedStart: '',
  plannedEnd: '',
  actualStart: '',
  actualEnd: '',
  remark: '',
  tags: ['critical', 'milestone'] as ('critical' | 'milestone')[]
})

const form = reactive(defaultForm())

watch(
  () => props.open,
  (val) => {
    if (val) {
      Object.assign(form, defaultForm())
    }
  }
)

const toggleTag = (tag: 'critical' | 'milestone') => {
  const idx = form.tags.indexOf(tag)
  if (idx >= 0) {
    form.tags.splice(idx, 1)
  } else {
    form.tags.push(tag)
  }
}

const closeDialog = () => {
  isOpen.value = false
}

const handleSubmit = () => {
  if (!form.taskName.trim()) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '请输入任务名称'
    })
    return
  }

  const newRecord: MilestoneRecord = {
    id: `milestone-${Date.now()}`,
    taskName: form.taskName.trim(),
    plannedStart: form.plannedStart || '-',
    plannedEnd: form.plannedEnd || '-',
    actualStart: form.actualStart || '-',
    actualEnd: form.actualEnd || '-',
    remark: form.remark.trim() || '-',
    tags: [...form.tags]
  }

  emit('submit', newRecord)
  triggerNotification({
    type: ToastNotificationType.Success,
    title: '新增里程碑成功'
  })
  isOpen.value = false
}
</script>
