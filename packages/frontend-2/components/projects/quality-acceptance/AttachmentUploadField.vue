<template>
  <div class="space-y-2">
    <div class="text-body-sm font-medium">{{ label }}</div>
    <!-- 已有关联附件列表 -->
    <div v-if="existing.length" class="space-y-1.5 mb-2">
      <div class="text-body-xs font-medium text-foreground-2">
        已有关联{{ label }}：
      </div>
      <div class="grid grid-cols-1 gap-2">
        <div
          v-for="attachment in existing"
          :key="attachment.id"
          class="flex items-center justify-between p-2 rounded bg-foundation-2 border border-outline-3 text-body-xs"
        >
          <div class="flex items-center gap-1.5 truncate mr-2">
            <Paperclip class="h-4 w-4 text-foreground-3 flex-shrink-0" />
            <button
              type="button"
              class="truncate font-medium text-primary hover:text-primary-focus hover:underline text-left"
              :title="attachment.fileName"
              @click="handlePreviewAttachment(attachment)"
            >
              {{ attachment.fileName }}
            </button>
            <span class="text-foreground-3 flex-shrink-0 text-[11px]">
              ({{ formatAttachmentFileSize(attachment.fileSize) }})
            </span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              class="rounded p-1 text-foreground-2 transition-colors hover:text-primary"
              title="下载附件"
              @click="handleDownloadExistingAttachment(attachment)"
            >
              <ArrowDownTrayIcon class="h-4 w-4" />
            </button>
            <button
              v-if="!props.readonly"
              type="button"
              class="rounded p-1 text-foreground-2 transition-colors hover:text-danger"
              :title="`删除${label}`"
              @click="handleRemoveExistingAttachment(attachment.id)"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <FormFileUploadZone
      ref="uploadZone"
      v-slot="{ isDraggingFiles }"
      :size-limit="maxSizeInBytes"
      :accept="acceptValue"
      :disabled="props.disabled || !projectId || props.readonly"
      multiple
      @files-selected="onFilesSelected"
    >
      <div
        class="rounded border border-dashed border-outline-3 p-3 flex items-center justify-between"
        :class="isDraggingFiles ? 'bg-foundation-2' : ''"
      >
        <span class="text-body-sm text-foreground-2">
          拖拽文件到此处，或点击右侧按钮上传
        </span>
        <FormButton
          color="outline"
          size="sm"
          :disabled="props.disabled || !projectId || props.readonly"
          @click.stop="openFilePicker"
        >
          选择文件
        </FormButton>
      </div>
    </FormFileUploadZone>
    <FormFileUploadProgress
      v-if="uploads.length"
      :items="uploads"
      :disabled="props.disabled || props.readonly"
      @delete="onUploadDelete"
    />
    <!-- 附件预览 Dialog -->
    <LayoutDialog
      v-model:open="previewDialogOpen"
      max-width="xl"
      fullscreen="all"
      :buttons="previewDialogButtons"
    >
      <template #header>
        {{
          selectedPreviewAttachment
            ? selectedPreviewAttachment.fileName
            : `${label}预览`
        }}
      </template>
      <div
        v-if="selectedPreviewAttachment"
        class="flex flex-col gap-y-3 h-[70vh] md:h-[75vh]"
      >
        <div
          class="w-full flex-1 h-full flex flex-col justify-center text-foreground text-body-xs px-6 pb-6 pt-2"
        >
          <CommonFilePreview
            :blob-id="selectedPreviewAttachment.id"
            :project-id="props.projectId || ''"
            :file-name="selectedPreviewAttachment.fileName"
            :file-type="selectedPreviewAttachment.fileType"
            :file-size="selectedPreviewAttachment.fileSize"
            class="w-full flex-1 h-full"
          />
        </div>
      </div>
    </LayoutDialog>
    <CommonConfirmDialog
      v-model:open="showDeleteConfirm"
      :title="`确认删除${label}`"
      :text="`确定要删除该${label}吗？此操作在点击“确定”保存前不会真正修改，但保存后将无法恢复。`"
      confirm-text="删除"
      @confirm="confirmRemoveExistingAttachment"
    />
  </div>
</template>

