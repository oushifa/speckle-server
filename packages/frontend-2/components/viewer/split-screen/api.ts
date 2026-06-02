import { useAuthCookie } from '~/lib/auth/composables/auth'

export type DrawingsProject = {
  id: string
  name: string
  type: string
}

export type DrawingsModel = {
  id: string
  title: string
  projectId: string
  streamName: string | null
  updateTime: string
  versions: number
  previewUrl: string | null
}

export type DrawingsVersionCursor = {
  id: string
  createdAt: string
}

export type DrawingsVersion = {
  id: string
  message: string | null
  sourceApplication: string | null
  createdAt: string
  referencedObject?: string | null
}

export type DrawingsVersionFile = {
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | null
}

export type SplitScreenDrawingPayload = {
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

export type SplitScreenCameraStatePayload = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  projection: 'perspective' | 'orthographic'
  fov?: number
  zoom?: number
}

export type SplitScreenConfigPayload = {
  id: string
  name: string
  description?: string | null
  drawing: SplitScreenDrawingPayload | null
  splitRatio: number
  transform: Record<string, unknown> | null
  calibrationPoints: unknown[] | null
  cameraState: {
    cad: SplitScreenCameraStatePayload | null
    speckle: SplitScreenCameraStatePayload | null
  } | null
  sectionBox?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export type SaveSplitScreenConfigPayload = {
  name: string
  description?: string | null
  drawing: SplitScreenDrawingPayload
  splitRatio: number
  transform: Record<string, unknown> | null
  calibrationPoints: unknown[] | null
  cameraState: {
    cad: SplitScreenCameraStatePayload | null
    speckle: SplitScreenCameraStatePayload | null
  } | null
  sectionBox?: Record<string, unknown> | null
}

let projectCache: DrawingsProject | null = null

export function useViewerSplitScreenApi() {
  const apiOrigin = useApiOrigin()
  const authCookie = useAuthCookie()

  const request = async <T>(path: string, options?: Parameters<typeof $fetch<T>>[1]) =>
    await $fetch<T>(`${apiOrigin}${path}`, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        ...(authCookie.value ? { Authorization: `Bearer ${authCookie.value}` } : {})
      }
    })

  const getProject = async () => {
    if (projectCache) return projectCache

    const res = await request<{ data: DrawingsProject }>('/api/v1/drawings/project')
    projectCache = res.data
    return projectCache
  }

  const fetchModels = async (params?: {
    search?: string
    page?: number
    pageSize?: number
  }) =>
    await request<{ data: DrawingsModel[]; total?: number }>(
      '/api/v1/drawings/models',
      {
        params: {
          search: params?.search?.trim() || undefined,
          page: params?.page || 1,
          pageSize: params?.pageSize || 20
        }
      }
    )

  const fetchVersions = async (
    modelId: string,
    params?: { limit?: number; cursor?: DrawingsVersionCursor | null }
  ) =>
    await request<{ data: DrawingsVersion[]; cursor: DrawingsVersionCursor | null }>(
      `/api/v1/drawings/models/${modelId}/versions`,
      {
        params: {
          limit: params?.limit || 20,
          cursorId: params?.cursor?.id || undefined,
          cursorCreatedAt: params?.cursor?.createdAt || undefined
        }
      }
    )

  const fetchVersionFile = async (versionId: string) =>
    (
      await request<{ data: DrawingsVersionFile }>(
        `/api/v1/drawings/versions/${versionId}/file`
      )
    ).data

  const fetchBlob = async (projectId: string, blobId: string) => {
    return await request<Blob>(`/api/stream/${projectId}/blob/${blobId}`, {
      method: 'GET',
      responseType: 'blob'
    })
  }

  const fetchBlobText = async (projectId: string, blobId: string) => {
    return await request<string>(`/api/stream/${projectId}/blob/${blobId}`, {
      method: 'GET',
      responseType: 'text'
    })
  }

  const fetchSplitScreenConfigs = async (projectId: string) =>
    (
      await request<{ data: SplitScreenConfigPayload[] }>(
        `/api/projects/${projectId}/split-screen-configs`
      )
    ).data

  const createSplitScreenConfig = async (
    projectId: string,
    payload: SaveSplitScreenConfigPayload
  ) =>
    (
      await request<{ data: SplitScreenConfigPayload }>(
        `/api/projects/${projectId}/split-screen-configs`,
        {
          method: 'POST',
          body: payload
        }
      )
    ).data

  const updateSplitScreenConfig = async (
    projectId: string,
    configId: string,
    payload: SaveSplitScreenConfigPayload
  ) =>
    (
      await request<{ data: SplitScreenConfigPayload }>(
        `/api/projects/${projectId}/split-screen-configs/${configId}`,
        {
          method: 'PUT',
          body: payload
        }
      )
    ).data

  const deleteSplitScreenConfig = async (projectId: string, configId: string) => {
    await request(`/api/projects/${projectId}/split-screen-configs/${configId}`, {
      method: 'DELETE'
    })
  }

  return {
    getProject,
    fetchModels,
    fetchVersions,
    fetchVersionFile,
    fetchSplitScreenConfigs,
    createSplitScreenConfig,
    updateSplitScreenConfig,
    deleteSplitScreenConfig,
    fetchBlob,
    fetchBlobText
  }
}
