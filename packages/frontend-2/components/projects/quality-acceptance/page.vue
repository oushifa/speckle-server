<template>
  <div>
    <div class="flex flex-col gap-4 h-full">
      <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <h1 class="text-heading-lg text-foreground mt-3">质量验收</h1>
        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div class="flex gap-2 w-full sm:w-auto">
            <FormTextInput
              v-model="searchQuery"
              name="quality-acceptance-search"
              placeholder="搜索验收单"
              :show-label="false"
              class="w-full sm:w-64"
            />
            <FormButton :icon-left="MagnifyingGlassIcon" color="outline" hide-text />
          </div>
          <FormSelectBase
            v-model="selectedExportApproveStatus"
            label="导出状态"
            :show-label="false"
            name="quality-acceptance-export-status"
            placeholder="全部状态"
            by="value"
            :items="approveStatusOptions"
            :allow-unset="false"
            class="min-w-[112px]"
            size="base"
          >
            <template #something-selected="{ value }">
              {{ Array.isArray(value) ? value[0]?.label : value?.label }}
            </template>
            <template #option="{ item }">
              {{ item.label }}
            </template>
          </FormSelectBase>
          <FormButton
            color="outline"
            :icon-left="ArrowDownTrayIcon"
            class="font-normal"
            :disabled="exportingExcel"
            @click="handleExportExcel"
          >
            {{ exportingExcel ? '导出中...' : '导出Excel' }}
          </FormButton>
          <input
            id="quality-acceptance-import-input"
            ref="qualityAcceptanceImportInputRef"
            type="file"
            accept=".xlsx,.xls"
            class="hidden"
            aria-label="导入质量验收Excel文件"
            @change="handleImportFileChange"
          />
          <FormButton
            color="outline"
            :icon-left="ArrowUpTrayIcon"
            class="font-normal"
            :disabled="importingExcel"
            @click="triggerImportExcel"
          >
            {{ importingExcel ? '导入中...' : '导入Excel' }}
          </FormButton>
          <FormButton
            color="primary"
            :icon-left="PlusIcon"
            class="font-normal"
            @click="onAdd"
          >
            新增
          </FormButton>
        </div>
      </div>
      <div
        class="bg-foundation rounded-lg border border-outline-3 flex flex-col flex-grow overflow-hidden"
      >
        <LayoutTable
          :columns="columns"
          :items="paginatedItems"
          empty-message="暂无验收单"
          class="flex-grow"
        >
          <template #name="{ item }">
            <span class="text-primary font-medium">{{ item.name }}</span>
          </template>
          <template #code="{ item }">
            <span class="text-primary font-medium">{{ item.code }}</span>
          </template>
          <template #actualFinishDate="{ item }">
            <span class="font-medium">
              {{ formatDate(item.actualFinishDate) || '-' }}
            </span>
          </template>
          <template #inspectionLotNumber="{ item }">
            <span class="text-sm text-foreground">{{ item.inspectionLotNumber }}</span>
          </template>
          <template #acceptancePart="{ item }">
            <span class="text-sm text-foreground">{{ item.acceptancePart }}</span>
          </template>
          <template #acceptanceContent="{ item }">
            <span class="text-sm text-foreground">{{ item.acceptanceContent }}</span>
          </template>
          <template #workVolume="{ item }">
            <span class="text-sm text-foreground">
              {{ formatWorkVolume(item.workVolume) }}
            </span>
          </template>
          <template #approveStatus="{ item }">
            <span
              class="rounded px-2 py-1 text-sm text-foreground"
              :class="getStatusColor(item)"
            >
              {{ getStatusText(item) }}
            </span>
          </template>
          <template #attachments="{ item }">
            <div
              v-if="item.attachments.length"
              class="flex flex-col items-start gap-y-1"
            >
              <button
                v-for="attachment in item.attachments"
                :key="attachment.id"
                class="text-primary hover:text-primary-muted text-left truncate max-w-full"
                @click="() => onAttachmentNameClick(item, attachment.id)"
              >
                {{ attachment.fileName }}
              </button>
            </div>
            <span v-else class="text-foreground">-</span>
          </template>
          <template #inspector="{ item }">
            <span class="text-sm text-foreground">{{ item.inspectorName }}</span>
          </template>
          <template #unit="{ item }">
            <span class="text-sm text-foreground">{{ item.unit }}</span>
          </template>
          <template #associationStatus="{ item }">
            <button
              v-if="canViewAssociation(item)"
              type="button"
              class="cursor-pointer text-sm"
              @click="onAssociationStatusClick(item)"
            >
              <CommonBadge
                :color-classes="getAssociationStatusColor(item.associationStatus)"
                class="text-sm font-medium"
                rounded
              >
                {{ item.associationStatus }}
              </CommonBadge>
            </button>
            <CommonBadge
              v-else
              :color-classes="getAssociationStatusColor(item.associationStatus)"
              class="text-sm font-medium"
              rounded
            >
              {{ item.associationStatus }}
            </CommonBadge>
          </template>
          <template #actions="{ item }">
            <div class="flex items-center justify-end gap-1.5 text-sm">
              <button
                class="rounded p-1 text-foreground-2 transition-colors hover:text-primary"
                title="查看详情"
                @click="onViewItem(item)"
              >
                <EyeIcon class="h-4 w-4" />
              </button>
              <button
                class="rounded p-1 transition-colors"
                :class="
                  canEditItem(item)
                    ? 'text-primary hover:text-primary-focus'
                    : 'text-foreground-3 cursor-not-allowed'
                "
                title="编辑"
                :disabled="!canEditItem(item)"
                @click="onEditItem(item)"
              >
                <PencilSquareIcon class="h-4 w-4" />
              </button>
              <button
                class="rounded p-1 transition-colors"
                :class="
                  canDeleteItem(item)
                    ? 'text-danger hover:text-danger-darker'
                    : 'text-foreground-3 cursor-not-allowed'
                "
                title="删除"
                :disabled="!canDeleteItem(item)"
                @click="onDeleteItem(item)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </template>
        </LayoutTable>
        <div
          class="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-outline-3 p-4 text-[13px] leading-5 text-foreground-2"
        >
          <div class="flex items-center gap-2">
            <span>每页显示</span>
            <label for="quality-acceptance-page-size" class="sr-only">
              每页显示条数
            </label>
            <select
              id="quality-acceptance-page-size"
              v-model="pageSize"
              class="rounded border border-outline-3 bg-foundation px-2 py-1 text-[13px] leading-5 focus:border-primary focus:outline-none"
            >
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
            <span>条</span>
            <span class="ml-2">
              共 {{ totalCount }} 条，第 {{ startItemIndex }}-{{ endItemIndex }}
              条
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button
              class="rounded px-2 py-1 text-[13px] leading-5 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage === 1"
              @click="goPrevPage"
            >
              &lt; 上一页
            </button>
            <span class="px-2">第 {{ currentPage }} / {{ totalPages || 1 }} 页</span>
            <button
              class="rounded px-2 py-1 text-[13px] leading-5 hover:bg-highlight-1 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!nextCursor"
              @click="goNextPage"
            >
              下一页 &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
    <ProjectsQualityAcceptanceCreateDialog
      v-model:open="createDialogOpen"
      :project-id="projectId"
      :loading="createFormLoading || updateFormLoading"
      :initial-data="editingInitialData"
      :readonly="isDialogReadonly"
      @submit="createAcceptanceItem"
    />
    <LayoutDialog
      v-model:open="attachmentsDialogOpen"
      max-width="xl"
      fullscreen="all"
      :buttons="attachmentDialogButtons"
    >
      <template #header>
        {{
          selectedPreviewAttachment ? selectedPreviewAttachment.fileName : '附件预览'
        }}
      </template>
      <template v-if="attachmentsDialogLoading">
        <div class="py-6 text-center text-body-sm text-foreground-2">
          附件信息加载中...
        </div>
      </template>
      <template v-else-if="attachmentsDialogError">
        <div class="py-6 text-center text-body-sm text-danger">
          {{ attachmentsDialogError.message || '加载附件失败' }}
        </div>
      </template>
      <template v-else-if="previewAttachmentList.length">
        <div class="flex flex-col gap-y-3 h-full">
          <div class="flex flex-col gap-y-1 pt-1">
            <button
              v-for="attachment in previewAttachmentList"
              :key="attachment.id"
              class="text-foreground hover:text-foreground-2 flex items-center gap-x-1"
              @click="() => onSelectPreviewAttachment(attachment)"
            >
              <Paperclip class="size-3" />
              <span class="truncate relative text-body-3xs">
                {{ attachment.fileName }}
              </span>
              <span class="text-body-3xs text-foreground-2">
                {{ formatAttachmentFileSize(attachment.fileSize) }}
              </span>
            </button>
          </div>
          <div class="w-full flex-1 h-full flex flex-col justify-center text-foreground text-body-xs px-6 pb-6 pt-2">
            <CommonFilePreview
              v-if="selectedPreviewAttachment"
              :blob-id="selectedPreviewAttachment.id"
              :project-id="projectId"
              :file-name="selectedPreviewAttachment.fileName"
              :file-type="selectedPreviewAttachment.fileType"
              :file-size="selectedPreviewAttachment.fileSize"
              class="w-full flex-1 h-full"
            />
          </div>
        </div>
      </template>
      <template v-else>
        <div class="py-6 text-center text-body-sm text-foreground-2">暂无附件</div>
      </template>
    </LayoutDialog>

    <LayoutDrawer
      v-model:open="associatedModelDrawerOpen"
      placement="right"
      width="95%"
      body-classes="p-4"
    >
      <template #title>
        关联模型查看
        <span v-if="selectedAssociationItem" class="text-sm text-foreground-2">
          | {{ selectedAssociationItem.name || selectedAssociationItem.code || '-' }}
        </span>
      </template>
      <div class="h-[85vh] relative">
        <CommonModelPropsViewer
          v-if="selectedAssociationModelIds.length"
          :project-id="projectId"
          :model-ids="selectedAssociationModelIds"
          :filter-bims="selectedAssociationBimIds"
          :filter-application-ids="selectedAssociationApplicationIds"
        />
        <div v-else class="h-full flex items-center justify-center text-foreground-2">
          未找到关联模型
        </div>
      </div>
    </LayoutDrawer>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'
