import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectProgressActualRecords = buildTableHelper(
  'project_progress_actual_records',
  [
    'id',
    'projectId',
    'taskName',
    'reportDate',
    'startElementCodes',
    'finishElementCodes',
    'startBIM',
    'finishBIM',
    'BIM',
    'remark',
    'highTemperature',
    'lowTemperature',
    'morningWeather',
    'afternoonWeather',
    'nightCondition',
    'constructionRecord',
    'qualityRecord',
    'safetyRecord',
    'mortarConcreteSampleRecord',
    'materialEquipmentRecord',
    'siteAppearanceRecord',
    'overtimeRecord',
    'otherRecord',
    'siteLeader',
    'reporter',
    'constructionLog',
    'creator',
    'updater',
    'createdAt',
    'updatedAt',
    'yearMonth',
    'tasks',
    'workers'
  ]
)

export type BimElementEntry = {
  modelId: string
  applicationIds: string[]
  bimIds: (string | null)[]
}

export type ProgressActualRecordBIM = BimElementEntry[]

export type ProgressActualRecord = {
  id: string
  projectId: string
  taskName: string
  reportDate: string
  startElementCodes: string | null
  finishElementCodes: string | null
  startBIM: ProgressActualRecordBIM | null
  finishBIM: ProgressActualRecordBIM | null
  BIM: ProgressActualRecordBIM | null
  remark: string | null
  highTemperature: string | null
  lowTemperature: string | null
  morningWeather: string | null
  afternoonWeather: string | null
  nightCondition: string | null
  constructionRecord: string | null
  qualityRecord: string | null
  safetyRecord: string | null
  mortarConcreteSampleRecord: string | null
  materialEquipmentRecord: string | null
  siteAppearanceRecord: string | null
  overtimeRecord: string | null
  otherRecord: string | null
  siteLeader: string | null
  reporter: string | null
  constructionLog: string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
  yearMonth: string | null
  tasks: any[] | null
  workers: any[] | null
}

