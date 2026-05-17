import { Router, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { ensureError } from '@speckle/shared'
import { buildAuthPolicies } from '@/modules'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import {
  createAlignmentDrawingFactory,
  deleteAlignmentDrawingFactory,
  getAlignmentDrawingFactory,
  listAlignmentDrawingsFactory
} from '@/modules/alignment/repositories/drawings'
import {
  createAlignmentConfigFactory,
  deleteAlignmentConfigFactory,
  getAlignmentConfigFactory,
  listAlignmentConfigsFactory,
  updateAlignmentConfigFactory
} from '@/modules/alignment/repositories/configs'
import {
  deleteBlobFactory,
  getBlobMetadataFactory
} from '@/modules/blobstorage/repositories'
import { fullyDeleteBlobFactory } from '@/modules/blobstorage/services/management'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { deleteObjectFactory } from '@/modules/blobstorage/repositories/blobs'

const routeBase = '/api/v1/projects/:projectId/alignments'

const alignmentErrHandler = (
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

const requireProjectRead = async (req: Request, projectId: string) => {
  const authz = await buildAuthPolicies({ authContext: req.context })
  throwIfAuthNotOk(
    await authz.project.canRead({
      userId: req.context.userId,
      projectId
    })
  )
}

const requireProjectUpdate = async (req: Request, projectId: string) => {
  const authz = await buildAuthPolicies({ authContext: req.context })
  throwIfAuthNotOk(
    await authz.project.canUpdate({
      userId: req.context.userId,
      projectId
    })
  )
}

const serializeDrawing = (record: {
  id: string
  projectId: string
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}) => ({
  id: record.id,
  projectId: record.projectId,
  blobId: record.blobId,
  fileName: record.fileName,
  fileType: record.fileType,
  fileSize: record.fileSize === null ? null : Number(record.fileSize),
  creator: record.creator,
  updater: record.updater,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
})

const serializeConfig = (record: {
  id: string
  projectId: string
  name: string
  description: string | null
  drawingId: string | null
  drawingName: string | null
  splitRatio: number | string
  calibrationPoints: unknown[] | null
  transform: Record<string, unknown> | null
  sectionBox: Record<string, unknown> | null
  cameraState: Record<string, unknown> | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
  drawingBlobId?: string | null
  drawingFileType?: string | null
  drawingFileSize?: number | string | null
  drawingExists?: boolean
}) => ({
  id: record.id,
  projectId: record.projectId,
  name: record.name,
  description: record.description,
  drawingId: record.drawingId,
  drawingName: record.drawingName,
  splitRatio: Number(record.splitRatio),
  calibrationPoints: record.calibrationPoints || [],
  transform: record.transform,
  sectionBox: record.sectionBox,
  cameraState: record.cameraState,
  creator: record.creator,
  updater: record.updater,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  drawing:
    record.drawingExists && record.drawingId
      ? {
          id: record.drawingId,
          fileName: record.drawingName,
          blobId: record.drawingBlobId || null,
          fileType: record.drawingFileType || null,
          fileSize:
            record.drawingFileSize === null || record.drawingFileSize === undefined
              ? null
              : Number(record.drawingFileSize)
        }
      : null,
  drawingDeleted: record.drawingId ? !record.drawingExists : false
})

const buildDrawingRoutes = (router: Router) => {
  const route = `${routeBase}/drawings`

  router.options(route, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(`${route}/:drawingId`, cors(), allowCrossOriginResourceAccessMiddelware())

  router.get(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        await requireProjectRead(req, projectId)

        const projectDb = await getProjectDbClient({ projectId })
        const drawings = await listAlignmentDrawingsFactory({ db: projectDb })({ projectId })

        res.json({ data: drawings.map(serializeDrawing) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const userId = req.context.userId
        await requireProjectUpdate(req, projectId)

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated.' })
        }

        const { blobId, fileName, fileType, fileSize } = req.body as Record<
          string,
          string | number | null | undefined
        >
        if (!blobId || !fileName || !fileType) {
          return res.status(400).json({ error: 'blobId, fileName and fileType are required.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const record = await createAlignmentDrawingFactory({ db: projectDb })({
          projectId,
          blobId: String(blobId),
          fileName: String(fileName),
          fileType: String(fileType),
          fileSize: fileSize === null || fileSize === undefined ? null : Number(fileSize),
          creator: userId,
          updater: userId
        })

        res.status(201).json({ data: serializeDrawing(record) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.delete(
    `${route}/:drawingId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const drawingId = req.params.drawingId
        await requireProjectUpdate(req, projectId)

        const [projectDb, projectStorage] = await Promise.all([
          getProjectDbClient({ projectId }),
          getProjectObjectStorage({ projectId })
        ])
        const drawing = await getAlignmentDrawingFactory({ db: projectDb })({
          projectId,
          drawingId
        })
        if (!drawing) {
          return res.status(404).json({ error: 'Drawing not found' })
        }

        const getBlobMetadata = getBlobMetadataFactory({ db: projectDb })
        const deleteBlob = fullyDeleteBlobFactory({
          getBlobMetadata,
          deleteBlob: deleteBlobFactory({ db: projectDb }),
          deleteObject: deleteObjectFactory({ storage: projectStorage.private })
        })

        await deleteBlob({
          streamId: projectId,
          blobId: drawing.blobId
        })
        await deleteAlignmentDrawingFactory({ db: projectDb })({
          projectId,
          drawingId
        })

        res.status(204).send()
      } catch (err) {
        next(err)
      }
    }
  )
}

const buildConfigRoutes = (router: Router) => {
  const route = `${routeBase}/configs`

  router.options(route, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(`${route}/:configId`, cors(), allowCrossOriginResourceAccessMiddelware())

  router.get(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        await requireProjectRead(req, projectId)

        const projectDb = await getProjectDbClient({ projectId })
        const configs = await listAlignmentConfigsFactory({ db: projectDb })({ projectId })

        res.json({ data: configs.map(serializeConfig) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${route}/:configId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const configId = req.params.configId
        await requireProjectRead(req, projectId)

        const projectDb = await getProjectDbClient({ projectId })
        const config = await getAlignmentConfigFactory({ db: projectDb })({
          projectId,
          configId
        })
        if (!config) {
          return res.status(404).json({ error: 'Alignment config not found' })
        }

        res.json({ data: serializeConfig(config) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const userId = req.context.userId
        await requireProjectUpdate(req, projectId)

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated.' })
        }

        const body = req.body as Record<string, unknown>
        if (!body.name) {
          return res.status(400).json({ error: 'name is required.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const created = await createAlignmentConfigFactory({ db: projectDb })({
          projectId,
          name: String(body.name),
          description: typeof body.description === 'string' ? body.description : null,
          drawingId: typeof body.drawingId === 'string' ? body.drawingId : null,
          drawingName: typeof body.drawingName === 'string' ? body.drawingName : null,
          splitRatio: typeof body.splitRatio === 'number' ? body.splitRatio : undefined,
          calibrationPoints: Array.isArray(body.calibrationPoints)
            ? (body.calibrationPoints as never)
            : null,
          transform:
            body.transform && typeof body.transform === 'object'
              ? (body.transform as never)
              : null,
          sectionBox:
            body.sectionBox && typeof body.sectionBox === 'object'
              ? (body.sectionBox as never)
              : null,
          cameraState:
            body.cameraState && typeof body.cameraState === 'object'
              ? (body.cameraState as never)
              : null,
          creator: userId,
          updater: userId
        })
        const fullRecord = await getAlignmentConfigFactory({ db: projectDb })({
          projectId,
          configId: created.id
        })

        res.status(201).json({ data: fullRecord ? serializeConfig(fullRecord) : null })
      } catch (err) {
        next(err)
      }
    }
  )

  router.put(
    `${route}/:configId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const configId = req.params.configId
        const userId = req.context.userId
        await requireProjectUpdate(req, projectId)

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated.' })
        }

        const body = req.body as Record<string, unknown>
        const projectDb = await getProjectDbClient({ projectId })
        const updated = await updateAlignmentConfigFactory({ db: projectDb })({
          projectId,
          configId,
          update: {
            ...(body.name !== undefined ? { name: String(body.name) } : {}),
            ...(body.description !== undefined
              ? {
                  description:
                    typeof body.description === 'string' ? body.description : null
                }
              : {}),
            ...(body.drawingId !== undefined
              ? {
                  drawingId: typeof body.drawingId === 'string' ? body.drawingId : null
                }
              : {}),
            ...(body.drawingName !== undefined
              ? {
                  drawingName:
                    typeof body.drawingName === 'string' ? body.drawingName : null
                }
              : {}),
            ...(body.splitRatio !== undefined && typeof body.splitRatio === 'number'
              ? { splitRatio: body.splitRatio }
              : {}),
            ...(body.calibrationPoints !== undefined
              ? {
                  calibrationPoints: Array.isArray(body.calibrationPoints)
                    ? (body.calibrationPoints as never)
                    : null
                }
              : {}),
            ...(body.transform !== undefined
              ? {
                  transform:
                    body.transform && typeof body.transform === 'object'
                      ? (body.transform as never)
                      : null
                }
              : {}),
            ...(body.sectionBox !== undefined
              ? {
                  sectionBox:
                    body.sectionBox && typeof body.sectionBox === 'object'
                      ? (body.sectionBox as never)
                      : null
                }
              : {}),
            ...(body.cameraState !== undefined
              ? {
                  cameraState:
                    body.cameraState && typeof body.cameraState === 'object'
                      ? (body.cameraState as never)
                      : null
                }
              : {}),
            updater: userId
          }
        })

        if (!updated) {
          return res.status(404).json({ error: 'Alignment config not found' })
        }

        const fullRecord = await getAlignmentConfigFactory({ db: projectDb })({
          projectId,
          configId
        })

        res.json({ data: fullRecord ? serializeConfig(fullRecord) : null })
      } catch (err) {
        next(err)
      }
    }
  )

  router.delete(
    `${route}/:configId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const configId = req.params.configId
        await requireProjectUpdate(req, projectId)

        const projectDb = await getProjectDbClient({ projectId })
        const deleted = await deleteAlignmentConfigFactory({ db: projectDb })({
          projectId,
          configId
        })

        if (!deleted) {
          return res.status(404).json({ error: 'Alignment config not found' })
        }

        res.status(204).send()
      } catch (err) {
        next(err)
      }
    }
  )
}

export const alignmentRouterFactory = (): Router => {
  const router = Router()

  buildDrawingRoutes(router)
  buildConfigRoutes(router)
  router.use(alignmentErrHandler)

  return router
}
