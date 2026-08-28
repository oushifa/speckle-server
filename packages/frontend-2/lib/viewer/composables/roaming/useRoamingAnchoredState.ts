import { ref, computed } from 'vue'
import type { RoamingRoute, RoamingPoint } from './types'

// 共享的当前正在编辑或查看的漫游路线与选中点位
const activeRoute = ref<RoamingRoute | null>(null)
const selectedPointIndex = ref<number | null>(null)
const onPointSelectCallbacks = new Set<(index: number) => void>()

export const useRoamingAnchoredState = () => {
  const setActiveRoute = (route: RoamingRoute | null) => {
    activeRoute.value = route
  }

  const setSelectedPointIndex = (idx: number | null) => {
    selectedPointIndex.value = idx
  }

  const registerPointSelectCallback = (cb: (index: number) => void) => {
    onPointSelectCallbacks.add(cb)
    return () => {
      onPointSelectCallbacks.delete(cb)
    }
  }

  const triggerPointSelect = (index: number) => {
    selectedPointIndex.value = index
    onPointSelectCallbacks.forEach((cb) => cb(index))
  }

  // 兼容辅助方法
  const activeRoamingPoints = computed<RoamingPoint[]>(
    () => activeRoute.value?.points || []
  )
  const selectedRoamingPointIndex = computed(() => selectedPointIndex.value)

  const setPoints = (points: RoamingPoint[]) => {
    if (activeRoute.value) {
      activeRoute.value = {
        ...activeRoute.value,
        points
      }
    }
  }

  const selectPointIndex = (idx: number | null) => {
    selectedPointIndex.value = idx
  }

  const clear = () => {
    activeRoute.value = null
    selectedPointIndex.value = null
  }

  return {
    activeRoute,
    selectedPointIndex,
    activeRoamingPoints,
    selectedRoamingPointIndex,
    setActiveRoute,
    setSelectedPointIndex,
    registerPointSelectCallback,
    triggerPointSelect,
    setPoints,
    selectPointIndex,
    clear
  }
}
