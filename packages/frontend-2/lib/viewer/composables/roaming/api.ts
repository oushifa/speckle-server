import { useAuthCookie } from '~/lib/auth/composables/auth'
import type { RoamingRoute } from './types'

export const useRoamingApi = () => {
  const authCookie = useAuthCookie()
  const apiOrigin = useApiOrigin()

  const request = async <T>(path: string, options?: Parameters<typeof $fetch>[1]) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) || {})
    }
    if (authCookie.value) {
      headers['Authorization'] = `Bearer ${authCookie.value}`
    }

    return await $fetch<T>(`${apiOrigin}${path}`, {
      ...options,
      headers
    })
  }

  // 获取项目的漫游路线列表
  const fetchRoamingRoutes = async (projectId: string): Promise<RoamingRoute[]> => {
    const res = await request<{ data: RoamingRoute[] }>(
      `/api/v1/projects/${projectId}/roaming/routes`
    )
    return res.data || []
  }

  // 获取单条漫游路线详情
  const fetchRoamingRouteDetail = async (
    projectId: string,
    routeId: string
  ): Promise<RoamingRoute | null> => {
    const res = await request<{ data: RoamingRoute }>(
      `/api/v1/projects/${projectId}/roaming/routes/${routeId}`
    )
    return res.data || null
  }

  // 创建漫游路线
  const createRoamingRoute = async (
    projectId: string,
    payload: Omit<RoamingRoute, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<RoamingRoute> => {
    const res = await request<{ data: RoamingRoute }>(
      `/api/v1/projects/${projectId}/roaming/routes`,
      {
        method: 'POST',
        body: payload
      }
    )
    return res.data
  }

  // 更新漫游路线
  const updateRoamingRoute = async (
    projectId: string,
    routeId: string,
    payload: Partial<Omit<RoamingRoute, 'id' | 'createdAt'>>
  ): Promise<RoamingRoute> => {
    const res = await request<{ data: RoamingRoute }>(
      `/api/v1/projects/${projectId}/roaming/routes/${routeId}`,
      {
        method: 'PUT',
        body: payload
      }
    )
    return res.data
  }

  // 删除漫游路线
  const deleteRoamingRoute = async (
    projectId: string,
    routeId: string
  ): Promise<void> => {
    await request(`/api/v1/projects/${projectId}/roaming/routes/${routeId}`, {
      method: 'DELETE'
    })
  }

  return {
    fetchRoamingRoutes,
    fetchRoamingRouteDetail,
    createRoamingRoute,
    updateRoamingRoute,
    deleteRoamingRoute
  }
}
