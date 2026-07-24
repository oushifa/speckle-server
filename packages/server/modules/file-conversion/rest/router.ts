import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import cryptoRandomString from 'crypto-random-string'
import { db } from '@/db/knex'
import {
  createFileConversionFactory,
  getFileConversionByIdFactory,
  getUserFileConversionByIdFactory,
  listFileConversionsFactory,
  listPendingFileConversionsFactory,
  updateFileConversionFactory,
  type FileConversionListItem,
  type FileConversionRecord,
  type FileConversionStatus
} from '@/modules/file-conversion/repositories/fileConversions'
import {
  createFileConversionEventFactory,
  getFileConversionEventByIdFactory,
  getLatestFileConversionEventByFileIdFactory,
  updateFileConversionEventFactory
} from '@/modules/file-conversion/repositories/fileConversionEvents'
import {
  getDynamicPublicObjectStorage,
  getBlobMetadataFromStorage,
  getPublicMainObjectStorage,
  getSignedDownloadUrlFactory,
  getSignedUrlFactory,
  getMainObjectStorage,
  getObjectStorage
} from '@/modules/blobstorage/clients/objectStorage'
import {
  getFileConversionInternalS3Endpoint,
  getFileSizeLimitMB,
  getFileUploadUrlExpiryMinutes,
  getS3AccessKey,
  getS3BucketName,
  getS3Region,
  getS3SecretKey
} from '@/modules/shared/helpers/envHelper'
import { resolveFrontendOriginFromRequest } from '@/modules/shared/helpers/frontendOrigin'

const listQuerySchema = z.object({
  keyword: z.string().trim().optional(),
  status: z
    .enum(['uploaded', 'pending', 'queued', 'processing', 'success', 'failed'])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
})

const idParamsSchema = z.object({
  id: z.string().min(1)
})

const createBodySchema = z.object({
  fileName: z.string().trim().min(1).max(512),
  fileSize: z.number().int().min(0).nullable().optional()
})

const uploadCompleteSchema = z.object({
  etag: z.string().trim().min(1)
})

const startSchema = z.object({
  operator: z.string().trim().min(1).max(128).optional()
})

const processingSchema = z.object({
  eventId: z.string().min(1),
  operator: z.string().trim().min(1).max(128).optional()
})

const resultUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(512),
  fileSize: z.number().int().min(0).nullable().optional(),
  contentType: z.string().trim().min(1).max(256).optional()
})

const callbackSchema = z.object({
  eventId: z.string().min(1),
  status: z.enum(['success', 'failed']),
  resultObjectKey: z.string().trim().min(1).optional(),
  resultFileUrl: z.string().trim().url().optional(),
  message: z.string().trim().optional()
})

const createFileConversion = createFileConversionFactory({ db })
const getFileConversionById = getFileConversionByIdFactory({ db })
const getUserFileConversionById = getUserFileConversionByIdFactory({ db })
const updateFileConversion = updateFileConversionFactory({ db })
const listFileConversions = listFileConversionsFactory({ db })
const listPendingFileConversions = listPendingFileConversionsFactory({ db })
const createFileConversionEvent = createFileConversionEventFactory({ db })
const getFileConversionEventById = getFileConversionEventByIdFactory({ db })
const getLatestFileConversionEventByFileId = getLatestFileConversionEventByFileIdFactory({
  db
})
const updateFileConversionEvent = updateFileConversionEventFactory({ db })

const publicObjectStorage = getPublicMainObjectStorage()
const internalServiceObjectStorage = (() => {
  const endpoint = getFileConversionInternalS3Endpoint()
  if (!endpoint) return publicObjectStorage

  return getObjectStorage({
    credentials: {
      accessKeyId: getS3AccessKey(),
      secretAccessKey: getS3SecretKey()
    },
    endpoint,
    region: getS3Region(),
    bucket: getS3BucketName()
  })
})()

const getPublicSignedDownloadUrl = getSignedDownloadUrlFactory({
  objectStorage: publicObjectStorage
})
const getInternalSignedUrl = getSignedUrlFactory({
  objectStorage: internalServiceObjectStorage
})
const getInternalSignedDownloadUrl = getSignedDownloadUrlFactory({
  objectStorage: internalServiceObjectStorage
})
const getObjectMetadata = getBlobMetadataFromStorage({
  objectStorage: getMainObjectStorage()
})

const getDownloadUrl = async (params: {
  objectKey: string | null
  target?: 'public' | 'internal'
}) => {
  const { objectKey, target = 'public' } = params
  if (!objectKey) return null

  const signer =
    target === 'internal' ? getInternalSignedDownloadUrl : getPublicSignedDownloadUrl

  return await signer({
    objectKey,
    urlExpiryDurationSeconds: getFileUploadUrlExpiryMinutes() * 60
  })
}

