import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler
} from 'express'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  createProgressActualRecordFactory,
  deleteProgressActualRecordFactory,
  getProgressActualRecordFactory,
  listProgressActualRecordsFactory,
  type ProgressActualRecord,
  updateProgressActualRecordFactory
} from '@/modules/progress/repositories/progressActualRecords'
import {
  createProgressPlanFileFactory,
  getLatestProgressPlanFileFactory
} from '@/modules/progress/repositories/progressPlanFiles'
import {
  getProgressPlanTaskFactory,
  listProgressPlanTasksByIdsFactory,
  listProgressPlanTasksFactory,
  replaceProgressPlanTasksFactory,
  updateProgressPlanTaskBimFactory,
  type ProgressPlanTaskRecord
} from '@/modules/progress/repositories/progressPlanTasks'
import {
  countProgressElementSnapshotsFactory,
  listProgressElementSnapshotsFactory,
  type ProgressElementSnapshotRecord,
  type ProgressElementSnapshotStatus
} from '@/modules/progress/repositories/progressElementSnapshots'
import {
  countProgressTaskSnapshotsFactory,
  listProgressTaskSnapshotsFactory,
  type ProgressTaskSnapshotRecord,
  type ProgressTaskSnapshotStatus
} from '@/modules/progress/repositories/progressTaskSnapshots'
import { importProgressPlanTasksFromBlobFactory } from '@/modules/progress/services/mppTaskImport'
import { importProgressActualRecordsFromBlobFactory } from '@/modules/progress/services/actualRecordExcelImport'
import {
  rebuildAllProgressSnapshotsFactory,
  syncActualRecordDerivedDataFactory,
  syncPlanTaskDerivedDataFactory
} from '@/modules/progress/services/snapshotSync'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { db } from '@/db/knex'
import { getBlobMetadataFactory } from '@/modules/blobstorage/repositories'
import { getObjectStreamFactory } from '@/modules/blobstorage/repositories/blobs'
import { getFileStreamFactory } from '@/modules/blobstorage/services/management'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { Roles } from '@/modules/core/helpers/mainConstants'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import {
  streamReadPermissionsPipelineFactory,
  streamWritePermissionsPipelineFactory
} from '@/modules/shared/authz'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { ensureError } from '@speckle/shared'
import contentDisposition from 'content-disposition'

const paramsSchema = z.object({
  projectId: z.string().min(1)
})

const bodySchema = z.object({
  blobId: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().nullable().optional()
})

const actualRecordImportSchema = z.object({
  blobId: z.string().min(1),
  fileName: z.string().min(1)
})

const taskParamsSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1)
})

const actualRecordParamsSchema = z.object({
  projectId: z.string().min(1),
  recordId: z.string().min(1)
})

const elementSnapshotQuerySchema = z.object({
  modelId: z.string().min(1).optional(),
  progressStatus: z
    .enum([
      'not_started',
      'ready_not_started',
      'delayed_not_started',
      'in_progress',
      'in_progress_delayed',
      'finished_ahead',
      'finished_on_time',
      'finished_delayed'
    ])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
})

const taskSnapshotQuerySchema = z.object({
  taskStatus: z
    .enum([
      'no_bim_link',
      'not_started',
      'in_progress',
      'delayed',
      'finished_on_time',
      'finished_delayed'
    ])
    .optional(),
  keyword: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
})

const taskBimSchema = z.object({
  modelId: z.string().nullable().optional(),
  applicationIds: z.array(z.string()).optional(),
  modelIds: z.array(z.string()).optional(),
  selections: z
    .array(
      z.object({
        modelId: z.string().min(1),
        applicationIds: z.array(z.string())
      })
    )
    .optional()
})

