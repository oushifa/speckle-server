import { Router, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { ensureError } from '@speckle/shared'
import { db } from '@/db/knex'
import { buildAuthPolicies } from '@/modules'
import { MODEL_LIBRARY_PROJECT_ID } from '@/modules/core/constants/modelLibrary'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { ensureModelLibraryProjectAccessFactory } from '@/modules/core/services/streams/modelLibrary'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import { BadRequestError, UnauthorizedError } from '@/modules/shared/errors'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  createProjectModelSyncTaskFactory,
  getActiveProjectModelSyncTaskFactory,
  getProjectModelSyncTaskFactory,
  listActiveProjectModelSyncTasksFactory,
  listLatestProjectModelSyncTasksByModelIdsFactory,
  listProjectModelSyncTasksFactory,
  listResumableProjectModelSyncTasksFactory,
  updateProjectModelSyncTaskFactory,
  type ProjectModelSyncTaskRecord
} from '@/modules/model-sync/repositories/tasks'
import {
  emitModelSyncTaskUpdated,
  onModelSyncModelUpdated,
  onModelSyncTaskUpdated
} from '@/modules/model-sync/services/events'
import {
  getRetryStatusForEntryPoint,
  resolveRetryEntryPoint
} from '@/modules/model-sync/services/retry'
import {
  getLatestModelFileUploadFactory,
  prepareModelSyncMultipartUploadFactory,
  getModelSyncPartUploadUrlFactory,
  listModelSyncUploadedPartsFactory,
  abortModelSyncMultipartUploadFactory,
  completeModelSyncMultipartUploadFactory
} from '@/modules/model-sync/services/speckleUploads'
import { runModelSyncTaskFactory } from '@/modules/model-sync/services/taskRunner'

const routeBase = '/api/v1/projects/:projectId/models/:modelId/model-sync/tasks'
const projectRouteBase = '/api/v1/projects/:projectId/model-sync/tasks'
const globalRouteBase = '/api/v1/model-sync/tasks'

const modelSyncErrHandler = (
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
  if (projectId === MODEL_LIBRARY_PROJECT_ID) {
    requireAuthenticatedUser(req)
    await ensureModelLibraryProjectAccessFactory({ db })({
      userId: req.context.userId as string
    })
    return
  }

  const authz = await buildAuthPolicies({ authContext: req.context })
  throwIfAuthNotOk(
    await authz.project.canRead({
      userId: req.context.userId,
      projectId
    })
  )
}

const requireVersionCreate = async (req: Request, projectId: string) => {
  if (projectId === MODEL_LIBRARY_PROJECT_ID) {
    requireAuthenticatedUser(req)
    await ensureModelLibraryProjectAccessFactory({ db })({
      userId: req.context.userId as string
    })
    return
  }

  const authz = await buildAuthPolicies({ authContext: req.context })
  throwIfAuthNotOk(
    await authz.project.version.canCreate({
      userId: req.context.userId,
      projectId
    })
  )
}

const requireAuthenticatedUser = (req: Request) => {
  if (!req.context.userId) {
    throw new UnauthorizedError('User not authenticated.')
  }
}

const serializeTask = (task: ProjectModelSyncTaskRecord) => ({
  id: task.id,
  projectId: task.projectId,
  modelId: task.modelId,
  fileId: task.fileId,
  fileUploadId: task.fileUploadId,
  versionId: task.versionId,
  fileName: task.fileName,
  fileType: task.fileType,
  fileSize: task.fileSize === null ? null : Number(task.fileSize),
  status: task.status,
  progressPercent:
    task.progressPercent === null ? null : Number(task.progressPercent || 0),
  progressPhase: task.progressPhase,
  progressMessage: task.progressMessage,
  seedId: task.seedId,
  assetId: task.assetId,
  assetName: task.assetName,
  transformTaskId: task.transformTaskId,
  error: task.error,
  errorCode: task.errorCode,
  retriable: task.retriable,
  retryCount: task.retryCount,
  creator: task.creator,
  updater: task.updater,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString()
})

const parseModelIds = (queryValue: unknown) =>
  typeof queryValue !== 'string'
    ? []
    : queryValue
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

