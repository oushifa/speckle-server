import { reactive } from 'vue'
import type {
  CalibrationPointPair,
  CoordinateOffset
} from '../../../../components/viewer/split-screen/CoordinateOffset'
import {
  useViewerSplitScreenApi,
  type SaveSplitScreenConfigPayload,
  type SplitScreenConfigPayload
} from '../../../../components/viewer/split-screen/api'
import {
  calcTransformFromCalibrationPoints,
  DEFAULT_OFFSET
} from '../../../../components/viewer/split-screen/CoordinateOffset'

export type ViewerSplitScreenDrawing = {
  projectId: string
  modelId: string
  modelName: string
  versionId: string
  versionCreatedAt: string
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | null
}

export type ViewerSplitScreenConfig = {
  id: string
  name: string
  drawing: ViewerSplitScreenDrawing
  splitRatio: number
  transform: CoordinateOffset
  calibrationPoints: CalibrationPointPair[]
  cameraState: ViewerSplitScreenConfigCameraState | null
  createdAt: string
  updatedAt: string
}

export type ViewerSplitScreenCameraState = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  projection: 'perspective' | 'orthographic'
  fov?: number
  zoom?: number
}

export type ViewerSplitScreenConfigCameraState = {
  cad: ViewerSplitScreenCameraState | null
  speckle: ViewerSplitScreenCameraState | null
}

type EditorMode = 'create' | 'edit'
type CalibrationStep = 'cad' | 'speckle'
type Point3D = { x: number; y: number; z: number }

export const DEFAULT_SPLIT_RATIO = 0.5

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const mapConfigPayload = (
  payload: SplitScreenConfigPayload
): ViewerSplitScreenConfig | null => {
  if (!payload.drawing) return null

  return {
    id: payload.id,
    name: payload.name,
    drawing: payload.drawing,
    splitRatio: payload.splitRatio,
    transform: { ...DEFAULT_OFFSET, ...(payload.transform || {}) } as CoordinateOffset,
    calibrationPoints: Array.isArray(payload.calibrationPoints)
      ? payload.calibrationPoints.map((point) =>
          cloneJson(point as CalibrationPointPair)
        )
      : [],
    cameraState: payload.cameraState
      ? {
          cad: payload.cameraState.cad ? cloneJson(payload.cameraState.cad) : null,
          speckle: payload.cameraState.speckle
            ? cloneJson(payload.cameraState.speckle)
            : null
        }
      : null,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt
  }
}

export const viewerSplitScreenState = reactive({
  enabled: false,
  splitRatio: DEFAULT_SPLIT_RATIO,
  drawing: null as ViewerSplitScreenDrawing | null,
  offset: { ...DEFAULT_OFFSET } as CoordinateOffset,
  highlightedCadPoint: null as Point3D | null,
  cadCameraState: null as ViewerSplitScreenCameraState | null,
  speckleCameraState: null as ViewerSplitScreenCameraState | null,
  cameraRestoreKey: 0,
  configs: [] as ViewerSplitScreenConfig[],
  activeConfigId: null as string | null,
  listLoading: false,
  listLoaded: false,
  editorOpen: false,
  editorMode: 'create' as EditorMode,
  editorSaving: false,
  lastError: null as string | null,
  calibration: {
    active: false,
    awaitingCompletion: false,
    step: 'cad' as CalibrationStep,
    pointIndex: 0,
    points: [] as CalibrationPointPair[],
    pendingCadPoint: null as Point3D | null,
    markers: [] as Array<{
      index: 1 | 2 | 3
      cadPoint?: Point3D
      specklePoint?: Point3D
    }>
  }
})

