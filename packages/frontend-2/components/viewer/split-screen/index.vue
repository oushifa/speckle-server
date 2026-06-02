<template>
  <div
    class="pointer-events-none fixed inset-y-0 right-0 z-40 overflow-hidden"
    :style="{
      left: `${leftMenuWidth}px`,
      width: `calc(100vw - ${leftMenuWidth}px)`
    }"
  >
    <div
      class="pointer-events-auto absolute inset-y-0 left-0 overflow-hidden border-r border-outline-2 bg-foundation"
      :style="{ width: `${leftPaneWidth}px` }"
    >
      <ViewerSplitScreenCadViewer
        ref="cadViewerRef"
        :drawing="drawing"
        :marker-point="state.highlightedCadPoint"
        :calibration-markers="state.calibration.markers"
        :calibrate-mode="state.calibration.active && state.calibration.step === 'cad'"
        @controls-change="captureCadCameraState"
        @drawing-loaded="onCadDrawingLoaded"
        @calibrate-pick="onCadCalibratePick"
        @navigate-pick="onCadNavigatePick"
      />
    </div>

    <button
      type="button"
      class="pointer-events-auto absolute inset-y-0 z-30 w-2 cursor-col-resize"
      :style="{ left: `${leftPaneWidth - 4}px` }"
      @mousedown.prevent="startDragging"
    >
      <div
        class="absolute inset-x-0 inset-y-0 bg-outline-2 transition-colors hover:bg-primary"
        :class="dragging ? 'bg-primary' : ''"
      />
    </button>

    <div
      ref="specklePaneEl"
      class="pointer-events-none absolute inset-y-0 right-0"
      :style="{ left: `${leftPaneWidth + 2}px` }"
    >
      <Transition name="fade">
        <div
          v-if="state.calibration.active || state.calibration.awaitingCompletion"
          class="absolute left-1/2 top-3 z-20 flex min-w-[320px] max-w-[540px] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-warning bg-warning/15 px-4 py-3 text-body-xs text-warning backdrop-blur-sm"
        >
          <div class="flex items-center gap-1.5 font-medium">
            <LucideCrosshair class="h-3.5 w-3.5" />
            <span>校准步骤提示</span>
            <span class="rounded-full bg-warning/20 px-2 py-0.5 text-[11px]">
              {{ completedPointCount }}/3
            </span>
          </div>
          <div class="leading-5 text-warning">
            {{ calibrationHeadline }}
          </div>
          <div class="text-[11px] leading-5 text-warning/90">
            {{ calibrationSubline }}
          </div>
        </div>
      </Transition>

      <Transition name="fade">
        <div
          v-if="state.calibration.active"
          class="absolute bottom-3 left-3 z-20 rounded-xl border border-outline-2 bg-foundation/95 px-3 py-2 text-body-xs text-foreground shadow-lg backdrop-blur-sm"
        >
          <div class="font-medium">交互说明</div>
          <div class="mt-1 text-foreground-2">
            {{ calibrationInstruction }}
          </div>
        </div>
      </Transition>

      <div
        v-for="marker in speckleCalibrationMarkers"
        :key="marker.key"
        class="absolute z-30 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary text-body-xs font-semibold text-white shadow"
        :style="{ left: `${marker.x}px`, top: `${marker.y}px` }"
      >
        {{ marker.index }}
      </div>

      <div
        v-if="pendingSpeckleMarker"
        class="absolute z-30 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-warning/90 text-body-xs font-semibold text-white shadow-lg ring-4 ring-warning/25"
        :style="{
          left: `${pendingSpeckleMarker.x}px`,
          top: `${pendingSpeckleMarker.y}px`
        }"
      >
        {{ pendingSpeckleMarker.index }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { CameraController } from '@speckle/viewer'
import { LucideCrosshair } from 'lucide-vue-next'
import { Vector2, Vector3 } from 'three'
import type {
  ViewerSplitScreenCameraState,
  ViewerSplitScreenDrawing
} from '~/lib/viewer/composables/setup/splitScreen'
import { useViewerSplitScreenState } from '~/lib/viewer/composables/setup/splitScreen'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'
import { useSelectionUtilities } from '~/lib/viewer/composables/ui'
import {
  transformCadToSpecklePoint,
  transformSpeckleToCadPoint
} from './CoordinateOffset'

defineProps<{
  drawing: ViewerSplitScreenDrawing | null
}>()

const {
  state,
  setSplitRatio,
  setCalibrationCadPoint,
  setCalibrationSpecklePoint,
  setHighlightedCadPoint,
  setCadCameraState,
  setSpeckleCameraState
} = useViewerSplitScreenState()
const {
  viewer: { instance: speckleInstance, container: speckleContainer },
  ui: {
    camera: { isOrthoProjection }
  }
} = useInjectedViewerState()
const { clearSelection } = useSelectionUtilities()
const dragging = ref(false)
const cadViewerRef = ref<{
  getCameraState: () => ViewerSplitScreenCameraState | null
  applyCameraState: (cameraState: ViewerSplitScreenCameraState | null) => void
} | null>(null)
const specklePaneEl = ref<HTMLDivElement | null>(null)
const leftMenuWidth = 316

const windowWidth = ref(import.meta.client ? window.innerWidth : 1280)
const availableWidth = computed(() => Math.max(windowWidth.value - leftMenuWidth, 1))
const leftPaneWidth = computed(() => availableWidth.value * state.splitRatio)
const speckleCalibrationMarkers = ref<
  Array<{ key: string; index: 1 | 2 | 3; x: number; y: number }>
>([])
const pendingSpeckleMarker = ref<{
  index: 1 | 2 | 3
  x: number
  y: number
} | null>(null)

let projectionFrameId: number | null = null
let pendingCadCameraRestoreKey: number | null = null
const skipCadCameraCapture = ref(false)
const skipSpeckleCameraCapture = ref(false)

const completedPointCount = computed(() => state.calibration.points.length)

const calibrationHeadline = computed(() => {
  if (state.calibration.awaitingCompletion) {
    return '三组对应点已采集完成，请在左侧面板点击“完成校准”保存这次对齐。'
  }

  const currentIndex = Math.min(state.calibration.pointIndex + 1, 3)
  if (state.calibration.step === 'cad') {
    return `正在采集第 ${currentIndex} 组点位，请先在左侧 CAD 里点击参考点。`
  }

  return `正在采集第 ${currentIndex} 组点位，请在右侧 BIM 里点击对应位置，右屏会显示编号 marker。`
})

const calibrationSubline = computed(() => {
  if (state.calibration.awaitingCompletion) {
    return '如果点位有误，可以点击“取消校准”重新开始。'
  }

  return state.calibration.step === 'cad'
    ? '建议选择角点、洞口中心或轴网交点这类稳定特征点。'
    : '点击成功后会进入下一组点位；请尽量选和左侧同一物理位置的点。'
})

const calibrationInstruction = computed(() => {
  if (state.calibration.step === 'cad') {
    return '当前等待左屏 CAD 选点。'
  }

  return '当前等待右屏 BIM 选点，选中后会在右屏显示编号 marker。'
})

const updateViewerClip = () => {
  if (!import.meta.client) return

  const viewerEl = document.querySelector<HTMLElement>('#viewer')
  if (!viewerEl) return

  viewerEl.style.left = `${leftMenuWidth + leftPaneWidth.value + 2}px`
  viewerEl.style.right = '0'
  viewerEl.style.width = 'auto'
}

const resetViewerClip = () => {
  if (!import.meta.client) return

  const viewerEl = document.querySelector<HTMLElement>('#viewer')
  if (!viewerEl) return

  viewerEl.style.left = ''
  viewerEl.style.right = ''
  viewerEl.style.width = ''
}

const getCameraController = (): CameraController | null => {
  try {
    return speckleInstance.getExtension(CameraController) ?? null
  } catch {
    return null
  }
}

const captureCadCameraState = () => {
  if (skipCadCameraCapture.value) return
  setCadCameraState(cadViewerRef.value?.getCameraState() || null)
}

const getCurrentSpeckleCameraState = (): ViewerSplitScreenCameraState | null => {
  const cc = getCameraController()
  const renderer = speckleInstance.getRenderer()
  const camera = renderer.renderingCamera
  if (!cc || !camera) return null

  const cameraState: ViewerSplitScreenCameraState = {
    position: {
      x: cc.getPosition().x,
      y: cc.getPosition().y,
      z: cc.getPosition().z
    },
    target: {
      x: cc.getTarget().x,
      y: cc.getTarget().y,
      z: cc.getTarget().z
    },
    projection: isOrthoProjection.value ? 'orthographic' : 'perspective'
  }

  if ('fov' in camera && typeof camera.fov === 'number') {
    cameraState.fov = camera.fov
  }
  if ('zoom' in camera && typeof camera.zoom === 'number') {
    cameraState.zoom = camera.zoom
  }

  return cameraState
}

const captureSpeckleCameraState = () => {
  if (skipSpeckleCameraCapture.value) return
  setSpeckleCameraState(getCurrentSpeckleCameraState())
}

const applySavedSpeckleCameraState = (
  cameraState: ViewerSplitScreenCameraState | null
) => {
  if (!cameraState) return

  const cc = getCameraController()
  if (!cc) return

  if (
    cameraState.projection &&
    (cameraState.projection === 'orthographic') !== isOrthoProjection.value
  ) {
    isOrthoProjection.value = cameraState.projection === 'orthographic'
  }

  cc.setCameraView(
    {
      position: new Vector3(
        cameraState.position.x,
        cameraState.position.y,
        cameraState.position.z
      ),
      target: new Vector3(
        cameraState.target.x,
        cameraState.target.y,
        cameraState.target.z
      )
    } as never,
    true
  )
}

const pickSpecklePoint = (event: MouseEvent): Vector3 | null => {
  const renderer = speckleInstance.getRenderer()
  const camera = renderer.renderingCamera
  if (!camera) return null

  const rect = speckleContainer.getBoundingClientRect()
  if (!rect.width || !rect.height) return null

  const ndc = new Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )

  const results = renderer.intersections.intersect(
    renderer.scene,
    camera,
    ndc as never,
    undefined,
    true,
    renderer.clippingVolume
  ) as Array<{ point?: Vector3 }> | null

  return results?.[0]?.point ? new Vector3().copy(results[0].point) : null
}

