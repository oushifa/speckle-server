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
        <div class="md:col-span-2 space-y-2">
          <div class="text-body-sm font-medium">构件序号码</div>
          <CommonModelObjectMultiModelSelectDrawer
            v-model:model_ids="bimModelIds"
            v-model:selections="bimSelections"
            :project-id="props.projectId"
            :disabled="props.loading || props.readonly"
            placeholder="点击选择构件"
          />
          <!-- 已选构件序号码标签 -->
          <div v-if="bimSerialCodes.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="code in bimSerialCodes"
              :key="code"
              class="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-body-xs text-primary"
            >
              {{ code }}
              <button
                v-if="!props.readonly"
                type="button"
                class="hover:opacity-75"
                :title="`移除 ${code}`"
                @click="removeSerialCode(code)"
              >
                <X class="h-3 w-3" />
              </button>
            </span>
          </div>
          <div
            v-else-if="bimSelectionCount > 0"
            class="text-body-3xs text-foreground-2"
          >
            已关联 {{ bimSelectionCount }} 个构件，但未解析到序号码
          </div>
          <div v-else-if="props.readonly" class="text-body-xs text-foreground-2">
            未关联构件
          </div>
        </div>
        <ProjectsQualityAcceptanceAttachmentUploadField
          ref="attachmentFieldRef"
          v-model:existing="existingAttachments"
          v-model:new-blob-ids="attachmentNewBlobIds"
          label="附件"
          :project-id="projectId"
          :disabled="loading"
          :readonly="props.readonly"
          class="md:col-span-2"
        />
        <ProjectsQualityAcceptanceAttachmentUploadField
          ref="processAttachmentFieldRef"
          v-model:existing="existingProcessAttachments"
          v-model:new-blob-ids="processNewBlobIds"
          label="过程文件"
          :project-id="projectId"
          :disabled="loading"
          :readonly="props.readonly"
          class="md:col-span-2"
        />
      </div>
      <div v-if="errorMessage" class="text-body-sm text-danger">{{ errorMessage }}</div>
    </div>
  </LayoutDialog>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { Nullable } from '@speckle/shared'
import type { LayoutDialogButton } from '@speckle/ui-components'
import type {
  BimSelectionGroup,
  QualityAcceptanceCreateInput,
  QualityAcceptanceAttachment
} from './types'
import { getAlignedBimSerialCodes } from './types'
import BoqTreeSelect from '~/components/common/checklist/BoqTreeSelect.vue'
import { CommonModelObjectMultiModelSelectDrawer } from '#components'

const props = withDefaults(
  defineProps<{
    projectId?: string | null
    loading?: boolean
    initialData?: QualityAcceptanceCreateInput | null
    initialAttachments?: QualityAcceptanceAttachment[]
    initialProcessAttachments?: QualityAcceptanceAttachment[]
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
  processAttachments: [],
  creator: '',
  workVolume: 0,
  unit: '',
  BIM: null,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  approveStatus: null
})

const form = ref<QualityAcceptanceCreateInput>(createDefaultForm())
const selectedChecklistId = ref<string | null>(null)
const actualStartDateInput = ref('')
const actualFinishDateInput = ref('')
const workVolumeInput = ref('')
const bimModelIds = ref<string[]>([])
const bimSelections = ref<BimSelectionGroup[]>([])
// 已保存的序号码快照（key: modelId::applicationId）。抽屉重新解析失败时回退使用，
// 避免编辑保存时把存量序号码清空。
const persistedSerialCodeByComponent = ref<Record<string, string>>({})
const errorMessage = ref('')

// 与 applicationIds 按位对齐的序号码；抽屉回传 componentCodesAligned，
// 从已保存数据回填时由 bimIds 推导，二者缺失时按位回退到紧凑编码数组，
// 最后回退到已保存的序号码快照（抽屉解析不到时不丢数据）。
const componentKey = (modelId: string, applicationId: string) =>
  `${modelId}::${applicationId}`

const getGroupAlignedSerialCodes = (group: BimSelectionGroup): (string | null)[] =>
  group.applicationIds.map((applicationId, index) => {
    const code =
      group.componentCodesAligned?.[index] ?? group.componentCodes?.[index] ?? null
    return (
      code ||
      persistedSerialCodeByComponent.value[
        componentKey(group.modelId || '', applicationId)
      ] ||
      null
    )
  })

const bimSelectionCount = computed(() =>
  bimSelections.value.reduce(
    (count, group) => count + (group.applicationIds?.length || 0),
    0
  )
)

