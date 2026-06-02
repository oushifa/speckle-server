<template>
  <div class="h-full">
    <Portal to="navigation">
      <div>数智南北</div>
    </Portal>

    <input
      ref="createFileInput"
      type="file"
      class="hidden"
      aria-label="选择要上传到图纸库的新模型文件"
      accept=".dxf,.dwg,.glb,.gltf,.obj"
      @change="onCreateFileSelected"
    />
    <input
      ref="uploadVersionFileInput"
      type="file"
      class="hidden"
      aria-label="选择要上传的新版本文件"
      accept=".dxf,.dwg,.glb,.gltf,.obj"
      @change="onUploadVersionFileSelected"
    />

    <div
      class="h-full flex flex-col bg-white/80 backdrop-blur-md rounded-[26px] shadow-sm overflow-hidden"
    >
      <div
        class="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0"
      >
        <div class="flex items-center space-x-2">
          <h1 class="text-xl font-bold text-[#333]">图纸库</h1>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="relative">
            <label for="drawings-model-search" class="sr-only">搜索模型</label>
            <input
              id="drawings-model-search"
              v-model="searchQuery"
              type="text"
              placeholder="搜索模型..."
              :class="[
                'w-56 border rounded-[8px] py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-0 focus:border-[#00b4b6] focus:bg-white text-[#333] transition-all',
                searchQuery
                  ? 'border-[#00b4b6] bg-white'
                  : 'border-transparent bg-gray-50'
              ]"
              @input="onSearchInput"
            />
            <MagnifyingGlassIcon
              class="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            />
          </div>
          <button
            type="button"
            class="px-4 py-1.5 rounded-[8px] text-sm font-medium transition-colors border border-transparent bg-gray-50 hover:bg-gray-100 text-gray-600"
            :disabled="loading"
            :class="loading ? 'opacity-70 cursor-not-allowed' : ''"
            @click="refresh"
          >
            刷新
          </button>
          <button
            type="button"
            class="bg-[#00b4b6] hover:bg-[#009fa1] text-white px-4 py-1.5 rounded-[8px] text-sm font-medium transition-colors"
            :disabled="mutating"
            :class="mutating ? 'opacity-70 cursor-not-allowed' : ''"
            @click="openCreateFilePicker"
          >
            新建模型
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-auto bg-[#f5f7fa] p-6">
        <div
          class="bg-white/80 backdrop-blur-md border border-gray-200 rounded-[8px] overflow-hidden"
        >
          <div v-if="loading" class="p-4 text-sm text-gray-500">加载中...</div>
          <div v-else-if="models.length === 0" class="p-4 text-sm text-gray-500">
            暂无模型
          </div>
          <table v-else class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#f8f9fa] text-gray-500 text-sm border-b border-gray-200">
                <th class="px-4 py-3 font-medium">模型名称</th>
                <th class="px-4 py-3 font-medium">更新时间</th>
                <th class="px-4 py-3 font-medium text-center">版本数</th>
                <th class="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody class="text-sm text-[#333] divide-y divide-gray-100">
              <tr
                v-for="m in models"
                :key="m.id"
                class="hover:bg-[#fcfcfc] transition-colors"
              >
                <td class="px-4 py-3">
                  <button
                    type="button"
                    class="font-medium whitespace-pre-line text-left cursor-pointer transition-colors hover:text-[#00b4b6]"
                    @click="openVersions(m)"
                  >
                    {{ m.title }}
                  </button>
                </td>
                <td class="px-4 py-3 text-gray-500">
                  {{ formatDate(m.updateTime) }}
                </td>
                <td class="px-4 py-3 text-center text-gray-500">{{ m.versions }}</td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors border border-transparent bg-gray-50 hover:bg-gray-100 text-gray-600"
                      :disabled="mutating"
                      :class="mutating ? 'opacity-70 cursor-not-allowed' : ''"
                      @click="openUploadVersionFilePicker(m)"
                    >
                      上传新版
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors bg-red-50 hover:bg-red-100 text-red-600"
                      :disabled="mutating"
                      :class="mutating ? 'opacity-70 cursor-not-allowed' : ''"
                      @click="openDeleteModelDialog(m)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="border-t border-gray-100" />
      <div class="p-4 flex items-center justify-between text-sm text-gray-500">
        <div>共 {{ totalRecords }} 条</div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors border border-transparent bg-gray-50 hover:bg-gray-100 text-gray-600"
            :disabled="loading || currentPage <= 1"
            :class="loading || currentPage <= 1 ? 'opacity-70 cursor-not-allowed' : ''"
            @click="changePage(currentPage - 1)"
          >
            上一页
          </button>
          <div>第 {{ currentPage }} / {{ totalPages }} 页</div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors border border-transparent bg-gray-50 hover:bg-gray-100 text-gray-600"
            :disabled="loading || currentPage >= totalPages"
            :class="
              loading || currentPage >= totalPages
                ? 'opacity-70 cursor-not-allowed'
                : ''
            "
            @click="changePage(currentPage + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <LayoutDialog
      v-model:open="deleteModelDialogOpen"
      max-width="sm"
      :buttons="deleteModelDialogButtons"
    >
      <template #header>删除模型</template>
      <div class="flex flex-col gap-2 text-foreground">
        <div>
          确定删除模型
          <span class="font-medium">{{ deleteModelTarget?.title }}</span>
          吗？
        </div>
        <div class="text-foreground-2 text-sm">
          此操作不可逆，将删除该模型的所有版本。
        </div>
      </div>
    </LayoutDialog>

    <LayoutDialog
      v-model:open="versionsDialogOpen"
      max-width="xl"
      :buttons="versionsDialogButtons"
    >
      <template #header>版本管理</template>
      <div class="flex flex-col gap-3">
        <div v-if="versionsModel" class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium text-foreground truncate">
              {{ versionsModel.title }}
            </div>
            <div class="text-xs text-foreground-2 mt-1">
              模型ID：{{ versionsModel.id }}
            </div>
          </div>
          <div class="shrink-0 flex items-center gap-2">
            <FormButton
              color="outline"
              size="sm"
              class="font-normal"
              :disabled="versionsLoading"
              @click="reloadVersions"
            >
              刷新
            </FormButton>
            <FormButton
              color="outline"
              size="sm"
              class="font-normal"
              :disabled="!versionsModel.previewUrl"
              @click="openPreview(versionsModel.previewUrl)"
            >
              预览最新
            </FormButton>
          </div>
        </div>

        <div
          v-if="inlinePreviewUrl"
          class="rounded-lg border border-outline-3 overflow-hidden bg-foundation-page"
        >
          <div class="p-3 flex items-center justify-between">
            <div class="text-sm text-foreground truncate">页内预览</div>
            <FormButton
              color="outline"
              size="sm"
              class="font-normal"
              @click="inlinePreviewUrl = null"
            >
              关闭
            </FormButton>
          </div>
          <div class="border-t border-outline-3" />
          <iframe
            :src="inlinePreviewUrl"
            title="图纸库页内预览"
            class="w-full h-[520px]"
          />
        </div>

        <div
          class="rounded-lg border border-outline-3 bg-foundation-page overflow-hidden"
        >
          <div v-if="versionsLoading" class="p-4 text-foreground-2">加载中...</div>
          <div v-else-if="versions.length === 0" class="p-4 text-foreground-2">
            暂无版本
          </div>
          <div v-else class="divide-y divide-outline-3">
            <div v-for="v in versions" :key="v.id" class="p-4 flex flex-col gap-3">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground truncate">
                    {{ v.id }}
                  </div>
                  <div class="text-xs text-foreground-2 mt-1">
                    {{ formatDate(v.createdAt) }}
                  </div>
                </div>
                <div class="shrink-0 flex items-center gap-2">
                  <FormButton
                    color="outline"
                    size="sm"
                    class="font-normal"
                    @click="copyText(v.id, '版本ID已复制')"
                  >
                    复制ID
                  </FormButton>
                  <FormButton
                    color="outline"
                    size="sm"
                    class="font-normal"
                    @click="openVersionPreview(v.id)"
                  >
                    预览
                  </FormButton>
                  <FormButton
                    color="outline"
                    size="sm"
                    class="font-normal"
                    @click="inlinePreviewUrl = getPreviewUrl(v.id)"
                  >
                    页内预览
                  </FormButton>
                  <FormButton
                    color="danger"
                    size="sm"
                    class="font-normal"
                    :disabled="mutating"
                    @click="openDeleteVersionDialog(v)"
                  >
                    删除
                  </FormButton>
                </div>
              </div>

              <FormTextInput
                v-model="v._editMessage"
                name="version-message"
                :show-label="false"
                placeholder="版本说明"
                color="foundation"
                :show-clear="!!v._editMessage"
              />

              <div class="flex items-center gap-2">
                <FormButton
                  color="outline"
                  size="sm"
                  class="font-normal"
                  :disabled="mutating"
                  @click="saveVersionMessage(v)"
                >
                  保存说明
                </FormButton>
              </div>
            </div>
          </div>
          <div v-if="versionsHasMore" class="p-4 border-t border-outline-3">
            <FormButton
              color="outline"
              class="font-normal w-full"
              :disabled="versionsLoadingMore"
              @click="loadMoreVersions"
            >
              {{ versionsLoadingMore ? '加载中...' : '加载更多' }}
            </FormButton>
          </div>
        </div>
      </div>
    </LayoutDialog>

    <LayoutDialog
      v-model:open="deleteVersionDialogOpen"
      max-width="sm"
      :buttons="deleteVersionDialogButtons"
    >
      <template #header>删除版本</template>
      <div class="flex flex-col gap-2 text-foreground">
        <div>
          确定删除版本
          <span class="font-medium">{{ deleteVersionTarget?.id }}</span>
          吗？
        </div>
        <div class="text-foreground-2 text-sm">此操作不可逆。</div>
      </div>
    </LayoutDialog>
  </div>
</template>

<script setup lang="ts">
import type { LayoutDialogButton } from '@speckle/ui-components'
import { FormButton, FormTextInput, LayoutDialog } from '@speckle/ui-components'
import { useDebounceFn } from '@vueuse/core'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { useApiOrigin } from '~~/composables/env'
import { ToastNotificationType, useGlobalToast } from '~/lib/common/composables/toast'

type DrawingsModel = {
  id: string
  title: string
  projectId: string
  streamName: string | null
  updateTime: string
  versions: number
  previewUrl: string | null
}

type VersionCursor = { id: string; createdAt: string }

type DrawingsVersion = {
  id: string
  message: string
  sourceApplication: string | null
  createdAt: string
  _editMessage: string
}

definePageMeta({
  middleware: ['auth']
})

useHead({
  title: '图纸库'
})

const apiOrigin = useApiOrigin()
const { triggerNotification } = useGlobalToast()

const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalRecords = ref(0)
const loading = ref(false)
const mutating = ref(false)

const models = ref<DrawingsModel[]>([])
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalRecords.value / pageSize.value))
)

