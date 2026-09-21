import type {
  BimElementEntry,
  ProgressActualRecord
} from '@/modules/progress/repositories/progressActualRecords'

/**
 * 实际进度记录序列化。
 *
 * 除原有字段外，额外返回关联构件的「构件编码」以及构件编码与
 * `modelId` / `applicationId` 的对应关系明细，便于前端与第三方系统按构件定位。
 */
export type ComponentCodeLookup = Map<string, string>

export type BimComponentLink = {
  modelId: string
  applicationId: string
  componentCode: string | null
}

export type ActualRecordTaskSelection = {
  modelId?: string
  applicationIds?: string[]
}

export type ActualRecordTask = {
  taskName?: string
  linkedPlanTaskId?: string | null
  selections?: ActualRecordTaskSelection[]
  [key: string]: unknown
}

export type SerializedActualRecordTaskSelection = {
  modelId: string
  applicationIds: string[]
  componentCodes: (string | null)[]
  components: BimComponentLink[]
}

export type SerializedActualRecordTask = Omit<ActualRecordTask, 'selections'> & {
  selections: SerializedActualRecordTaskSelection[]
}

export const buildWeekDay = (reportDate: string) => {
  const match = reportDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''

  const [, year, month, day] = match
  const date = new Date(Number(year), Math.max(0, Number(month) - 1), Number(day))
  const dayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return Number.isNaN(date.getTime()) ? '' : dayMap[date.getDay()]
}

export const parseJsonArray = <T>(raw: unknown): T[] => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as T[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

export const resolveComponentCode = (
  lookup: ComponentCodeLookup,
  applicationId: string,
  storedCode?: string | null
) => {
  const normalizedStored = typeof storedCode === 'string' ? storedCode.trim() : ''
  return normalizedStored || lookup.get(applicationId) || null
}

export const buildBimEntryDetails = (
  entries: BimElementEntry[] | null | undefined,
  lookup: ComponentCodeLookup
) =>
  parseJsonArray<BimElementEntry>(entries).map((entry) => {
    const applicationIds = Array.isArray(entry.applicationIds)
      ? entry.applicationIds
      : []
    const bimIds = Array.isArray(entry.bimIds) ? entry.bimIds : []
    const componentCodes = applicationIds.map((applicationId, idx) =>
      resolveComponentCode(lookup, applicationId, bimIds[idx])
    )

    return {
      modelId: entry.modelId,
      applicationIds,
      bimIds,
      // 与 applicationIds 按位对齐的构件编码：优先记录上已存的 bimIds，缺失时按构件反查
      componentCodes,
      // 构件编码与 modelId / applicationId 的对应关系明细
      components: applicationIds.map((applicationId, idx) => ({
        modelId: entry.modelId,
        applicationId,
        componentCode: componentCodes[idx]
      }))
    }
  })

export const buildActualRecordTasks = (
  rawTasks: unknown,
  lookup: ComponentCodeLookup
): SerializedActualRecordTask[] =>
  parseJsonArray<ActualRecordTask>(rawTasks).map((task) => {
    const selections = Array.isArray(task?.selections) ? task.selections : []

    return {
      ...task,
      selections: selections.map((selection) => {
        const modelId = typeof selection?.modelId === 'string' ? selection.modelId : ''
        const applicationIds = Array.isArray(selection?.applicationIds)
          ? selection.applicationIds
          : []
        const componentCodes = applicationIds.map((applicationId) =>
          resolveComponentCode(lookup, applicationId)
        )

        return {
          modelId,
          applicationIds,
          componentCodes,
          components: applicationIds.map((applicationId, idx) => ({
            modelId,
            applicationId,
            componentCode: componentCodes[idx]
          }))
        }
      })
    }
  })

export const serializeActualRecord = (
  record: ProgressActualRecord,
  componentCodeLookup: ComponentCodeLookup = new Map()
) => {
  // 记录上已直接存储的构件编码优先于反查结果
  const lookup: ComponentCodeLookup = new Map([
    ...buildStoredComponentCodeMap([record]),
    ...componentCodeLookup
  ])

  const [year = '', month = '', day = ''] = record.reportDate.split('-')
  const startBIM = buildBimEntryDetails(record.startBIM || record.BIM, lookup)
  const finishBIM = buildBimEntryDetails(record.finishBIM, lookup)
  const tasks = buildActualRecordTasks(record.tasks, lookup)

  // 记录关联的全部构件编码及其 modelId / applicationId 对应关系明细
  const bimComponents = [
    ...startBIM.flatMap((entry) =>
      entry.components.map((component) => ({ ...component, scope: 'start' as const }))
    ),
    ...finishBIM.flatMap((entry) =>
      entry.components.map((component) => ({ ...component, scope: 'finish' as const }))
    ),
    ...tasks.flatMap((task) =>
      task.selections.flatMap((selection) =>
        selection.components.map((component) => ({
          ...component,
          scope: 'task' as const,
          taskName: task.taskName || '',
          linkedPlanTaskId: task.linkedPlanTaskId ?? null
        }))
      )
    )
  ]

  const componentCodes = Array.from(
    new Set(
      bimComponents
        .map((component) => component.componentCode)
        .filter((code): code is string => !!code)
    )
  )

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
    startBIM,
    finishBIM,
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
    yearMonth: record.yearMonth || '',
    tasks,
    // 该记录关联到的全部构件编码（已去重，含开始 / 完成 / 工程细项三类关联）
    componentCodes,
    // 构件编码与 modelId / applicationId 的对应关系明细
    bimComponents,
    workers: record.workers
      ? typeof record.workers === 'string'
        ? JSON.parse(record.workers)
        : record.workers
      : [],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  }
}

