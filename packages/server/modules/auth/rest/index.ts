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
import {
  findDepartmentByNameFactory,
  removeDepartmentMembersByUserFactory,
  upsertDepartmentMemberFactory
} from '@/modules/organizations/repositories/organizations'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import { withOperationLogging } from '@/observability/domain/businessLogging'
import { getServerOrigin } from '@/modules/shared/helpers/envHelper'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import cryptoRandomString from 'crypto-random-string'

const SSO_JWT_SECRET = 'Rz4eFYTp8CCGBGh6tpDoSPI/L8GUefjW3OfFcF4QOwI='
const SPECKLE_WEB_APP_ID = 'spklwebapp'
const SSO_DEFAULT_PASSWORD = 'SZNB!@#456'

type SsoTokenHeader = {
  alg?: string
  typ?: string
}

type SsoTokenPayload = {
  username?: string
  company?: string
  exp?: number
  iat?: number
}

const toBase64 = (input: string) => {
  const padding = (4 - (input.length % 4)) % 4
  return `${input}${'='.repeat(padding)}`.replace(/-/g, '+').replace(/_/g, '/')
}

const parseSsoToken = (token: string): SsoTokenPayload => {
  const parts = token.split('.')
  if (parts.length !== 3) throw new BadRequestError('Token 格式无效')

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  let header: SsoTokenHeader
  let payload: SsoTokenPayload

  try {
    const headerJson = Buffer.from(toBase64(encodedHeader), 'base64').toString('utf8')
    const payloadJson = Buffer.from(toBase64(encodedPayload), 'base64').toString('utf8')
    header = JSON.parse(headerJson) as SsoTokenHeader
    payload = JSON.parse(payloadJson) as SsoTokenPayload
  } catch {
    throw new BadRequestError('Token 内容无效')
  }

  if (header.alg !== 'HS256') throw new BadRequestError('Token 算法无效')

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
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new BadRequestError('Token 已过期')
  }

  return payload
}

const resolveAuthErrorMessage = async (authResponse: Response) => {
  const authError = (await authResponse.json().catch(() => ({}))) as {
    message?: string
    err?: string
    error?: { message?: string }
  }

  return authError.error?.message || authError.message || authError.err
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
      const username = payload.username?.trim()
      const company = payload.company?.trim() || ''
      if (!username) {
        throw new BadRequestError('Token 内容无效')
      }
      const email = username.toLowerCase()

      const getUserByEmail = getUserByEmailFactory({ db })
      const previousUser = await getUserByEmail(email)
      let currentUser = previousUser
      const isNewUser = !previousUser

      if (!currentUser) {
        const challenge = cryptoRandomString({ length: 10 })
        const registerUrl = new URL('/auth/local/register', getServerOrigin())
        registerUrl.searchParams.set('challenge', challenge)
        const authResponse = await fetch(registerUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password: SSO_DEFAULT_PASSWORD,
            name: username,
            company
          }),
          redirect: 'manual'
        })

        const redirectLocation = authResponse.headers.get('location')
        if (!redirectLocation) {
          const authMessage = await resolveAuthErrorMessage(authResponse)
          throw new BadRequestError(authMessage || '登录失败，请检查 token')
        }

        currentUser = await getUserByEmail(email)
        if (!currentUser) throw new BadRequestError('自动创建用户失败')
      }

      const findDepartmentByName = findDepartmentByNameFactory({ db })
      const upsertDepartmentMember = upsertDepartmentMemberFactory({ db })
      const removeDepartmentMembersByUser = removeDepartmentMembersByUserFactory({ db })
      await removeDepartmentMembersByUser({ userId: currentUser.id })
      if (company) {
        const department = await findDepartmentByName({ name: company })
        if (department) {
          await upsertDepartmentMember({
            departmentId: department.id,
            userId: currentUser.id
          })
        }
      }

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
      const appRecord = await getApp({ id: SPECKLE_WEB_APP_ID })
      if (!appRecord) throw new BadRequestError('登录应用未配置')
      const appToken = await createAppToken({
        userId: currentUser.id,
        name: `${appRecord.name}-token`,
        scopes: appRecord.scopes.map((scope) => scope.name),
        appId: SPECKLE_WEB_APP_ID
      })

      return res.status(200).send({
        token: appToken,
        isNewUser
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
