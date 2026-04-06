import {
  createBareToken,
  createAppTokenFactory,
  validateTokenFactory
} from '@/modules/core/services/tokens'
import { validateScopes } from '@/modules/shared'
import { InvalidAccessCodeRequestError } from '@/modules/auth/errors'
import type { Optional } from '@speckle/shared'
import { ensureError, Scopes } from '@speckle/shared'
import { BadRequestError, ForbiddenError } from '@/modules/shared/errors'
import {
  getAppFactory,
  revokeRefreshTokenFactory,
  createAuthorizationCodeFactory,
  getAuthorizationCodeFactory,
  deleteAuthorizationCodeFactory,
  createRefreshTokenFactory,
  getRefreshTokenFactory,
  getTokenAppInfoFactory
} from '@/modules/auth/repositories/apps'
import { db } from '@/db/knex'
import {
  createAppTokenFromAccessCodeFactory,
  refreshAppTokenFactory
} from '@/modules/auth/services/serverApps'
import type { Express } from 'express'
import {
  getApiTokenByIdFactory,
  getTokenResourceAccessDefinitionsByIdFactory,
  getTokenScopesByIdFactory,
  revokeTokenByIdFactory,
  revokeUserTokenByIdFactory,
  storeApiTokenFactory,
  storeTokenResourceAccessDefinitionsFactory,
  storeTokenScopesFactory,
  storeUserServerAppTokenFactory,
  updateApiTokenFactory
} from '@/modules/core/repositories/tokens'
import {
  getUserByEmailFactory,
  getUserRoleFactory
} from '@/modules/core/repositories/users'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import { withOperationLogging } from '@/observability/domain/businessLogging'
import { validateUserPasswordFactory } from '@/modules/core/services/users/management'
import { getServerOrigin } from '@/modules/shared/helpers/envHelper'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import cryptoRandomString from 'crypto-random-string'

const SSO_JWT_SECRET = 'Rz4eFYTp8CCGBGh6tpDoSPI/L8GUefjW3OfFcF4QOwI='
const SSO_AES_KEY = Buffer.from(
  '65bdd00e4d45dfea7d64a0e253f068ae8ad370f9130feca9a14e47a5e746c989',
  'hex'
)
const SSO_AES_IV = Buffer.from('22409c2b7417a8272694ccb7454db738', 'hex')
const SPECKLE_WEB_APP_ID = 'spklwebapp'

type SsoTokenPayload = {
  username?: string
  password?: string
  exp?: number
}

const toBase64 = (input: string) => {
  const padding = (4 - (input.length % 4)) % 4
  return `${input}${'='.repeat(padding)}`.replace(/-/g, '+').replace(/_/g, '/')
}

const parseSsoToken = (token: string): SsoTokenPayload => {
  const parts = token.split('.')
  if (parts.length !== 3) throw new BadRequestError('Token 格式无效')

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const expectedSignature = crypto
    .createHmac('sha256', SSO_JWT_SECRET)
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  const hasValidLength = expectedSignature.length === encodedSignature.length
  const hasValidSignature =
    hasValidLength &&
    crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(encodedSignature, 'utf8')
    )
  if (!hasValidSignature) throw new BadRequestError('Token 签名无效')

  const payloadJson = Buffer.from(toBase64(encodedPayload), 'base64').toString('utf8')
  const payload = JSON.parse(payloadJson) as SsoTokenPayload
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new BadRequestError('Token 已过期')
  }

  return payload
}

