<template>
  <div>
    <div class="flex w-full flex-wrap items-center justify-end gap-2">
      <FormButton
        v-for="item in availableActions"
        :key="item.key"
        :color="item.color"
        size="sm"
        :disabled="loading"
        @click="openConfirmDialog(item.key)"
      >
        {{ item.label }}
      </FormButton>
    </div>

    <CommonConfirmDialog
      v-model:open="confirmDialogOpen"
      :title="confirmDialogTitle"
      :text="confirmDialogText"
      :confirm-text="confirmDialogConfirmText"
      :loading="loading"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup lang="ts">
type FlowReviewAction = 'approve' | 'reject' | 'cancel'
type FlowOpActionKey = 'approve' | 'rollback' | 'reject' | 'cancel'
type ActionColor = 'primary' | 'danger' | 'outline'
type ActionConfig = {
  key: FlowOpActionKey
  label: string
  color: ActionColor
}

type FlowStep = {
  stepIndex: number
  status: string
  approverIds: string[]
}

type FlowInstance = {
  status: string
  currentStep: number
  steps: FlowStep[]
}

const ACTION_CONFIG: Record<FlowOpActionKey, ActionConfig> = {
  approve: { key: 'approve', label: '通过', color: 'primary' },
  rollback: { key: 'rollback', label: '驳回', color: 'danger' },
  reject: { key: 'reject', label: '拒绝', color: 'danger' },
  cancel: { key: 'cancel', label: '取消', color: 'outline' }
}

const ACTION_CONFIRMATION: Record<
  FlowOpActionKey,
  {
    title: string
    text: string
    confirmText: string
  }
> = {
  approve: {
    title: '确认通过审批',
    text: '确认通过当前审批吗？提交后将立即进入下一步，且无法撤销。',
    confirmText: '确认通过'
  },
  rollback: {
    title: '确认驳回审批',
    text: '确认驳回当前审批吗？该操作会将流程退回到发起人。',
    confirmText: '确认驳回'
  },
  reject: {
    title: '确认拒绝审批',
    text: '确认拒绝当前审批吗？该操作提交后将无法撤销。',
    confirmText: '确认拒绝'
  },
  cancel: {
    title: '确认取消审批',
    text: '确认取消当前审批吗？该操作提交后将无法撤销。',
    confirmText: '确认取消'
  }
}

const props = withDefaults(
  defineProps<{
    instance: FlowInstance | null
    userId?: string | null
    loading?: boolean
  }>(),
  {
    userId: null,
    loading: false
  }
)

const emit = defineEmits<{
  (
    e: 'action',
    payload: {
      action: FlowReviewAction
      operation: FlowOpActionKey
      rollbackToStep: number | null
    }
  ): void
}>()

const currentStep = computed(() => {
  const instance = props.instance
  if (!instance) return null
  return (
    instance.steps.find((step) => step.status === 'PENDING') ||
    instance.steps.find((step) => step.stepIndex === instance.currentStep) ||
    null
  )
})

const isTodoUser = computed(() => {
  const step = currentStep.value
  const uid = props.userId
  if (!step || !uid) return false
  if (!step.approverIds.length) return true
  return step.approverIds.includes(uid)
})

const canOperate = computed(() => {
  return props.instance?.status === 'PENDING' && !!currentStep.value && isTodoUser.value
})

const availableActions = computed(() => {
  if (!canOperate.value) return [] as ActionConfig[]

  return [
    ACTION_CONFIG.approve,
    ACTION_CONFIG.rollback
    // ACTION_CONFIG.reject,
    // ACTION_CONFIG.cancel
  ]
})

const confirmDialogOpen = ref(false)
const pendingOperation = ref<FlowOpActionKey | null>(null)

const confirmDialogTitle = computed(() => {
  if (!pendingOperation.value) return '确认操作'
  return ACTION_CONFIRMATION[pendingOperation.value].title
})

const confirmDialogText = computed(() => {
  if (!pendingOperation.value) return ''
  return ACTION_CONFIRMATION[pendingOperation.value].text
})

const confirmDialogConfirmText = computed(() => {
  if (!pendingOperation.value) return '确认'
  return ACTION_CONFIRMATION[pendingOperation.value].confirmText
})

const emitAction = (operation: FlowOpActionKey) => {
  const rollbackToStep =
    operation === 'rollback'
      ? 0 // 直接回退到发起人（开始节点）
      : null

  const action: FlowReviewAction =
    operation === 'approve' ? 'approve' : operation === 'cancel' ? 'cancel' : 'reject'

  emit('action', {
    action,
    operation,
    rollbackToStep
  })
}

const openConfirmDialog = (operation: FlowOpActionKey) => {
  pendingOperation.value = operation
  confirmDialogOpen.value = true
}

const handleConfirm = () => {
  if (!pendingOperation.value) return

  const operation = pendingOperation.value
  pendingOperation.value = null
  emitAction(operation)
}
</script>