export function useViewerSplitScreenState() {
  const api = useViewerSplitScreenApi()

  const cancelCalibration = () => {
    viewerSplitScreenState.calibration.active = false
    viewerSplitScreenState.calibration.awaitingCompletion = false
    viewerSplitScreenState.calibration.step = 'cad'
    viewerSplitScreenState.calibration.pointIndex = 0
    viewerSplitScreenState.calibration.points = []
    viewerSplitScreenState.calibration.pendingCadPoint = null
    viewerSplitScreenState.calibration.markers = []
  }

  const resetTransientState = () => {
    viewerSplitScreenState.highlightedCadPoint = null
    viewerSplitScreenState.cadCameraState = null
    viewerSplitScreenState.speckleCameraState = null
    cancelCalibration()
  }

  const setSplitRatio = (ratio: number) => {
    viewerSplitScreenState.splitRatio = Math.min(0.75, Math.max(0.25, ratio))
  }

  const setDrawing = (drawing: ViewerSplitScreenDrawing | null) => {
    viewerSplitScreenState.drawing = drawing
  }

  const setOffset = (offset: CoordinateOffset) => {
    Object.assign(viewerSplitScreenState.offset, { ...DEFAULT_OFFSET, ...offset })
  }

  const setHighlightedCadPoint = (point: Point3D | null) => {
    viewerSplitScreenState.highlightedCadPoint = point
  }

  const setCadCameraState = (camera: ViewerSplitScreenCameraState | null) => {
    viewerSplitScreenState.cadCameraState = camera
  }

  const setSpeckleCameraState = (camera: ViewerSplitScreenCameraState | null) => {
    viewerSplitScreenState.speckleCameraState = camera
  }

  const setListLoading = (loading: boolean) => {
    viewerSplitScreenState.listLoading = loading
  }

  const setLastError = (error: string | null) => {
    viewerSplitScreenState.lastError = error
  }

  const loadConfigs = async (projectId: string) => {
    setListLoading(true)
    try {
      const configs = await api.fetchSplitScreenConfigs(projectId)
      viewerSplitScreenState.configs = configs
        .map((item) => mapConfigPayload(item))
        .filter((item): item is ViewerSplitScreenConfig => !!item)
      viewerSplitScreenState.listLoaded = true
      setLastError(null)
    } catch (error) {
      setLastError(error instanceof Error ? error.message : '读取已保存关联失败')
    } finally {
      setListLoading(false)
    }
  }

  const applyConfig = (config: ViewerSplitScreenConfig | null) => {
    cancelCalibration()
    viewerSplitScreenState.activeConfigId = config?.id || null
    setDrawing(config?.drawing || null)
    viewerSplitScreenState.splitRatio = config?.splitRatio ?? DEFAULT_SPLIT_RATIO
    setOffset(config?.transform || DEFAULT_OFFSET)
    viewerSplitScreenState.calibration.points = config?.calibrationPoints
      ? config.calibrationPoints.map((point) => ({
          index: point.index,
          cad: { ...point.cad },
          speckle: { ...point.speckle }
        }))
      : []
    viewerSplitScreenState.highlightedCadPoint = config?.calibrationPoints?.length
      ? {
          ...config.calibrationPoints[config.calibrationPoints.length - 1].cad
        }
      : null
    if (config?.drawing) {
      viewerSplitScreenState.cadCameraState = config?.cameraState?.cad || null
      viewerSplitScreenState.speckleCameraState = config?.cameraState?.speckle || null
      viewerSplitScreenState.cameraRestoreKey += 1
      viewerSplitScreenState.enabled = true
    }
  }

  const upsertConfig = async (
    projectId: string,
    input: {
      id?: string
      name: string
      drawing: ViewerSplitScreenDrawing
      splitRatio: number
      transform: CoordinateOffset
      calibrationPoints: CalibrationPointPair[]
      cameraState: ViewerSplitScreenConfigCameraState | null
    }
  ) => {
    const payload: SaveSplitScreenConfigPayload = {
      name: input.name.trim() || '分屏关联',
      drawing: cloneJson(input.drawing),
      splitRatio: input.splitRatio,
      transform: cloneJson(input.transform) as unknown as Record<string, unknown>,
      calibrationPoints: input.calibrationPoints.map((point) => cloneJson(point)),
      cameraState: input.cameraState
        ? {
            cad: input.cameraState.cad ? cloneJson(input.cameraState.cad) : null,
            speckle: input.cameraState.speckle
              ? cloneJson(input.cameraState.speckle)
              : null
          }
        : null,
      sectionBox: null
    }

    const savedPayload = input.id
      ? await api.updateSplitScreenConfig(projectId, input.id, payload)
      : await api.createSplitScreenConfig(projectId, payload)

    const nextConfig = mapConfigPayload(savedPayload)
    if (!nextConfig) {
      throw new Error('保存的分屏关联缺少图纸信息')
    }

    viewerSplitScreenState.configs = [
      nextConfig,
      ...viewerSplitScreenState.configs.filter((item) => item.id !== nextConfig.id)
    ]
    return nextConfig
  }

  const removeConfig = async (projectId: string, configId: string) => {
    await api.deleteSplitScreenConfig(projectId, configId)
    viewerSplitScreenState.configs = viewerSplitScreenState.configs.filter(
      (item) => item.id !== configId
    )
    if (viewerSplitScreenState.activeConfigId === configId) {
      viewerSplitScreenState.activeConfigId = null
      viewerSplitScreenState.enabled = false
      viewerSplitScreenState.drawing = null
      viewerSplitScreenState.splitRatio = DEFAULT_SPLIT_RATIO
    }
  }

  const openEditor = (mode: EditorMode, configId?: string | null) => {
    viewerSplitScreenState.editorMode = mode
    viewerSplitScreenState.editorOpen = true
    if (configId) {
      viewerSplitScreenState.activeConfigId = configId
    }
  }

  const closeEditor = () => {
    viewerSplitScreenState.editorOpen = false
    cancelCalibration()
  }

  const setEditorSaving = (saving: boolean) => {
    viewerSplitScreenState.editorSaving = saving
  }

  const findConfigById = (configId: string | null) =>
    viewerSplitScreenState.configs.find((item) => item.id === configId) || null

  const enable = (drawing?: ViewerSplitScreenDrawing | null) => {
    if (drawing) {
      setDrawing(drawing)
    }
    if (viewerSplitScreenState.drawing) {
      viewerSplitScreenState.enabled = true
    }
  }

  const disable = () => {
    viewerSplitScreenState.enabled = false
    resetTransientState()
  }

  const startCalibration = () => {
    viewerSplitScreenState.highlightedCadPoint = null
    viewerSplitScreenState.calibration.active = true
    viewerSplitScreenState.calibration.awaitingCompletion = false
    viewerSplitScreenState.calibration.step = 'cad'
    viewerSplitScreenState.calibration.pointIndex = 0
    viewerSplitScreenState.calibration.points = []
    viewerSplitScreenState.calibration.pendingCadPoint = null
    viewerSplitScreenState.calibration.markers = []
    setOffset(DEFAULT_OFFSET)
  }

  const setCalibrationCadPoint = (point: Point3D) => {
    const markerIndex = (viewerSplitScreenState.calibration.pointIndex + 1) as 1 | 2 | 3
    viewerSplitScreenState.calibration.pendingCadPoint = point
    viewerSplitScreenState.calibration.step = 'speckle'
    viewerSplitScreenState.calibration.markers = [
      ...viewerSplitScreenState.calibration.markers.filter(
        (item) => item.index !== markerIndex
      ),
      { index: markerIndex, cadPoint: { ...point } }
    ].sort((a, b) => a.index - b.index)
  }

  const setCalibrationSpecklePoint = (point: Point3D) => {
    const pendingCadPoint = viewerSplitScreenState.calibration.pendingCadPoint
    if (!pendingCadPoint) return

    const nextPointIndex = viewerSplitScreenState.calibration.pointIndex + 1
    const nextPoints: CalibrationPointPair[] = [
      ...viewerSplitScreenState.calibration.points,
      {
        index: nextPointIndex as 1 | 2 | 3,
        cad: { ...pendingCadPoint },
        speckle: { ...point }
      }
    ]

    viewerSplitScreenState.calibration.points = nextPoints
    viewerSplitScreenState.calibration.pendingCadPoint = null
    viewerSplitScreenState.calibration.markers =
      viewerSplitScreenState.calibration.markers
        .map((item) =>
          item.index === nextPointIndex ? { ...item, specklePoint: { ...point } } : item
        )
        .sort((a, b) => a.index - b.index)

    if (nextPoints.length >= 3) {
      setOffset(calcTransformFromCalibrationPoints(nextPoints))
      viewerSplitScreenState.calibration.active = false
      viewerSplitScreenState.calibration.awaitingCompletion = true
      viewerSplitScreenState.calibration.step = 'cad'
      viewerSplitScreenState.calibration.pointIndex = nextPoints.length
      return
    }

    viewerSplitScreenState.calibration.pointIndex = nextPoints.length
    viewerSplitScreenState.calibration.step = 'cad'
  }

  const finishCalibration = () => {
    if (viewerSplitScreenState.calibration.points.length < 3) return

    viewerSplitScreenState.calibration.active = false
    viewerSplitScreenState.calibration.awaitingCompletion = false
    viewerSplitScreenState.calibration.pendingCadPoint = null
    viewerSplitScreenState.calibration.markers = []
    const lastPoint =
      viewerSplitScreenState.calibration.points[
        viewerSplitScreenState.calibration.points.length - 1
      ]
    viewerSplitScreenState.highlightedCadPoint = lastPoint ? { ...lastPoint.cad } : null
  }

  const reset = () => {
    viewerSplitScreenState.enabled = false
    viewerSplitScreenState.splitRatio = DEFAULT_SPLIT_RATIO
    viewerSplitScreenState.drawing = null
    setOffset(DEFAULT_OFFSET)
    viewerSplitScreenState.cadCameraState = null
    viewerSplitScreenState.speckleCameraState = null
    viewerSplitScreenState.activeConfigId = null
    viewerSplitScreenState.editorOpen = false
    viewerSplitScreenState.editorMode = 'create'
    viewerSplitScreenState.editorSaving = false
    viewerSplitScreenState.lastError = null
    resetTransientState()
  }

  return {
    state: viewerSplitScreenState,
    setSplitRatio,
    setDrawing,
    setOffset,
    setHighlightedCadPoint,
    setCadCameraState,
    setSpeckleCameraState,
    setListLoading,
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
    setCalibrationCadPoint,
    setCalibrationSpecklePoint,
    enable,
    disable,
    reset
  }
}