import { useApolloClient, useMutation, useQuery } from '@vue/apollo-composable'
import { useDebounceFn } from '@vueuse/core'
import { ensureError } from '@speckle/shared'
import type { Nullable } from '@speckle/shared'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { Download, Paperclip } from 'lucide-vue-next'
import type { DocumentNode } from 'graphql'
import type {
  QualityAcceptanceAttachment,
  QualityAcceptanceCreateInput,
  QualityAcceptanceForm
} from './types'
import { projectQualityAcceptanceFormsQuery } from '~/lib/projects/graphql/queries'
import {
  createQualityAcceptanceFormMutation,
  deleteQualityAcceptanceFormMutation,
  importQualityAcceptanceFormsMutation,
  updateQualityAcceptanceFormMutation
} from '~/lib/projects/graphql/mutations'
import type {
  CreateQualityAcceptanceFormInput,
  ProjectQualityAcceptanceFormsQuery,
  UpdateQualityAcceptanceFormInput
} from '~/lib/common/generated/gql/graphql'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import { prettyFileSize } from '~/lib/core/helpers/file'
import { useFileDownload } from '~/lib/core/composables/fileUpload'
import dayjs from 'dayjs'

type AcceptanceRow = QualityAcceptanceForm & {
  associationStatus: '已关联' | '未关联'
  inspectorName: string
}

