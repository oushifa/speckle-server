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
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  streamReadPermissionsPipelineFactory,
  streamWritePermissionsPipelineFactory
} from '@/modules/shared/authz'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { ensureError } from '@speckle/shared'
import contentDisposition from 'content-disposition'

import {
  createProgressV2PlanFileFactory,
  getLatestProgressV2PlanFileFactory
} from '@/modules/progress-v2/repositories/progressV2PlanFiles'
import {
  listProgressV2PlanTasksFactory,
  getProgressV2PlanTaskFactory
} from '@/modules/progress-v2/repositories/progressV2PlanTasks'
import {
  createProgressV2AnnualPlanFactory,
  deleteProgressV2AnnualPlanFactory,
  getProgressV2AnnualPlanByIdFactory,
  listProgressV2AnnualPlansFactory,
  updateProgressV2AnnualPlanFactory
} from '@/modules/progress-v2/repositories/progressV2AnnualPlans'
import { listProgressV2AnnualPlanTasksFactory } from '@/modules/progress-v2/repositories/progressV2AnnualPlanTasks'
import {
  createProgressV2MonthlyPlanFactory,
  deleteProgressV2MonthlyPlanFactory,
  getProgressV2MonthlyPlanByIdFactory,
  listProgressV2MonthlyPlansFactory,
  updateProgressV2MonthlyPlanFactory
} from '@/modules/progress-v2/repositories/progressV2MonthlyPlans'
import {
  createProgressV2ActualRecordFactory,
  deleteProgressV2ActualRecordFactory,
  getProgressV2ActualRecordByIdFactory,
  listProgressV2ActualRecordsFactory,
  updateProgressV2ActualRecordFactory
} from '@/modules/progress-v2/repositories/progressV2ActualRecords'
import {
  createProgressV2MilestoneFactory,
  deleteProgressV2MilestoneFactory,
  getProgressV2MilestoneByIdFactory,
  listProgressV2MilestonesFactory,
  updateProgressV2MilestoneFactory
} from '@/modules/progress-v2/repositories/progressV2Milestones'
import {
  importProgressV2PlanTasksFromBlobFactory,
  importProgressV2AnnualPlanTasksFromBlobFactory,
  exportProgressV2PlanFileWithSysTaskIdFactory
} from '@/modules/progress-v2/services/progressV2MppImport'

// ── Schemas ──
const projectParamsSchema = z.object({
  projectId: z.string().min(1)
})

const annualPlanParamsSchema = z.object({
  projectId: z.string().min(1),
  annualPlanId: z.string().min(1)
})

const monthlyPlanParamsSchema = z.object({
  projectId: z.string().min(1),
  monthlyPlanId: z.string().min(1)
})

const actualRecordParamsSchema = z.object({
  projectId: z.string().min(1),
  recordId: z.string().min(1)
})

const milestoneParamsSchema = z.object({
  projectId: z.string().min(1),
  milestoneId: z.string().min(1)
})

const planFileBodySchema = z.object({
  blobId: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().nullable().optional()
})

const createAnnualPlanBodySchema = z.object({
  year: z.number().int(),
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  preparedBy: z.string().nullable().optional(),
  remark: z.string().nullable().optional()
})

const updateAnnualPlanBodySchema = z.object({
  year: z.number().int().optional(),
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  preparedBy: z.string().nullable().optional(),
  remark: z.string().nullable().optional()
})

const createMonthlyPlanBodySchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  title: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
  tasks: z.array(z.any()).optional()
})

const updateMonthlyPlanBodySchema = z.object({
  title: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
  tasks: z.array(z.any()).optional()
})

const createActualRecordBodySchema = z.object({
  taskName: z.string().min(1),
  sectionName: z.string().nullable().optional(),
  reportDate: z.string().min(1),
  actualStartDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  weather: z.string().nullable().optional(),
  highTemperature: z.string().nullable().optional(),
  lowTemperature: z.string().nullable().optional(),
  constructionRecord: z.string().nullable().optional(),
  qualityRecord: z.string().nullable().optional(),
  safetyRecord: z.string().nullable().optional(),
  reporter: z.string().nullable().optional(),
  remark: z.string().nullable().optional()
})

