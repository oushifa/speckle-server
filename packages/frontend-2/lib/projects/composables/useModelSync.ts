import { ensureError } from '@speckle/shared'
import { useAuthCookie } from '~/lib/auth/composables/auth'

export type ModelSyncTaskStatus =
  | 'waiting_upload'
  | 'speckle_converting'
  | 'syncing_dtp_model'
  | 'syncing_external_ids'
  | 'triggering_model_transform'
  | 'polling_model_transform'
  | 'succeeded'
  | 'failed'

export type ModelSyncTask = {
  id: string
  projectId: string
  modelId: string
  fileId: string | null
  fileUploadId: string | null
  versionId: string | null
  fileName: string
  fileType: string | null
  fileSize: number | null
  status: ModelSyncTaskStatus
  seedId: string | null
  assetId: string | null
  assetName: string | null
  transformTaskId: string | null
  error: string | null
  errorCode: string | null
  retriable: boolean
  retryCount: number
  creator: string
  updater: string
  createdAt: string
  updatedAt: string
}

type ModelSyncTaskResponse = {
  data: ModelSyncTask
}

type ModelSyncTasksResponse = {
  data: ModelSyncTask[]
}

type CreateUploadTaskResponse = {
  data: ModelSyncTask
  upload: {
    fileId: string
    uploadUrl: string
  }
}

const activeStatuses = new Set<ModelSyncTaskStatus>([
  'waiting_upload',
  'speckle_converting',
  'syncing_dtp_model',
  'syncing_external_ids',
  'triggering_model_transform',
  'polling_model_transform'
])

const terminalStatuses = new Set<ModelSyncTaskStatus>(['succeeded', 'failed'])

const taskStatusMeta: Record<
  ModelSyncTaskStatus,
  { label: string; description: string; progress: number }