const formatDate = (v: string) => {
  const date = new Date(v)
  if (Number.isNaN(date.getTime())) return v
  return date.toLocaleString('zh-CN')
}

const getErrorMessage = (e: unknown) => {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e && 'data' in e) {
    const data = (e as { data?: unknown }).data
    if (typeof data === 'object' && data && 'error' in data) {
      const err = (data as { error?: unknown }).error
      if (typeof err === 'string' && err.length) return err
    }
  }
  return '请稍后重试'
}

const loadModels = async () => {
  loading.value = true
  try {
    const res = await $fetch<{ data: DrawingsModel[]; total?: number }>(
      `${apiOrigin}/api/v1/drawings/models`,
      {
        params: {
          search: searchQuery.value.trim() || undefined,
          page: currentPage.value,
          pageSize: pageSize.value
        }
      }
    )
    models.value = res.data || []
    totalRecords.value = typeof res.total === 'number' ? res.total : models.value.length
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载失败',
      description: getErrorMessage(e)
    })
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  await loadModels()
}

const changePage = async (page: number) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  await loadModels()
}

const updateDebouncedSearch = useDebounceFn(() => {
  currentPage.value = 1
  void loadModels()
}, 300)

const onSearchInput = () => updateDebouncedSearch()

const copyText = async (text: string, title: string) => {
  try {
    await navigator.clipboard.writeText(text)
    triggerNotification({
      type: ToastNotificationType.Success,
      title,
      description: text
    })
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '复制失败',
      description: getErrorMessage(e)
    })
  }
}

