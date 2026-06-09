import {
  deleteAllProgressActualElementEventsFactory,
  listProgressActualElementEventsByElementsFactory,
  replaceProgressActualElementEventsForRecordFactory,
  type ProgressActualElementEventType,
  type UpsertProgressActualElementEventInput
} from '@/modules/progress/repositories/progressActualElementEvents'
import {
  deleteAllProgressElementSnapshotsFactory,
  deleteProgressElementSnapshotsByElementsFactory,
  upsertProgressElementSnapshotsFactory,
  type ProgressElementSnapshotStatus,
  listProgressElementSnapshotsByElementsFactory
} from '@/modules/progress/repositories/progressElementSnapshots'
import {
  deleteAllProgressTaskSnapshotsFactory,
  deleteProgressTaskSnapshotsByTaskIdsFactory,
  upsertProgressTaskSnapshotsFactory,
  type ProgressTaskSnapshotStatus
} from '@/modules/progress/repositories/progressTaskSnapshots'
import {
  deleteAllProgressTaskElementsFactory,
  listProgressTaskElementsByElementsFactory,
  listProgressTaskElementsByTaskIdsFactory,
  listDistinctTaskIdsByElementsFactory,
  replaceProgressTaskElementsFactory,
  type ProgressElementRef,
  type UpsertProgressTaskElementInput
} from '@/modules/progress/repositories/progressTaskElements'
import type {
  ProgressActualRecord,
  ProgressActualRecordBIM
} from '@/modules/progress/repositories/progressActualRecords'
import { listProgressActualRecordsFactory } from '@/modules/progress/repositories/progressActualRecords'
import {
  listProgressPlanTasksFactory,
  listProgressPlanTasksByIdsFactory,
  type ProgressPlanTaskRecord
} from '@/modules/progress/repositories/progressPlanTasks'
import type { Knex } from 'knex'

const uniqueStrings = (values: string[]) => [...new Set(values.filter(Boolean))]

const elementRefKey = (element: ProgressElementRef) =>
  `${element.modelId}::${element.applicationId}`

const uniqueElementRefs = (elements: ProgressElementRef[]) => {
  const map = new Map<string, ProgressElementRef>()
  for (const element of elements) {
    if (!element.modelId || !element.applicationId) continue
    map.set(elementRefKey(element), element)
  }

  return [...map.values()]
}

const toDateFromReportDate = (reportDate: string) =>
  new Date(`${reportDate}T00:00:00.000Z`)

const compareAsc = (left: Date, right: Date) => left.getTime() - right.getTime()

const minDate = (dates: Array<Date | null | undefined>) => {
  const filtered = dates.filter((date): date is Date => !!date)
  if (!filtered.length) return null
  return [...filtered].sort(compareAsc)[0] || null
}

const maxDate = (dates: Array<Date | null | undefined>) => {
  const filtered = dates.filter((date): date is Date => !!date)
  if (!filtered.length) return null
  return [...filtered].sort(compareAsc)[filtered.length - 1] || null
}

const extractElementRefsFromBIM = (
  bim?: ProgressActualRecordBIM | null
): ProgressElementRef[] =>
  uniqueElementRefs(
    (Array.isArray(bim) ? bim : []).flatMap((entry) =>
      uniqueStrings(entry.applicationIds || []).map((applicationId) => ({
        modelId: entry.modelId,
        applicationId
      }))
    )
  )

export const extractElementRefsFromPlanTask = (
  task: ProgressPlanTaskRecord
): ProgressElementRef[] =>
  uniqueElementRefs(
    (Array.isArray(task.BIM) ? task.BIM : []).flatMap((entry) =>
      uniqueStrings(entry.applicationIds || []).map((applicationId) => ({
        modelId: entry.modelId,
        applicationId
      }))
    )
  )

export const extractElementRefsFromActualRecord = (
  record: ProgressActualRecord
): ProgressElementRef[] =>
  uniqueElementRefs([
    ...extractElementRefsFromBIM(record.startBIM || record.BIM),
    ...extractElementRefsFromBIM(record.finishBIM)
  ])

const buildTaskElementInputs = (
  task: ProgressPlanTaskRecord
): UpsertProgressTaskElementInput[] => {
  return extractElementRefsFromPlanTask(task).map((element) => ({
    taskId: task.id,
    modelId: element.modelId,
    applicationId: element.applicationId,
    planStart: task.planStart,
    planEnd: task.planEnd
  }))
}

