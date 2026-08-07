import CryptoJS from 'crypto-js'
import { BadRequestError } from '@/modules/shared/errors'
import { ensureError } from '@speckle/shared'
import { logger } from '@/observability/logging'

export const THIRD_PARTY_API_BASE = 'http://192.168.20.157:30080/service'
export const THIRD_PARTY_STATIC_BASE = 'http://192.168.20.157:30080'
const AES_KEY = 'Ze/0w7rnQg7jznntRcuxGQ=='

export type ThirdPartyTokenResponse = {
  code: number
  success: boolean
  timestamp: string
  results: {
    tokens: string[]
    profileId: string
    old: boolean
    inner: boolean
    name: string
    mobile: string
    email: string | null
    wdpId: string
    teamId: string
    roles: string[]
    start: string
    expire: string
  }
  msg: string
}

/**
 * 使用 AES-ECB-PKCS7 加密手机号
 */
export function encryptMobile(mobile: string): string {
  try {
    const data = JSON.stringify({ mobile })
    const dataParsed = CryptoJS.enc.Utf8.parse(data)
    const keyParsed = CryptoJS.enc.Utf8.parse(AES_KEY)

    const encrypted = CryptoJS.AES.encrypt(dataParsed, keyParsed, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    })

    return encrypted.toString()
  } catch (err) {
    const error = ensureError(err)
    logger.error({ err: error }, 'Failed to encrypt mobile number')
    throw new BadRequestError('加密手机号失败')
  }
}

/**
 * 调用第三方登录接口获取 token
 */
export async function loginToThirdParty(encryptedToken: string): Promise<ThirdPartyTokenResponse> {
  try {
    const response = await fetch(`${THIRD_PARTY_API_BASE}/v1/login/third-party`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: encryptedToken
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(
        { status: response.status, error: errorText },
        'Third-party login failed'
      )
      throw new BadRequestError(`第三方登录失败: ${response.status}`)
    }

    const data = (await response.json()) as ThirdPartyTokenResponse
    
    if (!data.success || data.code !== 200) {
      logger.error({ response: data }, 'Third-party login returned error')
      throw new BadRequestError(data.msg || '第三方登录失败')
    }

    return data
  } catch (err) {
    if (err instanceof BadRequestError) {
      throw err
    }
    const error = ensureError(err)
    logger.error({ err: error }, 'Error calling third-party login API')
    throw new BadRequestError('调用第三方接口失败')
  }
}

/**
 * 完整的 token 转换流程
 */
export async function convertSpeckleTokenToThirdParty(
  mobile: string
): Promise<ThirdPartyTokenResponse> {
  // 1. 加密手机号
  const encryptedMobile = encryptMobile(mobile)
  
  // 2. 调用第三方接口
  const result = await loginToThirdParty(encryptedMobile)
  
  return result
}
