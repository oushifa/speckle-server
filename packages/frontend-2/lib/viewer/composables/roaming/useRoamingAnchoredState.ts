import { ref } from 'vue'
import type { RoamingPoint } from './types'

const activeRoamingPoints = ref<RoamingPoint[]>([])
const selectedRoamingPointIndex = ref<number | null>(null)

export const useRoamingAnchoredState = () => {
  const setPoints = (points: RoamingPoint[]) => {
    activeRoamingPoints.value = points
  }

  const selectPointIndex = (idx: number | null) => {
    selectedRoamingPointIndex.value = idx
  }

  const clear = () => {
    activeRoamingPoints.value = []
    selectedRoamingPointIndex.value = null
  }

  return {
    activeRoamingPoints,
    selectedRoamingPointIndex,
    setPoints,
    selectPointIndex,
    clear
  }
}
