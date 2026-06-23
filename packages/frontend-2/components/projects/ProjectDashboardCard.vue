<template>
  <div>
    <div
      class="relative group flex flex-col items-stretch md:flex-row md:space-x-2 border border-outline-3 rounded-xl p-4 transition bg-foundation"
    >
      <div
        class="w-full md:w-56 flex flex-col justify-between col-span-3 lg:col-span-1 mb-4 md:mb-0 flex-shrink-0 space-y-1 pl-2 pr-6 py-2"
      >
        <div class="flex flex-col">
          <CommonBadge
            v-if="!project.workspace?.id && isWorkspacesEnabled && isOwner"
            v-tippy="'只能项目所有者才能将项目移动到工作空间'"
            class="mb-2 max-w-max"
            rounded
          >
            准备移动
          </CommonBadge>
          <div class="flex items-start justify-between gap-2 mb-2">
            <NuxtLink
              :to="projectRoute(project.id) + '/workbench'"
              class="break-words hover:text-primary text-heading text-nowrap text-ellipsis overflow-hidden flex-1 min-w-0"
              :title="project.name"
            >
              {{ project.name }}
            </NuxtLink>
            <div
              v-if="canManageProject"
              class="flex items-center gap-1 text-foreground-2"
            >
              <button
                type="button"
                class="p-1 rounded hover:bg-highlight-1 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!canManageProject || updatingProjectInfo"
                @click.stop="openEditDialog"
              >
                <IconEdit class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="p-1 rounded hover:bg-highlight-1 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!canManageProject || deletingProject"
                @click.stop="openDeleteDialog"
              >
                <IconDelete class="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <span class="text-body-3xs text-foreground-2 select-none">
              地址：{{ project.address || '-' }}
            </span>
          </div>
          <div>
            <span class="text-body-3xs text-foreground-2 select-none">
              进度：{{ formatProgress(project.progress) }}
            </span>
          </div>
          <div>
            <span class="text-body-3xs text-foreground-2 select-none">
              开始时间：{{
                project.startDate
                  ? dayjs(project.startDate).format('YYYY-MM-DD HH:mm:ss')
                  : '-'
              }}
            </span>
          </div>
          <div>
            <span class="text-body-3xs text-foreground-2 select-none">
              结束时间：{{
                props.project.endDate
                  ? dayjs(props.project.endDate).format('YYYY-MM-DD HH:mm:ss')
                  : '-'
              }}
            </span>
          </div>
          <div>
            <span class="text-body-3xs text-foreground-2 select-none">
              当前状态：{{ project.status || '-' }}
            </span>
          </div>
          <div>
            <span class="text-body-3xs text-foreground-2 select-none">
              负责人：{{ project.responsible || '-' }}
            </span>
          </div>
          <span
            v-tippy="updatedAt.full"
            class="text-body-3xs mt-1 mb-1 text-foreground-2 select-none"
          >
            {{ updatedAt.relative }}更新
          </span>
          <span
            v-if="project.role"
            class="text-body-3xs capitalize mb-2 text-foreground-2 select-none"
          >
            {{ RoleInfo.Stream[project.role as StreamRoles].title }}
          </span>
          <UserAvatarGroup :users="teamUsers" :max-count="2" />
        </div>
        <div class="pt-3">
          <NuxtLink
            v-if="project.workspace && showWorkspaceLink && isWorkspacesEnabled"
            :to="workspaceRoute(project.workspace.slug) + '/workbench'"
            class="my-3 flex items-center"
          >
            <WorkspaceAvatar
              :logo="project.workspace.logo"
              :name="project.workspace.name"
              size="sm"
            />
            <p class="text-body-2xs text-foreground ml-2 line-clamp-2">
              {{ project.workspace.name }}
            </p>
          </NuxtLink>
          <div class="flex gap-2">
            <FormButton
              :to="allProjectModelsRoute(project.id) + '/'"
              size="sm"
              color="outline"
              :icon-right="ChevronRightIcon"
            >
              {{ `${modelItemTotalCount} 个模型` }}
            </FormButton>
            <div
              v-if="!project.workspace?.id && isWorkspacesEnabled"
              v-tippy="!isOwner ? '只能项目所有者才能将项目移动到工作空间' : undefined"
            >
              <FormButton
                size="sm"
                color="outline"
                :disabled="!isOwner"
                @click="$emit('moveProject')"
              >
                移动项目
              </FormButton>
            </div>
          </div>
        </div>
      </div>
      <div :class="gridClasses">
        <template v-if="!isModelUploading">
          <ProjectPageModelsCard
            v-for="pendingModel in pendingModels"
            :key="pendingModel.id"
            :model="pendingModel"
            :project="project"
            show-versions
            :project-id="project.id"
            height="h-48"
            show-actions
          />
          <ProjectPageModelsCard
            v-for="model in models"
            :key="model.id"
            :model="model"
            :project="project"
            show-versions
            show-actions
            :project-id="project.id"
            height="h-48"
            @click="router.push(getModelItemRoute(model))"
          />
        </template>
        <ProjectCardImportFileArea
          v-if="hasNoModels || isModelUploading"
          empty-state-variant="modelsSection"
          :project="project"
          class="h-28 col-span-4"
          @uploading="onModelUploading"
        />
      </div>
    </div>
    <LayoutDialog
      v-model:open="showEditDialog"
      max-width="sm"
      :buttons="editDialogButtons"
    >
      <template #header>编辑项目信息</template>
      <div class="flex flex-col gap-3 text-foreground">
        <FormTextInput
          v-model="editForm.name"
          name="editProjectName"
          label="项目名称"
          placeholder="请输入项目名称"
          color="foundation"
          show-label
        />
        <FormTextArea
          v-model="editForm.description"
          name="editProjectDescription"
          label="项目描述"
          placeholder="请输入项目描述"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.address"
          name="editProjectAddress"
          label="地址"
          placeholder="请输入地址"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.progress"
          name="editProjectProgress"
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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormTextInput
            v-model="editForm.startDate"
            name="editProjectStartDate"
            label="开始时间"
            type="datetime-local"
            color="foundation"
            show-label
            show-optional
          />
          <FormTextInput
            v-model="editForm.endDate"
            name="editProjectEndDate"
            label="结束时间"
            type="datetime-local"
            color="foundation"
            show-label
            show-optional
          />
        </div>
        <FormTextInput
          v-model="editForm.status"
          name="editProjectStatus"
          label="当前状态"
          placeholder="请输入状态"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.responsible"
          name="editProjectResponsible"
          label="负责人"
          placeholder="请输入负责人"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.projectNumber"
          name="editProjectNumber"
          label="项目编号"
          placeholder="请输入项目编号"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.contractCode"
          name="editContractCode"
          label="合同编号"
          placeholder="请输入合同编号"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.contractName"
          name="editContractName"
          label="合同名称"
          placeholder="请输入合同名称"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.employer"
          name="editEmployer"
          label="发包人"
          placeholder="请输入发包人"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.contractor"
          name="editContractor"
          label="承包人"
          placeholder="请输入承包人"
          color="foundation"
          show-label
          show-optional
        />

        <FormTextInput
          v-model="editForm.bidSection"
          name="editBidSection"
          label="标段"
          placeholder="请输入标段"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.contractPrice"
          name="editContractPrice"
          label="签约合同价（元）"
          placeholder="请输入签约合同价"
          type="number"
          step="0.01"
          color="foundation"
          show-label
          show-optional
        />
        <FormSelectDepartment
          v-model="editForm.constructionUnit"
          name="editConstructionUnit"
          label="施工单位"
          show-label
          clearable
        />
        <FormSelectDepartment
          v-model="editForm.supervisionUnit"
          name="editSupervisionUnit"
          label="监理单位"
          show-label
          clearable
        />
        <FormTextInput
          v-model="editForm.businessUnit"
          name="editBusinessUnit"
          label="事业部编码"
          placeholder="请输入事业部编码"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.businessUnitName"
          name="editBusinessUnitName"
          label="事业部名称"
          placeholder="请输入事业部名称"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.companyId"
          name="editCompanyId"
          label="公司ID"
          placeholder="请输入公司ID"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.companyName"
          name="editCompanyName"
          label="公司名称"
          placeholder="请输入公司名称"
          color="foundation"
          show-label
          show-optional
        />
        <FormTextInput
          v-model="editForm.projectPackageItemguid"
          name="editProjectPackageItemguid"
          label="预算系统包件GUID"
          placeholder="请输入预算系统包件GUID"
          color="foundation"
          show-label
          show-optional
        />
      </div>
    </LayoutDialog>
    <LayoutDialog
      v-model:open="showDeleteDialog"
      max-width="sm"
      :buttons="deleteDialogButtons"
    >
      <template #header>删除项目</template>
      <div class="flex flex-col gap-3 text-body-xs text-foreground">
        <p>
          您确定要永久删除项目
          <span class="font-medium">“{{ project.name }}”</span>
          吗？此操作不可撤销。
        </p>
        <FormTextInput
          v-model="deleteProjectNameInput"
          name="deleteProjectNameConfirm"
          label="请输入项目名称确认删除"
          placeholder="项目名称"
          color="foundation"
          show-label
        />
      </div>
    </LayoutDialog>
  </div>
