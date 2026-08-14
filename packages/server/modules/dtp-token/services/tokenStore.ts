import { redisCacheProviderFactory } from '@/modules/shared/utils/caching'
import { getIntFromEnv } from '@/modules/shared/helpers/envHelper'
import { TIME_MS } from '@speckle/shared'

export type DtpTokenRecord = {
  token: string
  updatedAt: string
  uploadedBy: string
}

/**
 * Latest reported DTP token, stored in Redis so that all server instances
 * share the same value. Frontend (hc-bim) reports tokens it obtains from the
 * DTP third-party login endpoint, and external developers can retrieve the
 * latest one via GET /api/dtp-token.
 */
const CACHE_KEY = 'dtp:token:latest'

const getTtlMs = () => {
  const hours = Math.max(1, getIntFromEnv('DTP_TOKEN_TTL_HOURS', '24'))
  return hours * TIME_MS.hour
}

export const tokenCache = redisCacheProviderFactory()

export const getLatestDtpToken = async (): Promise<DtpTokenRecord | undefined> =>
  (await tokenCache.get(CACHE_KEY)) as DtpTokenRecord | undefined

export const storeDtpToken = async (record: DtpTokenRecord): Promise<void> => {
  await tokenCache.set(CACHE_KEY, record, { ttlMs: getTtlMs() })
}