const updateSpeckleCalibrationMarkers = () => {
  const paneRect = specklePaneEl.value?.getBoundingClientRect()
  const viewerRect = speckleContainer.getBoundingClientRect()
  const renderer = speckleInstance.getRenderer()
  const camera = renderer.renderingCamera

  if (!paneRect || !camera || !viewerRect.width || !viewerRect.height) {
    speckleCalibrationMarkers.value = []
    pendingSpeckleMarker.value = null
    return
  }

  speckleCalibrationMarkers.value = state.calibration.markers
    .flatMap((marker) => {
      if (!marker.specklePoint) return []

      const projected = new Vector3(
        marker.specklePoint.x,
        marker.specklePoint.y,
        marker.specklePoint.z
      ).project(camera as never)

      if (
        !Number.isFinite(projected.x) ||
        !Number.isFinite(projected.y) ||
        projected.z < -1 ||
        projected.z > 1
      ) {
        return []
      }

      return [
        {
          key: `speckle-${marker.index}`,
          index: marker.index,
          x:
            viewerRect.left -
            paneRect.left +
            ((projected.x + 1) / 2) * viewerRect.width,
          y: viewerRect.top - paneRect.top + ((1 - projected.y) / 2) * viewerRect.height
        }
      ]
    })
    .sort((a, b) => a.index - b.index)

  if (pendingSpeckleMarker.value) {
    const hasConfirmedMarker = state.calibration.markers.some(
      (marker) =>
        marker.index === pendingSpeckleMarker.value?.index && !!marker.specklePoint
    )
    if (hasConfirmedMarker) {
      pendingSpeckleMarker.value = null
    }
  }
}