</template>
<script lang="ts" setup>
import { Roles } from '@speckle/shared'
import {
  FormButton,
  FormTextArea,
  FormTextInput,
  LayoutDialog,
  type LayoutDialogButton
} from '@speckle/ui-components'
import type { ProjectDashboardItemFragment } from '~~/lib/common/generated/gql/graphql'
import { projectRoute, allProjectModelsRoute } from '~~/lib/common/helpers/route'
import { useGeneralProjectPageUpdateTracking } from '~~/lib/projects/composables/projectPages'
import { ChevronRightIcon } from '@heroicons/vue/20/solid'
import { workspaceRoute } from '~/lib/common/helpers/route'
import { RoleInfo, type StreamRoles } from '@speckle/shared'
import type { FileAreaUploadingPayload } from '~/lib/form/helpers/fileUpload'
import { getModelItemRoute } from '~/lib/projects/helpers/models'
import dayjs from 'dayjs'
import {
  useDeleteProject,
  useUpdateProject
} from '~/lib/projects/composables/projectManagement'

defineEmits<{
  (e: 'moveProject'): void
}>()

const props = defineProps<{
  project: ProjectDashboardItemFragment
  showWorkspaceLink?: boolean
  workspacePage?: boolean
}>()

const router = useRouter()
const isWorkspacesEnabled = useIsWorkspacesEnabled()
const { isAdmin: isServerAdmin } = useActiveUser()
const { formattedRelativeDate, formattedFullDate } = useDateFormatters()
const logger = useLogger()
const deleteProject = useDeleteProject()
const updateProject = useUpdateProject()

