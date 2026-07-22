import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import cryptoRandomString from 'crypto-random-string'
import { db } from '@/db/knex'
import {
  getObjectStorage,
  getSignedDownloadUrlFactory,
  getSignedUrlFactory,
  getBlobMetadataFromStorage
} from '@/modules/blobstorage/clients/objectStorage'
import { getProjectModelByIdFactory } from '@/modules/core/repositories/branches'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { validatePermissionsReadStreamFactory } from '@/modules/core/services/streams/auth'
import { validatePermissionsWriteStreamFactory } from '@/modules/core/services/streams/auth'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  ActiveRvtConversionJobStatuses,
  createRvtConversionJobFactory,
  getRvtConversionJobByIdFactory,
  getRvtConversionJobForModelFactory,
  listRvtConversionJobsFactory,
  updateRvtConversionJobFactory
} from '@/modules/rvt-conversion/repositories/jobs'
import { createRvtConversionDelegatedToken } from '@/modules/rvt-conversion/services/tokens'
import { dispatchRvtConversionJob } from '@/modules/rvt-conversion/services/wsDispatcher'
import { notifyChangeInFileStatus } from '@/modules/fileuploads/services/management'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import type { FileUploadRecord } from '@/modules/fileuploads/helpers/types'
import {
  getFileInfoFactoryV2,
  updateFileUploadFactory
} from '@/modules/fileuploads/repositories/fileUploads'
import { authorizeResolver, validateScopes } from '@/modules/shared'
import {
  getFileSizeLimitMB,
  getFileUploadUrlExpiryMinutes,
  getRvtConversionInternalS3Endpoint
} from '@/modules/shared/helpers/envHelper'
import { getEventBus } from '@/modules/shared/services/eventBus'

const DownloadUrlExpirySeconds = 24 * 60 * 60
const sourceApplicationDefault = 'External RVT Converter'
const serviceTokenHeader = 'x-rvt-conversion-token'
const serviceUpdater = 'rvt-conversion-service'

const routeParamsSchema = z.object({
  projectId: z.string().min(1),
  modelId: z.string().min(1)
})

const jobRouteParamsSchema = routeParamsSchema.extend({
  jobId: z.string().min(1)
})

const projectRouteParamsSchema = z.object({
  projectId: z.string().min(1)
})

const internalJobRouteParamsSchema = z.object({
  projectId: z.string().min(1),
  jobId: z.string().min(1)
})

const createUploadUrlBodySchema = z.object({
  fileName: z.string().trim().min(1).max(512),
  fileSize: z.number().int().min(1).nullable().optional()
})

const createJobBodySchema = z.object({
  fileId: z.string().trim().min(1).max(64),
  fileName: z.string().trim().min(1).max(512),
  etag: z.string().trim().min(1),
  versionMessage: z.string().trim().max(1024).optional(),
  sourceApplication: z.string().trim().min(1).max(128).optional()
})

const ackBodySchema = z.object({
  externalTaskId: z.string().trim().min(1).max(128).optional()
})

const resultBodySchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    externalTaskId: z.string().trim().min(1).max(128).optional(),
    versionId: z.string().trim().min(1),
    errorMessage: z.string().trim().optional()
  }),
  z.object({
    status: z.literal('failed'),
    externalTaskId: z.string().trim().min(1).max(128).optional(),
    versionId: z.string().trim().optional(),
    errorMessage: z.string().trim().min(1)
  })
])

const listJobsQuerySchema = z.object({
  modelId: z.string().trim().min(1).optional(),
  unfinishedOnly: z.enum(['true', 'false']).optional()
})

const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.context.auth || !req.context.userId) {
    return res.status(401).send({ error: 'Authentication required.' })
  }

  return next()
}

const requireServiceToken: RequestHandler = (req, res, next) => {
  const configuredToken = process.env['FILE_CONVERSION_SERVICE_TOKEN']
  if (!configuredToken) {
    return res
      .status(500)
      .send({ error: 'FILE_CONVERSION_SERVICE_TOKEN is not configured.' })
  }

  const token = req.headers[serviceTokenHeader]
  if (!token || typeof token !== 'string') {
    return res.status(401).send({
      error: `Missing ${serviceTokenHeader} request header.`
    })
  }

  if (token !== configuredToken) {
    return res.status(403).send({ error: 'Invalid service token.' })
  }

  return next()
}

const validatePermissionsWriteStream = validatePermissionsWriteStreamFactory({
  validateScopes,
  authorizeResolver
})

const validatePermissionsReadStream = validatePermissionsReadStreamFactory({
  getStream: getStreamFactory({ db }),
  validateScopes,
  authorizeResolver
})

