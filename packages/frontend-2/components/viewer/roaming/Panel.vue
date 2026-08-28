<template>
  <ViewerLayoutSidePanel disable-scrollbar class="relative" @close="$emit('close')">
    <template #title>
      <div class="flex items-center gap-2">
        <span>漫游</span>
      </div>
    </template>

    <template #actions>
      <div class="flex items-center gap-1">
        <FormButton
          v-tippy="'新建漫游路线'"
          size="sm"
          color="subtle"
          :icon-left="Plus"
          hide-text
          @click="openCreatePanel"
        />
      </div>
    </template>

    <!-- 漫游列表内容区 -->
    <div
      class="flex flex-col flex-1 min-h-0 overflow-y-auto simple-scrollbar p-2 gap-2"
    >
      <!-- 空状态 -->
      <div
        v-if="routes.length === 0"
        class="flex flex-col items-center justify-center p-8 text-center gap-3 my-auto select-none"
      >
        <div
          class="w-12 h-12 rounded-full bg-primary-muted flex items-center justify-center text-primary"
        >
          <Footprints class="w-6 h-6" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-body-xs font-medium text-foreground">暂无漫游路线</span>
          <span class="text-body-3xs text-foreground-2">
            创建漫游路线，支持选点漫游与视角关键帧漫游
          </span>
        </div>
        <FormButton
          size="sm"
          color="primary"
          :icon-left="Plus"
          @click="openCreatePanel"
        >
          新建漫游
        </FormButton>
      </div>

      <!-- 漫游路线卡片列表 -->
      <div v-else class="flex flex-col gap-2">
        <ViewerRoamingCard
          v-for="route in routes"
          :key="route.id"
          :route="route"
          :is-current-playing="currentRoute?.id === route.id && isPlaying"
          :is-paused="currentRoute?.id === route.id && isPaused"
          @play="handlePlayRoute"
          @pause="handlePause"
          @resume="handleResume"
          @edit="handleEditRoute"
          @delete="handleDeleteRoute"
          @preview-point="handlePreviewPoint"
        />
      </div>
    </div>

    <!-- 底部播放控制器（当有路线在播放或当前路线存在时常驻） -->
    <template v-if="currentRoute">
      <ViewerRoamingPlayer
        :route="currentRoute"
        :is-playing="isPlaying"
        :is-paused="isPaused"
        :current-point-index="currentPointIndex"
        :current-time="currentTime"
        :total-time="totalTime"
        :progress="progress"
        :playback-speed="playbackSpeed"
        :is-loop="isLoop"
        @play="handlePlayRoute(currentRoute)"
        @pause="handlePause"
        @resume="handleResume"
        @stop="handleStop"
        @set-progress="handleSetProgress"
        @set-speed="handleSetSpeed"
        @toggle-loop="handleToggleLoop"
      />
    </template>

    <!-- 右侧弹出抽屉面板：新建 / 编辑漫游 -->
    <Portal v-if="showCreateEditPanel" to="panel-extension">
      <ViewerRoamingCreateEditPanel
        :route-data="editingRoute"
        :is-edit="!!editingRoute"
        :controller="roamingController"
        @close="closeCreateEditPanel"
        @save="handleSaveRoute"
      />
    </Portal>

    <!-- 删除二次确认弹窗 (CommonConfirmDialog) -->
    <ViewerRoamingDeleteConfirmDialog
      v-model:open="showDeleteDialog"
      :route-name="routeToDelete?.name"
      @confirm="confirmDeleteRoute"
    />
  </ViewerLayoutSidePanel>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Plus, Footprints } from 'lucide-vue-next'
import { FormButton } from '@speckle/ui-components'
import { SelectionExtension } from '@speckle/viewer'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'
import { useSelectionUtilities } from '~/lib/viewer/composables/ui'
import { useRoamingStorage } from '~/lib/viewer/composables/roaming/useRoamingStorage'
import { useRoamingController } from '~/lib/viewer/composables/roaming/useRoamingController'
import type { RoamingRoute, RoamingPoint } from '~/lib/viewer/composables/roaming/types'

defineEmits<{
  (e: 'close'): void
}>()

const {
  viewer: { instance }
} = useInjectedViewerState()
const { clearSelection } = useSelectionUtilities()

const { routes, addRoute, updateRoute, deleteRoute } = useRoamingStorage()
const roamingController = useRoamingController()

const {
  isPlaying,
  isPaused,
  currentRoute,
  currentPointIndex,
  currentTime,
  totalTime,
  progress,
  playbackSpeed,
  isLoop,
  playRoute,
  pause,
  resume,
  stop,
  setProgress,
  setSpeed,
  toggleLoop,
  previewPoint,
  visualizer
} = roamingController

// 抽屉弹窗状态
const showCreateEditPanel = ref(false)
const editingRoute = ref<RoamingRoute | null>(null)

// 删除确认弹窗状态
const showDeleteDialog = ref(false)
const routeToDelete = ref<RoamingRoute | null>(null)

const openCreatePanel = () => {
  editingRoute.value = null
  showCreateEditPanel.value = true
}

const closeCreateEditPanel = () => {
  showCreateEditPanel.value = false
  editingRoute.value = null
  visualizer.clear()
}

const handleEditRoute = (route: RoamingRoute) => {
  editingRoute.value = route
  showCreateEditPanel.value = true
}

const handleSaveRoute = (
  routeData: Omit<RoamingRoute, 'id' | 'createdAt' | 'updatedAt'>
) => {
  if (editingRoute.value) {
    updateRoute(editingRoute.value.id, routeData)
  } else {
    addRoute(routeData)
  }
  closeCreateEditPanel()
}

const handleDeleteRoute = (route: RoamingRoute) => {
  routeToDelete.value = route
  showDeleteDialog.value = true
}

const confirmDeleteRoute = () => {
  if (routeToDelete.value) {
    if (currentRoute.value?.id === routeToDelete.value.id) {
      stop()
      currentRoute.value = null
    }
    deleteRoute(routeToDelete.value.id)
    routeToDelete.value = null
  }
  showDeleteDialog.value = false
}

const handlePlayRoute = (route: RoamingRoute) => {
  playRoute(route)
}

const handlePause = () => {
  pause()
}

const handleResume = () => {
  resume()
}

const handleStop = () => {
  stop()
}

const handleSetProgress = (val: number) => {
  setProgress(val)
}

const handleSetSpeed = (spd: number) => {
  setSpeed(spd)
}

const handleToggleLoop = () => {
  toggleLoop()
}

const handlePreviewPoint = (
  route: RoamingRoute,
  point: RoamingPoint,
  pointIdx: number
) => {
  previewPoint(point, route.mode, route.eyeHeight)
  visualizer.renderRoute(route, pointIdx)
}

const logger = useLogger()

onMounted(() => {
  try {
    const selection = instance.getExtension(SelectionExtension)
    selection.enabled = false
    clearSelection()
  } catch (e) {
    logger.error('Failed to disable selection:', e)
  }
})

onUnmounted(() => {
  try {
    const selection = instance.getExtension(SelectionExtension)
    selection.enabled = true
  } catch (e) {
    logger.error('Failed to restore selection:', e)
  }
  visualizer.clear()
})
</script>
