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
  createdBy?: string
}

const ACTION_CONFIG: Record<FlowOpActionKey, ActionConfig> = {
  approve: { key: 'approve', label: '通过', color: 'primary' },
  rollback: { key: 'rollback', label: '驳回', color: 'outline' },
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
    text: '确认通过当前审批吗？',
    confirmText: '确认通过'
  },
  rollback: {
    title: '确认驳回审批',
    text: '确认驳回当前审批吗？',
    confirmText: '确认驳回'
  },
  reject: {
    title: '确认拒绝审批',
    text: '确认拒绝当前审批吗？',
    confirmText: '确认拒绝'
  },
  cancel: {
    title: '确认取消审批',
    text: '确认取消当前审批吗？',
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

const isCreator = computed(() => {
  return props.instance?.createdBy === props.userId
})

const availableActions = computed(() => {
  const actions: ActionConfig[] = []
  if (!props.instance || props.instance.status !== 'PENDING') return actions

  // 待办人操作
  if (currentStep.value && isTodoUser.value) {
    actions.push(ACTION_CONFIG.approve)
    // actions.push(ACTION_CONFIG.rollback)
    actions.push(ACTION_CONFIG.reject)
  }

  // 发起人操作
  if (isCreator.value) {
    actions.push(ACTION_CONFIG.cancel)
  }

  return actions
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
