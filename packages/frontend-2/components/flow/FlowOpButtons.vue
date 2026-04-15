<template>
  <div class="flex w-full flex-wrap items-center justify-end gap-2">
    <FormButton
      v-for="item in availableActions"
      :key="item.key"
      :color="item.color"
      size="sm"
      :disabled="loading"
      @click="handleClick(item.key)"
    >
      {{ item.label }}
    </FormButton>
  </div>
</template>

<script setup lang="ts">
type FlowReviewAction = 'approve' | 'reject' | 'cancel'
type FlowOpActionKey = 'approve' | 'rollback' | 'reject' | 'cancel'

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
  if (!canOperate.value)
    return [] as Array<{
      key: FlowOpActionKey
      label: string
      color: 'primary' | 'danger' | 'outline'
    }>

  return [
    { key: 'approve' as const, label: '通过', color: 'primary' as const },
    { key: 'rollback' as const, label: '驳回', color: 'danger' as const },
    { key: 'reject' as const, label: '拒绝', color: 'danger' as const },
    { key: 'cancel' as const, label: '取消', color: 'outline' as const }
  ]
})

const handleClick = (operation: FlowOpActionKey) => {
  const rollbackToStep =
    operation === 'rollback'
      ? Math.max(1, (currentStep.value?.stepIndex || 1) - 1)
      : null

  const action: FlowReviewAction =
    operation === 'approve' ? 'approve' : operation === 'cancel' ? 'cancel' : 'reject'

  emit('action', {
    action,
    operation,
    rollbackToStep
  })
}
</script>