const route = useRoute()
const { apiOrigin } = useRuntimeConfig().public
const authToken = useCookie('auth-token')
const projectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const { getBlobUrl, download } = useFileDownload()
const { triggerNotification } = useGlobalToast()
const apollo = useApolloClient().client
const qualityAcceptanceImportInputRef = ref<HTMLInputElement | null>(null)
const exportingExcel = ref(false)
const importingExcel = ref(false)
const exportApproveStatus = ref('')
const NULL_APPROVE_STATUS_FILTER = '__NULL__'

const updateDebouncedSearch = useDebounceFn((query: string) => {
  debouncedSearchQuery.value = query.trim()
}, 300)

watch(
  searchQuery,
  (newQuery) => {
    updateDebouncedSearch(newQuery)
  },
  { immediate: true }
)

const columns = [
  { id: 'acceptancePart', header: '区域部位', classes: 'col-span-1' },
  { id: 'inspectionLotNumber', header: '检验批编号', classes: 'col-span-2' },
  { id: 'acceptanceContent', header: '检验批内容', classes: 'col-span-2' },
  { id: 'actualFinishDate', header: '验收日期', classes: 'col-span-1 font-medium' },
  { id: 'workVolume', header: '工程量', classes: 'col-span-1' },
  { id: 'unit', header: '单位', classes: 'col-span-1' },
  { id: 'attachments', header: '附件', classes: 'col-span-1' },
  { id: 'associationStatus', header: '关联状态', classes: 'col-span-1 text-sm' },
  { id: 'approveStatus', header: '月度验工', classes: 'col-span-1 text-sm' },
  { id: 'actions', header: '操作', classes: 'col-span-1 text-right text-sm' }
]

