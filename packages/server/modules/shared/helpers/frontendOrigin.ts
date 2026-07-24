import { getFrontendOrigin } from '@/modules/shared/helpers/envHelper'
import type { Request } from 'express'
import { isString } from 'lodash-es'

export const FRONTEND_ORIGIN_HEADER = 'x-frontend-origin'
export const FRONTEND_ORIGIN_QUERY = 'frontendOrigin'

type HeaderMap = Record<string, unknown>

const normalizeOrigin = (value?: string | null): string | undefined => {
  if (!value?.length) return undefined

  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

const getHeaderValue = (headers: HeaderMap, key: string): string | undefined => {
  const rawValue = headers[key] ?? headers[key.toLowerCase()]
  if (Array.isArray(rawValue)) {
    const firstValue = rawValue[0]
    return isString(firstValue) ? firstValue : undefined
  }

  return isString(rawValue) ? rawValue : undefined
}

export const resolveExplicitFrontendOriginFromRequest = (
  req: Request
): string | undefined => {
  const headerOrigin = normalizeOrigin(req.get(FRONTEND_ORIGIN_HEADER))
  if (headerOrigin) return headerOrigin

  const queryOrigin = req.query[FRONTEND_ORIGIN_QUERY]
  if (isString(queryOrigin)) {
    const normalizedQueryOrigin = normalizeOrigin(queryOrigin)
    if (normalizedQueryOrigin) return normalizedQueryOrigin
  }

  return normalizeOrigin(req.session?.frontendOrigin)
}

export const resolveForwardedOriginFromHeaders = (
  headers: HeaderMap
): string | undefined => {
  const forwardedProto = getHeaderValue(headers, 'x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
  const forwardedHost = getHeaderValue(headers, 'x-forwarded-host')
    ?.split(',')[0]
    ?.trim()

  if (!forwardedProto || !forwardedHost) return undefined

  return normalizeOrigin(`${forwardedProto}://${forwardedHost}`)
}

export const resolveFrontendOriginFromHeaders = (headers: HeaderMap): string => {
  return (
    normalizeOrigin(getHeaderValue(headers, FRONTEND_ORIGIN_HEADER)) ||
    resolveForwardedOriginFromHeaders(headers) ||
    getFrontendOrigin()
  )
}

export const resolveFrontendOriginFromRequest = (req: Request): string => {
  return (
    resolveExplicitFrontendOriginFromRequest(req) ||
    resolveForwardedOriginFromHeaders(req.headers as HeaderMap) ||
    getFrontendOrigin()
  )
}

export const rewriteUrlToFrontendOrigin = (params: {
  url: string | URL
  frontendOrigin: string
  configuredFrontendOrigin?: string
}): URL => {
  const { frontendOrigin, configuredFrontendOrigin = getFrontendOrigin() } = params
  const targetUrl = new URL(params.url.toString())
  const configuredOrigin = new URL(configuredFrontendOrigin).origin

  if (targetUrl.origin === configuredOrigin) {
    const resolvedOrigin = new URL(frontendOrigin)
    targetUrl.protocol = resolvedOrigin.protocol
    targetUrl.host = resolvedOrigin.host
  }

  return targetUrl
}