const openPreview = (url: string | null) => {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

const getPreviewUrl = (versionId: string) => {
  return `${apiOrigin}/preview/drawdings/commits/${versionId}`
}

const openVersionPreview = (versionId: string) => {
  openPreview(getPreviewUrl(versionId))
}

const createFileInput = ref<HTMLInputElement | null>(null)
const uploadVersionFileInput = ref<HTMLInputElement | null>(null)
const uploadVersionTarget = ref<DrawingsModel | null>(null)

const openCreateFilePicker = () => {
  if (mutating.value) return
  createFileInput.value?.click()
}

const submitCreateWithFile = async (file: File) => {
  if (mutating.value) return
  mutating.value = true
  try {
    const name = file.name.replace(/\.[^/.]+$/, '').trim()
    const body = new FormData()
    body.append('file', file)
    if (name) body.append('name', name)
    await $fetch(`${apiOrigin}/api/v1/drawings/models/upload`, { method: 'POST', body })
    await loadModels()
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '创建失败',
      description: getErrorMessage(e)
    })
  } finally {
    mutating.value = false
  }
}

const onCreateFileSelected = async (evt: Event) => {
  const input = evt.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (input) input.value = ''
  if (!file) return
  await submitCreateWithFile(file)
}

const openUploadVersionFilePicker = (m: DrawingsModel) => {
  if (mutating.value) return
  uploadVersionTarget.value = m
  uploadVersionFileInput.value?.click()
}

