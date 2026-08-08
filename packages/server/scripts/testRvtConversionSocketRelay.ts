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
  wsBaseUrl: string
  adminSecret: string
  userId: string
  authToken?: string
  timeoutMs: number
}

type RelayClientInfo = {
  id: string
  ip?: string
  connectedAt?: string
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

type ProgressPayload = {
  type: 'rvt_conversion_progress'
  taskId: string
  externalTaskId: string
  phase: string
  progress: number
  message: string
  current: number
  total: number
}

const DEFAULT_WS_BASE_URL = process.env.RVT_CONVERSION_RELAY_URL || 'ws://47.100.77.97:9700/ws'
const DEFAULT_ADMIN_SECRET = process.env.RVT_CONVERSION_RELAY_ADMIN_SECRET || 'admin123'
const DEFAULT_USER_ID = `rvt-progress-test-${Date.now()}`
const DEFAULT_TIMEOUT_MS = 15000

const usage = `Usage:
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/testRvtConversionSocketRelay.ts
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/testRvtConversionSocketRelay.ts --ws-base-url=ws://47.100.77.97:9700/ws
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/testRvtConversionSocketRelay.ts --user-id=my-worker --auth-token=my-token

Options:
  --ws-base-url   WebSocket base url. Default: ${DEFAULT_WS_BASE_URL}
  --admin-secret  Admin relay secret. Default: ${DEFAULT_ADMIN_SECRET}
  --user-id       Client user id. Default: ${DEFAULT_USER_ID}
  --auth-token    Optional Authorization header value for client socket
  --timeout-ms    Timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}
  --help          Show usage
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

  const wsBaseUrl = (getArgValue('--ws-base-url') || DEFAULT_WS_BASE_URL).trim()
  const adminSecret = (getArgValue('--admin-secret') || DEFAULT_ADMIN_SECRET).trim()
  const userId = (getArgValue('--user-id') || DEFAULT_USER_ID).trim()
  const authToken = getArgValue('--auth-token')?.trim()
  const timeoutRaw = getArgValue('--timeout-ms') || String(DEFAULT_TIMEOUT_MS)
  const timeoutMs = Number(timeoutRaw)

  if (!wsBaseUrl) throw new Error('Missing --ws-base-url')
  if (!adminSecret) throw new Error('Missing --admin-secret')
  if (!userId) throw new Error('Missing --user-id')
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid --timeout-ms value: ${timeoutRaw}`)
  }

  return {
    wsBaseUrl,
    adminSecret,
    userId,
    ...(authToken ? { authToken } : {}),
    timeoutMs
  }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const parseJson = (raw: WebSocket.RawData): JsonObject | null => {
  try {
    const parsed = JSON.parse(raw.toString()) as JsonValue
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }
    return parsed as JsonObject
  } catch {
    return null
  }
}

const createTimeout = (label: string, timeoutMs: number) =>
  new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })

const openSocket = async (
  url: string,
  options?: {
    headers?: Record<string, string>
  }
) =>
  await new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url, options)
    const handleOpen = () => resolve(socket)
    const handleError = (error: Error) => reject(error)

    socket.once('open', handleOpen)
    socket.once('error', handleError)
  })

const waitForAdminClientPresence = async (
  adminSocket: WebSocket,
  adminMessages: JsonObject[],
  userId: string,
  timeoutMs: number
) => {
  const existingClient = adminMessages
    .filter((item): item is AdminClientsListMessage => item.type === 'clients_list')
    .flatMap((item) => item.data)
    .find((item) => item.id === userId)

  if (existingClient) {
    return existingClient
  }

  return await Promise.race([
    new Promise<RelayClientInfo>((resolve) => {
      const handler = (raw: WebSocket.RawData) => {
        const payload = parseJson(raw) as AdminClientsListMessage | null
        if (!payload || payload.type !== 'clients_list') return

        const client = payload.data.find((item) => item.id === userId)
        if (!client) return

        adminSocket.off('message', handler)
        resolve(client)
      }

      adminSocket.on('message', handler)
    }),
    createTimeout(`Waiting admin to observe client ${userId}`, timeoutMs)
  ])
}

const waitForAdminIncomingMessage = async (
  adminSocket: WebSocket,
  adminMessages: JsonObject[],
  userId: string,
  timeoutMs: number
) => {
  const existingMessage = adminMessages.find(
    (item): item is AdminIncomingMessage => item.type === 'msg' && item.from === userId
  )

  if (existingMessage) {
    return existingMessage
  }

  return await Promise.race([
    new Promise<AdminIncomingMessage>((resolve) => {
      const handler = (raw: WebSocket.RawData) => {
        const payload = parseJson(raw) as AdminIncomingMessage | null
        if (!payload || payload.type !== 'msg' || payload.from !== userId) return

        adminSocket.off('message', handler)
        resolve(payload)
      }

      adminSocket.on('message', handler)
    }),
    createTimeout(`Waiting admin to receive message from ${userId}`, timeoutMs)
  ])
}

