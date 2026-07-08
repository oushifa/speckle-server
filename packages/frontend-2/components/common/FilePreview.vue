<template>
  <div class="relative w-full h-full flex flex-col items-center justify-center bg-foundation rounded-lg overflow-hidden">
    <!-- 1. 加载中骨架屏 -->
    <div
      v-if="iframeLoading && !error"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-foundation/80 backdrop-blur-xs gap-y-3"
    >
      <CommonLoadingIcon class="w-10 h-10 text-primary animate-spin" />
      <span class="text-sm font-medium text-foreground-2 animate-pulse">
        正在渲染预览中，请稍候...
      </span>
    </div>

    <!-- 2. 错误处理与重试 -->
    <div
      v-if="error"
      class="flex flex-col items-center justify-center p-6 text-center max-w-md gap-y-4"
    >
      <div class="p-3 bg-danger-lighter rounded-full text-danger">
        <TriangleAlert class="w-8 h-8" />
      </div>
      <div class="flex flex-col gap-y-1">
        <h4 class="text-base font-semibold text-foreground">无法加载预览</h4>
        <p class="text-sm text-foreground-2">
          {{ error }}
        </p>
      </div>
      <div class="flex items-center gap-x-2">
        <FormButton size="sm" color="outline" @click="init"> 重新尝试 </FormButton>
        <FormButton size="sm" color="primary" @click="onDownload"> 下载文件 </FormButton>
      </div>
    </div>

    <!-- 5. 文档/其它文件 (KKFileView iframe 预览) -->
    <div v-else-if="previewUrl" class="w-full h-full relative">
      <iframe
        :src="previewUrl"
        title="文件在线预览"
        class="w-full h-full border-0 bg-white min-h-[450px]"
        @load="onIframeLoad"
      />
    </div>

    <!-- 6. 兜底无预览链接状态 -->
    <div
      v-else-if="!iframeLoading"
      class="flex flex-col items-center justify-center p-6 text-center gap-y-3"
    >
      <FileWarning class="w-10 h-10 text-foreground-2" />
      <span class="text-sm text-foreground-2">暂不支持该格式的在线预览</span>
      <FormButton size="sm" color="outline" class="mt-2" @click="onDownload">
        下载文件
      </FormButton>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useFileDownload } from '~~/lib/core/composables/fileUpload'
import { useAuthCookie } from '~~/lib/auth/composables/auth'
import { TriangleAlert, FileWarning } from 'lucide-vue-next'
import { CommonLoadingIcon, FormButton } from '@speckle/ui-components'

const props = defineProps<{
  blobId: string
  projectId: string
  fileName: string
  fileType?: string
  fileSize?: number | null
}>()

const { getBlobUrl, download } = useFileDownload()
const token = useAuthCookie()
const {
  public: { kkFileViewUrl }
} = useRuntimeConfig()

const iframeLoading = ref(true)
const previewUrl = ref<string | null>(null)
const error = ref<string | null>(null)

const init = async () => {
  try {
    error.value = null
    iframeLoading.value = true
    previewUrl.value = null

    // 获取文件直链
    const rawUrl = await getBlobUrl({ blobId: props.blobId, projectId: props.projectId })
    if (!rawUrl) {
      throw new Error('未获取到文件有效地址')
    }

    // 将文件名作为 Path 的最后一段，能够确保任何版本的 KKFileView 从 URL 截取文件名时都能 100% 正确提取出文件后缀名
    const pathWithFilename = rawUrl.endsWith('/')
      ? `${rawUrl}${encodeURIComponent(props.fileName)}`
      : `${rawUrl}/${encodeURIComponent(props.fileName)}`

    const separator = pathWithFilename.includes('?') ? '&' : '?'
    const authUrl = token.value
      ? `${pathWithFilename}${separator}embedToken=${token.value}`
      : pathWithFilename

    // 生成 Base64 编码以适配 KKFileView 安全与防乱码规范
    let base64Url = ''
    try {
      base64Url = window.btoa(authUrl)
    } catch {
      base64Url = window.btoa(unescape(encodeURIComponent(authUrl)))
    }

    // 传递 fullfilename 参数，显式声明文件名和后缀，确保 KKFileView 正确匹配 Office/Excel 转换器/图片预览器
    previewUrl.value = `${kkFileViewUrl}/onlinePreview?url=${encodeURIComponent(
      base64Url
    )}&isBase64=true&fullfilename=${encodeURIComponent(props.fileName)}`
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    iframeLoading.value = false
  }
}

const onIframeLoad = () => {
  iframeLoading.value = false
}

const onDownload = async () => {
  try {
    await download({
      blobId: props.blobId,
      fileName: props.fileName,
      projectId: props.projectId
    })
  } catch (err) {
    error.value = '文件下载失败：' + (err instanceof Error ? err.message : String(err))
  }
}

// 监听关键 prop 改变时重新初始化
watch(
  () => [props.blobId, props.projectId],
  () => {
    init()
  },
  { immediate: true }
)
</script>