const submitUploadVersionWithFile = async (m: DrawingsModel, file: File) => {
  if (mutating.value) return
  mutating.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    await $fetch(`${apiOrigin}/api/v1/drawings/models/${m.id}/versions`, {
      method: 'POST',
      body
    })
    if (versionsDialogOpen.value && versionsModel.value?.id === m.id) {
      await reloadVersions()
    }
    await loadModels()
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '上传失败',
      description: getErrorMessage(e)
    })
  } finally {
    mutating.value = false
  }
}

const onUploadVersionFileSelected = async (evt: Event) => {
  const input = evt.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (input) input.value = ''
  const target = uploadVersionTarget.value
  uploadVersionTarget.value = null
  if (!file || !target) return
  await submitUploadVersionWithFile(target, file)
}

const deleteModelDialogOpen = ref(false)
const deleteModelTarget = ref<DrawingsModel | null>(null)

const openDeleteModelDialog = (m: DrawingsModel) => {
  deleteModelTarget.value = m
  deleteModelDialogOpen.value = true
}

const deleteModelDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => (deleteModelDialogOpen.value = false),
    disabled: mutating.value
  },
  {
    text: '删除',
    props: { color: 'danger' },
    onClick: () => void submitDeleteModel(),
    disabled: mutating.value || !deleteModelTarget.value
  }
])

const submitDeleteModel = async () => {
  if (mutating.value) return
  if (!deleteModelTarget.value) return
  mutating.value = true
  try {
    await $fetch(`${apiOrigin}/api/v1/drawings/models/${deleteModelTarget.value.id}`, {
      method: 'DELETE'
    })
    deleteModelDialogOpen.value = false
    deleteModelTarget.value = null
    await loadModels()
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除失败',
      description: getErrorMessage(e)
    })
  } finally {
    mutating.value = false
  }
}

