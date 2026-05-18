<template>
  <div class="mt-6 overflow-x-auto">
    <table class="min-w-full divide-y divide-outline-3">
      <thead>
        <tr class="text-left text-body-2xs uppercase tracking-wide text-foreground-2">
          <th class="px-3 py-3">文件名</th>
          <th class="px-3 py-3">大小</th>
          <th class="px-3 py-3">上传时间</th>
          <th class="px-3 py-3">上传人</th>
          <th class="px-3 py-3">状态</th>
          <th class="px-3 py-3">是否已转化</th>
          <th class="px-3 py-3">结果文件</th>
          <th class="px-3 py-3">失败原因</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-outline-2 text-body-sm text-foreground">
        <tr v-for="item in items" :key="item.id">
          <td class="px-3 py-3">{{ item.fileName }}</td>
          <td class="px-3 py-3">{{ formatFileSize(item.fileSize) }}</td>
          <td class="px-3 py-3">{{ formatTime(item.uploadedAt) }}</td>
          <td class="px-3 py-3">{{ item.creatorName || item.creator }}</td>
          <td class="px-3 py-3">{{ statusLabel(item.status) }}</td>
          <td class="px-3 py-3">{{ item.isConverted ? '是' : '否' }}</td>
          <td class="px-3 py-3">
            <a
              v-if="item.resultFileUrl"
              :href="item.resultFileUrl"
              class="text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              下载
            </a>
            <span v-else class="text-foreground-2">-</span>
          </td>
          <td class="px-3 py-3 text-danger">{{ item.errorMessage || '-' }}</td>
        </tr>
        <tr v-if="!items.length">
          <td class="px-3 py-8 text-center text-foreground-2" colspan="8">
            {{ isLoading ? '正在加载...' : '暂无数据' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
export type ConvertFilesTableItem = {
  id: string
  fileName: string
  fileSize: number | null
  uploadedAt: string | null
  creator: string
  creatorName?: string | null
  status: 'uploaded' | 'pending' | 'queued' | 'processing' | 'success' | 'failed'
  isConverted: boolean
  resultFileUrl: string | null
  errorMessage: string | null
}

const props = defineProps<{
  items: ConvertFilesTableItem[]
  isLoading: boolean
}>()

const statusLabelMap: Record<ConvertFilesTableItem['status'], string> = {
  uploaded: '上传中',
  pending: '待转换',
  queued: '已排队',
  processing: '转换中',
  success: '已完成',
  failed: '转换失败'
}

const formatFileSize = (size: number | null) => {
  if (!size || size <= 0) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

const formatTime = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const statusLabel = (status: ConvertFilesTableItem['status']) => statusLabelMap[status]

void props
</script>