const parseVisibleTaskTargets = (queryValue: unknown) => {
  if (typeof queryValue !== 'string') return []

  try {
    const parsed = JSON.parse(queryValue) as Array<{
      projectId?: unknown
      modelIds?: unknown
    }>

    if (!Array.isArray(parsed)) return []

    return parsed
      .map((target) => ({
        projectId: (typeof target?.projectId === 'string' ? target.projectId : '').trim(),
        modelIds: Array.isArray(target?.modelIds)
          ? target.modelIds
              .map((modelId) => (typeof modelId === 'string' ? modelId.trim() : ''))
              .filter(Boolean)
          : []
      }))
      .filter((target) => target.projectId && target.modelIds.length)
  } catch {
    return []
  }
}

const runTaskInBackground = (params: {
  projectId: string
  modelId: string
  taskId: string
  userId: string
}) => {
  void runModelSyncTaskFactory()(params)
}

export const modelSyncRouterFactory = () => {
  const router = Router()

  router.options(routeBase, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(projectRouteBase, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(
    `${globalRouteBase}/events`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${projectRouteBase}/snapshot`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${projectRouteBase}/events`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(`${routeBase}/:taskId`, cors(), allowCrossOriginResourceAccessMiddelware())
  router.options(
    `${routeBase}/:taskId/complete-upload`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${routeBase}/:taskId/events`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${routeBase}/:taskId/retry`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${routeBase}/:taskId/part-upload-url`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${routeBase}/:taskId/parts`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${routeBase}/:taskId/abort-upload`,
    cors(),
    allowCrossOriginResourceAccessMiddelware()
  )

  router.get(
    `${globalRouteBase}/events`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        requireAuthenticatedUser(req)

        const targets = parseVisibleTaskTargets(req.query.targets)
        if (!targets.length) {
          throw new BadRequestError('targets is required')
        }

        const targetsByProjectId = new Map<string, Set<string>>()
        for (const target of targets) {
          const existingModelIds = targetsByProjectId.get(target.projectId) || new Set<string>()
          target.modelIds.forEach((modelId) => existingModelIds.add(modelId))
          targetsByProjectId.set(target.projectId, existingModelIds)
        }

        const normalizedTargets = [...targetsByProjectId.entries()].map(
          ([projectId, modelIds]) => ({
            projectId,
            modelIds: [...modelIds]
          })
        )

        await Promise.all(
          normalizedTargets.map(({ projectId }) => requireProjectRead(req, projectId))
        )

        const snapshots = await Promise.all(
          normalizedTargets.map(async ({ projectId, modelIds }) => {
            const projectDb = await getProjectDbClient({ projectId })
            const tasks = await listLatestProjectModelSyncTasksByModelIdsFactory({
              db: projectDb
            })({
              projectId,
              modelIds
            })

            return {
              projectId,
              modelIds,
              tasks
            }
          })
        )

        res.status(200)
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache, no-transform')
        res.setHeader('Connection', 'keep-alive')

        const writeEvent = (eventName: string, data: unknown) => {
          res.write(`event: ${eventName}\n`)
          res.write(`data: ${JSON.stringify(data)}\n\n`)
        }

        snapshots.forEach(({ projectId, tasks }) => {
          writeEvent('snapshot', {
            projectId,
            tasks: tasks.map(serializeTask)
          })
        })

        const unsubscribeList = normalizedTargets.flatMap(({ projectId, modelIds }) =>
          modelIds.map((modelId) =>
            onModelSyncModelUpdated(projectId, modelId, (payload) => {
              writeEvent('update', serializeTask(payload))
            })
          )
        )

        const heartbeat = setInterval(() => {
          res.write(`: ping\n\n`)
        }, 15000)

        req.on('close', () => {
          clearInterval(heartbeat)
          unsubscribeList.forEach((unsubscribe) => unsubscribe())
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${projectRouteBase}/snapshot`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        await requireProjectRead(req, projectId)

        const modelIds = parseModelIds(req.query.modelIds)
        if (!modelIds.length) {
          return res.json({ data: [] })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const tasks = await listLatestProjectModelSyncTasksByModelIdsFactory({
          db: projectDb
        })({
          projectId,
          modelIds
        })

        res.json({ data: tasks.map(serializeTask) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    projectRouteBase,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        requireAuthenticatedUser(req)

        const status = typeof req.query.status === 'string' ? req.query.status : 'active'
        const projectDb = await getProjectDbClient({ projectId })

        const tasks =
          status === 'resumable'
            ? await listResumableProjectModelSyncTasksFactory({ db: projectDb })({
                projectId
              })
            : status === 'active'
            ? await listActiveProjectModelSyncTasksFactory({ db: projectDb })({
                projectId
              })
            : []

        res.json({ data: tasks.map(serializeTask) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    routeBase,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        await requireProjectRead(req, projectId)

        const projectDb = await getProjectDbClient({ projectId })
        const tasks = await listProjectModelSyncTasksFactory({ db: projectDb })({
          projectId,
          modelId
        })

        res.json({ data: tasks.map(serializeTask) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${routeBase}/:taskId`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        const taskId = req.params.taskId
        await requireProjectRead(req, projectId)

        const projectDb = await getProjectDbClient({ projectId })
        const task = await getProjectModelSyncTaskFactory({ db: projectDb })({
          projectId,
          modelId,
          taskId
        })
        if (!task) {
          return res.status(404).json({ error: 'Task not found' })
        }

        res.json({ data: serializeTask(task) })
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
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        const userId = req.context.userId
        await requireVersionCreate(req, projectId)

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const getActiveTask = getActiveProjectModelSyncTaskFactory({ db: projectDb })
        const existingTask = await getActiveTask({ projectId, modelId })
        if (existingTask) {
          return res.status(202).json({ data: serializeTask(existingTask) })
        }

        const mode = req.body?.mode === 'upload' ? 'upload' : 'latest_upload'
        const createTask = createProjectModelSyncTaskFactory({ db: projectDb })

        if (mode === 'upload') {
          const fileName =
            typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : ''
          if (!fileName) {
            throw new BadRequestError('fileName is required')
          }

          const prepared = await prepareModelSyncMultipartUploadFactory()({
            projectId,
            userId,
            fileName
          })
          const task = await createTask({
            projectId,
            modelId,
            fileId: prepared.fileId,
            fileName,
            fileSize: null,
            status: 'waiting_upload',
            creator: userId,
            updater: userId
          })
          emitModelSyncTaskUpdated(task)

          return res.status(201).json({
            data: serializeTask(task),
            upload: {
              fileId: prepared.fileId,
              uploadId: prepared.uploadId
            }
          })
        }

        const latestUpload = await getLatestModelFileUploadFactory({ db: projectDb })({
          projectId,
          modelId
        })
        if (!latestUpload?.id || !latestUpload.fileName) {
          throw new BadRequestError('未找到最近一次模型上传记录')
        }
        if (!latestUpload.uploadComplete) {
          throw new BadRequestError('最近一次模型上传尚未完成')
        }

        const task = await createTask({
          projectId,
          modelId,
          fileId: latestUpload.id,
          fileUploadId: latestUpload.id,
          versionId: latestUpload.convertedCommitId || null,
          fileName: latestUpload.fileName,
          fileType: latestUpload.fileType,
          fileSize: latestUpload.fileSize || null,
          status: 'speckle_converting',
          creator: userId,
          updater: userId
        })
        emitModelSyncTaskUpdated(task)
        runTaskInBackground({
          projectId,
          modelId,
          taskId: task.id,
          userId
        })

        return res.status(201).json({ data: serializeTask(task) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    `${routeBase}/:taskId/complete-upload`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        const taskId = req.params.taskId
        const userId = req.context.userId
        await requireVersionCreate(req, projectId)

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated.' })
        }

        const uploadId = typeof req.body?.uploadId === 'string' ? req.body.uploadId.trim() : ''
        const parts = Array.isArray(req.body?.parts) ? req.body.parts : []
        if (!uploadId) {
          throw new BadRequestError('uploadId is required')
        }
        if (!parts.length) {
          throw new BadRequestError('parts is required')
        }

        const projectDb = await getProjectDbClient({ projectId })
        const getTask = getProjectModelSyncTaskFactory({ db: projectDb })
        const updateTask = updateProjectModelSyncTaskFactory({ db: projectDb })

        const task = await getTask({ projectId, modelId, taskId })
        if (!task) {
          return res.status(404).json({ error: 'Task not found' })
        }
        if (task.status !== 'waiting_upload' || !task.fileId) {
          throw new BadRequestError('当前任务不处于待上传状态')
        }

        const upload = await completeModelSyncMultipartUploadFactory()({
          projectId,
          modelId,
          userId,
          fileId: task.fileId,
          uploadId,
          parts: parts.map((part: { partNumber?: unknown; etag?: unknown }) => ({
            partNumber:
              typeof part.partNumber === 'number' ? part.partNumber : Number(part.partNumber),
            etag: typeof part.etag === 'string' ? part.etag : String(part.etag || '')
          }))
        })

        const updatedTask = await updateTask({
          projectId,
          modelId,
          taskId,
          patch: {
            fileUploadId: upload.id,
            fileType: upload.fileType,
            fileSize: upload.fileSize || null,
            status: 'speckle_converting',
            error: null,
            errorCode: null,
            retriable: false,
            updater: userId
          }
        })
        if (!updatedTask) {
          return res.status(404).json({ error: 'Task not found' })
        }

        emitModelSyncTaskUpdated(updatedTask)
        runTaskInBackground({
          projectId,
          modelId,
          taskId,
          userId
        })

        res.json({ data: serializeTask(updatedTask) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    `${routeBase}/:taskId/part-upload-url`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        const taskId = req.params.taskId
        const userId = req.context.userId
        await requireVersionCreate(req, projectId)

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated.' })
        }

        const partNumber = Number(req.body?.partNumber)
        if (!Number.isInteger(partNumber) || partNumber < 1) {
          throw new BadRequestError('partNumber is required and must be a positive integer')
        }
        const uploadId =
          typeof req.body?.uploadId === 'string' ? req.body.uploadId.trim() : ''
        if (!uploadId) {
          throw new BadRequestError('uploadId is required')
        }

        const projectDb = await getProjectDbClient({ projectId })
        const getTask = getProjectModelSyncTaskFactory({ db: projectDb })
        const task = await getTask({ projectId, modelId, taskId })
        if (!task) {
          return res.status(404).json({ error: 'Task not found' })
        }
        if (task.status !== 'waiting_upload' || !task.fileId) {
          throw new BadRequestError('当前任务不处于待上传状态')
        }

        const url = await getModelSyncPartUploadUrlFactory()({
          projectId,
          fileId: task.fileId,
          uploadId,
          partNumber,
          req
        })

        res.json({ data: { url, partNumber } })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${routeBase}/:taskId/parts`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        const taskId = req.params.taskId
        await requireProjectRead(req, projectId)

        const uploadId =
          typeof req.query.uploadId === 'string' ? req.query.uploadId.trim() : ''
        if (!uploadId) {
          throw new BadRequestError('uploadId is required')
        }

        const projectDb = await getProjectDbClient({ projectId })
        const getTask = getProjectModelSyncTaskFactory({ db: projectDb })
        const task = await getTask({ projectId, modelId, taskId })
        if (!task) {
          return res.status(404).json({ error: 'Task not found' })
        }
        if (!task.fileId) {
          throw new BadRequestError('任务缺少 fileId')
        }

        const parts = await listModelSyncUploadedPartsFactory()({
          projectId,
          fileId: task.fileId,
          uploadId
        })

        res.json({ data: { parts } })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    `${routeBase}/:taskId/abort-upload`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        const taskId = req.params.taskId
        const userId = req.context.userId
        await requireVersionCreate(req, projectId)

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated.' })
        }

        const uploadId =
          typeof req.body?.uploadId === 'string' ? req.body.uploadId.trim() : ''
        if (!uploadId) {
          throw new BadRequestError('uploadId is required')
        }

        const projectDb = await getProjectDbClient({ projectId })
        const getTask = getProjectModelSyncTaskFactory({ db: projectDb })
        const task = await getTask({ projectId, modelId, taskId })
        if (!task) {
          return res.status(404).json({ error: 'Task not found' })
        }
        if (!task.fileId) {
          throw new BadRequestError('任务缺少 fileId')
        }

        await abortModelSyncMultipartUploadFactory()({
          projectId,
          fileId: task.fileId,
          uploadId
        })

        res.json({ data: { ok: true } })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    `${routeBase}/:taskId/retry`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        const taskId = req.params.taskId
        const userId = req.context.userId
        await requireVersionCreate(req, projectId)

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const getTask = getProjectModelSyncTaskFactory({ db: projectDb })
        const getActiveTask = getActiveProjectModelSyncTaskFactory({ db: projectDb })
        const updateTask = updateProjectModelSyncTaskFactory({ db: projectDb })
        const [task, activeTask] = await Promise.all([
          getTask({ projectId, modelId, taskId }),
          getActiveTask({ projectId, modelId })
        ])

        if (!task) {
          return res.status(404).json({ error: 'Task not found' })
        }

        if (activeTask && activeTask.id !== task.id) {
          return res.status(409).json({ error: '已有运行中的模型同步任务' })
        }

        if (task.status !== 'failed') {
          throw new BadRequestError('当前任务不处于失败状态')
        }

        const retryEntryPoint = resolveRetryEntryPoint(task)
        if (!retryEntryPoint) {
          throw new BadRequestError('当前任务不支持重试')
        }

        const retryStatus = getRetryStatusForEntryPoint(retryEntryPoint)
        const retriedTask = await updateTask({
          projectId,
          modelId,
          taskId,
          patch: {
            status: retryStatus,
            error: null,
            errorCode: null,
            retriable: false,
            retryCount: 0,
            progressPercent: retryStatus === 'speckle_converting' ? 0 : null,
            progressPhase: null,
            progressMessage:
              retryStatus === 'triggering_model_transform'
                ? '准备重新发起模型转换'
                : retryStatus === 'syncing_dtp_model'
                ? '准备重新同步 DTP 模型'
                : '准备重新等待 Speckle 转换',
            updater: userId
          }
        })
        if (!retriedTask) {
          return res.status(404).json({ error: 'Task not found' })
        }

        emitModelSyncTaskUpdated(retriedTask)
        runTaskInBackground({
          projectId,
          modelId,
          taskId,
          userId
        })

        res.json({ data: serializeTask(retriedTask) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${projectRouteBase}/events`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        await requireProjectRead(req, projectId)

        const modelIds = parseModelIds(req.query.modelIds)
        if (!modelIds.length) {
          throw new BadRequestError('modelIds is required')
        }

        const uniqueModelIds = Array.from(new Set(modelIds))
        const projectDb = await getProjectDbClient({ projectId })
        const tasks = await listLatestProjectModelSyncTasksByModelIdsFactory({
          db: projectDb
        })({
          projectId,
          modelIds: uniqueModelIds
        })

        res.status(200)
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache, no-transform')
        res.setHeader('Connection', 'keep-alive')

        const writeEvent = (eventName: string, data: unknown) => {
          res.write(`event: ${eventName}\n`)
          res.write(`data: ${JSON.stringify(data)}\n\n`)
        }

        writeEvent('snapshot', {
          projectId,
          tasks: tasks.map(serializeTask)
        })

        const unsubscribeList = uniqueModelIds.map((currentModelId) =>
          onModelSyncModelUpdated(projectId, currentModelId, (payload) => {
            writeEvent('update', serializeTask(payload))
          })
        )

        const heartbeat = setInterval(() => {
          res.write(`: ping\n\n`)
        }, 15000)

        req.on('close', () => {
          clearInterval(heartbeat)
          unsubscribeList.forEach((unsubscribe) => unsubscribe())
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${routeBase}/:taskId/events`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        const taskId = req.params.taskId
        await requireProjectRead(req, projectId)

        const projectDb = await getProjectDbClient({ projectId })
        const task = await getProjectModelSyncTaskFactory({ db: projectDb })({
          projectId,
          modelId,
          taskId
        })
        if (!task) {
          return res.status(404).json({ error: 'Task not found' })
        }

        res.status(200)
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache, no-transform')
        res.setHeader('Connection', 'keep-alive')

        const writeEvent = (eventName: string, data: unknown) => {
          res.write(`event: ${eventName}\n`)
          res.write(`data: ${JSON.stringify(data)}\n\n`)
        }

        writeEvent('snapshot', serializeTask(task))

        const unsubscribe = onModelSyncTaskUpdated(projectId, modelId, taskId, (payload) => {
          writeEvent('update', serializeTask(payload))
        })

        const heartbeat = setInterval(() => {
          res.write(`: ping\n\n`)
        }, 15000)

        req.on('close', () => {
          clearInterval(heartbeat)
          unsubscribe()
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.use(globalRouteBase, modelSyncErrHandler)
  router.use(projectRouteBase, modelSyncErrHandler)
  router.use(routeBase, modelSyncErrHandler)
  return router
}
