import type { ObjectStorage } from '@/modules/blobstorage/clients/objectStorage'
import { getBlobMetadataFactory } from '@/modules/blobstorage/repositories'
import { getObjectStreamFactory } from '@/modules/blobstorage/repositories/blobs'
import { getFileStreamFactory } from '@/modules/blobstorage/services/management'
import {
  listProgressPlanTasksFactory,
  replaceProgressPlanTasksFactory,
  type ProgressPlanTaskRecord
} from '@/modules/progress/repositories/progressPlanTasks'
import { syncPlanTaskDerivedDataFactory } from '@/modules/progress/services/snapshotSync'
import { execFile as execFileCallback } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import type { Knex } from 'knex'

const execFile = promisify(execFileCallback)

type ExtractedPlanTask = {
  externalId?: string | null
  sysTaskId?: string | null
  /** 工程量数量（按别名「工程量」列解析，例如 Text1） */
  quantity?: string | null
  /** 工程量单位（按别名「单位」列解析，例如 Text4） */
  unit?: string | null
  parentExternalId?: string | null
  wbs?: string | null
  name: string
  level?: number
  sortOrder?: number
  duration?: string | null
  planStart?: string | null
  planEnd?: string | null
  predecessor?: string | null
  inspectionBatch?: string | null
}

const commandOutputPreviewLength = 500

// Java 源文件包含中文注释/字符串，必须显式指定 UTF-8 编译，
// 否则在默认编码非 UTF-8 的环境（如部分 Linux 服务器 locale 为 US-ASCII）下
// javac 会报 "unmappable character for encoding US-ASCII"
const javacEncodingArgs = ['-encoding', 'UTF-8']

// 运行期同样显式指定 UTF-8，保证 Java 程序向 stdout 输出中文任务名时
// 不被 JVM 默认字符集（file.encoding）改写为乱码
const javaRuntimeEncodingArgs = ['-Dfile.encoding=UTF-8']

const currentDir = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(currentDir, '../../..')
const packageRoot = appRoot.endsWith('/dist') ? resolve(appRoot, '..') : appRoot
const workspaceRoot = resolve(packageRoot, '..', '..')
const javaBuildDir = join(tmpdir(), 'speckle-progress-mpp-java')
const compiledClassPath = join(javaBuildDir, 'ProgressPlanMppExtractor.class')
const javaPathCandidates = ['/opt/homebrew/opt/openjdk/bin/java', 'java']
const javacPathCandidates = ['/opt/homebrew/opt/openjdk/bin/javac', 'javac']

const pathExists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const resolveBinary = async (candidates: string[], description: string) => {
  for (const candidate of candidates) {
    if (candidate.includes('/')) {
      if (await pathExists(candidate)) return candidate
      continue
    }

    try {
      await execFile(candidate, ['-version'])
      return candidate
    } catch {
      // continue
    }
  }

  throw new Error(`Missing ${description}.`)
}

const getMpxjLibRootCandidates = () => {
  const candidates = [
    process.env.MPXJ_LIB_ROOT,
    process.env.MPXJ_RUNTIME_ROOT,
    resolve(packageRoot, '.venv-progress-mpp/lib'),
    resolve(workspaceRoot, '.venv-progress-mpp/lib'),
    resolve(workspaceRoot, 'packages/server/.venv-progress-mpp/lib')
  ].filter((value): value is string => !!value?.trim())

  return [...new Set(candidates)]
}

const getMpxjLibDirCandidates = (libRoot: string) =>
  [process.env.MPXJ_LIB_DIR, join(libRoot, 'site-packages', 'mpxj', 'lib')].filter(
    (value): value is string => !!value?.trim()
  )

const getJavaSourcePathCandidates = () =>
  [
    process.env.PROGRESS_PLAN_MPP_EXTRACTOR_SOURCE,
    resolve(currentDir, '../java/ProgressPlanMppExtractor.java'),
    resolve(packageRoot, 'modules/progress/java/ProgressPlanMppExtractor.java'),
    resolve(packageRoot, 'dist/modules/progress/java/ProgressPlanMppExtractor.java'),
    resolve(
      workspaceRoot,
      'packages/server/modules/progress/java/ProgressPlanMppExtractor.java'
    )
  ].filter((value): value is string => !!value?.trim())

