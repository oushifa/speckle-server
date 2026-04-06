<template>
  <LayoutDialog v-model:open="open" max-width="sm" :buttons="dialogButtons">
    <template #header>{{ dialogTitle }}</template>
    <div class="space-y-3">
      <p class="text-body-sm text-foreground-2">
        审批实例：<span class="font-medium">#{{ instanceId }}</span>
      </p>
      <div class="space-y-2">
        <label for="flow-review-comment" class="text-body-xs text-foreground-2">
          备注{{ requiresComment ? '（必填）' : '（选填）' }}
        </label>
        <input
          id="flow-review-comment"
          v-model="comment"
          class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          :placeholder="commentPlaceholder"
        />
      </div>
      <div v-if="action === 'reject'" class="space-y-2">
        <label for="flow-review-rollback" class="text-body-xs text-foreground-2">
          回退到步骤（可选）
        </label>
        <input
          id="flow-review-rollback"
          v-model.number="rollbackToStep"
          type="number"
          min="1"
          class="w-full border border-outline-3 rounded-md px-3 py-2 bg-foundation-page"
          placeholder="例如：1"
        />
      </div>
    </div>
  </LayoutDialog>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'

type ReviewAction = 'approve' | 'reject' | 'cancel'

const props = defineProps<{
  action: ReviewAction
  instanceId: string | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (
    e: 'submit',
    payload: {
      action: ReviewAction
      instanceId: string
      comment: string | null
      rollbackToStep: number | null
    }
  ): void
}>()

const open = defineModel<boolean>('open', { required: true })
const comment = ref('')
const rollbackToStep = ref<number | null>(null)

const requiresComment = computed(() => props.action === 'reject')

const dialogTitleMap: Record<ReviewAction, string> = {
  approve: '通过审批',
  reject: '驳回审批',
  cancel: '取消审批'
}

const confirmTextMap: Record<ReviewAction, string> = {
  approve: '确认通过',
  reject: '确认驳回',
  cancel: '确认取消'
}

const commentPlaceholderMap: Record<ReviewAction, string> = {
  approve: '输入通过说明（可选）',
  reject: '请输入驳回原因',
  cancel: '输入取消说明（可选）'
}

const dialogTitle = computed(() => dialogTitleMap[props.action])
const confirmText = computed(() => confirmTextMap[props.action])
const commentPlaceholder = computed(() => commentPlaceholderMap[props.action])

const canSubmit = computed(() => {
  if (!props.instanceId || props.loading) return false
  if (requiresComment.value) return !!comment.value.trim()
  return true
})

const resetForm = () => {
  comment.value = ''
  rollbackToStep.value = null
}

watch(
  () => open.value,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      resetForm()
    }
  }
)

const submit = () => {
  if (!canSubmit.value || !props.instanceId) return
  emit('submit', {
    action: props.action,
    instanceId: props.instanceId,
    comment: comment.value.trim() || null,
    rollbackToStep: props.action === 'reject' ? rollbackToStep.value || null : null
  })
  open.value = false
}

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      open.value = false
    }
  },
  {
    text: confirmText.value,
    props: {
      color: props.action === 'approve' ? 'primary' : 'danger',
      loading: !!props.loading
    },
    disabled: !canSubmit.value,
    onClick: submit
  }
])
</script>