const buildActualElementEventInputs = (
  record: ProgressActualRecord
): UpsertProgressActualElementEventInput[] => {
  const eventAt = toDateFromReportDate(record.reportDate)
  const startElements = extractElementRefsFromBIM(
    record.startBIM || record.BIM
  )
  const finishElements = extractElementRefsFromBIM(
    record.finishBIM
  )

  const toEvents = (
    elements: ProgressElementRef[],
    eventType: ProgressActualElementEventType
  ): UpsertProgressActualElementEventInput[] =>
    elements.map((element) => ({
      modelId: element.modelId,
      applicationId: element.applicationId,
      eventType,
      eventAt,
      reportDate: record.reportDate
    }))

  return [...toEvents(startElements, 'start'), ...toEvents(finishElements, 'finish')]
}

const resolveElementProgressStatus = (params: {
  plannedStartAt: Date | null
  plannedFinishAt: Date | null
  actualStartAt: Date | null
  actualFinishAt: Date | null
  now: Date
}): ProgressElementSnapshotStatus => {
  if (params.actualFinishAt) {
    const actualTime = params.actualFinishAt.getTime()

    if (
      params.plannedStartAt &&
      actualTime < params.plannedStartAt.getTime()
    ) {
      return 'finished_ahead'
    }

    if (
      params.plannedFinishAt &&
      actualTime > params.plannedFinishAt.getTime()
    ) {
      return 'finished_delayed'
    }

    return 'finished_on_time'
  }

  if (params.actualStartAt) {
    if (
      params.plannedFinishAt &&
      params.now.getTime() > params.plannedFinishAt.getTime()
    ) {
      return 'in_progress_delayed'
    }

    return 'in_progress'
  }

  if (!params.plannedStartAt && !params.plannedFinishAt) {
    return 'not_started'
  }

  if (params.plannedStartAt && params.now.getTime() < params.plannedStartAt.getTime()) {
    return 'not_started'
  }

  if (
    params.plannedFinishAt &&
    params.now.getTime() > params.plannedFinishAt.getTime()
  ) {
    return 'delayed_not_started'
  }

  return 'ready_not_started'
}

const resolveTaskStatus = (params: {
  totalElementCount: number
  finishedElementCount: number
  inProgressElementCount: number
  plannedFinishAt: Date | null
  actualFinishAt: Date | null
  now: Date
}): ProgressTaskSnapshotStatus => {
  if (params.totalElementCount === 0) return 'no_bim_link'
  if (params.finishedElementCount === params.totalElementCount) {
    if (
      params.plannedFinishAt &&
      params.actualFinishAt &&
      params.actualFinishAt.getTime() > params.plannedFinishAt.getTime()
    ) {
      return 'finished_delayed'
    }
    return 'finished_on_time'
  }

  if (params.finishedElementCount === 0 && params.inProgressElementCount === 0) {
    return 'not_started'
  }

  if (
    params.plannedFinishAt &&
    params.now.getTime() > params.plannedFinishAt.getTime()
  ) {
    return 'delayed'
  }

  return 'in_progress'
}