const getProbeSourcePathCandidates = () =>
  [
    process.env.PROGRESS_PLAN_MPP_PROBE_SOURCE,
    resolve(currentDir, '../java/ProgressPlanFieldProbe.java'),
    resolve(packageRoot, 'modules/progress/java/ProgressPlanFieldProbe.java'),
    resolve(packageRoot, 'dist/modules/progress/java/ProgressPlanFieldProbe.java'),
    resolve(
      workspaceRoot,
      'packages/server/modules/progress/java/ProgressPlanFieldProbe.java'
    )
  ].filter((value): value is string => !!value?.trim())

const resolveJavaSourcePath = async () => {
  const attemptedPaths: string[] = []

  for (const candidate of getJavaSourcePathCandidates()) {
    attemptedPaths.push(candidate)
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `ProgressPlanMppExtractor.java not found. Set PROGRESS_PLAN_MPP_EXTRACTOR_SOURCE or ensure the source file exists. Tried: ${attemptedPaths.join(
      ', '
    )}`
  )
}

const resolveProbeSourcePath = async () => {
  const attemptedPaths: string[] = []

  for (const candidate of getProbeSourcePathCandidates()) {
    attemptedPaths.push(candidate)
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `ProgressPlanFieldProbe.java not found. Set PROGRESS_PLAN_MPP_PROBE_SOURCE or ensure the source file exists. Tried: ${attemptedPaths.join(
      ', '
    )}`
  )
}

const resolveMpxjLibDir = async () => {
  const attemptedPaths: string[] = []

  for (const libRoot of getMpxjLibRootCandidates()) {
    const directCandidates = getMpxjLibDirCandidates(libRoot)
    for (const candidate of directCandidates) {
      attemptedPaths.push(candidate)
      if (await pathExists(candidate)) {
        return candidate
      }
    }

    if (!(await pathExists(libRoot))) {
      attemptedPaths.push(libRoot)
      continue
    }

    const pythonDirs = await readdir(libRoot)
    for (const pythonDir of pythonDirs) {
      if (!pythonDir.startsWith('python')) continue
      const candidate = join(libRoot, pythonDir, 'site-packages', 'mpxj', 'lib')
      attemptedPaths.push(candidate)
      if (await pathExists(candidate)) {
        return candidate
      }
    }
  }

  throw new Error(
    `MPXJ runtime not found. Set MPXJ_LIB_DIR to the extracted 'mpxj/lib' directory, or install it under packages/server/.venv-progress-mpp. Tried: ${attemptedPaths.join(
      ', '
    )}`
  )
}

const getJavaWriterSourcePathCandidates = () =>
  [
    process.env.PROGRESS_PLAN_MPP_WRITER_SOURCE,
    resolve(currentDir, '../java/ProgressPlanMppWriter.java'),
    resolve(packageRoot, 'modules/progress/java/ProgressPlanMppWriter.java'),
    resolve(packageRoot, 'dist/modules/progress/java/ProgressPlanMppWriter.java'),
    resolve(
      workspaceRoot,
      'packages/server/modules/progress/java/ProgressPlanMppWriter.java'
    )
  ].filter((value): value is string => !!value?.trim())

const resolveJavaWriterSourcePath = async () => {
  const attemptedPaths: string[] = []

  for (const candidate of getJavaWriterSourcePathCandidates()) {
    attemptedPaths.push(candidate)
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `ProgressPlanMppWriter.java not found. Set PROGRESS_PLAN_MPP_WRITER_SOURCE or ensure the source file exists. Tried: ${attemptedPaths.join(
      ', '
    )}`
  )
}

