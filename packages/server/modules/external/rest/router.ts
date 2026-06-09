import crypto from 'crypto'
import { Router, type RequestHandler } from 'express'
import { db } from '@/db/knex'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { getBlobMetadataFactory } from '@/modules/blobstorage/repositories'
import { getFileStreamFactory } from '@/modules/blobstorage/services/management'
import { getObjectStreamFactory } from '@/modules/blobstorage/repositories/blobs'
import {
  listProgressPlanTasksFactory,
  type ProgressPlanTaskRecord
} from '@/modules/progress/repositories/progressPlanTasks'
import {
  listProgressTaskSnapshotsFactory,
  type ProgressTaskSnapshotRecord,
  type ProgressTaskSnapshotStatus
} from '@/modules/progress/repositories/progressTaskSnapshots'
import { listProgressActualRecordsFactory } from '@/modules/progress/repositories/progressActualRecords'
import {
  getQualityAcceptanceFormsFactory,
  countQualityAcceptanceFormsFactory
} from '@/modules/quality-acceptance-form/repositories/qualityAcceptanceForms'
import { normalizeBIM } from '@/modules/quality-acceptance-form/services/qualityAcceptanceForms'
import { getSessionSecret } from '@/modules/shared/helpers/envHelper'
import contentDisposition from 'content-disposition'

const requireExternalToken: RequestHandler = (req, res, next) => {
  const configuredToken = process.env.EXTERNAL_API_TOKEN
  if (!configuredToken) {
    return res.status(500).json({
      error: 'EXTERNAL_API_TOKEN is not configured on the server.'
    })
  }

  const token = req.headers['x-external-token'] || req.query.token

  if (!token || token !== configuredToken) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing external API token.'
    })
  }

  next()
}

// ==========================================
// 附件 24 小时限时签名链接生成
// ==========================================
const generatePresignedDownloadUrl = (
  req: any,
  projectId: string,
  blobId: string
): string => {
  const expires = Date.now() + 24 * 60 * 60 * 1000 // 24小时后过期
  const secret = getSessionSecret()
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${projectId}:${blobId}:${expires}`)
    .digest('hex')

  const origin = `${req.protocol}://${req.get('host')}`
  return `${origin}/api/v1/external/projects/${projectId}/blobs/${blobId}?expires=${expires}&signature=${signature}`
}

// ==========================================
// 进度计划树状加权聚合辅助逻辑
// ==========================================
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

// ==========================================
// 实际进度序列化辅助逻辑
// ==========================================
const buildWeekDay = (reportDate: string) => {
  const match = reportDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''

  const [, year, month, day] = match
  const date = new Date(Number(year), Math.max(0, Number(month) - 1), Number(day))
  const dayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return Number.isNaN(date.getTime()) ? '' : dayMap[date.getDay()]
}

const serializeActualRecord = (record: any) => {
  const [year = '', month = '', day = ''] = (record.reportDate || '').split('-')
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
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt
  }
}

