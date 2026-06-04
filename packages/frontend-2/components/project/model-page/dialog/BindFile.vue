<template>
  <LayoutDialog
    v-model:open="isOpen"
    max-width="md"
    :buttons="[
      {
        text: '取消',
        props: { color: 'outline' },
        onClick: () => {
          isOpen = false
        }
      },
      {
        text: '上传并绑定',
        props: { disabled: !selectedFile || loading },
        onClick: () => {
          onUploadAndBind()
        }
      }
    ]"
    @fully-closed="$emit('fully-closed')"
  >
    <template #header>绑定源文件</template>
    
    <div class="flex flex-col text-foreground space-y-4 mb-2">
      <div class="text-sm text-foreground-2">
        选择一个本地文件直接绑定到当前版本 <strong>"{{ version?.message }}"</strong>。此操作不会触发格式解析与转换，上传完成后文件将直接作为源文件与该版本关联。
      </div>

      <FormFileUploadZone
        ref="uploadZone"
        v-slot="{ isDraggingFiles, openFilePicker }"
        :disabled="loading"
        :size-limit="maxSizeInBytes"
        class="flex items-center justify-center border-dashed border border-outline-3 rounded-xl p-8 hover:border-primary transition cursor-pointer min-h-[150px]"
        @files-selected="handleFilesSelected"
      >
        <div v-if="selectedFile" class="flex flex-col items-center space-y-3 w-full max-w-sm text-center" @click.stop>
          <span class="font-medium text-sm truncate max-w-xs block">{{ selectedFile.name }}</span>
          <span class="text-xs text-foreground-2 block">{{ fileSizeFormatted }}</span>
          
          <div v-if="loading" class="w-full">
            <div class="w-full bg-outline-3 h-2 rounded overflow-hidden">
              <div class="bg-primary h-full transition-all duration-150" :style="{ width: `${progress}%` }"></div>
            </div>
            <span class="text-xs text-foreground-2 mt-1 block">{{ Math.round(progress) }}% 上传中...</span>
          </div>
          <FormButton v-else size="sm" color="outline" @click.stop="selectedFile = null">
            更换文件
          </FormButton>
        </div>
        <div v-else class="flex flex-col items-center space-y-2 select-none" @click="openFilePicker">
          <ArrowUpTrayIcon class="h-8 w-8 text-foreground-2" />
          <span class="text-sm text-foreground-2">拖拽文件到此处，或 <span class="text-primary underline">点击上传</span></span>
        </div>
      </FormFileUploadZone>
    </div>
  </LayoutDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Nullable } from '@speckle/shared'
import { ensureError } from '@speckle/shared'
import { ArrowUpTrayIcon } from '@heroicons/vue/24/outline'
import type { ProjectModelPageDialogDeleteVersionFragment } from '~~/lib/common/generated/gql/graphql'
import { useAuthCookie } from '~~/lib/auth/composables/auth'
import { ToastNotificationType, useGlobalToast } from '~~/lib/common/composables/toast'
import { useFileImportBaseSettings } from '~~/lib/core/composables/fileImport'
import type { UploadableFileItem } from '@speckle/ui-components'

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'fully-closed'): void
}>()

const props = defineProps<{
  projectId: string
  version: Nullable<ProjectModelPageDialogDeleteVersionFragment>
  open: boolean
}>()

const apiOrigin = useApiOrigin()
const authToken = useAuthCookie()
const { maxSizeInBytes } = useFileImportBaseSettings()

const loading = ref(false)
const progress = ref(0)
const selectedFile = ref<Nullable<File>>(null)

const isOpen = computed({
  get: () => props.open,
  set: (newVal) => emit('update:open', newVal)
})

const fileSizeFormatted = computed(() => {
  if (!selectedFile.value) return ''
  const bytes = selectedFile.value.size
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
})

const handleFilesSelected = (params: { files: UploadableFileItem[] }) => {
  const fileItem = params.files[0]
  if (fileItem && fileItem.file) {
    selectedFile.value = fileItem.file
  }
}

const onUploadAndBind = async () => {
  if (!selectedFile.value || !props.version) return

  loading.value = true
  progress.value = 0

  const file = selectedFile.value
  const projectId = props.projectId
  const versionId = props.version.id

  try {
    const formData = new FormData()
    formData.append('file', file)

    const request = new XMLHttpRequest()
    request.open(
      'POST',
      `${apiOrigin}/api/v1/projects/${projectId}/versions/${versionId}/bind-file`
    )
    request.setRequestHeader('Authorization', `Bearer ${authToken.value}`)

    request.upload.addEventListener('progress', (e) => {
      progress.value = (e.loaded / e.total) * 100
    })

    const uploadPromise = new Promise<{ upload: any }>((resolve, reject) => {
      request.addEventListener('load', () => {
        const statusCode = request.status
        let responseJson: any = {}
        try {
          responseJson = JSON.parse(request.responseText || '{}')
        } catch {
          // ignore
        }
        if (statusCode >= 200 && statusCode < 300) {
          resolve(responseJson)
        } else {
          reject(new Error(responseJson.error || `绑定文件失败，状态码: ${statusCode}`))
        }
      })
      request.addEventListener('error', () => {
        reject(new Error(`文件 ${file.name} 上传与绑定失败`))
      })
    })

    request.send(formData)
    await uploadPromise

    // Success! Show notification
    const { triggerNotification } = useGlobalToast()
    triggerNotification({
      type: ToastNotificationType.Success,
      title: '文件绑定成功',
      description: `文件 ${file.name} 已成功绑定到版本`
    })

    isOpen.value = false
  } catch (e) {
    const { triggerNotification } = useGlobalToast()
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '文件绑定失败',
      description: ensureError(e).message
    })
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      selectedFile.value = null
      progress.value = 0
      loading.value = false
    }
  }
)
</script>
