<template>
  <form class="flex flex-col text-foreground" @submit="onSubmit">
    <div class="flex flex-col gap-y-4 mb-2">
      <FormTextInput
        name="name"
        label="项目名称"
        placeholder="名称"
        color="foundation"
        :rules="[isRequired, isStringOfLength({ maxLength: 512 })]"
        auto-focus
        autocomplete="off"
        show-label
      />
      <FormTextArea
        name="description"
        label="项目描述"
        placeholder="描述"
        color="foundation"
        size="lg"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 65536 })]"
      />
      <FormTextInput
        name="address"
        label="地址"
        placeholder="请输入地址"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 512 })]"
      />
      <FormTextInput
        name="progress"
        label="进度"
        placeholder="请输入进度（数字）"
        type="number"
        min="0"
        max="100"
        step="0.01"
        color="foundation"
        show-label
        show-optional
      />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormTextInput
          name="start_date"
          label="开始时间"
          type="datetime-local"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          name="end_date"
          label="结束时间"
          type="datetime-local"
          color="foundation"
          show-label
          show-optional
        />
      </div>
      <FormTextInput
        name="status"
        label="当前状态"
        placeholder="请输入状态"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 128 })]"
      />
      <FormTextInput
        name="responsible"
        label="负责人"
        placeholder="请输入负责人"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 128 })]"
      />
      <FormTextInput
        name="projectNumber"
        label="项目编号"
        placeholder="请输入项目编号"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 256 })]"
      />
      <FormTextInput
        name="contractCode"
        label="合同编号"
        placeholder="请输入合同编号"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 256 })]"
      />
      <FormTextInput
        name="contractName"
        label="合同名称"
        placeholder="请输入合同名称"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 256 })]"
      />
      <FormTextInput
        name="employer"
        label="发包人"
        placeholder="请输入发包人"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 256 })]"
      />
      <FormTextInput
        name="contractor"
        label="承包人"
        placeholder="请输入承包人"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 256 })]"
      />
      <FormTextInput
        name="projectGuid"
        label="项目GUID"
        placeholder="请输入项目GUID"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 256 })]"
      />
      <FormTextInput
        name="bidSection"
        label="标段"
        placeholder="请输入标段"
        color="foundation"
        show-label
        show-optional
        :rules="[isStringOfLength({ maxLength: 256 })]"
      />
      <FormTextInput
        name="contractPrice"
        label="签约合同价（元）"
        placeholder="请输入签约合同价"
        type="number"
        step="0.01"
        color="foundation"
        show-label
        show-optional
      />
      <FormSelectDepartment
        v-model="selectedConstructionUnit"
        name="constructionUnit"
        label="施工单位"
        show-label
        clearable
      />
      <FormSelectDepartment
        v-model="selectedSupervisionUnit"
        name="supervisionUnit"
        label="监理单位"
        show-label
        clearable
      />
      <!-- <div>
        <h3 class="label mb-2">访问权限</h3>
        <ProjectVisibilitySelect
          v-model="visibility"
          mount-menu-on-body
          :workspace-id="workspaceId"
        />
      </div> -->
    </div>
    <div class="flex justify-end gap-2 my-2">
      <FormButton
        type="button"
        color="outline"
        :disabled="isDisabled"
        @click="() => (supportGoBack ? $emit('back') : $emit('canceled'))"
      >
        {{ supportGoBack ? '返回' : '取消' }}
      </FormButton>
      <FormButton type="submit" color="primary" :loading="isDisabled">创建</FormButton>
    </div>
  </form>
</template>
<script setup lang="ts">
import type { MaybeNullOrUndefined } from '@speckle/shared'
import { useForm } from 'vee-validate'
import dayjs from 'dayjs'
import { SupportedProjectVisibility } from '~/lib/projects/helpers/visibility'
import { isRequired, isStringOfLength } from '~~/lib/common/helpers/validation'
import { useMixpanel } from '~~/lib/core/composables/mp'
import {
  useCreateProject,
  useUpdateProject
} from '~~/lib/projects/composables/projectManagement'

type FormValues = {
  name: string
  description?: string
  address?: string
  progress?: string | number
  start_date?: string
  end_date?: string
  status?: string
  responsible?: string
  projectNumber?: string
  contractCode?: string
  contractName?: string
  employer?: string
  contractor?: string
  constructionUnit?: string
  supervisionUnit?: string
  projectGuid?: string
  bidSection?: string
  contractPrice?: string | number
}

const props = defineProps<{
  supportGoBack?: boolean
  workspaceId?: MaybeNullOrUndefined<string>
}>()

