import WebSocket from 'ws'
import {
  removeWorkerFromCluster,
  syncWorkerToCluster,
  touchWorkerInCluster
} from '@/modules/rvt-conversion/services/clusterRegistry'

export type RvtWorkerConnection = {
  workerId: string
  socket: WebSocket
  connectedAt: Date
  lastSeenAt: Date
  capabilities: string[]
  version: string | null
}

const workers = new Map<string, RvtWorkerConnection>()

const normalizeCapabilities = (capabilities?: string[]): string[] | null => {
  if (!capabilities || !capabilities.length) return null
  const normalized = capabilities
    .map((c) => (typeof c === 'string' ? c.trim().toLowerCase() : ''))
    .filter(Boolean)
  return normalized.length ? normalized : null
}

export const registerRvtWorker = (params: {
  workerId: string
  socket: WebSocket
  capabilities?: string[]
  version?: string | null
}) => {
  const now = new Date()
  const existing = workers.get(params.workerId)

  if (existing && existing.socket !== params.socket) {
    existing.socket.close()
  }

  const normalizedCaps = normalizeCapabilities(params.capabilities)
  const worker: RvtWorkerConnection = {
    workerId: params.workerId,
    socket: params.socket,
    connectedAt: existing?.connectedAt || now,
    lastSeenAt: now,
    capabilities: normalizedCaps || existing?.capabilities || ['rvt'],
    version: params.version ?? existing?.version ?? null
  }

  workers.set(params.workerId, worker)
  void syncWorkerToCluster({
    workerId: worker.workerId,
    capabilities: worker.capabilities,
    version: worker.version
  }).catch(() => undefined)

  return worker
}

export const unregisterRvtWorker = (params: {
  workerId: string
  socket: WebSocket
}) => {
  const existing = workers.get(params.workerId)
  if (!existing || existing.socket !== params.socket) return

  workers.delete(params.workerId)
  void removeWorkerFromCluster({ workerId: params.workerId }).catch(() => undefined)
}

export const touchRvtWorker = (params: {
  workerId: string
  capabilities?: string[]
  version?: string | null
}) => {
  const existing = workers.get(params.workerId)
  if (!existing) return null

  existing.lastSeenAt = new Date()
  const normalizedCaps = normalizeCapabilities(params.capabilities)
  if (normalizedCaps?.length) {
    existing.capabilities = normalizedCaps
  }
  if (params.version !== undefined) {
    existing.version = params.version
  }

  void touchWorkerInCluster({
    workerId: existing.workerId,
    capabilities: existing.capabilities,
    version: existing.version
  }).catch(() => undefined)

  return existing
}

export const listOpenRvtWorkers = () =>
  Array.from(workers.values()).filter(
    (worker) => worker.socket.readyState === WebSocket.OPEN
  )

export const listRvtWorkers = () => Array.from(workers.values())