const versionsDialogOpen = ref(false)
const versionsModel = ref<DrawingsModel | null>(null)
const versions = ref<DrawingsVersion[]>([])
const versionsCursor = ref<VersionCursor | null>(null)
const versionsHasMore = ref(false)
const versionsLoading = ref(false)
const versionsLoadingMore = ref(false)
const inlinePreviewUrl = ref<string | null>(null)

const versionsDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '关闭',
    props: { color: 'outline' },
    onClick: () => {
      versionsDialogOpen.value = false
      inlinePreviewUrl.value = null
    }
  }
])

const openVersions = async (m: DrawingsModel) => {
  versionsModel.value = m
  versionsDialogOpen.value = true
  inlinePreviewUrl.value = null
  await reloadVersions()
}

const reloadVersions = async () => {
  versions.value = []
  versionsCursor.value = null
  versionsHasMore.value = false
  await loadVersionsPage()
}

const loadVersionsPage = async () => {
  if (!versionsModel.value) return
  versionsLoading.value = true
  try {
    const res = await $fetch<{
      data: Array<Omit<DrawingsVersion, '_editMessage'>>
      cursor: VersionCursor | null
    }>(`${apiOrigin}/api/v1/drawings/models/${versionsModel.value.id}/versions`, {
      params: {
        limit: 10,
        cursorId: versionsCursor.value?.id || undefined,
        cursorCreatedAt: versionsCursor.value?.createdAt || undefined
      }
    })
    const newItems = (res.data || []).map((v) => ({
      ...v,
      _editMessage: v.message || ''
    }))
    versions.value = [...versions.value, ...newItems]
    versionsCursor.value = res.cursor
    versionsHasMore.value = !!res.cursor
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '加载版本失败',
      description: getErrorMessage(e)
    })
  } finally {
    versionsLoading.value = false
  }
}

const loadMoreVersions = async () => {
  if (!versionsHasMore.value || versionsLoadingMore.value) return
  versionsLoadingMore.value = true
  try {
    await loadVersionsPage()
  } finally {
    versionsLoadingMore.value = false
  }
}

const saveVersionMessage = async (v: DrawingsVersion) => {
  if (mutating.value) return
  mutating.value = true
  try {
    await $fetch(`${apiOrigin}/api/v1/drawings/versions/${v.id}`, {
      method: 'PATCH',
      body: { message: v._editMessage }
    })
    await reloadVersions()
    await loadModels()
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '更新失败',
      description: getErrorMessage(e)
    })
  } finally {
    mutating.value = false
  }
}

const deleteVersionDialogOpen = ref(false)
const deleteVersionTarget = ref<DrawingsVersion | null>(null)

const openDeleteVersionDialog = (v: DrawingsVersion) => {
  deleteVersionTarget.value = v
  deleteVersionDialogOpen.value = true
}

const deleteVersionDialogButtons = computed<LayoutDialogButton[]>(() => [
  {
    text: '取消',
    props: { color: 'outline' },
    onClick: () => (deleteVersionDialogOpen.value = false),
    disabled: mutating.value
  },
  {
    text: '删除',
    props: { color: 'danger' },
    onClick: () => void submitDeleteVersion(),
    disabled: mutating.value || !deleteVersionTarget.value
  }
])

const submitDeleteVersion = async () => {
  if (mutating.value) return
  if (!deleteVersionTarget.value) return
  mutating.value = true
  try {
    await $fetch(
      `${apiOrigin}/api/v1/drawings/versions/${deleteVersionTarget.value.id}`,
      {
        method: 'DELETE'
      }
    )
    deleteVersionDialogOpen.value = false
    deleteVersionTarget.value = null
    await reloadVersions()
    await loadModels()
  } catch (e) {
    triggerNotification({
      type: ToastNotificationType.Danger,
      title: '删除失败',
      description: getErrorMessage(e)
    })
  } finally {
    mutating.value = false
  }
}

onMounted(() => {
  void loadModels()
})
</script>
