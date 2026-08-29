import {
  Group,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Vector3
} from 'three'
import { type IViewer, ObjectLayers, UpdateFlags } from '@speckle/viewer'
import type { RoamingRoute } from './types'

// Speckle 渲染管道中 Overlay 层对应的 layer ID 是 4
const OVERLAY_LAYER = ObjectLayers.OVERLAY ?? 4

export const useRoamingVisualizer = (viewerProvider: () => IViewer | undefined) => {
  let visualizerGroup: Group | null = null

  const getOrCreateGroup = (): Group | null => {
    const viewer = viewerProvider()
    if (!viewer) return null
    const scene = viewer.getRenderer().scene

    if (!visualizerGroup) {
      visualizerGroup = new Group()
      visualizerGroup.name = '__roaming_visualizer__'
      visualizerGroup.layers.set(OVERLAY_LAYER)
      scene.add(visualizerGroup)
    }
    return visualizerGroup
  }

  const clear = () => {
    const viewer = viewerProvider()
    if (visualizerGroup && viewer) {
      visualizerGroup.traverse((child) => {
        if (child instanceof Mesh || child instanceof Line) {
          if (child.geometry) child.geometry.dispose()
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose())
            } else {
              child.material.dispose()
            }
          }
        }
      })
      visualizerGroup.clear()
      viewer.requestRender(UpdateFlags.RENDER_RESET)
    }
  }

  const renderRoute = (
    route: RoamingRoute | null,
    _activePointIndex: number | null = null,
    currentPos: Vector3 | null = null
  ) => {
    const viewer = viewerProvider()
    if (!viewer) return
    const group = getOrCreateGroup()
    if (!group) return

    clear()

    if (!route || !route.points || route.points.length === 0) {
      viewer.requestRender(UpdateFlags.RENDER_RESET)
      return
    }

    let baseScale = 0.2
    try {
      if (viewer.World && viewer.World.worldBox && !viewer.World.worldBox.isEmpty()) {
        const size = viewer.World.worldBox.getSize(new Vector3())
        const maxSize = Math.max(size.x, size.y, size.z)
        if (maxSize > 0) {
          baseScale =
            maxSize > 500
              ? maxSize * 0.003
              : Math.min(0.28, Math.max(0.1, maxSize * 0.004))
        }
      }
    } catch {
      baseScale = 0.2
    }

    const points = route.points

    const linePoints: Vector3[] = []

    points.forEach((pt) => {
      const pos = new Vector3(pt.position[0], pt.position[1], pt.position[2])
      linePoints.push(pos)
    })

    // 1. 绘制三维连线路径
    if (linePoints.length >= 2) {
      if (route.loop && linePoints.length > 2) {
        linePoints.push(linePoints[0].clone())
      }
      const lineGeo = new BufferGeometry().setFromPoints(linePoints)
      const lineMat = new LineBasicMaterial({
        color: 0x00e676,
        linewidth: 2,
        depthTest: false,
        transparent: true,
        opacity: 0.85
      })
      const line = new Line(lineGeo, lineMat)
      line.renderOrder = 996
      line.layers.set(OVERLAY_LAYER)
      group.add(line)
    }

    // 2. 当前正在移动的游标位置（漫游播放时）
    if (currentPos) {
      const cursorGeo = new SphereGeometry(baseScale * 0.75, 16, 16)
      const cursorMat = new MeshBasicMaterial({
        color: 0xffeb3b,
        depthTest: false,
        depthWrite: false
      })
      const cursor = new Mesh(cursorGeo, cursorMat)
      cursor.position.copy(currentPos)
      cursor.renderOrder = 1005
      cursor.layers.set(OVERLAY_LAYER)
      group.add(cursor)
    }

    group.traverse((c) => c.layers.set(OVERLAY_LAYER))
    viewer.requestRender(UpdateFlags.RENDER_RESET)
  }

  const dispose = () => {
    clear()
    const viewer = viewerProvider()
    if (visualizerGroup && viewer) {
      viewer.getRenderer().scene.remove(visualizerGroup)
      visualizerGroup = null
      viewer.requestRender(UpdateFlags.RENDER_RESET)
    }
  }

  return {
    renderRoute,
    clear,
    dispose
  }
}
