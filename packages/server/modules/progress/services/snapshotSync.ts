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
  ProgressActualRecordBimElements,
  ProgressActualRecordBimSelection
} from '@/modules/progress/repositories/progressActualRecords'
import { listProgressActualRecordsFactory } from '@/modules/progress/repositories/progressActualRecords'
import {
  listProgressPlanTasksFactory,
  listProgressPlanTasksByIdsFactory,
  type ProgressPlanTaskBimSelection,
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

const extractElementRefsFromSelections = <
  TSelection extends ProgressPlanTaskBimSelection | ProgressActualRecordBimSelection
>(
  selections?: TSelection[] | null
): ProgressElementRef[] =>
  uniqueElementRefs(
    (Array.isArray(selections) ? selections : []).flatMap((selection) =>
      uniqueStrings(selection.applicationIds || []).map((applicationId) => ({
        modelId: selection.modelId,
        applicationId
      }))
    )
  )

const extractElementRefsFromActualBimElements = (
  bimElements?: ProgressActualRecordBimElements | null
) => extractElementRefsFromSelections(bimElements?.selections)

export const extractElementRefsFromPlanTask = (
  task: ProgressPlanTaskRecord
): ProgressElementRef[] =>
  extractElementRefsFromSelections(task.bimElements?.selections)

export const extractElementRefsFromActualRecord = (
  record: ProgressActualRecord
): ProgressElementRef[] =>
  uniqueElementRefs([
    ...extractElementRefsFromActualBimElements(
      record.startBimElements || record.bimElements
    ),
    ...extractElementRefsFromActualBimElements(record.finishBimElements)
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
  const startElements = extractElementRefsFromActualBimElements(
    record.startBimElements || record.bimElements
  )
  const finishElements = extractElementRefsFromActualBimElements(
    record.finishBimElements
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
    if (!params.plannedFinishAt) return 'finished_on_time'

    const actualTime = params.actualFinishAt.getTime()
    const plannedTime = params.plannedFinishAt.getTime()
    if (actualTime < plannedTime) return 'finished_ahead'
    if (actualTime === plannedTime) return 'finished_on_time'
    return 'finished_delayed'
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

export const rebuildProgressTaskSnapshotsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskIds: string[]
    actorId: string
  }): Promise<void> => {
    const taskIds = uniqueStrings(params.taskIds)
    if (!taskIds.length) return

    const [tasks, taskElements] = await Promise.all([
      listProgressPlanTasksByIdsFactory({ db: deps.db })({
        projectId: params.projectId,
        taskIds
      }),
      listProgressTaskElementsByTaskIdsFactory({ db: deps.db })({
        projectId: params.projectId,
        taskIds
      })
    ])

    const tasksById = new Map(tasks.map((task) => [task.id, task]))
    const taskElementsByTaskId = new Map<string, typeof taskElements>()

    taskElements.forEach((row) => {
      const existing = taskElementsByTaskId.get(row.taskId) || []
      existing.push(row)
      taskElementsByTaskId.set(row.taskId, existing)
    })

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

    const snapshotPayload = [] as Parameters<
      ReturnType<typeof upsertProgressTaskSnapshotsFactory>
    >[0]['snapshots']
    const missingTaskIds = taskIds.filter((taskId) => !tasksById.has(taskId))
    const now = new Date()

    taskIds.forEach((taskId) => {
      const task = tasksById.get(taskId)
      if (!task) return

      const taskRows = taskElementsByTaskId.get(taskId) || []
      if (!taskRows.length) {
        snapshotPayload.push({
          taskId,
          totalElementCount: 0,
          finishedElementCount: 0,
          inProgressElementCount: 0,
          notStartedElementCount: 0,
          delayedElementCount: 0,
          completionRate: 0,
          plannedStartAt: task.planStart,
          plannedFinishAt: task.planEnd,
          actualStartAt: null,
          actualFinishAt: null,
          taskStatus: 'no_bim_link',
          lastCalculatedAt: now
        })
        return
      }

      const linkedSnapshots = taskRows.map((row) =>
        elementSnapshotsByKey.get(
          elementRefKey({ modelId: row.modelId, applicationId: row.applicationId })
        )
      )

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
      const totalElementCount = taskRows.length

      snapshotPayload.push({
        taskId,
        totalElementCount,
        finishedElementCount,
        inProgressElementCount,
        notStartedElementCount,
        delayedElementCount,
        completionRate: totalElementCount
          ? Number(((finishedElementCount / totalElementCount) * 100).toFixed(2))
          : 0,
        plannedStartAt: task.planStart,
        plannedFinishAt: task.planEnd,
        actualStartAt,
        actualFinishAt,
        taskStatus: resolveTaskStatus({
          totalElementCount,
          finishedElementCount,
          inProgressElementCount,
          plannedFinishAt: task.planEnd,
          actualFinishAt,
          now
        }),
        lastCalculatedAt: now
      })
    })

    if (missingTaskIds.length) {
      await deleteProgressTaskSnapshotsByTaskIdsFactory({ db: deps.db })({
        projectId: params.projectId,
        taskIds: missingTaskIds
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
