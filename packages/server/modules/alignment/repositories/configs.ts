import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const AlignmentConfigs = buildTableHelper('alignment_configs', [
  'id',
  'projectId',
  'name',
  'description',
  'drawingId',
  'drawingName',
  'splitRatio',
  'calibrationPoints',
  'transform',
  'sectionBox',
  'cameraState',
  'creator',
  'updater',
  'createdAt',
  'updatedAt'
])

export type AlignmentPointRecord = {
  index: 1 | 2 | 3
  cad: { x: number; y: number; z: number }
  speckle: { x: number; y: number; z: number }
}

export type AlignmentTransformRecord = {
  dx: number
  dy: number
  dz: number
  scale: number
  rotationZ: number
}

export type AlignmentSectionBoxRecord = {
  min: number[]
  max: number[]
  rotation?: number[]
}

export type AlignmentCameraStateRecord = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  projection?: 'perspective' | 'orthographic'
  fov?: number
  zoom?: number
}

export type AlignmentConfigCameraStateRecord = {
  cad: AlignmentCameraStateRecord | null
  speckle: AlignmentCameraStateRecord | null
}

export type AlignmentConfigRecord = {
  id: string
  projectId: string
  name: string
  description: string | null
  drawingId: string | null
  drawingName: string | null
  splitRatio: number | string
  calibrationPoints: AlignmentPointRecord[] | null
  transform: AlignmentTransformRecord | null
  sectionBox: AlignmentSectionBoxRecord | null
  cameraState: AlignmentConfigCameraStateRecord | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

export type AlignmentConfigListRecord = AlignmentConfigRecord & {
  drawingBlobId: string | null
  drawingFileType: string | null
  drawingFileSize: number | string | null
  drawingExists: boolean
}

const generateId = () => cryptoRandomString({ length: 10 })

const DrawingTable = 'alignment_drawings'

const toJsonbValue = <T>(db: Knex, value: T | null | undefined) =>
  value === null || value === undefined
    ? null
    : db.raw('?::jsonb', [JSON.stringify(value)])

const tables = {
  configs: (db: Knex) => db<AlignmentConfigRecord>(AlignmentConfigs.name)
}

const baseListQuery = (db: Knex, projectId: string) =>
  tables
    .configs(db)
    .leftJoin(DrawingTable, `${DrawingTable}.id`, AlignmentConfigs.col.drawingId)
    .select(
      `${AlignmentConfigs.name}.*`,
      `${DrawingTable}.blobId as drawingBlobId`,
      `${DrawingTable}.fileType as drawingFileType`,
      `${DrawingTable}.fileSize as drawingFileSize`,
      db.raw(`CASE WHEN ?? IS NULL THEN false ELSE true END as "drawingExists"`, [
        `${DrawingTable}.id`
      ])
    )
    .where(`${AlignmentConfigs.name}.projectId`, projectId)

export const listAlignmentConfigsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<AlignmentConfigListRecord[]> =>
    (await baseListQuery(deps.db, params.projectId).orderBy(
      `${AlignmentConfigs.name}.updatedAt`,
      'desc'
    )) as AlignmentConfigListRecord[]

export const getAlignmentConfigFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    configId: string
  }): Promise<AlignmentConfigListRecord | null> =>
    ((await baseListQuery(deps.db, params.projectId)
      .andWhere(`${AlignmentConfigs.name}.id`, params.configId)
      .first()) as AlignmentConfigListRecord | undefined) || null

export const createAlignmentConfigFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    name: string
    description?: string | null
    drawingId?: string | null
    drawingName?: string | null
    splitRatio?: number
    calibrationPoints?: AlignmentPointRecord[] | null
    transform?: AlignmentTransformRecord | null
    sectionBox?: AlignmentSectionBoxRecord | null
    cameraState?: AlignmentConfigCameraStateRecord | null
    creator: string
    updater: string
  }): Promise<AlignmentConfigRecord> => {
    const [record] = await tables.configs(deps.db).insert(
      {
        id: generateId(),
        projectId: params.projectId,
        name: params.name,
        description: params.description || null,
        drawingId: params.drawingId || null,
        drawingName: params.drawingName || null,
        splitRatio: params.splitRatio ?? 0.5,
        calibrationPoints: toJsonbValue(deps.db, params.calibrationPoints) as never,
        transform: toJsonbValue(deps.db, params.transform) as never,
        sectionBox: toJsonbValue(deps.db, params.sectionBox) as never,
        cameraState: toJsonbValue(deps.db, params.cameraState) as never,
        creator: params.creator,
        updater: params.updater
      },
      '*'
    )

    return record
  }

export const updateAlignmentConfigFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    configId: string
    update: Partial<{
      name: string
      description: string | null
      drawingId: string | null
      drawingName: string | null
      splitRatio: number
      calibrationPoints: AlignmentPointRecord[] | null
      transform: AlignmentTransformRecord | null
      sectionBox: AlignmentSectionBoxRecord | null
      cameraState: AlignmentConfigCameraStateRecord | null
      updater: string
    }>
  }): Promise<AlignmentConfigRecord | null> => {
    const updatePayload = {
      ...params.update,
      ...(params.update.calibrationPoints !== undefined
        ? { calibrationPoints: toJsonbValue(deps.db, params.update.calibrationPoints) as never }
        : {}),
      ...(params.update.transform !== undefined
        ? { transform: toJsonbValue(deps.db, params.update.transform) as never }
        : {}),
      ...(params.update.sectionBox !== undefined
        ? { sectionBox: toJsonbValue(deps.db, params.update.sectionBox) as never }
        : {}),
      ...(params.update.cameraState !== undefined
        ? { cameraState: toJsonbValue(deps.db, params.update.cameraState) as never }
        : {}),
      updatedAt: deps.db.fn.now()
    }

    const [record] = await tables
      .configs(deps.db)
      .where({
        [AlignmentConfigs.col.projectId]: params.projectId,
        [AlignmentConfigs.col.id]: params.configId
      })
      .update(updatePayload, '*')

    return record || null
  }

export const deleteAlignmentConfigFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; configId: string }): Promise<boolean> => {
    const deletedCount = await tables
      .configs(deps.db)
      .where({
        [AlignmentConfigs.col.projectId]: params.projectId,
        [AlignmentConfigs.col.id]: params.configId
      })
      .delete()

    return deletedCount > 0
  }
