<!-- eslint-disable vuejs-accessibility/no-static-element-interactions -->
<!-- eslint-disable vuejs-accessibility/click-events-have-key-events -->
<template>
  <FormFileUploadZone
    ref="uploadZone"
    v-slot="{ isDraggingFiles, openFilePicker }"
    :disabled="isBusy || isDisabled"
    :size-limit="maxSizeInBytes"
    :accept="acceptWithRvt"
    class="flex items-center h-full"
    @files-selected="handleFilesSelected"
  >
    <div
      class="w-full h-full border-dashed border rounded-md p-4 flex items-center justify-center text-sm"
      :class="[getDashedBorderClasses(isDraggingFiles)]"
    >
      <div
        v-if="fileUpload || rvtSelectedFile"
        class="max-w-sm p-2 flex flex-col justify-center space-y-1 text-foreground-2"
      >
        <span class="text-center">
          {{ activeFileName }}
        </span>
        <span
          v-if="activeErrorMessage"
          class="text-danger inline-flex space-x-1 items-center text-center"
        >
          <ExclamationTriangleIcon class="h-4 w-4 shrink-0" />
          <span>{{ activeErrorMessage }}</span>
        </span>
        <span
          v-else-if="rvtSelectedFile && rvtStatusLabel"
          class="text-center text-body-xs text-foreground"
        >
          {{ rvtStatusLabel }}
        </span>
        <div
          v-else-if="fileUpload"
          :class="['w-full mt-2', progressBarClasses]"
          :style="progressBarStyle"
        />
      </div>
      <div v-else :class="containerClasses">
        <div :class="illustrationClasses">
          <IllustrationEmptystateProject v-if="emptyStateVariant === 'modelsSection'" />
          <IllustrationEmptystateProjectTab v-else />
        </div>

        <div>
          <p v-if="emptyStateHeading" :class="emptyStateHeadingClasses">
            {{ emptyStateHeading }}
          </p>
          <p v-if="!isDisabled" :class="paragraphClasses">
            使用连接器发布{{ modelName ? '' : '新的模型' }}版本到{{
              modelName ? '该模型' : '该项目'
            }},或者拖拽
            <span
              v-if="isRhinoFileImporterEnabled"
              v-tippy="
                ['ifc', ...Array.from(rhinoImporterSupportedFileExtensions)].join(', ')
              "
              class="underline"
            >
              支持的文件
            </span>
            <span v-else>IFC 文件</span>
            到这里上传。
          </p>
          <p v-if="!isDisabled" class="text-body-xs text-foreground-2 mt-1 p-0">
            `.rvt` 文件会自动走专用转换链路。
          </p>
          <!-- <p v-if="!isDisabled" :class="paragraphClasses">
            Use
            <NuxtLink :to="connectorsRoute" class="font-medium">
              <span class="underline">connectors</span>
            </NuxtLink>
            to publish a {{ modelName ? '' : 'new model' }} version to
            {{ modelName ? 'this model' : 'this project' }}, or drag and drop
            <span
              v-if="isRhinoFileImporterEnabled"
              v-tippy="
                ['ifc', ...Array.from(rhinoImporterSupportedFileExtensions)].join(', ')
              "
              class="underline"
            >
              a supported file here.
            </span>
            <span v-else>an IFC file.</span>
          </p> -->
          <div v-if="showEmptyState && !isDisabled" :class="buttonsClasses">
            <FormButton :to="connectorsRoute" size="sm" color="outline">
              安装连接器
            </FormButton>
            <FormButton size="sm" color="outline" @click="openFilePicker">
              上传文件
            </FormButton>
          </div>
        </div>
      </div>
    </div>
    <ProjectPageModelsNewDialog
      v-model:open="showNewModelDialog"
      :project-id="project.id"
      :model-name="fileUpload?.file.name"
      @submit="onModelCreate"
    />
  </FormFileUploadZone>
</template>
<script setup lang="ts">
import {
  useFileImport,
  useGlobalFileImportManager
} from '~~/lib/core/composables/fileImport'
import { useFileUploadProgressCore } from '~~/lib/form/composables/fileUpload'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/solid'
import type { UploadFileItem, UploadableFileItem } from '@speckle/ui-components'
import { connectorsRoute } from '~/lib/common/helpers/route'
import type { Nullable } from '@speckle/shared'
import { graphql } from '~/lib/common/generated/gql'
import type {
  ProjectCardImportFileArea_ModelFragment,
  ProjectCardImportFileArea_ProjectFragment,
  ProjectPageLatestItemsModelItemFragment
} from '~/lib/common/generated/gql/graphql'
import type { FileAreaUploadingPayload } from '~/lib/form/helpers/fileUpload'
import { rhinoImporterSupportedFileExtensions } from '@speckle/shared/blobs'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { useRvtConversionFlow } from '~/lib/projects/composables/useRvtConversionFlow'

type EmptyStateVariants = 'modelGrid' | 'modelList' | 'modelsSection'

