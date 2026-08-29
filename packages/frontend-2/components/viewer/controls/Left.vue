<!-- eslint-disable vuejs-accessibility/no-static-element-interactions -->
<template>
  <div class="contents">
    <aside
      class="absolute left-2 z-50 flex rounded-lg border border-outline-2 bg-foundation px-1 overflow-visible focus-visible:outline-none"
      :class="[
        isEmbedEnabled
          ? 'top-[0.5rem]'
          : 'top-[0.5rem] lg:top-[0] lg:rounded-none lg:px-2 lg:max-h-[100dvh] lg:border-l-0 lg:border-t-0 lg:border-b-0 lg:h-full lg:left-0',
        hasActivePanel && 'h-full max-h-[100dvh] rounded-r-none'
      ]"
    >
      <div class="flex flex-col gap-2 py-1" :class="isEmbedEnabled ? '' : 'lg:py-2'">
        <ViewerControlsButtonToggle
          v-tippy="
            getTooltipProps(
              getShortcutDisplayText(shortcuts.ToggleModels, { format: 'separate' }),
              {
                placement: 'right'
              }
            )
          "
          :active="activePanel === 'models'"
          :icon="Box"
          @click="toggleActivePanel('models')"
        />
        <ViewerControlsButtonToggle
          v-tippy="
            getTooltipProps(
              getShortcutDisplayText(shortcuts.ToggleFilters, { format: 'separate' }),
              {
                placement: 'right'
              }
            )
          "
          :active="activePanel === 'filters'"
          :icon="ListFilter"
          :dot="hasAnyFiltersApplied"
          @click="toggleActivePanel('filters')"
        />
        <ViewerControlsButtonToggle
          v-tippy="
            getTooltipProps(
              getShortcutDisplayText(shortcuts.ToggleDiscussions, {
                format: 'separate'
              }),
              {
                placement: 'right'
              }
            )
          "
          :active="activePanel === 'discussions'"
          :icon="MessageSquareText"
          @click="toggleActivePanel('discussions')"
        />

        <ViewerControlsButtonToggle
          v-tippy="
            getTooltipProps(
              getShortcutDisplayText(shortcuts.ToggleCatalog, { format: 'separate' }),
              {
                placement: 'right'
              }
            )
          "
          :active="activePanel === 'catalog'"
          :icon="ListTree"
          @click="toggleActivePanel('catalog')"
        ></ViewerControlsButtonToggle>
        <!-- Saved views -->
        <ViewerControlsButtonToggle
          v-if="isSavedViewsEnabled"
          v-tippy="
            getTooltipProps(
              getShortcutDisplayText(shortcuts.ToggleSavedViews, {
                format: 'separate'
              }),
              {
                placement: 'right'
              }
            )
          "
          :active="activePanel === 'savedViews'"
          :icon="Camera"
          @click="toggleActivePanel('savedViews')"
        ></ViewerControlsButtonToggle>

        <!-- alignment -->
        <ViewerControlsButtonToggle
          v-tippy="
            getTooltipProps(
              getShortcutDisplayText(shortcuts.ToggleAlignments, {
                format: 'separate'
              }),
              {
                placement: 'right'
              }
            )
          "
          :active="activePanel === 'alignments'"
          :icon="BetweenVerticalStart"
          @click="toggleActivePanel('alignments')"
        ></ViewerControlsButtonToggle>

        <!-- roaming -->
        <ViewerControlsButtonToggle
          v-tippy="
            getTooltipProps('漫游', {
              placement: 'right'
            })
          "
          :active="activePanel === 'roaming'"
          :icon="Footprints"
          @click="toggleActivePanel('roaming')"
        ></ViewerControlsButtonToggle>

        <ViewerControlsButtonToggle
          v-if="allAutomationRuns.length !== 0"
          v-tippy="{
            content: summary.longSummary,
            placement: 'right'
          }"
          :active="activePanel === 'automate'"
          @click="toggleActivePanel('automate')"
        >
          <AutomateRunsTriggerStatusIcon
            :summary="summary"
            class="h-5 w-5 md:h-6 md:w-6"
          />
        </ViewerControlsButtonToggle>
      </div>

      <!-- Resize handle -->
      <div
        v-if="activePanel !== 'none' && !isEmbedEnabled"
        ref="resizeHandle"
        class="absolute h-full w-4 transition border-l hover:border-l-[2px] border-outline-2 hover:border-[#00b4b6] hidden lg:flex items-center cursor-ew-resize z-30"
        :style="`left:${width + 52}px;`"
        @mousedown="startResizing"
      />

      <!-- Scrollable controls container -->
      <div
        v-show="activePanel !== 'none'"
        ref="scrollableControlsContainer"
        :class="[
          'bg-foundation absolute z-10 left-[calc(2.5rem+1px)] top-[-1px] bottom-[-1px] overflow-hidden border-outline-2 border border-l-0 rounded-lg rounded-tl-none rounded-bl-none ',
          hasActivePanel ? 'opacity-100' : 'opacity-0',
          isEmbedEnabled ? '' : 'lg:left-[calc(3rem+1px)] lg:rounded-none'
        ]"
        :style="`width: ${widthClass};`"
      >
        <ViewerModelsPanel
          v-if="activePanel === 'models'"
          v-model:sub-view="modelsSubView"
        />
        <ViewerFiltersPanel v-if="activePanel === 'filters'" />
        <ViewerCommentsPanel
          v-if="resourceItems.length !== 0 && activePanel === 'discussions'"
        />
        <AutomateViewerPanel
          v-if="activePanel === 'automate'"
          :automation-runs="allAutomationRuns"
          :summary="summary"
        />
        <ViewerDataviewerPanel v-if="activePanel === 'devMode'" />
        <ViewerCatalogPanel v-if="activePanel === 'catalog'"></ViewerCatalogPanel>
        <ViewerAlignmentsPanel v-if="activePanel === 'alignments'" />
        <ViewerRoamingPanel
          v-if="activePanel === 'roaming'"
          @close="activePanel = 'none'"
        />
        <KeepAlive>
          <ViewerSavedViewsPanel
            v-if="isSavedViewsEnabled && activePanel === 'savedViews'"
            @close="activePanel = 'none'"
          />
        </KeepAlive>
      </div>

      <!-- Panel Extension - Portal target for additional content -->
      <div
        id="panel-extension"
        class="absolute z-50 left-[calc(100dvw-16rem)] sm:left-72 max-h-[calc(100dvh-9rem)] md:max-h-[calc(100dvh-7rem)] top-12 bg-foundation rounded-lg overflow-hidden flex flex-col"
        :style="`left: ${panelExtensionLeft} !important; width: ${panelExtensionWidth}px;`"
      >
        <!-- Resize handle for panel extension -->
        <div
          ref="panelExtensionResizeHandle"
          class="absolute h-full max-h-[calc(100dvh-9rem)] md:max-h-[calc(100dvh-7rem)] w-4 transition border-r hover:border-r-[2px] border-outline-2 hover:border-[#00b4b6] hidden lg:flex items-center cursor-ew-resize z-30 right-0"
          @mousedown="startPanelExtensionResizing"
        />
        <PortalTarget
          name="panel-extension"
          class="h-full flex flex-col min-h-0 flex-1 overflow-hidden"
        ></PortalTarget>
      </div>
    </aside>

    <!-- 返回按钮：fixed 悬浮在侧边栏右侧顶部，始终可见 -->
    <Teleport to="body">
      <button
        v-if="!isEmbedEnabled"
        v-tippy="getTooltipProps('返回上一级', { placement: 'right' })"
        class="fixed z-[10] top-2 flex items-center space-x-1 text-black bg-white hover:bg-gray-100 px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors shadow-sm"
        :style="backBtnStyle"
        @click="goBackToPreviousPage"
      >
        <ArrowLeft class="w-4 h-4" />
        <span>返回</span>
      </button>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useViewerShortcuts } from '~~/lib/viewer/composables/ui'
