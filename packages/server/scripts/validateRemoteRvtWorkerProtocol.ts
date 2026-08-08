import WebSocket from 'ws'

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

type JsonObject = { [key: string]: JsonValue }

type RelayClientInfo = {
  id: string
  ip?: string
  connectedAt?: number | string
}

type AdminClientsListMessage = {
  type: 'clients_list'
  data: RelayClientInfo[]
}

type AdminIncomingMessage = {
  type: 'msg'
  from: string
  data: JsonValue
}

type CliArgs = {
  wsBaseUrl: string
  adminSecret: string
  targetClientId?: string
  waitMs: number
  sourceFileUrl: string
  speckleServerUrl: string
  speckleToken: string
  speckleTokenId: string
}

type ValidationIssue = {
  messageType: string
  reason: string
  payload: JsonValue
}

type StartMessage = {
  type: 'start_rvt_conversion'
  taskId: string
  workerId: string
  projectId: string
  modelId: string
  fileId: string
  fileName: string
  sourceFileUrl: string
  speckleServerUrl: string
  speckleToken: string
  speckleTokenId: string
  versionMessage: string | null
  sourceApplication: string
  branchName?: string | null
}

const DEFAULT_WS_BASE_URL = process.env.RVT_CONVERSION_RELAY_URL || 'ws://47.100.77.97:9700/ws'
const DEFAULT_ADMIN_SECRET = process.env.RVT_CONVERSION_RELAY_ADMIN_SECRET || 'admin123'
const DEFAULT_WAIT_MS = 60000
const DEFAULT_SOURCE_FILE_URL =
  process.env.RVT_CONVERSION_TEST_SOURCE_URL || 'https://example.com/sample.rvt'
const DEFAULT_SPECKLE_SERVER_URL =
  process.env.RVT_CONVERSION_TEST_SPECKLE_SERVER_URL || 'http://127.0.0.1:3000'
const DEFAULT_SPECKLE_TOKEN = process.env.RVT_CONVERSION_TEST_SPECKLE_TOKEN || 'test-token'
const DEFAULT_SPECKLE_TOKEN_ID =
  process.env.RVT_CONVERSION_TEST_SPECKLE_TOKEN_ID || 'test-token-id'

const usage = `Usage:
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/validateRemoteRvtWorkerProtocol.ts
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/validateRemoteRvtWorkerProtocol.ts --target-client-id=my-worker
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/validateRemoteRvtWorkerProtocol.ts --source-file-url=https://example.com/model.rvt --speckle-server-url=http://host.docker.internal:3000

Options:
  --ws-base-url         Relay websocket base url. Default: ${DEFAULT_WS_BASE_URL}
  --admin-secret        Relay admin secret. Default: ${DEFAULT_ADMIN_SECRET}
  --target-client-id    Specific worker/client id to target. Default: first connected client
  --wait-ms             Time to wait for ack/progress/result. Default: ${DEFAULT_WAIT_MS}
  --source-file-url     URL sent in start_rvt_conversion. Default: ${DEFAULT_SOURCE_FILE_URL}
  --speckle-server-url  URL sent in start_rvt_conversion. Default: ${DEFAULT_SPECKLE_SERVER_URL}
  --speckle-token       Token sent in start_rvt_conversion. Default: env or test-token
  --speckle-token-id    Token id sent in start_rvt_conversion. Default: env or test-token-id
  --help                Show usage
`

const hasFlag = (flag: string) => process.argv.includes(flag)

const getArgValue = (flag: string): string | undefined => {
  const args = process.argv.slice(2)
  const byEquals = args.find((arg) => arg.startsWith(`${flag}=`))
  if (byEquals) return byEquals.slice(flag.length + 1)

  const index = args.findIndex((arg) => arg === flag)
  if (index === -1) return undefined
  return args[index + 1]
}

const getRequiredArgs = (): CliArgs => {
  if (hasFlag('--help')) {
    process.stdout.write(`${usage}\n`)
    process.exit(0)
  }

  const waitRaw = getArgValue('--wait-ms') || String(DEFAULT_WAIT_MS)
  const waitMs = Number(waitRaw)
  if (!Number.isFinite(waitMs) || waitMs <= 0) {
    throw new Error(`Invalid --wait-ms value: ${waitRaw}`)
  }

  return {
    wsBaseUrl: (getArgValue('--ws-base-url') || DEFAULT_WS_BASE_URL).trim(),
    adminSecret: (getArgValue('--admin-secret') || DEFAULT_ADMIN_SECRET).trim(),
    targetClientId: getArgValue('--target-client-id')?.trim(),
    waitMs,
    sourceFileUrl: (getArgValue('--source-file-url') || DEFAULT_SOURCE_FILE_URL).trim(),
    speckleServerUrl: (
      getArgValue('--speckle-server-url') || DEFAULT_SPECKLE_SERVER_URL
    ).trim(),
    speckleToken: (getArgValue('--speckle-token') || DEFAULT_SPECKLE_TOKEN).trim(),
    speckleTokenId: (getArgValue('--speckle-token-id') || DEFAULT_SPECKLE_TOKEN_ID).trim()
  }
}

