import { Router } from 'express'
import {
  getLatestDtpToken,
  storeDtpToken,
  type DtpTokenRecord
} from '@/modules/dtp-token/services/tokenStore'
import { moduleLogger } from '@/observability/logging'

const routeBase = '/api/dtp-token'

const dtpTokenRouterFactory = () => {
  const router = Router()

  /**
   * Retrieve the latest DTP token reported by the frontend.
   * Open to internal developers/services (no auth required).
   */
  router.get(routeBase, async (_req, res) => {
    const record = await getLatestDtpToken()
    if (!record) {
      res.status(404).json({ error: 'No DTP token has been reported yet' })
      return
    }

    res.json(record)
  })

  /**
   * Report the latest DTP token obtained from the DTP third-party login endpoint.
   * Authenticated via the speckle login session (cookie).
   */
  router.post(routeBase, async (req, res) => {
    const body = (req.body || {}) as { token?: unknown }
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!token) {
      res.status(400).json({ error: 'Body must include a non-empty "token" string' })
      return
    }

    if (!req.context?.auth || !req.context.userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const record: DtpTokenRecord = {
      token,
      updatedAt: new Date().toISOString(),
      uploadedBy: req.context.userId
    }
    await storeDtpToken(record)
    moduleLogger.info(
      { uploadedBy: record.uploadedBy },
      'New DTP token reported and cached'
    )

    res.status(201).json({ ok: true, updatedAt: record.updatedAt })
  })

  return router
}

export default dtpTokenRouterFactory
