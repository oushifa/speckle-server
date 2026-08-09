import type http from 'http'
import { randomUUID } from 'crypto'
import { WebSocketServer } from 'ws'
import {
  acknowledgeRvtConversionJob,
  completeRvtConversionJob,
  progressRvtConversionJob
} from '@/modules/rvt-conversion/services/lifecycle'
import {
  parseRvtConversionAckMessage,
  parseRvtConversionProgressMessage,
  parseRvtConversionResultMessage,
  type RvtConversionAckMessage,
  type RvtConversionProgressMessage,
  type RvtConversionResultMessage
} from '@/modules/rvt-conversion/services/progressMessages'
import {
  createRvtConvertLogger,
  getWorkerRequestLogContext,
  summarizeRawWsMessage
} from '@/modules/rvt-conversion/services/logging'
import {
  getTrackedRvtConversionTask,
  untrackRvtConversionTask
} from '@/modules/rvt-conversion/services/taskRegistry'
import {
  registerRvtWorker,
  touchRvtWorker,
  unregisterRvtWorker
} from '@/modules/rvt-conversion/services/workerRegistry'

const RvtConversionWsPath = '/api/ws/rvt-conversion'
const wsLogger = createRvtConvertLogger('ws-server')

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

type WorkerMessage =
  | WorkerRegisterMessage
  | WorkerHeartbeatMessage
  | RvtConversionAckMessage
  | RvtConversionProgressMessage
  | RvtConversionResultMessage

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
    return (
      parseRvtConversionAckMessage(data) ||
      parseRvtConversionProgressMessage(data) ||
      parseRvtConversionResultMessage(data)
    )
  } catch {
    return null
  }
}

const resolveProjectIdForTask = (message: { taskId: string; projectId?: string }) =>
  message.projectId || getTrackedRvtConversionTask(message.taskId)?.projectId || null