export type UpsertProgressActualRecordInput = {
  taskName: string
  reportDate: string
  startElementCodes?: string | null
  finishElementCodes?: string | null
  startBIM?: ProgressActualRecordBIM | null
  finishBIM?: ProgressActualRecordBIM | null
  BIM?: ProgressActualRecordBIM | null
  remark?: string | null
  highTemperature?: string | null
  lowTemperature?: string | null
  morningWeather?: string | null
  afternoonWeather?: string | null
  nightCondition?: string | null
  constructionRecord?: string | null
  qualityRecord?: string | null
  safetyRecord?: string | null
  mortarConcreteSampleRecord?: string | null
  materialEquipmentRecord?: string | null
  siteAppearanceRecord?: string | null
  overtimeRecord?: string | null
  otherRecord?: string | null
  siteLeader?: string | null
  reporter?: string | null
  constructionLog?: string | null
  yearMonth?: string | null
  tasks?: any[] | null
  workers?: any[] | null
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  projectProgressActualRecords: (db: Knex) =>
    db<ProgressActualRecord>(ProjectProgressActualRecords.name)
}
const actualRecordCols = ProjectProgressActualRecords.short.col

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeNullableString = (value?: string | null) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

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
  input?: ProgressActualRecordBIM | null
): ProgressActualRecordBIM | null => {
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

const buildElementCodesText = (params: {
  legacyText?: string | null
  bim: ProgressActualRecordBIM | null
}) => {
  const applicationIds = params.bim?.flatMap((e) => e.applicationIds) || []
  if (applicationIds.length) {
    return applicationIds.join('、')
  }

  return normalizeNullableString(params.legacyText)
}

const buildUpsertPayload = (
  params: UpsertProgressActualRecordInput & { updater: string }
) => {
  const legacyBIM = sanitizeBIM(params.BIM ?? null)
  const startBIM = sanitizeBIM(params.startBIM ?? null) || legacyBIM
  const finishBIM = sanitizeBIM(params.finishBIM ?? null)

  return {
    [actualRecordCols.taskName]: params.taskName.trim(),
    [actualRecordCols.reportDate]: params.reportDate,
    [actualRecordCols.startElementCodes]: buildElementCodesText({
      legacyText: params.startElementCodes,
      bim: startBIM
    }),
    [actualRecordCols.finishElementCodes]: buildElementCodesText({
      legacyText: params.finishElementCodes,
      bim: finishBIM
    }),
    [actualRecordCols.startBIM]: startBIM ? JSON.stringify(startBIM) : null,
    [actualRecordCols.finishBIM]: finishBIM ? JSON.stringify(finishBIM) : null,
    [actualRecordCols.BIM]: legacyBIM ? JSON.stringify(legacyBIM) : null,
    [actualRecordCols.remark]: normalizeNullableString(params.remark),
    [actualRecordCols.highTemperature]: normalizeNullableString(params.highTemperature),
    [actualRecordCols.lowTemperature]: normalizeNullableString(params.lowTemperature),
    [actualRecordCols.morningWeather]: normalizeNullableString(params.morningWeather),
    [actualRecordCols.afternoonWeather]: normalizeNullableString(
      params.afternoonWeather
    ),
    [actualRecordCols.nightCondition]: normalizeNullableString(params.nightCondition),
    [actualRecordCols.constructionRecord]: normalizeNullableString(
      params.constructionRecord
    ),
    [actualRecordCols.qualityRecord]: normalizeNullableString(params.qualityRecord),
    [actualRecordCols.safetyRecord]: normalizeNullableString(params.safetyRecord),
    [actualRecordCols.mortarConcreteSampleRecord]: normalizeNullableString(
      params.mortarConcreteSampleRecord
    ),
    [actualRecordCols.materialEquipmentRecord]: normalizeNullableString(
      params.materialEquipmentRecord
    ),
    [actualRecordCols.siteAppearanceRecord]: normalizeNullableString(
      params.siteAppearanceRecord
    ),
    [actualRecordCols.overtimeRecord]: normalizeNullableString(params.overtimeRecord),
    [actualRecordCols.otherRecord]: normalizeNullableString(params.otherRecord),
    [actualRecordCols.siteLeader]: normalizeNullableString(params.siteLeader),
    [actualRecordCols.reporter]: normalizeNullableString(params.reporter),
    [actualRecordCols.constructionLog]: normalizeNullableString(params.constructionLog),
    [actualRecordCols.yearMonth]: normalizeNullableString(params.yearMonth),
    [actualRecordCols.tasks]: params.tasks ? (typeof params.tasks === 'string' ? params.tasks : JSON.stringify(params.tasks)) : null,
    [actualRecordCols.workers]: params.workers ? (typeof params.workers === 'string' ? params.workers : JSON.stringify(params.workers)) : null,
    [actualRecordCols.updater]: params.updater,
    [actualRecordCols.updatedAt]: new Date()
  }
}

export const listProgressActualRecordsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<ProgressActualRecord[]> => {
    return await tables
      .projectProgressActualRecords(deps.db)
      .where({
        [ProjectProgressActualRecords.col.projectId]: params.projectId
      })
      .orderBy(ProjectProgressActualRecords.col.reportDate, 'desc')
      .orderBy(ProjectProgressActualRecords.col.updatedAt, 'desc')
      .orderBy(ProjectProgressActualRecords.col.createdAt, 'desc')
  }

export const getProgressActualRecordFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    recordId: string
  }): Promise<ProgressActualRecord | undefined> => {
    return await tables
      .projectProgressActualRecords(deps.db)
      .where({
        [ProjectProgressActualRecords.col.id]: params.recordId,
        [ProjectProgressActualRecords.col.projectId]: params.projectId
      })
      .first()
  }

export const createProgressActualRecordFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    actorId: string
    input: UpsertProgressActualRecordInput
  }): Promise<ProgressActualRecord> => {
    const [created] = await tables.projectProgressActualRecords(deps.db).insert(
      {
        id: generateId(),
        [actualRecordCols.projectId]: params.projectId,
        [actualRecordCols.creator]: params.actorId,
        ...buildUpsertPayload({
          ...params.input,
          updater: params.actorId
        })
      },
      '*'
    )

    return created
  }

export const createProgressActualRecordsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    actorId: string
    inputs: UpsertProgressActualRecordInput[]
  }): Promise<ProgressActualRecord[]> => {
    if (!params.inputs.length) return []

    return await tables.projectProgressActualRecords(deps.db).insert(
      params.inputs.map((input) => ({
        id: generateId(),
        [actualRecordCols.projectId]: params.projectId,
        [actualRecordCols.creator]: params.actorId,
        ...buildUpsertPayload({
          ...input,
          updater: params.actorId
        })
      })),
      '*'
    )
  }

export const updateProgressActualRecordFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    recordId: string
    actorId: string
    input: UpsertProgressActualRecordInput
  }): Promise<ProgressActualRecord | undefined> => {
    const [updated] = await tables
      .projectProgressActualRecords(deps.db)
      .where({
        [ProjectProgressActualRecords.col.id]: params.recordId,
        [ProjectProgressActualRecords.col.projectId]: params.projectId
      })
      .update(
        buildUpsertPayload({
          ...params.input,
          updater: params.actorId
        }),
        '*'
      )

    return updated
  }

export const deleteProgressActualRecordFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; recordId: string }): Promise<boolean> => {
    const deletedCount = await tables
      .projectProgressActualRecords(deps.db)
      .where({
        [ProjectProgressActualRecords.col.id]: params.recordId,
        [ProjectProgressActualRecords.col.projectId]: params.projectId
      })
      .del()

    return deletedCount > 0
  }
