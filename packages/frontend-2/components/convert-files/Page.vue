<template>
  <div class="mx-auto max-w-7xl px-6 py-6 space-y-6">
    <ConvertFilesUploadCard
      :has-selected-file="!!selectedFile"
      :selected-file-label="selectedFileLabel"
      :is-uploading="isUploading"
      @select-file="onFileSelected"
      @upload="uploadSelectedFile"
    />

    <div class="rounded-lg border border-outline-3 bg-foundation-page p-6">
      <ConvertFilesFilters
        :keyword="keyword"
        :status="statusFilter"
        :is-loading="isLoading"
        @update:keyword="keyword = $event"
        @update:status="statusFilter = $event"
        @refresh="loadItems"
      />

      <ConvertFilesTable :items="items" :is-loading="isLoading" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'
import type { ConvertFilesTableItem } from '~/components/convert-files/Table.vue'

type FileConversionListResponse = {
  items: ConvertFilesTableItem[]
  total: number
  page: number
  pageSize: number
}

type CreateFileConversionResponse = {
  id: string
  uploadUrl: string
}

const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const selectedFile = ref<File | null>(null)
const items = ref<ConvertFilesTableItem[]>([])
const isLoading = ref(false)
const isUploading = ref(false)
const keyword = ref('')
const statusFilter = ref('')

const selectedFileLabel = computed(() => {
  if (!selectedFile.value) return ''

  const size = selectedFile.value.size
  const formattedSize =
    size < 1024
      ? `${size} B`
      : size < 1024 * 1024
      ? `${(size / 1024).toFixed(2)} KB`
      : `${(size / 1024 / 1024).toFixed(2)} MB`

  return `${selectedFile.value.name}（${formattedSize}）`
})

const loadItems = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<FileConversionListResponse>(
      `${apiOrigin}/api/v1/file-conversions`,
      {
        query: {
          keyword: keyword.value || undefined,
          status: statusFilter.value || undefined,
          page: 1,
          pageSize: 50
        }
      }
    )
    items.value = response.items
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '列表加载失败',
      description: error instanceof Error ? error.message : '请稍后重试'
    })
  } finally {
    isLoading.value = false
  }
}

const onFileSelected = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  selectedFile.value = target.files?.[0] || null
}

const uploadSelectedFile = async () => {
  if (!selectedFile.value) return

  isUploading.value = true
  try {
    const created = await $fetch<CreateFileConversionResponse>(
      `${apiOrigin}/api/v1/file-conversions`,
      {
        method: 'POST',
        body: {
          fileName: selectedFile.value.name,
          fileSize: selectedFile.value.size
        }
      }
    )

    const uploadResponse = await fetch(created.uploadUrl, {
      method: 'PUT',
      body: selectedFile.value
    })

    if (!uploadResponse.ok) {
      throw new Error(`源文件上传失败，状态码 ${uploadResponse.status}`)
    }

    const etag = uploadResponse.headers.get('etag')
    if (!etag) {
      throw new Error('上传完成后未返回 ETag')
    }

    await $fetch(`${apiOrigin}/api/v1/file-conversions/${created.id}/upload-complete`, {
      method: 'POST',
      body: { etag }
    })

    triggerNotification({
      type: ToastNotificationType.Success,
      title: '上传成功',
      description: '文件已进入待转换队列'
    })

    selectedFile.value = null
    await loadItems()
  } catch (error) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '上传失败',
      description: error instanceof Error ? error.message : '请稍后重试'
    })
  } finally {
    isUploading.value = false
  }
}

onMounted(async () => {
  await loadItems()
})
</script>