const parseJson = (raw: WebSocket.RawData): JsonObject | null => {
  try {
    const parsed = JSON.parse(raw.toString()) as JsonValue
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
    return parsed as JsonObject
  } catch {
    return null
  }
}

const isRecord = (value: JsonValue | unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isValidPercent = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100

const isValidCounter = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const validateAckPayload = (
  payload: JsonValue,
  expectedTaskId: string
): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (!isRecord(payload)) {
    return [{ messageType: 'rvt_conversion_ack', reason: 'payload 不是对象', payload }]
  }
  if (payload.type !== 'rvt_conversion_ack') {
    return [{ messageType: 'rvt_conversion_ack', reason: 'type 不是 rvt_conversion_ack', payload }]
  }
  if (payload.taskId !== expectedTaskId) {
    issues.push({
      messageType: 'rvt_conversion_ack',
      reason: `taskId 不匹配，期望 ${expectedTaskId}，实际 ${String(payload.taskId)}`,
      payload
    })
  }
  if (payload.externalTaskId !== undefined && !isNonEmptyString(payload.externalTaskId)) {
    issues.push({
      messageType: 'rvt_conversion_ack',
      reason: 'externalTaskId 如果存在，必须是非空字符串',
      payload
    })
  }
  return issues
}

const validateProgressPayload = (
  payload: JsonValue,
  expectedTaskId: string
): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (!isRecord(payload)) {
    return [{ messageType: 'rvt_conversion_progress', reason: 'payload 不是对象', payload }]
  }
  if (payload.type !== 'rvt_conversion_progress') {
    return [
      { messageType: 'rvt_conversion_progress', reason: 'type 不是 rvt_conversion_progress', payload }
    ]
  }
  if (payload.taskId !== expectedTaskId) {
    issues.push({
      messageType: 'rvt_conversion_progress',
      reason: `taskId 不匹配，期望 ${expectedTaskId}，实际 ${String(payload.taskId)}`,
      payload
    })
  }
  if (!isNonEmptyString(payload.phase)) {
    issues.push({
      messageType: 'rvt_conversion_progress',
      reason: 'phase 必须是非空字符串',
      payload
    })
  }
  if (!isValidPercent(payload.progress)) {
    issues.push({
      messageType: 'rvt_conversion_progress',
      reason: 'progress 必须是 0-100 的数字',
      payload
    })
  }
  if (!isNonEmptyString(payload.message)) {
    issues.push({
      messageType: 'rvt_conversion_progress',
      reason: 'message 必须是非空字符串',
      payload
    })
  }
  if (payload.externalTaskId !== undefined && !isNonEmptyString(payload.externalTaskId)) {
    issues.push({
      messageType: 'rvt_conversion_progress',
      reason: 'externalTaskId 如果存在，必须是非空字符串',
      payload
    })
  }

  const hasCurrent = payload.current !== undefined
  const hasTotal = payload.total !== undefined
  if (hasCurrent !== hasTotal) {
    issues.push({
      messageType: 'rvt_conversion_progress',
      reason: 'current 和 total 必须同时出现，或者同时不出现',
      payload
    })
  }
  if (hasCurrent && !isValidCounter(payload.current)) {
    issues.push({
      messageType: 'rvt_conversion_progress',
      reason: 'current 必须是大于等于 0 的数字',
      payload
    })
  }
  if (hasTotal && !isValidCounter(payload.total)) {
    issues.push({
      messageType: 'rvt_conversion_progress',
      reason: 'total 必须是大于等于 0 的数字',
      payload
    })
  }
  if (
    hasCurrent &&
    hasTotal &&
    isValidCounter(payload.current) &&
    isValidCounter(payload.total) &&
    payload.current > payload.total
  ) {
    issues.push({
      messageType: 'rvt_conversion_progress',
      reason: 'current 不能大于 total',
      payload
    })
  }

  return issues
}

