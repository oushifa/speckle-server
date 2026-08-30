import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useInjectedViewerState } from '~/lib/viewer/composables/setup'
import type { RoamingRoute } from './types'
import { useRoamingApi } from './api'

const STORAGE_PREFIX = 'speckle_roaming_routes_'

export const useRoamingStorage = () => {
  const logger = useLogger()
  const route = useRoute()
  const state = useInjectedViewerState()
  const projectId = computed(() => state.projectId.value)

  // 获取当前正在查看的模型 ID，优先从已加载资源模型列表中提取，兜底从路由参数解析
  const currentModelId = computed(() => {
    const models = state.resources?.response?.modelsAndVersionIds?.value
    if (models && models.length > 0) {
      return models[0].model.id
    }
    const rawModelId = route.params.modelId as string | undefined
    if (rawModelId && typeof rawModelId === 'string') {
      return rawModelId.split(',')[0].split('@')[0]
    }
    return null
  })

  const api = useRoamingApi()

  const storageKey = computed(
    () =>
      `${STORAGE_PREFIX}${projectId.value || 'default'}_${
        currentModelId.value || 'all'
      }`
  )

  const routes = ref<RoamingRoute[]>([])
  const isLoaded = ref(false)
  const isLoading = ref(false)

  // 1. 从后端加载漫游列表，并备份到本地缓存（按当前 modelId 过滤）
  const loadRoutes = async () => {
    if (!import.meta.client || !projectId.value) return
    isLoading.value = true

    // 先加载本地缓存以秒开
    try {
      const raw = localStorage.getItem(storageKey.value)
      if (raw) {
        routes.value = JSON.parse(raw)
      } else {
        routes.value = []
      }
    } catch (e) {
      logger.error('Failed to load roaming routes from localStorage cache:', e)
    }

    try {
      const serverRoutes = await api.fetchRoamingRoutes(
        projectId.value,
        currentModelId.value || undefined
      )
      routes.value = serverRoutes
      localStorage.setItem(storageKey.value, JSON.stringify(serverRoutes))
    } catch (e) {
      logger.warn('Failed to load roaming routes from server, using local cache:', e)
    } finally {
      isLoading.value = false
      isLoaded.value = true
    }
  }

  // 2. 新增漫游路线（关联当前 modelId）
  const addRoute = async (
    routeData: Omit<RoamingRoute, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!projectId.value) return null
    const payload = {
      ...routeData,
      modelId: routeData.modelId || currentModelId.value || null
    }

    try {
      const created = await api.createRoamingRoute(projectId.value, payload)
      routes.value.unshift(created)
      localStorage.setItem(storageKey.value, JSON.stringify(routes.value))
      return created
    } catch (e) {
      logger.error('Failed to create roaming route on server, fallback local:', e)
      // 本地兜底
      const localRoute: RoamingRoute = {
        ...payload,
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

  // 监听项目或当前模型切换自动重载
  watch(
    [projectId, currentModelId],
    ([newProjectId]) => {
      if (newProjectId) {
        loadRoutes()
      }
    },
    { immediate: true }
  )

  return {
    routes,
    isLoaded,
    isLoading,
    currentModelId,
    loadRoutes,
    addRoute,
    updateRoute,
    deleteRoute,
    getRouteById
  }
}