const sanitizeFileName = (fileName: string) =>
  fileName
    .split('/')
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file.rvt'

const ensureRvtFileName = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension !== 'rvt') {
    throw new Error('Only .rvt files are supported.')
  }
}

const buildSourceObjectKey = (params: {
  projectId: string
  fileId: string
  fileName: string
}) =>
  `rvt-conversion/source/${params.projectId}/${params.fileId}/${sanitizeFileName(
    params.fileName
  )}`

const maxFileSizeBytes = () => getFileSizeLimitMB() * 1024 * 1024
const isNoWorkerAvailableError = (error: unknown) =>
  error instanceof Error && error.message === 'No connected RVT worker is available.'

const getRvtConversionDownloadStorage = (
  projectStorage: Awaited<ReturnType<typeof getProjectObjectStorage>>
) => {
  const internalEndpoint = getRvtConversionInternalS3Endpoint()
  if (!internalEndpoint) return projectStorage.public

  return getObjectStorage({
    ...projectStorage.public.params,
    endpoint: internalEndpoint
  })
}

const updateFileUploadFromRvtJobFactory = (deps: {
  projectDb: Awaited<ReturnType<typeof getProjectDbClient>>
}) => {
  const getFileInfo = getFileInfoFactoryV2({ db: deps.projectDb })
  const updateFileUpload = updateFileUploadFactory({ db: deps.projectDb })
  const emitFileStatusChange = notifyChangeInFileStatus({
    eventEmit: getEventBus().emit
  })

  return async (params: {
    job: NonNullable<
      Awaited<ReturnType<ReturnType<typeof getRvtConversionJobByIdFactory>>>
    >
    status: FileUploadConvertedStatus
    convertedMessage: string | null
    convertedCommitId: string | null
  }) => {
    const fileUpload = await getFileInfo({
      fileId: params.job.sourceFileId,
      projectId: params.job.projectId
    })
    if (!fileUpload) return

    const updatedFile = (await updateFileUpload({
      id: fileUpload.id,
      upload: {
        convertedStatus: params.status,
        convertedMessage: params.convertedMessage,
        convertedCommitId: params.convertedCommitId,
        convertedLastUpdate: new Date()
      }
    })) as FileUploadRecord

    await emitFileStatusChange({
      file: updatedFile
    })
  }
}

