import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { File, FormData, fetch } from 'undici'

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

type JsonObject = { [key: string]: JsonValue }

type CliArgs = {
  baseUrl: string
  filePath: string
  sourceUrl: string
  outputDir: string
  timeoutMs: number
}

type RequestSummary = {
  method: 'POST'
  url: string
  body: string
}

type ResponseSummary = {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  bodyText: string
  bodyJson: JsonObject | null
  durationMs: number
}

type DownloadSummary = {
  attempted: boolean
  attempts: number
  ok: boolean
  sourceUrl: string | null
  outputPath: string | null
  sizeBytes: number | null
  error: string | null
}

type TestResult = {
  name: string
  expected: 'success' | 'error'
  passed: boolean
  request: RequestSummary
  response?: ResponseSummary
  download?: DownloadSummary
  requestError?: string
}

type TestCase = {
  name: string
  expected: 'success' | 'error'
  run: () => Promise<TestResult>
}

const DEFAULT_BASE_URL = process.env.ODA_BASE_URL || 'http://127.0.0.1:8089'
const DEFAULT_FILE_PATH =
  '/Users/yujian/work/speckle-server/packages/frontend-2/public/RAC_basic_sample_project - 图纸 - A102 - Plans-楼层平面 - Level 1.dwg'
const DEFAULT_SOURCE_URL =
  process.env.ODA_SOURCE_URL ||
  'https://docxtpl.oss-cn-shanghai.aliyuncs.com/linshi/2eb99b02-14e9-4e2e-aca2-f17938e458c8.dwg'
const DOWNLOAD_RETRY_ATTEMPTS = 5
const DOWNLOAD_RETRY_DELAY_MS = 2000

const scriptFilePath = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(scriptFilePath), '../../..')

const usage = `Usage:
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/convertDwgToDxf.ts
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/convertDwgToDxf.ts --base-url=http://127.0.0.1:8089
pnpm tsx --import ./packages/server/esmLoader.js ./packages/server/scripts/convertDwgToDxf.ts --file="/absolute/path/to/file.dwg" --source-url="https://example.com/file.dwg"

Options:
  --base-url    ODA service base url. Default: ${DEFAULT_BASE_URL}
  --file        Local DWG file path. Default: ${DEFAULT_FILE_PATH}
  --source-url  Remote DWG url for /convert/url. Default: ${DEFAULT_SOURCE_URL}
  --output-dir  Where DXF/report files are written. Default: ${repoRoot}
  --timeout-ms  Request timeout in milliseconds. Default: 120000
  --help        Show usage
`

const hasFlag = (flag: string) => process.argv.includes(flag)

const getArgValue = (flag: string): string | undefined => {
  const args = process.argv.slice(2)
  const exact = `${flag}=`
  const byEquals = args.find((arg) => arg.startsWith(exact))
  if (byEquals) return byEquals.slice(exact.length)

  const index = args.findIndex((arg) => arg === flag)
  if (index === -1) return undefined
  return args[index + 1]
}

const getRequiredArgs = (): CliArgs => {
  if (hasFlag('--help')) {
    process.stdout.write(`${usage}\n`)
    process.exit(0)
  }

  const baseUrl = (getArgValue('--base-url') || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  const filePath = (getArgValue('--file') || DEFAULT_FILE_PATH).trim()
  const sourceUrl = (getArgValue('--source-url') || DEFAULT_SOURCE_URL).trim()
  const outputDir = resolve((getArgValue('--output-dir') || repoRoot).trim())
  const timeoutValue = getArgValue('--timeout-ms') || '120000'
  const timeoutMs = Number(timeoutValue)

  if (!baseUrl) throw new Error('Missing --base-url')
  if (!filePath) throw new Error('Missing --file')
  if (!sourceUrl) throw new Error('Missing --source-url')
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid --timeout-ms value: ${timeoutValue}`)
  }

  return {
    baseUrl,
    filePath,
    sourceUrl,
    outputDir,
    timeoutMs
  }
}

const assertFileReadable = async (filePath: string) => {
  await access(filePath)
}

const buildHeadersObject = (headers: Headers | { entries: () => IterableIterator<[string, string]> }) =>
  Object.fromEntries(headers.entries())

const parseJsonBody = (text: string): JsonObject | null => {
  if (!text.trim()) return null

  try {
    const parsed = JSON.parse(text) as JsonValue
    return isJsonObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

const isJsonObject = (value: JsonValue | unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stripWrappingQuotes = (value: string) =>
  value.replace(/^["'`\s]+/, '').replace(/["'`\s]+$/, '')

const sanitizeReturnedUrl = (rawUrl: unknown): string | null => {
  if (typeof rawUrl !== 'string') return null
  const sanitized = stripWrappingQuotes(rawUrl.trim())
  return sanitized || null
}

const buildDownloadUrl = (args: CliArgs, bodyJson: JsonObject | null): string | null => {
  const bodyUrl = sanitizeReturnedUrl(bodyJson?.url)
  if (bodyUrl) {
    try {
      return new URL(bodyUrl).toString()
    } catch {
      try {
        return new URL(bodyUrl, args.baseUrl).toString()
      } catch {
        return null
      }
    }
  }

  const pathValue = typeof bodyJson?.path === 'string' ? stripWrappingQuotes(bodyJson.path) : null
  if (!pathValue) return null

  const normalizedPath = pathValue.startsWith('/') ? pathValue.slice(1) : pathValue
  return new URL(`/download/${normalizedPath}`, args.baseUrl).toString()
}

const postForm = async (
  url: string,
  form: FormData,
  timeoutMs: number
): Promise<ResponseSummary> => {
  const startedAt = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(timeoutMs)
  })
  const bodyText = await response.text()

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: buildHeadersObject(response.headers),
    bodyText,
    bodyJson: parseJsonBody(bodyText),
    durationMs: Date.now() - startedAt
  }
}

