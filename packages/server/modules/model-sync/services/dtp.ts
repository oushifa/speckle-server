import {
  THIRD_PARTY_API_BASE,
  THIRD_PARTY_STATIC_BASE,
  convertSpeckleTokenToThirdParty
} from '@/modules/auth/services/thirdPartyToken'
import { ModelSyncTaskError } from '@/modules/model-sync/services/errors'
import { BadRequestError } from '@/modules/shared/errors'

const DTP_MIN_NON_LAST_CHUNK_SIZE = 8 * 1024 * 1024
const DTP_MAX_NON_LAST_CHUNK_SIZE = 10 * 1024 * 1024
const DTP_TARGET_NON_LAST_CHUNK_SIZE = 9 * 1024 * 1024
const MODEL_TRANSFORM_API_VERSION = '2.3.0'

type DtpUploadConfig = {
  uploadUrl: string
  uploadPathPrefix: string
  uploadToken: string
}

export type DtpUploadResult = {
  assetId: string
  seedId: string
  assetName: string
}

type ModelTransformResponse = {
  success?: boolean
  msg?: string
  messages?: string
  results?: {
    taskId?: string
  }
  result?: {
    taskId?: string
    status?: string
  }
}

const buildAssetName = (fileName: string) =>
  fileName.replace(/\.[^/.]+$/, '') || fileName

const resolveChunkPlan = (fileSize: number) => {
  if (fileSize <= DTP_MAX_NON_LAST_CHUNK_SIZE) {
    return [
      {
        part: 0,
        start: 0,
        end: fileSize,
        lastChunk: true,
        totalPart: 1
      }
    ]
  }

  const sizes: number[] = []
  let remaining = fileSize

  while (remaining > DTP_MAX_NON_LAST_CHUNK_SIZE) {
    sizes.push(DTP_TARGET_NON_LAST_CHUNK_SIZE)
    remaining -= DTP_TARGET_NON_LAST_CHUNK_SIZE
  }

  sizes.push(remaining)

  if (
    sizes.length > 1 &&
    sizes
      .slice(0, -1)
      .some(
        (size) =>
          size <= DTP_MIN_NON_LAST_CHUNK_SIZE || size >= DTP_MAX_NON_LAST_CHUNK_SIZE
      )
  ) {
    throw new BadRequestError('DTP 分片大小不满足要求')
  }

  let offset = 0
  return sizes.map((size, part) => {
    const start = offset
    const end = start + size
    offset = end

    return {
      part,
      start,
      end,
      lastChunk: part === sizes.length - 1,
      totalPart: sizes.length
    }
  })
}

const ensureLeadingSlash = (value: string) =>
  value.startsWith('/') ? value : `/${value}`

