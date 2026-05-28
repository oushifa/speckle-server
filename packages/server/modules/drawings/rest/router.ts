import { Router, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import cryptoRandomString from 'crypto-random-string'
import { TIME, ensureError } from '@speckle/shared'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { getFileUploadUrlExpiryMinutes } from '@/modules/shared/helpers/envHelper'
import {
  createProjectDrawingFactory,
  deleteProjectDrawingFactory,
  getProjectDrawingFactory,
  listProjectDrawingsFactory
} from '@/modules/drawings/repositories/drawings'
import { upsertBlobFactory } from '@/modules/blobstorage/repositories'
import { getSignedDownloadUrlFactory, getSignedUrlFactory } from '@/modules/blobstorage/clients/objectStorage'
import { generatePresignedUrlFactory } from '@/modules/blobstorage/services/presigned'
import { getBlobMetadataFactory, deleteBlobFactory } from '@/modules/blobstorage/repositories'
import { fullyDeleteBlobFactory } from '@/modules/blobstorage/services/management'
import { deleteObjectFactory } from '@/modules/blobstorage/repositories/blobs'
import {
  createDrawingAnnotationFactory,
  deleteDrawingAnnotationFactory,
  listDrawingAnnotationsFactory,
  updateDrawingAnnotationFactory
} from '@/modules/drawings/repositories/annotations'

const routeBase = '/api/v1/projects/:projectId/drawings'

const drawingsErrHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!err) return next()
  const error = ensureError(err)
  const status = resolveStatusCode(error)
  res.status(status).json({ error: error.message })
}

const serializeDrawing = (record: {
  id: string
  projectId: string
  folderId: string | null
  name: string
  blobId: string
  fileName: string
  fileType: string
  contentType: string
  fileSize: number | string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}) => ({
  id: record.id,
  projectId: record.projectId,
  folderId: record.folderId,
  name: record.name,
  blobId: record.blobId,
  fileName: record.fileName,
  fileType: record.fileType,
  contentType: record.contentType,
  fileSize: record.fileSize === null ? null : Number(record.fileSize),
  creator: record.creator,
  updater: record.updater,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
})

const serializeAnnotation = (record: {
  id: string
  projectId: string
  drawingId: string
  title: string
  description: string
  visible: boolean
  pointX: number
  pointY: number
  pointZ: number
  cameraPositionX: number
  cameraPositionY: number
  cameraPositionZ: number
  cameraTargetX: number
  cameraTargetY: number
  cameraTargetZ: number
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}) => ({
  id: record.id,
  projectId: record.projectId,
  drawingId: record.drawingId,
  title: record.title,
  description: record.description,
  visible: record.visible,
  point: { x: record.pointX, y: record.pointY, z: record.pointZ },
  camera: {
    position: {
      x: record.cameraPositionX,
      y: record.cameraPositionY,
      z: record.cameraPositionZ
    },
    target: {
      x: record.cameraTargetX,
      y: record.cameraTargetY,
      z: record.cameraTargetZ
    }
  },
  creator: record.creator,
  updater: record.updater,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
})

const encodeCursor = (record: { updatedAt: Date; id: string }) =>
  `${record.updatedAt.toISOString()}_${record.id}`

const decodeCursor = (cursor: string): { updatedAt: Date; id: string } | null => {
  const trimmed = cursor.trim()
  const idx = trimmed.lastIndexOf('_')
  if (idx === -1) return null
  const dateStr = trimmed.slice(0, idx)
  const id = trimmed.slice(idx + 1)
  const date = new Date(dateStr)
  if (!id || Number.isNaN(date.getTime())) return null
  return { updatedAt: date, id }
}