import {
  useInjectedViewerInterfaceState,
  useInjectedViewerLoadedResources,
  useInjectedViewerState
} from '~~/lib/viewer/composables/setup'
import { useEmbed } from '~/lib/viewer/composables/setup/embed'
import { TailwindBreakpoints } from '~~/lib/common/helpers/tailwind'
import {
  useEventListener,
  useResizeObserver,
  useBreakpoints,
  useWindowSize,
  useThrottleFn
} from '@vueuse/core'
import { type Nullable, isNonNullable } from '@speckle/shared'
import { useFunctionRunsStatusSummary } from '~/lib/automate/composables/runStatus'
import { projectsRoute } from '~~/lib/common/helpers/route'
import { useAreSavedViewsEnabled } from '~/lib/viewer/composables/savedViews/general'
import {
  Camera,
  Box,
  ListFilter,
  MessageSquareText,
  ArrowLeft,
  ListTree,
  BetweenVerticalStart,
  Footprints
} from 'lucide-vue-next'
import { useViewerPanelsUtilities } from '~/lib/viewer/composables/setup/panels'
import type { ActivePanel } from '~/lib/viewer/helpers/sceneExplorer'
import { useSettingsMenuState } from '~/lib/settings/composables/menu'
import { useAlignmentState } from '~/lib/viewer/composables/setup/alignment'