const isModelUploading = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const updatingProjectInfo = ref(false)
const deletingProject = ref(false)
const deleteProjectNameInput = ref('')
const projectDescription = ref(props.project.description || '')
const editForm = ref({
  name: '',
  description: '',
  address: '',
  progress: '',
  startDate: '',
  endDate: '',
  status: '',
  responsible: '',
  timeZone: '',
  projectNumber: '',
  contractCode: '',
  contractName: '',
  employer: '',
  contractor: '',
  constructionUnit: '',
  supervisionUnit: '',
  bidSection: '',
  contractPrice: '',
  businessUnit: '',
  businessUnitName: '',
  companyId: '',
  companyName: '',
  projectPackageItemguid: ''
})
const originalDescription = ref('')

const isOwner = computed(() => props.project.role === Roles.Stream.Owner)
const isWorkspaceAdmin = computed(
  () => props.project.workspace?.role === Roles.Workspace.Admin
)
const canManageProject = computed(
  () => isOwner.value || isServerAdmin.value || isWorkspaceAdmin.value
)
const projectId = computed(() => props.project.id)
const updatedAt = computed(() => {
  return {
    full: formattedFullDate(props.project.updatedAt),
    relative: formattedRelativeDate(props.project.updatedAt, { prefix: true })
  }
})