const startProjectionLoop = () => {
  const tick = () => {
    updateSpeckleCalibrationMarkers()
    captureCadCameraState()
    captureSpeckleCameraState()
    projectionFrameId = requestAnimationFrame(tick)
  }
  tick()
}

const focusSpeckleAtPoint = (point: { x: number; y: number; z: number }) => {
  const cc = getCameraController()
  if (!cc) return

  const currentPosition = cc.getPosition()
  const currentTarget = cc.getTarget()
  const delta = new Vector3().subVectors(currentPosition, currentTarget)
  const currentDistance = delta.length()
  const direction =
    currentDistance > Number.EPSILON
      ? delta.clone().normalize()
      : new Vector3(1, 1, 1).normalize()
  const focusDistance = Math.max(currentDistance * 0.35, 0.01)
  const nextTarget = new Vector3(point.x, point.y, point.z)
  const nextPosition = nextTarget.clone().add(direction.multiplyScalar(focusDistance))

  cc.setCameraView(
    {
      position: nextPosition,
      target: nextTarget
    } as never,
    true
  )
}

const onCadCalibratePick = (point: Vector3) => {
  if (!state.calibration.active || state.calibration.step !== 'cad') return
  setCalibrationCadPoint({ x: point.x, y: point.y, z: point.z })
}