const downloadFile = async (
  sourceUrl: string,
  outputPath: string,
  timeoutMs: number
): Promise<DownloadSummary> => {
  let lastError: string | null = null

  for (let attempt = 1; attempt <= DOWNLOAD_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs)
      })

      if (!response.ok) {
        lastError = `Download failed with status ${response.status} ${response.statusText}`
      } else {
        const buffer = Buffer.from(await response.arrayBuffer())
        await writeFile(outputPath, buffer)

        return {
          attempted: true,
          attempts: attempt,
          ok: true,
          sourceUrl,
          outputPath,
          sizeBytes: buffer.byteLength,
          error: null
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    if (attempt < DOWNLOAD_RETRY_ATTEMPTS) {
      await wait(DOWNLOAD_RETRY_DELAY_MS)
    }
  }

  return {
    attempted: true,
    attempts: DOWNLOAD_RETRY_ATTEMPTS,
    ok: false,
    sourceUrl,
    outputPath,
    sizeBytes: null,
    error: lastError
  }
}

const wait = async (ms: number) =>
  new Promise<void>((resolveDelay) => {
    setTimeout(resolveDelay, ms)
  })

const buildUnavailableDownloadSummary = (message: string): DownloadSummary => {
  return {
    attempted: false,
    attempts: 0,
    ok: false,
    sourceUrl: null,
    outputPath: null,
    sizeBytes: null,
    error: message
  }
}

const tryDownloadFromResponse = async (
  args: CliArgs,
  response: ResponseSummary,
  outputName: string
): Promise<DownloadSummary> => {
  const downloadUrl = buildDownloadUrl(args, response.bodyJson)
  if (!downloadUrl) {
    return buildUnavailableDownloadSummary(
      'Response JSON does not contain a usable download url or path'
    )
  }

  return downloadFile(downloadUrl, buildOutputPath(args.outputDir, outputName), args.timeoutMs)
}

const getPassedState = (
  expected: 'success' | 'error',
  response: ResponseSummary,
  download?: DownloadSummary
) => {
  if (expected === 'success') {
    return response.ok && (download ? download.ok : true)
  }

  if (!response.ok) return true
  if (download && !download.ok) return true
  return false
}

const createLocalFileForm = async (filePath: string): Promise<FormData> => {
  const fileBuffer = await readFile(filePath)
  const fileName = basename(filePath)
  const contentType =
    extname(filePath).toLowerCase() === '.dwg' ? 'application/acad' : 'application/octet-stream'
  const file = new File([fileBuffer], fileName, { type: contentType })
  const form = new FormData()
  form.append('file', file, fileName)
  return form
}

const createInvalidLocalFileForm = (): FormData => {
  const form = new FormData()
  const fakeFile = new File(['this is not a real dwg file'], 'invalid.dwg', {
    type: 'application/acad'
  })
  form.append('file', fakeFile, 'invalid.dwg')
  return form
}

const createUrlForm = (url: string): FormData => {
  const form = new FormData()
  form.append('url', url)
  return form
}

const createEmptyForm = (): FormData => new FormData()