const serializeFile = async (
  record: FileConversionRecord | FileConversionListItem,
  target: 'public' | 'internal' = 'public'
) => ({
  id: record.id,
  fileName: record.fileName,
  fileSize: record.fileSize,
  sourceObjectKey: record.sourceObjectKey,
  sourceFileUrl: await getDownloadUrl({
    objectKey: record.sourceObjectKey,
    target
  }),
  resultObjectKey: record.resultObjectKey,
  resultFileUrl: await getDownloadUrl({
    objectKey: record.resultObjectKey,
    target
  }),
  streamId: record.streamId,
  status: record.status,
  isConverted: record.isConverted,
  uploadedAt: record.uploadedAt,
  startedAt: record.startedAt,
  convertedAt: record.convertedAt,
  errorMessage: record.errorMessage,
  creator: record.creator,
  creatorName: 'creatorName' in record ? record.creatorName : undefined,
  updater: record.updater,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
})

const getObjectUploadUrl = async (params: {
  objectKey: string
  target?: 'public' | 'internal'
  frontendOrigin?: string
}) => {
  const signer =
    params.target === 'internal'
      ? getInternalSignedUrl
      : getSignedUrlFactory({
          objectStorage: getDynamicPublicObjectStorage({
            objectStorage: publicObjectStorage,
            frontendOrigin: params.frontendOrigin
          })
        })
  return await signer({
    objectKey: params.objectKey,
    urlExpiryDurationSeconds: getFileUploadUrlExpiryMinutes() * 60
  })
}

const thirdPartyTokenHeader = 'x-file-conversion-token'

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

  const token = req.headers[thirdPartyTokenHeader]
  if (!token || typeof token !== 'string') {
    return res.status(401).send({
      error: `Missing ${thirdPartyTokenHeader} request header.`
    })
  }

  if (token !== configuredToken) {
    return res.status(403).send({ error: 'Invalid service token.' })
  }

  return next()
}

const sanitizeFileName = (fileName: string) =>
  fileName
    .split('/')
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file'

const buildObjectKey = (params: {
  category: 'source' | 'result'
  fileId: string
  fileName: string
}) => `file-conversion/${params.category}/${params.fileId}/${sanitizeFileName(params.fileName)}`

const maxFileSizeBytes = () => getFileSizeLimitMB() * 1024 * 1024

const ensureObjectExists = async (params: { objectKey: string; expectedETag?: string }) => {
  const metadata = await getObjectMetadata({ objectKey: params.objectKey })
  if (params.expectedETag && metadata.eTag !== params.expectedETag) {
    return { ok: false as const, error: 'ETag mismatch.' }
  }

  if (!metadata.contentLength) {
    return { ok: false as const, error: 'Uploaded object is empty.' }
  }

  return { ok: true as const, metadata }
}

