export type RvtConversionAckMessage = {
  type: 'rvt_conversion_ack'
  taskId: string
  projectId?: string
  externalTaskId?: string
}

export type RvtConversionProgressMessage = {
  type: 'rvt_conversion_progress'
  taskId: string
  projectId?: string
  phase: string
  progress: number
  message: string
  externalTaskId?: string
  current?: number
  total?: number
}

export type RvtConversionResultMessage =
  | {
      type: 'rvt_conversion_result'
      taskId: string
      projectId?: string
      status: 'success'
      externalTaskId?: string
      versionId: string
    }
  | {
      type: 'rvt_conversion_result'
      taskId: string
      projectId?: string
      status: 'failed'
      externalTaskId?: string
      errorMessage: string
    }

export type RvtConversionLifecycleMessage =
  | RvtConversionAckMessage
  | RvtConversionProgressMessage
  | RvtConversionResultMessage

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isValidProgress = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100

const isValidCounter = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export const parseRvtConversionAckMessage = (raw: unknown): RvtConversionAckMessage | null => {
  let payload: unknown = raw

  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }

  if (!isRecord(payload)) return null
  if (payload.type !== 'rvt_conversion_ack') return null
  if (!isNonEmptyString(payload.taskId)) return null
  if (payload.projectId !== undefined && !isNonEmptyString(payload.projectId)) {
    return null
  }
  if (
    payload.externalTaskId !== undefined &&
    !isNonEmptyString(payload.externalTaskId)
  ) {
    return null
  }

  return {
    type: 'rvt_conversion_ack',
    taskId: payload.taskId,
    ...(payload.projectId ? { projectId: payload.projectId } : {}),
    ...(payload.externalTaskId ? { externalTaskId: payload.externalTaskId } : {})
  }
}

export const parseRvtConversionProgressMessage = (
  raw: unknown
): RvtConversionProgressMessage | null => {
  let payload: unknown = raw

  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }

  if (!isRecord(payload)) return null
  if (payload.type !== 'rvt_conversion_progress') return null
  if (!isNonEmptyString(payload.taskId)) return null
  if (payload.projectId !== undefined && !isNonEmptyString(payload.projectId)) return null
  if (!isNonEmptyString(payload.phase)) return null
  if (!isValidProgress(payload.progress)) return null
  if (!isNonEmptyString(payload.message)) return null

  if (
    payload.externalTaskId !== undefined &&
    !isNonEmptyString(payload.externalTaskId)
  ) {
    return null
  }

  const hasCurrent = payload.current !== undefined
  const hasTotal = payload.total !== undefined

  if (hasCurrent !== hasTotal) return null
  if (hasCurrent && !isValidCounter(payload.current)) return null
  if (hasTotal && !isValidCounter(payload.total)) return null
  if (hasCurrent && hasTotal && payload.current! > payload.total!) return null

  return {
    type: 'rvt_conversion_progress',
    taskId: payload.taskId,
    ...(payload.projectId ? { projectId: payload.projectId } : {}),
    phase: payload.phase,
    progress: payload.progress,
    message: payload.message,
    ...(payload.externalTaskId ? { externalTaskId: payload.externalTaskId } : {}),
    ...(hasCurrent ? { current: payload.current as number } : {}),
    ...(hasTotal ? { total: payload.total as number } : {})
  }
}

export const parseRvtConversionResultMessage = (
  raw: unknown
): RvtConversionResultMessage | null => {
  let payload: unknown = raw

  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }

  if (!isRecord(payload)) return null
  if (payload.type !== 'rvt_conversion_result') return null
  if (!isNonEmptyString(payload.taskId)) return null
  if (payload.projectId !== undefined && !isNonEmptyString(payload.projectId)) {
    return null
  }
  if (
    payload.externalTaskId !== undefined &&
    !isNonEmptyString(payload.externalTaskId)
  ) {
    return null
  }

  if (payload.status === 'success') {
    if (!isNonEmptyString(payload.versionId)) return null
    return {
      type: 'rvt_conversion_result',
      taskId: payload.taskId,
      ...(payload.projectId ? { projectId: payload.projectId } : {}),
      status: 'success',
      ...(payload.externalTaskId ? { externalTaskId: payload.externalTaskId } : {}),
      versionId: payload.versionId
    }
  }

  if (payload.status === 'failed') {
    if (!isNonEmptyString(payload.errorMessage)) return null
    return {
      type: 'rvt_conversion_result',
      taskId: payload.taskId,
      ...(payload.projectId ? { projectId: payload.projectId } : {}),
      status: 'failed',
      ...(payload.externalTaskId ? { externalTaskId: payload.externalTaskId } : {}),
      errorMessage: payload.errorMessage
    }
  }

  return null
}

export const parseRvtConversionLifecycleMessage = (
  raw: unknown
): RvtConversionLifecycleMessage | null =>
  parseRvtConversionAckMessage(raw) ||
  parseRvtConversionProgressMessage(raw) ||
  parseRvtConversionResultMessage(raw)
