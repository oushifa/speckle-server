import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressPlanTasks = buildTableHelper(
  'project_progress_plan_tasks',
  [
    'id',
    'projectId',
    'annualPlanId',
    'planFileId',
    'externalId',
    'sysTaskId',
    'quantity',
    'unit',
    'wbs',
    'name',
    'parentId',
    'level',
    'sortOrder',
    'duration',
    'planStart',
    'planEnd',
    'milestoneType',
    'milestoneDescription',
    'isCriticalTask',
    'predecessor',
    'inspectionBatch',
    'BIM',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type BimElementEntry = {
  modelId: string
  applicationIds: string[]
  bimIds: (string | null)[]
}

export type ProgressPlanTaskBIM = BimElementEntry[]

export type ProgressPlanTaskRecord = {
  id: string
  projectId: string
  annualPlanId?: string | null
  planFileId: string | null
  externalId: string | null
  sysTaskId: string | null
  quantity: string | null
  unit: string | null
  wbs: string | null
  name: string
  parentId: string | null
  level: number
  sortOrder: number
  duration: string | null
  planStart: Date | null
  planEnd: Date | null
  milestoneType: ProgressPlanTaskMilestoneType | null
  milestoneDescription: string | null
  isCriticalTask: boolean
  predecessor: string | null
  inspectionBatch: string | null
  BIM: ProgressPlanTaskBIM | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

type ReplaceProgressPlanTaskInput = {
  externalId?: string | null
  sysTaskId?: string | null
  quantity?: string | null
  unit?: string | null
  parentExternalId?: string | null
  wbs?: string | null
  name: string
  level?: number
  sortOrder?: number
  duration?: string | null
  planStart?: string | Date | null
  planEnd?: string | Date | null
  milestoneType?: ProgressPlanTaskMilestoneType | null
  milestoneDescription?: string | null
  isCriticalTask?: boolean
  predecessor?: string | null
  inspectionBatch?: string | null
  BIM?: ProgressPlanTaskBIM | null
}

export type ProgressPlanTaskMilestoneType = 'project' | 'phase' | 'acceptance'

type ProgressPlanTaskMarker = {
  milestoneType: ProgressPlanTaskMilestoneType | null
  milestoneDescription: string | null
  isCriticalTask: boolean
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressPlanTasks: (db: Knex) =>
    db<ProgressPlanTaskRecord>(ProjectProgressPlanTasks.name)
}
const planTaskCols = ProjectProgressPlanTasks.short.col

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

const sanitizeBIM = (
  input?: ProgressPlanTaskBIM | null
): ProgressPlanTaskBIM | null => {
  if (!Array.isArray(input) || input.length === 0) return null

  const normalized = input
    .map((entry) => {
      const modelId = normalizeString(entry?.modelId)
      if (!modelId) return null
      const applicationIds = uniqueStrings(entry?.applicationIds || [])
      if (!applicationIds.length) return null
      const rawBimIds = Array.isArray(entry.bimIds) ? entry.bimIds : []
      const bimIds: (string | null)[] = applicationIds.map((_, idx) => {
        const raw = rawBimIds[idx]
        return typeof raw === 'string' && raw.trim() ? raw.trim() : null
      })
      return { modelId, applicationIds, bimIds }
    })
    .filter((e): e is BimElementEntry => e !== null)

  return normalized.length > 0 ? normalized : null
}

const sanitizeMilestoneType = (
  value?: ProgressPlanTaskMilestoneType | null
): ProgressPlanTaskMilestoneType | null => {
  if (value === 'project' || value === 'phase' || value === 'acceptance') {
    return value
  }

  return null
}

const sanitizeMarker = (
  input?: Partial<ProgressPlanTaskMarker> | null
): ProgressPlanTaskMarker => {
  const milestoneType = sanitizeMilestoneType(input?.milestoneType)
  const milestoneDescription = normalizeString(input?.milestoneDescription)

  return {
    milestoneType,
    milestoneDescription: milestoneType ? milestoneDescription || null : null,
    isCriticalTask: !!input?.isCriticalTask
  }
}

const toNullableDate = (value?: string | Date | null) => {
  if (!value) return null
  if (value instanceof Date) return value

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const listProgressPlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    annualPlanId?: string | null
  }): Promise<ProgressPlanTaskRecord[]> => {
    let query = tables.projectProgressPlanTasks(deps.db).where({
      [ProjectProgressPlanTasks.col.projectId]: params.projectId
    })

    if (params.annualPlanId) {
      query = query.where({ annualPlanId: params.annualPlanId })
    } else {
      query = query.whereNull('annualPlanId')
    }

    return await query
      .orderBy(ProjectProgressPlanTasks.col.sortOrder, 'asc')
      .orderBy(ProjectProgressPlanTasks.col.createdAt, 'asc')
  }

export const listProgressPlanTasksByIdsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskIds: string[]
  }): Promise<ProgressPlanTaskRecord[]> => {
    if (!params.taskIds.length) return []

    return await tables
      .projectProgressPlanTasks(deps.db)
      .where({
        [ProjectProgressPlanTasks.col.projectId]: params.projectId
      })
      .whereIn(ProjectProgressPlanTasks.col.id, params.taskIds)
  }

