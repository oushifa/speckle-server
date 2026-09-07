import type { ObjectStorage } from '@/modules/blobstorage/clients/objectStorage'
import { getBlobMetadataFactory } from '@/modules/blobstorage/repositories'
import { getObjectStreamFactory } from '@/modules/blobstorage/repositories/blobs'
import { getFileStreamFactory } from '@/modules/blobstorage/services/management'
import {
  replaceProgressV2PlanTasksFactory,
  type ProgressV2PlanTaskRecord
} from '@/modules/progress-v2/repositories/progressV2PlanTasks'
import {
  replaceProgressV2AnnualPlanTasksFactory,
  type ProgressV2AnnualPlanTaskRecord
} from '@/modules/progress-v2/repositories/progressV2AnnualPlanTasks'
import {
  runProgressPlanExtractorOnFile,
  exportProgressPlanFileWithSysTaskIdFactory
} from '@/modules/progress/services/mppTaskImport'
import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Knex } from 'knex'

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'progress-plan.mpp'

const createTempMppFile = async (params: {
  db: Knex
  storage: ObjectStorage
  projectId: string
  blobId: string
  fileName: string
}) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'speckle-progress-v2-mpp-'))
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

/**
 * 导入总进度计划 MPP 任务
 */
export const importProgressV2PlanTasksFromBlobFactory =
  (deps: { db: Knex; storage: ObjectStorage }) =>
  async (params: {
    projectId: string
    planFileId: string
    blobId: string
    fileName: string
    actorId: string
  }): Promise<ProgressV2PlanTaskRecord[]> => {
    const { tempDir, tempFilePath } = await createTempMppFile({
      db: deps.db,
      storage: deps.storage,
      projectId: params.projectId,
      blobId: params.blobId,
      fileName: params.fileName
    })

    try {
      const extractedTasks = await runProgressPlanExtractorOnFile(tempFilePath)
      return await replaceProgressV2PlanTasksFactory({ db: deps.db })({
        projectId: params.projectId,
        planFileId: params.planFileId,
        tasks: extractedTasks.map((t) => ({
          ...t,
          planStart: t.planStart ? new Date(t.planStart) : null,
          planEnd: t.planEnd ? new Date(t.planEnd) : null,
          creator: params.actorId,
          updater: params.actorId
        }))
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

/**
 * 导入年度计划 MPP 任务
 */
export const importProgressV2AnnualPlanTasksFromBlobFactory =
  (deps: { db: Knex; storage: ObjectStorage }) =>
  async (params: {
    projectId: string
    annualPlanId: string
    blobId: string
    fileName: string
    actorId: string
  }): Promise<ProgressV2AnnualPlanTaskRecord[]> => {
    const { tempDir, tempFilePath } = await createTempMppFile({
      db: deps.db,
      storage: deps.storage,
      projectId: params.projectId,
      blobId: params.blobId,
      fileName: params.fileName
    })

    try {
      const extractedTasks = await runProgressPlanExtractorOnFile(tempFilePath)
      return await replaceProgressV2AnnualPlanTasksFactory({ db: deps.db })({
        projectId: params.projectId,
        annualPlanId: params.annualPlanId,
        tasks: extractedTasks.map((t) => ({
          ...t,
          planStart: t.planStart ? new Date(t.planStart) : null,
          planEnd: t.planEnd ? new Date(t.planEnd) : null,
          creator: params.actorId,
          updater: params.actorId
        }))
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

export { exportProgressPlanFileWithSysTaskIdFactory as exportProgressV2PlanFileWithSysTaskIdFactory }
