<template>
  <div class="space-y-6">
    <!-- Header bar -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">文件管理</h1>
        <p class="text-xs text-slate-500 mt-1">
          对项目内的所有文件和 BIM 模型进行统一检索、上传下载及信息管理
        </p>
      </div>
      <div>
        <FormButton
          v-if="hasFunctionalPerm('source-file-management:upload')"
          color="primary"
          @click="showUploadDialog = true"
        >
          <template #icon-left>
            <IconUpload class="size-4" />
          </template>
          上传文件
        </FormButton>
      </div>
    </div>

    <!-- Filters & Search -->
    <div
      class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3"
    >
      <div class="flex-1 min-w-[200px]">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索文件名、来源、分类或备注..."
          class="w-full px-3 py-1.5 border rounded-md text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @input="debouncedFetch"
        />
      </div>

      <div class="w-40">
        <select
          v-model="selectedSource"
          class="w-full px-3 py-1.5 border rounded-md text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @change="fetchFiles"
        >
          <option value="">全部来源</option>
          <option value="BIM模型">BIM模型</option>
          <option value="手动上传">手动上传</option>
          <option value="施工资料">施工资料</option>
          <option value="设计图纸">设计图纸</option>
          <option value="质量验收">质量验收</option>
          <option value="实模一致性">实模一致性</option>
        </select>
      </div>

      <div class="w-40">
        <select
          v-model="selectedCategory"
          class="w-full px-3 py-1.5 border rounded-md text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @change="fetchFiles"
        >
          <option value="">全部分类</option>
          <option value="模型文件">模型文件</option>
          <option value="工程图纸">工程图纸</option>
          <option value="技术规范">技术规范</option>
          <option value="变更签证">变更签证</option>
          <option value="设计文档">设计文档</option>
          <option value="施工记录">施工记录</option>
          <option value="其他">其他</option>
        </select>
      </div>

      <FormButton color="subtle" size="sm" @click="resetFilters">重置</FormButton>
    </div>

    <!-- Data Table -->
    <div
      class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
    >
      <div v-if="loading" class="p-8 text-center text-slate-500">加载中...</div>
      <div v-else-if="files.length === 0" class="p-12 text-center text-slate-400">
        <IconFolder class="size-12 mx-auto mb-2 text-slate-300" />
        <p class="text-base font-medium">暂无文件记录</p>
        <p class="text-xs text-slate-400 mt-1">您可以点击“上传文件”按钮上传新文件</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm border-collapse">
          <thead>
            <tr
              class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <th class="py-3 px-4">文件名称</th>
              <th class="py-3 px-4">文件来源</th>
              <th class="py-3 px-4">分类</th>
              <th class="py-3 px-4">文件大小</th>
              <th class="py-3 px-4">自定义信息与备注</th>
              <th class="py-3 px-4">创建/更新时间</th>
              <th class="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
            <tr
              v-for="item in files"
              :key="item.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
            >
              <!-- Name & Icon -->
              <td class="py-3 px-4">
                <div class="flex items-center space-x-2">
                  <IconModelfiles
                    v-if="item.isModel"
                    class="size-5 text-indigo-500 shrink-0"
                  />
                  <IconFile v-else class="size-5 text-blue-500 shrink-0" />
                  <span
                    class="font-medium text-slate-800 dark:text-slate-100 truncate max-w-xs"
                    :title="item.name"
                  >
                    {{ item.name }}
                  </span>
                </div>
              </td>

              <!-- Source Badge -->
              <td class="py-3 px-4">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="getSourceBadgeClass(item.source, item.isModel)"
                >
                  {{ item.source || (item.isModel ? 'BIM模型' : '手动上传') }}
                </span>
              </td>

              <!-- Category -->
              <td class="py-3 px-4 text-slate-600 dark:text-slate-300">
                {{ item.category || '-' }}
              </td>

              <!-- File Size -->
              <td class="py-3 px-4 text-slate-500">
                {{ item.isModel ? '-' : formatFileSize(item.fileSize) }}
              </td>

              <!-- Custom Info & Description -->
              <td class="py-3 px-4 max-w-xs">
                <div
                  v-if="item.description"
                  class="text-xs text-slate-600 dark:text-slate-400 truncate mb-1"
                  :title="item.description"
                >
                  {{ item.description }}
                </div>
                <div
                  v-if="
                    item.customAttributes &&
                    Object.keys(item.customAttributes).length > 0
                  "
                  class="flex flex-wrap gap-1"
                >
                  <span
                    v-for="(val, key) in item.customAttributes"
                    :key="key"
                    class="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] rounded"
                  >
                    <span class="font-semibold">{{ key }}:</span>
                    {{ val }}
                  </span>
                </div>
                <span
                  v-if="
                    !item.description &&
                    (!item.customAttributes ||
                      Object.keys(item.customAttributes).length === 0)
                  "
                  class="text-slate-400 text-xs"
                >
                  无
                </span>
              </td>

              <!-- Date -->
              <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                {{ formatDate(item.createdAt) }}
              </td>

              <!-- Actions -->
              <td class="py-3 px-4 text-right whitespace-nowrap">
                <div class="flex items-center justify-end space-x-1">
                  <!-- Download (for both custom uploaded files and BIM models) -->
                  <FormButton
                    v-if="hasFunctionalPerm('source-file-management:download')"
                    color="subtle"
                    size="sm"
                    title="下载文件/模型"
                    @click="downloadFile(item)"
                  >
                    下载
                  </FormButton>

                  <!-- Edit -->
                  <FormButton
                    v-if="hasFunctionalPerm('source-file-management:edit')"
                    color="subtle"
                    size="sm"
                    title="编辑信息"
                    @click="openEditDialog(item)"
                  >
                    编辑
                  </FormButton>

                  <!-- Delete (disabled for models) -->
                  <div
                    v-if="
                      item.isModel && hasFunctionalPerm('source-file-management:delete')
                    "
                    class="inline-block"
                    title="模型不可在此删除"
                  >
                    <FormButton
                      color="subtle"
                      size="sm"
                      disabled
                      class="opacity-40 cursor-not-allowed"
                    >
                      删除
                    </FormButton>
                  </div>
                  <FormButton
                    v-if="
                      !item.isModel &&
                      hasFunctionalPerm('source-file-management:delete')
                    "
                    color="danger"
                    size="sm"
                    title="删除文件"
                    @click="confirmDelete(item)"
                  >
                    删除
                  </FormButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Upload Dialog -->
    <ProjectsFileManagementUploadFileDialog
      v-model:open="showUploadDialog"
      :project-id="projectId"
      @uploaded="fetchFiles"
    />

    <!-- Edit Dialog -->
    <ProjectsFileManagementEditFileDialog
      v-model:open="showEditDialog"
      :project-id="projectId"
      :file="editingFile"
      @updated="fetchFiles"
    />

    <!-- Delete Confirmation Modal (CommonConfirmDialog) -->
    <CommonConfirmDialog
      v-model:open="showDeleteConfirm"
      title="提示"
      :description="`确定要删除文件【${deletingFile?.name}】吗？删除后将无法恢复。`"
      confirm-button-text="确认删除"
      cancel-button-text="取消"
      @confirm="executeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { FormButton, CommonConfirmDialog } from '#components'
