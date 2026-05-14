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
import { access, mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import type { Knex } from 'knex'

const execFile = promisify(execFileCallback)

type ExtractedPlanTask = {
  externalId?: string | null
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

const currentDir = dirname(fileURLToPath(import.meta.url))
const serverRoot = resolve(currentDir, '../../..')
const workspaceRoot = resolve(serverRoot, '../..')
const javaSourcePath = resolve(currentDir, '../java/ProgressPlanMppExtractor.java')
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
    resolve(serverRoot, '.venv-progress-mpp/lib'),
    resolve(workspaceRoot, '.venv-progress-mpp/lib'),
    resolve(workspaceRoot, 'packages/server/.venv-progress-mpp/lib')
  ].filter((value): value is string => !!value?.trim())

  return [...new Set(candidates)]
}

const getMpxjLibDirCandidates = (libRoot: string) =>
  [process.env.MPXJ_LIB_DIR, join(libRoot, 'site-packages', 'mpxj', 'lib')].filter(
    (value): value is string => !!value?.trim()
  )

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

const ensureCompiledExtractor = async () => {
  await mkdir(javaBuildDir, { recursive: true })

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
    ['-cp', `${mpxjLibDir}/*`, '-d', javaBuildDir, javaSourcePath],
    {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/openjdk/bin:${process.env.PATH || ''}`,
        JAVA_HOME: '/opt/homebrew/opt/openjdk'
      }
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
          projectId: params.projectId
        })
        const replaced = await replaceProgressPlanTasksFactory({ db: trx })({
          projectId: params.projectId,
          planFileId: params.planFileId,
          actorId: params.actorId,
          tasks: extractedTasks
        })

        await syncPlanTaskDerivedDataFactory({ db: trx })({
          projectId: params.projectId,
          previousTasks,
          nextTasks: replaced,
          actorId: params.actorId
        })

        return replaced
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

export const readCompiledExtractorSourceFactory = async () => {
  return await readFile(javaSourcePath, 'utf8')
}
