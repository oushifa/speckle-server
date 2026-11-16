<template>
  <LayoutDialog
    v-model:open="open"
    max-width="xl"
    fullscreen="all"
    :buttons="previewDialogButtons"
  >
    <template #header>
      {{ attachment?.name || attachment?.blobId || '附件预览' }}
    </template>
    <div
      v-if="attachment && projectId"
      class="flex flex-col gap-y-3 h-[70vh] md:h-[75vh]"
    >
      <div
        class="w-full flex-1 h-full flex flex-col justify-center text-foreground text-body-xs px-6 pb-6 pt-2"
      >
        <CommonFilePreview
          :blob-id="attachment.blobId"
          :project-id="projectId"
          :file-name="attachment.name || attachment.blobId"
          class="w-full flex-1 h-full"
        />
      </div>
    </div>
  </LayoutDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LayoutDialog, type LayoutDialogButton } from '@speckle/ui-components'
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline'
import { useFileDownload } from '~~/lib/core/composables/fileUpload'
import { useGlobalToast, ToastNotificationType } from '~~/lib/common/composables/toast'

const open = defineModel<boolean>('open', { default: false })

export type AttachmentPreviewItem = {
  blobId: string
  name?: string
}

const props = withDefaults(
  defineProps<{
    projectId: string
    attachment: AttachmentPreviewItem | null
    canDownload?: boolean
  }>(),
  {
    canDownload: true
  }
)

const { download } = useFileDownload()
const { triggerNotification } = useGlobalToast()

const handleDownload = async () => {
  if (!props.attachment?.blobId || !props.projectId) return
  try {
    await download({
      blobId: props.attachment.blobId,
      fileName: props.attachment.name || props.attachment.blobId,
      projectId: props.projectId
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    triggerNotification({
      title: '文件下载失败',
      description: errorMsg || '下载过程中出现错误，请稍后重试',
      type: ToastNotificationType.Danger
    })
  }
}

const previewDialogButtons = computed((): LayoutDialogButton[] => {
  const buttons: LayoutDialogButton[] = []

  if (props.canDownload && props.attachment?.blobId) {
    buttons.push({
      text: '下载',
      props: {
        iconLeft: ArrowDownTrayIcon,
        color: 'outline'
      },
      onClick: () => {
        void handleDownload()
      }
    })
  }

  buttons.push({
    text: '关闭',
    props: { color: 'outline' },
    onClick: () => {
      open.value = false
    }
  })

  return buttons
})
</script>
