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
          <select
            id="quality-acceptance-export-status"
            v-model="exportApproveStatus"
            aria-label="导出状态筛选"
            class="bg-foundation border border-outline-3 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          >
            <option
              v-for="option in approveStatusOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <FormButton
            color="outline"
            :icon-left="ArrowDownTrayIcon"
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
            :disabled="importingExcel"
            @click="triggerImportExcel"
          >
            {{ importingExcel ? '导入中...' : '导入Excel' }}
          </FormButton>
          <FormButton color="primary" :icon-left="PlusIcon" @click="onAdd">
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
            <span class="text-foreground">{{ item.inspectionLotNumber }}</span>
          </template>
          <template #acceptancePart="{ item }">
            <span class="text-foreground">{{ item.acceptancePart }}</span>
          </template>
          <template #acceptanceContent="{ item }">
            <span class="text-foreground">{{ item.acceptanceContent }}</span>
          </template>
          <template #workVolume="{ item }">
            <span class="text-foreground">{{ formatWorkVolume(item.workVolume) }}</span>
          </template>
          <template #approveStatus="{ item }">
            <span
              class="text-foreground px-2 py-1 rounded"
              :class="getStatusColor(item.approveStatus)"
            >
              {{ getStatusText(item.approveStatus) }}
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
            <span class="text-foreground">{{ item.inspectorName }}</span>
          </template>
          <template #unit="{ item }">
            <span class="text-foreground">{{ item.unit }}</span>
          </template>
          <template #associationStatus="{ item }">
            <button
              v-if="canViewAssociation(item)"
              type="button"
              class="cursor-pointer"
              @click="onAssociationStatusClick(item)"
            >
              <CommonBadge
                :color-classes="getAssociationStatusColor(item.associationStatus)"
                rounded
              >
                {{ item.associationStatus }}
              </CommonBadge>
            </button>
            <CommonBadge
              v-else
              :color-classes="getAssociationStatusColor(item.associationStatus)"
              rounded
            >
              {{ item.associationStatus }}
            </CommonBadge>
          </template>
          <template #actions="{ item }">
            <div class="flex items-center justify-end gap-2">
              <button
                class="text-foreground-2 hover:text-primary transition-colors"
                title="查看详情"
                @click="onViewItem(item)"
              >
                <EyeIcon class="h-5 w-5" />
              </button>
              <button
                class="transition-colors"
                :class="
                  canEditItem(item)
                    ? 'text-primary hover:text-primary-focus'
                    : 'text-foreground-3 cursor-not-allowed'
                "
                title="编辑"
                :disabled="!canEditItem(item)"
                @click="onEditItem(item)"
              >
                <PencilSquareIcon class="h-5 w-5" />
              </button>
              <button
                class="transition-colors"
                :class="
                  canDeleteItem(item)
                    ? 'text-danger hover:text-danger-darker'
                    : 'text-foreground-3 cursor-not-allowed'
                "
                title="删除"
                :disabled="!canDeleteItem(item)"
                @click="onDeleteItem(item)"
              >
                <TrashIcon class="h-5 w-5" />
              </button>
            </div>
          </template>
        </LayoutTable>
        <div
          class="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-outline-3 gap-4 text-sm text-foreground-2"
        >
          <div class="flex items-center gap-2">
            <span>每页显示</span>
            <label for="quality-acceptance-page-size" class="sr-only">
              每页显示条数
            </label>
            <select
              id="quality-acceptance-page-size"
              v-model="pageSize"
              class="bg-foundation border border-outline-3 rounded px-2 py-1 focus:outline-none focus:border-primary"
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
              class="px-2 py-1 rounded hover:bg-highlight-1 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="currentPage === 1"
              @click="goPrevPage"
            >
              &lt; 上一页
            </button>
            <span class="px-2">第 {{ currentPage }} / {{ totalPages || 1 }} 页</span>
            <button
              class="px-2 py-1 rounded hover:bg-highlight-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
      max-width="lg"
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
        <div class="flex flex-col gap-y-3">
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
          <div class="flex justify-center text-foreground text-body-xs py-4">
            <span
              v-if="previewAttachmentError"
              class="inline-flex space-x-2 items-center"
            >
              加载附件预览失败
            </span>
            <template
              v-else-if="
                selectedPreviewAttachment &&
                isImageAttachment(selectedPreviewAttachment) &&
                selectedPreviewAttachmentObjectUrl
              "
            >
              <img
                crossorigin="anonymous"
                :src="selectedPreviewAttachmentObjectUrl"
                alt="附件预览"
              />
            </template>
            <template v-else>
              <span class="inline-flex space-x-4 items-center">
                <TriangleAlert class="w-6 h-6" />
                <span>
                  该文件是用户上传的，未进行安全扫描。请在下载前检查文件类型。
                </span>
              </span>
            </template>
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
import { Download, Paperclip, TriangleAlert } from 'lucide-vue-next'
import type { DocumentNode } from 'graphql'
import * as XLSX from 'xlsx'
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
  { id: 'associationStatus', header: '关联状态', classes: 'col-span-1' },
  { id: 'approveStatus', header: '月度验工', classes: 'col-span-1' },
  { id: 'actions', header: '操作', classes: 'col-span-1 text-right' }
]

