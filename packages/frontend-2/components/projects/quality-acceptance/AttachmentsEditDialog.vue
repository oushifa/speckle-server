<template>
  <LayoutDialog v-model:open="open" max-width="lg" :buttons="dialogButtons">
    <template #header>
      附件管理{{ props.formName ? ` — ${props.formName}` : '' }}
    </template>
    <div class="space-y-4">
      <div class="text-body-xs text-foreground-2">
        可在此单独增删该验收单的「附件」与「过程文件」，不影响其它字段。
      </div>
      <ProjectsQualityAcceptanceAttachmentUploadField
        ref="attachmentFieldRef"
        v-model:existing="attachments"
        v-model:new-blob-ids="attachmentNewBlobIds"
        label="附件"
        :project-id="props.projectId"
        :disabled="props.loading"
      />
      <ProjectsQualityAcceptanceAttachmentUploadField
        ref="processAttachmentFieldRef"
        v-model:existing="processAttachments"
        v-model:new-blob-ids="processNewBlobIds"
        label="过程文件"
        :project-id="props.projectId"
        :disabled="props.loading"
      />
      <div v-if="errorMessage" class="text-body-sm text-danger">{{ errorMessage }}</div>
    </div>
  </LayoutDialog>
</template>

<script setup lang="ts">
import type { Nullable } from '@speckle/shared'
import type { LayoutDialogButton } from '@speckle/ui-components'
import type { QualityAcceptanceAttachment } from './types'

const props = withDefaults(
  defineProps<{
    projectId?: string | null
    /** 仅用于标题展示 */
    formName?: string
    initialAttachments?: QualityAcceptanceAttachment[]
    initialProcessAttachments?: QualityAcceptanceAttachment[]
    loading?: boolean
  }>(),
  {
    projectId: null,
    formName: '',
    initialAttachments: () => [],
    initialProcessAttachments: () => [],
    loading: false
  }
)

const emit = defineEmits<{
  (
    e: 'submit',
    payload: {
      attachments: string[]
      processAttachments: string[]
    }
  ): void
}>()

const open = defineModel<boolean>('open', { required: true })

const attachments = ref<QualityAcceptanceAttachment[]>([])
const processAttachments = ref<QualityAcceptanceAttachment[]>([])
const attachmentNewBlobIds = ref<string[]>([])
const processNewBlobIds = ref<string[]>([])
const errorMessage = ref('')

type AttachmentFieldRef = {
  hasPendingUploads: () => boolean
  markUploadsInUse: () => void
  resetUploads: () => void
}
const attachmentFieldRef = ref(null as Nullable<AttachmentFieldRef>)
const processAttachmentFieldRef = ref(null as Nullable<AttachmentFieldRef>)

// 每次打开都用最新的单据数据回填，并清空上一次未提交的上传队列
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    attachments.value = [...props.initialAttachments]
    processAttachments.value = [...props.initialProcessAttachments]
    attachmentNewBlobIds.value = []
    processNewBlobIds.value = []
    errorMessage.value = ''
    attachmentFieldRef.value?.resetUploads()
    processAttachmentFieldRef.value?.resetUploads()
  },
  { immediate: true }
)

const submit = () => {
  const hasPendingUploads =
    attachmentFieldRef.value?.hasPendingUploads() ||
    processAttachmentFieldRef.value?.hasPendingUploads()
  if (hasPendingUploads) {
    errorMessage.value = '附件上传中，请稍后再提交'
    return
  }
  // 已提交的 blob 标记为已使用，避免离开后被当作垃圾附件删除
  attachmentFieldRef.value?.markUploadsInUse()
  processAttachmentFieldRef.value?.markUploadsInUse()
  emit('submit', {
    attachments: Array.from(
      new Set([
        ...attachments.value.map((attachment) => attachment.id),
        ...attachmentNewBlobIds.value
      ])
    ),
    processAttachments: Array.from(
      new Set([
        ...processAttachments.value.map((attachment) => attachment.id),
        ...processNewBlobIds.value
      ])
    )
  })
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
    text: '保存',
    props: {
      color: 'primary',
      loading: props.loading
    },
    disabled: !!props.loading,
    onClick: submit
  }
])
</script>