const serializeJob = (
  job: Awaited<ReturnType<ReturnType<typeof getRvtConversionJobByIdFactory>>>
) =>
  job
    ? {
        id: job.id,
        projectId: job.projectId,
        modelId: job.modelId,
        sourceFileId: job.sourceFileId,
        sourceFileName: job.sourceFileName,
        sourceFileSize: job.sourceFileSize,
        versionMessage: job.versionMessage,
        sourceApplication: job.sourceApplication,
        status: job.status,
        externalTaskId: job.externalTaskId,
        versionId: job.versionId,
        errorMessage: job.errorMessage,
        dispatchedAt: job.dispatchedAt,
        acknowledgedAt: job.acknowledgedAt,
        finishedAt: job.finishedAt,
        creator: job.creator,
        updater: job.updater,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    : null

const ensureModelExists = async (params: { projectId: string; modelId: string }) => {
  const projectDb = await getProjectDbClient({ projectId: params.projectId })
  const getProjectModelById = getProjectModelByIdFactory({ db: projectDb })
  const model = await getProjectModelById({
    projectId: params.projectId,
    modelId: params.modelId
  })

  return { projectDb, model }
}

export const rvtConversionRouterFactory = (): Router => {
  const app = Router()

  app.post(
    '/api/v1/projects/:projectId/models/:modelId/rvt/upload-url',
    requireAuth,
    validateRequest({
      params: routeParamsSchema,
      body: createUploadUrlBodySchema
    }),
    async (req, res) => {
      const { projectId, modelId } = req.params
      const { fileName, fileSize = null } = req.body

      const hasStreamAccess = await validatePermissionsWriteStream(projectId, req)
      if (!hasStreamAccess.result) {
        return res.status(hasStreamAccess.status).end()
      }

      try {
        ensureRvtFileName(fileName)
      } catch (e) {
        return res.status(400).send({ error: (e as Error).message })
      }

      if (fileSize && fileSize > maxFileSizeBytes()) {
        return res.status(400).send({
          error: `File size exceeds maximum allowed size of ${maxFileSizeBytes()} bytes.`
        })
      }

      const { model } = await ensureModelExists({ projectId, modelId })
      if (!model) {
        return res.status(404).send({ error: 'Model not found in project.' })
      }

      const fileId = cryptoRandomString({ length: 10 })
      const objectKey = buildSourceObjectKey({ projectId, fileId, fileName })
      const projectStorage = await getProjectObjectStorage({ projectId })
      const getSignedUrl = getSignedUrlFactory({
        objectStorage: projectStorage.public
      })
      const expiresIn = getFileUploadUrlExpiryMinutes() * 60
      const uploadUrl = await getSignedUrl({
        objectKey,
        urlExpiryDurationSeconds: expiresIn
      })

      return res.send({
        fileId,
        uploadUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
      })
    }
  )

  app.post(
    '/api/v1/projects/:projectId/models/:modelId/rvt/jobs',
    requireAuth,
    validateRequest({
      params: routeParamsSchema,
      body: createJobBodySchema
    }),
    async (req, res) => {
      const { projectId, modelId } = req.params
      const {
        fileId,
        fileName,
        etag,
        versionMessage,
        sourceApplication = sourceApplicationDefault
      } = req.body

      const hasStreamAccess = await validatePermissionsWriteStream(projectId, req)
      if (!hasStreamAccess.result) {
        return res.status(hasStreamAccess.status).end()
      }

      try {
        ensureRvtFileName(fileName)
      } catch (e) {
        return res.status(400).send({ error: (e as Error).message })
      }

      const { projectDb, model } = await ensureModelExists({ projectId, modelId })
      if (!model) {
        return res.status(404).send({ error: 'Model not found in project.' })
      }

      const objectKey = buildSourceObjectKey({ projectId, fileId, fileName })
      const projectStorage = await getProjectObjectStorage({ projectId })
      const getBlobMetadata = getBlobMetadataFromStorage({
        objectStorage: projectStorage.private
      })

      let metadata: { eTag?: string; contentLength?: number }
      try {
        metadata = await getBlobMetadata({ objectKey })
      } catch {
        return res.status(400).send({ error: 'Uploaded source file not found.' })
      }

      if (metadata.eTag !== etag) {
        return res.status(400).send({ error: 'ETag mismatch.' })
      }

      if (!metadata.contentLength) {
        return res.status(400).send({ error: 'Uploaded source file is empty.' })
      }

      if (metadata.contentLength > maxFileSizeBytes()) {
        return res.status(400).send({
          error: `File size exceeds maximum allowed size of ${maxFileSizeBytes()} bytes.`
        })
      }

      const createJob = createRvtConversionJobFactory({ db: projectDb })
      const updateJob = updateRvtConversionJobFactory({ db: projectDb })
      const downloadStorage = getRvtConversionDownloadStorage(projectStorage)
      const getSignedDownloadUrl = getSignedDownloadUrlFactory({
        objectStorage: downloadStorage
      })

      const job = await createJob({
        projectId,
        modelId,
        sourceFileId: fileId,
        sourceFileName: fileName,
        sourceObjectKey: objectKey,
        sourceFileSize: metadata.contentLength,
        versionMessage: versionMessage || null,
        sourceApplication: sourceApplication || null,
        creator: req.context.userId!
      })

      try {
        const [{ id: tokenId, token }, sourceFileUrl] = await Promise.all([
          createRvtConversionDelegatedToken({
            userId: req.context.userId!,
            projectId,
            modelId,
            jobId: job.id
          }),
          getSignedDownloadUrl({
            objectKey,
            urlExpiryDurationSeconds: DownloadUrlExpirySeconds
          })
        ])

        const dispatchedJob = await updateJob({
          id: job.id,
          item: {
            status: 'dispatched',
            dispatchedAt: new Date()
          }
        })

        await dispatchRvtConversionJob({
          job: dispatchedJob || job,
          branchName: model.name || null,
          sourceFileUrl,
          speckleToken: token,
          speckleTokenId: tokenId
        })

        return res.status(201).send({ job: serializeJob(dispatchedJob || job) })
      } catch (e) {
        const failedJob = await updateJob({
          id: job.id,
          item: {
            status: 'failed',
            errorMessage: e instanceof Error ? e.message : 'Failed to dispatch job.'
          }
        })

        return res.status(isNoWorkerAvailableError(e) ? 503 : 502).send({
          error: e instanceof Error ? e.message : 'Failed to dispatch job.',
          job: serializeJob(failedJob || job)
        })
      }
    }
  )

  app.get(
    '/api/v1/projects/:projectId/rvt/jobs',
    requireAuth,
    validateRequest({
      params: projectRouteParamsSchema,
      query: listJobsQuerySchema
    }),
    async (req, res) => {
      const { projectId } = req.params
      const modelId =
        typeof req.query.modelId === 'string' ? req.query.modelId : undefined
      const unfinishedOnly = req.query.unfinishedOnly === 'true'

      const hasStreamAccess = await validatePermissionsReadStream(projectId, req)
      if (!hasStreamAccess.result) {
        return res.status(hasStreamAccess.status).end()
      }

      const projectDb = await getProjectDbClient({ projectId })
      if (modelId) {
        const getProjectModelById = getProjectModelByIdFactory({ db: projectDb })
        const model = await getProjectModelById({ projectId, modelId })
        if (!model) {
          return res.status(404).send({ error: 'Model not found in project.' })
        }
      }

      const listJobs = listRvtConversionJobsFactory({ db: projectDb })
      const jobs = await listJobs({
        projectId,
        ...(modelId ? { modelId } : {}),
        ...(unfinishedOnly ? { statuses: ActiveRvtConversionJobStatuses } : {})
      })

      return res.send({
        jobs: jobs.map((job) => serializeJob(job))
      })
    }
  )

  app.get(
    '/api/v1/projects/:projectId/models/:modelId/rvt/jobs/:jobId',
    requireAuth,
    validateRequest({
      params: jobRouteParamsSchema
    }),
    async (req, res) => {
      const { projectId, modelId, jobId } = req.params

      const hasStreamAccess = await validatePermissionsReadStream(projectId, req)
      if (!hasStreamAccess.result) {
        return res.status(hasStreamAccess.status).end()
      }

      const { projectDb } = await ensureModelExists({ projectId, modelId })
      const getJob = getRvtConversionJobForModelFactory({ db: projectDb })
      const job = await getJob({ id: jobId, projectId, modelId })

      if (!job) {
        return res.status(404).send({ error: 'Job not found.' })
      }

      return res.send({ job: serializeJob(job) })
    }
  )

  app.post(
    '/api/v1/internal/projects/:projectId/rvt/jobs/:jobId/ack',
    requireServiceToken,
    validateRequest({
      params: internalJobRouteParamsSchema,
      body: ackBodySchema
    }),
    async (req, res) => {
      const { projectId, jobId } = req.params
      const projectDb = await getProjectDbClient({ projectId })
      const getJob = getRvtConversionJobByIdFactory({ db: projectDb })
      const updateJob = updateRvtConversionJobFactory({ db: projectDb })
      const updateFileUploadFromRvtJob = updateFileUploadFromRvtJobFactory({
        projectDb
      })
      const job = await getJob({ id: jobId })

      if (!job) {
        return res.status(404).send({ error: 'Job not found.' })
      }

      const updatedJob = await updateJob({
        id: jobId,
        item: {
          status: 'acknowledged',
          externalTaskId: req.body.externalTaskId || job.externalTaskId,
          acknowledgedAt: new Date(),
          updater: serviceUpdater
        }
      })

      await updateFileUploadFromRvtJob({
        job: updatedJob || job,
        status: FileUploadConvertedStatus.Converting,
        convertedMessage: '转换服务已接单',
        convertedCommitId: null
      })

      return res.send({ job: serializeJob(updatedJob || job) })
    }
  )

  app.post(
    '/api/v1/internal/projects/:projectId/rvt/jobs/:jobId/result',
    requireServiceToken,
    validateRequest({
      params: internalJobRouteParamsSchema,
      body: resultBodySchema
    }),
    async (req, res) => {
      const { projectId, jobId } = req.params
      const projectDb = await getProjectDbClient({ projectId })
      const getJob = getRvtConversionJobByIdFactory({ db: projectDb })
      const updateJob = updateRvtConversionJobFactory({ db: projectDb })
      const updateFileUploadFromRvtJob = updateFileUploadFromRvtJobFactory({
        projectDb
      })
      const job = await getJob({ id: jobId })

      if (!job) {
        return res.status(404).send({ error: 'Job not found.' })
      }

      const now = new Date()
      const updatedJob = await updateJob({
        id: jobId,
        item:
          req.body.status === 'success'
            ? {
                status: 'succeeded',
                externalTaskId: req.body.externalTaskId || job.externalTaskId,
                versionId: req.body.versionId,
                errorMessage: null,
                finishedAt: now,
                updater: serviceUpdater
              }
            : {
                status: 'failed',
                externalTaskId: req.body.externalTaskId || job.externalTaskId,
                errorMessage: req.body.errorMessage,
                finishedAt: now,
                updater: serviceUpdater
              }
      })

      await updateFileUploadFromRvtJob({
        job: updatedJob || job,
        status:
          req.body.status === 'success'
            ? FileUploadConvertedStatus.Completed
            : FileUploadConvertedStatus.Error,
        convertedMessage: req.body.status === 'success' ? null : req.body.errorMessage,
        convertedCommitId: req.body.status === 'success' ? req.body.versionId : null
      })

      return res.send({ job: serializeJob(updatedJob || job) })
    }
  )

  return app
}