const validateResultPayload = (
  payload: JsonValue,
  expectedTaskId: string
): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (!isRecord(payload)) {
    return [{ messageType: 'rvt_conversion_result', reason: 'payload 不是对象', payload }]
  }
  if (payload.type !== 'rvt_conversion_result') {
    return [
      { messageType: 'rvt_conversion_result', reason: 'type 不是 rvt_conversion_result', payload }
    ]
  }
  if (payload.taskId !== expectedTaskId) {
    issues.push({
      messageType: 'rvt_conversion_result',
      reason: `taskId 不匹配，期望 ${expectedTaskId}，实际 ${String(payload.taskId)}`,
      payload
    })
  }
  if (payload.externalTaskId !== undefined && !isNonEmptyString(payload.externalTaskId)) {
    issues.push({
      messageType: 'rvt_conversion_result',
      reason: 'externalTaskId 如果存在，必须是非空字符串',
      payload
    })
  }

  if (payload.status === 'success') {
    if (!isNonEmptyString(payload.versionId)) {
      issues.push({
        messageType: 'rvt_conversion_result',
        reason: 'success 结果必须带非空 versionId',
        payload
      })
    }
  } else if (payload.status === 'failed') {
    if (!isNonEmptyString(payload.errorMessage)) {
      issues.push({
        messageType: 'rvt_conversion_result',
        reason: 'failed 结果必须带非空 errorMessage',
        payload
      })
    }
  } else {
    issues.push({
      messageType: 'rvt_conversion_result',
      reason: "status 必须是 'success' 或 'failed'",
      payload
    })
  }

  return issues
}

const closeSocket = async (socket: WebSocket | null) => {
  if (!socket) return
  if (socket.readyState === WebSocket.CLOSED) return

  await new Promise<void>((resolve) => {
    socket.once('close', () => resolve())
    socket.close()
  })
}

const openSocket = async (url: string) =>
  await new Promise<{ socket: WebSocket; bufferedMessages: JsonObject[] }>(
    (resolve, reject) => {
      const socket = new WebSocket(url)
      const bufferedMessages: JsonObject[] = []

      socket.on('message', (raw) => {
        const payload = parseJson(raw)
        if (!payload) return
        bufferedMessages.push(payload)
      })

      socket.once('open', () => resolve({ socket, bufferedMessages }))
      socket.once('error', (error) => reject(error))
    }
  )

