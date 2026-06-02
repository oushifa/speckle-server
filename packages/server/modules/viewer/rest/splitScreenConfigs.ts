import { Router, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { BadRequestError } from '@/modules/shared/errors'
import type {
  SplitScreenConfigCameraState,
  SplitScreenDrawing
} from '@/modules/viewer/domain/types/splitScreenConfigs'
import {
  createSplitScreenConfigFactory,
  deleteSplitScreenConfigFactory,
  getSplitScreenConfigsByProjectFactory,
  updateSplitScreenConfigFactory
} from '@/modules/viewer/repositories/splitScreenConfigs'
import { ensureError } from '@speckle/shared'

const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (!err) return next()
  const error = ensureError(err)
  res.status(resolveStatusCode(error)).json({ error: error.message })
}

const normalizeDrawing = (value: unknown): SplitScreenDrawing => {
  if (!value || typeof value !== 'object') {
    throw new BadRequestError('图纸信息不能为空。')
  }

  const drawing = value as Record<string, unknown>
  const requiredStringFields = [
    'projectId',
    'modelId',
    'modelName',
    'versionId',
    'versionCreatedAt',
    'blobId',
    'fileName',
    'fileType'
  ] as const

  for (const field of requiredStringFields) {
    if (typeof drawing[field] !== 'string' || !drawing[field]?.trim()) {
      throw new BadRequestError(`图纸字段 ${field} 不合法。`)
    }
  }

  const fileSize =
    drawing.fileSize === null || drawing.fileSize === undefined
      ? null
      : Number(drawing.fileSize)

  if (fileSize !== null && Number.isNaN(fileSize)) {
    throw new BadRequestError('图纸字段 fileSize 不合法。')
  }

  return {
    projectId: drawing.projectId as string,
    modelId: drawing.modelId as string,
    modelName: drawing.modelName as string,
    versionId: drawing.versionId as string,
    versionCreatedAt: drawing.versionCreatedAt as string,
    blobId: drawing.blobId as string,
    fileName: drawing.fileName as string,
    fileType: drawing.fileType as string,
    fileSize
  }
}

const normalizeCameraState = (value: unknown): SplitScreenConfigCameraState | null => {
  if (value === null || value === undefined) return null
  if (!value || typeof value !== 'object') {
    throw new BadRequestError('相机状态格式不正确。')
  }

  const cameraState = value as Record<string, unknown>
  return {
    cad:
      cameraState.cad && typeof cameraState.cad === 'object'
        ? (cameraState.cad as Record<string, unknown>)
        : null,
    speckle:
      cameraState.speckle && typeof cameraState.speckle === 'object'
        ? (cameraState.speckle as Record<string, unknown>)
        : null
  }
}

const normalizeInput = (projectId: string, body: Record<string, unknown>) => {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw new BadRequestError('关联名称不能为空。')
  }

  const splitRatio = Number(body.splitRatio)
  if (Number.isNaN(splitRatio) || splitRatio <= 0 || splitRatio >= 1) {
    throw new BadRequestError('分屏比例不合法。')
  }

  if (body.calibrationPoints !== undefined && !Array.isArray(body.calibrationPoints)) {
    throw new BadRequestError('校准点数据格式不正确。')
  }

  if (
    body.transform !== undefined &&
    body.transform !== null &&
    typeof body.transform !== 'object'
  ) {
    throw new BadRequestError('坐标转换数据格式不正确。')
  }

  if (
    body.sectionBox !== undefined &&
    body.sectionBox !== null &&
    typeof body.sectionBox !== 'object'
  ) {
    throw new BadRequestError('剖切框数据格式不正确。')
  }

  return {
    name,
    description: typeof body.description === 'string' ? body.description.trim() || null : null,
    drawing: {
      ...normalizeDrawing(body.drawing),
      projectId
    },
    splitRatio,
    calibrationPoints: (body.calibrationPoints as unknown[] | undefined) || null,
    transform: (body.transform as Record<string, unknown> | null | undefined) || null,
    cameraState: normalizeCameraState(body.cameraState),
    sectionBox: (body.sectionBox as Record<string, unknown> | null | undefined) || null
  }
}

const buildRoute = (router: Router) => {
  const route = '/api/projects/:projectId/split-screen-configs'

  router.options(route, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(`${route}/:configId`, cors(), allowCrossOriginResourceAccessMiddelware())

  router.get(
    route,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId

        const projectDb = await getProjectDbClient({ projectId })
        const getSplitScreenConfigsByProject = getSplitScreenConfigsByProjectFactory({
          db: projectDb
        })

        res.json({ data: await getSplitScreenConfigsByProject(projectId) })
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
        if (!req.context.userId) throw new BadRequestError('Authentication required')

        const input = normalizeInput(projectId, req.body || {})

        const projectDb = await getProjectDbClient({ projectId })
        const createSplitScreenConfig = createSplitScreenConfigFactory({ db: projectDb })

        const created = await createSplitScreenConfig({
          projectId,
          userId: req.context.userId,
          input
        })

        res.status(201).json({ data: created })
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
        if (!req.context.userId) throw new BadRequestError('Authentication required')

        const input = normalizeInput(projectId, req.body || {})

        const projectDb = await getProjectDbClient({ projectId })
        const updateSplitScreenConfig = updateSplitScreenConfigFactory({ db: projectDb })
        const updated = await updateSplitScreenConfig({
          configId,
          projectId,
          userId: req.context.userId,
          input
        })

        if (!updated) {
          return res.status(404).json({ error: '分屏关联不存在。' })
        }

        res.json({ data: updated })
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
        if (!req.context.userId) throw new BadRequestError('Authentication required')

        const projectDb = await getProjectDbClient({ projectId })
        const deleteSplitScreenConfig = deleteSplitScreenConfigFactory({ db: projectDb })
        const deleted = await deleteSplitScreenConfig({ configId, projectId })

        if (!deleted) {
          return res.status(404).json({ error: '分屏关联不存在。' })
        }

        res.status(204).send()
      } catch (err) {
        next(err)
      }
    }
  )

  router.use(route, errorHandler)
}

export const getSplitScreenConfigsRouter = (): Router => {
  const router = Router()
  buildRoute(router)
  return router
}