export const drawingsRouterFactory = (): Router => {
  const router = Router()

  router.options(routeBase, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(`${routeBase}/uploads/generate-url`, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(`${routeBase}/:drawingId`, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(`${routeBase}/:drawingId/download`, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(
    `${routeBase}/:drawingId/annotations`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${routeBase}/:drawingId/annotations/:annotationId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )

  router.get(
    routeBase,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        if (!req.context.userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : null
        const search = typeof req.query.search === 'string' ? req.query.search : null
        const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : null
        const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50
        const cursor = cursorRaw ? decodeCursor(cursorRaw) : null

        const projectDb = await getProjectDbClient({ projectId })
        const items = await listProjectDrawingsFactory({ db: projectDb })({
          projectId,
          folderId,
          search,
          cursor,
          limit
        })

        res.json({
          data: {
            items: items.map(serializeDrawing),
            cursor: items.length === limit ? encodeCursor(items[items.length - 1]) : null
          }
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    `${routeBase}/uploads/generate-url`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const userId = req.context.userId
        if (!userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const { fileName } = req.body as Record<string, unknown>
        if (!fileName || typeof fileName !== 'string') {
          return res.status(400).json({ error: 'fileName is required.' })
        }

        const [projectDb, projectStorage] = await Promise.all([
          getProjectDbClient({ projectId }),
          getProjectObjectStorage({ projectId })
        ])

        const generatePresignedUrl = generatePresignedUrlFactory({
          getSignedUrl: getSignedUrlFactory({ objectStorage: projectStorage.public }),
          upsertBlob: upsertBlobFactory({ db: projectDb })
        })

        const blobId = cryptoRandomString({ length: 10 })
        const uploadUrl = await generatePresignedUrl({
          projectId,
          blobId,
          userId,
          fileName,
          urlExpiryDurationSeconds: getFileUploadUrlExpiryMinutes() * TIME.minute
        })

        res.json({ data: { blobId, uploadUrl } })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    routeBase,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const userId = req.context.userId
        if (!userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const { blobId, fileName, contentType, folderId, name, size } = req.body as Record<
          string,
          unknown
        >

        if (!blobId || typeof blobId !== 'string') {
          return res.status(400).json({ error: 'blobId is required.' })
        }
        if (!fileName || typeof fileName !== 'string') {
          return res.status(400).json({ error: 'fileName is required.' })
        }
        if (!contentType || typeof contentType !== 'string') {
          return res.status(400).json({ error: 'contentType is required.' })
        }
        if (!name || typeof name !== 'string') {
          return res.status(400).json({ error: 'name is required.' })
        }

        const fileType = fileName.split('.').pop()?.toLowerCase()
        if (!fileType || fileType === fileName) {
          return res.status(400).json({ error: 'fileName must have a valid extension.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const record = await createProjectDrawingFactory({ db: projectDb })({
          projectId,
          folderId: typeof folderId === 'string' && folderId.trim() ? folderId.trim() : null,
          name: name.trim(),
          blobId,
          fileName,
          fileType,
          contentType,
          fileSize: typeof size === 'number' ? size : typeof size === 'string' ? Number(size) : null,
          creator: userId,
          updater: userId
        })

        res.status(201).json({ data: serializeDrawing(record) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${routeBase}/:drawingId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        if (!req.context.userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const drawingId = req.params.drawingId
        const projectDb = await getProjectDbClient({ projectId })
        const record = await getProjectDrawingFactory({ db: projectDb })({ projectId, drawingId })
        if (!record) return res.status(404).json({ error: 'Drawing not found' })

        res.json({ data: serializeDrawing(record) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${routeBase}/:drawingId/download`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        if (!req.context.userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const drawingId = req.params.drawingId
        const [projectDb, projectStorage] = await Promise.all([
          getProjectDbClient({ projectId }),
          getProjectObjectStorage({ projectId })
        ])

        const record = await getProjectDrawingFactory({ db: projectDb })({ projectId, drawingId })
        if (!record) return res.status(404).json({ error: 'Drawing not found' })

        const blobMeta = await getBlobMetadataFactory({ db: projectDb })({
          streamId: projectId,
          blobId: record.blobId
        })

        const getSignedDownloadUrl = getSignedDownloadUrlFactory({
          objectStorage: projectStorage.public
        })
        const url = await getSignedDownloadUrl({
          objectKey: blobMeta.objectKey!,
          urlExpiryDurationSeconds: 10 * TIME.minute
        })

        res.json({ data: { url } })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${routeBase}/:drawingId/annotations`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const userId = req.context.userId
        if (!userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const drawingId = req.params.drawingId

        const projectDb = await getProjectDbClient({ projectId })
        const drawing = await getProjectDrawingFactory({ db: projectDb })({ projectId, drawingId })
        if (!drawing) return res.status(404).json({ error: 'Drawing not found' })

        const items = await listDrawingAnnotationsFactory({ db: projectDb })({ projectId, drawingId })
        res.json({ data: { items: items.map(serializeAnnotation) } })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    `${routeBase}/:drawingId/annotations`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const userId = req.context.userId
        if (!userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const drawingId = req.params.drawingId

        const { title, description, visible, point, camera } = req.body as Record<string, unknown>

        if (!title || typeof title !== 'string') {
          return res.status(400).json({ error: 'title is required.' })
        }

        const pointObj = (point || {}) as Record<string, unknown>
        const cameraObj = (camera || {}) as Record<string, unknown>
        const camPos = (cameraObj.position || {}) as Record<string, unknown>
        const camTarget = (cameraObj.target || {}) as Record<string, unknown>

        const px = typeof pointObj.x === 'number' ? pointObj.x : null
        const py = typeof pointObj.y === 'number' ? pointObj.y : null
        const pz = typeof pointObj.z === 'number' ? pointObj.z : null

        const cpx = typeof camPos.x === 'number' ? camPos.x : null
        const cpy = typeof camPos.y === 'number' ? camPos.y : null
        const cpz = typeof camPos.z === 'number' ? camPos.z : null

        const ctx = typeof camTarget.x === 'number' ? camTarget.x : null
        const cty = typeof camTarget.y === 'number' ? camTarget.y : null
        const ctz = typeof camTarget.z === 'number' ? camTarget.z : null

        if (
          px === null ||
          py === null ||
          pz === null ||
          cpx === null ||
          cpy === null ||
          cpz === null ||
          ctx === null ||
          cty === null ||
          ctz === null
        ) {
          return res.status(400).json({ error: 'point and camera are required.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const drawing = await getProjectDrawingFactory({ db: projectDb })({ projectId, drawingId })
        if (!drawing) return res.status(404).json({ error: 'Drawing not found' })

        const record = await createDrawingAnnotationFactory({ db: projectDb })({
          projectId,
          drawingId,
          title: title.trim(),
          description: typeof description === 'string' ? description : '',
          visible: typeof visible === 'boolean' ? visible : true,
          pointX: px,
          pointY: py,
          pointZ: pz,
          cameraPositionX: cpx,
          cameraPositionY: cpy,
          cameraPositionZ: cpz,
          cameraTargetX: ctx,
          cameraTargetY: cty,
          cameraTargetZ: ctz,
          creator: userId,
          updater: userId
        })

        res.status(201).json({ data: serializeAnnotation(record) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.patch(
    `${routeBase}/:drawingId/annotations/:annotationId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const userId = req.context.userId
        if (!userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const drawingId = req.params.drawingId
        const annotationId = req.params.annotationId

        const { title, description, visible } = req.body as Record<string, unknown>

        const projectDb = await getProjectDbClient({ projectId })
        const drawing = await getProjectDrawingFactory({ db: projectDb })({ projectId, drawingId })
        if (!drawing) return res.status(404).json({ error: 'Drawing not found' })

        const record = await updateDrawingAnnotationFactory({ db: projectDb })({
          projectId,
          drawingId,
          annotationId,
          updater: userId,
          title: typeof title === 'string' ? title.trim() : undefined,
          description: typeof description === 'string' ? description : undefined,
          visible: typeof visible === 'boolean' ? visible : undefined
        })
        if (!record) return res.status(404).json({ error: 'Annotation not found' })

        res.json({ data: serializeAnnotation(record) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.delete(
    `${routeBase}/:drawingId/annotations/:annotationId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const userId = req.context.userId
        if (!userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const drawingId = req.params.drawingId
        const annotationId = req.params.annotationId

        const projectDb = await getProjectDbClient({ projectId })
        const drawing = await getProjectDrawingFactory({ db: projectDb })({ projectId, drawingId })
        if (!drawing) return res.status(404).json({ error: 'Drawing not found' })

        const ok = await deleteDrawingAnnotationFactory({ db: projectDb })({
          projectId,
          drawingId,
          annotationId
        })
        if (!ok) return res.status(404).json({ error: 'Annotation not found' })

        res.status(204).end()
      } catch (err) {
        next(err)
      }
    }
  )

  router.delete(
    `${routeBase}/:drawingId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        if (!req.context.userId) return res.status(401).json({ error: 'User not authenticated.' })

        const projectId = req.params.projectId
        const drawingId = req.params.drawingId

        const [projectDb, projectStorage] = await Promise.all([
          getProjectDbClient({ projectId }),
          getProjectObjectStorage({ projectId })
        ])

        const record = await getProjectDrawingFactory({ db: projectDb })({ projectId, drawingId })
        if (!record) return res.status(404).json({ error: 'Drawing not found' })

        const deleteBlob = fullyDeleteBlobFactory({
          getBlobMetadata: getBlobMetadataFactory({ db: projectDb }),
          deleteBlob: deleteBlobFactory({ db: projectDb }),
          deleteObject: deleteObjectFactory({ storage: projectStorage.public })
        })

        await deleteBlob({ streamId: projectId, blobId: record.blobId })
        await deleteProjectDrawingFactory({ db: projectDb })({ projectId, drawingId })

        res.status(204).end()
      } catch (err) {
        next(err)
      }
    }
  )

  router.use(drawingsErrHandler)

  return router
}