import dayjs from 'dayjs'
import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'

const route = useRoute()
const projectId = computed(() => route.params.id as string)

const { hasFunctionalPerm } = useCustomPermissions()

interface FileItem {
  id: string
  projectId: string
  modelId?: string
  name: string
  blobId?: string
  fileSize?: number
  fileType?: string
  source: string
  category: string
  customAttributes?: Record<string, any>
  description?: string
  uploaderName?: string
  createdAt: string
  isModel?: boolean
}

const files = ref<FileItem[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedSource = ref('')
const selectedCategory = ref('')

const showUploadDialog = ref(false)
const showEditDialog = ref(false)
const editingFile = ref<FileItem | null>(null)

const showDeleteConfirm = ref(false)
const deletingFile = ref<FileItem | null>(null)

const apiOrigin = useApiOrigin()

let timer: any = null
const debouncedFetch = () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    fetchFiles()
  }, 300)
}

const fetchFiles = async () => {
  if (!projectId.value) return
  loading.value = true
  try {
    const query: Record<string, string> = {}
    if (searchQuery.value) query.search = searchQuery.value
    if (selectedSource.value) query.source = selectedSource.value
    if (selectedCategory.value) query.category = selectedCategory.value

    const res: any = await $fetch(
      `${apiOrigin}/api/projects/${projectId.value}/files`,
      {
        query
      }
    )
    if (res?.success) {
      files.value = res.data || []
    }
  } catch (err) {
    console.error('Failed to fetch project files', err)
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedSource.value = ''
  selectedCategory.value = ''
  fetchFiles()
}

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

const getSourceBadgeClass = (source?: string, isModel?: boolean) => {
  if (isModel || source === 'BIM模型') {
    return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
  }
  if (source === '施工资料') {
    return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
  }
  if (source === '设计图纸') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
  }
  if (source === '质量验收') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
}

const openEditDialog = (item: FileItem) => {
  editingFile.value = item
  showEditDialog.value = true
}

const confirmDelete = (item: FileItem) => {
  deletingFile.value = item
  showDeleteConfirm.value = true
}

const executeDelete = async () => {
  if (!deletingFile.value) return
  try {
    const res: any = await $fetch(
      `${apiOrigin}/api/projects/${projectId.value}/files/${deletingFile.value.id}`,
      {
        method: 'DELETE'
      }
    )
    if (res?.success) {
      fetchFiles()
    } else {
      alert(res?.error || '删除失败')
    }
  } catch (err: any) {
    alert('删除异常: ' + (err?.message || err))
  } finally {
    showDeleteConfirm.value = false
    deletingFile.value = null
  }
}

const downloadFile = (item: FileItem) => {
  window.open(
    `${apiOrigin}/api/projects/${projectId.value}/files/${item.id}/download`,
    '_blank'
  )
}

onMounted(() => {
  fetchFiles()
})
</script>
