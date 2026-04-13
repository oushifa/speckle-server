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
          :buttons="tableButtons"
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
            <CommonBadge
              :color-classes="getAssociationStatusColor(item.associationStatus)"
              rounded
            >
              {{ item.associationStatus }}
            </CommonBadge>
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
  </div>
</template>

<script setup lang="ts">
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'
import { useMutation, useQuery } from '@vue/apollo-composable'
import { useDebounceFn } from '@vueuse/core'
import { ensureError } from '@speckle/shared'
import type { Nullable } from '@speckle/shared'
import type { LayoutDialogButton } from '@speckle/ui-components'
import { Download, Paperclip, TriangleAlert } from 'lucide-vue-next'
import type {
  QualityAcceptanceAttachment,
  QualityAcceptanceCreateInput,
  QualityAcceptanceForm
} from './types'
import { projectQualityAcceptanceFormsQuery } from '~/lib/projects/graphql/queries'
import {
  createQualityAcceptanceFormMutation,
  deleteQualityAcceptanceFormMutation,
  updateQualityAcceptanceFormMutation
} from '~/lib/projects/graphql/mutations'
import type { ProjectQualityAcceptanceFormsQuery } from '~/lib/common/generated/gql/graphql'
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
  { id: 'actualFinishDate', header: '验收日期', classes: 'col-span-2 font-medium' },
  { id: 'workVolume', header: '工程量', classes: 'col-span-1' },
  { id: 'unit', header: '单位', classes: 'col-span-1' },
  { id: 'attachments', header: '附件', classes: 'col-span-1' },
  { id: 'associationStatus', header: '关联状态', classes: 'col-span-1' }
]

const currentPage = ref(1)
const pageSize = ref(20)
const createDialogOpen = ref(false)
const editingItem = ref<AcceptanceRow | null>(null)
const attachmentsDialogOpen = ref(false)
const attachmentsDialogLoading = ref(false)
const attachmentsDialogError = ref<Nullable<Error>>(null)
const previewAttachmentList = ref<QualityAcceptanceAttachment[]>([])
const selectedPreviewAttachment = ref<Nullable<QualityAcceptanceAttachment>>(null)
const selectedPreviewAttachmentObjectUrl = ref<Nullable<string>>(null)
const previewAttachmentError = ref<Nullable<Error>>(null)
const pageCursors = ref<Record<number, string | null>>({ 1: null })
const currentCursor = computed(() => pageCursors.value[currentPage.value] || null)
const { result: formsResult, refetch: formsRefetch } = useQuery(
  projectQualityAcceptanceFormsQuery,
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

type QualityAcceptanceFormNode = NonNullable<
  NonNullable<
    NonNullable<ProjectQualityAcceptanceFormsQuery['project']>['qualityAcceptanceForms']
  >['items'][number]
>

const acceptanceForms = computed<QualityAcceptanceForm[]>(() =>
  (formsResult.value?.project?.qualityAcceptanceForms.items || [])
    .filter((item): item is QualityAcceptanceFormNode => !!item)
    .map((item) => ({
      id: item.id,
      name: item.name || '',
      code: item.code || '',
      inspectionLotNumber: item.inspectionLotNumber || '',
      acceptancePart: item.acceptancePart || '',
      acceptanceContent: item.acceptanceContent || '',
      actualStartDate: Number(item.actualStartDate || 0),
      actualFinishDate: Number(item.actualFinishDate || 0),
      inspector: item.inspector?.id || item.inspectorId || '',
      attachments: (item.attachments || []).flatMap((attachment) =>
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
      BIMelement: item.BIMelement || [],
      timeZone: item.timeZone || '',
      approveStatus: Number(item.approveStatus || 0),
      createdAt: new Date(item.createdAt).getTime(),
      updatedAt: new Date(item.updatedAt).getTime()
    }))
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

const tableItems = computed<AcceptanceRow[]>(() =>
  acceptanceForms.value.map((item) => ({
    ...item,
    associationStatus: item.BIMelement.length ? '已关联' : '未关联',
    inspectorName: inspectorNameMap.value.get(item.id) || '-'
  }))
)
const editingInitialData = computed<QualityAcceptanceCreateInput | null>(() => {
  const item = editingItem.value
  if (!item) return null
  return {
    flowId: '',
    name: item.name,
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
    BIMelement: item.BIMelement,
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

const tableButtons = [
  {
    icon: PencilSquareIcon,
    label: '编辑',
    action: async (item: AcceptanceRow) => {
      editingItem.value = item
      createDialogOpen.value = true
    }
  },
  {
    icon: TrashIcon,
    label: '删除',
    action: async (item: AcceptanceRow) => await removeAcceptanceItem(item.id),
    class: 'text-danger'
  }
]

const onAdd = () => {
  editingItem.value = null
  createDialogOpen.value = true
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
        BIMelement: payload.BIMelement,
        timeZone: payload.timeZone,
        approveStatus: payload.approveStatus
      }
    })
    editingItem.value = null
  } else {
    await createFormMutate({
      input: {
        projectId: projectId.value,
        flowId: payload.flowId || null,
        name: payload.name,
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
        BIMelement: payload.BIMelement,
        timeZone: payload.timeZone,
        approveStatus: payload.approveStatus
      }
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
</script>
