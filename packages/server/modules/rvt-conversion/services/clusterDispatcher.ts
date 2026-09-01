import { randomUUID } from 'crypto'
import type Redis from 'ioredis'
import { getRedisUrl } from '@/modules/shared/helpers/envHelper'
import { createRedisClient, getGenericRedis } from '@/modules/shared/redis/redis'
import { createRvtConvertLogger } from '@/modules/rvt-conversion/services/logging'
import { listOpenRvtWorkers } from '@/modules/rvt-conversion/services/workerRegistry'
import { CLUSTER_INSTANCE_ID } from '@/modules/rvt-conversion/services/clusterRegistry'

const logger = createRvtConvertLogger('cluster-dispatcher')

const CHANNEL_DISPATCH_JOB = 'speckle:rvt:cluster_dispatch_job'
const CHANNEL_DISPATCH_ACK = 'speckle:rvt:cluster_dispatch_ack'
const DISPATCH_TIMEOUT_MS = 5000

export type ClusterDispatchJobMessage = {
  dispatchId: string
  targetWorkerIds: string[]
  targetFileType: string
  payload: Record<string, unknown>
  createdAt: string
  originInstanceId: string
}

export type ClusterDispatchAckMessage = {
  dispatchId: string
  workerId: string
  handledInstanceId: string
  success: boolean
  error?: string
}

