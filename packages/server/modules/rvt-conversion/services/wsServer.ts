import { moduleLogger } from '@/observability/logging'
import type http from 'http'
import { randomUUID } from 'crypto'
import { WebSocketServer } from 'ws'
import {
  registerRvtWorker,
  touchRvtWorker,
  unregisterRvtWorker
} from '@/modules/rvt-conversion/services/workerRegistry'

const RvtConversionWsPath = '/api/ws/rvt-conversion'

type WorkerRegisterMessage = {
  type: 'worker_register'
  workerId?: string
  capabilities?: string[]
  version?: string | null
}

type WorkerHeartbeatMessage = {
  type: 'heartbeat'
  workerId?: string
}

type WorkerMessage = WorkerRegisterMessage | WorkerHeartbeatMessage

let rvtConversionWsServer: WebSocketServer | null = null

const isUpgradeRequestAuthorized = (request: http.IncomingMessage) => {
  const configuredToken = process.env['FILE_CONVERSION_SERVICE_TOKEN']
  if (!configuredToken) {
    throw new Error('FILE_CONVERSION_SERVICE_TOKEN is not configured.')
  }

  const requestUrl = new URL(request.url || '', 'http://localhost')
  const tokenFromQuery = requestUrl.searchParams.get('token')
  const tokenFromHeader = request.headers['x-rvt-worker-token']

  if (tokenFromQuery === configuredToken) return true
  if (typeof tokenFromHeader === 'string' && tokenFromHeader === configuredToken) {
    return true
  }

  return false
}

const getInitialWorkerId = () => `worker-${randomUUID()}`

const safelyParseMessage = (raw: unknown): WorkerMessage | null => {
  try {
    const data = JSON.parse(String(raw)) as Partial<WorkerMessage>
    if (!data.type) return null
    if (data.type === 'worker_register') return data as WorkerRegisterMessage
    if (data.type === 'heartbeat') return data as WorkerHeartbeatMessage
    return null
  } catch {
    return null
  }
}

export const initRvtConversionWsServer = () => {
  if (rvtConversionWsServer) return rvtConversionWsServer

  const wsServer = new WebSocketServer({ noServer: true })

  wsServer.on('connection', (socket, request) => {
    let workerId = getInitialWorkerId()
    registerRvtWorker({ workerId, socket })

    moduleLogger.info({ workerId }, 'RVT worker connected')

    socket.on('message', (raw) => {
      const message = safelyParseMessage(raw)
      if (!message) return

      switch (message.type) {
        case 'worker_register': {
          const nextWorkerId = message.workerId || workerId
          if (nextWorkerId !== workerId) {
            unregisterRvtWorker({ workerId, socket })
            workerId = nextWorkerId
            registerRvtWorker({
              workerId,
              socket,
              capabilities: message.capabilities,
              version: message.version
            })
          } else {
            touchRvtWorker({
              workerId,
              capabilities: message.capabilities,
              version: message.version
            })
          }
          break
        }
        case 'heartbeat':
          touchRvtWorker({ workerId: message.workerId || workerId })
          break
      }
    })

    socket.on('close', () => {
      unregisterRvtWorker({ workerId, socket })
      moduleLogger.info({ workerId }, 'RVT worker disconnected')
    })

    socket.on('error', (error) => {
      moduleLogger.warn({ err: error, workerId }, 'RVT worker WebSocket error')
    })
  })

  rvtConversionWsServer = wsServer
  moduleLogger.info({ path: RvtConversionWsPath }, 'RVT WebSocket server initialized')
  return wsServer
}

export const handleRvtConversionUpgrade = (
  request: http.IncomingMessage,
  socket: Parameters<WebSocketServer['handleUpgrade']>[1],
  head: Parameters<WebSocketServer['handleUpgrade']>[2]
) => {
  if (!rvtConversionWsServer) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n')
    socket.destroy()
    return
  }

  try {
    if (!isUpgradeRequestAuthorized(request)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
  } catch (error) {
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
    socket.destroy()
    moduleLogger.error({ err: error }, 'Failed to authorize RVT worker WebSocket')
    return
  }

  rvtConversionWsServer.handleUpgrade(request, socket, head, (ws) => {
    rvtConversionWsServer?.emit('connection', ws, request)
  })
}

export const shutdownRvtConversionWsServer = async () => {
  if (!rvtConversionWsServer) return

  await new Promise<void>((resolve, reject) => {
    rvtConversionWsServer?.close((error) => {
      if (error) return reject(error)
      resolve()
    })
  })

  rvtConversionWsServer = null
}

export const getRvtConversionWsPath = () => RvtConversionWsPath