const summarizeRequest = (url: string, body: string): RequestSummary => ({
  method: 'POST',
  url,
  body
})

const runTestCase = async (
  name: string,
  expected: 'success' | 'error',
  request: RequestSummary,
  execute: () => Promise<ResponseSummary>,
  afterResponse?: (response: ResponseSummary) => Promise<DownloadSummary | undefined>
): Promise<TestResult> => {
  try {
    const response = await execute()
    const download = afterResponse ? await afterResponse(response) : undefined
    const passed = getPassedState(expected, response, download)

    return {
      name,
      expected,
      passed,
      request,
      response,
      download
    }
  } catch (error) {
    return {
      name,
      expected,
      passed: false,
      request,
      requestError: error instanceof Error ? error.message : String(error)
    }
  }
}

const buildOutputPath = (outputDir: string, fileName: string) => resolve(outputDir, fileName)

const printSummary = (results: TestResult[], reportPath: string) => {
  const rows = results.map((result) => ({
    name: result.name,
    expected: result.expected,
    passed: result.passed,
    status: result.response?.status ?? 'request-error',
    download: result.download?.outputPath ?? '-'
  }))

  console.table(rows)
  process.stdout.write(`Report written to ${reportPath}\n`)
}

const main = async () => {
  const args = getRequiredArgs()
  await assertFileReadable(args.filePath)
  await mkdir(args.outputDir, { recursive: true })

  const localEndpoint = `${args.baseUrl}/convert/local`
  const urlEndpoint = `${args.baseUrl}/convert/url`

  const testCases: TestCase[] = [
    {
      name: 'local-success',
      expected: 'success',
      run: async () =>
        runTestCase(
          'local-success',
          'success',
          summarizeRequest(localEndpoint, `multipart/form-data file=@${args.filePath}`),
          async () => postForm(localEndpoint, await createLocalFileForm(args.filePath), args.timeoutMs),
          async (response) => tryDownloadFromResponse(args, response, 'oda-local-output.dxf')
        )
    },
    {
      name: 'url-success',
      expected: 'success',
      run: async () =>
        runTestCase(
          'url-success',
          'success',
          summarizeRequest(urlEndpoint, `multipart/form-data url=${args.sourceUrl}`),
          async () => postForm(urlEndpoint, createUrlForm(args.sourceUrl), args.timeoutMs),
          async (response) => tryDownloadFromResponse(args, response, 'oda-url-output.dxf')
        )
    },
    {
      name: 'local-missing-file',
      expected: 'error',
      run: async () =>
        runTestCase(
          'local-missing-file',
          'error',
          summarizeRequest(localEndpoint, 'multipart/form-data without file field'),
          async () => postForm(localEndpoint, createEmptyForm(), args.timeoutMs)
        )
    },
    {
      name: 'local-invalid-file',
      expected: 'error',
      run: async () =>
        runTestCase(
          'local-invalid-file',
          'error',
          summarizeRequest(localEndpoint, 'multipart/form-data file=@invalid.dwg(fake content)'),
          async () => postForm(localEndpoint, createInvalidLocalFileForm(), args.timeoutMs),
          async (response) => tryDownloadFromResponse(args, response, 'oda-invalid-output.dxf')
        )
    },
    {
      name: 'url-missing-url',
      expected: 'error',
      run: async () =>
        runTestCase(
          'url-missing-url',
          'error',
          summarizeRequest(urlEndpoint, 'multipart/form-data without url field'),
          async () => postForm(urlEndpoint, createEmptyForm(), args.timeoutMs)
        )
    },
    {
      name: 'url-invalid-url',
      expected: 'error',
      run: async () =>
        runTestCase(
          'url-invalid-url',
          'error',
          summarizeRequest(urlEndpoint, 'multipart/form-data url=not-a-valid-url'),
          async () => postForm(urlEndpoint, createUrlForm('not-a-valid-url'), args.timeoutMs)
        )
    }
  ]

  const results: TestResult[] = []
  for (const testCase of testCases) {
    results.push(await testCase.run())
  }

  const report = {
    generatedAt: new Date().toISOString(),
    config: args,
    results
  }

  const reportPath = buildOutputPath(args.outputDir, 'oda-convert-report.json')
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  printSummary(results, reportPath)

  const successFailures = results.filter(
    (result) => result.expected === 'success' && !result.passed
  )
  if (successFailures.length) {
    throw new Error(
      `Success cases failed: ${successFailures.map((result) => result.name).join(', ')}`
    )
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
