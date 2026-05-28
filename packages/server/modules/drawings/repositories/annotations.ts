import { buildTableHelper } from '@/modules/core/dbSchema'
import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'

export const ProjectDrawingAnnotations = buildTableHelper('project_drawing_annotations', [
  'id',
  'projectId',
  'drawingId',
  'title',
  'description',
  'visible',
  'pointX',
  'pointY',
  'pointZ',
  'cameraPositionX',
  'cameraPositionY',
  'cameraPositionZ',
  'cameraTargetX',
  'cameraTargetY',
  'cameraTargetZ',
  'creator',
  'updater',
  'createdAt',
  'updatedAt'
])

export type ProjectDrawingAnnotationRecord = {
  id: string
  projectId: string
  drawingId: string
  title: string
  description: string
  visible: boolean
  pointX: number
  pointY: number
  pointZ: number
  cameraPositionX: number
  cameraPositionY: number
  cameraPositionZ: number
  cameraTargetX: number
  cameraTargetY: number
  cameraTargetZ: number
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}

const generateId = () => cryptoRandomString({ length: 10 })

const tables = {
  annotations: (db: Knex) => db<ProjectDrawingAnnotationRecord>(ProjectDrawingAnnotations.name)
}

export const listDrawingAnnotationsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; drawingId: string }): Promise<ProjectDrawingAnnotationRecord[]> =>
    await tables
      .annotations(deps.db)
      .where({
        [ProjectDrawingAnnotations.col.projectId]: params.projectId,
        [ProjectDrawingAnnotations.col.drawingId]: params.drawingId
      })
      .orderBy(ProjectDrawingAnnotations.col.createdAt, 'desc')
      .orderBy(ProjectDrawingAnnotations.col.id, 'desc')

export const getDrawingAnnotationFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    drawingId: string
    annotationId: string
  }): Promise<ProjectDrawingAnnotationRecord | null> =>
    (await tables
      .annotations(deps.db)
      .where({
        [ProjectDrawingAnnotations.col.projectId]: params.projectId,
        [ProjectDrawingAnnotations.col.drawingId]: params.drawingId,
        [ProjectDrawingAnnotations.col.id]: params.annotationId
      })
      .first()) || null

export const createDrawingAnnotationFactory =
  (deps: { db: Knex }) =>
  async (params: Omit<ProjectDrawingAnnotationRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const [record] = await tables.annotations(deps.db).insert(
      {
        id: generateId(),
        ...params
      },
      '*'
    )
    return record
  }

export const updateDrawingAnnotationFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    drawingId: string
    annotationId: string
    updater: string
    title?: string
    description?: string
    visible?: boolean
  }): Promise<ProjectDrawingAnnotationRecord | null> => {
    const patch: Partial<ProjectDrawingAnnotationRecord> = {
      updater: params.updater,
      updatedAt: deps.db.fn.now() as unknown as Date
    }
    if (typeof params.title === 'string') patch.title = params.title
    if (typeof params.description === 'string') patch.description = params.description
    if (typeof params.visible === 'boolean') patch.visible = params.visible

    const [record] = await tables
      .annotations(deps.db)
      .where({
        [ProjectDrawingAnnotations.col.projectId]: params.projectId,
        [ProjectDrawingAnnotations.col.drawingId]: params.drawingId,
        [ProjectDrawingAnnotations.col.id]: params.annotationId
      })
      .update(patch, '*')

    return record || null
  }

export const deleteDrawingAnnotationFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    drawingId: string
    annotationId: string
  }): Promise<boolean> => {
    const deletedCount = await tables
      .annotations(deps.db)
      .where({
        [ProjectDrawingAnnotations.col.projectId]: params.projectId,
        [ProjectDrawingAnnotations.col.drawingId]: params.drawingId,
        [ProjectDrawingAnnotations.col.id]: params.annotationId
      })
      .delete()

    return deletedCount > 0
  }

