<template>
  <div>
    <div v-if="attachmentList.length > 0" class="flex flex-col gap-y-1 pt-2">
      <button
        v-for="attachment in attachmentList"
        :key="attachment.id"
        class="text-foreground hover:text-foreground-2 flex items-center gap-x-1"
        @click="() => onAttachmentClick(attachment)"
      >
        <Paperclip class="size-3" />
        <span class="truncate relative text-body-3xs">
          {{ attachment.fileName }}
        </span>
      </button>
    </div>

    <LayoutDialog v-model:open="dialogOpen" max-width="xl" fullscreen="all" :buttons="dialogButtons">
      <template #header>
        {{ dialogAttachment ? dialogAttachment.fileName : 'Attachment' }}
      </template>
      <template #default>
        <div v-if="dialogAttachment" class="w-full h-full flex flex-col justify-center text-foreground text-body-xs px-6 pb-6 pt-2">
          <CommonFilePreview
            :blob-id="dialogAttachment.id"
            :project-id="projectId"
            :file-name="dialogAttachment.fileName"
            :file-type="dialogAttachment.fileType"
            :file-size="dialogAttachment.fileSize"
            class="w-full flex-1 h-full"
          />
        </div>
      </template>
    </LayoutDialog>
  </div>
</template>
<script setup lang="ts">
import type { Get } from 'type-fest'
import { ensureError } from '@speckle/shared'
import type { Nullable, Optional } from '@speckle/shared'
import { graphql } from '~~/lib/common/generated/gql'
import type { ThreadCommentAttachmentFragment } from '~~/lib/common/generated/gql/graphql'
import { prettyFileSize } from '~~/lib/core/helpers/file'
import { useFileDownload } from '~~/lib/core/composables/fileUpload'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { Download, Paperclip } from 'lucide-vue-next'

type AttachmentFile = NonNullable<
  Get<ThreadCommentAttachmentFragment, 'text.attachments[0]'>
>

graphql(`
  fragment ThreadCommentAttachment on Comment {
    text {
      attachments {
        id
        fileName
        fileType
        fileSize
      }
    }
  }
`)

const props = defineProps<{
  attachments: ThreadCommentAttachmentFragment
  projectId: string
}>()

const { download } = useFileDownload()
const { triggerNotification } = useGlobalToast()

const dialogOpen = ref(false)
const dialogAttachment = ref(null as Nullable<AttachmentFile>)

const onAttachmentClick = (attachment: AttachmentFile) => {
  dialogAttachment.value = attachment
  dialogOpen.value = true
}

const onDownloadClick = async () => {
  if (!dialogAttachment.value) return

  try {
    const { id, fileName } = dialogAttachment.value
    await download({ blobId: id, fileName, projectId: props.projectId })
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: 'Download failed',
      description: ensureError(e).message
    })
  }
}

const attachmentList = computed(() => props.attachments?.text?.attachments || [])

const dialogButtons = computed((): Optional<LayoutDialogButton[]> => {
  if (!dialogAttachment.value) return undefined

  const button: LayoutDialogButton = {
    text: dialogAttachment.value.fileSize
      ? prettyFileSize(dialogAttachment.value.fileSize)
      : 'Download',
    props: {
      iconLeft: Download,
      color: 'outline'
    },
    onClick: () => {
      onDownloadClick()
    }
  }

  return [button]
})
</script>