const emit = defineEmits<{
  (e: 'created', project: { id: string }): void
  (e: 'canceled'): void
  (e: 'back'): void
}>()

const createProject = useCreateProject()
const updateProject = useUpdateProject()
const logger = useLogger()
const { handleSubmit, isSubmitting } = useForm<FormValues>()

const selectedConstructionUnit = ref<string | undefined>(undefined)
const selectedSupervisionUnit = ref<string | undefined>(undefined)

const visibility = ref(
  props.workspaceId
    ? SupportedProjectVisibility.Workspace
    : SupportedProjectVisibility.Private
)
const isLoading = ref(false)

const mp = useMixpanel()

const isDisabled = computed(() => isSubmitting.value || isLoading.value)
const toTimestamp = (value?: string) => {
  if (!value) return ''
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? '' : timestamp
}
const toNumberValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return ''
  const numberValue = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isNaN(numberValue) ? '' : numberValue
}

const onSubmit = handleSubmit(async (values) => {
  if (isLoading.value) return

  try {
    isLoading.value = true

    const newProject = await createProject({
      name: values.name,
      description: values.description,
      visibility: 'WORKSPACE',
      address: values.address || '',
      ...(props.workspaceId ? { workspaceId: props.workspaceId } : {})
    })

    if (newProject?.id) {
      try {
        const updatePayload: Record<string, unknown> = {}
        const trimmedStatus = values.status?.trim() || ''
        const trimmedResponsible = values.responsible?.trim() || ''
        const trimmedProjectNumber = values.projectNumber?.trim() || ''
        const trimmedContractCode = values.contractCode?.trim() || ''
        const trimmedContractName = values.contractName?.trim() || ''
        const trimmedEmployer = values.employer?.trim() || ''
        const trimmedContractor = values.contractor?.trim() || ''
        const trimmedConstructionUnit = selectedConstructionUnit.value || ''
        const trimmedSupervisionUnit = selectedSupervisionUnit.value || ''
        const trimmedProjectGuid = values.projectGuid?.trim() || ''
        const trimmedBidSection = values.bidSection?.trim() || ''
        const nextContractPrice = toNumberValue(values.contractPrice)
        const nextProgress = toNumberValue(values.progress)
        const nextStartDate = toTimestamp(values.start_date)
        const nextEndDate = toTimestamp(values.end_date)

        if (nextProgress !== '') {
          updatePayload.progress = nextProgress
        }
        if (nextStartDate !== '') {
          updatePayload.startDate = nextStartDate
        }
        if (nextEndDate !== '') {
          updatePayload.endDate = nextEndDate
        }
        if (trimmedStatus) {
          updatePayload.status = trimmedStatus
        }
        if (trimmedResponsible) {
          updatePayload.responsible = trimmedResponsible
        }
        if (trimmedProjectNumber) {
          updatePayload.projectNumber = trimmedProjectNumber
        }
        if (trimmedContractCode) {
          updatePayload.contractCode = trimmedContractCode
        }
        if (trimmedContractName) {
          updatePayload.contractName = trimmedContractName
        }
        if (trimmedEmployer) {
          updatePayload.employer = trimmedEmployer
        }
        if (trimmedContractor) {
          updatePayload.contractor = trimmedContractor
        }
        if (trimmedProjectGuid) {
          updatePayload.projectGuid = trimmedProjectGuid
        }
        if (trimmedBidSection) {
          updatePayload.bidSection = trimmedBidSection
        }
        if (nextContractPrice !== '') {
          updatePayload.contractPrice = nextContractPrice
        }
        if (trimmedConstructionUnit) {
          updatePayload.constructionUnit = trimmedConstructionUnit
        }
        if (trimmedSupervisionUnit) {
          updatePayload.supervisionUnit = trimmedSupervisionUnit
        }

        if (Object.keys(updatePayload).length) {
          await updateProject({
            id: newProject.id,
            ...updatePayload,
            timeZone: dayjs.tz.guess() || ''
          })
        }
      } catch (error) {
        logger.error('Failed to initialize project metadata:', error)
      }

      emit('created', { id: newProject.id })
      mp.track('Stream Action', {
        type: 'action',
        name: 'create',
        // eslint-disable-next-line camelcase
        workspace_id: props.workspaceId
      })
    }
  } catch (error) {
    logger.error('Failed to create project:', error)
  } finally {
    isLoading.value = false
  }
})

watch(
  () => props.workspaceId,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      visibility.value = props.workspaceId
        ? SupportedProjectVisibility.Workspace
        : SupportedProjectVisibility.Private
    }
  }
)
</script>