export const getProgressPlanTaskFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskId: string
  }): Promise<ProgressPlanTaskRecord | undefined> => {
    return await tables
      .projectProgressPlanTasks(deps.db)
      .where({
        [ProjectProgressPlanTasks.col.id]: params.taskId,
        [ProjectProgressPlanTasks.col.projectId]: params.projectId
      })
      .first()
  }

export const updateProgressPlanTaskBimFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskId: string
    BIM?: ProgressPlanTaskBIM | null
    updater: string
  }): Promise<ProgressPlanTaskRecord | undefined> => {
    const sanitizedBim = sanitizeBIM(params.BIM ?? null)
    const [updated] = await tables
      .projectProgressPlanTasks(deps.db)
      .where({
        [ProjectProgressPlanTasks.col.id]: params.taskId,
        [ProjectProgressPlanTasks.col.projectId]: params.projectId
      })
      .update(
        {
          [planTaskCols.BIM]: sanitizedBim ? JSON.stringify(sanitizedBim) : null,
          [planTaskCols.updater]: params.updater,
          [planTaskCols.updatedAt]: deps.db.fn.now()
        },
        '*'
      )

    return updated
  }

export const updateProgressPlanTaskMarkerFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    taskId: string
    milestoneType?: ProgressPlanTaskMilestoneType | null
    milestoneDescription?: string | null
    isCriticalTask?: boolean
    updater: string
  }): Promise<ProgressPlanTaskRecord | undefined> => {
    const marker = sanitizeMarker({
      milestoneType: params.milestoneType,
      milestoneDescription: params.milestoneDescription,
      isCriticalTask: params.isCriticalTask
    })

    const [updated] = await tables
      .projectProgressPlanTasks(deps.db)
      .where({
        [ProjectProgressPlanTasks.col.id]: params.taskId,
        [ProjectProgressPlanTasks.col.projectId]: params.projectId
      })
      .update(
        {
          [planTaskCols.milestoneType]: marker.milestoneType,
          [planTaskCols.milestoneDescription]: marker.milestoneDescription,
          [planTaskCols.isCriticalTask]: marker.isCriticalTask,
          [planTaskCols.updater]: params.updater,
          [planTaskCols.updatedAt]: deps.db.fn.now()
        },
        '*'
      )

    return updated
  }

const getParentWbs = (wbs?: string | null) => {
  if (!wbs) return null
  const segments = wbs.split('.').filter(Boolean)
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('.')
}