const waitForInitialClientsList = async (
  socket: WebSocket,
  bufferedMessages: JsonObject[],
  waitMs: number
) => {
  const existing = bufferedMessages.find(
    (item): item is AdminClientsListMessage => item.type === 'clients_list'
  )

  if (existing) {
    return existing.data
  }

  return await new Promise<RelayClientInfo[]>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Waiting initial clients_list timed out after ${waitMs}ms`)),
      waitMs
    )

    const handler = (raw: WebSocket.RawData) => {
      const payload = parseJson(raw) as AdminClientsListMessage | null
      if (!payload || payload.type !== 'clients_list') return
      clearTimeout(timer)
      socket.off('message', handler)
      resolve(payload.data)
    }

    socket.on('message', handler)
  })
}

const waitForTargetClient = async (params: {
  socket: WebSocket
  bufferedMessages: JsonObject[]
  waitMs: number
  targetClientId?: string
}) => {
  const findClient = (clients: RelayClientInfo[]) =>
    params.targetClientId
      ? clients.find((item) => item.id === params.targetClientId) || null
      : clients[0] || null

  const existingClients = params.bufferedMessages
    .filter((item): item is AdminClientsListMessage => item.type === 'clients_list')
    .flatMap((item) => item.data)
  const existingClient = findClient(existingClients)
  if (existingClient) return existingClient

  return await new Promise<RelayClientInfo>((resolve, reject) => {
    const timer = setTimeout(() => {
      params.socket.off('message', handler)
      reject(
        new Error(
          params.targetClientId
            ? `Waiting target client ${params.targetClientId} timed out after ${params.waitMs}ms`
            : `Waiting any client timed out after ${params.waitMs}ms`
        )
      )
    }, params.waitMs)

    const handler = (raw: WebSocket.RawData) => {
      const payload = parseJson(raw) as AdminClientsListMessage | null
      if (!payload || payload.type !== 'clients_list') return
      const client = findClient(payload.data)
      if (!client) return
      clearTimeout(timer)
      params.socket.off('message', handler)
      resolve(client)
    }

    params.socket.on('message', handler)
  })
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const buildStartMessage = (targetClientId: string, args: CliArgs): StartMessage => {
  const now = Date.now()
  return {
    type: 'start_rvt_conversion',
    taskId: `job-${now}`,
    workerId: targetClientId,
    projectId: 'protocol-test-project',
    modelId: 'protocol-test-model',
    fileId: `file-${now}`,
    fileName: 'protocol-test-model.rvt',
    sourceFileUrl: args.sourceFileUrl,
    speckleServerUrl: args.speckleServerUrl,
    speckleToken: args.speckleToken,
    speckleTokenId: args.speckleTokenId,
    versionMessage: 'Protocol validation run',
    sourceApplication: 'RVT Protocol Validator'
  }
}

const main = async () => {
  const args = getRequiredArgs()
  const adminUrl = new URL(args.wsBaseUrl)
  adminUrl.searchParams.set('role', 'admin')
  adminUrl.searchParams.set('secret', args.adminSecret)

  let adminSocket: WebSocket | null = null

  try {
    console.log(`Connecting admin socket: ${adminUrl.toString()}`)
    const opened = await openSocket(adminUrl.toString())
    adminSocket = opened.socket
    console.log('Admin socket connected')

    const initialClients = await waitForInitialClientsList(
      adminSocket,
      opened.bufferedMessages,
      5000
    )
    console.log('Initial clients:', initialClients)
    const targetClient = await waitForTargetClient({
      socket: adminSocket,
      bufferedMessages: opened.bufferedMessages,
      waitMs: args.waitMs,
      targetClientId: args.targetClientId
    })

    const startMessage = buildStartMessage(targetClient.id, args)
    console.log('Sending start_rvt_conversion:', startMessage)
    adminSocket.send(
      JSON.stringify({
        target: targetClient.id,
        data: startMessage
      })
    )

    const issues: ValidationIssue[] = []
    const received: JsonValue[] = []
    let sawAck = false
    let sawProgress = false
    let sawResult = false

    const deadline = Date.now() + args.waitMs

    while (Date.now() < deadline && !sawResult) {
      const remaining = Math.max(deadline - Date.now(), 1)
      const nextMessage = await new Promise<AdminIncomingMessage | null>((resolve) => {
        const timer = setTimeout(() => {
          adminSocket?.off('message', handler)
          resolve(null)
        }, remaining)

        const handler = (raw: WebSocket.RawData) => {
          const payload = parseJson(raw) as AdminIncomingMessage | AdminClientsListMessage | null
          if (!payload) return
          if (payload.type !== 'msg') return
          if (payload.from !== targetClient.id) return
          clearTimeout(timer)
          adminSocket?.off('message', handler)
          resolve(payload)
        }

        adminSocket?.on('message', handler)
      })

      if (!nextMessage) break
      received.push(nextMessage.data)
      console.log('Received worker payload:', nextMessage.data)

      const messageRecord = isRecord(nextMessage.data) ? nextMessage.data : null
      const type = messageRecord?.type

      if (type === 'rvt_conversion_ack') {
        sawAck = true
        issues.push(...validateAckPayload(nextMessage.data, startMessage.taskId))
        continue
      }

      if (type === 'rvt_conversion_progress') {
        sawProgress = true
        issues.push(...validateProgressPayload(nextMessage.data, startMessage.taskId))
        continue
      }

      if (type === 'rvt_conversion_result') {
        sawResult = true
        issues.push(...validateResultPayload(nextMessage.data, startMessage.taskId))
        continue
      }

      issues.push({
        messageType: 'unknown',
        reason: `收到未知消息类型: ${String(type)}`,
        payload: nextMessage.data
      })
    }

    if (!sawAck) {
      issues.push({
        messageType: 'rvt_conversion_ack',
        reason: '在等待窗口内没有收到 ack',
        payload: null
      })
    }
    if (!sawProgress) {
      issues.push({
        messageType: 'rvt_conversion_progress',
        reason: '在等待窗口内没有收到 progress',
        payload: null
      })
    }
    if (!sawResult) {
      issues.push({
        messageType: 'rvt_conversion_result',
        reason: '在等待窗口内没有收到 result',
        payload: null
      })
    }

    console.log(
      JSON.stringify(
        {
          ok: issues.length === 0,
          targetClient,
          startMessage,
          received,
          issues
        },
        null,
        2
      )
    )

    if (issues.length) {
      process.exitCode = 1
    }

    await sleep(100)
  } finally {
    await closeSocket(adminSocket)
  }
}

main().catch((error) => {
  console.error('Remote RVT worker protocol validation failed')
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
