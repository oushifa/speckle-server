import { buildTableHelper } from '@/modules/core/dbSchema'
import { DRAWINGS_PROJECT } from '@/modules/core/drawings/constants'
import type {
  SplitScreenConfig,
  SplitScreenConfigCameraState,
  SplitScreenDrawing
} from '@/modules/viewer/domain/types/splitScreenConfigs'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const SplitScreenConfigs = buildTableHelper('alignment_configs', [
  'id',
  'projectId',
  'name',
  'description',
  'drawingId',
  'drawingName',
  'modelId',
  'modelName',
  'versionId',
  'versionCreatedAt',
  'blobId',
  'fileName',
  'fileType',
  'fileSize',
  'splitRatio',
  'calibrationPoints',
  'transform',
  'cameraState',
  'sectionBox',
  'creator',
  'updater',
  'createdAt',
  'updatedAt'
])

type SplitScreenConfigRow = {
  id: string
  projectId: string
  name: string
  description: string | null
  drawingId: string | null
  drawingName: string | null
  modelId: string | null
  modelName: string | null
  versionId: string | null
  versionCreatedAt: Date | string | null
  blobId: string | null
  fileName: string | null
  fileType: string | null
  fileSize: string | number | null
  splitRatio: string | number
  calibrationPoints: unknown[] | string | null
  transform: Record<string, unknown> | string | null
  cameraState: SplitScreenConfigCameraState | string | null
  sectionBox: Record<string, unknown> | string | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  splitScreenConfigs: (db: Knex) => db<SplitScreenConfigRow>(SplitScreenConfigs.name)
}

const serializeJson = (value: unknown) =>
  value === null || value === undefined ? null : JSON.stringify(value)

const parseJson = <T>(value: T | string | null): T | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    return JSON.parse(value) as T
  }
  return value as T
}

const mapDrawing = (row: SplitScreenConfigRow): SplitScreenDrawing | null => {
  if (
    !row.projectId ||
    !row.modelId ||
    !row.modelName ||
    !row.versionId ||
    !row.versionCreatedAt ||
    !row.blobId ||
    !row.fileName ||
    !row.fileType
  ) {
    return null
  }

  return {
    // Split screen drawings currently always come from the shared drawings library,
    // while row.projectId stores the project owning the split-screen config itself.
    projectId: DRAWINGS_PROJECT.id,
    modelId: row.modelId,
    modelName: row.modelName,
    versionId: row.versionId,
    versionCreatedAt: new Date(row.versionCreatedAt).toISOString(),
    blobId: row.blobId,
    fileName: row.fileName,
    fileType: row.fileType,
    fileSize:
      row.fileSize === null || row.fileSize === undefined ? null : Number(row.fileSize)
  }
}

const mapRow = (row: SplitScreenConfigRow): SplitScreenConfig => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  description: row.description,
  drawing: mapDrawing(row),
  splitRatio: Number(row.splitRatio),
  calibrationPoints: parseJson<unknown[]>(row.calibrationPoints),
  transform: parseJson<Record<string, unknown>>(row.transform),
  cameraState: parseJson<SplitScreenConfigCameraState>(row.cameraState),
  sectionBox: parseJson<Record<string, unknown>>(row.sectionBox),
  creator: row.creator,
  updater: row.updater,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
})

const buildDrawingFields = (drawing: SplitScreenDrawing | null) => ({
  drawingId: drawing?.modelId || null,
  drawingName: drawing?.fileName || null,
  modelId: drawing?.modelId || null,
  modelName: drawing?.modelName || null,
  versionId: drawing?.versionId || null,
  versionCreatedAt: drawing?.versionCreatedAt
    ? new Date(drawing.versionCreatedAt)
    : null,
  blobId: drawing?.blobId || null,
  fileName: drawing?.fileName || null,
  fileType: drawing?.fileType || null,
  fileSize: drawing?.fileSize ?? null
})

export type SaveSplitScreenConfigInput = {
  name: string
  description?: string | null
  drawing: SplitScreenDrawing
  splitRatio: number
  calibrationPoints?: unknown[] | null
  transform?: Record<string, unknown> | null
  cameraState?: SplitScreenConfigCameraState | null
  sectionBox?: Record<string, unknown> | null
}

export const getSplitScreenConfigsByProjectFactory =
  (deps: { db: Knex }) =>
  async (projectId: string): Promise<SplitScreenConfig[]> => {
    const rows = await tables
      .splitScreenConfigs(deps.db)
      .where({ [SplitScreenConfigs.col.projectId]: projectId })
      .orderBy('updatedAt', 'desc')

    return rows.map(mapRow)
  }

export const getSplitScreenConfigFactory =
  (deps: { db: Knex }) =>
  async (
    configId: string,
    projectId: string
  ): Promise<SplitScreenConfig | undefined> => {
    const row = await tables
      .splitScreenConfigs(deps.db)
      .where({
        [SplitScreenConfigs.col.id]: configId,
        [SplitScreenConfigs.col.projectId]: projectId
      })
      .first()

    return row ? mapRow(row) : undefined
  }

export const createSplitScreenConfigFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    userId: string
    input: SaveSplitScreenConfigInput
  }): Promise<SplitScreenConfig> => {
    const [row] = await tables.splitScreenConfigs(deps.db).insert(
      {
        id: generateId(),
        projectId: params.projectId,
        name: params.input.name,
        description: params.input.description || null,
        ...buildDrawingFields(params.input.drawing),
        splitRatio: params.input.splitRatio,
        calibrationPoints: serializeJson(params.input.calibrationPoints || null),
        transform: serializeJson(params.input.transform || null),
        cameraState: serializeJson(params.input.cameraState || null),
        sectionBox: serializeJson(params.input.sectionBox || null),
        creator: params.userId,
        updater: params.userId
      },
      '*'
    )

    return mapRow(row)
  }

export const updateSplitScreenConfigFactory =
  (deps: { db: Knex }) =>
  async (params: {
    configId: string
    projectId: string
    userId: string
    input: SaveSplitScreenConfigInput
  }): Promise<SplitScreenConfig | undefined> => {
    const [row] = await tables
      .splitScreenConfigs(deps.db)
      .where({
        [SplitScreenConfigs.col.id]: params.configId,
        [SplitScreenConfigs.col.projectId]: params.projectId
      })
      .update(
        {
          name: params.input.name,
          description: params.input.description || null,
          ...buildDrawingFields(params.input.drawing),
          splitRatio: params.input.splitRatio,
          calibrationPoints: serializeJson(params.input.calibrationPoints || null),
          transform: serializeJson(params.input.transform || null),
          cameraState: serializeJson(params.input.cameraState || null),
          sectionBox: serializeJson(params.input.sectionBox || null),
          updater: params.userId,
          updatedAt: new Date()
        },
        '*'
      )

    return row ? mapRow(row) : undefined
  }

export const deleteSplitScreenConfigFactory =
  (deps: { db: Knex }) =>
  async (params: { configId: string; projectId: string }): Promise<boolean> => {
    const deletedCount = await tables
      .splitScreenConfigs(deps.db)
      .where({
        [SplitScreenConfigs.col.id]: params.configId,
        [SplitScreenConfigs.col.projectId]: params.projectId
      })
      .delete()

    return deletedCount > 0
  }