> = {
  waiting_upload: {
    label: '等待上传',
    description: '等待文件上传完成后开始处理',
    progress: 5
  },
  speckle_converting: {
    label: 'Speckle 转换中',
    description: '正在将 RVT 转换为 Speckle 版本',
    progress: 35
  },
  syncing_dtp_model: {
    label: '同步 DTP 模型',
    description: '正在上传模型文件到 DTP',
    progress: 55
  },
  syncing_external_ids: {
    label: '同步外部 ID',
    description: '正在回写 DTP 标识到版本信息',
    progress: 72
  },
  triggering_model_transform: {
    label: '触发模型转换',
    description: '正在向 DTP 发起模型转换任务',
    progress: 85
  },
  polling_model_transform: {
    label: '等待模型转换',
    description: '正在等待 DTP 模型转换完成',
    progress: 93
  },
  succeeded: {
    label: '同步完成',
    description: '模型转换和同步都已完成',
    progress: 100
  },
  failed: {
    label: '同步失败',
    description: '模型同步未完成，请查看错误原因',
    progress: 100
  }
}

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export const useModelSync = () => {
  const apiOrigin = useApiOrigin()
  const authToken = useAuthCookie()

  const buildHeaders = () => {
    if (!authToken.value) {
      throw new Error('当前未登录，无法执行模型同步。')
    }

    return {
      Authorization: `Bearer ${authToken.value}`
    }
  }

  const createUploadTask = async (params: {
    projectId: string
    modelId: string
    fileName: string
  }) => {
    return await $fetch<CreateUploadTaskResponse>(
      `${apiOrigin}/api/v1/projects/${params.projectId}/models/${params.modelId}/model-sync/tasks`,
      {
        method: 'POST',
        headers: buildHeaders(),
        body: {
          mode: 'upload',
          fileName: params.fileName
        }
      }
    )
  }

  const uploadTaskFile = async (params: {
    uploadUrl: string
    file: File
    onProgress?: (progress: number) => void
  }) =>
    await new Promise<{ etag: string }>((resolve, reject) => {
      const req = new XMLHttpRequest()
      req.open('PUT', params.uploadUrl)

      req.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return
        const progress = Math.min(
          100,
          Math.max(0, Math.floor((event.loaded / event.total) * 100))
        )
        params.onProgress?.(progress)
      })

      req.addEventListener('load', () => {
        if (req.status < 200 || req.status >= 300) {
          return reject(new Error(`模型源文件上传失败，状态码 ${req.status}`))
        }

        const etag = req.getResponseHeader('etag')
        if (!etag) {
          return reject(new Error('上传完成后未返回 ETag'))
        }

        params.onProgress?.(100)
        resolve({ etag })
      })

      req.addEventListener('error', () => {
        reject(new Error('模型源文件上传失败，请检查网络后重试'))
      })

      req.send(params.file)
    })

  const completeUpload = async (params: {
    projectId: string
    modelId: string
    taskId: string
    etag: string
  }) =>
    await $fetch<ModelSyncTaskResponse>(
      `${apiOrigin}/api/v1/projects/${params.projectId}/models/${params.modelId}/model-sync/tasks/${params.taskId}/complete-upload`,
      {
        method: 'POST',
        headers: buildHeaders(),
        body: {
          etag: params.etag
        }
      }
    )

  const getTask = async (params: {
    projectId: string
    modelId: string
    taskId: string
  }) =>
    (
      await $fetch<ModelSyncTaskResponse>(
        `${apiOrigin}/api/v1/projects/${params.projectId}/models/${params.modelId}/model-sync/tasks/${params.taskId}`,
        {
          headers: buildHeaders()
        }
      )
    ).data

  const listTasks = async (params: { projectId: string; modelId: string }) =>
    (
      await $fetch<ModelSyncTasksResponse>(
        `${apiOrigin}/api/v1/projects/${params.projectId}/models/${params.modelId}/model-sync/tasks`,
        {
          headers: buildHeaders()
        }
      )
    ).data

  const listActiveTasks = async (params: { projectId: string }) =>
    (
      await $fetch<ModelSyncTasksResponse>(
        `${apiOrigin}/api/v1/projects/${params.projectId}/model-sync/tasks`,
        {
          headers: buildHeaders(),
          query: {
            status: 'active'
          }
        }
      )
    ).data

  const retryTask = async (params: {
    projectId: string
    modelId: string
    taskId: string
  }) =>
    (
      await $fetch<ModelSyncTaskResponse>(
        `${apiOrigin}/api/v1/projects/${params.projectId}/models/${params.modelId}/model-sync/tasks/${params.taskId}/retry`,
        {
          method: 'POST',
          headers: buildHeaders()
        }
      )
    ).data

  const waitForTask = async (params: {
    projectId: string
    modelId: string
    taskId: string
    intervalMs?: number
    timeoutMs?: number
    onUpdate?: (task: ModelSyncTask) => void
  }) => {
    const intervalMs = params.intervalMs || 2500
    const timeoutMs = params.timeoutMs || 30 * 60 * 1000
    const startedAt = Date.now()

    let task = await getTask(params)
    params.onUpdate?.(task)

    while (!terminalStatuses.has(task.status)) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('等待模型同步完成超时，请稍后在上传记录中查看。')
      }

      await sleep(intervalMs)
      task = await getTask(params)
      params.onUpdate?.(task)
    }

    return task
  }

  const getTaskStatusMeta = (status: ModelSyncTaskStatus) => taskStatusMeta[status]

  const getTaskStatusText = (task: ModelSyncTask) => {
    const meta = getTaskStatusMeta(task.status)
    if (task.status === 'failed' && task.error) {
      return `${meta.label}: ${task.error}`
    }

    return meta.description
  }

  return {
    createUploadTask,
    uploadTaskFile,
    completeUpload,
    getTask,
    listTasks,
    listActiveTasks,
    retryTask,
    waitForTask,
    isTaskActive: (status: ModelSyncTaskStatus) => activeStatuses.has(status),
    isTaskTerminal: (status: ModelSyncTaskStatus) => terminalStatuses.has(status),
    getTaskStatusMeta,
    getTaskStatusText,
    getErrorMessage: (error: unknown) => ensureError(error).message
  }
}