export const initRvtConversionWsServer = () => {
  if (rvtConversionWsServer) return rvtConversionWsServer

  const wsServer = new WebSocketServer({ noServer: true })

  wsServer.on('connection', (socket, request) => {
    let workerId = getInitialWorkerId()
    registerRvtWorker({ workerId, socket })

    wsLogger.info(
      {
        workerId,
        ...getWorkerRequestLogContext(request)
      },
      'RVT_CONVERT worker connected'
    )

    socket.on('message', (raw) => {
      void (async () => {
        const message = safelyParseMessage(raw)
        if (!message) {
          wsLogger.warn(
            {
              workerId,
              rawMessage: summarizeRawWsMessage(raw)
            },
            'RVT_CONVERT worker message parse failed'
          )
          return
        }

        switch (message.type) {
          case 'worker_register': {
            wsLogger.info(
              {
                workerId,
                requestedWorkerId: message.workerId || null,
                capabilities: message.capabilities || [],
                version: message.version || null
              },
              'RVT_CONVERT worker register received'
            )
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
            wsLogger.info(
              {
                workerId,
                capabilities: message.capabilities || [],
                version: message.version || null
              },
              'RVT_CONVERT worker register applied'
            )
            break
          }
          case 'heartbeat':
            touchRvtWorker({ workerId: message.workerId || workerId })
            wsLogger.debug(
              {
                workerId,
                heartbeatWorkerId: message.workerId || workerId
              },
              'RVT_CONVERT worker heartbeat received'
            )
            break
          case 'rvt_conversion_ack': {
            touchRvtWorker({ workerId })
            wsLogger.info(
              {
                workerId,
                taskId: message.taskId,
                projectId: message.projectId || null,
                externalTaskId: message.externalTaskId || null
              },
              'RVT_CONVERT ack received from worker'
            )
            const projectId = resolveProjectIdForTask(message)
            if (!projectId) {
              wsLogger.warn(
                { workerId, taskId: message.taskId },
                'RVT_CONVERT ack received without resolvable projectId'
              )
              break
            }

            const job = await acknowledgeRvtConversionJob({
              projectId,
              taskId: message.taskId,
              externalTaskId: message.externalTaskId || null
            })
            if (!job) {
              wsLogger.warn(
                { workerId, projectId, taskId: message.taskId },
                'RVT_CONVERT ack received for missing job'
              )
            } else {
              wsLogger.info(
                {
                  workerId,
                  projectId,
                  taskId: message.taskId,
                  jobStatus: job.status,
                  externalTaskId: job.externalTaskId
                },
                'RVT_CONVERT ack processed successfully'
              )
            }
            break
          }
          case 'rvt_conversion_progress': {
            touchRvtWorker({ workerId })
            wsLogger.info(
              {
                workerId,
                taskId: message.taskId,
                projectId: message.projectId || null,
                externalTaskId: message.externalTaskId || null,
                phase: message.phase,
                progress: message.progress,
                current: message.current ?? null,
                total: message.total ?? null
              },
              'RVT_CONVERT progress received from worker'
            )
            const projectId = resolveProjectIdForTask(message)
            if (!projectId) {
              wsLogger.warn(
                { workerId, taskId: message.taskId, phase: message.phase },
                'RVT_CONVERT progress received without resolvable projectId'
              )
              break
            }

            const job = await progressRvtConversionJob({
              projectId,
              taskId: message.taskId,
              phase: message.phase,
              progress: message.progress,
              message: message.message,
              externalTaskId: message.externalTaskId || null,
              ...(message.current !== undefined ? { current: message.current } : {}),
              ...(message.total !== undefined ? { total: message.total } : {})
            })
            if (!job) {
              wsLogger.warn(
                {
                  workerId,
                  projectId,
                  taskId: message.taskId,
                  phase: message.phase
                },
                'RVT_CONVERT progress received for missing job'
              )
            } else if (job.status === 'succeeded' || job.status === 'failed') {
              wsLogger.info(
                {
                  workerId,
                  projectId,
                  taskId: message.taskId,
                  jobStatus: job.status,
                  phase: message.phase,
                  progress: message.progress
                },
                'RVT_CONVERT stale progress ignored because result was already received'
              )
            } else {
              wsLogger.info(
                {
                  workerId,
                  projectId,
                  taskId: message.taskId,
                  jobStatus: job.status,
                  phase: message.phase,
                  progress: message.progress
                },
                'RVT_CONVERT progress processed successfully'
              )
            }
            break
          }
          case 'rvt_conversion_result': {
            touchRvtWorker({ workerId })
            wsLogger.info(
              message.status === 'success'
                ? {
                    workerId,
                    taskId: message.taskId,
                    projectId: message.projectId || null,
                    externalTaskId: message.externalTaskId || null,
                    status: message.status,
                    versionId: message.versionId
                  }
                : {
                    workerId,
                    taskId: message.taskId,
                    projectId: message.projectId || null,
                    externalTaskId: message.externalTaskId || null,
                    status: message.status,
                    errorMessage: message.errorMessage
                  },
              'RVT_CONVERT result received from worker'
            )
            const projectId = resolveProjectIdForTask(message)
            if (!projectId) {
              wsLogger.warn(
                { workerId, taskId: message.taskId, status: message.status },
                'RVT_CONVERT result received without resolvable projectId'
              )
              break
            }

            const job = await completeRvtConversionJob(
              message.status === 'success'
                ? {
                    projectId,
                    taskId: message.taskId,
                    status: 'success',
                    externalTaskId: message.externalTaskId || null,
                    versionId: message.versionId
                  }
                : {
                    projectId,
                    taskId: message.taskId,
                    status: 'failed',
                    externalTaskId: message.externalTaskId || null,
                    errorMessage: message.errorMessage
                  }
            )
            if (!job) {
              wsLogger.warn(
                {
                  workerId,
                  projectId,
                  taskId: message.taskId,
                  status: message.status
                },
                'RVT_CONVERT result received for missing job'
              )
              break
            }

            untrackRvtConversionTask(message.taskId)
            wsLogger.info(
              {
                workerId,
                projectId,
                taskId: message.taskId,
                jobStatus: job.status,
                versionId: job.versionId,
                externalTaskId: job.externalTaskId
              },
              'RVT_CONVERT result processed successfully'
            )
            break
          }
        }
      })().catch((error) => {
        wsLogger.warn(
          { err: error, workerId },
          'RVT_CONVERT failed to handle worker message'
        )
      })
    })

    socket.on('close', () => {
      unregisterRvtWorker({ workerId, socket })
      wsLogger.info({ workerId }, 'RVT_CONVERT worker disconnected')
    })

    socket.on('error', (error) => {
      wsLogger.warn({ err: error, workerId }, 'RVT_CONVERT worker WebSocket error')
    })
  })

  rvtConversionWsServer = wsServer
  wsLogger.info(
    { path: RvtConversionWsPath },
    'RVT_CONVERT WebSocket server initialized'
  )
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
      wsLogger.warn(
        {
          ...getWorkerRequestLogContext(request)
        },
        'RVT_CONVERT worker WebSocket authorization rejected'
      )
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
  } catch (error) {
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
    socket.destroy()
    wsLogger.error(
      {
        err: error,
        ...getWorkerRequestLogContext(request)
      },
      'RVT_CONVERT failed to authorize worker WebSocket'
    )
    return
  }

  wsLogger.info(
    {
      ...getWorkerRequestLogContext(request)
    },
    'RVT_CONVERT worker WebSocket upgrade authorized'
  )

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
