<template>
  <LayoutDialog v-model:open="open" max-width="lg" :buttons="dialogButtons">
    <template #header>
      {{
        props.readonly
          ? '工程量申报与验收详情'
          : initialData
          ? '编辑工程量申报与验收'
          : '工程量申报与验收'
      }}
    </template>
    <div class="space-y-4">
      <div class="text-body-sm text-foreground-2">填写验批信息</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="md:col-span-2">
          <div class="text-body-sm font-medium mb-2">
            清单项名称
            <span class="text-danger">*</span>
          </div>
          <BoqTreeSelect
            v-model="selectedChecklistId"
            :project-id="projectId || ''"
            :multiple="false"
            leaf="item"
            :disabled="loading || props.readonly"
            @selected="onChecklistSelected"
          />
        </div>
        <FormTextInput
          v-model="form.code"
          name="quality-acceptance-code"
          label="清单项编码"
          show-label
          show-required
          :disabled="true"
          placeholder="选择清单项后自动填充"
        />
        <FormTextInput
          v-model="form.inspectionLotNumber"
          name="quality-acceptance-inspection-lot-number"
          label="检验批号"
          show-label
          show-required
          placeholder="请输入检验批号"
          :disabled="props.readonly"
        />
        <FormTextInput
          v-model="form.acceptancePart"
          name="quality-acceptance-part"
          label="区域部位"
          show-label
          show-required
          placeholder="请输入验收部位，如：1层主体结构"
          bordered
          :disabled="props.readonly"
        />
        <FormTextArea
          v-model="form.acceptanceContent"
          name="quality-acceptance-content"
          label="验收内容"
          show-label
          show-required
          placeholder="请输入验收内容"
          bordered
          :disabled="props.readonly"
        />
        <FormTextInput
          v-model="actualFinishDateInput"
          name="quality-acceptance-actual-finish-date"
          label="验收时间"
          type="date"
          show-label
          show-required
          :disabled="props.readonly"
        />
        <FormTextInput
          v-model="workVolumeInput"
          name="quality-acceptance-work-volume"
          label="工程量"
          type="number"
          step="any"
          show-label
          show-required
          placeholder="请输入工程量"
          :disabled="props.readonly"
        />
        <FormTextInput
          v-model="form.unit"
          name="quality-acceptance-unit"
          label="计量单位"
          show-label
          show-required
          :disabled="true"
          placeholder="选择清单项后自动填充"
        />
        <div
          class="md:col-span-2"
          :class="props.readonly ? 'pointer-events-none opacity-80' : ''"
        >
          <CommonModelObjectMultiSelectDrawer
            v-model:model_id="bimModelId"
            v-model:application_ids="applicationIds"
            :project-id="props.projectId"
            placeholder="点击选择构件"
          />
        </div>
        <div class="md:col-span-2 space-y-2">
          <div class="text-body-sm font-medium">附件上传</div>
          <!-- 已有关联附件列表 -->
          <div v-if="existingAttachments.length" class="space-y-1.5 mb-2">
            <div class="text-body-xs font-medium text-foreground-2">已有关联附件：</div>
            <div class="grid grid-cols-1 gap-2">
              <div
                v-for="attachment in existingAttachments"
                :key="attachment.id"
                class="flex items-center justify-between p-2 rounded bg-foundation-2 border border-outline-3 text-body-xs"
              >
                <div class="flex items-center gap-1.5 truncate mr-2">
                  <Paperclip class="h-4 w-4 text-foreground-3 flex-shrink-0" />
                  <button
                    type="button"
                    class="truncate font-medium text-primary hover:text-primary-focus hover:underline text-left"
                    :title="attachment.fileName"
                    @click="() => handlePreviewAttachment(attachment)"
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
                    @click="() => handleDownloadExistingAttachment(attachment)"
                  >
                    <ArrowDownTrayIcon class="h-4 w-4" />
                  </button>
                  <button
                    v-if="!props.readonly"
                    type="button"
                    class="rounded p-1 text-foreground-2 transition-colors hover:text-danger"
                    title="删除附件"
                    @click="() => handleRemoveExistingAttachment(attachment.id)"
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
            :disabled="loading || !projectId || props.readonly"
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
                :disabled="loading || !projectId || props.readonly"
                @click.stop="openFilePicker"
              >
                选择文件
              </FormButton>
            </div>
          </FormFileUploadZone>
          <FormFileUploadProgress
            v-if="uploads.length"
            :items="uploads"
            :disabled="loading || props.readonly"
            @delete="onUploadDelete"
          />
        </div>
      </div>
      <div v-if="errorMessage" class="text-body-sm text-danger">{{ errorMessage }}</div>
    </div>
    <CommonConfirmDialog
      v-model:open="showDeleteConfirm"
      title="确认删除附件"
      text="确定要删除该附件吗？此操作在点击“确定”保存前不会真正修改，但保存后将无法恢复。"
      confirm-text="删除"
      @confirm="confirmRemoveExistingAttachment"
    />
    <!-- 附件预览 Dialog -->
    <LayoutDialog
      v-model:open="previewDialogOpen"
      max-width="xl"
      fullscreen="all"
      :buttons="previewDialogButtons"
    >
      <template #header>
        {{ selectedPreviewAttachment ? selectedPreviewAttachment.fileName : '附件预览' }}
      </template>
      <div v-if="selectedPreviewAttachment" class="flex flex-col gap-y-3 h-[70vh] md:h-[75vh]">
        <div class="w-full flex-1 h-full flex flex-col justify-center text-foreground text-body-xs px-6 pb-6 pt-2">
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
  </LayoutDialog>