const approveStatusOptions = [
  { value: '', label: '全部状态' },
  { value: NULL_APPROVE_STATUS_FILTER, label: '未查验' },
  { value: 'PENDING', label: '正在查验' },
  { value: 'APPROVED', label: '已查验' },
  { value: 'REJECTED', label: '已拒绝' },
  { value: 'CANCELED', label: '已取消' }
]

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
const { result: formsResult, refetch: formsRefetch } = useQuery(
  projectQualityAcceptanceFormsQuery as DocumentNode,
  () => ({
    projectId: projectId.value,
    search: debouncedSearchQuery.value || null,
    cursor: currentCursor.value,
    limit: pageSize.value
  }),
  {
    enabled: computed(() => !!projectId.value)
  }
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
  (formsResult.value?.project?.qualityAcceptanceForms.items || [])
    .filter(
      (
        item: QualityAcceptanceFormNode | null | undefined
      ): item is QualityAcceptanceFormNode => !!item
    )
    .map((item: QualityAcceptanceFormNode) => {
      const bimElementsRaw = (
        item as unknown as {
          bimElements?: {
            modelId?: string | null
            bimIds?: string[] | null
            applicationIds?: string[] | null
          } | null
        }
      ).bimElements
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
        bimElements: bimElementsRaw
          ? {
              modelId: bimElementsRaw.modelId || '',
              bimIds: bimElementsRaw.bimIds || [],
              applicationIds: bimElementsRaw.applicationIds || []
            }
          : item.BIMelement
          ? {
              modelId: '',
              bimIds: item.BIMelement,
              applicationIds: []
            }
          : null,
        timeZone: item.timeZone || '',
        approveStatus: item.approveStatus || null,
        createdAt: new Date(item.createdAt).getTime(),
        updatedAt: new Date(item.updatedAt).getTime()
      }
    })
)
const totalCount = computed(
  () => formsResult.value?.project?.qualityAcceptanceForms.totalCount || 0
)
const nextCursor = computed(
  () => formsResult.value?.project?.qualityAcceptanceForms.cursor || null
)
const inspectorNameMap = computed(() => {
  const map = new Map<string, string>()
  for (const item of formsResult.value?.project?.qualityAcceptanceForms.items || []) {
    if (!item) continue
    map.set(item.id, item.inspector?.name || '-')
  }
  return map
})

const hasValidBimAssociation = (
  bimElements: QualityAcceptanceForm['bimElements']
): boolean => {
  const modelId = (bimElements?.modelId || '').trim()
  const bimIds = bimElements?.bimIds || []
  const applicationIds = bimElements?.applicationIds || []
  return !!modelId && (bimIds.length > 0 || applicationIds.length > 0)
}