const ensureCompiledExtractor = async () => {
  await mkdir(javaBuildDir, { recursive: true })

  const javaSourcePath = await resolveJavaSourcePath()
  const sourceStats = await stat(javaSourcePath)
  const shouldCompile = !(await pathExists(compiledClassPath))
    ? true
    : (await stat(compiledClassPath)).mtimeMs < sourceStats.mtimeMs

  if (!shouldCompile) return

  const [javacBin, mpxjLibDir] = await Promise.all([
    resolveBinary(javacPathCandidates, 'javac runtime'),
    resolveMpxjLibDir()
  ])

  await execFile(
    javacBin,
    [
      ...javacEncodingArgs,
      '-cp',
      `${mpxjLibDir}/*`,
      '-d',
      javaBuildDir,
      javaSourcePath
    ],
    {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/openjdk/bin:${process.env.PATH || ''}`,
        JAVA_HOME: '/opt/homebrew/opt/openjdk'
      }
    }
  )
}

const compiledWriterClassPath = join(javaBuildDir, 'ProgressPlanMppWriter.class')

const ensureCompiledWriter = async () => {
  await mkdir(javaBuildDir, { recursive: true })

  const javaSourcePath = await resolveJavaWriterSourcePath()
  const sourceStats = await stat(javaSourcePath)
  const shouldCompile = !(await pathExists(compiledWriterClassPath))
    ? true
    : (await stat(compiledWriterClassPath)).mtimeMs < sourceStats.mtimeMs

  if (!shouldCompile) return

  const [javacBin, mpxjLibDir] = await Promise.all([
    resolveBinary(javacPathCandidates, 'javac runtime'),
    resolveMpxjLibDir()
  ])

  await execFile(
    javacBin,
    [
      ...javacEncodingArgs,
      '-cp',
      `${mpxjLibDir}/*`,
      '-d',
      javaBuildDir,
      javaSourcePath
    ],
    {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/openjdk/bin:${process.env.PATH || ''}`,
        JAVA_HOME: '/opt/homebrew/opt/openjdk'
      }
    }
  )
}

const runWriter = async (params: {
  inputFilePath: string
  outputFilePath: string
  mappingsFilePath: string
}) => {
  await ensureCompiledWriter()

  const [javaBin, mpxjLibDir] = await Promise.all([
    resolveBinary(javaPathCandidates, 'java runtime'),
    resolveMpxjLibDir()
  ])

  await execFile(
    javaBin,
    [
      ...javaRuntimeEncodingArgs,
      '-cp',
      `${javaBuildDir}:${mpxjLibDir}/*`,
      'ProgressPlanMppWriter',
      params.inputFilePath,
      params.outputFilePath,
      params.mappingsFilePath
    ],
    {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/openjdk/bin:${process.env.PATH || ''}`,
        JAVA_HOME: '/opt/homebrew/opt/openjdk'
      },
      maxBuffer: 1024 * 1024 * 20
    }
  )
}

const buildOutputPreview = (value: string) =>
  value.trim().replace(/\s+/g, ' ').slice(0, commandOutputPreviewLength)

const tryParseTaskArray = (value: string): ExtractedPlanTask[] | null => {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as ExtractedPlanTask[]) : null
  } catch {
    return null
  }
}

export const extractTaskArrayFromCommandOutput = (
  output: string
): ExtractedPlanTask[] => {
  const normalizedOutput = output.trim()
  if (!normalizedOutput) {
    throw new Error('The .mpp extractor returned empty stdout.')
  }

  const directMatch = tryParseTaskArray(normalizedOutput)
  if (directMatch) return directMatch

  for (
    let startIndex = normalizedOutput.indexOf('[');
    startIndex !== -1;
    startIndex = normalizedOutput.indexOf('[', startIndex + 1)
  ) {
    let depth = 0
    let inString = false
    let isEscaped = false

    for (let index = startIndex; index < normalizedOutput.length; index++) {
      const char = normalizedOutput[index]

      if (inString) {
        if (isEscaped) {
          isEscaped = false
        } else if (char === '\\') {
          isEscaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }

      if (char === '"') {
        inString = true
        continue
      }

      if (char === '[') {
        depth += 1
        continue
      }

      if (char !== ']') continue

      depth -= 1
      if (depth !== 0) continue

      const candidate = normalizedOutput.slice(startIndex, index + 1)
      const parsed = tryParseTaskArray(candidate)
      if (parsed) return parsed
      break
    }
  }

  throw new Error(
    `Failed to parse JSON array from .mpp extractor stdout. Preview: ${buildOutputPreview(
      normalizedOutput
    )}`
  )
}

const runExtractor = async (inputFilePath: string): Promise<ExtractedPlanTask[]> => {
  await ensureCompiledExtractor()

  const [javaBin, mpxjLibDir] = await Promise.all([
    resolveBinary(javaPathCandidates, 'java runtime'),
    resolveMpxjLibDir()
  ])

  const { stdout, stderr } = await execFile(
    javaBin,
    [
      ...javaRuntimeEncodingArgs,
      '-cp',
      `${javaBuildDir}:${mpxjLibDir}/*`,
      'ProgressPlanMppExtractor',
      inputFilePath
    ],
    {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/openjdk/bin:${process.env.PATH || ''}`,
        JAVA_HOME: '/opt/homebrew/opt/openjdk'
      },
      maxBuffer: 1024 * 1024 * 20
    }
  )

  try {
    return extractTaskArrayFromCommandOutput(stdout)
  } catch (error) {
    const stderrPreview = buildOutputPreview(stderr || '')
    const message =
      error instanceof Error ? error.message : 'Unknown extractor parsing error.'
    throw new Error(stderrPreview ? `${message} stderr: ${stderrPreview}` : message)
  }
}

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'progress-plan.mpp'

const createTempMppFile = async (params: {
  db: Knex
  storage: ObjectStorage
  projectId: string
  blobId: string
  fileName: string
}) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'speckle-progress-mpp-'))
  const safeFileName = sanitizeFileName(params.fileName)
  const fileName =
    extname(safeFileName).toLowerCase() === '.mpp'
      ? safeFileName
      : `${safeFileName}.mpp`
  const tempFilePath = join(tempDir, fileName)

  const getBlobMetadata = getBlobMetadataFactory({ db: params.db })
  const getFileStream = getFileStreamFactory({ getBlobMetadata })
  const getObjectStream = getObjectStreamFactory({ storage: params.storage })
  const fileStream = await getFileStream({
    getObjectStream,
    streamId: params.projectId,
    blobId: params.blobId
  })

  await pipeline(fileStream, createWriteStream(tempFilePath))
  return { tempDir, tempFilePath }
}

export const importProgressPlanTasksFromBlobFactory =
  (deps: { db: Knex; storage: ObjectStorage }) =>
  async (params: {
    projectId: string
    annualPlanId?: string | null
    planFileId: string
    blobId: string
    fileName: string
    actorId: string
  }): Promise<ProgressPlanTaskRecord[]> => {
    const { tempDir, tempFilePath } = await createTempMppFile({
      db: deps.db,
      storage: deps.storage,
      projectId: params.projectId,
      blobId: params.blobId,
      fileName: params.fileName
    })

    try {
      const extractedTasks = await runExtractor(tempFilePath)
      return await deps.db.transaction(async (trx) => {
        const previousTasks = await listProgressPlanTasksFactory({ db: trx })({
          projectId: params.projectId,
          annualPlanId: params.annualPlanId
        })
        const replaced = await replaceProgressPlanTasksFactory({ db: trx })({
          projectId: params.projectId,
          annualPlanId: params.annualPlanId,
          planFileId: params.planFileId,
          actorId: params.actorId,
          tasks: extractedTasks
        })

        if (!params.annualPlanId) {
          await syncPlanTaskDerivedDataFactory({ db: trx })({
            projectId: params.projectId,
            previousTasks,
            nextTasks: replaced,
            actorId: params.actorId
          })
        }

        return replaced
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

export const readCompiledExtractorSourceFactory = async () => {
  const javaSourcePath = await resolveJavaSourcePath()
  return await readFile(javaSourcePath, 'utf8')
}

const compiledProbeClassPath = join(javaBuildDir, 'ProgressPlanFieldProbe.class')

const ensureCompiledProbe = async () => {
  await mkdir(javaBuildDir, { recursive: true })

  const probeSourcePath = await resolveProbeSourcePath()
  const sourceStats = await stat(probeSourcePath)
  const shouldCompile = !(await pathExists(compiledProbeClassPath))
    ? true
    : (await stat(compiledProbeClassPath)).mtimeMs < sourceStats.mtimeMs

  if (!shouldCompile) return

  const [javacBin, mpxjLibDir] = await Promise.all([
    resolveBinary(javacPathCandidates, 'javac runtime'),
    resolveMpxjLibDir()
  ])

  await execFile(
    javacBin,
    [
      ...javacEncodingArgs,
      '-cp',
      `${mpxjLibDir}/*`,
      '-d',
      javaBuildDir,
      probeSourcePath
    ],
    {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/openjdk/bin:${process.env.PATH || ''}`,
        JAVA_HOME: '/opt/homebrew/opt/openjdk'
      }
    }
  )
}

export type ProgressPlanFieldProbeResult = {
  projectTitle: string | null
  populatedFields: string[]
  /** 自定义字段定义：field=字段名（如 Text1），alias=列显示名（如 工程量） */
  customFieldDefinitions?: Array<{ field: string; alias: string | null }>
  /** 按别名反查字段类型，如 { 工程量: 'Text1' } */
  aliasLookup?: Record<string, string>
  taskCount: number
  tasks: Array<Record<string, unknown>>
}

const runFieldProbe = async (
  inputFilePath: string
): Promise<ProgressPlanFieldProbeResult> => {
  await ensureCompiledProbe()

  const [javaBin, mpxjLibDir] = await Promise.all([
    resolveBinary(javaPathCandidates, 'java runtime'),
    resolveMpxjLibDir()
  ])

  const { stdout, stderr } = await execFile(
    javaBin,
    [
      ...javaRuntimeEncodingArgs,
      '-cp',
      `${javaBuildDir}:${mpxjLibDir}/*`,
      'ProgressPlanFieldProbe',
      inputFilePath
    ],
    {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/openjdk/bin:${process.env.PATH || ''}`,
        JAVA_HOME: '/opt/homebrew/opt/openjdk'
      },
      maxBuffer: 1024 * 1024 * 50
    }
  )

  // stdout 可能带 log4j 日志前缀，从第一个 '{' 开始才是 JSON
  const jsonStart = stdout.indexOf('{')
  if (jsonStart === -1) {
    const stderrPreview = buildOutputPreview(stderr || '')
    throw new Error(
      `Failed to parse probe JSON from .mpp field probe stdout. stderr: ${stderrPreview}`
    )
  }

  try {
    return JSON.parse(stdout.slice(jsonStart)) as ProgressPlanFieldProbeResult
  } catch (error) {
    const stderrPreview = buildOutputPreview(stderr || '')
    const message =
      error instanceof Error ? error.message : 'Unknown probe output parsing error.'
    throw new Error(`${message} stderr: ${stderrPreview}`)
  }
}

/**
 * 直接对本地 .mpp 文件运行标准计划提取器（跳过 blob/数据库环节），
 * 供单元测试与调试使用。
 */
export const runProgressPlanExtractorOnFile = async (
  inputFilePath: string
): Promise<ExtractedPlanTask[]> => {
  return await runExtractor(inputFilePath)
}

/**
 * 对本地 .mpp 文件运行字段探针，导出每个任务可读取到的全部字段
 * （含自定义 Text/Number/Cost/Flag/Date/Duration/Start/Finish 字段），
 * 用于确认工程量等业务数据存放在哪个字段。
 */
export const runProgressPlanFieldProbe = async (
  inputFilePath: string
): Promise<ProgressPlanFieldProbeResult> => {
  return await runFieldProbe(inputFilePath)
}

export const exportProgressPlanFileWithSysTaskIdFactory =
  (deps: { db: Knex; storage: ObjectStorage }) =>
  async (params: { projectId: string; blobId: string; fileName: string }) => {
    const { tempDir, tempFilePath } = await createTempMppFile({
      db: deps.db,
      storage: deps.storage,
      projectId: params.projectId,
      blobId: params.blobId,
      fileName: params.fileName
    })

    const tasks = await listProgressPlanTasksFactory({ db: deps.db })({
      projectId: params.projectId
    })

    const mappings = tasks.map((task) => ({
      externalId: task.externalId || '',
      wbs: task.wbs || '',
      sysTaskId: task.sysTaskId || task.id
    }))

    const mappingsFilePath = join(tempDir, 'task-mappings.json')
    await readFile(mappingsFilePath, 'utf8').catch(() => null)
    await writeFile(mappingsFilePath, JSON.stringify(mappings, null, 2), 'utf8')

    // 当前 mpxj 版本不支持写 .mpp 二进制，统一导出为 MSPDI(.xml) 格式
    const outputFileName = `exported_${sanitizeFileName(params.fileName).replace(
      /\.(mpp|xml|mspdi|mpx|json)$/i,
      ''
    )}.xml`
    const outputFilePath = join(tempDir, outputFileName)

    try {
      await runWriter({
        inputFilePath: tempFilePath,
        outputFilePath,
        mappingsFilePath
      })

      const exportedBuffer = await readFile(outputFilePath)
      return { exportedBuffer, tempDir, outputFileName }
    } catch {
      const fallbackBuffer = await readFile(tempFilePath)
      return {
        exportedBuffer: fallbackBuffer,
        tempDir,
        outputFileName: params.fileName
      }
    }
  }

export type ProgressPlanWriterMapping = {
  externalId?: string | null
  wbs?: string | null
  sysTaskId?: string | null
}

/**
 * 直接对本地 .mpp 文件运行计划导出器（跳过 blob/数据库环节），
 * 供单元测试与调试使用。
 *
 * 注意：当前 mpxj 版本不支持写 .mpp 二进制，导出格式由输出文件后缀决定
 * （.xml/.mspdi -> MSPDI，.mpx -> MPX，.json -> JSON；.mpp 会抛错）。
 */
export const runProgressPlanWriterOnFile = async (params: {
  inputFilePath: string
  outputFilePath: string
  mappings: ProgressPlanWriterMapping[]
}): Promise<void> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'speckle-progress-mpp-writer-'))
  const mappingsFilePath = join(tempDir, 'task-mappings.json')
  try {
    await writeFile(mappingsFilePath, JSON.stringify(params.mappings, null, 2), 'utf8')
    await runWriter({
      inputFilePath: params.inputFilePath,
      outputFilePath: params.outputFilePath,
      mappingsFilePath
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