type PendingDispatch = {
  dispatchId: string
  targetWorkerIds: string[]
  succeededWorkerIds: string[]
  resolve: (workerIds: string[]) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

const pendingDispatches = new Map<string, PendingDispatch>()
let subscriberClient: Redis | null = null

const handleClusterDispatchJob = async (message: ClusterDispatchJobMessage) => {
  const allOpenWorkers = listOpenRvtWorkers()
  const matchingLocalWorkers = allOpenWorkers.filter((worker) => {
    if (message.targetWorkerIds && message.targetWorkerIds.length > 0) {
      return message.targetWorkerIds.includes(worker.workerId)
    }
    const caps = worker.capabilities.map((c) => c.toLowerCase())
    return (
      caps.includes(message.targetFileType.toLowerCase()) ||
      caps.includes('*') ||
      caps.includes('all')
    )
  })

  if (!matchingLocalWorkers.length) {
    return
  }

  logger.info(
    {
      dispatchId: message.dispatchId,
      matchingLocalWorkerCount: matchingLocalWorkers.length,
      matchingLocalWorkerIds: matchingLocalWorkers.map((w) => w.workerId),
      instanceId: CLUSTER_INSTANCE_ID
    },
    'RVT_CONVERT cluster dispatch job matched local workers, sending over WebSocket'
  )

  const redis = getGenericRedis()

  await Promise.all(
    matchingLocalWorkers.map(async (worker) => {
      const payloadToSend = {
        ...message.payload,
        workerId: worker.workerId
      }

      await new Promise<void>((resolve) => {
        try {
          worker.socket.send(JSON.stringify(payloadToSend), (sendError) => {
            const ackMessage: ClusterDispatchAckMessage = {
              dispatchId: message.dispatchId,
              workerId: worker.workerId,
              handledInstanceId: CLUSTER_INSTANCE_ID,
              success: !sendError,
              error: sendError ? sendError.message : undefined
            }
            void redis
              .publish(CHANNEL_DISPATCH_ACK, JSON.stringify(ackMessage))
              .catch(() => undefined)

            if (sendError) {
              logger.error(
                {
                  err: sendError,
                  workerId: worker.workerId,
                  dispatchId: message.dispatchId
                },
                'RVT_CONVERT failed to send cluster-dispatched job to local worker socket'
              )
            } else {
              logger.info(
                { workerId: worker.workerId, dispatchId: message.dispatchId },
                'RVT_CONVERT cluster-dispatched job sent to local worker socket successfully'
              )
            }
            resolve()
          })
        } catch (error) {
          const ackMessage: ClusterDispatchAckMessage = {
            dispatchId: message.dispatchId,
            workerId: worker.workerId,
            handledInstanceId: CLUSTER_INSTANCE_ID,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown socket error'
          }
          void redis
            .publish(CHANNEL_DISPATCH_ACK, JSON.stringify(ackMessage))
            .catch(() => undefined)
          resolve()
        }
      })
    })
  )
}

const handleClusterDispatchAck = (ack: ClusterDispatchAckMessage) => {
  const pending = pendingDispatches.get(ack.dispatchId)
  if (!pending) return

  if (ack.success) {
    pending.succeededWorkerIds.push(ack.workerId)
    clearTimeout(pending.timer)
    pendingDispatches.delete(ack.dispatchId)
    pending.resolve(pending.succeededWorkerIds)
  }
}

export const initClusterDispatcher = () => {
  if (subscriberClient) return

  try {
    const redisUrl = getRedisUrl()
    subscriberClient = createRedisClient(redisUrl, {})

    void subscriberClient.subscribe(
      CHANNEL_DISPATCH_JOB,
      CHANNEL_DISPATCH_ACK,
      (err) => {
        if (err) {
          logger.warn({ err }, 'Failed to subscribe to RVT conversion cluster channels')
        } else {
          logger.info(
            { instanceId: CLUSTER_INSTANCE_ID },
            'RVT_CONVERT cluster dispatcher subscribed to Redis channels'
          )
        }
      }
    )

    subscriberClient.on('message', (channel, rawMessage) => {
      try {
        if (channel === CHANNEL_DISPATCH_JOB) {
          const data = JSON.parse(rawMessage) as ClusterDispatchJobMessage
          void handleClusterDispatchJob(data)
        } else if (channel === CHANNEL_DISPATCH_ACK) {
          const data = JSON.parse(rawMessage) as ClusterDispatchAckMessage
          handleClusterDispatchAck(data)
        }
      } catch (error) {
        logger.warn({ err: error, channel }, 'Failed to process cluster Redis message')
      }
    })
  } catch (error) {
    logger.warn(
      { err: error },
      'Could not initialize RVT cluster dispatcher subscriber'
    )
  }
}

export const broadcastJobToCluster = async (params: {
  targetWorkerIds: string[]
  targetFileType: string
  payload: Record<string, unknown>
}): Promise<string[]> => {
  const redis = getGenericRedis()
  const dispatchId = randomUUID()

  const message: ClusterDispatchJobMessage = {
    dispatchId,
    targetWorkerIds: params.targetWorkerIds,
    targetFileType: params.targetFileType,
    payload: params.payload,
    createdAt: new Date().toISOString(),
    originInstanceId: CLUSTER_INSTANCE_ID
  }

  return new Promise<string[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      const pending = pendingDispatches.get(dispatchId)
      pendingDispatches.delete(dispatchId)
      if (pending && pending.succeededWorkerIds.length > 0) {
        resolve(pending.succeededWorkerIds)
      } else {
        reject(
          new Error(
            `Timed out waiting for cluster worker confirmation for file type: ${params.targetFileType}`
          )
        )
      }
    }, DISPATCH_TIMEOUT_MS)

    pendingDispatches.set(dispatchId, {
      dispatchId,
      targetWorkerIds: params.targetWorkerIds,
      succeededWorkerIds: [],
      resolve,
      reject,
      timer
    })

    redis
      .publish(CHANNEL_DISPATCH_JOB, JSON.stringify(message))
      .then((receiverCount) => {
        logger.info(
          { dispatchId, receiverCount, targetWorkerIds: params.targetWorkerIds },
          'RVT_CONVERT cluster dispatch job broadcast published to Redis'
        )
      })
      .catch((error) => {
        clearTimeout(timer)
        pendingDispatches.delete(dispatchId)
        reject(
          error instanceof Error
            ? error
            : new Error('Failed to publish dispatch to Redis')
        )
      })
  })
}

export const shutdownClusterDispatcher = async () => {
  if (!subscriberClient) return

  try {
    await subscriberClient.unsubscribe()
    subscriberClient.disconnect()
  } catch {
    // ignore shutdown errors
  }
  subscriberClient = null

  for (const [, pending] of pendingDispatches) {
    clearTimeout(pending.timer)
    pending.reject(new Error('Cluster dispatcher shutting down'))
  }
  pendingDispatches.clear()
}
