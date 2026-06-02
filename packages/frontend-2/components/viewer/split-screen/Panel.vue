<template>
  <ViewerLayoutSidePanel class="relative" disable-scrollbar @close="closePanel">
    <template #title>
      <div class="flex items-center gap-2">
        <LucidePanelLeft class="h-4 w-4 text-primary" />
        <span>分屏关联</span>
      </div>
    </template>

    <template #actions>
      <div class="flex items-center gap-1">
        <FormButton size="sm" color="outline" @click="loadLists">刷新</FormButton>
        <FormButton size="sm" color="primary" @click="openCreateDialog">
          新建
        </FormButton>
      </div>
    </template>

    <div class="min-h-0 flex-1 overflow-y-auto simple-scrollbar">
      <div class="flex flex-col gap-4 px-3 py-3">
        <div
          v-if="state.lastError"
          class="rounded-lg border border-danger bg-danger/10 px-3 py-2 text-body-xs text-foreground"
        >
          {{ state.lastError }}
        </div>

        <section v-if="!state.editorOpen" class="panel-section">
          <div class="section-header">已保存关联</div>

          <div
            v-if="state.listLoading"
            class="rounded-lg border border-outline-2 bg-foundation-2 px-3 py-3 text-body-xs text-foreground-2"
          >
            正在读取已保存关联...
          </div>

          <div
            v-else-if="!state.configs.length"
            class="rounded-lg border border-dashed border-outline-2 bg-foundation-2 px-3 py-4 text-center"
          >
            <p class="text-body-xs text-foreground-2">当前还没有已保存关联</p>
            <p class="mt-1 text-body-3xs text-foreground-3">点击右上角“新建”开始配置</p>
          </div>

          <button
            v-for="item in state.configs"
            :key="item.id"
            class="rounded-xl border px-3 py-3 text-left transition-colors"
            :class="
              item.id === state.activeConfigId
                ? 'border-primary bg-primary/10'
                : 'border-outline-2 bg-foundation-2 hover:bg-foundation'
            "
            @click="loadConfig(item.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-body-sm font-medium text-foreground">
                  {{ item.name }}
                </div>
                <div class="mt-1 text-body-3xs text-foreground-3">
                  {{ item.drawing.fileName }}
                </div>
              </div>
              <span
                class="rounded-full px-2 py-0.5 text-body-3xs whitespace-nowrap"
                :class="
                  state.enabled && item.id === state.activeConfigId
                    ? 'bg-primary text-foundation'
                    : 'bg-foundation text-foreground-2'
                "
              >
                {{
                  state.enabled && item.id === state.activeConfigId
                    ? '已打开'
                    : '已保存'
                }}
              </span>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <button class="panel-btn" @click.stop="openEditById(item.id)">
                设置
              </button>
              <span
                v-if="item.calibrationPoints?.length >= 3"
                class="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-2 text-body-3xs text-primary"
              >
                已校准
              </span>
              <button
                class="panel-btn panel-btn-danger"
                @click.stop="removeConfigById(item.id)"
              >
                删除
              </button>
            </div>
          </button>
        </section>

        <section v-else class="panel-section">
          <div class="section-header">
            <span>{{ state.editorMode === 'create' ? '新建关联' : '编辑关联' }}</span>
            <button class="ml-auto panel-btn !px-2 !py-1" @click="closeSettingsPanel">
              返回
            </button>
          </div>

          <FormTextInput
            v-model="editorForm.name"
            name="split-screen-config-name"
            color="foundation"
            label="名称"
            placeholder="分屏关联"
            show-label
          />

          <div class="rounded-lg border border-outline-2 bg-foundation-2 px-3 py-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-body-xs text-foreground-2">选择文件</div>
                <div class="mt-1 truncate text-body-sm text-foreground">
                  {{ selectedDrawingLabel }}
                </div>
              </div>
              <button class="panel-btn whitespace-nowrap" @click="openFilePicker">
                文件列表
              </button>
            </div>
          </div>

          <div class="rounded-lg border border-outline-2 bg-foundation-2 px-3 py-3">
            <div class="flex items-center justify-between gap-3 flex-col">
              <div class="min-w-0">
                <div class="text-body-xs text-foreground-2">校准状态</div>
                <div class="mt-1 text-body-sm text-foreground">
                  {{
                    state.calibration.awaitingCompletion
                      ? '三点已采集完成，等待完成校准'
                      : state.calibration.active
                      ? `校准进行中：请先${
                          state.calibration.step === 'cad'
                            ? '点击左侧 CAD'
                            : '点击右侧 BIM'
                        }`
                      : state.calibration.points.length >= 3
                      ? '已完成三点校准'
                      : '尚未开始校准'
                  }}
                </div>
                <div
                  v-if="
                    state.calibration.active || state.calibration.awaitingCompletion
                  "
                  class="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-body-3xs leading-5 text-warning"
                >
                  {{
                    state.calibration.awaitingCompletion
                      ? '三组点位都已采集完成，请点击“完成校准”保存对齐结果。'
                      : state.calibration.step === 'cad'
                      ? `当前是第 ${Math.min(
                          state.calibration.pointIndex + 1,
                          3
                        )} 组点，请先在左屏 CAD 点击参考点。`
                      : `当前是第 ${Math.min(
                          state.calibration.pointIndex + 1,
                          3
                        )} 组点，请再到右屏 BIM 点击对应位置，右屏会显示编号 marker。`
                  }}
                </div>
                <div class="mt-1 text-body-3xs text-foreground-3">
                  开始校准后会自动进入分屏模式，按“左侧 CAD -> 右侧
                  BIM”顺序完成三组点位采集
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  class="panel-btn"
                  :disabled="!editorForm.drawing || state.calibration.active"
                  @click="handleStartCalibration"
                >
                  开始校准
                </button>
                <button
                  v-if="state.calibration.awaitingCompletion"
                  class="panel-btn panel-btn-primary"
                  @click="handleFinishCalibration"
                >
                  完成校准
                </button>
                <button
                  v-if="
                    state.calibration.active || state.calibration.awaitingCompletion
                  "
                  class="panel-btn"
                  @click="handleCancelCalibration"
                >
                  取消校准
                </button>
                <button class="panel-btn" :disabled="!state.enabled" @click="disable()">
                  关闭
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <button class="panel-btn" @click="closeSettingsPanel">取消</button>
            <button
              class="panel-btn panel-btn-primary"
              :disabled="state.editorSaving"
              @click="handleSubmit"
            >
              {{ state.editorSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="filePickerOpen"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4"
      >
        <div
          class="flex w-full max-w-2xl flex-col rounded-2xl border border-outline-2 bg-foundation shadow-xl"
        >
          <div
            class="flex items-center justify-between border-b border-outline-2 px-4 py-3"
          >
            <div>
              <div class="text-body font-semibold text-foreground">选择文件</div>
              <div class="text-body-3xs text-foreground-3">
                从图纸库选择一个模型版本作为左屏 CAD
              </div>
            </div>
            <button class="panel-btn" @click="filePickerOpen = false">关闭</button>
          </div>

          <div class="border-b border-outline-2 px-4 py-3">
            <FormTextInput
              v-model="search"
              name="split-screen-search"
              color="foundation"
              placeholder="搜索图纸模型..."
              :show-label="false"
              :show-clear="!!search"
            />
          </div>

          <div class="max-h-[55vh] overflow-y-auto px-4 py-3">
            <div
              v-if="modelsLoading"
              class="rounded-lg border border-outline-2 bg-foundation-2 p-3 text-body-xs text-foreground-2"
            >
              正在读取图纸库模型...
            </div>

            <div
              v-else-if="!models.length"
              class="rounded-lg border border-dashed border-outline-2 bg-foundation-2 p-4 text-center text-body-xs text-foreground-2"
            >
              未找到图纸模型
            </div>

            <div v-else class="flex flex-col gap-2">
              <button
                v-for="model in models"
                :key="model.id"
                class="rounded-xl border px-3 py-3 text-left transition-colors"
                :class="
                  activeModelId === model.id
                    ? 'border-primary bg-primary/10'
                    : 'border-outline-2 bg-foundation-2 hover:bg-foundation'
                "
                @click="selectModel(model.id)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-body-sm font-medium text-foreground">
                      {{ model.title }}
                    </div>
                    <div class="mt-1 text-body-3xs text-foreground-3">
                      {{ model.versions }} 个版本 · {{ formatDate(model.updateTime) }}
                    </div>
                  </div>
                  <div
                    class="rounded-full bg-foundation px-2 py-0.5 text-body-3xs text-foreground-2"
                  >
                    {{ activeModelId === model.id ? '已展开' : '选择' }}
                  </div>
                </div>

                <div
                  v-if="activeModelId === model.id"
                  class="mt-3 border-t border-outline-3 pt-3"
                >
                  <div
                    v-if="versionsLoading"
                    class="rounded-lg border border-outline-2 bg-foundation p-3 text-body-xs text-foreground-2"
                  >
                    正在读取版本...
                  </div>

                  <div
                    v-else-if="!versions.length"
                    class="rounded-lg border border-dashed border-outline-2 bg-foundation p-3 text-body-xs text-foreground-2"
                  >
                    当前模型还没有可用版本
                  </div>

                  <div v-else class="flex flex-col gap-2">
                    <button
                      v-for="version in versions"
                      :key="version.id"
                      class="rounded-lg border px-3 py-2 text-left transition-colors"
                      :class="
                        pickerVersionId === version.id
                          ? 'border-primary bg-primary/10'
                          : 'border-outline-2 bg-foundation hover:bg-foundation-page'
                      "
                      @click.stop="selectVersion(model, version)"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div
                            class="truncate text-body-xs font-medium text-foreground"
                          >
                            {{ version.message || version.id }}
                          </div>
                          <div class="mt-1 text-body-3xs text-foreground-3">
                            {{ formatDate(version.createdAt) }}
                          </div>
                        </div>
                        <div
                          class="rounded-full px-2 py-0.5 text-body-3xs"
                          :class="
                            pickerVersionId === version.id
                              ? 'bg-primary text-foundation'
                              : 'bg-foundation-page text-foreground-2'
                          "
                        >
                          {{ pickerVersionId === version.id ? '已选择' : '选择版本' }}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div
            class="flex items-center justify-between gap-2 border-t border-outline-2 px-4 py-3"
          >
            <div class="text-body-3xs text-foreground-3">
              {{ pickerDrawingLabel }}
            </div>
            <div class="flex gap-2">
              <button class="panel-btn" @click="filePickerOpen = false">取消</button>
              <button
                class="panel-btn panel-btn-primary"
                :disabled="!pickerDrawing"
                @click="confirmPicker"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </ViewerLayoutSidePanel>
</template>

<script setup lang="ts">
import { FormButton, FormTextInput } from '@speckle/ui-components'
import { useDebounceFn } from '@vueuse/core'
import { LucidePanelLeft } from 'lucide-vue-next'
import {
  DEFAULT_SPLIT_RATIO,
  type ViewerSplitScreenDrawing,
  useViewerSplitScreenState
} from '~/lib/viewer/composables/setup/splitScreen'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'
import {
  type DrawingsModel,
  type DrawingsVersion,
  useViewerSplitScreenApi
} from './api'

const api = useViewerSplitScreenApi()
const route = useRoute()
const projectId = computed(() => route.params.id as string)
const {
  state,
  setSplitRatio,
  setLastError,
  loadConfigs,
  applyConfig,
  upsertConfig,
  removeConfig,
  openEditor,
  closeEditor,
  setEditorSaving,
  findConfigById,
  startCalibration,
  cancelCalibration,
  finishCalibration,
  enable,
  disable
} = useViewerSplitScreenState()
const {
  ui: {
    panels: { active: activePanel }
  }
} = useInjectedViewerState()

const search = ref('')
const filePickerOpen = ref(false)
const modelsLoading = ref(false)
const versionsLoading = ref(false)
const models = ref<DrawingsModel[]>([])
const versions = ref<DrawingsVersion[]>([])
const activeModelId = ref<string | null>(null)
const pickerVersionId = ref<string | null>(null)
const pickerDrawing = ref<ViewerSplitScreenDrawing | null>(null)

const editorForm = reactive({
  name: '分屏关联',
  drawing: null as ViewerSplitScreenDrawing | null
})

const selectedDrawingLabel = computed(
  () => editorForm.drawing?.fileName || '未选择文件'
)

const pickerDrawingLabel = computed(
  () => pickerDrawing.value?.fileName || '请选择一个模型版本'
)

const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

const closePanel = () => {
  disable()
  closeEditor()
  filePickerOpen.value = false
  activePanel.value = 'none'
}

const loadLists = async () => {
  await loadConfigs(projectId.value)
}

const loadConfig = (configId: string) => {
  const config = findConfigById(configId)
  if (!config) return
  setLastError(null)
  applyConfig(config)
}

const openCreateDialog = () => {
  applyConfig(null)
  setSplitRatio(DEFAULT_SPLIT_RATIO)
  openEditor('create')
  editorForm.name = '分屏关联'
  editorForm.drawing = null
  pickerDrawing.value = null
  pickerVersionId.value = null
}

const openEditById = (configId: string) => {
  const config = findConfigById(configId)
  if (!config) return

  applyConfig(config)
  openEditor('edit', config.id)
  editorForm.name = config.name
  editorForm.drawing = config.drawing
  pickerDrawing.value = config.drawing
  pickerVersionId.value = config.drawing.versionId
}

const removeConfigById = async (configId: string) => {
  try {
    setLastError(null)
    await removeConfig(projectId.value, configId)
  } catch (error) {
    setLastError(error instanceof Error ? error.message : '删除分屏关联失败')
  }
}

const closeSettingsPanel = () => {
  closeEditor()
  filePickerOpen.value = false
}

const handleStartCalibration = () => {
  if (!editorForm.drawing) {
    setLastError('请先选择图纸文件。')
    return
  }

  setLastError(null)
  applyConfig(null)
  setSplitRatio(DEFAULT_SPLIT_RATIO)
  enable(editorForm.drawing)
  startCalibration()
}

const handleFinishCalibration = () => {
  finishCalibration()
}

const handleCancelCalibration = () => {
  cancelCalibration()
}

const openFilePicker = () => {
  filePickerOpen.value = true
  pickerDrawing.value = editorForm.drawing
  pickerVersionId.value = editorForm.drawing?.versionId || null
  void refreshModels()
}

const refreshModels = async () => {
  modelsLoading.value = true
  setLastError(null)

  try {
    const res = await api.fetchModels({
      search: search.value,
      page: 1,
      pageSize: 20
    })
    models.value = res.data || []

    if (
      activeModelId.value &&
      !models.value.some((item) => item.id === activeModelId.value)
    ) {
      activeModelId.value = null
      versions.value = []
    }
  } catch (error) {
    setLastError(error instanceof Error ? error.message : '图纸模型加载失败')
  } finally {
    modelsLoading.value = false
  }
}

const selectModel = async (modelId: string) => {
  if (activeModelId.value === modelId) {
    activeModelId.value = null
    versions.value = []
    return
  }

  activeModelId.value = modelId
  versionsLoading.value = true
  setLastError(null)

  try {
    const res = await api.fetchVersions(modelId, { limit: 20 })
    versions.value = res.data || []
  } catch (error) {
    setLastError(error instanceof Error ? error.message : '版本列表加载失败')
  } finally {
    versionsLoading.value = false
  }
}

const selectVersion = async (model: DrawingsModel, version: DrawingsVersion) => {
  pickerVersionId.value = version.id
  setLastError(null)

  try {
    const project = await api.getProject()
    const file = await api.fetchVersionFile(version.id)

    pickerDrawing.value = {
      projectId: project.id,
      modelId: model.id,
      modelName: model.title,
      versionId: version.id,
      versionCreatedAt: version.createdAt,
      blobId: file.blobId,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize
    }
  } catch (error) {
    setLastError(error instanceof Error ? error.message : '图纸版本加载失败')
  }
}

const confirmPicker = () => {
  if (!pickerDrawing.value) {
    setLastError('请选择一个图纸版本。')
    return
  }

  editorForm.drawing = pickerDrawing.value
  filePickerOpen.value = false
  setLastError(null)
}

const handleSubmit = async () => {
  if (!editorForm.drawing) {
    setLastError('请先选择图纸文件。')
    return
  }

  setEditorSaving(true)
  setLastError(null)

  try {
    const saved = await upsertConfig(projectId.value, {
      id: state.editorMode === 'edit' ? state.activeConfigId || undefined : undefined,
      name: editorForm.name,
      drawing: editorForm.drawing,
      splitRatio: state.splitRatio,
      transform: state.offset,
      calibrationPoints: state.calibration.points,
      cameraState: {
        cad: state.cadCameraState,
        speckle: state.speckleCameraState
      }
    })

    applyConfig(saved)
    closeEditor()
  } catch (error) {
    setLastError(error instanceof Error ? error.message : '保存分屏关联失败')
  } finally {
    setEditorSaving(false)
  }
}

const reloadDebounced = useDebounceFn(() => {
  void refreshModels()
}, 300)

watch(activePanel, (panel, previousPanel) => {
  if (previousPanel === 'splitScreen' && panel !== 'splitScreen') {
    disable()
    closeEditor()
    filePickerOpen.value = false
  }
})

watch(search, () => {
  if (!filePickerOpen.value) return
  reloadDebounced()
})

watch(
  () => state.editorOpen,
  (isOpen) => {
    if (!isOpen) {
      filePickerOpen.value = false
    }
  }
)

onMounted(() => {
  loadLists()
})
</script>

<style scoped>
.panel-section {
  @apply flex flex-col gap-3 border-b border-outline-2 pb-4 last:border-0 last:pb-0;
}

.section-header {
  @apply mb-1 flex items-center gap-1.5 text-body-xs font-semibold uppercase tracking-wide text-foreground;
}

.panel-btn {
  @apply rounded-lg border border-outline-2 bg-foundation-2 px-3 py-2 text-body-xs text-foreground transition-colors hover:bg-foundation;
}

.panel-btn-primary {
  @apply border-primary bg-primary text-foundation hover:opacity-90;
}

.panel-btn-danger {
  @apply border-danger text-danger hover:bg-danger-lighter;
}
</style>