const waitForClientMessage = async (clientSocket: WebSocket, timeoutMs: number) => {
  return await waitForClientMessageWithBuffer(clientSocket, [], timeoutMs)
}

const waitForClientMessageWithBuffer = async (
  clientSocket: WebSocket,
  clientMessages: JsonValue[],
  timeoutMs: number
) => {
  if (clientMessages.length) {
    return clientMessages[0]
  }

  return await Promise.race([
    new Promise<JsonValue>((resolve) => {
      const handler = (raw: WebSocket.RawData) => {
        clientSocket.off('message', handler)
        const payload = parseJson(raw)
        resolve(payload || raw.toString())
      }

      clientSocket.on('message', handler)
    }),
    createTimeout('Waiting client to receive admin message', timeoutMs)
  ])
}

const closeSocket = async (socket: WebSocket | null) => {
  if (!socket) return
  if (socket.readyState === WebSocket.CLOSED) return

  await new Promise<void>((resolve) => {
    socket.once('close', () => resolve())
    socket.close()
  })
}

const buildProgressPayload = (userId: string): ProgressPayload => ({
  type: 'rvt_conversion_progress',
  taskId: `job-${Date.now()}`,
  externalTaskId: `external-${userId}`,
  phase: 'converting_model',
  progress: 37,
  message: '正在转换模型',
  current: 370,
  total: 1000
})

const main = async () => {
  const args = getRequiredArgs()
  const adminUrl = new URL(args.wsBaseUrl)
  adminUrl.searchParams.set('role', 'admin')
  adminUrl.searchParams.set('secret', args.adminSecret)

  const clientUrl = new URL(args.wsBaseUrl)
  clientUrl.searchParams.set('user', args.userId)

  let adminSocket: WebSocket | null = null
  let clientSocket: WebSocket | null = null
  const adminMessages: JsonObject[] = []
  const clientMessages: JsonValue[] = []

  const startAt = Date.now()

  try {
    console.log(`Connecting admin socket: ${adminUrl.toString()}`)
    adminSocket = await openSocket(adminUrl.toString())
    adminSocket.on('message', (raw) => {
      const payload = parseJson(raw)
      if (!payload) return
      adminMessages.push(payload)
      console.log('Admin observed raw payload:', payload)
    })
    console.log('Admin socket connected')

    console.log(`Connecting client socket: ${clientUrl.toString()}`)
    clientSocket = await openSocket(clientUrl.toString(), {
      headers: args.authToken ? { Authorization: args.authToken } : undefined
    })
    clientSocket.on('message', (raw) => {
      const payload = parseJson(raw)
      const normalized = payload || raw.toString()
      clientMessages.push(normalized)
      console.log('Client observed raw payload:', normalized)
    })
    console.log('Client socket connected')

    const observedClient = await waitForAdminClientPresence(
      adminSocket,
      adminMessages,
      args.userId,
      args.timeoutMs
    )
    console.log('Admin observed client:', observedClient)

    const progressPayload = buildProgressPayload(args.userId)
    console.log('Client sending progress payload:', progressPayload)
    clientSocket.send(JSON.stringify(progressPayload))

    const adminReceived = await waitForAdminIncomingMessage(
      adminSocket,
      adminMessages,
      args.userId,
      args.timeoutMs
    )
    console.log('Admin received client payload:', adminReceived.data)

    const replyPayload = {
      type: 'server_ack',
      taskId: progressPayload.taskId,
      accepted: true,
      receivedAt: new Date().toISOString()
    }
    console.log('Admin sending reply payload:', replyPayload)
    adminSocket.send(
      JSON.stringify({
        target: args.userId,
        data: replyPayload
      })
    )

    const clientReceived = await waitForClientMessageWithBuffer(
      clientSocket,
      clientMessages,
      args.timeoutMs
    )
    console.log('Client received admin payload:', clientReceived)

    console.log(
      JSON.stringify(
        {
          ok: true,
          wsBaseUrl: args.wsBaseUrl,
          userId: args.userId,
          durationMs: Date.now() - startAt,
          observedClient,
          progressPayload,
          adminReceived,
          clientReceived
        },
        null,
        2
      )
    )
  } finally {
    await delay(100)
    await closeSocket(clientSocket)
    await closeSocket(adminSocket)
  }
}

main().catch((error) => {
  console.error('RVT relay integration failed')
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