// TODO: Refactor all of this event business and just read/write panels state directly
const emit = defineEmits<{
  forceClosePanels: []
}>()

const { width: windowWidth } = useWindowSize()

const { resourceItems, modelsAndVersionIds } = useInjectedViewerLoadedResources()
const { registerShortcuts, getShortcutDisplayText, shortcuts } = useViewerShortcuts()
const router = useSafeRouter()
const { isEnabled: isEmbedEnabled } = useEmbed()
const breakpoints = useBreakpoints(TailwindBreakpoints)
const isMobile = breakpoints.smaller('sm')
const isTablet = breakpoints.smaller('lg')
const isLargerThanLg = breakpoints.greater('lg')
const { getTooltipProps } = useSmartTooltipDelay()
const isSavedViewsEnabled = useAreSavedViewsEnabled()
const {
  filters: { hasAnyFiltersApplied }
} = useInjectedViewerInterfaceState()
const {
  ui: {
    panels: { active: activePanel, modelsSubView }
  }
} = useInjectedViewerState()

const { onPanelButtonClick } = useViewerPanelsUtilities()
const { state: alignmentState, disableSplitScreen } = useAlignmentState()

const width = ref(264)
const panelExtensionWidth = ref(isMobile.value ? 200 : isLargerThanLg.value ? 300 : 256)
const scrollableControlsContainer = ref(null as Nullable<HTMLDivElement>)
const height = ref(scrollableControlsContainer.value?.clientHeight)
const isResizing = ref(false)
const isPanelExtensionResizing = ref(false)
const resizeHandle = ref(null)
const panelExtensionResizeHandle = ref(null)

let startWidth = 0
let startX = 0
let startPanelExtensionWidth = 0
let startPanelExtensionX = 0

const startResizing = (event: MouseEvent) => {
  if (isMobile.value) return
  event.preventDefault()
  isResizing.value = true
  startX = event.clientX
  startWidth = width.value
}

const startPanelExtensionResizing = (event: MouseEvent) => {
  if (isMobile.value) return
  event.preventDefault()
  isPanelExtensionResizing.value = true
  startPanelExtensionX = event.clientX
  startPanelExtensionWidth = panelExtensionWidth.value
}

const throttledHandleMouseMove = useThrottleFn((event: MouseEvent) => {
  if (isResizing.value) {
    const diffX = event.clientX - startX
    const newWidth = Math.max(
      240,
      Math.min(startWidth + diffX, Math.min(440, windowWidth.value * 0.5 - 60))
    )
    width.value = newWidth
  } else if (isPanelExtensionResizing.value) {
    const diffX = event.clientX - startPanelExtensionX
    const newWidth = Math.max(
      200,
      Math.min(startPanelExtensionWidth + diffX, Math.min(400, windowWidth.value * 0.4))
    )
    panelExtensionWidth.value = newWidth
  }
}, 50)

if (import.meta.client) {
  useResizeObserver(scrollableControlsContainer, (entries) => {
    const { height: newHeight } = entries[0].contentRect
    height.value = newHeight
  })
  useEventListener(resizeHandle, 'mousedown', startResizing)
  useEventListener(panelExtensionResizeHandle, 'mousedown', startPanelExtensionResizing)

  useEventListener(document, 'mousemove', throttledHandleMouseMove)

  useEventListener(document, 'mouseup', () => {
    if (isResizing.value) {
      isResizing.value = false
    }
    if (isPanelExtensionResizing.value) {
      isPanelExtensionResizing.value = false
    }
  })
}