graphql(`
  fragment ProjectCardImportFileArea_Project on Project {
    id
    permissions {
      canCreateModel {
        ...FullPermissionCheckResult
      }
    }
    ...UseFileImport_Project
  }
`)

graphql(`
  fragment ProjectCardImportFileArea_Model on Model {
    id
    name
    permissions {
      canCreateVersion {
        ...FullPermissionCheckResult
      }
    }
    ...UseFileImport_Model
  }
`)

const emit = defineEmits<{
  /**
   * Emits when files start/finish uploading
   */
  uploading: [payload: FileAreaUploadingPayload]
}>()

const props = defineProps<{
  project: ProjectCardImportFileArea_ProjectFragment
  model?: ProjectCardImportFileArea_ModelFragment
  modelName?: string
  emptyStateVariant?: EmptyStateVariants
}>()

const isRhinoFileImporterEnabled = useIsRhinoFileImporterEnabled()
const { addFailedJob } = useGlobalFileImportManager()
const { triggerNotification } = useGlobalToast()
const {
  maxSizeInBytes,
  onFilesSelected,
  accept,
  upload: fileUpload,
  isUploading,
  uploadSelected,
  resetSelected,
  isUploadable: isFileUploadUploadable
} = useFileImport({
  ...toRefs(props),
  manuallyTriggerUpload: true,
  fileSelectedCallback: () => {
    if (props.model) {
      // Uploading inside an existing model - trigger upload immediately
      uploadSelected()
    } else {
      if (!fileUpload.value?.error) {
        // Only if upload is valid, trigger model creation dialog
        showNewModelDialog.value = true
      }
    }
  },
  errorCallback: ({ failedJob }) => {
    // Register global file upload error and reset upload
    addFailedJob(failedJob)
    resetSelected()
  }
})
const {
  submit: submitRvt,
  reset: resetRvtState,
  isProcessing: isRvtUploading,
  currentJob: currentRvtJob,
  statusMessage: rvtStatusMessage,
  getErrorMessage: getRvtErrorMessage
} = useRvtConversionFlow()

const { errorMessage, progressBarClasses, progressBarStyle } =
  useFileUploadProgressCore({
    item: fileUpload
  })

const uploadZone = ref(
  null as Nullable<{
    triggerPicker: () => void
  }>
)
const showNewModelDialog = ref(false)
const rvtSelectedFile = ref<File | null>(null)
const rvtErrorMessage = ref<string | null>(null)

const modelName = computed(() => props.modelName || props.model?.name)
const acceptWithRvt = computed(() => {
  if (accept.value.includes('.rvt')) return accept.value
  return `${accept.value},.rvt`
})
const accessCheck = computed(() => {
  return props.model
    ? props.model.permissions.canCreateVersion
    : props.project.permissions.canCreateModel
})
const isDisabled = computed(() => !accessCheck.value.authorized)
const isBusy = computed(() => isUploading.value || isRvtUploading.value)
const activeFileName = computed(() => {
  if (rvtSelectedFile.value) return rvtSelectedFile.value.name
  return fileUpload.value?.file.name || ''
})
const activeErrorMessage = computed(
  () => rvtErrorMessage.value || errorMessage.value || null
)
const rvtStatusLabel = computed(() => {
  if (!rvtSelectedFile.value || rvtErrorMessage.value) return ''
  if (rvtStatusMessage.value) return rvtStatusMessage.value

  const status = currentRvtJob.value?.status
  if (status === 'pending') return '等待派发'
  if (status === 'dispatched') return '已派发到转换服务'
  if (status === 'acknowledged') return '转换服务已接单'
  if (status === 'succeeded') return '转换完成'
  if (status === 'failed') return '转换失败'

  return isRvtUploading.value ? '正在处理...' : ''
})

const showEmptyState = computed(
  () =>
    props.emptyStateVariant !== 'modelGrid' && props.emptyStateVariant !== 'modelList'
)
const emptyStateHeading = computed(() => {
  if (showEmptyState.value) {
    return props.emptyStateVariant === 'modelsSection' ? '该项目暂无模型' : '暂无模型'
    return props.emptyStateVariant === 'modelsSection'
      ? 'The project has no models, yet.'
      : 'No models, yet.'
  }

  if (isDisabled.value) {
    return modelName.value ? '改模型暂无历史版本' : '该项目暂无模型'
    return modelName.value
      ? 'The model has no versions, yet.'
      : 'The project has no models, yet.'
  }

  return undefined
})

const emptyStateHeadingClasses = computed(() => {
  const classParts = ['text-foreground-2 text-heading-sm p-0 m-0 ']

  if (isDisabled.value) {
    classParts.push('text-balance text-center')
  }

  return classParts.join(' ')
})

const containerClasses = computed(() => {
  const classParts = ['w-full flex justify-center items-center']

  if (props.emptyStateVariant === 'modelGrid') {
    classParts.push('p-4 gap-4')
  } else if (props.emptyStateVariant === 'modelList') {
    classParts.push('gap-4 text-center')
  } else if (props.emptyStateVariant === 'modelsSection') {
    classParts.push('p-4 gap-4 text-balance')
  } else {
    classParts.push('p-20 gap-8 text-balance flex-col text-center')
  }

  return classParts.join(' ')
})

