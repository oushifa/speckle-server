import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'
import { updateProgressPlanTaskBimFactory } from './progressPlanTasks'
import { BadRequestError } from '@/modules/shared/errors'

export const ProjectProgressMonthlyPlans = buildTableHelper(
  'project_progress_monthly_plans',
  ['id', 'projectId', 'yearMonth', 'createdBy', 'createdAt', 'updatedAt']
)

export const ProjectProgressMonthlyPlanTasks = buildTableHelper(
  'project_progress_monthly_plan_tasks',
  [
    'id',
    'monthlyPlanId',
    'taskName',
    'linkedPlanTaskId',
    'linkedPlanTaskName',
    'startDate',
    'endDate',
    'totalVolume',
    'unit',
    'plannedVolume',
    'actualVolume',
    'progressPercent',
    'remark',
    'bimComponentCount',
    'bimLinked',
    'selections',
    'createdAt',
    'updatedAt'
  ]
)

export type MonthlyPlanRecord = {
  id: string
  projectId: string
  yearMonth: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type MonthlyPlanTaskRecord = {
  id: string
  monthlyPlanId: string
  taskName: string
  linkedPlanTaskId: string | null
  linkedPlanTaskName: string | null
  startDate: Date | null
  endDate: Date | null
  totalVolume: string | null
  unit: string | null
  plannedVolume: string | null
  actualVolume: string | null
  progressPercent: number
  remark: string | null
  bimComponentCount: number
  bimLinked: boolean
  selections: any | null
  createdAt: Date
  updatedAt: Date
}

export type CreateMonthlyPlanTaskInput = {
  taskName: string
  linkedPlanTaskId?: string | null
  linkedPlanTaskName?: string | null
  startDate?: string | Date | null
  endDate?: string | Date | null
  totalVolume?: string | null
  unit?: string | null
  plannedVolume?: string | null
  actualVolume?: string | null
  progressPercent?: number
  remark?: string | null
  bimComponentCount?: number
  bimLinked?: boolean
  selections?: any | null
}

export type UpdateMonthlyPlanTaskInput = CreateMonthlyPlanTaskInput & {
  id?: string | null
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  monthlyPlans: (db: Knex) => db<MonthlyPlanRecord>(ProjectProgressMonthlyPlans.name),
  monthlyPlanTasks: (db: Knex) => db<MonthlyPlanTaskRecord>(ProjectProgressMonthlyPlanTasks.name)
}

export const listProgressMonthlyPlansFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<Array<MonthlyPlanRecord & { tasks: MonthlyPlanTaskRecord[] }>> => {
    const plans = await tables
      .monthlyPlans(deps.db)
      .where({ projectId: params.projectId })
      .orderBy('yearMonth', 'desc')

    const planIds = plans.map((p) => p.id)
    if (!planIds.length) return []

    const tasks = await tables
      .monthlyPlanTasks(deps.db)
      .whereIn('monthlyPlanId', planIds)
      .orderBy('createdAt', 'asc')

    // Group tasks by plan ID
    const taskMap = new Map<string, MonthlyPlanTaskRecord[]>()
    tasks.forEach((t) => {
      const list = taskMap.get(t.monthlyPlanId) || []
      list.push(t)
      taskMap.set(t.monthlyPlanId, list)
    })

    return plans.map((p) => ({
      ...p,
      tasks: taskMap.get(p.id) || []
    }))
  }

export const createProgressMonthlyPlanFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    yearMonth: string
    createdBy: string
    tasks: CreateMonthlyPlanTaskInput[]
  }): Promise<MonthlyPlanRecord & { tasks: MonthlyPlanTaskRecord[] }> => {
    // 0. Check duplicate
    const existing = await tables
      .monthlyPlans(deps.db)
      .where({ projectId: params.projectId, yearMonth: params.yearMonth })
      .first()

    if (existing) {
      // 存在则直接将新任务追加到已有月份计划中
      const tasksToInsert = params.tasks.map((t) => ({
        id: generateId(),
        monthlyPlanId: existing.id,
        taskName: t.taskName,
        linkedPlanTaskId: t.linkedPlanTaskId || null,
        linkedPlanTaskName: t.linkedPlanTaskName || null,
        startDate: t.startDate ? new Date(t.startDate) : null,
        endDate: t.endDate ? new Date(t.endDate) : null,
        totalVolume: t.totalVolume || null,
        unit: t.unit || null,
        plannedVolume: t.plannedVolume || null,
        actualVolume: t.actualVolume || '0',
        progressPercent: t.progressPercent || 0,
        remark: t.remark || null,
        bimComponentCount: t.bimComponentCount || 0,
        bimLinked: !!t.bimLinked,
        selections: t.selections ? (typeof t.selections === 'string' ? t.selections : JSON.stringify(t.selections)) : null
      }))

      if (tasksToInsert.length) {
        await tables.monthlyPlanTasks(deps.db).insert(tasksToInsert)
      }

      // 获取该计划下的全部合并任务列表
      const allTasks = await tables
        .monthlyPlanTasks(deps.db)
        .where({ monthlyPlanId: existing.id })
        .orderBy('createdAt', 'asc')

      await syncAllPlanTasksBimFromMonthlyPlans(params.projectId, deps.db)

      return {
        ...existing,
        tasks: allTasks
      }
    }

    const planId = generateId()

    // 1. Insert plan
    const [plan] = await tables.monthlyPlans(deps.db).insert(
      {
        id: planId,
        projectId: params.projectId,
        yearMonth: params.yearMonth,
        createdBy: params.createdBy
      },
      '*'
    )

    // 2. Insert tasks
    const tasksToInsert = params.tasks.map((t) => ({
      id: generateId(),
      monthlyPlanId: planId,
      taskName: t.taskName,
      linkedPlanTaskId: t.linkedPlanTaskId,
      linkedPlanTaskName: t.linkedPlanTaskName,
      startDate: t.startDate ? new Date(t.startDate) : null,
      endDate: t.endDate ? new Date(t.endDate) : null,
      totalVolume: t.totalVolume,
      unit: t.unit,
      plannedVolume: t.plannedVolume,
      actualVolume: t.actualVolume || '0',
      progressPercent: t.progressPercent || 0,
      remark: t.remark,
      bimComponentCount: t.bimComponentCount || 0,
      bimLinked: !!t.bimLinked,
      selections: t.selections ? (typeof t.selections === 'string' ? t.selections : JSON.stringify(t.selections)) : null
    }))

    let insertedTasks: MonthlyPlanTaskRecord[] = []
    if (tasksToInsert.length) {
      insertedTasks = await tables.monthlyPlanTasks(deps.db).insert(tasksToInsert, '*')
    }

    await syncAllPlanTasksBimFromMonthlyPlans(params.projectId, deps.db)

    return {
      ...plan,
      tasks: insertedTasks
    }
  }

export const updateProgressMonthlyPlanFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    planId: string
    yearMonth: string
    createdBy: string
    tasks: UpdateMonthlyPlanTaskInput[]
  }): Promise<MonthlyPlanRecord & { tasks: MonthlyPlanTaskRecord[] } | null> => {
    // 1. Check plan existence
    const plan = await tables
      .monthlyPlans(deps.db)
      .where({ id: params.planId, projectId: params.projectId })
      .first()

    if (!plan) return null

    // 1.5 Check duplicate for updated month
    if (params.yearMonth !== plan.yearMonth) {
      const existing = await tables
        .monthlyPlans(deps.db)
        .where({ projectId: params.projectId, yearMonth: params.yearMonth })
        .whereNot({ id: params.planId })
        .first()

      if (existing) {
        throw new BadRequestError('该月份的月度计划已存在，请勿重复创建。')
      }
    }
    // 2. Update plan meta
    await tables
      .monthlyPlans(deps.db)
      .where({ id: params.planId })
      .update({
        yearMonth: params.yearMonth,
        createdBy: params.createdBy,
        updatedAt: deps.db.fn.now()
      })

    const updatedPlan = {
      ...plan,
      yearMonth: params.yearMonth,
      createdBy: params.createdBy,
      updatedAt: new Date()
    }

    // 3. Update tasks: Delete old tasks, insert new tasks
    await tables.monthlyPlanTasks(deps.db).where({ monthlyPlanId: params.planId }).delete()

    const tasksToInsert = params.tasks.map((t) => ({
      id: t.id || generateId(),
      monthlyPlanId: params.planId,
      taskName: t.taskName,
      linkedPlanTaskId: t.linkedPlanTaskId || null,
      linkedPlanTaskName: t.linkedPlanTaskName || null,
      startDate: t.startDate ? new Date(t.startDate) : null,
      endDate: t.endDate ? new Date(t.endDate) : null,
      totalVolume: t.totalVolume || null,
      unit: t.unit || null,
      plannedVolume: t.plannedVolume || null,
      actualVolume: t.actualVolume || '0',
      progressPercent: t.progressPercent || 0,
      remark: t.remark || null,
      bimComponentCount: t.bimComponentCount || 0,
      bimLinked: !!t.bimLinked,
      selections: t.selections ? (typeof t.selections === 'string' ? JSON.parse(t.selections) : t.selections) : null
    }))

    let insertedTasks: MonthlyPlanTaskRecord[] = []
    if (tasksToInsert.length) {
      insertedTasks = await tables.monthlyPlanTasks(deps.db).insert(tasksToInsert, '*')
    }

    await syncAllPlanTasksBimFromMonthlyPlans(params.projectId, deps.db)

    return {
      ...updatedPlan,
      tasks: insertedTasks
    }
  }

export const deleteProgressMonthlyPlanFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; planId: string }): Promise<boolean> => {
    const deletedCount = await tables
      .monthlyPlans(deps.db)
      .where({ id: params.planId, projectId: params.projectId })
      .delete()

    const deleted = deletedCount > 0
    if (deleted) {
      await syncAllPlanTasksBimFromMonthlyPlans(params.projectId, deps.db)
    }

    return deleted
  }

export const updateMonthlyPlanTaskBimFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    planId: string
    taskId: string
    selections: Array<{ modelId: string; applicationIds: string[] }>
    updater: string
  }): Promise<MonthlyPlanTaskRecord | null> => {
    // 1. Get task
    const task = await tables
      .monthlyPlanTasks(deps.db)
      .where({ id: params.taskId, monthlyPlanId: params.planId })
      .first()

    if (!task) return null

    // 2. Count component selection count
    const bimComponentCount = params.selections.reduce(
      (sum, sel) => sum + (sel.applicationIds || []).length,
      0
    )
    const bimLinked = bimComponentCount > 0

    // 3. Update monthly task
    const [updatedTask] = await tables
      .monthlyPlanTasks(deps.db)
      .where({ id: params.taskId })
      .update(
        {
          selections: JSON.stringify(params.selections),
          bimComponentCount,
          bimLinked,
          updatedAt: deps.db.fn.now()
        },
        '*'
      )

    // 4. Sync association to project_progress_plan_tasks
    await syncAllPlanTasksBimFromMonthlyPlans(params.projectId, deps.db)

    return updatedTask
  }

export async function syncAllPlanTasksBimFromMonthlyPlans(
  projectId: string,
  db: Knex
): Promise<void> {
  const monthlyPlans = await db('project_progress_monthly_plans')
    .where({ projectId })
    .select('id')

  const planIds = monthlyPlans.map((p) => p.id)

  let activeMonthlyTasks: any[] = []
  if (planIds.length > 0) {
    activeMonthlyTasks = await db('project_progress_monthly_plan_tasks')
      .whereIn('monthlyPlanId', planIds)
      .whereNotNull('linkedPlanTaskId')
      .select('linkedPlanTaskId', 'selections')
  }

  const bimMap = new Map<string, Array<{ modelId: string; applicationIds: string[] }>>()
  for (const task of activeMonthlyTasks) {
    if (!task.linkedPlanTaskId || !task.selections) continue
    const taskId = task.linkedPlanTaskId
    let selectionsList: any[] = []
    try {
      selectionsList = typeof task.selections === 'string'
        ? JSON.parse(task.selections)
        : task.selections
    } catch {
      continue
    }
    if (!Array.isArray(selectionsList)) continue

    const list = bimMap.get(taskId) || []
    list.push(...selectionsList)
    bimMap.set(taskId, list)
  }

  const bimEntriesMap = new Map<string, any[]>()
  for (const [taskId, list] of bimMap.entries()) {
    const modelGroup = new Map<string, Set<string>>()
    for (const sel of list) {
      if (!sel.modelId || !Array.isArray(sel.applicationIds)) continue
      const set = modelGroup.get(sel.modelId) || new Set<string>()
      sel.applicationIds.forEach((id: string) => set.add(id))
      modelGroup.set(sel.modelId, set)
    }

    const bimEntries = Array.from(modelGroup.entries()).map(([modelId, idSet]) => ({
      modelId,
      applicationIds: Array.from(idSet),
      bimIds: Array.from(idSet).map(() => null)
    }))

    const filteredEntries = bimEntries.filter((e) => e.applicationIds.length > 0)
    if (filteredEntries.length > 0) {
      bimEntriesMap.set(taskId, filteredEntries)
    }
  }

  const allPlanTasks = await db('project_progress_plan_tasks')
    .where({ projectId })
    .select('id')

  for (const pt of allPlanTasks) {
    const bimEntries = bimEntriesMap.get(pt.id)
    if (bimEntries && bimEntries.length > 0) {
      await db('project_progress_plan_tasks')
        .where({ id: pt.id })
        .update({
          BIM: JSON.stringify(bimEntries),
          updatedAt: db.fn.now()
        })
    } else {
      await db('project_progress_plan_tasks')
        .where({ id: pt.id })
        .update({
          BIM: null,
          updatedAt: db.fn.now()
        })
    }
  }
}