const hasActivePanel = computed(() => activePanel.value !== 'none')

const allAutomationRuns = computed(() => {
  const allAutomationStatuses = modelsAndVersionIds.value
    .map(({ model }) => model.loadedVersion.items[0].automationsStatus)
    .flat()
    .filter(isNonNullable)

  return allAutomationStatuses.map((status) => status.automationRuns).flat()
})

const allFunctionRuns = computed(() => {
  return allAutomationRuns.value.map((run) => run.functionRuns).flat()
})

const widthClass = computed(() => {
  if (isMobile.value) {
    return 'calc(100vw - 3.6rem)'
  } else if (isTablet.value) {
    return '240px'
  } else {
    return `${width.value + 4}px`
  }
})

const panelExtensionLeft = computed(() => {
  if (isMobile.value || isTablet.value) {
    return
  }
  const mainPanelLeft = isEmbedEnabled.value ? 52 : 60
  return `${mainPanelLeft + width.value}px`
})

// 返回按钮 fixed 悬浮位置：始终贴着侧边栏右侧
const backBtnStyle = computed(() => {
  // 图标栏宽度：embed: 2.5rem(40px), 普通: 3rem(48px)
  const iconBarWidth = isEmbedEnabled.value ? 40 : 48
  // 左边定位：左内边距(0 或 0.5rem) + 图标栏宽 + 展开面板宽(hasActivePanel时加上)
  const leftOffset = isEmbedEnabled.value ? 8 : 0 // aside 的 left-2(8px) 或 left-0
  let left = leftOffset + iconBarWidth + 8 // 8px 间距
  if (hasActivePanel.value && !isMobile.value) {
    const panelWidth = isTablet.value ? 240 : width.value + 4
    left = leftOffset + iconBarWidth + panelWidth + 8
  }
  return { left: `${left}px` }
})

const { summary } = useFunctionRunsStatusSummary({
  runs: allFunctionRuns
})

registerShortcuts({
  ToggleModels: () => toggleActivePanel('models'),
  ToggleFilters: () => toggleActivePanel('filters'),
  ToggleDiscussions: () => toggleActivePanel('discussions'),
  ToggleDevMode: () => toggleActivePanel('devMode'),
  ToggleSavedViews: () => isSavedViewsEnabled && toggleActivePanel('savedViews')
})

const toggleActivePanel = (panel: ActivePanel) => {
  onPanelButtonClick(panel)
}

const settingsMenuState = useSettingsMenuState()
const exitSettingsRoute = computed(() => {
  return settingsMenuState.value.previousRoute || projectsRoute
})

const goBackToPreviousPage = async () => {
  // 获取当前路由
  const currentRoute = useRoute()

  // 尝试从路由参数中获取项目 ID
  const projectId =
    (currentRoute.params.projectId as string) || (currentRoute.params.id as string)

  // 检查来源页面，决定返回目标
  const fromPage = sessionStorage.getItem('viewer-from-page')

  if (fromPage === 'light-models' && projectId) {
    // 从轻量模型页面进入，返回到轻量模型列表
    const target = `/models/light`
    // 清除标记
    sessionStorage.removeItem('viewer-from-page')
    await router.push(() => target)
  } else if (projectId) {
    // 其他情况，返回到项目的 workbench 页面
    const target = `/projects/${projectId}/workbench`
    // 清除标记
    sessionStorage.removeItem('viewer-from-page')
    await router.push(() => target)
  } else {
    // 如果没有项目 ID，则使用默认路由
    await router.push(() => exitSettingsRoute.value)
  }
}

const forceClosePanel = () => {
  activePanel.value = 'none'
}

watch(activePanel, (newVal, oldVal) => {
  const wasNone = oldVal === 'none'

  // If a panel is being opened (not closed) on mobile, emit event to parent
  if (wasNone && newVal !== 'none' && isMobile.value) {
    emit('forceClosePanels')
  }

  const leavingAlignments = oldVal === 'alignments' && newVal !== 'alignments'
  if (leavingAlignments && alignmentState.splitScreenEnabled) {
    disableSplitScreen()
  }
})

defineExpose({
  forceClosePanel,
  forceClosePanels: forceClosePanel
})
</script>