const updateActualRecordBodySchema = z.object({
  taskName: z.string().min(1).optional(),
  sectionName: z.string().nullable().optional(),
  reportDate: z.string().optional(),
  actualStartDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  weather: z.string().nullable().optional(),
  highTemperature: z.string().nullable().optional(),
  lowTemperature: z.string().nullable().optional(),
  constructionRecord: z.string().nullable().optional(),
  qualityRecord: z.string().nullable().optional(),
  safetyRecord: z.string().nullable().optional(),
  reporter: z.string().nullable().optional(),
  remark: z.string().nullable().optional()
})

const createMilestoneBodySchema = z.object({
  taskName: z.string().min(1),
  plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(),
  actualStart: z.string().nullable().optional(),
  actualEnd: z.string().nullable().optional(),
  status: z.string().optional(),
  milestoneType: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
  tags: z.array(z.string()).optional()
})

const updateMilestoneBodySchema = z.object({
  taskName: z.string().min(1).optional(),
  plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(),
  actualStart: z.string().nullable().optional(),
  actualEnd: z.string().nullable().optional(),
  status: z.string().optional(),
  milestoneType: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
  tags: z.array(z.string()).optional()
})

export const progressV2RouterFactory = (): Router => {
  const router = Router()
  const cors = corsMiddlewareFactory({
    corsConfig: { origin: true, credentials: true }
  })

  // 路由路径常量
  const basePath = '/api/v1/projects/:projectId/progress-v2'

  const readAuth: RequestHandler = async (req, res, next) => {
    const projectId = req.params.projectId
    const db = await getProjectDbClient({ projectId })
    const getStream = getStreamFactory({ db })
    return authMiddlewareCreator([
      ...streamReadPermissionsPipelineFactory({ getStream })
    ])(req, res, next)
  }

  const writeAuth: RequestHandler = async (req, res, next) => {
    const projectId = req.params.projectId
    const db = await getProjectDbClient({ projectId })
    const getStream = getStreamFactory({ db })
    return authMiddlewareCreator([
      ...streamWritePermissionsPipelineFactory({ getStream })
    ])(req, res, next)
  }

  router.options('*', cors, allowCrossOriginResourceAccessMiddelware())

  // ==========================================
  // 1. 总进度计划 Plan File & Tasks
  // ==========================================
  router.get(
    `${basePath}/plan-file`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const db = await getProjectDbClient({ projectId })
        const file = await getLatestProgressV2PlanFileFactory({ db })({ projectId })
        return res.json({ success: true, data: file || null })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.post(
    `${basePath}/plan-file`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema, body: planFileBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const actorId = req.context?.userId || 'unknown'
        const db = await getProjectDbClient({ projectId })
        const storage = await getProjectObjectStorage({ projectId })

        const planFile = await createProgressV2PlanFileFactory({ db })({
          projectId,
          blobId: req.body.blobId,
          fileName: req.body.fileName,
          fileType: req.body.fileType,
          fileSize: req.body.fileSize ?? null,
          creator: actorId,
          updater: actorId
        })

        const tasks = await importProgressV2PlanTasksFromBlobFactory({
          db,
          storage: storage.private
        })({
          projectId,
          planFileId: planFile.id,
          blobId: req.body.blobId,
          fileName: req.body.fileName,
          actorId
        })

        return res.status(201).json({
          success: true,
          data: {
            planFile,
            taskCount: tasks.length
          }
        })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.get(
    `${basePath}/plan-tasks`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const db = await getProjectDbClient({ projectId })
        const tasks = await listProgressV2PlanTasksFactory({ db })({ projectId })
        return res.json({ success: true, data: tasks })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.get(
    `${basePath}/plan-file/download`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const db = await getProjectDbClient({ projectId })
        const storage = await getProjectObjectStorage({ projectId })
        const latestFile = await getLatestProgressV2PlanFileFactory({ db })({ projectId })
        if (!latestFile) {
          return res.status(404).json({ success: false, message: 'Plan file not found' })
        }

        const { rm } = await import('node:fs/promises')
        const exportPlanFile = exportProgressV2PlanFileWithSysTaskIdFactory({
          db,
          storage: storage.private
        })

        const { exportedBuffer, tempDir, outputFileName } = await exportPlanFile({
          projectId,
          blobId: latestFile.blobId,
          fileName: latestFile.fileName
        })

        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': contentDisposition(
            outputFileName || latestFile.fileName
          )
        })

        return res.end(exportedBuffer, () => {
          void rm(tempDir, { recursive: true, force: true })
        })
      } catch (err) {
        return next(err)
      }
    }
  )

  // ==========================================
  // 2. 年度计划 Annual Plans & Tasks
  // ==========================================
  router.get(
    `${basePath}/annual-plans`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const year = req.query.year ? Number(req.query.year) : undefined
        const db = await getProjectDbClient({ projectId })
        const list = await listProgressV2AnnualPlansFactory({ db })({ projectId, year })
        return res.json({ success: true, data: list })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.post(
    `${basePath}/annual-plans`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema, body: createAnnualPlanBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const actorId = req.context?.userId || 'unknown'
        const db = await getProjectDbClient({ projectId })

        const item = await createProgressV2AnnualPlanFactory({ db })({
          projectId,
          year: req.body.year,
          name: req.body.name,
          startDate: new Date(req.body.startDate),
          endDate: new Date(req.body.endDate),
          preparedBy: req.body.preparedBy,
          remark: req.body.remark,
          createdBy: actorId
        })
        return res.status(201).json({ success: true, data: item })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.get(
    `${basePath}/annual-plans/:annualPlanId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: annualPlanParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, annualPlanId } = req.params
        const db = await getProjectDbClient({ projectId })
        const item = await getProgressV2AnnualPlanByIdFactory({ db })({
          id: annualPlanId,
          projectId
        })
        if (!item) return res.status(404).json({ success: false, message: 'Not found' })
        return res.json({ success: true, data: item })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.put(
    `${basePath}/annual-plans/:annualPlanId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: annualPlanParamsSchema, body: updateAnnualPlanBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, annualPlanId } = req.params
        const db = await getProjectDbClient({ projectId })
        const updated = await updateProgressV2AnnualPlanFactory({ db })({
          id: annualPlanId,
          projectId,
          year: req.body.year,
          name: req.body.name,
          startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
          endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
          preparedBy: req.body.preparedBy,
          remark: req.body.remark
        })
        return res.json({ success: true, data: updated })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.delete(
    `${basePath}/annual-plans/:annualPlanId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: annualPlanParamsSchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, annualPlanId } = req.params
        const db = await getProjectDbClient({ projectId })
        const success = await deleteProgressV2AnnualPlanFactory({ db })({
          id: annualPlanId,
          projectId
        })
        return res.json({ success })
      } catch (err) {
        return next(err)
      }
    }
  )

  // 年度计划上传/更新 .mpp 文件并解析任务树
  router.post(
    `${basePath}/annual-plans/:annualPlanId/plan-file`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: annualPlanParamsSchema, body: planFileBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, annualPlanId } = req.params
        const actorId = req.context?.userId || 'unknown'
        const db = await getProjectDbClient({ projectId })
        const storage = await getProjectObjectStorage({ projectId })

        // 1. 更新 annual plan 的文件信息
        await updateProgressV2AnnualPlanFactory({ db })({
          id: annualPlanId,
          projectId,
          blobId: req.body.blobId,
          fileName: req.body.fileName,
          fileSize: req.body.fileSize ?? null
        })

        // 2. 解析 MPP 并写入 annual plan tasks
        const tasks = await importProgressV2AnnualPlanTasksFromBlobFactory({
          db,
          storage: storage.private
        })({
          projectId,
          annualPlanId,
          blobId: req.body.blobId,
          fileName: req.body.fileName,
          actorId
        })

        return res.status(201).json({
          success: true,
          data: {
            annualPlanId,
            taskCount: tasks.length
          }
        })
      } catch (err) {
        return next(err)
      }
    }
  )

  // 获取年度计划的任务树
  router.get(
    `${basePath}/annual-plans/:annualPlanId/tasks`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: annualPlanParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, annualPlanId } = req.params
        const db = await getProjectDbClient({ projectId })
        const tasks = await listProgressV2AnnualPlanTasksFactory({ db })({
          projectId,
          annualPlanId
        })
        return res.json({ success: true, data: tasks })
      } catch (err) {
        return next(err)
      }
    }
  )

  // ==========================================
  // 3. 月度计划 Monthly Plans
  // ==========================================
  router.get(
    `${basePath}/monthly-plans`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const db = await getProjectDbClient({ projectId })
        const list = await listProgressV2MonthlyPlansFactory({ db })({ projectId })
        return res.json({ success: true, data: list })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.post(
    `${basePath}/monthly-plans`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema, body: createMonthlyPlanBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const actorId = req.context?.userId || 'unknown'
        const db = await getProjectDbClient({ projectId })

        const item = await createProgressV2MonthlyPlanFactory({ db })({
          projectId,
          yearMonth: req.body.yearMonth,
          title: req.body.title,
          remark: req.body.remark,
          tasks: req.body.tasks,
          createdBy: actorId
        })
        return res.status(201).json({ success: true, data: item })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.get(
    `${basePath}/monthly-plans/:monthlyPlanId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: monthlyPlanParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, monthlyPlanId } = req.params
        const db = await getProjectDbClient({ projectId })
        const item = await getProgressV2MonthlyPlanByIdFactory({ db })({
          id: monthlyPlanId,
          projectId
        })
        if (!item) return res.status(404).json({ success: false, message: 'Not found' })
        return res.json({ success: true, data: item })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.put(
    `${basePath}/monthly-plans/:monthlyPlanId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: monthlyPlanParamsSchema, body: updateMonthlyPlanBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, monthlyPlanId } = req.params
        const db = await getProjectDbClient({ projectId })
        const updated = await updateProgressV2MonthlyPlanFactory({ db })({
          id: monthlyPlanId,
          projectId,
          title: req.body.title,
          remark: req.body.remark,
          tasks: req.body.tasks
        })
        return res.json({ success: true, data: updated })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.delete(
    `${basePath}/monthly-plans/:monthlyPlanId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: monthlyPlanParamsSchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, monthlyPlanId } = req.params
        const db = await getProjectDbClient({ projectId })
        const success = await deleteProgressV2MonthlyPlanFactory({ db })({
          id: monthlyPlanId,
          projectId
        })
        return res.json({ success })
      } catch (err) {
        return next(err)
      }
    }
  )

  // ==========================================
  // 4. 进度管理 Actual Records
  // ==========================================
  router.get(
    `${basePath}/actual-records`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const search = req.query.search as string | undefined
        const db = await getProjectDbClient({ projectId })
        const list = await listProgressV2ActualRecordsFactory({ db })({ projectId, search })
        return res.json({ success: true, data: list })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.post(
    `${basePath}/actual-records`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema, body: createActualRecordBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const actorId = req.context?.userId || 'unknown'
        const db = await getProjectDbClient({ projectId })

        const item = await createProgressV2ActualRecordFactory({ db })({
          projectId,
          taskName: req.body.taskName,
          sectionName: req.body.sectionName,
          reportDate: req.body.reportDate,
          actualStartDate: req.body.actualStartDate ? new Date(req.body.actualStartDate) : null,
          actualEndDate: req.body.actualEndDate ? new Date(req.body.actualEndDate) : null,
          progressPercent: req.body.progressPercent,
          weather: req.body.weather,
          highTemperature: req.body.highTemperature,
          lowTemperature: req.body.lowTemperature,
          constructionRecord: req.body.constructionRecord,
          qualityRecord: req.body.qualityRecord,
          safetyRecord: req.body.safetyRecord,
          reporter: req.body.reporter,
          remark: req.body.remark,
          creator: actorId,
          updater: actorId
        })
        return res.status(201).json({ success: true, data: item })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.put(
    `${basePath}/actual-records/:recordId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: actualRecordParamsSchema, body: updateActualRecordBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, recordId } = req.params
        const actorId = req.context?.userId || 'unknown'
        const db = await getProjectDbClient({ projectId })

        const updated = await updateProgressV2ActualRecordFactory({ db })({
          id: recordId,
          projectId,
          taskName: req.body.taskName,
          sectionName: req.body.sectionName,
          reportDate: req.body.reportDate,
          actualStartDate: req.body.actualStartDate ? new Date(req.body.actualStartDate) : undefined,
          actualEndDate: req.body.actualEndDate ? new Date(req.body.actualEndDate) : undefined,
          progressPercent: req.body.progressPercent,
          weather: req.body.weather,
          highTemperature: req.body.highTemperature,
          lowTemperature: req.body.lowTemperature,
          constructionRecord: req.body.constructionRecord,
          qualityRecord: req.body.qualityRecord,
          safetyRecord: req.body.safetyRecord,
          reporter: req.body.reporter,
          remark: req.body.remark,
          updater: actorId
        })
        return res.json({ success: true, data: updated })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.delete(
    `${basePath}/actual-records/:recordId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: actualRecordParamsSchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, recordId } = req.params
        const db = await getProjectDbClient({ projectId })
        const success = await deleteProgressV2ActualRecordFactory({ db })({
          id: recordId,
          projectId
        })
        return res.json({ success })
      } catch (err) {
        return next(err)
      }
    }
  )

  // ==========================================
  // 5. 里程碑管理 Milestones
  // ==========================================
  router.get(
    `${basePath}/milestones`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema }),
    readAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const search = req.query.search as string | undefined
        const db = await getProjectDbClient({ projectId })
        const list = await listProgressV2MilestonesFactory({ db })({ projectId, search })
        return res.json({ success: true, data: list })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.post(
    `${basePath}/milestones`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: projectParamsSchema, body: createMilestoneBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params
        const actorId = req.context?.userId || 'unknown'
        const db = await getProjectDbClient({ projectId })

        const item = await createProgressV2MilestoneFactory({ db })({
          projectId,
          taskName: req.body.taskName,
          plannedStart: req.body.plannedStart ? new Date(req.body.plannedStart) : null,
          plannedEnd: req.body.plannedEnd ? new Date(req.body.plannedEnd) : null,
          actualStart: req.body.actualStart ? new Date(req.body.actualStart) : null,
          actualEnd: req.body.actualEnd ? new Date(req.body.actualEnd) : null,
          status: req.body.status,
          milestoneType: req.body.milestoneType,
          responsible: req.body.responsible,
          remark: req.body.remark,
          tags: req.body.tags,
          creator: actorId,
          updater: actorId
        })
        return res.status(201).json({ success: true, data: item })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.put(
    `${basePath}/milestones/:milestoneId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: milestoneParamsSchema, body: updateMilestoneBodySchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, milestoneId } = req.params
        const actorId = req.context?.userId || 'unknown'
        const db = await getProjectDbClient({ projectId })

        const updated = await updateProgressV2MilestoneFactory({ db })({
          id: milestoneId,
          projectId,
          taskName: req.body.taskName,
          plannedStart: req.body.plannedStart ? new Date(req.body.plannedStart) : undefined,
          plannedEnd: req.body.plannedEnd ? new Date(req.body.plannedEnd) : undefined,
          actualStart: req.body.actualStart ? new Date(req.body.actualStart) : undefined,
          actualEnd: req.body.actualEnd ? new Date(req.body.actualEnd) : undefined,
          status: req.body.status,
          milestoneType: req.body.milestoneType,
          responsible: req.body.responsible,
          remark: req.body.remark,
          tags: req.body.tags,
          updater: actorId
        })
        return res.json({ success: true, data: updated })
      } catch (err) {
        return next(err)
      }
    }
  )

  router.delete(
    `${basePath}/milestones/:milestoneId`,
    cors,
    allowCrossOriginResourceAccessMiddelware(),
    validateRequest({ params: milestoneParamsSchema }),
    writeAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId, milestoneId } = req.params
        const db = await getProjectDbClient({ projectId })
        const success = await deleteProgressV2MilestoneFactory({ db })({
          id: milestoneId,
          projectId
        })
        return res.json({ success })
      } catch (err) {
        return next(err)
      }
    }
  )

  return router
}
