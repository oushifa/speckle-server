<template>
  <LayoutDialog
    v-model:open="openState"
    max-width="sm"
    hide-closer
    :buttons="dialogButtons"
  >
    <template #header>上传 RVT</template>
    <div class="flex flex-col gap-4">
      <FormTextInput
        v-model="modelName"
        color="foundation"
        name="modelName"
        label="模型名称"
        show-label
        placeholder="请输入模型名称"
        :rules="rules"
        :disabled="isBusy"
      />

      <div class="flex flex-col gap-2">
        <label for="rvtUploadFileInput" class="text-body-xs text-foreground-2">
          RVT 文件
        </label>
        <input
          id="rvtUploadFileInput"
          ref="fileInput"
          class="block w-full cursor-pointer rounded-md border border-outline-3 bg-foundation px-3 py-2 text-body-sm text-foreground"
          type="file"
          accept=".rvt"
          :disabled="isBusy"
          @change="onFileSelected"
        />
        <p v-if="selectedFileLabel" class="text-body-xs text-foreground-2">
          {{ selectedFileLabel }}
        </p>
      </div>

      <FormTextArea
        v-model="versionMessage"
        color="foundation"
        name="versionMessage"
        label="版本说明"
        show-label
        show-optional
        placeholder="Imported from RVT"
        size="lg"
        :disabled="isBusy"
      />

      <div
        v-if="currentStatusLabel || currentJob?.errorMessage"
        class="rounded-md border border-outline-3 bg-foundation-page px-3 py-2"
      >
        <p v-if="currentStatusLabel" class="text-body-xs text-foreground">
          当前状态：{{ currentStatusLabel }}
        </p>
        <p v-if="currentJob?.errorMessage" class="mt-1 text-body-xs text-danger">
          {{ currentJob.errorMessage }}
        </p>
      </div>
    </div>
  </LayoutDialog>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import { useForm } from 'vee-validate'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import type { ProjectPageLatestItemsModelItemFragment } from '~/lib/common/generated/gql/graphql'
import { prettyFileSize } from '~/lib/core/helpers/file'
import { useModelNameValidationRules } from '~/lib/projects/composables/modelManagement'
import type { RvtConversionJob } from '~/lib/projects/composables/useRvtConversion'
import { useRvtConversionFlow } from '~/lib/projects/composables/useRvtConversionFlow'

type FormValues = {
  modelName: string
}

const statusLabels: Record<string, string> = {
  pending: '等待派发',
  dispatched: '已派发到转换服务',
  acknowledged: '转换服务已接单',
  succeeded: '转换完成',
  failed: '转换失败'
}

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (
    e: 'submit',
    val: { model: ProjectPageLatestItemsModelItemFragment; job: RvtConversionJob }
  ): void
}>()

const props = defineProps<{
  open: boolean
  projectId: string
}>()

const { handleSubmit, resetForm } = useForm<FormValues>()
const { triggerNotification } = useGlobalToast()
const rules = useModelNameValidationRules()
const {
  buildModelNameFromFile,
  submit,
  reset,
  isProcessing,
  currentJob,
  statusMessage,
  getErrorMessage
} = useRvtConversionFlow()

const openState = computed({
  get: () => props.open,
  set: (newVal) => {
    if (!isBusy.value) {
      if (!newVal) {
        resetLocalState()
      }
      emit('update:open', newVal)
    }
  }
})

const fileInput = ref<HTMLInputElement | null>(null)
const modelName = ref('')
const versionMessage = ref('Imported from RVT')
const selectedFile = ref<File | null>(null)

const isBusy = computed(() => isProcessing.value)
const selectedFileLabel = computed(() => {
  if (!selectedFile.value) return ''
  return `${selectedFile.value.name}（${prettyFileSize(selectedFile.value.size)}）`
})
const currentStatusLabel = computed(() => {
  if (statusMessage.value && !currentJob.value) return statusMessage.value
  if (!currentJob.value) return ''
  return statusLabels[currentJob.value.status] || currentJob.value.status
})

const resetLocalState = () => {
  modelName.value = ''
  versionMessage.value = 'Imported from RVT'
  selectedFile.value = null
  reset()
  resetForm()
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const updateModelNameFromFile = (file: File) => {
  modelName.value = buildModelNameFromFile(file)
}

const onFileSelected = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return

  const file = target.files?.[0] || null
  selectedFile.value = file

  if (file) {
    updateModelNameFromFile(file)
  }
}

const onSubmit = handleSubmit(async () => {
  if (!selectedFile.value) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '请选择一个 RVT 文件'
    })
    return
  }

  if (!selectedFile.value.name.toLowerCase().endsWith('.rvt')) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '仅支持上传 .rvt 文件'
    })
    return
  }

  try {
    const { model, job } = await submit({
      projectId: props.projectId,
      file: selectedFile.value,
      modelName: modelName.value,
      versionMessage: versionMessage.value || undefined,
      sourceApplication: 'External RVT Converter'
    })

    triggerNotification({
      type: ToastNotificationType.Success,
      title: 'RVT 已提交并完成转换',
      description: job.versionId
        ? `已生成版本 ${job.versionId}`
        : '已生成新的 Speckle 版本'
    })

    emit('submit', {
      model: model as ProjectPageLatestItemsModelItemFragment,
      job: job as RvtConversionJob
    })
    openState.value = false
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: 'RVT 上传失败',
      description: getErrorMessage(error)
    })
  }
})

watch(
  () => props.open,
  (isOpen, oldIsOpen) => {
    if (isOpen && isOpen !== oldIsOpen) {
      resetLocalState()
    }
  }
)

const dialogButtons = computed((): LayoutDialogButton[] => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      openState.value = false
    },
    disabled: isBusy.value
  },
  {
    text: isBusy.value ? '处理中...' : '上传并转换',
    onClick: () => {
      onSubmit()
    },
    disabled: isBusy.value || !selectedFile.value
  }
])
</script>