// Tracking updates to project, its models and versions
useGeneralProjectPageUpdateTracking(
  { projectId },
  { redirectHomeOnProjectDeletion: false }
)

const teamUsers = computed(() => props.project.team.map((t) => t.user))
const pendingModels = computed(() => props.project.pendingImportedModels.slice(0, 3))
const models = computed(() => {
  const items = props.project.models?.items || []
  return items.slice(0, Math.max(0, 3 - pendingModels.value.length))
})

const hasNoModels = computed(() => !models.value.length && !pendingModels.value.length)
const modelItemTotalCount = computed(
  () => props.project.models.totalCount + props.project.pendingImportedModels.length
)
const canConfirmDelete = computed(
  () => canManageProject.value && deleteProjectNameInput.value === props.project.name
)
const canSaveEdit = computed(
  () =>
    canManageProject.value &&
    !updatingProjectInfo.value &&
    !!editForm.value.name.trim().length
)

const gridClasses = computed(() => [
  // Base classes
  'grid',
  'gap-2',
  'flex-grow',
  'col-span-4',
  'xl:col-span-3',
  'w-full',

  // Grid columns
  'grid-cols-1',
  'sm:grid-cols-2',
  props.workspacePage && 'lg:grid-cols-1',
  props.workspacePage ? 'xl:grid-cols-2' : 'xl:grid-cols-3',
  props.workspacePage && '2xl:grid-cols-3',

  // Visibility rules
  'sm:[&>*:nth-child(n+3)]:hidden',
  props.workspacePage && 'lg:[&>*:nth-child(n+2)]:hidden',
  props.workspacePage && 'xl:[&>*:nth-child(n+2)]:block',
  !props.workspacePage && 'xl:[&>*:nth-child(n+3)]:block',
  props.workspacePage && '2xl:[&>*:nth-child(n+2)]:block',
  '2xl:[&>*:nth-child(n+3)]:block'
])

const parseTimestamp = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return null
  const numberValue = typeof value === 'number' ? value : Number(String(value).trim())
  if (Number.isNaN(numberValue)) return null
  return numberValue < 1000000000000 ? numberValue * 1000 : numberValue
}

const toDatetimeLocal = (value?: string | number | null) => {
  const timestamp = parseTimestamp(value)
  return timestamp ? dayjs(timestamp).format('YYYY-MM-DDTHH:mm') : ''
}

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

const formatProgress = (value?: string | number | null) => {
  const numeric = toNumberValue(value)
  return numeric === '' ? '-' : `${numeric}%`
}

const setEditFormValues = () => {
  editForm.value = {
    name: props.project.name,
    description: projectDescription.value || props.project.description || '',
    address: String(props.project.address || ''),
    progress: String(props.project.progress || ''),
    startDate: toDatetimeLocal(props.project.startDate),
    endDate: toDatetimeLocal(props.project.endDate),
    status: String(props.project.status || ''),
    responsible: String(props.project.responsible || ''),
    timeZone: String(props.project.timeZone || ''),
    projectNumber: String(props.project.projectNumber || ''),
    contractCode: String(props.project.contractCode || ''),
    contractName: String(props.project.contractName || ''),
    employer: String(props.project.employer || ''),
    contractor: String(props.project.contractor || ''),
    constructionUnit: String(props.project.constructionUnit || ''),
    supervisionUnit: String(props.project.supervisionUnit || ''),
    bidSection: String(props.project.bidSection || ''),
    contractPrice: props.project.contractPrice !== null && props.project.contractPrice !== undefined ? String(props.project.contractPrice) : '',
    businessUnit: String(props.project.businessUnit || ''),
    businessUnitName: String(props.project.businessUnitName || ''),
    companyId: String(props.project.companyId || ''),
    companyName: String(props.project.companyName || ''),
    projectPackageItemguid: String(props.project.projectPackageItemguid || '')
  }
}