const approveStatusOptions = [
  { value: '', label: '全部状态' },
  { value: NULL_APPROVE_STATUS_FILTER, label: '未查验' },
  { value: 'PENDING', label: '正在查验' },
  { value: 'APPROVED', label: '已查验' },
  { value: 'REJECTED', label: '已拒绝' },
  { value: 'CANCELED', label: '已取消' }
]

const selectedExportApproveStatus = computed({
  get: () =>
    approveStatusOptions.find((option) => option.value === exportApproveStatus.value) ||
    approveStatusOptions[0],
  set: (option: { value: string; label: string } | undefined) => {
    exportApproveStatus.value = option?.value || ''
  }
})

const currentPage = ref(1)
const pageSize = ref(20)
const createDialogOpen = ref(false)
const editingItem = ref<AcceptanceRow | null>(null)
const dialogMode = ref<'create' | 'edit' | 'view'>('create')
const attachmentsDialogOpen = ref(false)
const attachmentsDialogLoading = ref(false)
const attachmentsDialogError = ref<Nullable<Error>>(null)
const previewAttachmentList = ref<QualityAcceptanceAttachment[]>([])
const selectedPreviewAttachment = ref<Nullable<QualityAcceptanceAttachment>>(null)
const selectedPreviewAttachmentObjectUrl = ref<Nullable<string>>(null)
const previewAttachmentError = ref<Nullable<Error>>(null)
const associatedModelDrawerOpen = ref(false)
const selectedAssociationItem = ref<AcceptanceRow | null>(null)
const pageCursors = ref<Record<number, string | null>>({ 1: null })
const currentCursor = computed(() => pageCursors.value[currentPage.value] || null)
const formsResult = ref<any>(null)
const formsLoading = ref(false)

