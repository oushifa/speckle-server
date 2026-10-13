import {
  THIRD_PARTY_API_BASE,
  THIRD_PARTY_STATIC_BASE,
  convertSpeckleTokenToThirdParty
} from '@/modules/auth/services/thirdPartyToken'
import { getLatestDtpToken } from '@/modules/dtp-token/services/tokenStore'
import { ModelSyncTaskError } from '@/modules/model-sync/services/errors'
import { BadRequestError } from '@/modules/shared/errors'
import { moduleLogger } from '@/observability/logging'

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

type ModelTransformResult = {
  taskId?: string
  status?: string
  /** 中海转换当前阶段序号（RUNNING 早期可能缺失） */
  currentStage?: number | null
  /** 中海转换阶段总数 */
  totalStage?: number | null
  /** 当前阶段名/阶段码，例如 downloadFile / dsForLinux / uploadFile / 01 */
  message?: string | null
  /** 状态机码：RUNNING=01000000，SUCCEEDED=10000000 */
  statusCode?: string | null
  statusDescription?: string | null
}

type ModelTransformResponse = {
  success?: boolean
  msg?: string
  messages?: string
  results?: {
    taskId?: string
  }
  result?: ModelTransformResult
}

/** 中海转换轮询返回的真实进度 */
export type DtpTransformProgress = {
  /** 当前阶段序号，取不到为 null */
  currentStage: number | null
  /** 阶段总数，取不到为 null */
  totalStage: number | null
  /** 当前阶段名/阶段码，取不到为 null */
  stageName: string | null
  /** 阶段完成比例 0~1，取不到真实阶段时为 null */
  ratio: number | null
}

/**
 * 从中海 pipeline task 返回里解析真实进度。
 *
 * 实测返回（RUNNING）：
 * `{ totalStage: 1, status: 'RUNNING', message: '01', statusCode: '01000000' }`，
 * 转换推进后 `currentStage/totalStage` 依次为 1/2、2/3 … 8/8，成功时 status 变 SUCCEEDED。
 */
export const parseDtpTransformProgress = (
  result?: ModelTransformResult
): DtpTransformProgress => {
  const currentStage =
    typeof result?.currentStage === 'number' ? result.currentStage : null
  const totalStage =
    typeof result?.totalStage === 'number' && result.totalStage > 0
      ? result.totalStage
      : null
  const stageName =
    typeof result?.message === 'string' && result.message.trim()
      ? result.message.trim()
      : null
  const ratio =
    currentStage !== null && totalStage !== null
      ? Math.min(1, Math.max(0, currentStage / totalStage))
      : null

  return { currentStage, totalStage, stageName, ratio }
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

/**
 * 判断 JWT 是否已过期（解析失败时按未过期处理，交给 DTP 自己判定）
 */
const isJwtExpired = (token: string, now: number = Date.now()) => {
  const payload = token.split('.')[1]
  if (!payload) return false

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: number
    }
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 <= now : false
  } catch {
    return false
  }
}

/**
 * 读取前端上报、服务器缓存的共享 DTP token（见 GET /api/dtp-token）。
 * 不存在 / 已过期 / Redis 异常时返回 null。
 */
const resolveSharedDtpToken = async (): Promise<string | null> => {
  try {
    const record = await getLatestDtpToken()
    const token = record?.token?.trim()
    if (!token || isJwtExpired(token)) return null

    return token
  } catch (error) {
    moduleLogger.warn({ err: error }, '读取共享 DTP token 失败')
    return null
  }
}

/**
 * 获取 DTP token：优先按任务创建者的手机号登录，
 * 该手机号在中海没有账号（或登录失败）时回退到共享 token，
 * 避免整个模型同步卡在 DTP 登录这一步。
 */
