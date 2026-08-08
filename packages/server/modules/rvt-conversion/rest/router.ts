import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import cryptoRandomString from 'crypto-random-string'
import { db } from '@/db/knex'
import {
  getDynamicPublicObjectStorage,
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
  listRvtConversionJobsBySourceFileFactory,
  listRvtConversionJobsFactory,
  updateRvtConversionJobFactory
} from '@/modules/rvt-conversion/repositories/jobs'
import { getRvtConversionDownloadStorage } from '@/modules/rvt-conversion/services/storage'
import {
  acknowledgeRvtConversionJob,
  completeRvtConversionJob
} from '@/modules/rvt-conversion/services/lifecycle'
import { createRvtConversionDelegatedToken } from '@/modules/rvt-conversion/services/tokens'
import { dispatchRvtConversionJob } from '@/modules/rvt-conversion/services/wsDispatcher'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import { authorizeResolver, validateScopes } from '@/modules/shared'
import {
  getFileSizeLimitMB,
  getFileUploadUrlExpiryMinutes
} from '@/modules/shared/helpers/envHelper'
import { moduleLogger } from '@/observability/logging'
import { resolveFrontendOriginFromRequest } from '@/modules/shared/helpers/frontendOrigin'

const DownloadUrlExpirySeconds = 24 * 60 * 60
const sourceApplicationDefault = 'External RVT Converter'
const serviceTokenHeader = 'x-rvt-conversion-token'
const rvtRouterLogger = moduleLogger.child({
  module: 'rvt-conversion',
  component: 'rest-router'
})

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

      rvtRouterLogger.info(
        {
          projectId,
          modelId,
          userId: req.context.userId,
          fileName,
          fileSize
        },
        'RVT CONVERT upload URL request received'
      )

      const hasStreamAccess = await validatePermissionsWriteStream(projectId, req)
      if (!hasStreamAccess.result) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            status: hasStreamAccess.status
          },
          'RVT CONVERT upload URL request denied by permissions'
        )
        return res.status(hasStreamAccess.status).end()
      }

      try {
        ensureRvtFileName(fileName)
      } catch (e) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileName,
            error: (e as Error).message
          },
          'RVT CONVERT upload URL request rejected due to unsupported file type'
        )
        return res.status(400).send({ error: (e as Error).message })
      }

      if (fileSize && fileSize > maxFileSizeBytes()) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileName,
            fileSize,
            maxFileSizeBytes: maxFileSizeBytes()
          },
          'RVT CONVERT upload URL request rejected due to file size limit'
        )
        return res.status(400).send({
          error: `File size exceeds maximum allowed size of ${maxFileSizeBytes()} bytes.`
        })
      }

      const { model } = await ensureModelExists({ projectId, modelId })
      if (!model) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileName
          },
          'RVT CONVERT upload URL request failed because model was not found'
        )
        return res.status(404).send({ error: 'Model not found in project.' })
      }

      const fileId = cryptoRandomString({ length: 10 })
      const objectKey = buildSourceObjectKey({ projectId, fileId, fileName })
      const projectStorage = await getProjectObjectStorage({ projectId })
      const getSignedUrl = getSignedUrlFactory({
        objectStorage: getDynamicPublicObjectStorage({
          objectStorage: projectStorage.public,
          frontendOrigin: resolveFrontendOriginFromRequest(req)
        })
      })
      const expiresIn = getFileUploadUrlExpiryMinutes() * 60
      const uploadUrl = await getSignedUrl({
        objectKey,
        urlExpiryDurationSeconds: expiresIn
      })

      rvtRouterLogger.info(
        {
          projectId,
          modelId,
          userId: req.context.userId,
          fileId,
          fileName,
          objectKey,
          uploadUrlOrigin: new URL(uploadUrl).origin,
          expiresInSeconds: expiresIn
        },
        'RVT CONVERT upload URL generated'
      )

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

      rvtRouterLogger.info(
        {
          projectId,
          modelId,
          userId: req.context.userId,
          fileId,
          fileName,
          etag,
          sourceApplication,
          hasVersionMessage: !!versionMessage
        },
        'RVT CONVERT job creation request received'
      )

      const hasStreamAccess = await validatePermissionsWriteStream(projectId, req)
      if (!hasStreamAccess.result) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileId,
            status: hasStreamAccess.status
          },
          'RVT CONVERT job creation denied by permissions'
        )
        return res.status(hasStreamAccess.status).end()
      }

      try {
        ensureRvtFileName(fileName)
      } catch (e) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileId,
            fileName,
            error: (e as Error).message
          },
          'RVT CONVERT job creation rejected due to unsupported file type'
        )
        return res.status(400).send({ error: (e as Error).message })
      }

      const { projectDb, model } = await ensureModelExists({ projectId, modelId })
      if (!model) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileId,
            fileName
          },
          'RVT CONVERT job creation failed because model was not found'
        )
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
      } catch (error) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileId,
            fileName,
            objectKey,
            err: error
          },
          'RVT CONVERT job creation failed because uploaded source file metadata was not found'
        )
        return res.status(400).send({ error: 'Uploaded source file not found.' })
      }

      if (metadata.eTag !== etag) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileId,
            fileName,
            objectKey,
            expectedEtag: metadata.eTag,
            providedEtag: etag
          },
          'RVT CONVERT job creation failed due to ETag mismatch'
        )
        return res.status(400).send({ error: 'ETag mismatch.' })
      }

      if (!metadata.contentLength) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileId,
            fileName,
            objectKey
          },
          'RVT CONVERT job creation failed because uploaded source file is empty'
        )
        return res.status(400).send({ error: 'Uploaded source file is empty.' })
      }

      if (metadata.contentLength > maxFileSizeBytes()) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileId,
            fileName,
            objectKey,
            contentLength: metadata.contentLength,
            maxFileSizeBytes: maxFileSizeBytes()
          },
          'RVT CONVERT job creation failed because uploaded source file exceeds size limit'
        )
        return res.status(400).send({
          error: `File size exceeds maximum allowed size of ${maxFileSizeBytes()} bytes.`
        })
      }

      const createJob = createRvtConversionJobFactory({ db: projectDb })
      const listJobsBySourceFile = listRvtConversionJobsBySourceFileFactory({
        db: projectDb
      })
      const updateJob = updateRvtConversionJobFactory({ db: projectDb })
      const downloadStorage = getRvtConversionDownloadStorage(projectStorage)
      const getSignedDownloadUrl = getSignedDownloadUrlFactory({
        objectStorage: downloadStorage
      })

      const existingJobs = await listJobsBySourceFile({
        projectId,
        sourceFileId: fileId,
        limit: 5
      })
      if (existingJobs.length) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            fileId,
            fileName,
            objectKey,
            existingJobs: existingJobs.map((job) => ({
              jobId: job.id,
              status: job.status,
              versionId: job.versionId,
              externalTaskId: job.externalTaskId,
              createdAt: job.createdAt
            }))
          },
          'RVT CONVERT duplicate dispatch detected before REST job creation'
        )
      }

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

      rvtRouterLogger.info(
        {
          projectId,
          modelId,
          userId: req.context.userId,
          jobId: job.id,
          fileId,
          fileName,
          objectKey,
          sourceFileSize: metadata.contentLength,
          sourceApplication
        },
        'RVT CONVERT job record created'
      )

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

        rvtRouterLogger.info(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            jobId: job.id,
            fileId,
            speckleTokenId: tokenId,
            sourceFileUrlOrigin: new URL(sourceFileUrl).origin,
            hasSpeckleToken: !!token
          },
        'RVT CONVERT job dispatch payload prepared'
        )

        const dispatchedJob = await updateJob({
          id: job.id,
          item: {
            status: 'dispatched',
            dispatchedAt: new Date()
          }
        })

        rvtRouterLogger.info(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            jobId: job.id,
            fileId
          },
        'RVT CONVERT job marked as dispatched'
        )

        await dispatchRvtConversionJob({
          job: dispatchedJob || job,
          branchName: model.name || null,
          sourceFileUrl,
          speckleToken: token,
          speckleTokenId: tokenId
        })

        rvtRouterLogger.info(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            jobId: job.id,
            fileId,
            branchName: model.name || null
          },
        'RVT CONVERT job dispatched to worker successfully'
        )

        return res.status(201).send({ job: serializeJob(dispatchedJob || job) })
      } catch (e) {
        const failedJob = await updateJob({
          id: job.id,
          item: {
            status: 'failed',
            errorMessage: e instanceof Error ? e.message : 'Failed to dispatch job.'
          }
        })

        rvtRouterLogger.error(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            jobId: job.id,
            fileId,
            err: e,
            failedJobStatus: failedJob?.status || job.status
          },
          'RVT CONVERT job dispatch failed'
        )

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

      rvtRouterLogger.info(
        {
          projectId,
          modelId,
          userId: req.context.userId,
          unfinishedOnly
        },
        'RVT CONVERT jobs list request received'
      )

      const hasStreamAccess = await validatePermissionsReadStream(projectId, req)
      if (!hasStreamAccess.result) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            userId: req.context.userId,
            status: hasStreamAccess.status
          },
          'RVT CONVERT jobs list request denied by permissions'
        )
        return res.status(hasStreamAccess.status).end()
      }

      const projectDb = await getProjectDbClient({ projectId })
      if (modelId) {
        const getProjectModelById = getProjectModelByIdFactory({ db: projectDb })
        const model = await getProjectModelById({ projectId, modelId })
        if (!model) {
          rvtRouterLogger.warn(
            {
              projectId,
              modelId,
              userId: req.context.userId
            },
            'RVT CONVERT jobs list request failed because model was not found'
          )
          return res.status(404).send({ error: 'Model not found in project.' })
        }
      }

      const listJobs = listRvtConversionJobsFactory({ db: projectDb })
      const jobs = await listJobs({
        projectId,
        ...(modelId ? { modelId } : {}),
        ...(unfinishedOnly ? { statuses: ActiveRvtConversionJobStatuses } : {})
      })

      rvtRouterLogger.info(
        {
          projectId,
          modelId,
          userId: req.context.userId,
          unfinishedOnly,
          jobCount: jobs.length
        },
        'RVT CONVERT jobs list request completed'
      )

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

      rvtRouterLogger.info(
        {
          projectId,
          modelId,
          jobId,
          userId: req.context.userId
        },
        'RVT CONVERT job detail request received'
      )

      const hasStreamAccess = await validatePermissionsReadStream(projectId, req)
      if (!hasStreamAccess.result) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            jobId,
            userId: req.context.userId,
            status: hasStreamAccess.status
          },
          'RVT CONVERT job detail request denied by permissions'
        )
        return res.status(hasStreamAccess.status).end()
      }

      const { projectDb } = await ensureModelExists({ projectId, modelId })
      const getJob = getRvtConversionJobForModelFactory({ db: projectDb })
      const job = await getJob({ id: jobId, projectId, modelId })

      if (!job) {
        rvtRouterLogger.warn(
          {
            projectId,
            modelId,
            jobId,
            userId: req.context.userId
          },
          'RVT CONVERT job detail request failed because job was not found'
        )
        return res.status(404).send({ error: 'Job not found.' })
      }

      rvtRouterLogger.info(
        {
          projectId,
          modelId,
          jobId,
          userId: req.context.userId,
          status: job.status,
          sourceFileId: job.sourceFileId,
          versionId: job.versionId
        },
        'RVT CONVERT job detail request completed'
      )

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
      rvtRouterLogger.info(
        {
          projectId,
          jobId,
          externalTaskId: req.body.externalTaskId || null
        },
        'RVT CONVERT job ack request received'
      )
      const projectDb = await getProjectDbClient({ projectId })
      const getJob = getRvtConversionJobByIdFactory({ db: projectDb })
      const job = await getJob({ id: jobId })

      if (!job) {
        rvtRouterLogger.warn(
          {
            projectId,
            jobId,
            externalTaskId: req.body.externalTaskId || null
          },
          'RVT CONVERT job ack request failed because job was not found'
        )
        return res.status(404).send({ error: 'Job not found.' })
      }

      const updatedJob = await acknowledgeRvtConversionJob({
        projectId,
        taskId: jobId,
        externalTaskId: req.body.externalTaskId || null
      })
      if (!updatedJob) {
        rvtRouterLogger.warn(
          {
            projectId,
            jobId,
            externalTaskId: req.body.externalTaskId || null
          },
          'RVT CONVERT job ack request could not persist updated job'
        )
        return res.status(404).send({ error: 'Job not found.' })
      }

      rvtRouterLogger.info(
        {
          projectId,
          modelId: updatedJob.modelId,
          jobId,
          sourceFileId: updatedJob.sourceFileId,
          externalTaskId: updatedJob.externalTaskId,
          acknowledgedAt: updatedJob.acknowledgedAt
        },
        'RVT CONVERT job acknowledged successfully'
      )

      rvtRouterLogger.info(
        {
          projectId,
          modelId: updatedJob.modelId,
          jobId,
          sourceFileId: updatedJob.sourceFileId
        },
        'RVT CONVERT job ack file upload sync completed'
      )

      return res.send({ job: serializeJob(updatedJob) })
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
      rvtRouterLogger.info(
        {
          projectId,
          jobId,
          status: req.body.status,
          externalTaskId: req.body.externalTaskId || null,
          versionId: 'versionId' in req.body ? req.body.versionId || null : null,
          hasErrorMessage: !!('errorMessage' in req.body && req.body.errorMessage)
        },
        'RVT CONVERT job result request received'
      )
      const projectDb = await getProjectDbClient({ projectId })
      const getJob = getRvtConversionJobByIdFactory({ db: projectDb })
      const job = await getJob({ id: jobId })

      if (!job) {
        rvtRouterLogger.warn(
          {
            projectId,
            jobId,
            status: req.body.status,
            externalTaskId: req.body.externalTaskId || null
          },
          'RVT CONVERT job result request failed because job was not found'
        )
        return res.status(404).send({ error: 'Job not found.' })
      }

      const updatedJob = await completeRvtConversionJob(
        req.body.status === 'success'
          ? {
              projectId,
              taskId: jobId,
              status: 'success',
              externalTaskId: req.body.externalTaskId || null,
              versionId: req.body.versionId
            }
          : {
              projectId,
              taskId: jobId,
              status: 'failed',
              externalTaskId: req.body.externalTaskId || null,
              errorMessage: req.body.errorMessage
            }
      )
      if (!updatedJob) {
        rvtRouterLogger.warn(
          {
            projectId,
            jobId,
            status: req.body.status,
            externalTaskId: req.body.externalTaskId || null
          },
          'RVT CONVERT job result request could not persist updated job'
        )
        return res.status(404).send({ error: 'Job not found.' })
      }

      rvtRouterLogger.info(
        {
          projectId,
          modelId: updatedJob.modelId,
          jobId,
          sourceFileId: updatedJob.sourceFileId,
          status: updatedJob.status,
          externalTaskId: updatedJob.externalTaskId,
          versionId: updatedJob.versionId,
          errorMessage: updatedJob.errorMessage,
          finishedAt: updatedJob.finishedAt
        },
        'RVT CONVERT job result persisted successfully'
      )

      rvtRouterLogger.info(
        {
          projectId,
          modelId: updatedJob.modelId,
          jobId,
          sourceFileId: updatedJob.sourceFileId,
          convertedStatus:
            req.body.status === 'success'
              ? FileUploadConvertedStatus.Completed
              : FileUploadConvertedStatus.Error,
          convertedCommitId: req.body.status === 'success' ? req.body.versionId : null
        },
        'RVT CONVERT job result file upload sync completed'
      )

      return res.send({ job: serializeJob(updatedJob) })
    }
  )

  return app
}
