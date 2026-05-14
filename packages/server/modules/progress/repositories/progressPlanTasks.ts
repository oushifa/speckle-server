import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressPlanTasks = buildTableHelper(
  'project_progress_plan_tasks',
  [
    'id',
    'projectId',
    'planFileId',
    'externalId',
    'wbs',
    'name',
    'parentId',
    'level',
    'sortOrder',
    'duration',
    'planStart',
    'planEnd',
    'predecessor',
    'inspectionBatch',
    'bimElements',
    'creator',
    'updater',
    'createdAt',
    'updatedAt'
  ]
)

export type ProgressPlanTaskBimSelection = {
  modelId: string
  applicationIds: string[]
}

export type ProgressPlanTaskBimElements = {
  modelId: string | null
  modelIds: string[]
  applicationIds: string[]
  selections: ProgressPlanTaskBimSelection[]
}

export type ProgressPlanTaskRecord = {
  id: string
  projectId: string
  planFileId: string | null
  externalId: string | null
  wbs: string | null
  name: string
  parentId: string | null
  level: number
  sortOrder: number
  duration: string | null
  planStart: Date | null
  planEnd: Date | null
  predecessor: string | null
  inspectionBatch: string | null
  bimElements: ProgressPlanTaskBimElements | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

type ReplaceProgressPlanTaskInput = {
  externalId?: string | null
  parentExternalId?: string | null
  wbs?: string | null
  name: string
  level?: number
  sortOrder?: number
  duration?: string | null
  planStart?: string | Date | null
  planEnd?: string | Date | null
  predecessor?: string | null
  inspectionBatch?: string | null
  bimElements?: Partial<ProgressPlanTaskBimElements> | null
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

const sanitizeBimElements = (
  input?: Partial<ProgressPlanTaskBimElements> | null
): ProgressPlanTaskBimElements | null => {
  if (!input) return null

  const selections = Array.isArray(input.selections)
    ? input.selections
        .map((group) => ({
          modelId: normalizeString(group?.modelId),
          applicationIds: uniqueStrings(group?.applicationIds || [])
        }))
        .filter((group) => group.modelId && group.applicationIds.length > 0)
    : []

  const legacyModelId = normalizeString(input.modelId)
  const legacyApplicationIds = uniqueStrings(input.applicationIds || [])
  if (!selections.length && legacyModelId && legacyApplicationIds.length) {
    selections.push({
      modelId: legacyModelId,
      applicationIds: legacyApplicationIds
    })
  }

  if (!selections.length) return null

  const modelIds = uniqueStrings(selections.map((group) => group.modelId))
  const applicationIds = uniqueStrings(
    selections.flatMap((group) => group.applicationIds)
  )

  return {
    modelId: selections.length === 1 ? selections[0]?.modelId || null : null,
    modelIds,
    applicationIds,
    selections
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
  async (params: { projectId: string }): Promise<ProgressPlanTaskRecord[]> => {
    return await tables
      .projectProgressPlanTasks(deps.db)
      .where({
        [ProjectProgressPlanTasks.col.projectId]: params.projectId
      })
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
    modelId?: string | null
    applicationIds?: string[]
    selections?: ProgressPlanTaskBimSelection[]
    updater: string
  }): Promise<ProgressPlanTaskRecord | undefined> => {
    const [updated] = await tables
      .projectProgressPlanTasks(deps.db)
      .where({
        [ProjectProgressPlanTasks.col.id]: params.taskId,
        [ProjectProgressPlanTasks.col.projectId]: params.projectId
      })
      .update(
        {
          [planTaskCols.bimElements]: sanitizeBimElements({
            modelId: params.modelId || '',
            applicationIds: params.applicationIds || [],
            selections: params.selections || []
          }),
          [planTaskCols.updater]: params.updater,
          [planTaskCols.updatedAt]: deps.db.fn.now()
        },
        '*'
      )

    return updated
  }

export const replaceProgressPlanTasksFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    planFileId?: string | null
    tasks: ReplaceProgressPlanTaskInput[]
    actorId: string
  }): Promise<ProgressPlanTaskRecord[]> => {
    const taskTable = tables.projectProgressPlanTasks(deps.db)
    const existingTasks = await taskTable.where({
      [ProjectProgressPlanTasks.col.projectId]: params.projectId
    })

    const preservedByExternalId = new Map<string, ProgressPlanTaskBimElements>()
    const preservedByWbs = new Map<string, ProgressPlanTaskBimElements>()

    for (const task of existingTasks) {
      if (task.externalId && task.bimElements) {
        preservedByExternalId.set(task.externalId, task.bimElements)
      }
      if (task.wbs && task.bimElements) {
        preservedByWbs.set(task.wbs, task.bimElements)
      }
    }

    await taskTable
      .where({
        [ProjectProgressPlanTasks.col.projectId]: params.projectId
      })
      .del()

    if (!params.tasks.length) return []

    const idsByExternalKey = new Map<string, string>()
    params.tasks.forEach((task, index) => {
      const key = task.externalId || `__task_${index}`
      idsByExternalKey.set(key, generateId())
    })

    const insertPayload = params.tasks.map((task, index) => {
      const key = task.externalId || `__task_${index}`
      const preservedBim =
        (task.externalId && preservedByExternalId.get(task.externalId)) ||
        (task.wbs && preservedByWbs.get(task.wbs)) ||
        null

      return {
        id: idsByExternalKey.get(key) || generateId(),
        projectId: params.projectId,
        planFileId: params.planFileId || null,
        externalId: task.externalId || null,
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
        predecessor: task.predecessor || null,
        inspectionBatch: task.inspectionBatch || null,
        bimElements: sanitizeBimElements(task.bimElements) || preservedBim,
        creator: params.actorId,
        updater: params.actorId
      }
    })

    return await taskTable.insert(insertPayload, '*')
  }