const actualRecordBodySchema = z.object({
  taskName: z.string().trim().min(1),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startElementCodes: z.string().nullable().optional(),
  finishElementCodes: z.string().nullable().optional(),
  startModelIds: z.array(z.string()).optional(),
  startApplicationIds: z.array(z.string()).optional(),
  startSelections: z
    .array(
      z.object({
        modelId: z.string().min(1),
        applicationIds: z.array(z.string())
      })
    )
    .optional(),
  finishModelIds: z.array(z.string()).optional(),
  finishApplicationIds: z.array(z.string()).optional(),
  finishSelections: z
    .array(
      z.object({
        modelId: z.string().min(1),
        applicationIds: z.array(z.string())
      })
    )
    .optional(),
  modelId: z.string().nullable().optional(),
  modelIds: z.array(z.string()).optional(),
  applicationIds: z.array(z.string()).optional(),
  selections: z
    .array(
      z.object({
        modelId: z.string().min(1),
        applicationIds: z.array(z.string())
      })
    )
    .optional(),
  remark: z.string().nullable().optional(),
  highTemperature: z.string().nullable().optional(),
  lowTemperature: z.string().nullable().optional(),
  morningWeather: z.string().nullable().optional(),
  afternoonWeather: z.string().nullable().optional(),
  nightCondition: z.string().nullable().optional(),
  constructionRecord: z.string().nullable().optional(),
  qualityRecord: z.string().nullable().optional(),
  safetyRecord: z.string().nullable().optional(),
  mortarConcreteSampleRecord: z.string().nullable().optional(),
  materialEquipmentRecord: z.string().nullable().optional(),
  siteAppearanceRecord: z.string().nullable().optional(),
  overtimeRecord: z.string().nullable().optional(),
  otherRecord: z.string().nullable().optional(),
  siteLeader: z.string().nullable().optional(),
  reporter: z.string().nullable().optional(),
  constructionLog: z.string().nullable().optional()
})

const taskImportSchema = z.object({
  planFileId: z.string().nullable().optional(),
  tasks: z.array(
    z.object({
      externalId: z.string().nullable().optional(),
      parentExternalId: z.string().nullable().optional(),
      wbs: z.string().nullable().optional(),
      name: z.string().min(1),
      level: z.number().int().min(0).optional(),
      sortOrder: z.number().int().optional(),
      duration: z.string().nullable().optional(),
      planStart: z.string().nullable().optional(),
      planEnd: z.string().nullable().optional(),
      predecessor: z.string().nullable().optional(),
      inspectionBatch: z.string().nullable().optional(),
      bimElements: taskBimSchema.nullable().optional()
    })
  )
})

