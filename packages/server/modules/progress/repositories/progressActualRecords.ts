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
    'startBimElements',
    'finishBimElements',
    'bimElements',
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
    'updatedAt'
  ]
)

export type ProgressActualRecordBimSelection = {
  modelId: string
  applicationIds: string[]
}

export type ProgressActualRecordBimElements = {
  modelId: string | null
  modelIds: string[]
  applicationIds: string[]
  selections: ProgressActualRecordBimSelection[]
}

export type ProgressActualRecord = {
  id: string
  projectId: string
  taskName: string
  reportDate: string
  startElementCodes: string | null
  finishElementCodes: string | null
  startBimElements: ProgressActualRecordBimElements | null
  finishBimElements: ProgressActualRecordBimElements | null
  bimElements: ProgressActualRecordBimElements | null
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
}

export type UpsertProgressActualRecordInput = {
  taskName: string
  reportDate: string
  startElementCodes?: string | null
  finishElementCodes?: string | null
  startModelIds?: string[]
  startApplicationIds?: string[]
  startSelections?: ProgressActualRecordBimSelection[]
  finishModelIds?: string[]
  finishApplicationIds?: string[]
  finishSelections?: ProgressActualRecordBimSelection[]
  modelId?: string | null
  modelIds?: string[]
  applicationIds?: string[]
  selections?: ProgressActualRecordBimSelection[]
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

const sanitizeBimElements = (params: {
  modelId?: string | null
  modelIds?: string[]
  applicationIds?: string[]
  selections?: ProgressActualRecordBimSelection[]
}): ProgressActualRecordBimElements | null => {
  const selections = Array.isArray(params.selections)
    ? params.selections
        .map((group) => ({
          modelId: normalizeString(group?.modelId),
          applicationIds: uniqueStrings(group?.applicationIds || [])
        }))
        .filter((group) => group.modelId && group.applicationIds.length > 0)
    : []

  const legacyModelId = normalizeString(params.modelId)
  const legacyApplicationIds = uniqueStrings(params.applicationIds || [])
  if (!selections.length && legacyModelId && legacyApplicationIds.length) {
    selections.push({
      modelId: legacyModelId,
      applicationIds: legacyApplicationIds
    })
  }

  if (!selections.length) return null

  const modelIds = uniqueStrings([
    ...(params.modelIds || []),
    ...selections.map((group) => group.modelId)
  ])
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

const buildElementCodesText = (params: {
  legacyText?: string | null
  bimElements: ProgressActualRecordBimElements | null
}) => {
  const applicationIds = params.bimElements?.applicationIds || []
  if (applicationIds.length) {
    return applicationIds.join('、')
  }

  return normalizeNullableString(params.legacyText)
}

const buildUpsertPayload = (
  params: UpsertProgressActualRecordInput & { updater: string }
) => {
  const legacyBimElements = sanitizeBimElements(params)
  const startBimElements =
    sanitizeBimElements({
      modelIds: params.startModelIds,
      applicationIds: params.startApplicationIds,
      selections: params.startSelections
    }) || legacyBimElements
  const finishBimElements = sanitizeBimElements({
    modelIds: params.finishModelIds,
    applicationIds: params.finishApplicationIds,
    selections: params.finishSelections
  })

  return {
    [actualRecordCols.taskName]: params.taskName.trim(),
    [actualRecordCols.reportDate]: params.reportDate,
    [actualRecordCols.startElementCodes]: buildElementCodesText({
      legacyText: params.startElementCodes,
      bimElements: startBimElements
    }),
    [actualRecordCols.finishElementCodes]: buildElementCodesText({
      legacyText: params.finishElementCodes,
      bimElements: finishBimElements
    }),
    [actualRecordCols.startBimElements]: startBimElements,
    [actualRecordCols.finishBimElements]: finishBimElements,
    [actualRecordCols.bimElements]: legacyBimElements,
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