const decryptSsoPassword = (cipherText: string) => {
  const decipher = crypto.createDecipheriv('aes-256-cbc', SSO_AES_KEY, SSO_AES_IV)
  let decrypted = decipher.update(cipherText, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

const resolveAccessCode = (location: string) => {
  const url = new URL(location, getServerOrigin())
  const accessCode = url.searchParams.get('access_code')
  if (!accessCode) throw new BadRequestError('未能获取 access_code')
  return accessCode
}

// TODO: Secure these endpoints!
export default function (app: Express) {
  /*
  Generates an access code for an app.
  TODO: ensure same origin.
   */
  app.get('/auth/accesscode', async (req, res) => {
    try {
      const getApp = getAppFactory({ db })
      const createAuthorizationCode = createAuthorizationCodeFactory({ db })
      const validateToken = validateTokenFactory({
        revokeUserTokenById: revokeUserTokenByIdFactory({ db }),
        getApiTokenById: getApiTokenByIdFactory({ db }),
        getTokenAppInfo: getTokenAppInfoFactory({ db }),
        getTokenScopesById: getTokenScopesByIdFactory({ db }),
        getUserRole: getUserRoleFactory({ db }),
        getTokenResourceAccessDefinitionsById:
          getTokenResourceAccessDefinitionsByIdFactory({ db }),
        updateApiToken: updateApiTokenFactory({ db })
      })

      const preventRedirect = !!req.query.preventRedirect
      const appId = req.query.appId as Optional<string>
      if (!appId)
        throw new InvalidAccessCodeRequestError('appId missing from querystring.')

      const app = await getApp({ id: appId })

      if (!app) throw new InvalidAccessCodeRequestError('App does not exist.')

      const challenge = req.query.challenge as Optional<string>
      const userToken = req.query.token as Optional<string>
      if (!challenge) throw new InvalidAccessCodeRequestError('Missing challenge')
      if (!userToken) throw new InvalidAccessCodeRequestError('Missing token')

      // 1. Validate token
      const tokenValidationResult = await validateToken(userToken)
      const { valid, scopes, userId } =
        'scopes' in tokenValidationResult
          ? tokenValidationResult
          : { ...tokenValidationResult, scopes: [], userId: null }
      if (!valid) throw new InvalidAccessCodeRequestError('Invalid token')

      // 2. Validate token scopes
      await validateScopes(scopes, Scopes.Tokens.Write)

      const ac = await createAuthorizationCode({ appId, userId, challenge })

      const redirectUrl = `${app.redirectUrl}?access_code=${ac}`
      return preventRedirect
        ? res.status(200).json({ redirectUrl })
        : res.redirect(redirectUrl)
    } catch (err) {
      if (
        err instanceof InvalidAccessCodeRequestError ||
        err instanceof ForbiddenError
      ) {
        req.log.info({ err }, 'Invalid access code request error, or Forbidden error.')
        return res.status(400).send(err.message)
      } else {
        req.log.error(err)
        return res
          .status(500)
          .send('Something went wrong while processing your request')
      }
    }
  })

  /*
  Generates a new api token: (1) either via a valid refresh token or (2) via a valid access token
   */
  app.options('/auth/token', corsMiddlewareFactory())
  app.post('/auth/token', corsMiddlewareFactory(), async (req, res) => {
    try {
      if (!req.body.appId)
        throw new BadRequestError(
          `Invalid request, insufficient information provided. App Id is required.`
        )
      if (!req.body.appSecret)
        throw new BadRequestError(
          `Invalid request, insufficient information provided. App Secret is required.`
        )

      const createRefreshToken = createRefreshTokenFactory({ db })
      const getApp = getAppFactory({ db })
      const createAppToken = createAppTokenFactory({
        storeApiToken: storeApiTokenFactory({ db }),
        storeTokenScopes: storeTokenScopesFactory({ db }),
        storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory(
          {
            db
          }
        ),
        storeUserServerAppToken: storeUserServerAppTokenFactory({ db })
      })
      const createAppTokenFromAccessCode = createAppTokenFromAccessCodeFactory({
        getAuthorizationCode: getAuthorizationCodeFactory({ db }),
        deleteAuthorizationCode: deleteAuthorizationCodeFactory({ db }),
        getApp,
        createRefreshToken,
        createAppToken,
        createBareToken
      })
      const refreshAppToken = refreshAppTokenFactory({
        getRefreshToken: getRefreshTokenFactory({ db }),
        revokeRefreshToken: revokeRefreshTokenFactory({ db }),
        createRefreshToken,
        getApp,
        createAppToken,
        createBareToken
      })

      // Token refresh
      if ('refreshToken' in req.body) {
        if (!req.body.refreshToken)
          throw new BadRequestError(
            'Invalid request, insufficient information provided. A valid refresh token is required.'
          )

        const authResponse = await withOperationLogging(
          async () =>
            await refreshAppToken({
              refreshToken: req.body.refreshToken,
              appId: req.body.appId,
              appSecret: req.body.appSecret
            }),
          {
            operationName: 'refreshAppToken',
            operationDescription: 'Refresh an app token',
            logger: req.log
          }
        )

        // the token should not be cached by the user's browser or intermediate proxies
        res.header('Cache-Control', 'no-cache, no-store')
        res.header('Expires', '0')
        res.header('Pragma', 'no-cache')
        return res.send(authResponse)
      }

      // Access-code - token exchange
      if (!req.body.accessCode)
        throw new BadRequestError(
          `Invalid request, insufficient information provided. Access Code is required.`
        )
      if (!req.body.challenge)
        throw new BadRequestError(
          `Invalid request, insufficient information provided. Challenge is required.`
        )

      const authResponse = await withOperationLogging(
        async () =>
          await createAppTokenFromAccessCode({
            appId: req.body.appId,
            appSecret: req.body.appSecret,
            accessCode: req.body.accessCode,
            challenge: req.body.challenge
          }),
        {
          operationName: 'createAppTokenFromAccessCode',
          operationDescription: 'Create an app token from an access code',
          logger: req.log
        }
      )
      return res.send(authResponse)
    } catch (err) {
      req.log.info({ err }, 'Error while trying to generate a new token.')
      return res.status(401).send({ err: ensureError(err).message })
    }
  })

  app.post('/auth/sso/token-login', async (req, res) => {
    try {
      const rawToken = req.body?.token
      if (!rawToken || typeof rawToken !== 'string') {
        throw new BadRequestError('缺少 token')
      }

      const payload = parseSsoToken(rawToken)
      const email = payload.username?.trim().toLowerCase()
      const encryptedPassword = payload.password?.trim()
      if (!email || !encryptedPassword) {
        throw new BadRequestError('Token 内容无效')
      }

      const password = decryptSsoPassword(encryptedPassword)
      if (!password) throw new BadRequestError('Token 内容无效')

      const getUserByEmail = getUserByEmailFactory({ db })
      const validateUserPassword = validateUserPasswordFactory({
        getUserByEmail
      })
      const existingUser = await getUserByEmail(email)

      const challenge = cryptoRandomString({ length: 10 })
      const authUrl = new URL(
        existingUser ? '/auth/local/login' : '/auth/local/register',
        getServerOrigin()
      )
      authUrl.searchParams.set('challenge', challenge)

      const authResponse = await fetch(authUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          existingUser
            ? {
                email,
                password
              }
            : {
                email,
                password,
                name: email.split('@')[0] || email
              }
        ),
        redirect: 'manual'
      })

      if (existingUser) {
        const isValidPassword = await validateUserPassword({ email, password })
        if (!isValidPassword) {
          throw new BadRequestError('Token 对应账号密码已变更，请重新获取 token')
        }
      }

      const redirectLocation = authResponse.headers.get('location')
      if (!redirectLocation) {
        const authError = (await authResponse.json().catch(() => ({}))) as {
          message?: string
          err?: string
          error?: { message?: string }
        }
        throw new BadRequestError(
          authError.error?.message ||
            authError.message ||
            authError.err ||
            '登录失败，请检查 token'
        )
      }

      const accessCode = resolveAccessCode(redirectLocation)
      const tokenResponse = await fetch(new URL('/auth/token', getServerOrigin()), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessCode,
          challenge,
          appId: SPECKLE_WEB_APP_ID,
          appSecret: SPECKLE_WEB_APP_ID
        })
      })

      const authTokenData = (await tokenResponse.json()) as {
        token?: string
        err?: string
      }
      if (!authTokenData.token) {
        throw new BadRequestError(authTokenData.err || 'Token 登录失败')
      }

      return res.status(200).send({
        token: authTokenData.token,
        isNewUser: !existingUser
      })
    } catch (err) {
      const error = ensureError(err)
      req.log.info({ err: error }, 'SSO token login failed')
      return res.status(400).send({ err: error.message })
    }
  })

  /*
  Ensures a user is logged out by invalidating their token and refresh token.
   */
  app.post('/auth/logout', async (req, res) => {
    try {
      const revokeRefreshToken = revokeRefreshTokenFactory({ db })
      const revokeTokenById = revokeTokenByIdFactory({ db })

      const token = req.body.token
      const refreshToken = req.body.refreshToken

      if (!token) throw new BadRequestError('Invalid request. No token provided.')
      await revokeTokenById(token)

      if (refreshToken) await revokeRefreshToken({ tokenId: refreshToken })

      return res.status(200).send({ message: 'You have logged out.' })
    } catch (err) {
      req.log.info({ err }, 'Error while trying to logout.')
      return res.status(400).send('Something went wrong while trying to logout.')
    }
  })
}
