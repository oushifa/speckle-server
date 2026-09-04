<template>
  <LayoutDialog v-model:open="isOpen" max-width="lg" prevent-close-on-click-outside>
    <template #header>
      {{ props.initialRecord ? '编辑年度计划' : '新增年度计划' }}
    </template>

    <div class="space-y-4 py-2">
      <!-- 年度计划基础信息（不含状态字段） -->
      <div
        class="grid grid-cols-1 gap-4 rounded-lg border border-outline-2 bg-foundation-page p-4 md:grid-cols-2"
      >
        <div class="flex flex-col gap-1.5">
          <label
            for="annual-plan-year"
            class="text-body-sm font-medium text-foreground"
          >
            年份
            <span class="text-danger">*</span>
          </label>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-outline-3 bg-foundation text-foreground-2 transition hover:border-primary hover:text-primary"
              :disabled="!form.year || form.year <= 2000"
              aria-label="上一年"
              @click="form.year = Math.max(2000, (form.year || currentYear) - 1)"
            >
              <Minus class="h-4 w-4" />
            </button>
            <input
              id="annual-plan-year"
              v-model.number="form.year"
              type="number"
              min="2000"
              max="2200"
              step="1"
              class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none transition focus:border-primary"
            />
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-outline-3 bg-foundation text-foreground-2 transition hover:border-primary hover:text-primary"
              :disabled="!form.year || form.year >= 2200"
              aria-label="下一年"
              @click="form.year = Math.min(2200, (form.year || currentYear) + 1)"
            >
              <Plus class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label
            for="annual-plan-name"
            class="text-body-sm font-medium text-foreground"
          >
            计划名称
            <span class="text-danger">*</span>
          </label>
          <input
            id="annual-plan-name"
            v-model="form.name"
            type="text"
            maxlength="100"
            placeholder="如：2026年度施工进度计划"
            class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none transition focus:border-primary"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label
            for="annual-plan-start"
            class="text-body-sm font-medium text-foreground"
          >
            开始日期
            <span class="text-danger">*</span>
          </label>
          <input
            id="annual-plan-start"
            v-model="form.startDate"
            type="date"
            class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none transition focus:border-primary"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="annual-plan-end" class="text-body-sm font-medium text-foreground">
            结束日期
            <span class="text-danger">*</span>
          </label>
          <input
            id="annual-plan-end"
            v-model="form.endDate"
            type="date"
            :min="form.startDate || undefined"
            class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none transition focus:border-primary"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label
            for="annual-plan-prepared-by"
            class="text-body-sm font-medium text-foreground"
          >
            编制人
          </label>
          <input
            id="annual-plan-prepared-by"
            v-model="form.preparedBy"
            type="text"
            maxlength="50"
            placeholder="输入编制人姓名"
            class="h-8 w-full rounded-md border border-outline-3 bg-foundation px-2 text-body-sm outline-none transition focus:border-primary"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label
            for="annual-plan-attachment"
            class="text-body-sm font-medium text-foreground"
          >
            附件
          </label>
          <div class="flex items-center gap-2">
            <label
              for="annual-plan-attachment"
              class="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-outline-3 bg-foundation px-3 text-body-sm text-foreground-2 transition hover:border-primary hover:text-primary"
            >
              <Paperclip class="h-3.5 w-3.5" />
              {{ form.fileName || '选择附件文件' }}
            </label>
            <input
              id="annual-plan-attachment"
              ref="attachmentInputRef"
              type="file"
              class="hidden"
              accept=".mpp,.xml,.xlsx,.xls,.pdf,.doc,.docx"
              @change="handleAttachmentChange"
            />
            <button
              v-if="form.fileName"
              type="button"
              class="inline-flex h-8 shrink-0 items-center rounded-md border border-outline-3 px-2 text-body-xs text-foreground-2 transition hover:border-danger hover:text-danger"
              @click="clearAttachment"
            >
              移除
            </button>
          </div>
          <span v-if="form.fileName" class="text-body-3xs text-foreground-2">
            附件仅作为计划说明存档，导入任务请在年度计划详情页上传 .mpp 文件。
          </span>
        </div>

        <div class="flex flex-col gap-1.5 md:col-span-2">
          <label
            for="annual-plan-remark"
            class="text-body-sm font-medium text-foreground"
          >
            备注
          </label>
          <textarea
            id="annual-plan-remark"
            v-model="form.remark"
            rows="3"
            maxlength="500"
            placeholder="输入备注信息"
            class="w-full rounded-lg border border-outline-3 bg-foundation px-3 py-2 text-body-sm outline-none transition focus:border-primary"
          />
          <div class="text-right text-body-3xs text-foreground-2">
            {{ (form.remark || '').length }}/500
          </div>
        </div>
      </div>
    </div>

    <template #buttons>
      <FormButton color="outline" @click="isOpen = false">取消</FormButton>
      <FormButton
        color="primary"
        :disabled="!isValid || isSaving"
        :loading="isSaving"
        @click="handleSave"
      >
        {{ props.initialRecord ? '保存修改' : '创建年度计划' }}
      </FormButton>
    </template>
  </LayoutDialog>
