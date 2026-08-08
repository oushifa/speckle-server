import { Router, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { ensureError } from '@speckle/shared'
import { buildAuthPolicies } from '@/modules'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import { BadRequestError, UnauthorizedError } from '@/modules/shared/errors'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  createProjectModelSyncTaskFactory,
  getActiveProjectModelSyncTaskFactory,
  getProjectModelSyncTaskFactory,
  listActiveProjectModelSyncTasksFactory,
  listProjectModelSyncTasksFactory,
  listResumableProjectModelSyncTasksFactory,
  updateProjectModelSyncTaskFactory,
  type ProjectModelSyncTaskRecord
} from '@/modules/model-sync/repositories/tasks'
import {
  emitModelSyncTaskUpdated,
  onModelSyncTaskUpdated
} from '@/modules/model-sync/services/events'
import { MODEL_SYNC_AUTO_RETRY_LIMIT } from '@/modules/model-sync/services/errors'
import {
  getLatestModelFileUploadFactory,
  prepareModelSyncUploadFactory,
  startModelFileImportFactory
} from '@/modules/model-sync/services/speckleUploads'
import { runModelSyncTaskFactory } from '@/modules/model-sync/services/taskRunner'

const routeBase = '/api/v1/projects/:projectId/models/:modelId/model-sync/tasks'
const projectRouteBase = '/api/v1/projects/:projectId/model-sync/tasks'

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
        await requireProjectUpdate(req, projectId)

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

          const prepared = await prepareModelSyncUploadFactory()({
            projectId,
            userId,
            fileName,
            req
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
              uploadUrl: prepared.uploadUrl
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
        await requireProjectUpdate(req, projectId)

        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated.' })
        }

        const etag = typeof req.body?.etag === 'string' ? req.body.etag.trim() : ''
        if (!etag) {
          throw new BadRequestError('etag is required')
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

        const upload = await startModelFileImportFactory()({
          projectId,
          modelId,
          userId,
          fileId: task.fileId,
          etag
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
    `${routeBase}/:taskId/retry`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const modelId = req.params.modelId
        const taskId = req.params.taskId
        const userId = req.context.userId
        await requireProjectUpdate(req, projectId)

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

        if (!task.retriable) {
          throw new BadRequestError('当前任务不支持自动重试')
        }

        if (task.retryCount >= MODEL_SYNC_AUTO_RETRY_LIMIT) {
          throw new BadRequestError('当前任务已达到自动重试上限')
        }

        const retriedTask = await updateTask({
          projectId,
          modelId,
          taskId,
          patch: {
            status: 'speckle_converting',
            error: null,
            errorCode: null,
            retriable: false,
            retryCount: task.retryCount + 1,
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

  router.use(projectRouteBase, modelSyncErrHandler)
  router.use(routeBase, modelSyncErrHandler)
  return router
}