const bimSerialCodes = computed(() => {
  const seen = new Set<string>()
  const codes: string[] = []
  for (const group of bimSelections.value) {
    for (const code of getGroupAlignedSerialCodes(group)) {
      if (!code || seen.has(code)) continue
      seen.add(code)
      codes.push(code)
    }
  }
  return codes
})

const removeSerialCode = (code: string) => {
  bimSelections.value = bimSelections.value
    .map((group) => {
      const aligned = getGroupAlignedSerialCodes(group)
      const index = aligned.indexOf(code)
      if (index === -1) return group
      const alignedNext = aligned.filter((_, i) => i !== index)
      return {
        ...group,
        applicationIds: group.applicationIds.filter((_, i) => i !== index),
        componentCodes: alignedNext.filter((item): item is string => !!item),
        componentCodesAligned: alignedNext
      }
    })
    .filter((group) => group.applicationIds.length > 0)
}

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

// 附件 / 过程文件：已保存列表由本组件持有，上传队列交给 AttachmentUploadField
const existingAttachments = ref<QualityAcceptanceAttachment[]>([])
const existingProcessAttachments = ref<QualityAcceptanceAttachment[]>([])
// 本次新上传成功的 blob id（提交时与已保存列表合并）
const attachmentNewBlobIds = ref<string[]>([])
const processNewBlobIds = ref<string[]>([])
type AttachmentFieldRef = {
  hasPendingUploads: () => boolean
  markUploadsInUse: () => void
  resetUploads: () => void
}
const attachmentFieldRef = ref(null as Nullable<AttachmentFieldRef>)
const processAttachmentFieldRef = ref(null as Nullable<AttachmentFieldRef>)

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
  bimModelIds.value = []
  bimSelections.value = []
  persistedSerialCodeByComponent.value = {}
  attachmentFieldRef.value?.resetUploads()
  processAttachmentFieldRef.value?.resetUploads()
  existingAttachments.value = []
  existingProcessAttachments.value = []
  attachmentNewBlobIds.value = []
  processNewBlobIds.value = []
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
  const serialCodeMap: Record<string, string> = {}
  bimSelections.value = (data.BIM || [])
    .map((entry) => {
      const modelId = entry.modelId || ''
      const aligned = getAlignedBimSerialCodes(entry)
      const applicationIds = [...(entry.applicationIds || [])]
      applicationIds.forEach((applicationId, index) => {
        const code = aligned[index]
        if (code) serialCodeMap[componentKey(modelId, applicationId)] = code
      })
      return {
        modelId,
        applicationIds,
        componentCodes: aligned.filter((code): code is string => !!code),
        componentCodesAligned: aligned
      }
    })
    .filter((group) => group.applicationIds.length > 0)
  persistedSerialCodeByComponent.value = serialCodeMap
  bimModelIds.value = Array.from(
    new Set(bimSelections.value.map((group) => group.modelId).filter(Boolean))
  )
  attachmentFieldRef.value?.resetUploads()
  processAttachmentFieldRef.value?.resetUploads()
  existingAttachments.value = props.initialAttachments
    ? [...props.initialAttachments]
    : []
  existingProcessAttachments.value = props.initialProcessAttachments
    ? [...props.initialProcessAttachments]
    : []
  attachmentNewBlobIds.value = []
  processNewBlobIds.value = []
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
  const hasPendingUploads =
    attachmentFieldRef.value?.hasPendingUploads() ||
    processAttachmentFieldRef.value?.hasPendingUploads()
  if (hasPendingUploads) {
    errorMessage.value = '附件上传中，请稍后再提交'
    return
  }
  // 附件已随表单提交，标记为已使用，防止 useAttachments 在组件卸载/重置时
  // 把这些 blob 当作未提交的垃圾附件删除（否则切换页面后已保存的关联文件会丢失）
  attachmentFieldRef.value?.markUploadsInUse()
  processAttachmentFieldRef.value?.markUploadsInUse()
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
        ...attachmentNewBlobIds.value
      ])
    ),
    processAttachments: Array.from(
      new Set([
        ...existingProcessAttachments.value.map((a) => a.id),
        ...processNewBlobIds.value
      ])
    ),
    BIM: bimSelections.value.length
      ? bimSelections.value.map((group) => ({
          modelId: group.modelId || '',
          applicationIds: [...group.applicationIds],
          bimIds: getGroupAlignedSerialCodes(group)
        }))
      : null,
    timeZone: form.value.timeZone.trim()
  })
  open.value = false
}

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