</template>

<script setup lang="ts">
import { ArrowDownTrayIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { Paperclip } from 'lucide-vue-next'
import type { LayoutDialogButton } from '@speckle/ui-components'
import type { QualityAcceptanceCreateInput, QualityAcceptanceAttachment } from './types'
import BoqTreeSelect from '~/components/common/checklist/BoqTreeSelect.vue'
import { useAttachments, useFileDownload } from '~/lib/core/composables/fileUpload'
import { isSuccessfullyUploaded } from '~/lib/core/api/blobStorage'
import { useServerFileUploadLimit } from '~/lib/common/composables/serverInfo'
import { UniqueFileTypeSpecifier, prettyFileSize } from '~/lib/core/helpers/file'
import { acceptedFileExtensions } from '@speckle/shared/blobs'
import { CommonModelObjectMultiSelectDrawer } from '#components'

const props = withDefaults(
  defineProps<{
    projectId?: string | null
    loading?: boolean
    initialData?: QualityAcceptanceCreateInput | null
    initialAttachments?: QualityAcceptanceAttachment[]
    readonly?: boolean
  }>(),
  {
    projectId: null,
    loading: false,
    initialData: null,
    initialAttachments: () => [],
    readonly: false
  }
)

const emit = defineEmits<{
  (e: 'submit', payload: QualityAcceptanceCreateInput): void
}>()

const open = defineModel<boolean>('open', { required: true })

const createDefaultForm = (): QualityAcceptanceCreateInput => ({
  flowId: '',
  name: '',
  boqItemId: '',
  code: '',
  inspectionLotNumber: '',
  acceptancePart: '',
  acceptanceContent: '',
  actualStartDate: 0,
  actualFinishDate: 0,
  inspector: '',
  attachments: [],
  creator: '',
  workVolume: 0,
  unit: '',
  BIM: null,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  approveStatus: null
})

const form = ref<QualityAcceptanceCreateInput>(createDefaultForm())
const uploadZone = ref<{ triggerPicker: () => void } | null>(null)
const selectedChecklistId = ref<string | null>(null)
const actualStartDateInput = ref('')
const actualFinishDateInput = ref('')
const workVolumeInput = ref('')
const bimProjectId = ref<string | null>(null)
const bimModelId = ref<string | null>(null)
const errorMessage = ref('')
const { maxSizeInBytes } = useServerFileUploadLimit()
const { onFilesSelected, uploads, onUploadDelete, blobIds } = useAttachments({
  projectId: computed(() => props.projectId || '')
})
const acceptValue = [
  UniqueFileTypeSpecifier.AnyImage,
  ...acceptedFileExtensions.map((fileExtension) => `.${fileExtension}`)
].join(',')

const applicationIds = computed<string[]>({
  get: () => form.value.BIM?.[0]?.applicationIds || [],
  set: (value) => {
    form.value.BIM = [
      {
        modelId: bimModelId.value || '',
        bimIds: (value || []).map(() => null),
        applicationIds: value || []
      }
    ]
  }
})

const onChecklistSelected = (
  items: Array<{ id: string; code: string; name: string; unit: string }>
) => {
  const first = items[0]
  if (!first) return
  form.value.boqItemId = first.id
  form.value.name = first.name
  form.value.code = first.code
  form.value.unit = first.unit || ''
}

const openFilePicker = () => {
  uploadZone.value?.triggerPicker()
}

// 附件管理相关状态与方法
const existingAttachments = ref<QualityAcceptanceAttachment[]>([])
const showDeleteConfirm = ref(false)
const attachmentIdToDelete = ref<string | null>(null)

const { download } = useFileDownload()

const handleDownloadExistingAttachment = async (attachment: QualityAcceptanceAttachment) => {
  if (!props.projectId) return
  try {
    await download({
      blobId: attachment.id,
      fileName: attachment.fileName,
      projectId: props.projectId
    })
  } catch (err) {
    console.error('Failed to download attachment:', err)
  }
}

const formatAttachmentFileSize = (size: number | null) =>
  size ? prettyFileSize(size) : '未知大小'

const handleRemoveExistingAttachment = (id: string) => {
  attachmentIdToDelete.value = id
  showDeleteConfirm.value = true
}

const confirmRemoveExistingAttachment = () => {
  if (attachmentIdToDelete.value) {
    existingAttachments.value = existingAttachments.value.filter(
      (a) => a.id !== attachmentIdToDelete.value
    )
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

const formatDateInput = (value: number) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const validate = () => {
  if (!form.value.name.trim()) return '请先选择清单项名称'
  if (!form.value.boqItemId.trim()) return '清单项不能为空'
  if (!form.value.code.trim()) return '清单项编码不能为空'
  if (!form.value.inspectionLotNumber.trim()) return '检验批号不能为空'
  if (!form.value.acceptancePart.trim()) return '验收部位不能为空'
  if (!actualFinishDateInput.value) return '实际结束时间不能为空'
  if (workVolumeInput.value === '') return '工程量不能为空'
  if (!form.value.unit.trim()) return '计量单位不能为空'
  return ''
}

const resetForm = () => {
  form.value = createDefaultForm()
  selectedChecklistId.value = null
  actualStartDateInput.value = ''
  actualFinishDateInput.value = ''
  workVolumeInput.value = ''
  bimProjectId.value = null
  bimModelId.value = null
  uploads.value = []
  existingAttachments.value = []
  selectedPreviewAttachment.value = null
  previewDialogOpen.value = false
  errorMessage.value = ''
}

const fillFormFromInitialData = (data: QualityAcceptanceCreateInput) => {
  form.value = {
    ...createDefaultForm(),
    ...data,
    attachments: data.attachments || []
  }
  selectedChecklistId.value = data.boqItemId || null
  actualStartDateInput.value = formatDateInput(data.actualStartDate)
  actualFinishDateInput.value = formatDateInput(data.actualFinishDate)
  workVolumeInput.value = `${data.workVolume || ''}`
  bimProjectId.value = null
  bimModelId.value = data.BIM?.[0]?.modelId || null
  uploads.value = []
  existingAttachments.value = props.initialAttachments ? [...props.initialAttachments] : []
  selectedPreviewAttachment.value = null
  previewDialogOpen.value = false
  errorMessage.value = ''
}

const submit = () => {
  const error = validate()
  if (error) {
    errorMessage.value = error
    return
  }
  const workVolume = Number(workVolumeInput.value)
  if (Number.isNaN(workVolume)) {
    errorMessage.value = '工程量格式不正确'
    return
  }
  const actualFinishDate = new Date(actualFinishDateInput.value).getTime()
  if (!actualFinishDate) {
    errorMessage.value = '结束时间格式不正确'
    return
  }
  const hasPendingUploads = uploads.value.some(
    (upload) => !upload.error && !isSuccessfullyUploaded(upload)
  )
  if (hasPendingUploads) {
    errorMessage.value = '附件上传中，请稍后再提交'
    return
  }
  emit('submit', {
    ...form.value,
    name: form.value.name.trim(),
    boqItemId: form.value.boqItemId.trim(),
    code: form.value.code.trim(),
    flowId: form.value.flowId?.trim() || undefined,
    inspectionLotNumber: form.value.inspectionLotNumber.trim(),
    acceptancePart: form.value.acceptancePart.trim(),
    acceptanceContent: form.value.acceptanceContent.trim(),
    inspector: form.value.inspector.trim(),
    workVolume,
    actualFinishDate,
    attachments: Array.from(
      new Set([
        ...existingAttachments.value.map((a) => a.id),
        ...blobIds.value
      ])
    ),
    BIM:
      form.value.BIM && form.value.BIM[0] && form.value.BIM[0].applicationIds.length
        ? [
            {
              modelId: form.value.BIM[0].modelId || '',
              bimIds: form.value.BIM[0].applicationIds.map(() => null),
              applicationIds: form.value.BIM[0].applicationIds
            }
          ]
        : null,
    timeZone: form.value.timeZone.trim()
  })
  open.value = false
}

watch(bimModelId, (modelId) => {
  if (!form.value.BIM && !modelId) return
  form.value.BIM = [
    {
      modelId: modelId || '',
      bimIds: (form.value.BIM?.[0]?.applicationIds || []).map(() => null),
      applicationIds: form.value.BIM?.[0]?.applicationIds || []
    }
  ]
})

const dialogButtons = computed((): LayoutDialogButton[] => {
  if (props.readonly) {
    return [
      {
        text: '关闭',
        props: { color: 'outline' },
        onClick: () => {
          open.value = false
        }
      }
    ]
  }

  return [
    {
      text: '取消',
      props: { color: 'outline' },
      onClick: () => {
        open.value = false
      }
    },
    {
      text: '确定',
      props: {
        color: 'primary',
        loading: props.loading
      },
      disabled: !!props.loading,
      onClick: submit
    }
  ]
})

watch(
  () => open.value,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      if (props.initialData) fillFormFromInitialData(props.initialData)
      else resetForm()
    }
  }
)
</script>
