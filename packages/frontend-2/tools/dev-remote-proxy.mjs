#!/usr/bin/env node
/**
 * Dev-only reverse proxy that lets the local frontend-2 dev server (`nuxt dev`)
 * run against a *remote* Speckle server, while keeping the browser on a single origin
 * (so cookies, redirects, uploads and WebSockets all behave like they do in production,
 * where nginx sits in front of the frontend + backend).
 *
 *   Browser -> http://127.0.0.1:8081 (this proxy)
 *     |- /graphql, /api/**, /auth/**, /objects/**, /preview/**, /static/**, /explorer,
 *     |  /liveness, /readiness            -> DEV_PROXY_TARGET   (HTTP + WebSocket)
 *     |- /api/status                      -> DEV_PROXY_FRONTEND (frontend only route)
 *     '- everything else                  -> DEV_PROXY_FRONTEND (nuxt dev, incl. Vite HMR WS)
 *
 * Usage (see .env.remote):
 *   node --env-file=.env.remote tools/dev-remote-proxy.mjs
 *   yarn dev:remote
 *
 * Env vars (all optional):
 *   DEV_PROXY_HOST            default 127.0.0.1
 *   DEV_PROXY_PORT            default 8081            (public port the browser talks to)
 *   DEV_PROXY_TARGET          default http://47.100.77.97:64482 (remote Speckle server)
 *   DEV_PROXY_FRONTEND        default http://127.0.0.1:3001     (local nuxt dev server)
 *   DEV_PROXY_BACKEND_PATHS   default /graphql,/api,/auth,/objects,/preview,/static,/explorer,/liveness,/readiness
 *   DEV_PROXY_LOCAL_PATHS     default /api/status     (paths that stay on the frontend)
 *   DEV_PROXY_VERBOSE         set to 1 to log every proxied request
 */
import http from 'node:http'
import https from 'node:https'

