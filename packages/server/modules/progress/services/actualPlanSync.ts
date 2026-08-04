import type { Knex } from 'knex'
import {
  listProgressActualRecordsFactory,
  type ProgressActualRecord
} from '@/modules/progress/repositories/progressActualRecords'
import {
  listProgressMonthlyPlansFactory,
  type MonthlyPlanTaskRecord
} from '@/modules/progress/repositories/progressMonthlyPlans'
import {
  listProgressPlanTasksByIdsFactory,
  updateProgressPlanTaskBimFactory,
  type ProgressPlanTaskRecord
} from '@/modules/progress/repositories/progressPlanTasks'
import { syncPlanTaskDerivedDataFactory } from '@/modules/progress/services/snapshotSync'

type SelectionGroup = {
  modelId: string
  applicationIds: string[]
}

type ActualRecordTaskPayload = {
  linkedPlanTaskId?: string | null
  completedVolume?: string | number | null
  selections?: SelectionGroup[] | null
}

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const uniqueStrings = (values: unknown[]) => {
  const seen = new Set<string>()
  return values.reduce<string[]>((acc, value) => {
    const normalized = normalizeString(value)
    if (!normalized || seen.has(normalized)) return acc
    seen.add(normalized)
    acc.push(normalized)
    return acc
  }, [])
}

const parseNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

const formatVolume = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return '0'
  const normalized = Number(value.toFixed(4))
  return Number.isInteger(normalized) ? String(normalized) : String(normalized)
}

const parseJsonArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

const normalizeSelections = (value: unknown): SelectionGroup[] => {
  const modelMap = new Map<string, Set<string>>()

  parseJsonArray<SelectionGroup>(value).forEach((entry) => {
    const modelId = normalizeString(entry?.modelId)
    const applicationIds = uniqueStrings(entry?.applicationIds || [])
    if (!modelId || !applicationIds.length) return

    const existing = modelMap.get(modelId) || new Set<string>()
    applicationIds.forEach((applicationId) => existing.add(applicationId))
    modelMap.set(modelId, existing)
  })

  return [...modelMap.entries()].map(([modelId, applicationIds]) => ({
    modelId,
    applicationIds: [...applicationIds]
  }))
}

const countSelections = (selections: SelectionGroup[]) =>
  selections.reduce((sum, item) => sum + item.applicationIds.length, 0)

const buildTaskKey = (yearMonth: string, linkedPlanTaskId: string) =>
  `${yearMonth}::${linkedPlanTaskId}`

const getRecordYearMonth = (record: ProgressActualRecord) =>
  normalizeString(record.yearMonth) || normalizeString(record.reportDate).slice(0, 7)

const getRecordTasks = (record: ProgressActualRecord) =>
  parseJsonArray<ActualRecordTaskPayload>(record.tasks)

const getMonthlyTaskSelections = (task: MonthlyPlanTaskRecord) =>
  normalizeSelections(task.selections)

const getActualRecordLinkedTaskIds = (record?: ProgressActualRecord | null) => {
  if (!record) return []
  return uniqueStrings(getRecordTasks(record).map((task) => task?.linkedPlanTaskId))
}

const getMonthlyTaskProgressPercent = (params: {
  actualVolume: number
  plannedVolume: string | null
  totalVolume: string | null
}) => {
  const denominator = parseNumber(params.plannedVolume) || parseNumber(params.totalVolume)
  if (denominator <= 0) return 0
  return Math.max(0, Math.round((params.actualVolume / denominator) * 100))
}

export const syncMonthlyPlanProgressFromActualFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    actorId: string
    affectedYearMonths?: string[]
    affectedPlanTaskIds?: string[]
  }): Promise<void> => {
    const yearMonthFilter = new Set(uniqueStrings(params.affectedYearMonths || []))
    const planTaskIdFilter = new Set(uniqueStrings(params.affectedPlanTaskIds || []))

    if (params.affectedYearMonths && !yearMonthFilter.size) return
    if (params.affectedPlanTaskIds && !planTaskIdFilter.size) return

    const [monthlyPlans, actualRecords] = await Promise.all([
      listProgressMonthlyPlansFactory({ db: deps.db })({ projectId: params.projectId }),
      listProgressActualRecordsFactory({ db: deps.db })({ projectId: params.projectId })
    ])

    const aggregatedActuals = new Map<
      string,
      {
        actualVolume: number
        selections: SelectionGroup[]
      }
    >()

    actualRecords.forEach((record) => {
      const yearMonth = getRecordYearMonth(record)
      if (!yearMonth) return
      if (yearMonthFilter.size && !yearMonthFilter.has(yearMonth)) return

      getRecordTasks(record).forEach((task) => {
        const linkedPlanTaskId = normalizeString(task?.linkedPlanTaskId)
        if (!linkedPlanTaskId) return
        if (planTaskIdFilter.size && !planTaskIdFilter.has(linkedPlanTaskId)) return

        const key = buildTaskKey(yearMonth, linkedPlanTaskId)
        const existing = aggregatedActuals.get(key) || {
          actualVolume: 0,
          selections: []
        }

        existing.actualVolume += parseNumber(task?.completedVolume)
        existing.selections = normalizeSelections([
          ...existing.selections,
          ...normalizeSelections(task?.selections)
        ])

        aggregatedActuals.set(key, existing)
      })
    })

    const monthlyTasksToSync = monthlyPlans.flatMap((plan) =>
      (plan.tasks || [])
        .filter((task) => {
          const linkedPlanTaskId = normalizeString(task.linkedPlanTaskId)
          if (!linkedPlanTaskId) return false
          if (yearMonthFilter.size && !yearMonthFilter.has(plan.yearMonth)) return false
          if (planTaskIdFilter.size && !planTaskIdFilter.has(linkedPlanTaskId)) return false
          return true
        })
        .map((task) => ({ planYearMonth: plan.yearMonth, task }))
    )

    if (!monthlyTasksToSync.length) return

    const monthlyPlanSelectionsByTaskId = new Map<string, SelectionGroup[]>()
    const recomputedSelectionsByMonthlyTaskId = new Map<string, SelectionGroup[]>()
    const affectedPlanTaskIds = new Set<string>()

    for (const { planYearMonth, task } of monthlyTasksToSync) {
      const linkedPlanTaskId = normalizeString(task.linkedPlanTaskId)
      if (!linkedPlanTaskId) continue

      const aggregate = aggregatedActuals.get(buildTaskKey(planYearMonth, linkedPlanTaskId))
      const selections = aggregate?.selections || []
      const actualVolume = aggregate?.actualVolume || 0
      const progressPercent = getMonthlyTaskProgressPercent({
        actualVolume,
        plannedVolume: task.plannedVolume,
        totalVolume: task.totalVolume
      })
      const bimComponentCount = countSelections(selections)
      recomputedSelectionsByMonthlyTaskId.set(task.id, selections)

      await deps.db('project_progress_monthly_plan_tasks')
        .where({ id: task.id })
        .update({
          actualVolume: formatVolume(actualVolume),
          progressPercent,
          bimComponentCount,
          bimLinked: bimComponentCount > 0,
          selections: selections.length ? JSON.stringify(selections) : null,
          updatedAt: deps.db.fn.now()
        })

      affectedPlanTaskIds.add(linkedPlanTaskId)
    }

    if (!affectedPlanTaskIds.size) return

    monthlyPlans.forEach((plan) => {
      ;(plan.tasks || []).forEach((task) => {
        const linkedPlanTaskId = normalizeString(task.linkedPlanTaskId)
        if (!linkedPlanTaskId || !affectedPlanTaskIds.has(linkedPlanTaskId)) return

        const taskSelections =
          recomputedSelectionsByMonthlyTaskId.get(task.id) || getMonthlyTaskSelections(task)
        const existing = monthlyPlanSelectionsByTaskId.get(linkedPlanTaskId) || []
        monthlyPlanSelectionsByTaskId.set(
          linkedPlanTaskId,
          normalizeSelections([...existing, ...taskSelections])
        )
      })
    })

    const taskIds = [...affectedPlanTaskIds]
    const previousPlanTasks = await listProgressPlanTasksByIdsFactory({ db: deps.db })({
      projectId: params.projectId,
      taskIds
    })

    for (const taskId of taskIds) {
      const selections = monthlyPlanSelectionsByTaskId.get(taskId) || []
      await updateProgressPlanTaskBimFactory({ db: deps.db })({
        projectId: params.projectId,
        taskId,
        BIM: selections.length
          ? selections.map((entry) => ({
              modelId: entry.modelId,
              applicationIds: entry.applicationIds,
              bimIds: entry.applicationIds.map(() => null)
            }))
          : null,
        updater: params.actorId
      })
    }

    const nextPlanTasks = await listProgressPlanTasksByIdsFactory({ db: deps.db })({
      projectId: params.projectId,
      taskIds
    })

    const previousTaskMap = new Map(previousPlanTasks.map((task) => [task.id, task]))
    const nextTaskMap = new Map(nextPlanTasks.map((task) => [task.id, task]))
    const syncPreviousTasks: ProgressPlanTaskRecord[] = []
    const syncNextTasks: ProgressPlanTaskRecord[] = []

    taskIds.forEach((taskId) => {
      const previousTask = previousTaskMap.get(taskId)
      const nextTask = nextTaskMap.get(taskId)
      if (!previousTask || !nextTask) return

      syncPreviousTasks.push(previousTask)
      syncNextTasks.push(nextTask)
    })

    if (!syncNextTasks.length) return

    await syncPlanTaskDerivedDataFactory({ db: deps.db })({
      projectId: params.projectId,
      previousTasks: syncPreviousTasks,
      nextTasks: syncNextTasks,
      actorId: params.actorId
    })
  }

export const collectActualSyncScope = (params: {
  previousRecord?: ProgressActualRecord | null
  nextRecord?: ProgressActualRecord | null
}) => {
  const affectedYearMonths = uniqueStrings(
    [params.previousRecord, params.nextRecord]
      .filter((record): record is ProgressActualRecord => !!record)
      .map(getRecordYearMonth)
  )

  const affectedPlanTaskIds = uniqueStrings([
    ...getActualRecordLinkedTaskIds(params.previousRecord),
    ...getActualRecordLinkedTaskIds(params.nextRecord)
  ])

  return { affectedYearMonths, affectedPlanTaskIds }
}