export const rebuildProgressElementSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    elements: ProgressElementRef[]
    actorId: string
  }): Promise<void> => {
    const elements = uniqueElementRefs(params.elements)
    if (!elements.length) return

    const [taskElements, actualEvents] = await Promise.all([
      listProgressTaskElementsByElementsFactory({ db: deps.db })({
        projectId: params.projectId,
        elements
      }),
      listProgressActualElementEventsByElementsFactory({ db: deps.db })({
        projectId: params.projectId,
        elements
      })
    ])

    const taskElementsByKey = new Map<string, typeof taskElements>()
    const actualEventsByKey = new Map<string, typeof actualEvents>()

    taskElements.forEach((element) => {
      const key = elementRefKey(element)
      const existing = taskElementsByKey.get(key) || []
      existing.push(element)
      taskElementsByKey.set(key, existing)
    })

    actualEvents.forEach((event) => {
      const key = elementRefKey(event)
      const existing = actualEventsByKey.get(key) || []
      existing.push(event)
      actualEventsByKey.set(key, existing)
    })

    const snapshots = [] as Parameters<
      ReturnType<typeof upsertProgressElementSnapshotsFactory>
    >[0]['snapshots']
    const staleElements: ProgressElementRef[] = []

    elements.forEach((element) => {
      const key = elementRefKey(element)
      const elementTaskElements = taskElementsByKey.get(key) || []
      const elementEvents = actualEventsByKey.get(key) || []

      if (!elementTaskElements.length && !elementEvents.length) {
        staleElements.push(element)
        return
      }

      const plannedStartAt = minDate(elementTaskElements.map((row) => row.planStart))
      const plannedFinishAt = maxDate(elementTaskElements.map((row) => row.planEnd))
      const actualStartAt = minDate(
        elementEvents
          .filter((event) => event.eventType === 'start')
          .map((event) => event.eventAt)
      )
      const actualFinishAt = maxDate(
        elementEvents
          .filter((event) => event.eventType === 'finish')
          .map((event) => event.eventAt)
      )
      const lastReportAt = maxDate(elementEvents.map((event) => event.eventAt))
      const progressStatus = resolveElementProgressStatus({
        plannedStartAt,
        plannedFinishAt,
        actualStartAt,
        actualFinishAt,
        now: new Date()
      })

      snapshots.push({
        modelId: element.modelId,
        applicationId: element.applicationId,
        plannedStartAt,
        plannedFinishAt,
        actualStartAt,
        actualFinishAt,
        progressStatus,
        progressPercent:
          progressStatus === 'not_started' ||
          progressStatus === 'ready_not_started' ||
          progressStatus === 'delayed_not_started'
            ? 0
            : progressStatus === 'in_progress' ||
              progressStatus === 'in_progress_delayed'
            ? 50
            : 100,
        isAheadStart:
          !!plannedStartAt &&
          !!actualStartAt &&
          actualStartAt.getTime() < plannedStartAt.getTime(),
        isDelayedFinish:
          !!plannedFinishAt &&
          !!actualFinishAt &&
          actualFinishAt.getTime() > plannedFinishAt.getTime(),
        lastReportAt
      })
    })

    if (staleElements.length) {
      await deleteProgressElementSnapshotsByElementsFactory({ db: deps.db })({
        projectId: params.projectId,
        elements: staleElements
      })
    }

    if (snapshots.length) {
      await upsertProgressElementSnapshotsFactory({ db: deps.db })({
        projectId: params.projectId,
        actorId: params.actorId,
        snapshots
      })
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

const resolveAggregatedTaskStatus = (aggregate: {
  totalTaskCount: number
  finishedTaskCount: number
  inProgressTaskCount: number
  notStartedTaskCount: number
  noBimLinkTaskCount: number
  finishedDelayedTaskCount: number
  delayedTaskCount: number
  taskStatus: ProgressTaskSnapshotStatus | null
}): ProgressTaskSnapshotStatus | null => {
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

export const rebuildProgressTaskSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskIds: string[]
    actorId: string
  }): Promise<void> => {
    // 无论 taskIds 是什么，为了保证层级聚合正确，查询项目下的所有任务
    const allTasks = await listProgressPlanTasksFactory({ db: deps.db })({
      projectId: params.projectId
    })

    if (!allTasks.length) return

    // 建立树形层次结构
    const orderedTasks = [...allTasks].sort((left, right) => {
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

    type TaskNodeAggregate = {
      totalElementCount: number
      finishedElementCount: number
      inProgressElementCount: number
      notStartedElementCount: number
      delayedElementCount: number
      completionRate: number
      taskStatus: ProgressTaskSnapshotStatus
      totalTaskCount: number
      linkedTaskCount: number
      finishedTaskCount: number
      delayedTaskCount: number
      inProgressTaskCount: number
      notStartedTaskCount: number
      noBimLinkTaskCount: number
      finishedDelayedTaskCount: number
      actualStartAt: Date | null
      actualFinishAt: Date | null
    }

    type TaskNode = {
      task: ProgressPlanTaskRecord
      resolvedParentId: string | null
      level: number
      children: TaskNode[]
      hasChildren: boolean
      aggregate?: TaskNodeAggregate
    }

    const nodeMap = new Map<string, TaskNode>(
      orderedTasks.map((task) => [
        task.id,
        {
          task,
          resolvedParentId: null,
          level: getWbsLevel(task.wbs, task.level),
          children: [],
          hasChildren: false
        }
      ])
    )

    const nodeByWbs = new Map(
      orderedTasks.flatMap((task) =>
        task.wbs ? [[task.wbs, nodeMap.get(task.id)!] as const] : []
      )
    )

    const rootNodes: TaskNode[] = []
    orderedTasks.forEach((task) => {
      const node = nodeMap.get(task.id)
      if (!node) return

      const wbsParent = getParentWbs(task.wbs)
      const parent = task.wbs
        ? wbsParent
          ? nodeByWbs.get(wbsParent)
          : undefined
        : task.parentId
        ? nodeMap.get(task.parentId)
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

    // 区分叶子和非叶子
    const leafNodes = [...nodeMap.values()].filter((node) => !node.hasChildren)
    const leafTaskIds = leafNodes.map((node) => node.task.id)

    // 获取叶子节点的关联构件
    const taskElements = await listProgressTaskElementsByTaskIdsFactory({ db: deps.db })({
      projectId: params.projectId,
      taskIds: leafTaskIds
    })

    const taskElementsByTaskId = new Map<string, typeof taskElements>()
    taskElements.forEach((row) => {
      const existing = taskElementsByTaskId.get(row.taskId) || []
      existing.push(row)
      taskElementsByTaskId.set(row.taskId, existing)
    })

    // 获取叶子节点涉及的构件快照
    const elementSnapshots = await listProgressElementSnapshotsByElementsFactory({
      db: deps.db
    })({
      projectId: params.projectId,
      elements: uniqueElementRefs(
        taskElements.map((row) => ({
          modelId: row.modelId,
          applicationId: row.applicationId
        }))
      )
    })
    const elementSnapshotsByKey = new Map(
      elementSnapshots.map((snapshot) => [elementRefKey(snapshot), snapshot])
    )

    const now = new Date()

    // 1. 初始化叶子节点聚合属性
    leafNodes.forEach((node) => {
      const taskId = node.task.id
      const task = node.task
      const taskRows = taskElementsByTaskId.get(taskId) || []

      if (!taskRows.length) {
        node.aggregate = {
          totalElementCount: 0,
          finishedElementCount: 0,
          inProgressElementCount: 0,
          notStartedElementCount: 0,
          delayedElementCount: 0,
          completionRate: 0,
          taskStatus: 'no_bim_link',
          totalTaskCount: 1,
          linkedTaskCount: 0,
          finishedTaskCount: 0,
          delayedTaskCount: 0,
          inProgressTaskCount: 0,
          notStartedTaskCount: 0,
          noBimLinkTaskCount: 1,
          finishedDelayedTaskCount: 0,
          actualStartAt: null,
          actualFinishAt: null
        }
        return
      }

      const linkedSnapshots = taskRows.map((row) =>
        elementSnapshotsByKey.get(
          elementRefKey({ modelId: row.modelId, applicationId: row.applicationId })
        )
      )

      const totalElementCount = taskRows.length
      const finishedElementCount = linkedSnapshots.filter(
        (snapshot) => !!snapshot?.actualFinishAt
      ).length
      const inProgressElementCount = linkedSnapshots.filter(
        (snapshot) =>
          snapshot?.progressStatus === 'in_progress' ||
          snapshot?.progressStatus === 'in_progress_delayed'
      ).length
      const notStartedElementCount = linkedSnapshots.filter(
        (snapshot) =>
          !snapshot ||
          snapshot.progressStatus === 'not_started' ||
          snapshot.progressStatus === 'ready_not_started' ||
          snapshot.progressStatus === 'delayed_not_started'
      ).length
      const delayedElementCount = linkedSnapshots.filter(
        (snapshot) =>
          snapshot?.progressStatus === 'finished_delayed' ||
          snapshot?.progressStatus === 'in_progress_delayed' ||
          snapshot?.progressStatus === 'delayed_not_started'
      ).length
      const actualStartAt = minDate(
        linkedSnapshots.map((snapshot) => snapshot?.actualStartAt)
      )
      const actualFinishAt = maxDate(
        linkedSnapshots.map((snapshot) => snapshot?.actualFinishAt)
      )

      const taskStatus = resolveTaskStatus({
        totalElementCount,
        finishedElementCount,
        inProgressElementCount,
        plannedFinishAt: task.planEnd,
        actualFinishAt,
        now
      })

      node.aggregate = {
        totalElementCount,
        finishedElementCount,
        inProgressElementCount,
        notStartedElementCount,
        delayedElementCount,
        completionRate: totalElementCount
          ? Number(((finishedElementCount / totalElementCount) * 100).toFixed(2))
          : 0,
        taskStatus,
        totalTaskCount: 1,
        linkedTaskCount: 1,
        finishedTaskCount:
          taskStatus === 'finished_on_time' || taskStatus === 'finished_delayed' ? 1 : 0,
        delayedTaskCount: taskStatus === 'delayed' ? 1 : 0,
        inProgressTaskCount: taskStatus === 'in_progress' ? 1 : 0,
        notStartedTaskCount: taskStatus === 'not_started' ? 1 : 0,
        noBimLinkTaskCount: taskStatus === 'no_bim_link' ? 1 : 0,
        finishedDelayedTaskCount: taskStatus === 'finished_delayed' ? 1 : 0,
        actualStartAt,
        actualFinishAt
      }
    })

    // 2. 递归汇总上层节点的聚合属性
    const aggregateNode = (node: TaskNode) => {
      if (!node.hasChildren) return

      node.children.forEach(aggregateNode)

      const agg = node.children.reduce<TaskNodeAggregate>(
        (acc, child) => {
          const childAgg = child.aggregate!
          return {
            totalElementCount: acc.totalElementCount + childAgg.totalElementCount,
            finishedElementCount: acc.finishedElementCount + childAgg.finishedElementCount,
            inProgressElementCount: acc.inProgressElementCount + childAgg.inProgressElementCount,
            notStartedElementCount: acc.notStartedElementCount + childAgg.notStartedElementCount,
            delayedElementCount: acc.delayedElementCount + childAgg.delayedElementCount,
            completionRate: 0,
            taskStatus: 'no_bim_link',
            totalTaskCount: acc.totalTaskCount + childAgg.totalTaskCount,
            linkedTaskCount: acc.linkedTaskCount + childAgg.linkedTaskCount,
            finishedTaskCount: acc.finishedTaskCount + childAgg.finishedTaskCount,
            delayedTaskCount: acc.delayedTaskCount + childAgg.delayedTaskCount,
            inProgressTaskCount: acc.inProgressTaskCount + childAgg.inProgressTaskCount,
            notStartedTaskCount: acc.notStartedTaskCount + childAgg.notStartedTaskCount,
            noBimLinkTaskCount: acc.noBimLinkTaskCount + childAgg.noBimLinkTaskCount,
            finishedDelayedTaskCount: acc.finishedDelayedTaskCount + childAgg.finishedDelayedTaskCount,
            actualStartAt: null,
            actualFinishAt: null
          }
        },
        {
          totalElementCount: 0,
          finishedElementCount: 0,
          inProgressElementCount: 0,
          notStartedElementCount: 0,
          delayedElementCount: 0,
          completionRate: 0,
          taskStatus: 'no_bim_link',
          totalTaskCount: 0,
          linkedTaskCount: 0,
          finishedTaskCount: 0,
          delayedTaskCount: 0,
          inProgressTaskCount: 0,
          notStartedTaskCount: 0,
          noBimLinkTaskCount: 0,
          finishedDelayedTaskCount: 0,
          actualStartAt: null,
          actualFinishAt: null
        }
      )

      agg.actualStartAt = minDate(node.children.map((child) => child.aggregate!.actualStartAt))
      agg.actualFinishAt = maxDate(node.children.map((child) => child.aggregate!.actualFinishAt))

      // 按照子任务时间（计划工期）加权百分比计算：
      // sum(子节点工期 * 子节点进度) / sum(子节点工期)
      let sumWeight = 0
      let sumWeightedRate = 0
      node.children.forEach((child) => {
        const planStart = child.task.planStart ? new Date(child.task.planStart).getTime() : 0
        const planEnd = child.task.planEnd ? new Date(child.task.planEnd).getTime() : 0
        const duration = planStart && planEnd ? planEnd - planStart + 86400000 : 0

        sumWeight += duration
        sumWeightedRate += duration * child.aggregate!.completionRate
      })

      if (sumWeight > 0) {
        agg.completionRate = Number((sumWeightedRate / sumWeight).toFixed(2))
      } else {
        const avg =
          node.children.reduce((acc, child) => acc + child.aggregate!.completionRate, 0) /
          node.children.length
        agg.completionRate = Number(avg.toFixed(2))
      }

      agg.taskStatus = resolveAggregatedTaskStatus(agg) || 'no_bim_link'
      node.aggregate = agg
    }

    rootNodes.forEach(aggregateNode)

    // 准备全量快照写入 Payload
    const snapshotPayload = [...nodeMap.values()].map((node) => {
      const agg = node.aggregate!
      return {
        taskId: node.task.id,
        totalElementCount: agg.totalElementCount,
        finishedElementCount: agg.finishedElementCount,
        inProgressElementCount: agg.inProgressElementCount,
        notStartedElementCount: agg.notStartedElementCount,
        delayedElementCount: agg.delayedElementCount,
        completionRate: agg.completionRate,
        plannedStartAt: node.task.planStart,
        plannedFinishAt: node.task.planEnd,
        actualStartAt: agg.actualStartAt,
        actualFinishAt: agg.actualFinishAt,
        taskStatus: agg.taskStatus,
        lastCalculatedAt: now
      }
    })

    // 清理已被删除任务对应的陈旧快照
    const existingSnapshots = await deps
      .db('project_progress_task_snapshots')
      .where({ projectId: params.projectId })
      .select('taskId')
    const allTaskIdsSet = new Set(allTasks.map((t) => t.id))
    const staleTaskIds = existingSnapshots
      .map((s) => s.taskId)
      .filter((id) => !allTaskIdsSet.has(id))

    if (staleTaskIds.length) {
      await deleteProgressTaskSnapshotsByTaskIdsFactory({ db: deps.db })({
        projectId: params.projectId,
        taskIds: staleTaskIds
      })
    }

    if (snapshotPayload.length) {
      await upsertProgressTaskSnapshotsFactory({ db: deps.db })({
        projectId: params.projectId,
        actorId: params.actorId,
        snapshots: snapshotPayload
      })
    }
  }

export const syncPlanTaskDerivedDataFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    previousTasks: ProgressPlanTaskRecord[]
    nextTasks: ProgressPlanTaskRecord[]
    actorId: string
  }): Promise<void> => {
    const taskIds = uniqueStrings([
      ...params.previousTasks.map((task) => task.id),
      ...params.nextTasks.map((task) => task.id)
    ])
    const nextElements = params.nextTasks.flatMap(buildTaskElementInputs)
    const affectedElements = uniqueElementRefs([
      ...params.previousTasks.flatMap(extractElementRefsFromPlanTask),
      ...params.nextTasks.flatMap(extractElementRefsFromPlanTask)
    ])

    await replaceProgressTaskElementsFactory({ db: deps.db })({
      projectId: params.projectId,
      taskIds,
      elements: nextElements,
      actorId: params.actorId
    })

    if (affectedElements.length) {
      await rebuildProgressElementSnapshotsFactory({ db: deps.db })({
        projectId: params.projectId,
        elements: affectedElements,
        actorId: params.actorId
      })
    }

    const sharedTaskIds = await listDistinctTaskIdsByElementsFactory({ db: deps.db })({
      projectId: params.projectId,
      elements: affectedElements
    })

    await rebuildProgressTaskSnapshotsFactory({ db: deps.db })({
      projectId: params.projectId,
      taskIds: uniqueStrings([...taskIds, ...sharedTaskIds]),
      actorId: params.actorId
    })
  }

export const syncActualRecordDerivedDataFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    previousRecord?: ProgressActualRecord | null
    nextRecord?: ProgressActualRecord | null
    actorId: string
  }): Promise<void> => {
    const recordId = params.nextRecord?.id || params.previousRecord?.id
    if (!recordId) return

    await replaceProgressActualElementEventsForRecordFactory({ db: deps.db })({
      projectId: params.projectId,
      recordId,
      events: params.nextRecord ? buildActualElementEventInputs(params.nextRecord) : [],
      actorId: params.actorId
    })

    const affectedElements = uniqueElementRefs([
      ...(params.previousRecord
        ? extractElementRefsFromActualRecord(params.previousRecord)
        : []),
      ...(params.nextRecord
        ? extractElementRefsFromActualRecord(params.nextRecord)
        : [])
    ])

    if (!affectedElements.length) return

    await rebuildProgressElementSnapshotsFactory({ db: deps.db })({
      projectId: params.projectId,
      elements: affectedElements,
      actorId: params.actorId
    })

    const affectedTaskIds = await listDistinctTaskIdsByElementsFactory({ db: deps.db })(
      {
        projectId: params.projectId,
        elements: affectedElements
      }
    )

    await rebuildProgressTaskSnapshotsFactory({ db: deps.db })({
      projectId: params.projectId,
      taskIds: affectedTaskIds,
      actorId: params.actorId
    })
  }

export const rebuildAllProgressSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    actorId: string
  }): Promise<{
    planTaskCount: number
    actualRecordCount: number
    affectedElementCount: number
    rebuiltTaskSnapshotCount: number
  }> => {
    const [tasks, records] = await Promise.all([
      listProgressPlanTasksFactory({ db: deps.db })({
        projectId: params.projectId
      }),
      listProgressActualRecordsFactory({ db: deps.db })({
        projectId: params.projectId
      })
    ])

    const taskIds = uniqueStrings(tasks.map((task) => task.id))
    const taskElementInputs = tasks.flatMap(buildTaskElementInputs)
    const affectedElements = uniqueElementRefs([
      ...tasks.flatMap(extractElementRefsFromPlanTask),
      ...records.flatMap(extractElementRefsFromActualRecord)
    ])

    await deleteAllProgressTaskSnapshotsFactory({ db: deps.db })({
      projectId: params.projectId
    })
    await deleteAllProgressElementSnapshotsFactory({ db: deps.db })({
      projectId: params.projectId
    })
    await deleteAllProgressActualElementEventsFactory({ db: deps.db })({
      projectId: params.projectId
    })
    await deleteAllProgressTaskElementsFactory({ db: deps.db })({
      projectId: params.projectId
    })

    if (taskIds.length) {
      await replaceProgressTaskElementsFactory({ db: deps.db })({
        projectId: params.projectId,
        taskIds,
        elements: taskElementInputs,
        actorId: params.actorId
      })
    }

    for (const record of records) {
      await replaceProgressActualElementEventsForRecordFactory({ db: deps.db })({
        projectId: params.projectId,
        recordId: record.id,
        events: buildActualElementEventInputs(record),
        actorId: params.actorId
      })
    }

    if (affectedElements.length) {
      await rebuildProgressElementSnapshotsFactory({ db: deps.db })({
        projectId: params.projectId,
        elements: affectedElements,
        actorId: params.actorId
      })
    }

    if (taskIds.length) {
      await rebuildProgressTaskSnapshotsFactory({ db: deps.db })({
        projectId: params.projectId,
        taskIds,
        actorId: params.actorId
      })
    }

    return {
      planTaskCount: tasks.length,
      actualRecordCount: records.length,
      affectedElementCount: affectedElements.length,
      rebuiltTaskSnapshotCount: taskIds.length
    }
  }

export const syncImportedActualRecordsDerivedDataFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    records: ProgressActualRecord[]
    actorId: string
  }): Promise<void> => {
    if (!params.records.length) return

    for (const record of params.records) {
      await replaceProgressActualElementEventsForRecordFactory({ db: deps.db })({
        projectId: params.projectId,
        recordId: record.id,
        events: buildActualElementEventInputs(record),
        actorId: params.actorId
      })
    }

    const affectedElements = uniqueElementRefs(
      params.records.flatMap(extractElementRefsFromActualRecord)
    )

    if (!affectedElements.length) return

    await rebuildProgressElementSnapshotsFactory({ db: deps.db })({
      projectId: params.projectId,
      elements: affectedElements,
      actorId: params.actorId
    })

    const affectedTaskIds = await listDistinctTaskIdsByElementsFactory({ db: deps.db })(
      {
        projectId: params.projectId,
        elements: affectedElements
      }
    )

    await rebuildProgressTaskSnapshotsFactory({ db: deps.db })({
      projectId: params.projectId,
      taskIds: affectedTaskIds,
      actorId: params.actorId
    })
  }