const canViewAssociation = (item: AcceptanceRow): boolean =>
  hasValidBimAssociation(item.bimElements)

const tableItems = computed<AcceptanceRow[]>(() =>
  acceptanceForms.value.map((item) => ({
    ...item,
    associationStatus: hasValidBimAssociation(item.bimElements) ? '已关联' : '未关联',
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
    bimElements: item.bimElements,
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

const canEditItem = (item: AcceptanceRow) => !item.approveStatus

const canDeleteItem = (item: AcceptanceRow) => {
  const status = (item.approveStatus || '').toUpperCase()
  return status === 'REJECTED' || status === 'CANCELED' || !status
}

const selectedAssociationModelIds = computed(() => {
  const modelId = (selectedAssociationItem.value?.bimElements?.modelId || '').trim()
  return modelId ? [modelId] : []
})

const selectedAssociationBimIds = computed(() => [
  ...(selectedAssociationItem.value?.bimElements?.bimIds || [])
])
const selectedAssociationApplicationIds = computed(() => [
  ...(selectedAssociationItem.value?.bimElements?.applicationIds || [])
])

const onAssociationStatusClick = (item: AcceptanceRow) => {
  if (!canViewAssociation(item)) return
  selectedAssociationItem.value = {
    ...item,
    bimElements: item.bimElements
      ? {
          modelId: item.bimElements.modelId,
          bimIds: [...item.bimElements.bimIds],
          applicationIds: [...item.bimElements.applicationIds]
        }
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

const formatExportDate = (date: string | number | null | undefined) => {
  if (date === null || date === undefined || date === '') return ''
  const numeric = Number(date)
  if (!Number.isNaN(numeric) && numeric > 0) {
    return dayjs(numeric).format('YYYY-MM-DD')
  }
  const parsed = dayjs(String(date))
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

const parseApproveStatus = (value: string): string | null | undefined => {
  const normalized = value.trim().toUpperCase()
  if (!normalized) return null
  if (
    normalized === '-' ||
    normalized === 'NULL' ||
    normalized === 'NONE' ||
    normalized === 'N/A' ||
    value.trim() === '未查验' ||
    value.trim() === '未验工'
  ) {
    return null
  }
  const statusMap: Record<string, string> = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELED: 'CANCELED',
    正在查验: 'PENDING',
    已查验: 'APPROVED',
    已拒绝: 'REJECTED',
    已取消: 'CANCELED'
  }
  return statusMap[normalized] || statusMap[value.trim()]
}

type ImportQualityAcceptanceRow = {
  rowNumber: number
  name: string
  code: string
  inspectionLotNumber: string
  acceptancePart: string
  acceptanceContent: string
  actualFinishDate: number | null
  workVolume: number | null
  unit: string
  approveStatus: string | null
}

const parseExcelDate = (raw: string | number): number | null => {
  if (typeof raw === 'number') {
    if (raw > 100000000000) return raw
    const excelDate = XLSX.SSF.parse_date_code(raw)
    if (!excelDate) return null
    return new Date(
      excelDate.y,
      excelDate.m - 1,
      excelDate.d,
      excelDate.H,
      excelDate.M,
      excelDate.S
    ).getTime()
  }
  const parsed = dayjs(raw.trim())
  return parsed.isValid() ? parsed.valueOf() : null
}

const parseImportRows = (sheet: XLSX.WorkSheet) => {
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: ''
  })
  if (matrix.length < 2) {
    throw new Error('Excel 中没有可导入的数据')
  }

  const headerRow = matrix[0].map((cell) => String(cell ?? '').trim())
  const findHeaderIndex = (keys: string[]) =>
    headerRow.findIndex((cell) => keys.includes(cell))

  const nameIndex = findHeaderIndex(['验收单名称', '名称'])
  const codeIndex = findHeaderIndex(['编码', '验收编码'])
  const inspectionLotNumberIndex = findHeaderIndex(['检验批编号'])
  const acceptancePartIndex = findHeaderIndex(['区域部位'])
  const acceptanceContentIndex = findHeaderIndex(['检验批内容', '验收内容'])
  const actualFinishDateIndex = findHeaderIndex(['验收日期'])
  const workVolumeIndex = findHeaderIndex(['工程量'])
  const unitIndex = findHeaderIndex(['单位'])
  const approveStatusIndex = findHeaderIndex(['月度验工', '验工状态', 'approveStatus'])

  if (
    inspectionLotNumberIndex < 0 ||
    acceptancePartIndex < 0 ||
    acceptanceContentIndex < 0
  ) {
    throw new Error('模板缺少必要列：检验批编号、区域部位、检验批内容')
  }

  const rows: ImportQualityAcceptanceRow[] = []
  matrix.slice(1).forEach((row, index) => {
    const rowNumber = index + 2
    const readValue = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return String(row[cellIndex] ?? '').trim()
    }
    const readRawValue = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return row[cellIndex]
    }

    const name = readValue(nameIndex)
    const code = readValue(codeIndex)
    const inspectionLotNumber = readValue(inspectionLotNumberIndex)
    const acceptancePart = readValue(acceptancePartIndex)
    const acceptanceContent = readValue(acceptanceContentIndex)
    const actualFinishDateRaw = readRawValue(actualFinishDateIndex)
    const workVolumeRaw = readValue(workVolumeIndex)
    const unit = readValue(unitIndex)
    const approveStatusRaw = readValue(approveStatusIndex)

    if (
      !name &&
      !code &&
      !inspectionLotNumber &&
      !acceptancePart &&
      !String(actualFinishDateRaw ?? '').trim() &&
      !workVolumeRaw &&
      !unit &&
      !approveStatusRaw
    ) {
      return
    }

    if (!inspectionLotNumber || !acceptancePart || !acceptanceContent) {
      throw new Error(`第 ${rowNumber} 行缺少必要字段（检验批编号/区域部位）`)
    }

    let actualFinishDate: number | null = null
    if (String(actualFinishDateRaw ?? '').trim()) {
      actualFinishDate = parseExcelDate(actualFinishDateRaw as string | number)
      if (!actualFinishDate) {
        throw new Error(`第 ${rowNumber} 行验收日期格式不正确`)
      }
    }

    let workVolume: number | null = null
    if (workVolumeRaw) {
      const parsed = Number.parseFloat(workVolumeRaw)
      if (Number.isNaN(parsed)) {
        throw new Error(`第 ${rowNumber} 行工程量不是有效数字`)
      }
      workVolume = parsed
    }

    const approveStatus = approveStatusRaw ? parseApproveStatus(approveStatusRaw) : null
    if (approveStatusRaw && approveStatus === undefined) {
      throw new Error(`第 ${rowNumber} 行月度验工状态不正确：${approveStatusRaw}`)
    }

    rows.push({
      rowNumber,
      name,
      code,
      inspectionLotNumber,
      acceptancePart,
      acceptanceContent,
      actualFinishDate,
      workVolume,
      unit,
      approveStatus: approveStatus ?? null
    })
  })

  if (!rows.length) {
    throw new Error('Excel 中没有可导入的数据')
  }

  return rows
}

const fetchAllFormsForExport = async () => {
  const allItems: QualityAcceptanceFormNode[] = []
  let cursor: string | null = null
  const visited = new Set<string | null>()

  while (!visited.has(cursor)) {
    visited.add(cursor)
    const response = (await apollo.query({
      query: projectQualityAcceptanceFormsQuery as DocumentNode,
      variables: {
        projectId: projectId.value,
        search: debouncedSearchQuery.value || null,
        cursor,
        limit: 200
      },
      fetchPolicy: 'network-only'
    })) as { data: ProjectQualityAcceptanceFormsQuery }
    const page: ProjectQualityAcceptanceFormsQuery['project']['qualityAcceptanceForms'] =
      response.data.project?.qualityAcceptanceForms
    if (!page) break
    allItems.push(
      ...(page.items || []).filter(
        (
          item: QualityAcceptanceFormNode | null | undefined
        ): item is QualityAcceptanceFormNode => !!item
      )
    )
    if (!page.cursor) break
    cursor = page.cursor
  }

  return allItems
}

const handleExportExcel = async () => {
  if (!projectId.value || exportingExcel.value) return
  exportingExcel.value = true
  try {
    const items = await fetchAllFormsForExport()
    const normalizedFilter = exportApproveStatus.value || ''
    const filteredItems = items.filter((item) => {
      if (!normalizedFilter) return true
      if (normalizedFilter === NULL_APPROVE_STATUS_FILTER) return !item.approveStatus
      return item.approveStatus === normalizedFilter
    })
    if (!filteredItems.length) {
      throw new Error('当前筛选条件下没有可导出的数据')
    }

    const header = [
      '验收单名称',
      '编码',
      '检验批编号',
      '区域部位',
      '检验批内容',
      '验收日期',
      '工程量',
      '单位',
      '月度验工'
    ]
    const rows = filteredItems.map((item) => [
      item.name || '',
      item.code || '',
      item.inspectionLotNumber || '',
      item.acceptancePart || '',
      item.acceptanceContent || '',
      formatExportDate(item.actualFinishDate),
      item.workVolume ?? '',
      item.unit || '',
      getStatusText(item.approveStatus)
    ])
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '质量验收')
    const fileContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([fileContent], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
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
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('Excel 中未找到工作表')
    }
    const sheet = workbook.Sheets[firstSheetName]
    const rows = parseImportRows(sheet)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const result = await importFormsMutate({
      input: {
        projectId: projectId.value,
        items: rows.map((row) => ({
          rowNumber: row.rowNumber,
          flowId: null,
          name: row.name || row.acceptancePart,
          code: row.code || null,
          inspectionLotNumber: row.inspectionLotNumber,
          acceptancePart: row.acceptancePart,
          acceptanceContent: row.acceptanceContent,
          actualStartDate: row.actualFinishDate,
          actualFinishDate: row.actualFinishDate,
          inspector: null,
          attachments: [],
          workVolume: row.workVolume,
          unit: row.unit || null,
          bimElements: null,
          timeZone: timeZone || null,
          approveStatus: row.approveStatus
        }))
      }
    })
    const importResult =
      result?.data?.projectMutations?.qualityAcceptanceMutations?.importForms
    if (!importResult) {
      throw new Error('导入失败，请稍后重试')
    }

    await formsRefetch()
    if (!importResult.failedCount) {
      notify(
        '质量验收导入成功',
        ToastNotificationType.Success,
        `成功导入 ${importResult.createdCount} 条`
      )
      return
    }

    notify(
      '质量验收部分导入失败',
      ToastNotificationType.Danger,
      `成功 ${importResult.createdCount} 条，失败 ${importResult.failedCount} 条。\n${(
        importResult.failedRows || []
      )
        .slice(0, 5)
        .join('\n')}`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    notify('质量验收导入失败', ToastNotificationType.Danger, message)
  } finally {
    importingExcel.value = false
    if (input) input.value = ''
  }
}

const getStatusColor = (status: string | null | undefined) => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-500 text-white'
    case 'APPROVED':
      return 'bg-green-500 text-white'
    case 'REJECTED':
      return 'bg-red-500 text-white'
    case 'CANCELED':
      return 'bg-gray-400 text-white'
    case null:
      return 'bg-outline-3 text-foreground'
    default:
      return 'bg-gray-500 text-white'
  }
}

const getStatusText = (status: string | null | undefined) => {
  switch (status) {
    case 'PENDING':
      return '正在查验'
    case 'APPROVED':
      return '已查验'
    case 'REJECTED':
      return '已拒绝'
    case 'CANCELED':
      return '已取消'
    case null:
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
        bimElements: payload.bimElements,
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
        bimElements: payload.bimElements,
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