// ==========================================
// 外部 REST API 路由器工厂
// ==========================================
export const externalRouterFactory = (): Router => {
  const app = Router()
  const getStream = getStreamFactory({ db })

  // 1. 获取项目基本信息
  app.get('/api/v1/external/projects/:projectId', requireExternalToken, async (req, res) => {
    const { projectId } = req.params
    const project = await getStream({ streamId: projectId })
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' })
    }

    return res.status(200).json({
      id: project.id,
      name: project.name,
      description: project.description,
      isPublic: project.visibility === 'public',
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    })
  })

  // 2. 获取进度计划数据
  app.get(
    '/api/v1/external/projects/:projectId/progress/plan-tasks',
    requireExternalToken,
    async (req, res) => {
      const { projectId } = req.params
      const project = await getStream({ streamId: projectId })
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' })
      }

      const projectDb = await getProjectDbClient({ projectId })
      const [tasks, snapshots] = await Promise.all([
        listProgressPlanTasksFactory({ db: projectDb })({ projectId }),
        listProgressTaskSnapshotsFactory({ db: projectDb })({ projectId })
      ])

      const serializedTasks = serializePlanTasksWithAggregation(tasks, snapshots)
      return res.status(200).json({
        projectId,
        planTasks: serializedTasks
      })
    }
  )

  // 3. 获取实际进度数据
  app.get(
    '/api/v1/external/projects/:projectId/progress/actual-records',
    requireExternalToken,
    async (req, res) => {
      const { projectId } = req.params
      const project = await getStream({ streamId: projectId })
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' })
      }

      const projectDb = await getProjectDbClient({ projectId })
      const records = await listProgressActualRecordsFactory({ db: projectDb })({ projectId })

      return res.status(200).json({
        projectId,
        actualRecords: records.map(serializeActualRecord)
      })
    }
  )

  // 4. 获取质量验收数据
  app.get(
    '/api/v1/external/projects/:projectId/quality-acceptance/forms',
    requireExternalToken,
    async (req, res) => {
      const { projectId } = req.params
      const project = await getStream({ streamId: projectId })
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' })
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 25
      const cursor = req.query.cursor ? String(req.query.cursor) : null
      const search = req.query.search ? String(req.query.search) : null

      const projectDb = await getProjectDbClient({ projectId })
      const [formsResult, totalCount] = await Promise.all([
        getQualityAcceptanceFormsFactory({ db: projectDb })({
          projectId,
          cursor,
          limit,
          search
        }),
        countQualityAcceptanceFormsFactory({ db: projectDb })({
          projectId,
          search
        })
      ])

      const items = formsResult.items.map((form) => {
        // 处理附件：将附件 ID 转换为有时效性的绝对下载链接
        const attachments = (form.attachments || []).map((blobId) =>
          generatePresignedDownloadUrl(req, projectId, blobId)
        )

        return {
          id: form.id,
          projectId: form.project_id,
          boqItemId: form.boqItemId,
          name: form.name,
          code: form.code,
          inspectionLotNumber: form.inspectionLotNumber,
          acceptancePart: form.acceptancePart,
          acceptanceContent: form.acceptanceContent,
          actualStartDate: form.actualStartDate,
          actualFinishDate: form.actualFinishDate,
          inspectorId: form.inspector,
          creatorId: form.creator,
          workVolume: form.workVolume,
          unit: form.unit,
          BIM: normalizeBIM(form.BIM, form.BIMelement),
          approveStatus: form.approveStatus,
          attachments,
          createdAt: form.createdAt.toISOString(),
          updatedAt: form.updatedAt.toISOString()
        }
      })

      return res.status(200).json({
        totalCount,
        cursor: formsResult.cursor,
        items
      })
    }
  )

  // 5. 24小时时效性附件下载端点
  app.get(
    '/api/v1/external/projects/:projectId/blobs/:blobId',
    async (req, res) => {
      const { projectId, blobId } = req.params
      const { expires, signature } = req.query

      if (!expires || !signature) {
        return res.status(400).json({
          error: 'Missing expiration or signature parameters.'
        })
      }

      const expiresTime = parseInt(String(expires), 10)
      if (Date.now() > expiresTime) {
        return res.status(410).json({
          error: 'Download link has expired.'
        })
      }

      const secret = getSessionSecret()
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${projectId}:${blobId}:${expires}`)
        .digest('hex')

      if (signature !== expectedSignature) {
        return res.status(403).json({
          error: 'Forbidden: Invalid signature.'
        })
      }

      // 获取对象存储和文件流
      const [projectDb, projectStorage] = await Promise.all([
        getProjectDbClient({ projectId }),
        getProjectObjectStorage({ projectId })
      ])

      const getBlobMetadata = getBlobMetadataFactory({ db: projectDb })
      const getFileStream = getFileStreamFactory({ getBlobMetadata })
      const getObjectStream = getObjectStreamFactory({
        storage: projectStorage.private
      })

      try {
        const metadata = await getBlobMetadata({
          streamId: projectId,
          blobId
        })

        if (!metadata) {
          return res.status(404).json({
            error: 'File not found.'
          })
        }

        const fileStream = await getFileStream({
          getObjectStream,
          streamId: projectId,
          blobId
        })

        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': contentDisposition(metadata.fileName)
        })
        fileStream.pipe(res)
      } catch (err) {
        req.log.error(err, 'Failed to fetch blob file stream for external API.')
        return res.status(500).json({
          error: 'Failed to retrieve file from storage.'
        })
      }
    }
  )

  return app
}
