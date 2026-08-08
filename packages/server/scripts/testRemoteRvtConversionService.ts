import WebSocket from 'ws'

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

type JsonObject = { [key: string]: JsonValue }

type CliArgs = {
  wsUrl: string
  waitMs: number
  taskId: string
  projectId: string
  modelId: string
  fileId: string
  fileName: string
  sourceFileUrl: string
  speckleServerUrl: string
  speckleToken: string
  speckleTokenId: string
  versionMessage: string
  sourceApplication: string
  workerId: string
}

type ValidationIssue = {
  messageType: string
  reason: string
  payload: JsonValue
}

const DEFAULT_WS_URL =
  process.env.RVT_CONVERSION_SERVICE_WS_URL ||
  'ws://47.100.77.97:9700/ws?user=user_1c28b1'
const DEFAULT_WAIT_MS = 120000
const NOW = Date.now()

const usage = `Usage:
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/testRemoteRvtConversionService.ts
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/testRemoteRvtConversionService.ts --ws-url=ws://47.100.77.97:9700/ws?user=user_1c28b1

Options:
  --ws-url             Remote RVT conversion websocket URL. Default: ${DEFAULT_WS_URL}
  --wait-ms            Max wait time for ack/progress/result. Default: ${DEFAULT_WAIT_MS}
  --task-id            start message task id. Default: job-${NOW}
  --project-id         start message project id. Default: protocol-test-project
  --model-id           start message model id. Default: protocol-test-model
  --file-id            start message file id. Default: file-${NOW}
  --file-name          start message file name. Default: protocol-test-model.rvt
  --source-file-url    start message source file url. Default: https://example.com/sample.rvt
  --speckle-server-url start message speckle server url. Default: http://127.0.0.1:3000
  --speckle-token      start message speckle token. Default: test-token
  --speckle-token-id   start message speckle token id. Default: test-token-id
  --version-message    start message version message. Default: Protocol validation run
  --source-application start message source application. Default: RVT Protocol Validator
  --worker-id          start message worker id. Default: user_1c28b1
  --help               Show usage
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

const parseJson = (raw: WebSocket.RawData): JsonValue => {
  const text = raw.toString()
  try {
    return JSON.parse(text) as JsonValue
  } catch {
    return text
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

const getRequiredArgs = (): CliArgs => {
  if (hasFlag('--help')) {
    process.stdout.write(`${usage}\n`)
    process.exit(0)
  }

  const waitMsRaw = getArgValue('--wait-ms') || String(DEFAULT_WAIT_MS)
  const waitMs = Number(waitMsRaw)
  if (!Number.isFinite(waitMs) || waitMs <= 0) {
    throw new Error(`Invalid --wait-ms value: ${waitMsRaw}`)
  }

  return {
    wsUrl: (getArgValue('--ws-url') || DEFAULT_WS_URL).trim(),
    waitMs,
    taskId: (getArgValue('--task-id') || `job-${NOW}`).trim(),
    projectId: (getArgValue('--project-id') || 'protocol-test-project').trim(),
    modelId: (getArgValue('--model-id') || 'protocol-test-model').trim(),
    fileId: (getArgValue('--file-id') || `file-${NOW}`).trim(),
    fileName: (getArgValue('--file-name') || 'protocol-test-model.rvt').trim(),
    sourceFileUrl: (
      getArgValue('--source-file-url') || 'https://example.com/sample.rvt'
    ).trim(),
    speckleServerUrl: (
      getArgValue('--speckle-server-url') || 'http://127.0.0.1:3000'
    ).trim(),
    speckleToken: (getArgValue('--speckle-token') || 'test-token').trim(),
    speckleTokenId: (getArgValue('--speckle-token-id') || 'test-token-id').trim(),
    versionMessage: (
      getArgValue('--version-message') || 'Protocol validation run'
    ).trim(),
    sourceApplication: (
      getArgValue('--source-application') || 'RVT Protocol Validator'
    ).trim(),
    workerId: (getArgValue('--worker-id') || 'user_1c28b1').trim()
  }
}

const buildStartPayload = (args: CliArgs) => ({
  type: 'start_rvt_conversion',
  taskId: args.taskId,
  workerId: args.workerId,
  projectId: args.projectId,
  modelId: args.modelId,
  fileId: args.fileId,
  fileName: args.fileName,
  sourceFileUrl: args.sourceFileUrl,
  speckleServerUrl: args.speckleServerUrl,
  speckleToken: args.speckleToken,
  speckleTokenId: args.speckleTokenId,
  versionMessage: args.versionMessage,
  sourceApplication: args.sourceApplication
})

const validateAckPayload = (payload: JsonValue, expectedTaskId: string) => {
  const issues: ValidationIssue[] = []
  if (!isRecord(payload)) {
    return [{ messageType: 'ack', reason: 'payload 不是对象', payload }]
  }
  if (payload.type !== 'rvt_conversion_ack') {
    return [{ messageType: 'ack', reason: 'type 不是 rvt_conversion_ack', payload }]
  }
  if (payload.taskId !== expectedTaskId) {
    issues.push({
      messageType: 'ack',
      reason: `taskId 不匹配，期望 ${expectedTaskId}，实际 ${String(payload.taskId)}`,
      payload
    })
  }
  if (payload.externalTaskId !== undefined && !isNonEmptyString(payload.externalTaskId)) {
    issues.push({
      messageType: 'ack',
      reason: 'externalTaskId 如果存在，必须是非空字符串',
      payload
    })
  }
  return issues
}

const validateProgressPayload = (payload: JsonValue, expectedTaskId: string) => {
  const issues: ValidationIssue[] = []
  if (!isRecord(payload)) {
    return [{ messageType: 'progress', reason: 'payload 不是对象', payload }]
  }
  if (payload.type !== 'rvt_conversion_progress') {
    return [
      { messageType: 'progress', reason: 'type 不是 rvt_conversion_progress', payload }
    ]
  }
  if (payload.taskId !== expectedTaskId) {
    issues.push({
      messageType: 'progress',
      reason: `taskId 不匹配，期望 ${expectedTaskId}，实际 ${String(payload.taskId)}`,
      payload
    })
  }
  if (!isNonEmptyString(payload.phase)) {
    issues.push({
      messageType: 'progress',
      reason: 'phase 必须是非空字符串',
      payload
    })
  }
  if (!isValidPercent(payload.progress)) {
    issues.push({
      messageType: 'progress',
      reason: 'progress 必须是 0-100 的数字',
      payload
    })
  }
  if (!isNonEmptyString(payload.message)) {
    issues.push({
      messageType: 'progress',
      reason: 'message 必须是非空字符串',
      payload
    })
  }

  const hasCurrent = payload.current !== undefined
  const hasTotal = payload.total !== undefined
  if (hasCurrent !== hasTotal) {
    issues.push({
      messageType: 'progress',
      reason: 'current 和 total 必须同时出现，或者同时不出现',
      payload
    })
  }
  if (hasCurrent && !isValidCounter(payload.current)) {
    issues.push({
      messageType: 'progress',
      reason: 'current 必须是大于等于 0 的数字',
      payload
    })
  }
  if (hasTotal && !isValidCounter(payload.total)) {
    issues.push({
      messageType: 'progress',
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
      messageType: 'progress',
      reason: 'current 不能大于 total',
      payload
    })
  }

  return issues
}

const validateResultPayload = (payload: JsonValue, expectedTaskId: string) => {
  const issues: ValidationIssue[] = []
  if (!isRecord(payload)) {
    return [{ messageType: 'result', reason: 'payload 不是对象', payload }]
  }
  if (payload.type !== 'rvt_conversion_result') {
    return [{ messageType: 'result', reason: 'type 不是 rvt_conversion_result', payload }]
  }
  if (payload.taskId !== expectedTaskId) {
    issues.push({
      messageType: 'result',
      reason: `taskId 不匹配，期望 ${expectedTaskId}，实际 ${String(payload.taskId)}`,
      payload
    })
  }
  if (payload.status === 'success') {
    if (!isNonEmptyString(payload.versionId)) {
      issues.push({
        messageType: 'result',
        reason: 'success 结果必须带非空 versionId',
        payload
      })
    }
  } else if (payload.status === 'failed') {
    if (!isNonEmptyString(payload.errorMessage)) {
      issues.push({
        messageType: 'result',
        reason: 'failed 结果必须带非空 errorMessage',
        payload
      })
    }
  } else {
    issues.push({
      messageType: 'result',
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

const main = async () => {
  const args = getRequiredArgs()
  const startPayload = buildStartPayload(args)

  console.log(`Connecting conversion socket: ${args.wsUrl}`)

  let socket: WebSocket | null = null
  const received: JsonValue[] = []
  const issues: ValidationIssue[] = []
  let sawAck = false
  let sawProgress = false
  let sawResult = false

  try {
    socket = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(args.wsUrl)
      ws.once('open', () => resolve(ws))
      ws.once('error', (error) => reject(error))
    })

    console.log('Conversion socket connected')
    socket.on('message', (raw) => {
      const payload = parseJson(raw)
      received.push(payload)
      console.log('Received service payload:', payload)

      if (!isRecord(payload)) {
        issues.push({
          messageType: 'unknown',
          reason: '收到非对象消息',
          payload
        })
        return
      }

      switch (payload.type) {
        case 'rvt_conversion_ack':
          sawAck = true
          issues.push(...validateAckPayload(payload, args.taskId))
          break
        case 'rvt_conversion_progress':
          sawProgress = true
          issues.push(...validateProgressPayload(payload, args.taskId))
          break
        case 'rvt_conversion_result':
          sawResult = true
          issues.push(...validateResultPayload(payload, args.taskId))
          break
        default:
          issues.push({
            messageType: 'unknown',
            reason: `收到未知消息类型: ${String(payload.type)}`,
            payload
          })
      }
    })

    console.log('Sending start_rvt_conversion:', startPayload)
    socket.send(JSON.stringify(startPayload))

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), args.waitMs)
      const interval = setInterval(() => {
        if (!sawResult) return
        clearTimeout(timer)
        clearInterval(interval)
        resolve()
      }, 300)
    })

    if (!sawAck) {
      issues.push({
        messageType: 'ack',
        reason: '在等待窗口内没有收到 ack',
        payload: null
      })
    }
    if (!sawProgress) {
      issues.push({
        messageType: 'progress',
        reason: '在等待窗口内没有收到 progress',
        payload: null
      })
    }
    if (!sawResult) {
      issues.push({
        messageType: 'result',
        reason: '在等待窗口内没有收到 result',
        payload: null
      })
    }

    console.log(
      JSON.stringify(
        {
          ok: issues.length === 0,
          startPayload,
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
  } finally {
    await closeSocket(socket)
  }
}

main().catch((error) => {
  console.error('Remote RVT conversion service test failed')
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