<script setup lang="ts">
import { ArrowDownTrayIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { Paperclip } from 'lucide-vue-next'
import type { Nullable } from '@speckle/shared'
import type { LayoutDialogButton } from '@speckle/ui-components'
import type { QualityAcceptanceAttachment } from './types'
import { useAttachments, useFileDownload } from '~/lib/core/composables/fileUpload'
import { isSuccessfullyUploaded } from '~/lib/core/api/blobStorage'
import { useServerFileUploadLimit } from '~/lib/common/composables/serverInfo'
import { UniqueFileTypeSpecifier, prettyFileSize } from '~/lib/core/helpers/file'
import { acceptedFileExtensions } from '@speckle/shared/blobs'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { ensureError } from '@speckle/shared'

const props = withDefaults(
  defineProps<{
    /** 字段名，用于标题与删除确认文案，如「附件」「过程文件」 */
    label: string
    projectId?: string | null
    /** 表单正在提交等场景下禁用上传 */
    disabled?: boolean
    readonly?: boolean
  }>(),
  {
    projectId: null,
    disabled: false,
    readonly: false
  }
)

/** 已保存的附件（含本次会话中被移除的），由父组件持有 */
const existing = defineModel<QualityAcceptanceAttachment[]>('existing', {
  required: true
})
/** 本次新上传成功的 blob id，父组件提交时与 existing 合并 */
const newBlobIds = defineModel<string[]>('newBlobIds', { required: true })

const uploadZone = ref(null as Nullable<{ triggerPicker: () => void }>)
const { triggerNotification } = useGlobalToast()
const { maxSizeInBytes } = useServerFileUploadLimit()
const { onFilesSelected, uploads, onUploadDelete, blobIds } = useAttachments({
  projectId: computed(() => props.projectId || '')
})
const acceptValue = [
  UniqueFileTypeSpecifier.AnyImage,
  ...acceptedFileExtensions.map((fileExtension) => `.${fileExtension}`)
].join(',')

watch(
  blobIds,
  (ids) => {
    newBlobIds.value = [...ids]
  },
  { immediate: true }
)

const openFilePicker = () => {
  uploadZone.value?.triggerPicker()
}

const { download } = useFileDownload()

const handleDownloadExistingAttachment = async (
  attachment: QualityAcceptanceAttachment
) => {
  if (!props.projectId) return
  try {
    await download({
      blobId: attachment.id,
      fileName: attachment.fileName,
      projectId: props.projectId
    })
  } catch (err) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '附件下载失败',
      description: ensureError(err, '未知错误').message
    })
  }
}

const formatAttachmentFileSize = (size: number | null) =>
  size ? prettyFileSize(size) : '未知大小'

const showDeleteConfirm = ref(false)
const attachmentIdToDelete = ref<string | null>(null)

const handleRemoveExistingAttachment = (id: string) => {
  attachmentIdToDelete.value = id
  showDeleteConfirm.value = true
}

const confirmRemoveExistingAttachment = () => {
  if (attachmentIdToDelete.value) {
    existing.value = existing.value.filter((a) => a.id !== attachmentIdToDelete.value)
    attachmentIdToDelete.value = null
  }
}

// 附件预览状态与方法
const previewDialogOpen = ref(false)
const selectedPreviewAttachment = ref<QualityAcceptanceAttachment | null>(null)

const handlePreviewAttachment = (attachment: QualityAcceptanceAttachment) => {
  selectedPreviewAttachment.value = attachment
  previewDialogOpen.value = true
}

const previewDialogButtons = computed((): LayoutDialogButton[] => {
  if (!selectedPreviewAttachment.value) return []
  return [
    {
      text: selectedPreviewAttachment.value.fileSize
        ? prettyFileSize(selectedPreviewAttachment.value.fileSize)
        : '下载',
      props: {
        iconLeft: ArrowDownTrayIcon,
        color: 'outline'
      },
      onClick: () => {
        if (selectedPreviewAttachment.value) {
          void handleDownloadExistingAttachment(selectedPreviewAttachment.value)
        }
      }
    },
    {
      text: '关闭',
      props: { color: 'outline' },
      onClick: () => {
        previewDialogOpen.value = false
      }
    }
  ]
})

/** 是否还有未完成的上传（提交前需要拦截） */
const hasPendingUploads = () =>
  uploads.value.some((upload) => !upload.error && !isSuccessfullyUploaded(upload))

/**
 * 附件已随表单提交，标记为已使用，防止 useAttachments 在组件卸载/重置时
 * 把这些 blob 当作未提交的垃圾附件删除（否则切换页面后已保存的关联文件会丢失）
 */
const markUploadsInUse = () => {
  for (const upload of uploads.value) {
    if (upload.inUse) continue
    if (isSuccessfullyUploaded(upload)) {
      upload.inUse = true
    }
  }
}

/** 清空本次未提交的上传队列（表单重置 / 重新打开时调用） */
const resetUploads = () => {
  uploads.value = []
}

defineExpose({ hasPendingUploads, markUploadsInUse, resetUploads })
</script>
