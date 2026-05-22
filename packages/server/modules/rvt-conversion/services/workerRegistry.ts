import WebSocket from 'ws'

export type RvtWorkerConnection = {
  workerId: string
  socket: WebSocket
  connectedAt: Date
  lastSeenAt: Date
  capabilities: string[]
  version: string | null
  assignedJobId: string | null
}

const workers = new Map<string, RvtWorkerConnection>()
const jobAssignments = new Map<string, string>()

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

  const worker: RvtWorkerConnection = {
    workerId: params.workerId,
    socket: params.socket,
    connectedAt: existing?.connectedAt || now,
    lastSeenAt: now,
    capabilities: params.capabilities || existing?.capabilities || ['rvt'],
    version: params.version ?? existing?.version ?? null,
    assignedJobId: existing?.assignedJobId || null
  }

  workers.set(params.workerId, worker)
  return worker
}

export const unregisterRvtWorker = (params: { workerId: string; socket: WebSocket }) => {
  const existing = workers.get(params.workerId)
  if (!existing || existing.socket !== params.socket) return

  if (existing.assignedJobId) {
    jobAssignments.delete(existing.assignedJobId)
  }

  workers.delete(params.workerId)
}

export const touchRvtWorker = (params: {
  workerId: string
  capabilities?: string[]
  version?: string | null
}) => {
  const existing = workers.get(params.workerId)
  if (!existing) return null

  existing.lastSeenAt = new Date()
  if (params.capabilities?.length) {
    existing.capabilities = params.capabilities
  }
  if (params.version !== undefined) {
    existing.version = params.version
  }

  return existing
}

export const getAvailableRvtWorker = () => {
  for (const worker of workers.values()) {
    if (worker.assignedJobId) continue
    if (worker.socket.readyState !== WebSocket.OPEN) continue
    return worker
  }

  return null
}

export const assignRvtWorkerJob = (params: { workerId: string; jobId: string }) => {
  const worker = workers.get(params.workerId)
  if (!worker) return null

  worker.assignedJobId = params.jobId
  worker.lastSeenAt = new Date()
  jobAssignments.set(params.jobId, params.workerId)
  return worker
}

export const releaseRvtWorkerJob = (params: { jobId: string }) => {
  const workerId = jobAssignments.get(params.jobId)
  if (!workerId) return null

  jobAssignments.delete(params.jobId)
  const worker = workers.get(workerId)
  if (!worker) return null

  if (worker.assignedJobId === params.jobId) {
    worker.assignedJobId = null
    worker.lastSeenAt = new Date()
  }

  return worker
}

export const listRvtWorkers = () => Array.from(workers.values())
