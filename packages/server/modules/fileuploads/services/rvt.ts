import { getSignedDownloadUrlFactory } from '@/modules/blobstorage/clients/objectStorage'
import { getObjectKey } from '@/modules/blobstorage/helpers/blobs'
import type { FileUploadRecordV2 } from '@/modules/fileuploads/helpers/types'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import {
  createRvtConversionJobFactory,
  listRvtConversionJobsBySourceFileFactory,
  type RvtConversionJob,
  updateRvtConversionJobFactory
} from '@/modules/rvt-conversion/repositories/jobs'
import {
  buildRvtJobLogContext,
  createRvtConvertLogger
} from '@/modules/rvt-conversion/services/logging'
import { getRvtConversionDownloadStorage } from '@/modules/rvt-conversion/services/storage'
import { createRvtConversionDelegatedToken } from '@/modules/rvt-conversion/services/tokens'
import { dispatchRvtConversionJob } from '@/modules/rvt-conversion/services/wsDispatcher'
import type { Knex } from 'knex'

const downloadUrlExpirySeconds = 24 * 60 * 60
const rvtFileImportLogger = createRvtConvertLogger('fileupload-dispatch')

const resolveSourceApplication = (fileType: string) => {
  const normalized = fileType.toLowerCase()
  switch (normalized) {
    case 'skp':
      return 'External SketchUp Converter'
    case 'nwd':
    case 'nwc':
      return 'External Navisworks Converter'
    case 'rvt':
    default:
      return 'External RVT Converter'
  }
}

export const dispatchRvtFileImportFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    modelName: string
    fileUpload: FileUploadRecordV2
    userId: string
  }): Promise<RvtConversionJob> => {
    const { projectId, modelId, modelName, fileUpload, userId } = params
    rvtFileImportLogger.info(
      {
        projectId,
        modelId,
        modelName,
        userId,
        fileUploadId: fileUpload.id,
        fileName: fileUpload.fileName,
        fileSize: fileUpload.fileSize
      },
      'RVT_CONVERT file upload dispatch requested'
    )

    const projectStorage = await getProjectObjectStorage({ projectId })
    const getSignedDownloadUrl = getSignedDownloadUrlFactory({
      objectStorage: getRvtConversionDownloadStorage(projectStorage)
    })
    const objectKey = getObjectKey(projectId, fileUpload.id)
    const createJob = createRvtConversionJobFactory({ db: deps.db })
    const listJobsBySourceFile = listRvtConversionJobsBySourceFileFactory({
      db: deps.db
    })
    const updateJob = updateRvtConversionJobFactory({ db: deps.db })

    const existingJobs = await listJobsBySourceFile({
      projectId,
      sourceFileId: fileUpload.id,
      limit: 5
    })
    if (existingJobs.length) {
      rvtFileImportLogger.warn(
        {
          projectId,
          modelId,
          modelName,
          userId,
          fileUploadId: fileUpload.id,
          fileName: fileUpload.fileName,
          existingJobs: existingJobs.map((job) => ({
            jobId: job.id,
            status: job.status,
            versionId: job.versionId,
            externalTaskId: job.externalTaskId,
            createdAt: job.createdAt
          }))
        },
        'RVT_CONVERT duplicate dispatch detected before file upload job creation'
      )
    }

    const job = await createJob({
      projectId,
      modelId,
      sourceFileId: fileUpload.id,
      sourceFileName: fileUpload.fileName,
      sourceObjectKey: objectKey,
      sourceFileSize: fileUpload.fileSize,
      versionMessage: null,
      sourceApplication: resolveSourceApplication(fileUpload.fileType),
      creator: userId
    })

    rvtFileImportLogger.info(
      {
        ...buildRvtJobLogContext(job),
        projectId,
        modelId,
        modelName,
        userId,
        fileUploadId: fileUpload.id,
        objectKey
      },
      'RVT_CONVERT job created from file upload'
    )

    try {
      const [{ id: tokenId, token }, sourceFileUrl] = await Promise.all([
        createRvtConversionDelegatedToken({
          userId,
          projectId,
          modelId,
          jobId: job.id
        }),
        getSignedDownloadUrl({
          objectKey,
          urlExpiryDurationSeconds: downloadUrlExpirySeconds
        })
      ])

      rvtFileImportLogger.info(
        {
          ...buildRvtJobLogContext(job),
          projectId,
          modelId,
          modelName,
          userId,
          fileUploadId: fileUpload.id,
          sourceFileUrlOrigin: new URL(sourceFileUrl).origin,
          speckleTokenId: tokenId
        },
        'RVT_CONVERT file upload dispatch payload prepared'
      )

      const dispatchedJob = await updateJob({
        id: job.id,
        item: {
          status: 'dispatched',
          dispatchedAt: new Date()
        }
      })

      rvtFileImportLogger.info(
        {
          ...buildRvtJobLogContext(dispatchedJob || job),
          projectId,
          modelId,
          modelName,
          userId,
          fileUploadId: fileUpload.id
        },
        'RVT_CONVERT job marked as dispatched from file upload'
      )

      await dispatchRvtConversionJob({
        job: dispatchedJob || job,
        branchName: modelName || null,
        sourceFileUrl,
        speckleToken: token,
        speckleTokenId: tokenId,
        fileType: fileUpload.fileType
      })

      rvtFileImportLogger.info(
        {
          ...buildRvtJobLogContext(dispatchedJob || job),
          projectId,
          modelId,
          modelName,
          userId,
          fileUploadId: fileUpload.id
        },
        'RVT_CONVERT file upload dispatched to worker successfully'
      )

      return dispatchedJob || job
    } catch (error) {
      rvtFileImportLogger.error(
        {
          ...buildRvtJobLogContext(job),
          projectId,
          modelId,
          modelName,
          userId,
          fileUploadId: fileUpload.id,
          err: error
        },
        'RVT_CONVERT file upload dispatch failed'
      )
      await updateJob({
        id: job.id,
        item: {
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Failed to dispatch job.'
        }
      })

      throw error
    }
  }