const parseList = (value, fallback) =>
  (value === undefined || value === '' ? fallback : value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const config = {
  host: process.env.DEV_PROXY_HOST || '127.0.0.1',
  port: Number(process.env.DEV_PROXY_PORT || 8081),
  target: new URL(process.env.DEV_PROXY_TARGET || 'http://47.100.77.97:64482'),
  frontend: new URL(process.env.DEV_PROXY_FRONTEND || 'http://127.0.0.1:3001'),
  backendPaths: parseList(
    process.env.DEV_PROXY_BACKEND_PATHS,
    '/graphql,/api,/auth,/objects,/preview,/static,/explorer,/liveness,/readiness'
  ),
  localPaths: parseList(process.env.DEV_PROXY_LOCAL_PATHS, '/api/status'),
  verbose: ['1', 'true', 'yes'].includes(
    (process.env.DEV_PROXY_VERBOSE || '').toLowerCase()
  )
}

const formatArgs = (args) => args.map((arg) => String(arg)).join(' ')
const log = (...args) => process.stdout.write(`[dev-proxy] ${formatArgs(args)}\n`)
const logError = (...args) => process.stderr.write(`[dev-proxy] ${formatArgs(args)}\n`)

/**
 * `/auth` must match `/auth/token`, but *not* `/authn/login` (a frontend page),
 * so prefix matching is always done on path segment boundaries.
 */
const matchesPrefix = (pathname, prefix) => {
  if (prefix === '/') return true
  const normalized = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  return pathname === normalized || pathname.startsWith(`${normalized}/`)
}

const safePathname = (url) => {
  try {
    return new URL(url || '/', 'http://localhost').pathname
  } catch {
    return '/'
  }
}

const resolveTarget = (pathname) => {
  if (config.localPaths.some((prefix) => matchesPrefix(pathname, prefix))) {
    return { name: 'frontend', url: config.frontend, rewriteHost: false }
  }
  if (config.backendPaths.some((prefix) => matchesPrefix(pathname, prefix))) {
    return { name: 'backend', url: config.target, rewriteHost: true }
  }
  return { name: 'frontend', url: config.frontend, rewriteHost: false }
}

const defaultPort = (url) => (url.protocol === 'https:' ? '443' : '80')

/** Keeps the path prefix of the target URL (usually empty) + the incoming request path. */
const buildTargetPath = (target, requestUrl) => {
  const base = target.pathname.replace(/\/+$/, '')
  const path =
    requestUrl && requestUrl.startsWith('/') ? requestUrl : `/${requestUrl || ''}`
  return `${base}${path}`
}

const agents = new Map()
const agentFor = (url) => {
  const key = url.origin
  let agent = agents.get(key)
  if (!agent) {
    const Agent = url.protocol === 'https:' ? https.Agent : http.Agent
    agent = new Agent({ keepAlive: true })
    agents.set(key, agent)
  }
  return agent
}

/**
 * Headers that are connection specific and must not be forwarded (RFC 9110 §7.6.1).
 * `host` is handled separately.
 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host'
])

const buildRequestHeaders = (req, target, { rewriteHost, websocket }) => {
  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    const lower = key.toLowerCase()
    if (!websocket && HOP_BY_HOP.has(lower)) continue
    if (lower === 'host') continue
    headers[key] = value
  }

  headers.host = rewriteHost ? target.host : req.headers.host || target.host
  if (rewriteHost) {
    headers['x-forwarded-host'] = req.headers.host || ''
    headers['x-forwarded-proto'] = 'http'
    headers['x-forwarded-for'] = req.headers['x-forwarded-for']
      ? `${req.headers['x-forwarded-for']}, ${req.socket.remoteAddress || ''}`
      : req.socket.remoteAddress || ''
  }

  return headers
}

const filterResponseHeaders = (headers) => {
  const result = {}
  for (const [key, value] of Object.entries(headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue
    result[key] = value
  }
  return result
}

const clientFor = (url) => (url.protocol === 'https:' ? https : http)

const requestOptions = (req, target, { rewriteHost, websocket }) => ({
  protocol: target.protocol,
  hostname: target.hostname,
  port: target.port || defaultPort(target),
  method: req.method,
  path: buildTargetPath(target, req.url),
  headers: buildRequestHeaders(req, target, { rewriteHost, websocket }),
  agent: agentFor(target)
})

const handleHttpRequest = (req, res) => {
  const pathname = safePathname(req.url)
  const target = resolveTarget(pathname)
  const proxyReq = clientFor(target.url).request(
    requestOptions(req, target.url, target),
    (proxyRes) => {
      if (config.verbose) {
        log(`${req.method} ${req.url} -> ${target.name} ${proxyRes.statusCode}`)
      }

      if (res.headersSent) {
        proxyRes.resume()
        return
      }

      res.writeHead(
        proxyRes.statusCode || 502,
        proxyRes.statusMessage,
        filterResponseHeaders(proxyRes.headers)
      )
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('error', (err) => {
    const message = `failed to proxy ${req.method} ${req.url} to ${target.url.origin}: ${err.message}`
    if (res.headersSent) {
      logError(message)
      res.destroy()
      return
    }

    const hint =
      target.name === 'frontend'
        ? `Is the local dev server running at ${config.frontend.origin}?`
        : `Is the remote server reachable at ${config.target.origin}?`

    logError(message)
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`[dev-proxy] ${message}\n${hint}\n`)
  })

  // Client went away before we finished responding
  res.on('close', () => {
    if (!res.writableEnded) proxyReq.destroy()
  })

  req.pipe(proxyReq)
}

const serializeResponseHead = (statusCode, statusMessage, rawHeaders) => {
  let head = `HTTP/1.1 ${statusCode} ${statusMessage || ''}\r\n`
  for (let i = 0; i < rawHeaders.length; i += 2) {
    head += `${rawHeaders[i]}: ${rawHeaders[i + 1]}\r\n`
  }
  return `${head}\r\n`
}

const handleUpgrade = (req, socket, head) => {
  const pathname = safePathname(req.url)
  const target = resolveTarget(pathname)
  const proxyReq = clientFor(target.url).request(
    requestOptions(req, target.url, { ...target, websocket: true })
  )

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    if (config.verbose) log(`WS ${req.url} -> ${target.name} 101`)

    socket.write(
      serializeResponseHead(
        proxyRes.statusCode || 101,
        proxyRes.statusMessage,
        proxyRes.rawHeaders
      )
    )
    if (proxyHead && proxyHead.length) proxySocket.unshift(proxyHead)

    // Bytes of the client's websocket stream that arrived together with the upgrade
    // request - forward them before piping the rest through
    if (head && head.length) proxySocket.write(head)

    const closeBoth = () => {
      proxySocket.destroy()
      socket.destroy()
    }

    socket.on('error', closeBoth)
    proxySocket.on('error', closeBoth)
    socket.on('close', () => proxySocket.destroy())
    proxySocket.on('close', () => socket.destroy())

    socket.pipe(proxySocket).pipe(socket)
  })

  // Target refused the upgrade (e.g. plain HTTP answer) - relay it and stop
  proxyReq.on('response', (proxyRes) => {
    if (config.verbose) {
      log(`WS ${req.url} -> ${target.name} ${proxyRes.statusCode} (no upgrade)`)
    }
    socket.write(
      serializeResponseHead(
        proxyRes.statusCode || 502,
        proxyRes.statusMessage,
        proxyRes.rawHeaders
      )
    )
    proxyRes.pipe(socket)
    proxyRes.on('end', () => socket.end())
  })

  proxyReq.on('error', (err) => {
    logError(
      `failed to proxy websocket ${req.url} to ${target.url.origin}: ${err.message}`
    )
    socket.destroy()
  })

  socket.on('error', () => proxyReq.destroy())
  proxyReq.end()
}

const server = http.createServer(handleHttpRequest)
server.on('upgrade', handleUpgrade)
server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logError(
      `port ${config.port} is already in use - stop the process using it (or set DEV_PROXY_PORT) and try again`
    )
  } else {
    logError(`server error: ${err.message}`)
  }
  process.exit(1)
})

const shutdown = () => {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.listen(config.port, config.host, () => {
  log(`listening on http://${config.host}:${config.port}`)
  log(`  ${config.backendPaths.join(', ')}  ->  ${config.target.origin}`)
  log(`  everything else  ->  ${config.frontend.origin} (nuxt dev)`)
  if (config.localPaths.length) {
    log(
      `  ${config.localPaths.join(', ')}  ->  ${config.frontend.origin} (local route)`
    )
  }
})