const progressPlanFilesErrHandler = (
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

const withAdminOverride = (middleware: RequestHandler): RequestHandler => {
  return async (req, res, next) => {
    if (req.context.role === Roles.Server.Admin) return next()
    return middleware(req, res, next)
  }
}

const serializePlanTask = (task: ProgressPlanTaskRecord) => ({
  id: task.id,
  projectId: task.projectId,
  planFileId: task.planFileId,
  externalId: task.externalId,
  wbs: task.wbs,
  taskName: task.name,
  parentId: task.parentId,
  level: task.level,
  sortOrder: task.sortOrder,
  duration: task.duration,
  startDate: task.planStart?.toISOString() || null,
  endDate: task.planEnd?.toISOString() || null,
  predecessor: task.predecessor,
  inspection: task.inspectionBatch,
  modelId: task.bimElements?.modelId || null,
  modelIds: task.bimElements?.modelIds || [],
  applicationIds: task.bimElements?.applicationIds || [],
  selections: task.bimElements?.selections || [],
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString()
})

const buildWeekDay = (reportDate: string) => {
  const match = reportDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''

  const [, year, month, day] = match
  const date = new Date(Number(year), Math.max(0, Number(month) - 1), Number(day))
  const dayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return Number.isNaN(date.getTime()) ? '' : dayMap[date.getDay()]
}

const serializeActualRecord = (record: ProgressActualRecord) => {
  const [year = '', month = '', day = ''] = record.reportDate.split('-')
  const startBimElements = record.startBimElements || record.bimElements
  const finishBimElements = record.finishBimElements

  return {
    id: record.id,
    projectId: record.projectId,
    taskName: record.taskName,
    year,
    month,
    day,
    weekDay: buildWeekDay(record.reportDate),
    reportDate: record.reportDate,
    startElementCodes: record.startElementCodes || '',
    finishElementCodes: record.finishElementCodes || '',
    startModelIds: startBimElements?.modelIds || [],
    startApplicationIds: startBimElements?.applicationIds || [],
    startSelections: startBimElements?.selections || [],
    finishModelIds: finishBimElements?.modelIds || [],
    finishApplicationIds: finishBimElements?.applicationIds || [],
    finishSelections: finishBimElements?.selections || [],
    remark: record.remark || '',
    highTemperature: record.highTemperature || '',
    lowTemperature: record.lowTemperature || '',
    morningWeather: record.morningWeather || '',
    afternoonWeather: record.afternoonWeather || '',
    nightCondition: record.nightCondition || '',
    constructionRecord: record.constructionRecord || '',
    qualityRecord: record.qualityRecord || '',
    safetyRecord: record.safetyRecord || '',
    mortarConcreteSampleRecord: record.mortarConcreteSampleRecord || '',
    materialEquipmentRecord: record.materialEquipmentRecord || '',
    siteAppearanceRecord: record.siteAppearanceRecord || '',
    overtimeRecord: record.overtimeRecord || '',
    otherRecord: record.otherRecord || '',
    siteLeader: record.siteLeader || '',
    reporter: record.reporter || '',
    constructionLog: record.constructionLog || '',
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  }
}

const serializeElementSnapshot = (snapshot: ProgressElementSnapshotRecord) => ({
  id: snapshot.id,
  projectId: snapshot.projectId,
  modelId: snapshot.modelId,
  applicationId: snapshot.applicationId,
  plannedStartAt: snapshot.plannedStartAt?.toISOString() || null,
  plannedFinishAt: snapshot.plannedFinishAt?.toISOString() || null,
  actualStartAt: snapshot.actualStartAt?.toISOString() || null,
  actualFinishAt: snapshot.actualFinishAt?.toISOString() || null,
  progressStatus: snapshot.progressStatus,
  progressPercent:
    snapshot.progressPercent === null ? null : Number(snapshot.progressPercent || 0),
  isAheadStart: snapshot.isAheadStart,
  isDelayedFinish: snapshot.isDelayedFinish,
  lastReportAt: snapshot.lastReportAt?.toISOString() || null,
  createdAt: snapshot.createdAt.toISOString(),
  updatedAt: snapshot.updatedAt.toISOString()
})

const serializeTaskSnapshot = (
  snapshot: ProgressTaskSnapshotRecord,
  task?: ProgressPlanTaskRecord
) => ({
  id: snapshot.id,
  projectId: snapshot.projectId,
  taskId: snapshot.taskId,
  taskName: task?.name || '',
  wbs: task?.wbs || null,
  totalElementCount: snapshot.totalElementCount,
  finishedElementCount: snapshot.finishedElementCount,
  inProgressElementCount: snapshot.inProgressElementCount,
  notStartedElementCount: snapshot.notStartedElementCount,
  delayedElementCount: snapshot.delayedElementCount,
  completionRate: Number(snapshot.completionRate || 0),
  plannedStartAt: snapshot.plannedStartAt?.toISOString() || null,
  plannedFinishAt: snapshot.plannedFinishAt?.toISOString() || null,
  actualStartAt: snapshot.actualStartAt?.toISOString() || null,
  actualFinishAt: snapshot.actualFinishAt?.toISOString() || null,
  taskStatus: snapshot.taskStatus,
  lastCalculatedAt: snapshot.lastCalculatedAt?.toISOString() || null,
  createdAt: snapshot.createdAt.toISOString(),
  updatedAt: snapshot.updatedAt.toISOString()
})

const buildRoute = (router: Router) => {
  const route = '/api/v1/projects/:projectId/progress/plan-file'
  const taskRoute = '/api/v1/projects/:projectId/progress/plan-tasks'
  const actualRecordRoute = '/api/v1/projects/:projectId/progress/actual-records'
  const elementSnapshotRoute = '/api/v1/projects/:projectId/progress/element-snapshots'
  const taskSnapshotRoute = '/api/v1/projects/:projectId/progress/task-snapshots'
  const statisticsRoute = '/api/v1/projects/:projectId/progress/statistics'
  const rebuildSnapshotsRoute = '/api/v1/projects/:projectId/progress/rebuild-snapshots'
  const progressCors = corsMiddlewareFactory({
    corsConfig: {
      origin: true,
      credentials: true
    }
  })

  router.options(route, progressCors, allowCrossOriginResourceAccessMiddelware())
  router.options(taskRoute, progressCors, allowCrossOriginResourceAccessMiddelware())
  router.options(
    actualRecordRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${actualRecordRoute}/import`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${actualRecordRoute}/:recordId`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${taskRoute}/:taskId/bim-association`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    `${taskRoute}/import`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    elementSnapshotRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    taskSnapshotRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    statisticsRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware()
  )
  router.options(
    rebuildSnapshotsRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware()
  )

  router.get(
    elementSnapshotRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamReadPermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema, query: elementSnapshotQuerySchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const projectDb = await getProjectDbClient({ projectId })
        const progressStatus = req.query.progressStatus as
          | ProgressElementSnapshotStatus
          | undefined
        const [items, total] = await Promise.all([
          listProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            modelId: req.query.modelId as string | undefined,
            progressStatus,
            page: req.query.page as number | undefined,
            limit: req.query.limit as number | undefined
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            modelId: req.query.modelId as string | undefined,
            progressStatus
          })
        ])

        return res.status(200).json({
          data: items.map(serializeElementSnapshot),
          meta: {
            total,
            page: Number(req.query.page || 1),
            limit: Number(req.query.limit || 50)
          }
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    taskSnapshotRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamReadPermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema, query: taskSnapshotQuerySchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const projectDb = await getProjectDbClient({ projectId })
        const taskStatus = req.query.taskStatus as
          | ProgressTaskSnapshotStatus
          | undefined
        const [items, total] = await Promise.all([
          listProgressTaskSnapshotsFactory({ db: projectDb })({
            projectId,
            taskStatus,
            keyword: req.query.keyword as string | undefined,
            page: req.query.page as number | undefined,
            limit: req.query.limit as number | undefined
          }),
          countProgressTaskSnapshotsFactory({ db: projectDb })({
            projectId,
            taskStatus,
            keyword: req.query.keyword as string | undefined
          })
        ])
        const tasks = await listProgressPlanTasksByIdsFactory({ db: projectDb })({
          projectId,
          taskIds: items.map((item) => item.taskId)
        })
        const tasksById = new Map(tasks.map((task) => [task.id, task]))

        return res.status(200).json({
          data: items.map((item) =>
            serializeTaskSnapshot(item, tasksById.get(item.taskId))
          ),
          meta: {
            total,
            page: Number(req.query.page || 1),
            limit: Number(req.query.limit || 50)
          }
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    statisticsRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamReadPermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const projectDb = await getProjectDbClient({ projectId })
        const [
          totalElements,
          finishedAheadElements,
          finishedOnTimeElements,
          finishedDelayedElements,
          inProgressElements,
          inProgressDelayedElements,
          notStartedElements,
          readyNotStartedElements,
          delayedNotStartedElements,
          aheadStartElements,
          delayedFinishElements,
          totalTasks,
          finishedOnTimeTasks,
          finishedDelayedTasks,
          delayedTasks,
          inProgressTasks,
          notStartedTasks
        ] = await Promise.all([
          countProgressElementSnapshotsFactory({ db: projectDb })({ projectId }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            progressStatus: 'finished_ahead'
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            progressStatus: 'finished_on_time'
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            progressStatus: 'finished_delayed'
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            progressStatus: 'in_progress'
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            progressStatus: 'in_progress_delayed'
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            progressStatus: 'not_started'
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            progressStatus: 'ready_not_started'
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            progressStatus: 'delayed_not_started'
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            isAheadStart: true
          }),
          countProgressElementSnapshotsFactory({ db: projectDb })({
            projectId,
            isDelayedFinish: true
          }),
          countProgressTaskSnapshotsFactory({ db: projectDb })({ projectId }),
          countProgressTaskSnapshotsFactory({ db: projectDb })({
            projectId,
            taskStatus: 'finished_on_time'
          }),
          countProgressTaskSnapshotsFactory({ db: projectDb })({
            projectId,
            taskStatus: 'finished_delayed'
          }),
          countProgressTaskSnapshotsFactory({ db: projectDb })({
            projectId,
            taskStatus: 'delayed'
          }),
          countProgressTaskSnapshotsFactory({ db: projectDb })({
            projectId,
            taskStatus: 'in_progress'
          }),
          countProgressTaskSnapshotsFactory({ db: projectDb })({
            projectId,
            taskStatus: 'not_started'
          })
        ])

        const finishedElements =
          finishedAheadElements + finishedOnTimeElements + finishedDelayedElements
        const aggregateInProgressElements =
          inProgressElements + inProgressDelayedElements
        const aggregateNotStartedElements =
          notStartedElements + readyNotStartedElements + delayedNotStartedElements
        const finishedTasks = finishedOnTimeTasks + finishedDelayedTasks

        return res.status(200).json({
          data: {
            totalElements,
            finishedElements,
            inProgressElements: aggregateInProgressElements,
            inProgressDelayedElements,
            notStartedElements: aggregateNotStartedElements,
            readyNotStartedElements,
            delayedNotStartedElements,
            finishedAheadElements,
            finishedOnTimeElements,
            finishedDelayedElements,
            aheadStartElements,
            delayedFinishElements,
            totalTasks,
            finishedTasks,
            delayedTasks,
            inProgressTasks,
            notStartedTasks,
            completionRate: totalElements
              ? Number(((finishedElements / totalElements) * 100).toFixed(2))
              : 0
          }
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    rebuildSnapshotsRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        if (!req.context.userId) {
          return res.status(401).json({ error: 'Authentication required.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        let summary: {
          planTaskCount: number
          actualRecordCount: number
          affectedElementCount: number
          rebuiltTaskSnapshotCount: number
        } | null = null
        await projectDb.transaction(async (trx) => {
          const rebuildAllProgressSnapshots = rebuildAllProgressSnapshotsFactory({
            db: trx
          })
          summary = await rebuildAllProgressSnapshots({
            projectId,
            actorId: req.context.userId!
          })
        })

        return res.status(200).json({
          data: {
            status: 'completed',
            ...(summary || {
              planTaskCount: 0,
              actualRecordCount: 0,
              affectedElementCount: 0,
              rebuiltTaskSnapshotCount: 0
            })
          }
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    actualRecordRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamReadPermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const projectDb = await getProjectDbClient({ projectId })
        const records = await listProgressActualRecordsFactory({ db: projectDb })({
          projectId
        })

        return res.status(200).json({ data: records.map(serializeActualRecord) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    `${actualRecordRoute}/import`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema, body: actualRecordImportSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        if (!req.context.userId) {
          return res.status(401).json({ error: 'Authentication required.' })
        }

        const [projectDb, projectStorage] = await Promise.all([
          getProjectDbClient({ projectId }),
          getProjectObjectStorage({ projectId })
        ])
        const imported = await importProgressActualRecordsFromBlobFactory({
          db: projectDb,
          storage: projectStorage.private
        })({
          projectId,
          blobId: req.body.blobId,
          fileName: req.body.fileName,
          actorId: req.context.userId
        })

        return res.status(201).json({
          data: {
            createdCount: imported.length
          }
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    actualRecordRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema, body: actualRecordBodySchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        if (!req.context.userId) {
          return res.status(401).json({ error: 'Authentication required.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const created = await projectDb.transaction(async (trx) => {
          const record = await createProgressActualRecordFactory({ db: trx })({
            projectId,
            actorId: req.context.userId!,
            input: req.body
          })
          await syncActualRecordDerivedDataFactory({ db: trx })({
            projectId,
            nextRecord: record,
            actorId: req.context.userId!
          })
          return record
        })

        return res.status(201).json({ data: serializeActualRecord(created) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.put(
    `${actualRecordRoute}/:recordId`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: actualRecordParamsSchema, body: actualRecordBodySchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        if (!req.context.userId) {
          return res.status(401).json({ error: 'Authentication required.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const updated = await projectDb.transaction(async (trx) => {
          const previousRecord = await getProgressActualRecordFactory({ db: trx })({
            projectId,
            recordId: req.params.recordId
          })
          if (!previousRecord) return null

          const nextRecord = await updateProgressActualRecordFactory({ db: trx })({
            projectId,
            recordId: req.params.recordId,
            actorId: req.context.userId!,
            input: req.body
          })
          if (!nextRecord) return null

          await syncActualRecordDerivedDataFactory({ db: trx })({
            projectId,
            previousRecord,
            nextRecord,
            actorId: req.context.userId!
          })

          return nextRecord
        })

        if (!updated) {
          return res.status(404).json({ error: 'Progress actual record not found.' })
        }

        return res.status(200).json({ data: serializeActualRecord(updated) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.delete(
    `${actualRecordRoute}/:recordId`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: actualRecordParamsSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        if (!req.context.userId) {
          return res.status(401).json({ error: 'Authentication required.' })
        }
        const projectDb = await getProjectDbClient({ projectId })
        const deleted = await projectDb.transaction(async (trx) => {
          const previousRecord = await getProgressActualRecordFactory({ db: trx })({
            projectId,
            recordId: req.params.recordId
          })
          if (!previousRecord) return false

          const removed = await deleteProgressActualRecordFactory({ db: trx })({
            projectId,
            recordId: req.params.recordId
          })
          if (!removed) return false

          await syncActualRecordDerivedDataFactory({ db: trx })({
            projectId,
            previousRecord,
            actorId: req.context.userId!
          })

          return true
        })

        if (!deleted) {
          return res.status(404).json({ error: 'Progress actual record not found.' })
        }

        return res.status(200).json({ data: { id: req.params.recordId } })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    taskRoute,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamReadPermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const projectDb = await getProjectDbClient({ projectId })
        const tasks = await listProgressPlanTasksFactory({ db: projectDb })({
          projectId
        })

        return res.status(200).json({ data: tasks.map(serializePlanTask) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.put(
    `${taskRoute}/:taskId/bim-association`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: taskParamsSchema, body: taskBimSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        if (!req.context.userId) {
          return res.status(401).json({ error: 'Authentication required.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const updated = await projectDb.transaction(async (trx) => {
          const previousTask = await getProgressPlanTaskFactory({ db: trx })({
            projectId,
            taskId: req.params.taskId
          })
          if (!previousTask) return null

          const nextTask = await updateProgressPlanTaskBimFactory({ db: trx })({
            projectId,
            taskId: req.params.taskId,
            modelId: req.body.modelId ?? null,
            applicationIds: req.body.applicationIds || [],
            selections: req.body.selections || [],
            updater: req.context.userId!
          })
          if (!nextTask) return null

          await syncPlanTaskDerivedDataFactory({ db: trx })({
            projectId,
            previousTasks: [previousTask],
            nextTasks: [nextTask],
            actorId: req.context.userId!
          })

          return nextTask
        })

        if (!updated) {
          return res.status(404).json({ error: 'Progress plan task not found.' })
        }

        return res.status(200).json({ data: serializePlanTask(updated) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    `${taskRoute}/import`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema, body: taskImportSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        if (!req.context.userId) {
          return res.status(401).json({ error: 'Authentication required.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const replaced = await projectDb.transaction(async (trx) => {
          const previousTasks = await listProgressPlanTasksFactory({ db: trx })({
            projectId
          })
          const nextTasks = await replaceProgressPlanTasksFactory({ db: trx })({
            projectId,
            planFileId: req.body.planFileId ?? null,
            actorId: req.context.userId!,
            tasks: req.body.tasks
          })

          await syncPlanTaskDerivedDataFactory({ db: trx })({
            projectId,
            previousTasks,
            nextTasks,
            actorId: req.context.userId!
          })

          return nextTasks
        })

        return res.status(200).json({ data: replaced.map(serializePlanTask) })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    route,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamReadPermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        res.setHeader(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, proxy-revalidate'
        )
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
        const projectDb = await getProjectDbClient({ projectId })
        const latestFile = await getLatestProgressPlanFileFactory({ db: projectDb })({
          projectId
        })

        return res.status(200).json({ data: latestFile || null })
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    route,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema, body: bodySchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        if (!req.context.userId) {
          return res.status(401).json({ error: 'Authentication required.' })
        }

        const [projectDb, projectStorage] = await Promise.all([
          getProjectDbClient({ projectId }),
          getProjectObjectStorage({ projectId })
        ])
        const created = await createProgressPlanFileFactory({ db: projectDb })({
          projectId,
          blobId: req.body.blobId,
          fileName: req.body.fileName,
          fileType: req.body.fileType,
          fileSize: req.body.fileSize ?? null,
          creator: req.context.userId,
          updater: req.context.userId
        })

        try {
          const importedTasks = await importProgressPlanTasksFromBlobFactory({
            db: projectDb,
            storage: projectStorage.private
          })({
            projectId,
            planFileId: created.id,
            blobId: created.blobId,
            fileName: created.fileName,
            actorId: req.context.userId
          })

          return res.status(201).json({
            data: created,
            importSummary: {
              status: 'completed',
              importedTaskCount: importedTasks.length
            }
          })
        } catch (importError) {
          const error = ensureError(importError)
          req.log.error(error, 'Failed to import progress plan tasks from .mpp file')

          return res.status(201).json({
            data: created,
            importSummary: {
              status: 'failed',
              importedTaskCount: 0,
              error: error.message
            }
          })
        }
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    `${route}/download`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamReadPermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: paramsSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        const [projectDb, projectStorage] = await Promise.all([
          getProjectDbClient({ projectId }),
          getProjectObjectStorage({ projectId })
        ])

        const latestFile = await getLatestProgressPlanFileFactory({ db: projectDb })({
          projectId
        })

        if (!latestFile) {
          return res.status(404).json({ error: 'No progress plan file found.' })
        }

        const getBlobMetadata = getBlobMetadataFactory({ db: projectDb })
        const getFileStream = getFileStreamFactory({ getBlobMetadata })
        const getObjectStream = getObjectStreamFactory({
          storage: projectStorage.private
        })
        const fileStream = await getFileStream({
          getObjectStream,
          streamId: projectId,
          blobId: latestFile.blobId
        })

        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': contentDisposition(latestFile.fileName)
        })
        fileStream.pipe(res)
      } catch (err) {
        next(err)
      }
    }
  )

  router.use(route, progressPlanFilesErrHandler)
  router.use(taskRoute, progressPlanFilesErrHandler)
  router.use(actualRecordRoute, progressPlanFilesErrHandler)
  router.use(elementSnapshotRoute, progressPlanFilesErrHandler)
  router.use(taskSnapshotRoute, progressPlanFilesErrHandler)
  router.use(statisticsRoute, progressPlanFilesErrHandler)
}

export const progressRouterFactory = (): Router => {
  const router = Router()
  buildRoute(router)
  return router
}