const onCadNavigatePick = (point: Vector3) => {
  if (state.calibration.active || state.calibration.awaitingCompletion) return
  if (state.calibration.points.length < 3) return
  setHighlightedCadPoint({ x: point.x, y: point.y, z: point.z })
  focusSpeckleAtPoint(transformCadToSpecklePoint(point, state.offset))
}

const onCadDrawingLoaded = async (versionId: string | null) => {
  if (!state.enabled || !state.activeConfigId) return
  if (!pendingCadCameraRestoreKey || !state.cadCameraState) {
    skipCadCameraCapture.value = false
    return
  }
  if (versionId !== state.drawing?.versionId) return

  const restoreKey = pendingCadCameraRestoreKey
  await nextTick()
  if (pendingCadCameraRestoreKey !== restoreKey) return

  cadViewerRef.value?.applyCameraState(state.cadCameraState)
  pendingCadCameraRestoreKey = null
  skipCadCameraCapture.value = false
}

const onSpeckleClick = (event: MouseEvent) => {
  if (!state.calibration.active || state.calibration.step !== 'speckle') return
  const pickedPoint = pickSpecklePoint(event)
  if (!pickedPoint) return

  const paneRect = specklePaneEl.value?.getBoundingClientRect()
  if (paneRect) {
    pendingSpeckleMarker.value = {
      index: Math.min(state.calibration.pointIndex + 1, 3) as 1 | 2 | 3,
      x: event.clientX - paneRect.left,
      y: event.clientY - paneRect.top
    }
  }

  setCalibrationSpecklePoint({
    x: pickedPoint.x,
    y: pickedPoint.y,
    z: pickedPoint.z
  })
  clearSelection()
}

const onSpeckleDoubleClick = (event: MouseEvent) => {
  if (state.calibration.active || state.calibration.awaitingCompletion) return
  if (state.calibration.points.length < 3) return
  const pickedPoint = pickSpecklePoint(event)
  if (!pickedPoint) return

  setHighlightedCadPoint(transformSpeckleToCadPoint(pickedPoint, state.offset))
}

const startDragging = (event: MouseEvent) => {
  dragging.value = true

  const onMove = (moveEvent: MouseEvent) => {
    const ratio = moveEvent.clientX / Math.max(windowWidth.value, 1)
    setSplitRatio(ratio)
  }

  const onUp = () => {
    dragging.value = false
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.body.style.cursor = 'col-resize'
  onMove(event)
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

watch(
  () => state.splitRatio,
  () => updateViewerClip()
)

watch(
  () => [
    state.calibration.active,
    state.calibration.awaitingCompletion,
    state.calibration.step
  ],
  ([active, awaitingCompletion, step]) => {
    if (!active || awaitingCompletion || step !== 'speckle') {
      pendingSpeckleMarker.value = null
    }
  }
)

watch(
  () => state.calibration.active,
  (active) => {
    if (active) {
      clearSelection()
    }
  },
  { immediate: true }
)

onMounted(() => {
  updateViewerClip()
  startProjectionLoop()
  speckleContainer.addEventListener('click', onSpeckleClick, true)
  speckleContainer.addEventListener('dblclick', onSpeckleDoubleClick, true)
})

watch(
  () => state.cameraRestoreKey,
  async () => {
    if (!state.activeConfigId) return

    pendingCadCameraRestoreKey = state.cameraRestoreKey
    skipCadCameraCapture.value = true
    skipSpeckleCameraCapture.value = true

    const cadCameraState = state.cadCameraState
      ? JSON.parse(JSON.stringify(state.cadCameraState))
      : null
    const speckleCameraState = state.speckleCameraState
      ? JSON.parse(JSON.stringify(state.speckleCameraState))
      : null

    await nextTick()
    if (!cadCameraState) {
      pendingCadCameraRestoreKey = null
      skipCadCameraCapture.value = false
    }
    if (speckleCameraState) {
      applySavedSpeckleCameraState(speckleCameraState)
    }
    skipSpeckleCameraCapture.value = false
  },
  { immediate: true }
)

useEventListener(window, 'resize', () => {
  windowWidth.value = window.innerWidth
  updateViewerClip()
})

onBeforeUnmount(() => {
  resetViewerClip()
  if (projectionFrameId) cancelAnimationFrame(projectionFrameId)
  speckleContainer.removeEventListener('click', onSpeckleClick, true)
  speckleContainer.removeEventListener('dblclick', onSpeckleDoubleClick, true)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