const openEditDialog = () => {
  if (!canManageProject.value) return
  setEditFormValues()
  originalDescription.value = editForm.value.description
  showEditDialog.value = true
}

const openDeleteDialog = () => {
  if (!canManageProject.value) return
  deleteProjectNameInput.value = ''
  showDeleteDialog.value = true
}

const onSaveProjectInfo = async () => {
  if (!canManageProject.value || updatingProjectInfo.value) return
  updatingProjectInfo.value = true
  try {
    const updatePayload: Record<string, unknown> = {}
    const trimmedName = editForm.value.name.trim()
    const trimmedAddress = editForm.value.address.trim()
    const trimmedStatus = editForm.value.status.trim()
    const trimmedResponsible = editForm.value.responsible.trim()
    const currentAddress = String(props.project.address || '')
    const currentStatus = String(props.project.status || '')
    const currentResponsible = String(props.project.responsible || '')
    const currentProjectNumber = String(props.project.projectNumber || '')
    const currentContractCode = String(props.project.contractCode || '')
    const currentContractName = String(props.project.contractName || '')
    const currentEmployer = String(props.project.employer || '')
    const currentContractor = String(props.project.contractor || '')
    const currentConstructionUnit = String(props.project.constructionUnit || '')
    const currentSupervisionUnit = String(props.project.supervisionUnit || '')
    const currentBidSection = String(props.project.bidSection || '')
    const currentContractPrice = props.project.contractPrice !== null && props.project.contractPrice !== undefined ? Number(props.project.contractPrice) : null
    const currentBusinessUnit = String(props.project.businessUnit || '')
    const currentBusinessUnitName = String(props.project.businessUnitName || '')
    const currentCompanyId = String(props.project.companyId || '')
    const currentCompanyName = String(props.project.companyName || '')
    const currentProjectPackageItemguid = String(props.project.projectPackageItemguid || '')
    const currentProgress = toNumberValue(props.project.progress)
    const nextProgress = toNumberValue(editForm.value.progress)
    const currentStartDate = toDatetimeLocal(props.project.startDate)
    const nextStartDate = editForm.value.startDate
    const currentEndDate = toDatetimeLocal(props.project.endDate)
    const nextEndDate = editForm.value.endDate
    const nextProjectNumber = editForm.value.projectNumber.trim()
    const nextContractCode = editForm.value.contractCode.trim()
    const nextContractName = editForm.value.contractName.trim()
    const nextEmployer = editForm.value.employer.trim()
    const nextContractor = editForm.value.contractor.trim()
    const nextConstructionUnit = editForm.value.constructionUnit.trim()
    const nextSupervisionUnit = editForm.value.supervisionUnit.trim()
    const nextBidSection = editForm.value.bidSection.trim()
    const nextContractPrice = editForm.value.contractPrice !== '' ? Number(editForm.value.contractPrice) : null
    const nextBusinessUnit = editForm.value.businessUnit.trim()
    const nextBusinessUnitName = editForm.value.businessUnitName.trim()
    const nextCompanyId = editForm.value.companyId.trim()
    const nextCompanyName = editForm.value.companyName.trim()
    const nextProjectPackageItemguid = editForm.value.projectPackageItemguid.trim()

    if (trimmedName && trimmedName !== props.project.name) {
      updatePayload.name = trimmedName
    }
    if (editForm.value.description !== originalDescription.value) {
      updatePayload.description = editForm.value.description
    }
    if (trimmedAddress !== currentAddress) {
      updatePayload.address = trimmedAddress
    }
    if (nextProgress !== currentProgress) {
      updatePayload.progress = nextProgress === '' ? null : nextProgress
    }
    if (nextStartDate !== currentStartDate) {
      updatePayload.startDate = nextStartDate ? toTimestamp(nextStartDate) : null
    }
    if (nextEndDate !== currentEndDate) {
      updatePayload.endDate = nextEndDate ? toTimestamp(nextEndDate) : null
    }
    if (trimmedStatus !== currentStatus) {
      updatePayload.status = trimmedStatus
    }
    if (trimmedResponsible !== currentResponsible) {
      updatePayload.responsible = trimmedResponsible
    }
    if (nextProjectNumber !== currentProjectNumber) {
      updatePayload.projectNumber = nextProjectNumber
    }
    if (nextContractCode !== currentContractCode) {
      updatePayload.contractCode = nextContractCode
    }
    if (nextContractName !== currentContractName) {
      updatePayload.contractName = nextContractName
    }
    if (nextEmployer !== currentEmployer) {
      updatePayload.employer = nextEmployer
    }
    if (nextContractor !== currentContractor) {
      updatePayload.contractor = nextContractor
    }
    if (nextConstructionUnit !== currentConstructionUnit) {
      updatePayload.constructionUnit = nextConstructionUnit
    }
    if (nextSupervisionUnit !== currentSupervisionUnit) {
      updatePayload.supervisionUnit = nextSupervisionUnit
    }
    if (nextBidSection !== currentBidSection) {
      updatePayload.bidSection = nextBidSection
    }
    if (nextContractPrice !== currentContractPrice) {
      updatePayload.contractPrice = nextContractPrice
    }
    if (nextBusinessUnit !== currentBusinessUnit) {
      updatePayload.businessUnit = nextBusinessUnit
    }
    if (nextBusinessUnitName !== currentBusinessUnitName) {
      updatePayload.businessUnitName = nextBusinessUnitName
    }
    if (nextCompanyId !== currentCompanyId) {
      updatePayload.companyId = nextCompanyId
    }
    if (nextCompanyName !== currentCompanyName) {
      updatePayload.companyName = nextCompanyName
    }
    if (nextProjectPackageItemguid !== currentProjectPackageItemguid) {
      updatePayload.projectPackageItemguid = nextProjectPackageItemguid
    }

    if (Object.keys(updatePayload).length) {
      updatePayload.timeZone = dayjs.tz.guess() || ''
      await updateProject({
        id: props.project.id,
        ...updatePayload
      })
    }
    projectDescription.value = editForm.value.description

    showEditDialog.value = false
  } catch (error) {
    logger.error('Failed to update iwhale project info:', error)
  } finally {
    updatingProjectInfo.value = false
  }
}

const onDeleteProject = async () => {
  if (!canConfirmDelete.value || deletingProject.value) return
  deletingProject.value = true
  try {
    const deleted = await deleteProject(props.project.id, {
      workspaceSlug: props.project.workspace?.slug || undefined
    })
    if (deleted) {
      showDeleteDialog.value = false
      deleteProjectNameInput.value = ''
    }
  } finally {
    deletingProject.value = false
  }
}

const editDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      showEditDialog.value = false
    }
  },
  {
    text: '保存',
    props: {
      color: 'primary',
      disabled: !canSaveEdit.value
    },
    onClick: () => {
      void onSaveProjectInfo()
    }
  }
])

const deleteDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => {
      showDeleteDialog.value = false
      deleteProjectNameInput.value = ''
    }
  },
  {
    text: '删除',
    props: {
      color: 'danger',
      disabled: !canConfirmDelete.value || deletingProject.value
    },
    onClick: () => {
      void onDeleteProject()
    }
  }
])

watch(
  () => props.project.description,
  (value) => {
    if (!showEditDialog.value) {
      projectDescription.value = value || ''
    }
  }
)

const onModelUploading = (payload: FileAreaUploadingPayload) => {
  isModelUploading.value = payload.isUploading
}
</script>