const illustrationClasses = computed(() => {
  const classParts = ['max-w-lg']

  if (props.emptyStateVariant === 'modelGrid') {
    classParts.push('hidden')
  } else if (props.emptyStateVariant === 'modelList') {
    classParts.push('hidden')
  } else if (props.emptyStateVariant === 'modelsSection') {
    classParts.push('hidden min-[1350px]:block')
  } else {
    classParts.push('')
  }

  return classParts.join(' ')
})

const paragraphClasses = computed(() => {
  const classParts = ['text-body-xs text-foreground-2 mt-2 p-0']

  if (props.emptyStateVariant === 'modelGrid') {
    classParts.push('')
  } else if (props.emptyStateVariant === 'modelList') {
    classParts.push('')
  } else if (props.emptyStateVariant === 'modelsSection') {
    classParts.push('max-w-sm')
  } else {
    classParts.push('max-w-sm')
  }

  return classParts.join(' ')
})

const buttonsClasses = computed(() => {
  const classParts = ['w-full flex flex-row gap-2 flex-wrap']

  if (props.emptyStateVariant === 'modelGrid') {
    classParts.push('mt-3')
  } else if (props.emptyStateVariant === 'modelList') {
    classParts.push('mt-3')
  } else if (props.emptyStateVariant === 'modelsSection') {
    classParts.push('mt-3')
  } else {
    classParts.push('justify-center mt-6')
  }

  return classParts.join(' ')
})

const getDashedBorderClasses = (isDraggingFiles: boolean) => {
  if (isDraggingFiles) return 'border-primary'
  if (activeErrorMessage.value) return 'border-danger'

  return 'border-outline-2'
}

const emitUploadingState = (params: {
  isUploading: boolean
  file: File
  error: string | null
}) => {
  emit('uploading', {
    isUploading: params.isUploading,
    error: params.error,
    upload: {
      id: `rvt-${params.file.name}`,
      file: params.file,
      error: params.error ? new Error(params.error) : null,
      progress: params.isUploading ? 0 : 100,
      result: undefined
    } as UploadFileItem
  })
}

const isRvtUploadableFile = (file: UploadableFileItem) =>
  file.file.name.toLowerCase().endsWith('.rvt')

const handleRvtFileSelected = async (fileItem: UploadableFileItem) => {
  rvtSelectedFile.value = fileItem.file
  rvtErrorMessage.value = null
  resetSelected()

  if (fileItem.error) {
    const description = fileItem.error.message
    rvtErrorMessage.value = description
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: 'RVT 上传失败',
      description
    })
    emitUploadingState({
      isUploading: false,
      file: fileItem.file,
      error: description
    })
    return
  }

  emitUploadingState({
    isUploading: true,
    file: fileItem.file,
    error: null
  })

  try {
    const result = await submitRvt({
      projectId: props.project.id,
      file: fileItem.file,
      model: props.model
        ? {
            id: props.model.id,
            name: props.model.name
          }
        : undefined,
      modelName: props.model ? props.model.name : undefined,
      sourceApplication: 'External RVT Converter'
    })

    triggerNotification({
      type: ToastNotificationType.Success,
      title: 'RVT 已提交并完成转换',
      description: result.job.versionId
        ? `已生成版本 ${result.job.versionId}`
        : '已生成新的 Speckle 版本'
    })

    emitUploadingState({
      isUploading: false,
      file: fileItem.file,
      error: null
    })
  } catch (error) {
    const description = getRvtErrorMessage(error)
    rvtErrorMessage.value = description
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: 'RVT 上传失败',
      description
    })
    emitUploadingState({
      isUploading: false,
      file: fileItem.file,
      error: description
    })
  }
}

const handleFilesSelected = async (params: { files: UploadableFileItem[] }) => {
  const file = params.files[0]
  if (!file) return

  if (isRvtUploadableFile(file)) {
    await handleRvtFileSelected(file)
    return
  }

  rvtSelectedFile.value = null
  rvtErrorMessage.value = null
  resetRvtState()
  await onFilesSelected(params)
}

const onModelCreate = (params: { model: ProjectPageLatestItemsModelItemFragment }) => {
  if (!isFileUploadUploadable.value) return

  uploadSelected({
    model: params.model
  })
}

const triggerPicker = () => {
  uploadZone.value?.triggerPicker()
}

watch(showNewModelDialog, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    // Should we unselect file? Only if model was not created
    if (!isBusy.value) {
      resetSelected()
    }
  }
})

watch(isUploading, (newVal, oldVal) => {
  // fileUpload is always gonna be non-null when isUploading changes
  emit('uploading', {
    isUploading: newVal,
    upload: fileUpload.value!,
    error: errorMessage.value
  })

  if (!newVal && oldVal) {
    // Reset file upload state when upload finishes
    resetSelected()
  }
})

defineExpose({
  triggerPicker
})
</script>