export const replaceProgressPlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    annualPlanId?: string | null
    planFileId?: string | null
    tasks: ReplaceProgressPlanTaskInput[]
    actorId: string
  }): Promise<ProgressPlanTaskRecord[]> => {
    const taskTable = tables.projectProgressPlanTasks(deps.db)
    let existingQuery = taskTable.where({
      [ProjectProgressPlanTasks.col.projectId]: params.projectId
    })
    if (params.annualPlanId) {
      existingQuery = existingQuery.where({ annualPlanId: params.annualPlanId })
    } else {
      existingQuery = existingQuery.whereNull('annualPlanId')
    }
    const existingTasks = await existingQuery

    const preservedBySysTaskId = new Map<
      string,
      {
        BIM: ProgressPlanTaskBIM | null
        marker: ProgressPlanTaskMarker
      }
    >()
    const preservedByExternalId = new Map<
      string,
      {
        BIM: ProgressPlanTaskBIM | null
        marker: ProgressPlanTaskMarker
      }
    >()
    const preservedByWbs = new Map<
      string,
      {
        BIM: ProgressPlanTaskBIM | null
        marker: ProgressPlanTaskMarker
      }
    >()

    for (const task of existingTasks) {
      const preservedValue = {
        BIM: task.BIM,
        marker: sanitizeMarker({
          milestoneType: task.milestoneType,
          milestoneDescription: task.milestoneDescription,
          isCriticalTask: task.isCriticalTask
        })
      }

      if (task.sysTaskId) {
        preservedBySysTaskId.set(task.sysTaskId, preservedValue)
      }
      if (task.id) {
        preservedBySysTaskId.set(task.id, preservedValue)
      }
      if (task.externalId) {
        preservedByExternalId.set(task.externalId, preservedValue)
      }
      if (task.wbs) {
        preservedByWbs.set(task.wbs, preservedValue)
      }
    }

    let deleteQuery = taskTable.where({
      [ProjectProgressPlanTasks.col.projectId]: params.projectId
    })
    if (params.annualPlanId) {
      deleteQuery = deleteQuery.where({ annualPlanId: params.annualPlanId })
    } else {
      deleteQuery = deleteQuery.whereNull('annualPlanId')
    }
    await deleteQuery.del()

    if (!params.tasks.length) return []

    const idsByExternalKey = new Map<string, string>()
    params.tasks.forEach((task, index) => {
      const key = task.externalId || `__task_${index}`
      idsByExternalKey.set(key, generateId())
    })

    const insertPayload = params.tasks.map((task, index) => {
      const key = task.externalId || `__task_${index}`
      const preservedState =
        (task.sysTaskId && preservedBySysTaskId.get(task.sysTaskId)) ||
        (task.externalId && preservedByExternalId.get(task.externalId)) ||
        (task.wbs && preservedByWbs.get(task.wbs)) ||
        null
      const marker = sanitizeMarker({
        milestoneType:
          task.milestoneType ?? preservedState?.marker.milestoneType ?? null,
        milestoneDescription:
          task.milestoneDescription ??
          preservedState?.marker.milestoneDescription ??
          null,
        isCriticalTask: task.isCriticalTask ?? preservedState?.marker.isCriticalTask
      })

      return {
        id: idsByExternalKey.get(key) || generateId(),
        projectId: params.projectId,
        annualPlanId: params.annualPlanId ?? null,
        planFileId: params.planFileId || null,
        externalId: task.externalId || null,
        sysTaskId: task.sysTaskId || null,
        quantity: task.quantity || null,
        unit: task.unit || null,
        wbs: task.wbs || null,
        name: task.name,
        parentId: task.parentExternalId
          ? idsByExternalKey.get(task.parentExternalId) ?? null
          : null,
        level: task.level ?? 0,
        sortOrder: task.sortOrder ?? index,
        duration: task.duration || null,
        planStart: toNullableDate(task.planStart),
        planEnd: toNullableDate(task.planEnd),
        milestoneType: marker.milestoneType,
        milestoneDescription: marker.milestoneDescription,
        isCriticalTask: marker.isCriticalTask,
        predecessor: task.predecessor || null,
        inspectionBatch: task.inspectionBatch || null,
        BIM: sanitizeBIM(task.BIM ?? null) || preservedState?.BIM || null,
        creator: params.actorId,
        updater: params.actorId
      }
    })

    // 筛选出所有父任务节点（ID集合与WBS前缀集合）
    const parentIdsSet = new Set<string>()
    const parentWbsSet = new Set<string>()

    insertPayload.forEach((item) => {
      if (item.parentId) {
        parentIdsSet.add(item.parentId)
      }
      const parentWbs = getParentWbs(item.wbs)
      if (parentWbs) {
        parentWbsSet.add(parentWbs)
      }
    })

    // 对父节点强制清除关联模型
    insertPayload.forEach((item) => {
      const isParent =
        parentIdsSet.has(item.id) || (item.wbs && parentWbsSet.has(item.wbs))
      if (isParent) {
        item.BIM = null
      }
    })

    const insertPayloadForDb = insertPayload.map((item) => ({
      ...item,
      BIM: item.BIM ? JSON.stringify(item.BIM) : null
    }))

    return await taskTable.insert(
      insertPayloadForDb as unknown as ProgressPlanTaskRecord[],
      '*'
    )
  }
