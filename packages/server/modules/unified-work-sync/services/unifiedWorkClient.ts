import axios from 'axios'
import {
  getFrontendOrigin,
  getServerOrigin,
  getUnifiedWorkSyncAccount,
  getUnifiedWorkSyncHost,
  getUnifiedWorkSyncPassword,
  getUnifiedWorkSyncRouterId,
  getUnifiedWorkSyncSystemCode,
  getUnifiedWorkSyncToken,
  getUnifiedWorkSyncUsername
} from '@/modules/shared/helpers/envHelper'
import { moduleLogger } from '@/observability/logging'

export const unifiedWorkSyncLogger = moduleLogger.child({
  module: 'unified-work-sync'
})

export const TOKEN_CACHE_MS = 20 * 60 * 1000
export const REQUEST_TIMEOUT_MS = 60 * 1000

let cachedAuthToken: {
  value: string
  expiresAt: number
} | null = null

export type ExternalUserRow = {
  id: string
  name: string | null
  email: string | null
}

export type UnifiedWorkReviewer = {
  user: string
  status: string
}

export type UnifiedWorkPushPayload = {
  systemCode: string
  taskId: string
  title: string
  creator: string
  assignee: string
  reviewer: UnifiedWorkReviewer[]
  createTime: string
  reviewTime: string
  route: string
  extraData: Record<string, unknown>
}

/** Everything we need in order to persist a per-approver/recipient push result. */
export type UnifiedWorkTaskMeta = {
  instanceId: string
  taskId: string
  stepIndex: number
  approverId: string | null
  account: string | null
}

export type UnifiedWorkSyncResult = {
  pushCount: number
  failCount: number
  removeCount: number
}

export const isUnifiedWorkSyncEnabled = () => Boolean(getUnifiedWorkSyncHost())

export const getSyncConfig = () => ({
  host: getUnifiedWorkSyncHost(),
  systemCode: getUnifiedWorkSyncSystemCode(),
  token: getUnifiedWorkSyncToken(),
  username: getUnifiedWorkSyncUsername(),
  password: getUnifiedWorkSyncPassword(),
  routerId: getUnifiedWorkSyncRouterId(),
  account: getUnifiedWorkSyncAccount()
})

export const getCachedAuthToken = () =>
  cachedAuthToken && cachedAuthToken.expiresAt > Date.now() ? cachedAuthToken.value : ''

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export const extractToken = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (!isRecord(value)) return ''

  const directKeys = ['token', 'accessToken', 'access_token']
  for (const key of directKeys) {
    const token = value[key]
    if (typeof token === 'string' && token.trim()) return token.trim()
    // The platform nests the token as { token: { accessToken, ... } }
    if (isRecord(token)) {
      const nestedToken = extractToken(token)
      if (nestedToken) return nestedToken
    }
  }

  const nestedKeys = ['data', 'result', 'payload']
  for (const key of nestedKeys) {
    const token = extractToken(value[key])
    if (token) return token
  }

  return ''
}

export const formatErrorDetails = (err: unknown) => {
  if (axios.isAxiosError(err)) {
    return {
      message: err.message,
      code: err.code,
      url: err.config?.url,
      method: err.config?.method?.toUpperCase(),
      status: err.response?.status,
      statusText: err.response?.statusText,
      responseBody: err.response?.data
    }
  }
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack
    }
  }
  return { message: String(err) }
}

export const getAuthToken = async () => {
  const config = getSyncConfig()

  if (config.token) {
    unifiedWorkSyncLogger.debug('[WORK_SYNC] Using static token from configuration')
    return config.token
  }

  const cached = getCachedAuthToken()
  if (cached) {
    unifiedWorkSyncLogger.debug('[WORK_SYNC] Using cached auth token')
    return cached
  }

  if (!config.username || !config.password) {
    unifiedWorkSyncLogger.warn(
      {
        hasUsername: Boolean(config.username),
        hasPassword: Boolean(config.password)
      },
      '[WORK_SYNC] Skip unified work sync because auth credentials (username/password) are incomplete'
    )
    return ''
  }

  try {
    unifiedWorkSyncLogger.info(
      {
        host: config.host,
        username: config.username,
        routerId: config.routerId
      },
      '[WORK_SYNC] Requesting login to unified work platform'
    )

    const response = await axios.post(
      `${config.host}/api/v1/auth/login2`,
      {
        username: config.username,
        password: config.password,
        routerId: config.routerId
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: REQUEST_TIMEOUT_MS
      }
    )

    const token = extractToken(response.data)
    if (!token) {
      unifiedWorkSyncLogger.error(
        {
          responseData: response.data
        },
        '[WORK_SYNC] Unified work login succeeded but token was not found in response'
      )
      return ''
    }

    cachedAuthToken = {
      value: token,
      expiresAt: Date.now() + TOKEN_CACHE_MS
    }

    unifiedWorkSyncLogger.info(
      '[WORK_SYNC] Unified work auth token obtained successfully'
    )

    return token
  } catch (err) {
    const errorDetails = formatErrorDetails(err)
    unifiedWorkSyncLogger.error(
      {
        error: errorDetails,
        host: config.host,
        username: config.username
      },
      `[WORK_SYNC] Failed to log in to unified work platform: ${errorDetails.message}`
    )
    return ''
  }
}

/**
 * Maps a local user onto the unified work platform account name.
 *
 * The platform account name lives in the local `email` column (the column keeps
 * its legacy name, but the value is the account name, not an email address), so
 * the value is used as-is without splitting on `@`.
 */
export const resolveExternalUserCode = (user: ExternalUserRow | undefined | null) => {
  if (!user) return ''

  const account = user.email?.trim()
  if (account) return account

  const name = user.name?.trim()
  if (name) return name

  return ''
}

/**
 * Origin of the deployment that is currently running the sync, so the link always
 * points at that very system (e.g. pushing from http://47.100.77.97:64482 yields
 * a link on the same host). `FRONTEND_ORIGIN` wins, `CANONICAL_URL` is the fallback.
 */
export const resolvePublicOrigin = () => {
  try {
    return getFrontendOrigin()
  } catch {
    try {
      return getServerOrigin()
    } catch {
      return ''
    }
  }
}

export const buildPublicRouteLink = (routePath: string) => {
  const origin = resolvePublicOrigin()
  if (!origin) return null
  try {
    return new URL(routePath, origin).toString()
  } catch {
    return null
  }
}

export const removeUnifiedWorkItem = async (params: {
  token: string
  taskId: string
}): Promise<unknown> => {
  const config = getSyncConfig()
  const response = await axios.post(
    `${config.host}/api/v1/unifiedWork/removeWorkItem`,
    {
      systemCode: config.systemCode,
      taskId: params.taskId
    },
    {
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/json'
      },
      timeout: REQUEST_TIMEOUT_MS
    }
  )
  return response.data as unknown
}

/**
 * The platform answers `{ payload: { success: boolean } }`: HTTP 200 with
 * `success: false` means the task was not there in the first place.
 */
export const isRemoveSuccess = (data: unknown) =>
  isRecord(data) && isRecord(data.payload) && data.payload.success === true

export const pushUnifiedWorkItem = async (params: {
  token: string
  payload: UnifiedWorkPushPayload
}): Promise<unknown> => {
  const config = getSyncConfig()
  const response = await axios.post(
    `${config.host}/api/v1/unifiedWork/work-item/push`,
    params.payload,
    {
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/json'
      },
      timeout: REQUEST_TIMEOUT_MS
    }
  )
  return response.data as unknown
}