// 汇总记录上已直接存储的构件编码：applicationId -> 构件编码
export const buildStoredComponentCodeMap = (
  records: ProgressActualRecord[]
): ComponentCodeLookup => {
  const lookup: ComponentCodeLookup = new Map()

  records.forEach((record) => {
    const bimEntries = [
      ...parseJsonArray<BimElementEntry>(record.startBIM || record.BIM),
      ...parseJsonArray<BimElementEntry>(record.finishBIM)
    ]

    bimEntries.forEach((entry) => {
      const bimIds = Array.isArray(entry.bimIds) ? entry.bimIds : []
      ;(entry.applicationIds || []).forEach((applicationId, idx) => {
        const code = typeof bimIds[idx] === 'string' ? bimIds[idx]!.trim() : ''
        if (applicationId && code && !lookup.has(applicationId)) {
          lookup.set(applicationId, code)
        }
      })
    })
  })

  return lookup
}

// 汇总需要反查构件编码的 applicationId：记录上已存编码的构件无需反查
export const collectUnresolvedApplicationIds = (
  records: ProgressActualRecord[],
  storedComponentCodes: ComponentCodeLookup = new Map()
) => {
  const applicationIds = new Set<string>()

  records.forEach((record) => {
    const bimEntries = [
      ...parseJsonArray<BimElementEntry>(record.startBIM || record.BIM),
      ...parseJsonArray<BimElementEntry>(record.finishBIM)
    ]

    bimEntries.forEach((entry) => {
      const bimIds = Array.isArray(entry.bimIds) ? entry.bimIds : []
      ;(entry.applicationIds || []).forEach((applicationId, idx) => {
        const storedCode = typeof bimIds[idx] === 'string' ? bimIds[idx]!.trim() : ''
        if (applicationId && !storedCode) applicationIds.add(applicationId)
      })
    })

    parseJsonArray<ActualRecordTask>(record.tasks).forEach((task) => {
      ;(task?.selections || []).forEach((selection) => {
        ;(selection?.applicationIds || []).forEach((applicationId) => {
          if (applicationId && !storedComponentCodes.has(applicationId)) {
            applicationIds.add(applicationId)
          }
        })
      })
    })
  })

  return Array.from(applicationIds)
}