const resolveStaticUrl = (path: string) =>
  path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${THIRD_PARTY_STATIC_BASE}${ensureLeadingSlash(path)}`

export const loginToDtpFactory =
  () =>
  async (mobile: string): Promise<string> => {
    const result = await convertSpeckleTokenToThirdParty(mobile)
    const token = result.results.tokens[0]
    if (!token) {
      throw new ModelSyncTaskError('DTP_AUTH_FAILED', '获取 DTP token 失败', false)
    }
    return token
  }

export const getDtpUploadConfigFactory =
  () =>
  async (token: string): Promise<DtpUploadConfig> => {
    let response: Response
    try {
      response = await fetch(`${THIRD_PARTY_API_BASE}/v1/asset/model/upload/config`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
    } catch (error) {
      throw new ModelSyncTaskError(
        'DTP_UPLOAD_REQUEST_FAILED',
        '获取中海上传配置失败',
        true,
        { cause: error }
      )
    }

    if (!response.ok) {
      throw new ModelSyncTaskError(
        'DTP_UPLOAD_CONFIG_FAILED',
        `获取中海上传配置失败 (${response.status})`,
        response.status >= 500
      )
    }

    const body = (await response.json()) as {
      results?: Partial<DtpUploadConfig> & { uploadUrlV2?: string }
      result?: Partial<DtpUploadConfig> & { uploadUrlV2?: string }
    }
    const result = body.results || body.result
    const uploadUrl = result?.uploadUrlV2 || result?.uploadUrl
    const uploadPathPrefix = result?.uploadPathPrefix
    const uploadToken = result?.uploadToken

    if (!uploadUrl || !uploadPathPrefix || !uploadToken) {
      throw new ModelSyncTaskError('DTP_UPLOAD_CONFIG_FAILED', '中海上传配置不完整', false)
    }

    return {
      uploadUrl,
      uploadPathPrefix,
      uploadToken
    }
  }

export const uploadBufferToDtpFactory =
  (deps: {
    loginToDtp: ReturnType<typeof loginToDtpFactory>
    getDtpUploadConfig: ReturnType<typeof getDtpUploadConfigFactory>
  }) =>
  async (params: {
    mobile: string
    fileName: string
    buffer: Buffer
  }): Promise<DtpUploadResult> => {
    const token = await deps.loginToDtp(params.mobile)
    const { uploadUrl, uploadPathPrefix, uploadToken } =
      await deps.getDtpUploadConfig(token)
    const chunkPlan = resolveChunkPlan(params.buffer.length)
    const assetName = buildAssetName(params.fileName)
    const path = `${uploadPathPrefix}${params.fileName}`

    let finalResult: DtpUploadResult | null = null

    for (const chunkMeta of chunkPlan) {
      const chunk = params.buffer.subarray(chunkMeta.start, chunkMeta.end)
      const formData = new FormData()
      formData.append('path', path)
      formData.append('size', String(chunk.length))
      formData.append('totalSize', String(params.buffer.length))
      formData.append('offset', String(chunkMeta.start))
      formData.append('totalPart', String(chunkMeta.totalPart))
      formData.append('part', String(chunkMeta.part))
      formData.append('lastChunk', String(chunkMeta.lastChunk))
      formData.append(
        'file',
        new Blob([chunk], { type: 'application/octet-stream' }),
        params.fileName
      )
      formData.append('assetName', assetName)
      formData.append('folderId', '')

      const response = await fetch(resolveStaticUrl(uploadUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${uploadToken}`
        },
        body: formData
      }).catch((error) => {
        throw new ModelSyncTaskError('DTP_UPLOAD_REQUEST_FAILED', '上传中海模型失败', true, {
          cause: error
        })
      })

      if (!response.ok) {
        throw new ModelSyncTaskError(
          'DTP_UPLOAD_FAILED',
          `上传中海模型失败 (${response.status})`,
          response.status >= 500
        )
      }

      const body = (await response.json()) as {
        result?: Partial<DtpUploadResult>
      }

      if (chunkMeta.lastChunk) {
        const assetId = body.result?.assetId
        const seedId = body.result?.seedId
        const returnedAssetName = body.result?.assetName
        if (!assetId || !seedId || !returnedAssetName) {
          throw new ModelSyncTaskError(
            'DTP_UPLOAD_RESULT_INVALID',
            '中海上传成功，但未返回完整标识',
            false
          )
        }

        finalResult = {
          assetId,
          seedId,
          assetName: returnedAssetName
        }
      }
    }

    if (!finalResult) {
      throw new ModelSyncTaskError('DTP_UPLOAD_RESULT_INVALID', '中海上传未返回最终结果', false)
    }

    return finalResult
  }

export const triggerDtpModelTransformFactory =
  () =>
  async (params: {
    mobile: string
    assetId: string
    assetName: string
  }): Promise<string> => {
    const token = await loginToDtpFactory()(params.mobile)
    const response = await fetch(`${THIRD_PARTY_API_BASE}/v1/asset/model/transform`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        assetId: params.assetId,
        assetName: params.assetName,
        apiVersion: MODEL_TRANSFORM_API_VERSION
      })
    }).catch((error) => {
      throw new ModelSyncTaskError('DTP_UPLOAD_REQUEST_FAILED', '触发中海模型转换失败', true, {
        cause: error
      })
    })

    if (!response.ok) {
      throw new ModelSyncTaskError(
        'DTP_TRANSFORM_TRIGGER_FAILED',
        `触发中海模型转换失败 (${response.status})`,
        response.status >= 500
      )
    }

    const body = (await response.json()) as ModelTransformResponse
    const taskId = body.results?.taskId || body.result?.taskId
    if (!body.success || !taskId) {
      throw new ModelSyncTaskError(
        'DTP_TRANSFORM_TRIGGER_FAILED',
        body.msg || body.messages || '触发中海模型转换失败',
        false
      )
    }

    return taskId
  }

export const pollDtpModelTransformUntilFinishedFactory =
  () =>
  async (params: {
    mobile: string
    transformTaskId: string
    waitMs?: number
    maxAttempts?: number
  }) => {
    const token = await loginToDtpFactory()(params.mobile)
    const waitMs = params.waitMs || 10000
    const maxAttempts = params.maxAttempts || 180

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(
        `${THIRD_PARTY_API_BASE}/v1/daas/pipeline/task/${params.transformTaskId}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      ).catch((error) => {
        throw new ModelSyncTaskError(
          'DTP_TRANSFORM_STATUS_FAILED',
          '查询中海模型转换状态失败',
          true,
          { cause: error }
        )
      })

      if (!response.ok) {
        throw new ModelSyncTaskError(
          'DTP_TRANSFORM_STATUS_FAILED',
          `查询中海模型转换状态失败 (${response.status})`,
          response.status >= 500
        )
      }

      const body = (await response.json()) as ModelTransformResponse
      const status = body.result?.status

      if (status === 'SUCCEEDED') return
      if (status === 'FAILED' || status === 'STOPPED') {
        throw new ModelSyncTaskError(
          'DTP_TRANSFORM_FAILED',
          body.messages || body.msg || `中海模型转换失败，当前状态为 ${status}`,
          false
        )
      }

      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }

    throw new ModelSyncTaskError('DTP_TRANSFORM_TIMEOUT', '等待中海模型转换超时', true)
  }