export const loginToDtpFactory =
  () =>
  async (mobile: string): Promise<string> => {
    try {
      const result = await convertSpeckleTokenToThirdParty(mobile)
      const token = result.results?.tokens?.[0]
      if (!token) {
        throw new ModelSyncTaskError('DTP_AUTH_FAILED', '获取 DTP token 失败', false)
      }
      return token
    } catch (error) {
      const sharedToken = await resolveSharedDtpToken()
      if (!sharedToken) throw error

      moduleLogger.warn(
        { err: error, mobile },
        '按用户登录中海失败，回退使用服务器缓存的共享 DTP token'
      )
      return sharedToken
    }
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
      throw new ModelSyncTaskError(
        'DTP_UPLOAD_CONFIG_FAILED',
        '中海上传配置不完整',
        false
      )
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
    /** 获取到中海上传配置（上传信息）后的回调 */
    onConfigReady?: () => Promise<void> | void
    /** 即将开始向中海上传文件时的回调 */
    onUploadStart?: () => Promise<void> | void
  }): Promise<DtpUploadResult> => {
    const token = await deps.loginToDtp(params.mobile)
    const { uploadUrl, uploadPathPrefix, uploadToken } = await deps.getDtpUploadConfig(
      token
    )
    await params.onConfigReady?.()

    const chunkPlan = resolveChunkPlan(params.buffer.length)
    const assetName = buildAssetName(params.fileName)
    const path = `${uploadPathPrefix}${params.fileName}`

    await params.onUploadStart?.()

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
        throw new ModelSyncTaskError(
          'DTP_UPLOAD_REQUEST_FAILED',
          '上传中海模型失败',
          true,
          {
            cause: error
          }
        )
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
      throw new ModelSyncTaskError(
        'DTP_UPLOAD_RESULT_INVALID',
        '中海上传未返回最终结果',
        false
      )
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
      throw new ModelSyncTaskError(
        'DTP_UPLOAD_REQUEST_FAILED',
        '触发中海模型转换失败',
        true,
        {
          cause: error
        }
      )
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

/**
 * 删除中海（DTP）侧的模型资产：
 * DELETE /v1/daas/asset/model/delete/{assetId}
 * 删除资产会同时中断该资产正在进行的转换/同步流程。
 */
export const deleteDtpModelAssetFactory =
  () =>
  async (params: { mobile: string; assetId: string }): Promise<void> => {
    const assetId = params.assetId.trim()
    if (!assetId) return

    const token = await loginToDtpFactory()(params.mobile)
    const response = await fetch(
      `${THIRD_PARTY_API_BASE}/v1/daas/asset/model/delete/${encodeURIComponent(
        assetId
      )}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    ).catch((error) => {
      throw new ModelSyncTaskError(
        'DTP_ASSET_DELETE_FAILED',
        '删除中海模型资产失败',
        true,
        { cause: error }
      )
    })

    if (!response.ok) {
      throw new ModelSyncTaskError(
        'DTP_ASSET_DELETE_FAILED',
        `删除中海模型资产失败 (${response.status})`,
        response.status >= 500
      )
    }

    // 中海接口即使 HTTP 200 也可能通过 success=false 表示业务失败
    const body = (await response.json().catch(() => null)) as {
      success?: boolean
      msg?: string
      messages?: string
    } | null

    if (body && body.success === false) {
      throw new ModelSyncTaskError(
        'DTP_ASSET_DELETE_FAILED',
        body.msg || body.messages || '删除中海模型资产失败',
        false
      )
    }
  }

export const pollDtpModelTransformUntilFinishedFactory =
  () =>
  async (params: {
    mobile: string
    transformTaskId: string
    waitMs?: number
    maxAttempts?: number
    /** 每次轮询中海转换状态后的回调（attempt 从 1 开始，progress 为中海返回的真实进度） */
    onAttempt?: (params: {
      attempt: number
      progress: DtpTransformProgress
    }) => Promise<void> | void
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

      await params.onAttempt?.({
        attempt: attempt + 1,
        progress: parseDtpTransformProgress(body.result)
      })

      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }

    throw new ModelSyncTaskError('DTP_TRANSFORM_TIMEOUT', '等待中海模型转换超时', true)
  }