export const fileConversionRouterFactory = (): Router => {
  const app = Router()

  app.post(
    '/api/v1/file-conversions',
    requireAuth,
    validateRequest({ body: createBodySchema }),
    async (req, res) => {
      const fileName = req.body.fileName.trim()
      const fileSize = req.body.fileSize ?? null
      if (fileSize && fileSize > maxFileSizeBytes()) {
        return res.status(400).send({
          error: `File size exceeds maximum allowed size of ${maxFileSizeBytes()} bytes.`
        })
      }

      const id = cryptoRandomString({ length: 10 })
      const streamId = `conv_${cryptoRandomString({ length: 20 })}`
      const sourceObjectKey = buildObjectKey({
        category: 'source',
        fileId: id,
        fileName
      })
      const uploadUrl = await getObjectUploadUrl({
        objectKey: sourceObjectKey,
        target: 'public',
        frontendOrigin: resolveFrontendOriginFromRequest(req)
      })

      const record = await createFileConversion({
        id,
        streamId,
        fileName,
        fileSize,
        sourceObjectKey,
        sourceFileUrl: null as unknown as string,
        creator: req.context.userId!
      })

      return res.status(201).send({
        ...(await serializeFile(record)),
        uploadUrl
      })
    }
  )

  app.post(
    '/api/v1/file-conversions/:id/upload-complete',
    requireAuth,
    validateRequest({ params: idParamsSchema, body: uploadCompleteSchema }),
    async (req, res) => {
      const record = await getUserFileConversionById({
        id: req.params.id,
        creator: req.context.userId!
      })
      if (!record) {
        return res.status(404).send({ error: 'File conversion record not found.' })
      }

      if (!record.sourceObjectKey) {
        return res.status(400).send({ error: 'Source object key is missing.' })
      }

      if (record.status !== 'uploaded') {
        return res.status(200).send(await serializeFile(record))
      }

      const objectCheck = await ensureObjectExists({
        objectKey: record.sourceObjectKey,
        expectedETag: req.body.etag
      })
      if (!objectCheck.ok) {
        return res.status(400).send({ error: objectCheck.error })
      }

      if ((objectCheck.metadata.contentLength || 0) > maxFileSizeBytes()) {
        await updateFileConversion({
          id: record.id,
          item: {
            status: 'failed',
            errorMessage: '[FILE_SIZE_EXCEEDED] Source file size exceeds the limit.',
            updater: req.context.userId!
          }
        })

        return res.status(400).send({
          error: `File size exceeds maximum allowed size of ${maxFileSizeBytes()} bytes.`
        })
      }

      const updated = await updateFileConversion({
        id: record.id,
        item: {
          status: 'pending',
          uploadedAt: new Date(),
          fileSize: objectCheck.metadata.contentLength || record.fileSize,
          updater: req.context.userId!
        }
      })

      return res.status(200).send(await serializeFile(updated || record))
    }
  )

  app.get(
    '/api/v1/file-conversions',
    requireAuth,
    validateRequest({ query: listQuerySchema }),
    async (req, res) => {
      const page = req.query.page ? Number(req.query.page) : 1
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20
      const status = req.query.status as FileConversionStatus | undefined
      const result = await listFileConversions({
        creator: req.context.userId!,
        keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
        status,
        page,
        pageSize
      })

      return res.status(200).send({
        items: await Promise.all(result.items.map((item) => serializeFile(item))),
        total: result.total,
        page,
        pageSize
      })
    }
  )

  app.get('/api/v1/file-conversions/pending', requireServiceToken, async (_req, res) => {
    const records = await listPendingFileConversions()
    return res.status(200).send({
      items: await Promise.all(records.map((record) => serializeFile(record, 'internal')))
    })
  })

  app.get(
    '/api/v1/file-conversions/:id/params',
    requireServiceToken,
    validateRequest({ params: idParamsSchema }),
    async (req, res) => {
      const record = await getFileConversionById({ id: req.params.id })
      if (!record) {
        return res.status(404).send({ error: 'File conversion record not found.' })
      }

      const sourceFileUrl = await getDownloadUrl({
        objectKey: record.sourceObjectKey,
        target: 'internal'
      })

      return res.status(200).send({
        id: record.id,
        sourceFileUrl,
        streamId: record.streamId,
        status: record.status
      })
    }
  )

  app.post(
    '/api/v1/file-conversions/:id/start',
    requireServiceToken,
    validateRequest({ params: idParamsSchema, body: startSchema }),
    async (req, res) => {
      const record = await getFileConversionById({ id: req.params.id })
      if (!record) {
        return res.status(404).send({ error: 'File conversion record not found.' })
      }

      const latestEvent = await getLatestFileConversionEventByFileId({ fileId: record.id })
      if (
        latestEvent &&
        (latestEvent.status === 'queued' || latestEvent.status === 'processing') &&
        (record.status === 'queued' || record.status === 'processing')
      ) {
        return res.status(200).send({
          fileId: record.id,
          eventId: latestEvent.id,
          streamId: record.streamId,
          status: record.status
        })
      }

      if (record.status !== 'pending') {
        return res.status(409).send({
          error: `Current status ${record.status} does not allow starting conversion.`
        })
      }

      if (!record.sourceObjectKey) {
        return res.status(400).send({ error: 'Source object key is missing.' })
      }

      const objectCheck = await ensureObjectExists({
        objectKey: record.sourceObjectKey
      })
      if (!objectCheck.ok) {
        return res.status(400).send({ error: objectCheck.error })
      }

      const operator = req.body.operator || 'converter-service'
      const event = await createFileConversionEvent({
        fileId: record.id,
        streamId: record.streamId,
        status: 'queued',
        startedBy: operator,
        creator: operator
      })

      const updated = await updateFileConversion({
        id: record.id,
        item: {
          status: 'queued',
          startedAt: record.startedAt || new Date(),
          updater: operator
        }
      })

      return res.status(200).send({
        fileId: record.id,
        eventId: event.id,
        streamId: record.streamId,
        status: updated?.status || 'queued'
      })
    }
  )

  app.post(
    '/api/v1/file-conversions/:id/processing',
    requireServiceToken,
    validateRequest({ params: idParamsSchema, body: processingSchema }),
    async (req, res) => {
      const record = await getFileConversionById({ id: req.params.id })
      if (!record) {
        return res.status(404).send({ error: 'File conversion record not found.' })
      }

      const event = await getFileConversionEventById({ id: req.body.eventId })
      if (!event || event.fileId !== record.id) {
        return res.status(404).send({ error: 'Conversion event not found.' })
      }

      if (event.finishedAt) {
        return res.status(200).send({
          fileId: record.id,
          eventId: event.id,
          status: record.status
        })
      }

      if (event.status === 'processing' && record.status === 'processing') {
        return res.status(200).send({
          fileId: record.id,
          eventId: event.id,
          status: 'processing'
        })
      }

      if (!['queued', 'processing'].includes(event.status) || !['queued', 'processing'].includes(record.status)) {
        return res.status(409).send({
          error: `Current status ${record.status} does not allow switching to processing.`
        })
      }

      const operator = req.body.operator || 'converter-service'

      await Promise.all([
        updateFileConversionEvent({
          id: event.id,
          item: {
            status: 'processing',
            startedBy: operator,
            updater: operator
          }
        }),
        updateFileConversion({
          id: record.id,
          item: {
            status: 'processing',
            updater: operator
          }
        })
      ])

      return res.status(200).send({
        fileId: record.id,
        eventId: event.id,
        status: 'processing'
      })
    }
  )

  app.post(
    '/api/v1/file-conversions/:id/result-upload-url',
    requireServiceToken,
    validateRequest({ params: idParamsSchema, body: resultUploadUrlSchema }),
    async (req, res) => {
      const record = await getFileConversionById({ id: req.params.id })
      if (!record) {
        return res.status(404).send({ error: 'File conversion record not found.' })
      }

      if (!['queued', 'processing'].includes(record.status)) {
        return res.status(409).send({
          error: `Current status ${record.status} does not allow result upload.`
        })
      }

      const fileSize = req.body.fileSize ?? null
      if (fileSize && fileSize > maxFileSizeBytes()) {
        return res.status(400).send({
          error: `File size exceeds maximum allowed size of ${maxFileSizeBytes()} bytes.`
        })
      }

      const resultObjectKey = buildObjectKey({
        category: 'result',
        fileId: record.id,
        fileName: req.body.fileName
      })
      const uploadUrl = await getObjectUploadUrl({
        objectKey: resultObjectKey,
        target: 'internal'
      })
      const resultFileUrl = await getDownloadUrl({
        objectKey: resultObjectKey,
        target: 'internal'
      })

      await updateFileConversion({
        id: record.id,
        item: {
          resultObjectKey,
          resultFileUrl,
          updater: 'converter-service'
        }
      })

      return res.status(200).send({
        fileId: record.id,
        uploadUrl,
        resultObjectKey,
        resultFileUrl
      })
    }
  )

  app.post(
    '/api/v1/file-conversions/:id/callback',
    requireServiceToken,
    validateRequest({ params: idParamsSchema, body: callbackSchema }),
    async (req, res) => {
      const record = await getFileConversionById({ id: req.params.id })
      if (!record) {
        return res.status(404).send({ error: 'File conversion record not found.' })
      }

      const event = await getFileConversionEventById({ id: req.body.eventId })
      if (!event || event.fileId !== record.id) {
        return res.status(404).send({ error: 'Conversion event not found.' })
      }

      if (event.finishedAt) {
        return res.status(200).send({
          fileId: record.id,
          eventId: event.id,
          status: record.status
        })
      }

      if (req.body.status === 'success') {
        const resultObjectKey = req.body.resultObjectKey || record.resultObjectKey
        if (!resultObjectKey) {
          return res.status(400).send({ error: 'Result object key is missing.' })
        }

        const objectCheck = await ensureObjectExists({
          objectKey: resultObjectKey
        })
        if (!objectCheck.ok) {
          return res.status(400).send({ error: objectCheck.error })
        }

        await Promise.all([
          updateFileConversionEvent({
            id: event.id,
            item: {
              status: 'success',
              finishedAt: new Date(),
              callbackPayload: req.body as Record<string, unknown>,
              errorMessage: null,
              updater: 'converter-service'
            }
          }),
          updateFileConversion({
            id: record.id,
            item: {
              status: 'success',
              isConverted: true,
              convertedAt: new Date(),
              resultObjectKey,
              resultFileUrl: record.resultFileUrl,
              errorMessage: null,
              updater: 'converter-service'
            }
          })
        ])

        return res.status(200).send({
          fileId: record.id,
          eventId: event.id,
          status: 'success'
        })
      }

      await Promise.all([
        updateFileConversionEvent({
          id: event.id,
          item: {
            status: 'failed',
            finishedAt: new Date(),
            callbackPayload: req.body as Record<string, unknown>,
            errorMessage: req.body.message || 'Conversion failed.',
            updater: 'converter-service'
          }
        }),
        updateFileConversion({
          id: record.id,
          item: {
            status: 'failed',
            isConverted: false,
            errorMessage: req.body.message || 'Conversion failed.',
            updater: 'converter-service'
          }
        })
      ])

      return res.status(200).send({
        fileId: record.id,
        eventId: event.id,
        status: 'failed'
      })
    }
  )

  return app
}
