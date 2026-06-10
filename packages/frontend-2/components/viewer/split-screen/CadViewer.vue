<template>
  <div
    ref="containerRef"
    class="relative h-full w-full overflow-hidden bg-[#f7f7f7]"
    @click="onContainerClick"
    @dblclick="onContainerDoubleClick"
  >
    <canvas ref="canvasRef" class="block h-full w-full" />

    <div class="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-3">
      <div
        class="max-w-[70%] truncate rounded-lg border border-outline-2 bg-foundation/90 px-3 py-1.5 text-body-xs text-foreground shadow-sm backdrop-blur-sm"
      >
        {{ drawing?.fileName || '未选择左屏图纸' }}
      </div>
      <button
        v-if="hasModel"
        class="rounded-lg border border-outline-2 bg-foundation/90 px-3 py-1.5 text-body-xs text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-foundation"
        @click="fitToModel"
      >
        适应视图
      </button>
    </div>

    <div
      v-if="!drawing && !loading"
      class="absolute inset-0 flex items-center justify-center px-6 text-center"
    >
      <div class="max-w-sm rounded-2xl border border-dashed border-outline-2 bg-foundation/70 px-6 py-8">
        <div class="text-body font-medium text-foreground">左屏 CAD 预览</div>
        <div class="mt-2 text-body-sm text-foreground-2">
          请在分屏面板中选择图纸库里的模型版本，加载后会在这里显示 CAD 内容。
        </div>
      </div>
    </div>

    <div
      v-if="loading"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-foundation/70 backdrop-blur-sm"
    >
      <div class="h-1.5 w-48 overflow-hidden rounded-full bg-outline-3">
        <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${progress}%` }" />
      </div>
      <div class="text-body-xs text-foreground-2">加载中 {{ Math.round(progress) }}%</div>
    </div>

    <div
      v-if="error"
      class="absolute bottom-3 left-3 right-3 rounded-lg border border-danger bg-danger/10 px-3 py-2 text-body-xs text-foreground"
    >
      {{ error }}
    </div>

    <div
      v-if="projectedHighlightMarker"
      class="pointer-events-none absolute z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-danger shadow"
      :style="{
        left: `${projectedHighlightMarker.x}px`,
        top: `${projectedHighlightMarker.y}px`
      }"
    />

    <div
      v-for="marker in projectedCalibrationMarkers"
      :key="marker.index"
      class="pointer-events-none absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary text-body-3xs font-semibold text-white shadow"
      :style="{ left: `${marker.x}px`, top: `${marker.y}px` }"
    >
      {{ marker.index }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Line,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type {
  ViewerSplitScreenCameraState,
  ViewerSplitScreenDrawing
} from '~/lib/viewer/composables/setup/splitScreen'
import { parseDxfToGroup } from './DxfLoader'
import { useViewerSplitScreenApi } from './api'

const props = defineProps<{
  drawing: ViewerSplitScreenDrawing | null
  markerPoint?: { x: number; y: number; z: number } | null
  calibrationMarkers?: Array<{
    index: 1 | 2 | 3
    cadPoint?: { x: number; y: number; z: number }
  }>
  calibrateMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'controls-change'): void
  (e: 'calibrate-pick', point: Vector3): void
  (e: 'navigate-pick', point: Vector3): void
  (e: 'drawing-loaded', versionId: string | null): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const api = useViewerSplitScreenApi()
const loading = ref(false)
const progress = ref(0)
const error = ref<string | null>(null)
const hasModel = ref(false)

const scene = new Scene()
scene.background = new Color('#f7f7f7')

const perspectiveCamera = new PerspectiveCamera(45, 1, 0.1, 100000)
const orthographicCamera = new OrthographicCamera(-10, 10, 10, -10, -100000, 100000)
let activeCamera: PerspectiveCamera | OrthographicCamera = perspectiveCamera
let renderer: WebGLRenderer | null = null
let controls: OrbitControls | null = null
let currentModel: Group | null = null
let frameId: number | null = null
let currentObjectUrl: string | null = null
let markerMesh: Mesh | null = null
let targetHighlightPoint: Vector3 | null = null
let currentHighlightPoint: Vector3 | null = null

const projectedHighlightMarker = ref<{ x: number; y: number } | null>(null)
const projectedCalibrationMarkers = ref<Array<{ index: 1 | 2 | 3; x: number; y: number }>>([])

const disposeCurrentModel = () => {
  if (!currentModel) return

  currentModel.traverse((obj) => {
    const geometry = (obj as { geometry?: { dispose?: () => void } }).geometry
    geometry?.dispose?.()

    const material = (obj as { material?: Material | Material[] }).material
    if (Array.isArray(material)) {
      material.forEach((item) => item?.dispose?.())
    } else {
      material?.dispose?.()
    }
  })

  scene.remove(currentModel)
  currentModel = null
  hasModel.value = false
}

const ensureMarker = () => {
  if (markerMesh || !scene) return
  markerMesh = new Mesh(
    new SphereGeometry(0.6, 24, 24),
    new MeshBasicMaterial({ color: '#ff5a5a' })
  )
  markerMesh.visible = false
  scene.add(markerMesh)
}

const projectWorldPointToScreen = (worldPoint: { x: number; y: number; z: number }) => {
  if (!containerRef.value || !activeCamera) return null

  const rect = containerRef.value.getBoundingClientRect()
  const projected = new Vector3(worldPoint.x, worldPoint.y, worldPoint.z).project(
    activeCamera as never
  )

  if (
    !Number.isFinite(projected.x) ||
    !Number.isFinite(projected.y) ||
    projected.z < -1 ||
    projected.z > 1
  ) {
    return null
  }

  return {
    x: ((projected.x + 1) / 2) * rect.width,
    y: ((1 - projected.y) / 2) * rect.height
  }
}

const updateProjectedCalibrationMarkers = () => {
  if (!containerRef.value || !activeCamera) {
    projectedCalibrationMarkers.value = []
    return
  }

  projectedCalibrationMarkers.value = (props.calibrationMarkers || [])
    .flatMap((marker) => {
      if (!marker.cadPoint) return []
      const projected = projectWorldPointToScreen(marker.cadPoint)
      if (!projected) return []
      return [{ index: marker.index, x: projected.x, y: projected.y }]
    })
    .sort((a, b) => a.index - b.index)
}

const syncHighlightMarkerDisplay = () => {
  ensureMarker()
  if (!markerMesh || !currentHighlightPoint) {
    if (markerMesh) markerMesh.visible = false
    projectedHighlightMarker.value = null
    return
  }

  markerMesh.visible = true
  markerMesh.position.copy(currentHighlightPoint)
  projectedHighlightMarker.value = projectWorldPointToScreen({
    x: currentHighlightPoint.x,
    y: currentHighlightPoint.y,
    z: currentHighlightPoint.z
  })
}

const updateMarker = (point: { x: number; y: number; z: number } | null) => {
  ensureMarker()
  if (!markerMesh) return

  if (!point) {
    targetHighlightPoint = null
    currentHighlightPoint = null
    markerMesh.visible = false
    projectedHighlightMarker.value = null
    return
  }

  targetHighlightPoint = new Vector3(point.x, point.y, point.z)
  if (!currentHighlightPoint) {
    currentHighlightPoint = targetHighlightPoint.clone()
  }
}

const updateHighlightMarkerAnimation = () => {
  if (!targetHighlightPoint) {
    currentHighlightPoint = null
    syncHighlightMarkerDisplay()
    return
  }

  if (!currentHighlightPoint) {
    currentHighlightPoint = targetHighlightPoint.clone()
    syncHighlightMarkerDisplay()
    return
  }

  currentHighlightPoint.lerp(targetHighlightPoint, 0.24)
  if (currentHighlightPoint.distanceToSquared(targetHighlightPoint) <= 0.0004) {
    currentHighlightPoint.copy(targetHighlightPoint)
  }

  syncHighlightMarkerDisplay()
}

const fitToModel = () => {
  if (!currentModel || !controls) return

  const box = new Box3().setFromObject(currentModel)
  if (box.isEmpty()) return

  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1)
  const distance = maxDim * 1.6

  perspectiveCamera.near = Math.max(0.1, distance / 1000)
  perspectiveCamera.far = Math.max(100000, distance * 100)
  perspectiveCamera.position.set(center.x + distance, center.y + distance, center.z + distance)
  perspectiveCamera.lookAt(center)
  perspectiveCamera.updateProjectionMatrix()

  controls.target.copy(center)
  controls.update()
  emit('controls-change')
}

const getCameraState = (): ViewerSplitScreenCameraState | null => {
  if (!controls) return null

  const cameraState: ViewerSplitScreenCameraState = {
    position: {
      x: activeCamera.position.x,
      y: activeCamera.position.y,
      z: activeCamera.position.z
    },
    target: {
      x: controls.target.x,
      y: controls.target.y,
      z: controls.target.z
    },
    projection: activeCamera instanceof OrthographicCamera ? 'orthographic' : 'perspective'
  }

  if (activeCamera instanceof PerspectiveCamera) {
    cameraState.fov = activeCamera.fov
  }
  if (typeof activeCamera.zoom === 'number') {
    cameraState.zoom = activeCamera.zoom
  }

  return cameraState
}

const applyCameraState = (cameraState: ViewerSplitScreenCameraState | null) => {
  if (!cameraState || !controls) return

  if (cameraState.projection === 'orthographic') {
    activeCamera = orthographicCamera
  } else {
    activeCamera = perspectiveCamera
  }
  controls.object = activeCamera

  activeCamera.position.set(
    cameraState.position.x,
    cameraState.position.y,
    cameraState.position.z
  )
  controls.target.set(cameraState.target.x, cameraState.target.y, cameraState.target.z)

  if (activeCamera instanceof PerspectiveCamera && typeof cameraState.fov === 'number') {
    activeCamera.fov = cameraState.fov
  }
  if (typeof cameraState.zoom === 'number') {
    activeCamera.zoom = cameraState.zoom
  }

  activeCamera.updateProjectionMatrix()
  controls.update()
  emit('controls-change')
}

const resize = () => {
  if (!containerRef.value || !renderer) return

  const width = containerRef.value.clientWidth || 1
  const height = containerRef.value.clientHeight || 1

  renderer.setSize(width, height, false)
  perspectiveCamera.aspect = width / height
  perspectiveCamera.updateProjectionMatrix()

  const frustumSize = 40
  orthographicCamera.left = (-frustumSize * width) / height / 2
  orthographicCamera.right = (frustumSize * width) / height / 2
  orthographicCamera.top = frustumSize / 2
  orthographicCamera.bottom = -frustumSize / 2
  orthographicCamera.updateProjectionMatrix()
}

const renderLoop = () => {
  if (renderer) {
    controls?.update()
    updateHighlightMarkerAnimation()
    updateProjectedCalibrationMarkers()
    renderer.render(scene, activeCamera)
  }
  frameId = requestAnimationFrame(renderLoop)
}

const pickPointFromEvent = (e: MouseEvent) => {
  if (!currentModel || !activeCamera || !renderer) return null

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pointer = { x: e.clientX, y: e.clientY }
  const ndc = new Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  )

  const raycaster = new Raycaster()
  ;(raycaster.params as { Line?: { threshold: number }; Points?: { threshold: number } }).Line = {
    threshold: 4
  }
  ;(raycaster.params as { Line?: { threshold: number }; Points?: { threshold: number } }).Points =
    { threshold: 8 }
  raycaster.setFromCamera(ndc, activeCamera as never)

  const projectToScreen = (worldPoint: Vector3) => {
    const projected = worldPoint.clone().project(activeCamera as never)
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null

    return {
      x: rect.left + ((projected.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - projected.y) / 2) * rect.height
    }
  }

  const getScreenDistance = (screenPoint: { x: number; y: number }) =>
    Math.hypot(screenPoint.x - pointer.x, screenPoint.y - pointer.y)

  const closestPointOnSegment = (
    segmentStart: { x: number; y: number },
    segmentEnd: { x: number; y: number }
  ) => {
    const abX = segmentEnd.x - segmentStart.x
    const abY = segmentEnd.y - segmentStart.y
    const lengthSquared = abX * abX + abY * abY
    const t =
      lengthSquared <= Number.EPSILON
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              ((pointer.x - segmentStart.x) * abX + (pointer.y - segmentStart.y) * abY) /
                lengthSquared
            )
          )

    return {
      x: segmentStart.x + abX * t,
      y: segmentStart.y + abY * t,
      t
    }
  }

  const lineThreshold = props.calibrateMode ? 18 : 12
  const endpointThreshold = props.calibrateMode ? 22 : 16
  let bestCandidate: { point: Vector3; distance: number } | null = null

  const updateCandidate = (candidate: { point: Vector3; distance: number } | null) => {
    if (!candidate) return
    if (!bestCandidate || candidate.distance < bestCandidate.distance) {
      bestCandidate = candidate
    }
  }

  currentModel.traverse((child) => {
    const pickableChild = child as Object3D & {
      geometry?: {
        attributes?: {
          position?: {
            count: number
            getX: (i: number) => number
            getY: (i: number) => number
            getZ: (i: number) => number
          }
        }
        index?: { count: number; getX: (i: number) => number }
      }
      localToWorld: (vector: Vector3) => Vector3
      isLine?: boolean
      isLineSegments?: boolean
    }
    const positions = pickableChild.geometry?.attributes?.position
    if (!positions || !pickableChild.localToWorld) return

    const getWorldVertex = (vertexIndex: number) =>
      pickableChild.localToWorld(
        new Vector3(
          positions.getX(vertexIndex),
          positions.getY(vertexIndex),
          positions.getZ(vertexIndex)
        )
      )

    const testVertex = (worldVertex: Vector3) => {
      const screenVertex = projectToScreen(worldVertex)
      if (!screenVertex) return
      const distance = getScreenDistance(screenVertex)
      if (distance <= endpointThreshold) {
        updateCandidate({ point: worldVertex.clone(), distance })
      }
    }

    const testSegment = (startIndex: number, endIndex: number) => {
      const worldStart = getWorldVertex(startIndex)
      const worldEnd = getWorldVertex(endIndex)
      const startScreen = projectToScreen(worldStart)
      const endScreen = projectToScreen(worldEnd)
      if (!startScreen || !endScreen) return

      testVertex(worldStart)
      testVertex(worldEnd)

      const closestScreenPoint = closestPointOnSegment(startScreen, endScreen)
      const distance = getScreenDistance(closestScreenPoint)
      if (distance > lineThreshold) return

      const snappedPoint = worldStart.clone().lerp(worldEnd, closestScreenPoint.t)
      updateCandidate({ point: snappedPoint, distance })
    }

    if (pickableChild.isLineSegments) {
      const index = pickableChild.geometry?.index
      if (index) {
        for (let i = 0; i < index.count - 1; i += 2) {
          testSegment(index.getX(i), index.getX(i + 1))
        }
      } else {
        for (let i = 0; i < positions.count - 1; i += 2) {
          testSegment(i, i + 1)
        }
      }
      return
    }

    if (pickableChild.isLine) {
      const index = pickableChild.geometry?.index
      if (index) {
        for (let i = 0; i < index.count - 1; i++) {
          testSegment(index.getX(i), index.getX(i + 1))
        }
      } else {
        for (let i = 0; i < positions.count - 1; i++) {
          testSegment(i, i + 1)
        }
      }
    }
  })

  const intersects = raycaster.intersectObject(currentModel as never, true) as Array<{
    point: Vector3
  }>
  if (intersects[0]) {
    updateCandidate({
      point: intersects[0].point.clone(),
      distance: 6
    })
  }

  const resolvedCandidate = bestCandidate as { point: Vector3; distance: number } | null
  return resolvedCandidate ? resolvedCandidate.point : null
}

const onContainerClick = (e: MouseEvent) => {
  if (!props.calibrateMode) return
  const point = pickPointFromEvent(e)
  if (point) emit('calibrate-pick', point)
}

const onContainerDoubleClick = (e: MouseEvent) => {
  const point = pickPointFromEvent(e)
  if (point) emit('navigate-pick', point)
}

const withResolvedBlobId = async <T>(
  drawing: ViewerSplitScreenDrawing,
  loader: (blobId: string) => Promise<T>
) => {
  try {
    return await loader(drawing.blobId)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const shouldRetry =
      !!drawing.versionId &&
      (message.includes("doesn't exist") || message.includes('NOT_FOUND_ERROR'))

    if (!shouldRetry) throw error

    const file = await api.fetchVersionFile(drawing.versionId)
    if (!file.blobId || file.blobId === drawing.blobId) throw error

    return await loader(file.blobId)
  }
}

const loadDrawing = async (drawing: ViewerSplitScreenDrawing | null) => {
  disposeCurrentModel()
  error.value = null
  progress.value = 0

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }

  if (!drawing) return

  loading.value = true
  progress.value = 15

  try {
    const fileType = drawing.fileType.toLowerCase()
    let model: Group

    if (fileType === 'dxf') {
      const text = await withResolvedBlobId(drawing, (blobId) =>
        api.fetchBlobText(drawing.projectId, blobId)
      )
      progress.value = 70
      model = parseDxfToGroup(text) as Group
    } else {
      const blob = await withResolvedBlobId(drawing, (blobId) =>
        api.fetchBlob(drawing.projectId, blobId)
      )
      progress.value = 55
      currentObjectUrl = URL.createObjectURL(blob)

      if (fileType === 'obj') {
        const obj = await new OBJLoader().loadAsync(currentObjectUrl)
        model = new Group()
        model.add(obj)
      } else if (fileType === 'gltf' || fileType === 'glb') {
        const gltf = await new GLTFLoader().loadAsync(currentObjectUrl)
        model = new Group()
        model.add(gltf.scene)
      } else {
        throw new Error(`暂不支持 ${fileType.toUpperCase()} 文件预览`)
      }
    }

    currentModel = model
    scene.add(model)
    hasModel.value = true
    progress.value = 90
    fitToModel()
    progress.value = 100
    emit('drawing-loaded', drawing.versionId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '图纸加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!canvasRef.value) return

  renderer = new WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: false
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  controls = new OrbitControls(activeCamera, canvasRef.value)
  controls.enableDamping = true
  controls.addEventListener('change', () => {
    emit('controls-change')
  })

  scene.add(new AmbientLight(0xffffff, 1.2))

  const keyLight = new DirectionalLight(0xffffff, 1)
  keyLight.position.set(40, 60, 80)
  scene.add(keyLight)

  const fillLight = new DirectionalLight(0xffffff, 0.6)
  fillLight.position.set(-50, -20, 40)
  scene.add(fillLight)

  resize()
  frameId = requestAnimationFrame(renderLoop)
  void loadDrawing(props.drawing)
  updateMarker(props.markerPoint || null)
  updateProjectedCalibrationMarkers()
})

watch(
  () => props.drawing?.versionId,
  () => {
    void loadDrawing(props.drawing)
  }
)

watch(
  () => props.markerPoint,
  (point) => {
    updateMarker(point || null)
  }
)

watch(
  () => props.calibrationMarkers,
  () => {
    updateProjectedCalibrationMarkers()
  },
  { deep: true }
)

useResizeObserver(containerRef, () => {
  resize()
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
  controls?.dispose()
  renderer?.dispose()
  disposeCurrentModel()
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl)
})

defineExpose({
  getCameraState,
  applyCameraState
})
</script>