</template>

<script setup lang="ts">
import { FormButton, LayoutDialog } from '@speckle/ui-components'
import { Minus, Paperclip, Plus } from 'lucide-vue-next'
import type { PostBlobResponse } from '~~/lib/core/api/blobStorage'
import type { Optional } from '@speckle/shared'
import type { AnnualPlan, AnnualPlanInput } from '~~/lib/projects/api/progress'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

const props = defineProps<{
  open: boolean
  projectId: string
  initialRecord?: AnnualPlan | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', payload: AnnualPlanInput): void
}>()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()
const attachmentInputRef = ref<HTMLInputElement | null>(null)

const currentYear = new Date().getFullYear()

type AnnualPlanForm = {
  year: number | null
  name: string
  startDate: string
  endDate: string
  preparedBy: string
  remark: string
  // 附件
  blobId: string | null
  fileName: string | null
  fileSize: number | string | null
}

const createEmptyForm = (): AnnualPlanForm => ({
  year: currentYear,
  name: '',
  startDate: '',
  endDate: '',
  preparedBy: '',
  remark: '',
  blobId: null,
  fileName: null,
  fileSize: null
})

const form = ref<AnnualPlanForm>(createEmptyForm())
const isSaving = ref(false)
const pendingFile = ref<File | null>(null)

const resetForm = () => {
  pendingFile.value = null
  if (props.initialRecord) {
    form.value = {
      year: props.initialRecord.year,
      name: props.initialRecord.name || '',
      startDate: props.initialRecord.startDate
        ? String(props.initialRecord.startDate).slice(0, 10)
        : '',
      endDate: props.initialRecord.endDate
        ? String(props.initialRecord.endDate).slice(0, 10)
        : '',
      preparedBy: props.initialRecord.preparedBy || '',
      remark: props.initialRecord.remark || '',
      blobId: props.initialRecord.blobId || null,
      fileName: props.initialRecord.fileName || null,
      fileSize: props.initialRecord.fileSize ?? null
    }
  } else {
    form.value = createEmptyForm()
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) resetForm()
  },
  { immediate: true }
)

const isValid = computed(() => {
  const { year, name, startDate, endDate } = form.value
  return (
    !!year &&
    year >= 2000 &&
    year <= 2200 &&
    !!name.trim() &&
    !!startDate &&
    !!endDate &&
    startDate <= endDate
  )
})

const handleAttachmentChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  pendingFile.value = file
  form.value.fileName = file.name
  form.value.fileSize = file.size
  form.value.blobId = null
  input.value = ''
}

const clearAttachment = () => {
  pendingFile.value = null
  form.value.blobId = null
  form.value.fileName = null
  form.value.fileSize = null
}

const uploadPendingFile = async (
  file: File
): Promise<{ blobId: string; fileName: string; fileSize: number | null }> => {
  const data = new FormData()
  const formKey = 'file'
  data.append(formKey, file)

  const uploadPayload = await $fetch<PostBlobResponse>(
    new URL(`/api/stream/${props.projectId}/blob`, apiOrigin).toString(),
    {
      method: 'POST',
      body: data
    }
  )
  const uploadResults =
    (uploadPayload as Optional<PostBlobResponse>)?.uploadResults || []
  const result = uploadResults.find((r) => r.formKey === formKey)

  if (!result?.blobId) {
    throw new Error(result?.uploadError || '文件上传后未返回 blobId')
  }

  return {
    blobId: result.blobId,
    fileName: result.fileName || file.name,
    fileSize: result.fileSize || file.size || null
  }
}

const handleSave = async () => {
  if (!isValid.value) return

  isSaving.value = true
  try {
    let blobId = form.value.blobId
    let fileName = form.value.fileName
    let fileSize = form.value.fileSize

    if (pendingFile.value) {
      const uploaded = await uploadPendingFile(pendingFile.value)
      blobId = uploaded.blobId
      fileName = uploaded.fileName
      fileSize = uploaded.fileSize
    }

    const payload: AnnualPlanInput = {
      year: form.value.year as number,
      name: form.value.name.trim(),
      startDate: form.value.startDate,
      endDate: form.value.endDate,
      preparedBy: form.value.preparedBy.trim() || null,
      blobId,
      fileName,
      fileSize,
      remark: form.value.remark.trim() || null
    }

    emit('save', payload)
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '附件上传失败',
      description: error instanceof Error ? error.message : '上传失败，请重试'
    })
  } finally {
    isSaving.value = false
  }
}
</script>