const loadFormsData = async () => {
  if (!projectId.value) return
  formsLoading.value = true
  try {
    const data = await $fetch<any>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/quality-acceptance/forms`,
      {
        params: {
          search: debouncedSearchQuery.value || undefined,
          cursor: currentCursor.value || undefined,
          limit: pageSize.value
        }
      }
    )
    formsResult.value = data
  } catch (err) {
    console.error('Failed to load quality acceptance forms via REST:', err)
  } finally {
    formsLoading.value = false
  }
}

const formsRefetch = loadFormsData

watch(
  [projectId, debouncedSearchQuery, currentCursor, pageSize],
  () => {
    void loadFormsData()
  },
  { immediate: true }
)
const { mutate: createFormMutate, loading: createFormLoading } = useMutation(
  createQualityAcceptanceFormMutation
)
const { mutate: deleteFormMutate, loading: deleteFormLoading } = useMutation(
  deleteQualityAcceptanceFormMutation
)
const { mutate: updateFormMutate, loading: updateFormLoading } = useMutation(
  updateQualityAcceptanceFormMutation
)
const { mutate: importFormsMutate } = useMutation(importQualityAcceptanceFormsMutation)

type QualityAcceptanceFormNode = NonNullable<
  NonNullable<
    NonNullable<ProjectQualityAcceptanceFormsQuery['project']>['qualityAcceptanceForms']
  >['items'][number]
>

const acceptanceForms = computed<QualityAcceptanceForm[]>(() =>
  (formsResult.value?.items || [])
    .filter(
      (
        item: any
      ): item is any => !!item
    )
    .map((item: any) => {
      const bimRaw = (
        item as unknown as {
          BIM?: Array<{
            modelId?: string | null
            bimIds?: Array<string | null> | null
            applicationIds?: string[] | null
          }> | null
        }
      ).BIM
      return {
        id: item.id,
        name: item.name || '',
        boqItemId: item.boqItemId || '',
        code: item.code || '',
        inspectionLotNumber: item.inspectionLotNumber || '',
        acceptancePart: item.acceptancePart || '',
        acceptanceContent: item.acceptanceContent || '',
        actualStartDate: Number(item.actualStartDate || 0),
        actualFinishDate: Number(item.actualFinishDate || 0),
        inspector: item.inspector?.id || item.inspectorId || '',
        attachments: (item.attachments || []).flatMap(
          (attachment: NonNullable<QualityAcceptanceFormNode['attachments']>[number]) =>
            attachment
              ? [
                  {
                    id: attachment.id,
                    fileName: attachment.fileName,
                    fileType: attachment.fileType,
                    fileSize: attachment.fileSize || null
                  }
                ]
              : []
        ),
        creator: item.creator?.name || item.creator?.id || item.creatorId || '',
        workVolume: Number(item.workVolume || 0),
        unit: item.unit || '',
        BIM: bimRaw
          ? bimRaw.map((entry) => ({
              modelId: entry.modelId || '',
              bimIds: entry.bimIds || [],
              applicationIds: entry.applicationIds || []
            }))
          : item.BIMelement
          ? [
              {
                modelId: '',
                bimIds: item.BIMelement,
                applicationIds: []
              }
            ]
          : null,
        timeZone: item.timeZone || '',
        approveStatus: item.approveStatus || null,
        occupiedMeasurementId: item.occupiedMeasurementId || null,
        createdAt: new Date(item.createdAt).getTime(),
        updatedAt: new Date(item.updatedAt).getTime()
      }
    })
)
const totalCount = computed(
  () => formsResult.value?.totalCount || 0
)
const nextCursor = computed(
  () => formsResult.value?.cursor || null
)
const inspectorNameMap = computed(() => {
  const map = new Map<string, string>()
  for (const item of formsResult.value?.items || []) {
    if (!item) continue
    map.set(item.id, item.inspector?.name || '-')
  }
  return map
})

const hasValidBimAssociation = (BIM: QualityAcceptanceForm['BIM']): boolean => {
  if (!BIM || !BIM.length) return false
  return BIM.some((entry) => {
    const modelId = (entry.modelId || '').trim()
    const bimIds = entry.bimIds || []
    const applicationIds = entry.applicationIds || []
    return !!modelId && (bimIds.length > 0 || applicationIds.length > 0)
  })
}

const canViewAssociation = (item: AcceptanceRow): boolean =>
  hasValidBimAssociation(item.BIM)

const tableItems = computed<AcceptanceRow[]>(() =>
  acceptanceForms.value.map((item) => ({
    ...item,
    associationStatus: hasValidBimAssociation(item.BIM) ? '已关联' : '未关联',
    inspectorName: inspectorNameMap.value.get(item.id) || '-'
  }))
)
const notify = (title: string, type: ToastNotificationType, description?: string) => {
  triggerNotification({
    title,
    type,
    description
  })
}
const editingInitialData = computed<QualityAcceptanceCreateInput | null>(() => {
  const item = editingItem.value
  if (!item) return null
  return {
    flowId: '',
    name: item.name,
    boqItemId: item.boqItemId,
    code: item.code,
    inspectionLotNumber: item.inspectionLotNumber,
    acceptancePart: item.acceptancePart,
    acceptanceContent: item.acceptanceContent,
    actualStartDate: item.actualStartDate,
    actualFinishDate: item.actualFinishDate,
    inspector: item.inspector,
    attachments: item.attachments.map((attachment) => attachment.id),
    creator: item.creator,
    workVolume: item.workVolume,
    unit: item.unit,
    BIM: item.BIM,
    timeZone: item.timeZone,
    approveStatus: item.approveStatus
  }
})
const paginatedItems = computed(() => tableItems.value)
const totalPages = computed(() =>
  Math.ceil(totalCount.value / Number(pageSize.value || 1))
)

const startItemIndex = computed(() =>
  totalCount.value === 0 ? 0 : (currentPage.value - 1) * Number(pageSize.value) + 1
)
const endItemIndex = computed(() =>
  Math.min(currentPage.value * Number(pageSize.value), totalCount.value)
)

watch([projectId, debouncedSearchQuery, pageSize], () => {
  currentPage.value = 1
  pageCursors.value = { 1: null }
})

const goPrevPage = () => {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
}

const goNextPage = () => {
  const cursor = nextCursor.value
  if (!cursor) return
  const nextPage = currentPage.value + 1
  pageCursors.value[nextPage] = cursor
  currentPage.value = nextPage
}

const isImageAttachment = (attachment: QualityAcceptanceAttachment) => {
  switch (attachment.fileType.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return true
    default:
      return false
  }
}

const formatAttachmentFileSize = (size: number | null) =>
  size ? prettyFileSize(size) : '未知大小'

const clearSelectedPreviewAttachmentObjectUrl = () => {
  if (!selectedPreviewAttachmentObjectUrl.value) return
  URL.revokeObjectURL(selectedPreviewAttachmentObjectUrl.value)
  selectedPreviewAttachmentObjectUrl.value = null
}

const loadSelectedAttachmentPreviewUrl = async () => {
  clearSelectedPreviewAttachmentObjectUrl()
  previewAttachmentError.value = null
  if (
    !selectedPreviewAttachment.value ||
    !isImageAttachment(selectedPreviewAttachment.value)
  ) {
    return
  }

  try {
    selectedPreviewAttachmentObjectUrl.value = await getBlobUrl({
      blobId: selectedPreviewAttachment.value.id,
      projectId: projectId.value
    })
  } catch (err) {
    previewAttachmentError.value = ensureError(err)
  }
}

const onSelectPreviewAttachment = async (attachment: QualityAcceptanceAttachment) => {
  selectedPreviewAttachment.value = attachment
  await loadSelectedAttachmentPreviewUrl()
}

const onAttachmentDownloadClick = async () => {
  if (!selectedPreviewAttachment.value) return
  await download({
    blobId: selectedPreviewAttachment.value.id,
    fileName: selectedPreviewAttachment.value.fileName,
    projectId: projectId.value
  })
}

const openAttachmentsDialog = async (item: AcceptanceRow, selectedBlobId?: string) => {
  attachmentsDialogOpen.value = true
  attachmentsDialogLoading.value = true
  attachmentsDialogError.value = null
  previewAttachmentError.value = null
  previewAttachmentList.value = []
  selectedPreviewAttachment.value = null
  clearSelectedPreviewAttachmentObjectUrl()

  try {
    const attachments = item.attachments
    if (!attachments.length) return

    previewAttachmentList.value = attachments

    if (!previewAttachmentList.value.length) {
      attachmentsDialogError.value = new Error('未找到可预览的附件')
      return
    }

    selectedPreviewAttachment.value =
      previewAttachmentList.value.find(
        (attachment) => attachment.id === selectedBlobId
      ) || previewAttachmentList.value[0]
    await loadSelectedAttachmentPreviewUrl()
  } catch (err) {
    attachmentsDialogError.value = ensureError(err)
  } finally {
    attachmentsDialogLoading.value = false
  }
}

const onAttachmentNameClick = (item: AcceptanceRow, blobId: string) => {
  openAttachmentsDialog(item, blobId).catch((err) => {
    attachmentsDialogError.value = ensureError(err)
  })
}

const attachmentDialogButtons = computed((): LayoutDialogButton[] | undefined => {
  if (!selectedPreviewAttachment.value) return undefined
  return [
    {
      text: selectedPreviewAttachment.value.fileSize
        ? prettyFileSize(selectedPreviewAttachment.value.fileSize)
        : '下载',
      props: {
        iconLeft: Download,
        color: 'outline'
      },
      onClick: () => {
        onAttachmentDownloadClick().catch((err) => {
          previewAttachmentError.value = ensureError(err)
        })
      }
    }
  ]
})

const canEditItem = (item: AcceptanceRow) => !item.approveStatus && !item.occupiedMeasurementId

const canDeleteItem = (item: AcceptanceRow) => {
  const status = (item.approveStatus || '').toUpperCase()
  return (status === 'REJECTED' || status === 'CANCELED' || !status) && !item.occupiedMeasurementId
}

const selectedAssociationModelIds = computed(() => {
  const BIM = selectedAssociationItem.value?.BIM || []
  return BIM.map((entry) => entry.modelId).filter(Boolean)
})

const selectedAssociationBimIds = computed(() => {
  const BIM = selectedAssociationItem.value?.BIM || []
  return BIM.flatMap((entry) => entry.bimIds || []).filter((id): id is string => !!id)
})
const selectedAssociationApplicationIds = computed(() => {
  const BIM = selectedAssociationItem.value?.BIM || []
  return BIM.flatMap((entry) => entry.applicationIds || [])
})

const onAssociationStatusClick = (item: AcceptanceRow) => {
  if (!canViewAssociation(item)) return
  selectedAssociationItem.value = {
    ...item,
    BIM: item.BIM
      ? item.BIM.map((entry) => ({
          modelId: entry.modelId,
          bimIds: [...entry.bimIds],
          applicationIds: [...entry.applicationIds]
        }))
      : null
  }
  associatedModelDrawerOpen.value = true
}

const onEditItem = (item: AcceptanceRow) => {
  if (!canEditItem(item)) return
  dialogMode.value = 'edit'
  editingItem.value = item
  createDialogOpen.value = true
}

const onViewItem = (item: AcceptanceRow) => {
  dialogMode.value = 'view'
  editingItem.value = item
  createDialogOpen.value = true
}

const onDeleteItem = async (item: AcceptanceRow) => {
  if (!canDeleteItem(item)) return
  await removeAcceptanceItem(item.id)
}

const isDialogReadonly = computed(() => dialogMode.value === 'view')

const onAdd = () => {
  dialogMode.value = 'create'
  editingItem.value = null
  createDialogOpen.value = true
}

const triggerImportExcel = () => {
  if (importingExcel.value) return
  qualityAcceptanceImportInputRef.value?.click()
}

const handleExportExcel = async () => {
  if (!projectId.value || exportingExcel.value) return
  exportingExcel.value = true
  try {
    const fileContent = await $fetch<Blob>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/quality-acceptance/forms/export-excel`,
      {
        query: {
          approveStatus: exportApproveStatus.value || undefined,
          search: debouncedSearchQuery.value || undefined
        },
        responseType: 'blob'
      }
    )

    const url = URL.createObjectURL(fileContent)
    const link = document.createElement('a')
    const statusLabel =
      approveStatusOptions.find((option) => option.value === exportApproveStatus.value)
        ?.label || '全部状态'
    link.href = url
    link.download = `质量验收-${statusLabel}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    notify('质量验收导出成功', ToastNotificationType.Success)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    notify('质量验收导出失败', ToastNotificationType.Danger, message)
  } finally {
    exportingExcel.value = false
  }
}

const handleImportFileChange = async (event: Event) => {
  if (!projectId.value || importingExcel.value) return
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  importingExcel.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<{
      success: boolean
      createdCount: number
      failedCount: number
      failedRows: string[]
    }>(
      `${apiOrigin}/api/v1/projects/${projectId.value}/quality-acceptance/forms/import-excel`,
      {
        method: 'POST',
        body: formData
      }
    )

    if (!response?.success) {
      throw new Error('导入失败，服务器没有返回成功状态')
    }

    await formsRefetch()

    if (response.success && response.failedCount === 0) {
      notify(
        '质量验收导入成功',
        ToastNotificationType.Success,
        `成功导入 ${response.createdCount} 条`
      )
      return
    }

    const failedDetails =
      response.failedRows && response.failedRows.length > 0
        ? `\n${response.failedRows.slice(0, 5).join('\n')}`
        : ''

    notify(
      '质量验收部分导入失败',
      ToastNotificationType.Danger,
      `成功 ${response.createdCount} 条，失败 ${response.failedCount} 条。${failedDetails}`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    notify('质量验收导入失败', ToastNotificationType.Danger, message)
  } finally {
    importingExcel.value = false
    if (input) input.value = ''
  }
}

const getStatusColor = (item: AcceptanceRow) => {
  if (!item.occupiedMeasurementId) {
    return 'bg-outline-3 text-foreground-3'
  }
  const status = item.approveStatus
  switch (status) {
    case 'START':
      return 'bg-warning-lighter text-warning-darker'
    case 'PENDING':
      return 'bg-yellow-500 text-white'
    case 'APPROVED':
      return 'bg-green-500 text-white'
    case 'REJECTED':
      return 'bg-red-500 text-white'
    case 'CANCELED':
      return 'bg-gray-400 text-white'
    case null:
    case undefined:
    case '':
      return 'bg-warning-lighter text-warning-darker'
    default:
      return 'bg-gray-500 text-white'
  }
}

const getStatusText = (item: AcceptanceRow) => {
  if (!item.occupiedMeasurementId) {
    return '-'
  }
  const status = item.approveStatus
  switch (status) {
    case 'START':
      return '未查验'
    case 'PENDING':
      return '查验中'
    case 'APPROVED':
      return '已查验'
    case 'REJECTED':
      return '未查验'
    case 'CANCELED':
      return '已取消'
    case null:
    case undefined:
    case '':
      return '未查验'
    default:
      return '-'
  }
}

const removeAcceptanceItem = async (id: string) => {
  if (!projectId.value || deleteFormLoading.value) return
  await deleteFormMutate({
    input: {
      projectId: projectId.value,
      id
    }
  })
  await formsRefetch()
}

const createAcceptanceItem = async (payload: QualityAcceptanceCreateInput) => {
  if (!projectId.value || createFormLoading.value || updateFormLoading.value) return
  if (editingItem.value) {
    await updateFormMutate({
      input: {
        projectId: projectId.value,
        id: editingItem.value.id,
        name: payload.name,
        boqItemId: payload.boqItemId,
        code: payload.code,
        inspectionLotNumber: payload.inspectionLotNumber,
        acceptancePart: payload.acceptancePart,
        acceptanceContent: payload.acceptanceContent,
        actualStartDate: payload.actualStartDate,
        actualFinishDate: payload.actualFinishDate,
        inspector: payload.inspector,
        attachments: payload.attachments,
        workVolume: payload.workVolume,
        unit: payload.unit,
        BIM: payload.BIM,
        timeZone: payload.timeZone,
        approveStatus: payload.approveStatus
      } as UpdateQualityAcceptanceFormInput
    })
    editingItem.value = null
  } else {
    await createFormMutate({
      input: {
        projectId: projectId.value,
        flowId: payload.flowId || null,
        name: payload.name,
        boqItemId: payload.boqItemId,
        code: payload.code,
        inspectionLotNumber: payload.inspectionLotNumber,
        acceptancePart: payload.acceptancePart,
        acceptanceContent: payload.acceptanceContent,
        actualStartDate: payload.actualStartDate,
        actualFinishDate: payload.actualFinishDate,
        inspector: payload.inspector,
        attachments: payload.attachments,
        workVolume: payload.workVolume,
        unit: payload.unit,
        BIM: payload.BIM,
        timeZone: payload.timeZone,
        approveStatus: payload.approveStatus
      } as CreateQualityAcceptanceFormInput
    })
  }
  await formsRefetch()
  if (currentPage.value !== 1) {
    currentPage.value = 1
  }
}

const formatWorkVolume = (value: number) => {
  if (Number.isInteger(value)) return `${value}`
  return value.toFixed(2)
}

const getAssociationStatusColor = (status: string) => {
  if (status === '已关联') return 'bg-success-lighter text-success'
  if (status === '未关联') return 'bg-foundation-3 text-foreground-2'
  return 'bg-foundation text-foreground-2'
}

const formatDate = (date: number) => {
  return dayjs(date).format('YYYY-MM-DD')
}

watch(attachmentsDialogOpen, (isOpen) => {
  if (isOpen) return
  attachmentsDialogLoading.value = false
  attachmentsDialogError.value = null
  previewAttachmentError.value = null
  previewAttachmentList.value = []
  selectedPreviewAttachment.value = null
  clearSelectedPreviewAttachmentObjectUrl()
})

watch(associatedModelDrawerOpen, (isOpen) => {
  if (isOpen) return
  selectedAssociationItem.value = null
})
</script>
