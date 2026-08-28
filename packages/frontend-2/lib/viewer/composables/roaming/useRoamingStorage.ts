import { ref, computed, watch } from 'vue'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'
import type { RoamingRoute } from './types'
import { useRoamingApi } from './api'

const STORAGE_PREFIX = 'speckle_roaming_routes_'

export const useRoamingStorage = () => {
  const logger = useLogger()
  const state = useInjectedViewerState()
  const projectId = computed(() => state.projectId.value)
  const api = useRoamingApi()

  const storageKey = computed(() => `${STORAGE_PREFIX}${projectId.value || 'default'}`)

  const routes = ref<RoamingRoute[]>([])
  const isLoaded = ref(false)
  const isLoading = ref(false)

  // 1. 从后端加载漫游列表，并备份到本地缓存
  const loadRoutes = async () => {
    if (!import.meta.client || !projectId.value) return
    isLoading.value = true

    // 先加载本地缓存以秒开
    try {
      const raw = localStorage.getItem(storageKey.value)
      if (raw) {
        routes.value = JSON.parse(raw)
      }
    } catch (e) {
      logger.error('Failed to load roaming routes from localStorage cache:', e)
    }

    try {
      const serverRoutes = await api.fetchRoamingRoutes(projectId.value)
      routes.value = serverRoutes
      localStorage.setItem(storageKey.value, JSON.stringify(serverRoutes))
    } catch (e) {
      logger.warn('Failed to load roaming routes from server, using local cache:', e)
    } finally {
      isLoading.value = false
      isLoaded.value = true
    }
  }

  // 2. 新增漫游路线（调用后端 REST API，并同步到本地）
  const addRoute = async (
    routeData: Omit<RoamingRoute, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!projectId.value) return null
    try {
      const created = await api.createRoamingRoute(projectId.value, routeData)
      routes.value.unshift(created)
      localStorage.setItem(storageKey.value, JSON.stringify(routes.value))
      return created
    } catch (e) {
      logger.error('Failed to create roaming route on server, fallback local:', e)
      // 本地兜底
      const localRoute: RoamingRoute = {
        ...routeData,
        id: `roam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      routes.value.unshift(localRoute)
      localStorage.setItem(storageKey.value, JSON.stringify(routes.value))
      return localRoute
    }
  }

  // 3. 更新漫游路线
  const updateRoute = async (
    id: string,
    updates: Partial<Omit<RoamingRoute, 'id' | 'createdAt'>>
  ) => {
    if (!projectId.value) return null
    try {
      const updated = await api.updateRoamingRoute(projectId.value, id, updates)
      const idx = routes.value.findIndex((r) => r.id === id)
      if (idx !== -1) {
        routes.value[idx] = updated
      }
      localStorage.setItem(storageKey.value, JSON.stringify(routes.value))
      return updated
    } catch (e) {
      logger.error('Failed to update roaming route on server, fallback local:', e)
      const idx = routes.value.findIndex((r) => r.id === id)
      if (idx !== -1) {
        routes.value[idx] = {
          ...routes.value[idx],
          ...updates,
          updatedAt: Date.now()
        }
        localStorage.setItem(storageKey.value, JSON.stringify(routes.value))
        return routes.value[idx]
      }
      return null
    }
  }

  // 4. 删除漫游路线
  const deleteRoute = async (id: string) => {
    if (!projectId.value) return false
    try {
      await api.deleteRoamingRoute(projectId.value, id)
    } catch (e) {
      logger.error('Failed to delete roaming route on server:', e)
    }

    const idx = routes.value.findIndex((r) => r.id === id)
    if (idx !== -1) {
      routes.value.splice(idx, 1)
      localStorage.setItem(storageKey.value, JSON.stringify(routes.value))
      return true
    }
    return false
  }

  const getRouteById = (id: string) => {
    return routes.value.find((r) => r.id === id) || null
  }

  // 监听项目切换自动重载
  watch(
    projectId,
    (newId) => {
      if (newId) {
        loadRoutes()
      }
    },
    { immediate: true }
  )

  return {
    routes,
    isLoaded,
    isLoading,
    loadRoutes,
    addRoute,
    updateRoute,
    deleteRoute,
    getRouteById
  }
}
