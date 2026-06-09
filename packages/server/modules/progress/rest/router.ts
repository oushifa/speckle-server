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
  updateProgressPlanTaskMarkerFactory,
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
  listProgressTaskSnapshotsByTaskIdsFactory,
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

const bimEntrySchema = z.object({
  modelId: z.string().min(1),
  applicationIds: z.array(z.string()),
  bimIds: z.array(z.string().nullable())
})

const taskBimSchema = z.object({
  BIM: z.array(bimEntrySchema).optional()
})

const taskMarkerSchema = z.object({
  milestoneType: z.enum(['project', 'phase', 'acceptance']).nullable().optional(),
  milestoneDescription: z.string().trim().max(500).nullable().optional(),
  isCriticalTask: z.boolean().optional()
})

const actualRecordBodySchema = z.object({
  taskName: z.string().trim().min(1),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startElementCodes: z.string().nullable().optional(),
  finishElementCodes: z.string().nullable().optional(),
  startBIM: z.array(bimEntrySchema).nullable().optional(),
  finishBIM: z.array(bimEntrySchema).nullable().optional(),
  BIM: z.array(bimEntrySchema).nullable().optional(),
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
      milestoneType: z.enum(['project', 'phase', 'acceptance']).nullable().optional(),
      milestoneDescription: z.string().trim().max(500).nullable().optional(),
      isCriticalTask: z.boolean().optional(),
      BIM: z.array(bimEntrySchema).nullable().optional()
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

type SerializedPlanTaskAggregate = {
  totalElementCount: number
  finishedElementCount: number
  inProgressElementCount: number
  notStartedElementCount: number
  delayedElementCount: number
  completionRate: number
  taskStatus: ProgressTaskSnapshotStatus | null
  totalTaskCount: number
  linkedTaskCount: number
  finishedTaskCount: number
  delayedTaskCount: number
  BIM: import('@/modules/progress/repositories/progressPlanTasks').ProgressPlanTaskBIM
}

type SerializedPlanTaskNode = {
  task: ProgressPlanTaskRecord
  resolvedParentId: string | null
  level: number
  children: SerializedPlanTaskNode[]
  hasChildren: boolean
  aggregate: SerializedPlanTaskAggregate & {
    inProgressTaskCount: number
    notStartedTaskCount: number
    noBimLinkTaskCount: number
    finishedDelayedTaskCount: number
  }
}

const getParentWbs = (wbs?: string | null) => {
  if (!wbs) return null
  const segments = wbs.split('.').filter(Boolean)
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('.')
}

const getWbsLevel = (wbs?: string | null, fallbackLevel = 0) => {
  if (!wbs) return fallbackLevel
  const segments = wbs.split('.').filter(Boolean)
  return Math.max(segments.length - 1, 0)
}

const parseWbsSegments = (wbs?: string | null) => {
  if (!wbs) return []
  return wbs
    .split('.')
    .filter(Boolean)
    .map((segment) => Number.parseInt(segment, 10))
}

const compareWbs = (left?: string | null, right?: string | null) => {
  if (!left && !right) return 0
  if (left && !right) return -1
  if (!left && right) return 1

  const leftSegments = parseWbsSegments(left)
  const rightSegments = parseWbsSegments(right)
  const maxLength = Math.max(leftSegments.length, rightSegments.length)

  for (let index = 0; index < maxLength; index++) {
    const leftSegment = leftSegments[index]
    const rightSegment = rightSegments[index]

    if (leftSegment === undefined) return -1
    if (rightSegment === undefined) return 1
    if (leftSegment !== rightSegment) return leftSegment - rightSegment
  }

  return 0
}

const buildPlanTaskHierarchy = (tasks: ProgressPlanTaskRecord[]) => {
  const orderedTasks = [...tasks].sort((left, right) => {
    const wbsOrder = compareWbs(left.wbs, right.wbs)
    if (wbsOrder !== 0) return wbsOrder
    if (!left.wbs && !right.wbs && left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }
    if (left.name !== right.name) {
      return left.name.localeCompare(right.name, 'zh-CN')
    }
    return left.sortOrder - right.sortOrder
  })

  const originalParentIds = new Map(
    orderedTasks.map((task) => [task.id, task.parentId || null])
  )
  const nodeMap = new Map<string, SerializedPlanTaskNode>(
    orderedTasks.map((task) => [
      task.id,
      {
        task,
        resolvedParentId: null,
        level: getWbsLevel(task.wbs, task.level),
        children: [],
        hasChildren: false,
        aggregate: {
          totalElementCount: 0,
          finishedElementCount: 0,
          inProgressElementCount: 0,
          notStartedElementCount: 0,
          delayedElementCount: 0,
          completionRate: 0,
          taskStatus: null,
          totalTaskCount: 0,
          linkedTaskCount: 0,
          finishedTaskCount: 0,
          delayedTaskCount: 0,
          inProgressTaskCount: 0,
          notStartedTaskCount: 0,
          noBimLinkTaskCount: 0,
          finishedDelayedTaskCount: 0,
          BIM: []
        }
      }
    ])
  )
  const nodeByWbs = new Map(
    orderedTasks.flatMap((task) =>
      task.wbs ? [[task.wbs, nodeMap.get(task.id)!] as const] : []
    )
  )

  nodeMap.forEach((node) => {
    node.children = []
    node.resolvedParentId = null
    node.level = getWbsLevel(node.task.wbs, node.task.level)
  })

  const rootNodes: SerializedPlanTaskNode[] = []

  orderedTasks.forEach((task) => {
    const node = nodeMap.get(task.id)
    if (!node) return

    const wbsParent = getParentWbs(task.wbs)
    const originalParentId = originalParentIds.get(task.id)
    const parent = task.wbs
      ? wbsParent
        ? nodeByWbs.get(wbsParent)
        : undefined
      : originalParentId
      ? nodeMap.get(originalParentId)
      : undefined

    if (!parent) {
      rootNodes.push(node)
      return
    }

    node.resolvedParentId = parent.task.id
    node.level = parent.level + 1
    parent.children.push(node)
  })

  nodeMap.forEach((node) => {
    node.hasChildren = node.children.length > 0
  })

  return {
    orderedNodes: orderedTasks
      .map((task) => nodeMap.get(task.id))
      .filter((node): node is SerializedPlanTaskNode => !!node),
    nodeMap,
    rootNodes
  }
}

const resolveAggregatedTaskStatus = (
  aggregate: SerializedPlanTaskNode['aggregate']
): ProgressTaskSnapshotStatus | null => {
  if (!aggregate.totalTaskCount) return aggregate.taskStatus
  if (aggregate.finishedTaskCount === aggregate.totalTaskCount) {
    return aggregate.finishedDelayedTaskCount > 0
      ? 'finished_delayed'
      : 'finished_on_time'
  }
  if (aggregate.delayedTaskCount > 0) return 'delayed'
  if (aggregate.inProgressTaskCount > 0) return 'in_progress'
  if (aggregate.notStartedTaskCount > 0) return 'not_started'
  if (aggregate.noBimLinkTaskCount > 0) return 'no_bim_link'
  return aggregate.taskStatus
}

const aggregatePlanTaskNode = (
  node: SerializedPlanTaskNode,
  snapshotByTaskId: Map<string, ProgressTaskSnapshotRecord>
) => {
  if (!node.hasChildren) {
    const snapshot = snapshotByTaskId.get(node.task.id)
    const taskBIM = node.task.BIM || []
    const hasBimLink = taskBIM.some((e) => e.applicationIds.length > 0)

    node.aggregate = {
      totalElementCount: snapshot?.totalElementCount || 0,
      finishedElementCount: snapshot?.finishedElementCount || 0,
      inProgressElementCount: snapshot?.inProgressElementCount || 0,
      notStartedElementCount: snapshot?.notStartedElementCount || 0,
      delayedElementCount: snapshot?.delayedElementCount || 0,
      completionRate: Number(snapshot?.completionRate || 0),
      taskStatus: snapshot?.taskStatus || null,
      totalTaskCount: 1,
      linkedTaskCount: hasBimLink ? 1 : 0,
      finishedTaskCount:
        snapshot?.taskStatus === 'finished_on_time' ||
        snapshot?.taskStatus === 'finished_delayed'
          ? 1
          : 0,
      delayedTaskCount: snapshot?.taskStatus === 'delayed' ? 1 : 0,
      inProgressTaskCount: snapshot?.taskStatus === 'in_progress' ? 1 : 0,
      notStartedTaskCount: snapshot?.taskStatus === 'not_started' ? 1 : 0,
      noBimLinkTaskCount: snapshot?.taskStatus === 'no_bim_link' ? 1 : 0,
      finishedDelayedTaskCount: snapshot?.taskStatus === 'finished_delayed' ? 1 : 0,
      BIM: taskBIM
    }
    return node
  }

  node.children.forEach((child) => aggregatePlanTaskNode(child, snapshotByTaskId))

  const aggregate = node.children.reduce<SerializedPlanTaskNode['aggregate']>(
    (acc, child) => ({
      totalElementCount: acc.totalElementCount + child.aggregate.totalElementCount,
      finishedElementCount:
        acc.finishedElementCount + child.aggregate.finishedElementCount,
      inProgressElementCount:
        acc.inProgressElementCount + child.aggregate.inProgressElementCount,
      notStartedElementCount:
        acc.notStartedElementCount + child.aggregate.notStartedElementCount,
      delayedElementCount:
        acc.delayedElementCount + child.aggregate.delayedElementCount,
      completionRate: 0,
      taskStatus: null,
      totalTaskCount: acc.totalTaskCount + child.aggregate.totalTaskCount,
      linkedTaskCount: acc.linkedTaskCount + child.aggregate.linkedTaskCount,
      finishedTaskCount: acc.finishedTaskCount + child.aggregate.finishedTaskCount,
      delayedTaskCount: acc.delayedTaskCount + child.aggregate.delayedTaskCount,
      inProgressTaskCount:
        acc.inProgressTaskCount + child.aggregate.inProgressTaskCount,
      notStartedTaskCount:
        acc.notStartedTaskCount + child.aggregate.notStartedTaskCount,
      noBimLinkTaskCount: acc.noBimLinkTaskCount + child.aggregate.noBimLinkTaskCount,
      finishedDelayedTaskCount:
        acc.finishedDelayedTaskCount + child.aggregate.finishedDelayedTaskCount,
      BIM: []
    }),
    {
      totalElementCount: 0,
      finishedElementCount: 0,
      inProgressElementCount: 0,
      notStartedElementCount: 0,
      delayedElementCount: 0,
      completionRate: 0,
      taskStatus: null,
      totalTaskCount: 0,
      linkedTaskCount: 0,
      finishedTaskCount: 0,
      delayedTaskCount: 0,
      inProgressTaskCount: 0,
      notStartedTaskCount: 0,
      noBimLinkTaskCount: 0,
      finishedDelayedTaskCount: 0,
      BIM: []
    }
  )

  // 合并子节点的 BIM 数组：按 modelId 分组，合并 applicationIds
  const bimMap = new Map<string, Set<string>>()
  node.children.forEach((child) => {
    ;(child.aggregate.BIM || []).forEach((entry) => {
      let appIds = bimMap.get(entry.modelId)
      if (!appIds) {
        appIds = new Set<string>()
        bimMap.set(entry.modelId, appIds)
      }
      entry.applicationIds.forEach((id) => appIds!.add(id))
    })
  })

  aggregate.BIM = [...bimMap.entries()].map(([modelId, appIds]) => ({
    modelId,
    applicationIds: [...appIds],
    bimIds: [...appIds].map(() => null)
  }))

  // 按照子任务时间（计划工期）加权百分比计算：
  // sum(子节点工期 * 子节点进度) / sum(子节点工期)
  let sumWeight = 0
  let sumWeightedRate = 0
  node.children.forEach((child) => {
    const planStart = child.task.planStart ? new Date(child.task.planStart).getTime() : 0
    const planEnd = child.task.planEnd ? new Date(child.task.planEnd).getTime() : 0
    const duration = planStart && planEnd ? planEnd - planStart + 86400000 : 0

    sumWeight += duration
    sumWeightedRate += duration * child.aggregate.completionRate
  })

  if (sumWeight > 0) {
    aggregate.completionRate = Number((sumWeightedRate / sumWeight).toFixed(2))
  } else {
    const avg =
      node.children.reduce((acc, child) => acc + child.aggregate.completionRate, 0) /
      node.children.length
    aggregate.completionRate = Number(avg.toFixed(2))
  }

  aggregate.taskStatus = resolveAggregatedTaskStatus(aggregate)
  node.aggregate = aggregate
  return node
}

const serializePlanTask = (node: SerializedPlanTaskNode) => ({
  id: node.task.id,
  projectId: node.task.projectId,
  planFileId: node.task.planFileId,
  externalId: node.task.externalId,
  wbs: node.task.wbs,
  taskName: node.task.name,
  parentId: node.resolvedParentId,
  level: node.level,
  sortOrder: node.task.sortOrder,
  duration: node.task.duration,
  startDate: node.task.planStart?.toISOString() || null,
  endDate: node.task.planEnd?.toISOString() || null,
  milestoneType: node.task.milestoneType,
  milestoneDescription: node.task.milestoneDescription,
  isCriticalTask: node.task.isCriticalTask,
  predecessor: node.task.predecessor,
  inspection: node.task.inspectionBatch,
  // 采用根据下级合并的 BIM 关联信息
  BIM: node.aggregate.BIM,
  hasChildren: node.hasChildren,
  canEditBimAssociation: !node.hasChildren,
  totalElementCount: node.aggregate.totalElementCount,
  finishedElementCount: node.aggregate.finishedElementCount,
  inProgressElementCount: node.aggregate.inProgressElementCount,
  notStartedElementCount: node.aggregate.notStartedElementCount,
  delayedElementCount: node.aggregate.delayedElementCount,
  completionRate: node.aggregate.completionRate,
  taskStatus: node.aggregate.taskStatus,
  totalTaskCount: node.aggregate.totalTaskCount,
  linkedTaskCount: node.aggregate.linkedTaskCount,
  finishedTaskCount: node.aggregate.finishedTaskCount,
  delayedTaskCount: node.aggregate.delayedTaskCount,
  createdAt: node.task.createdAt.toISOString(),
  updatedAt: node.task.updatedAt.toISOString()
})

const serializePlanTasksWithAggregation = (
  tasks: ProgressPlanTaskRecord[],
  snapshots: ProgressTaskSnapshotRecord[]
) => {
  const hierarchy = buildPlanTaskHierarchy(tasks)
  const snapshotByTaskId = new Map(
    snapshots.map((snapshot) => [snapshot.taskId, snapshot])
  )
  hierarchy.rootNodes.forEach((node) => aggregatePlanTaskNode(node, snapshotByTaskId))
  return hierarchy.orderedNodes.map(serializePlanTask)
}

const serializeSinglePlanTask = (task: ProgressPlanTaskRecord) =>
  serializePlanTask({
    task,
    resolvedParentId: task.parentId,
    level: task.level,
    children: [],
    hasChildren: false,
    aggregate: {
      totalElementCount: 0,
      finishedElementCount: 0,
      inProgressElementCount: 0,
      notStartedElementCount: 0,
      delayedElementCount: 0,
      completionRate: 0,
      taskStatus: null,
      totalTaskCount: 1,
      linkedTaskCount: (task.BIM || []).some((e) => e.applicationIds.length) ? 1 : 0,
      finishedTaskCount: 0,
      delayedTaskCount: 0,
      inProgressTaskCount: 0,
      notStartedTaskCount: 0,
      noBimLinkTaskCount: 0,
      finishedDelayedTaskCount: 0,
      BIM: task.BIM || []
    }
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
  const startBIM = record.startBIM || record.BIM
  const finishBIM = record.finishBIM

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
    startBIM: startBIM || [],
    finishBIM: finishBIM || [],
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
    `${taskRoute}/:taskId/marker`,
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
        const taskSnapshots = await listProgressTaskSnapshotsByTaskIdsFactory({
          db: projectDb
        })({
          projectId,
          taskIds: tasks.map((task) => task.id)
        })

        return res.status(200).json({
          data: serializePlanTasksWithAggregation(tasks, taskSnapshots)
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.put(
    `${taskRoute}/:taskId/marker`,
    progressCors,
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(
      authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({
          getStream: getStreamFactory({ db })
        })
      )
    ),
    validateRequest({ params: taskParamsSchema, body: taskMarkerSchema }),
    async (req, res, next) => {
      try {
        const projectId = req.params.projectId
        if (!req.context.userId) {
          return res.status(401).json({ error: 'Authentication required.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const previousTask = await getProgressPlanTaskFactory({ db: projectDb })({
          projectId,
          taskId: req.params.taskId
        })

        if (!previousTask) {
          return res.status(404).json({ error: 'Progress plan task not found.' })
        }

        const updated = await updateProgressPlanTaskMarkerFactory({ db: projectDb })({
          projectId,
          taskId: req.params.taskId,
          milestoneType: req.body.milestoneType ?? null,
          milestoneDescription: req.body.milestoneDescription ?? null,
          isCriticalTask: req.body.isCriticalTask ?? false,
          updater: req.context.userId
        })

        if (!updated) {
          return res.status(404).json({ error: 'Progress plan task not found.' })
        }

        return res.status(200).json({ data: serializeSinglePlanTask(updated) })
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
        const allTasks = await listProgressPlanTasksFactory({ db: projectDb })({
          projectId
        })
        const hierarchy = buildPlanTaskHierarchy(allTasks)
        const targetNode = hierarchy.nodeMap.get(req.params.taskId)
        if (!targetNode) {
          return res.status(404).json({ error: 'Progress plan task not found.' })
        }
        if (targetNode.hasChildren) {
          return res
            .status(400)
            .json({ error: 'Parent tasks cannot be associated directly.' })
        }

        const updated = await projectDb.transaction(async (trx) => {
          const previousTask = await getProgressPlanTaskFactory({ db: trx })({
            projectId,
            taskId: req.params.taskId
          })
          if (!previousTask) return null

          const nextTask = await updateProgressPlanTaskBimFactory({ db: trx })({
            projectId,
            taskId: req.params.taskId,
            BIM: req.body.BIM,
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

        return res.status(200).json({ data: serializeSinglePlanTask(updated) })
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

        return res.status(200).json({ data: replaced.map(serializeSinglePlanTask) })
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
