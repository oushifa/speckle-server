import { ensureError } from '@speckle/shared'
import { useAuthCookie } from '~/lib/auth/composables/auth'

export type RvtConversionJobStatus =
  | 'pending'
  | 'dispatched'
  | 'acknowledged'
  | 'succeeded'
  | 'failed'

export type RvtConversionJob = {
  id: string
  projectId: string
  modelId: string
  sourceFileId: string
  sourceFileName: string
  sourceFileSize: number | null
  versionMessage: string | null
  sourceApplication: string | null
  status: RvtConversionJobStatus
  externalTaskId: string | null
  versionId: string | null
  errorMessage: string | null
  dispatchedAt: string | null
  acknowledgedAt: string | null
  finishedAt: string | null
  creator: string
  updater: string
  createdAt: string
  updatedAt: string
}

type UploadUrlResponse = {
  fileId: string
  uploadUrl: string
  expiresAt: string
}

type CreateJobResponse = {
  job: RvtConversionJob
}

type GetJobResponse = {
  job: RvtConversionJob
}

type ListJobsResponse = {
  jobs: RvtConversionJob[]
}

const pollableStatuses = new Set<RvtConversionJobStatus>([
  'pending',
  'dispatched',
  'acknowledged'
])

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export const useRvtConversion = () => {
  const apiOrigin = useApiOrigin()
  const authToken = useAuthCookie()

  const buildHeaders = () => {
    if (!authToken.value) {
      throw new Error('当前未登录，无法上传 RVT 文件。')
    }

    return {
      Authorization: `Bearer ${authToken.value}`
    }
  }

  const requestUploadUrl = async (params: {
    projectId: string
    modelId: string
    file: File
  }): Promise<UploadUrlResponse> => {
    return await $fetch<UploadUrlResponse>(
      `${apiOrigin}/api/v1/projects/${params.projectId}/models/${params.modelId}/rvt/upload-url`,
      {
        method: 'POST',
        headers: buildHeaders(),
        body: {
          fileName: params.file.name,
          fileSize: params.file.size
        }
      }
    )
  }

  const uploadSourceFile = async (params: {
    uploadUrl: string
    file: File
  }): Promise<{ etag: string }> => {
    const uploadResponse = await fetch(params.uploadUrl, {
      method: 'PUT',
      body: params.file
    })

    if (!uploadResponse.ok) {
      throw new Error(`源文件上传失败，状态码 ${uploadResponse.status}`)
    }

    const etag = uploadResponse.headers.get('etag')
    if (!etag) {
      throw new Error('上传完成后未返回 ETag')
    }

    return { etag }
  }

  const createJob = async (params: {
    projectId: string
    modelId: string
    fileId: string
    fileName: string
    etag: string
    versionMessage?: string
    sourceApplication?: string
  }): Promise<RvtConversionJob> => {
    const response = await $fetch<CreateJobResponse>(
      `${apiOrigin}/api/v1/projects/${params.projectId}/models/${params.modelId}/rvt/jobs`,
      {
        method: 'POST',
        headers: buildHeaders(),
        body: {
          fileId: params.fileId,
          fileName: params.fileName,
          etag: params.etag,
          versionMessage: params.versionMessage,
          sourceApplication: params.sourceApplication
        }
      }
    )

    return response.job
  }

  const getJob = async (params: {
    projectId: string
    modelId: string
    jobId: string
  }): Promise<RvtConversionJob> => {
    const response = await $fetch<GetJobResponse>(
      `${apiOrigin}/api/v1/projects/${params.projectId}/models/${params.modelId}/rvt/jobs/${params.jobId}`,
      {
        headers: buildHeaders()
      }
    )

    return response.job
  }

  const listJobs = async (params: {
    projectId: string
    modelId?: string
    unfinishedOnly?: boolean
  }): Promise<RvtConversionJob[]> => {
    const response = await $fetch<ListJobsResponse>(
      `${apiOrigin}/api/v1/projects/${params.projectId}/rvt/jobs`,
      {
        headers: buildHeaders(),
        query: {
          ...(params.modelId ? { modelId: params.modelId } : {}),
          ...(params.unfinishedOnly ? { unfinishedOnly: 'true' } : {})
        }
      }
    )

    return response.jobs
  }

  const waitForJobCompletion = async (params: {
    projectId: string
    modelId: string
    jobId: string
    intervalMs?: number
    timeoutMs?: number
    onUpdate?: (job: RvtConversionJob) => void
  }): Promise<RvtConversionJob> => {
    const intervalMs = params.intervalMs || 3000
    const timeoutMs = params.timeoutMs || 24 * 60 * 60 * 1000
    const startedAt = Date.now()

    let latestJob = await getJob(params)
    params.onUpdate?.(latestJob)

    while (pollableStatuses.has(latestJob.status)) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('等待 RVT 转换结果超时，请稍后在模型列表中查看。')
      }

      await sleep(intervalMs)
      latestJob = await getJob(params)
      params.onUpdate?.(latestJob)
    }

    return latestJob
  }

  return {
    requestUploadUrl,
    uploadSourceFile,
    createJob,
    getJob,
    listJobs,
    waitForJobCompletion,
    getErrorMessage: (error: unknown) => ensureError(error).message
  }
}
