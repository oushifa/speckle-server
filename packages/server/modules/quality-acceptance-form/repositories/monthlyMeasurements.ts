import {
  BoqItems,
  MonthlyMeasurementItems,
  MonthlyMeasurements,
  QualityAcceptanceForms
} from '@/modules/core/dbSchema'
import type {
  MonthlyMeasurementItemRecord,
  MonthlyMeasurementRecord,
  QualityAcceptanceFormRecord
} from '@/modules/core/helpers/types'
import type { BoqItemRecord } from '@/modules/bop-item/repositories/boq'
import type { Knex } from 'knex'
import { clamp } from 'lodash-es'

const tables = {
  measurements: (db: Knex) => db<MonthlyMeasurementRecord>(MonthlyMeasurements.name),
  measurementItems: (db: Knex) =>
    db<MonthlyMeasurementItemRecord>(MonthlyMeasurementItems.name),
  qualityForms: (db: Knex) =>
    db<QualityAcceptanceFormRecord>(QualityAcceptanceForms.name),
  boqItems: (db: Knex) => db<BoqItemRecord>(BoqItems.name)
}

export const getQualityAcceptanceFormsBeforeBaseDateFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; baseDate: number }) => {
    return await tables
      .qualityForms(deps.db)
      .where(QualityAcceptanceForms.col.project_id, params.projectId)
      .andWhere((qb) => {
        qb.whereNull(QualityAcceptanceForms.col.approveStatus).orWhere(
          QualityAcceptanceForms.col.approveStatus,
          'APPROVED'
        )
      })
      .andWhere(
        QualityAcceptanceForms.col.actualFinishDate,
        '<=',
        String(params.baseDate)
      )
      .orderBy(QualityAcceptanceForms.col.actualFinishDate, 'asc')
      .orderBy(QualityAcceptanceForms.col.id, 'asc')
  }

export const getProjectBoqItemsFactory =
  (deps: { db: Knex }) => async (params: { projectId: string }) => {
    return await tables
      .boqItems(deps.db)
      .where(BoqItems.col.projectId, params.projectId)
      .orderBy(BoqItems.col.depth, 'asc')
      .orderBy(BoqItems.col.sortOrder, 'asc')
      .orderBy(BoqItems.col.createdAt, 'asc')
  }

export const createMonthlyMeasurementFactory =
  (deps: { db: Knex }) => async (payload: MonthlyMeasurementRecord) => {
    const [created] = (await tables
      .measurements(deps.db)
      .insert(payload)
      .returning('*')) as MonthlyMeasurementRecord[]
    return created
  }

export const updateMonthlyMeasurementFactory =
  (deps: { db: Knex }) =>
  async (measurementId: string, payload: Partial<MonthlyMeasurementRecord>) => {
    const updatedRows = await tables
      .measurements(deps.db)
      .where(MonthlyMeasurements.col.id, measurementId)
      .update({
        ...payload,
        updatedAt: new Date()
      })
      .returning('*')
    return (updatedRows as MonthlyMeasurementRecord[])[0]
  }

export const insertMonthlyMeasurementItemsFactory =
  (deps: { db: Knex }) => async (items: MonthlyMeasurementItemRecord[]) => {
    if (!items.length) return
    await tables.measurementItems(deps.db).insert(items)
  }

export const getMonthlyMeasurementsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    cursor?: string | null
    limit?: number | null
    search?: string | null
  }) => {
    const limit = clamp(params.limit || 25, 1, 100)
    const q = tables
      .measurements(deps.db)
      .where(MonthlyMeasurements.col.project_id, params.projectId)
      .orderBy(MonthlyMeasurements.col.updatedAt, 'desc')
      .orderBy(MonthlyMeasurements.col.id, 'desc')
      .limit(limit + 1)

    if (params.search) {
      q.andWhere((qb) => {
        qb.whereILike(MonthlyMeasurements.col.code, `%${params.search}%`).orWhereILike(
          MonthlyMeasurements.col.unit,
          `%${params.search}%`
        )
      })
    }

    if (params.cursor) {
      const [cursorDateRaw, cursorId] = params.cursor.split('|')
      if (cursorDateRaw && cursorId) {
        const cursorDate = new Date(cursorDateRaw)
        q.andWhere((w) => {
          w.where(MonthlyMeasurements.col.updatedAt, '<', cursorDate).orWhere((w2) => {
            w2.where(MonthlyMeasurements.col.updatedAt, '=', cursorDate).andWhere(
              MonthlyMeasurements.col.id,
              '<',
              cursorId
            )
          })
        })
      }
    }

    const items = await q
    const hasMore = items.length > limit
    const trimmed = hasMore ? items.slice(0, limit) : items
    const last = trimmed[trimmed.length - 1]

    return {
      items: trimmed,
      cursor:
        hasMore && last ? `${new Date(last.updatedAt).toISOString()}|${last.id}` : null
    }
  }

export const countMonthlyMeasurementsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; search?: string | null }) => {
    const q = tables
      .measurements(deps.db)
      .where(MonthlyMeasurements.col.project_id, params.projectId)

    if (params.search) {
      q.andWhere((qb) => {
        qb.whereILike(MonthlyMeasurements.col.code, `%${params.search}%`).orWhereILike(
          MonthlyMeasurements.col.unit,
          `%${params.search}%`
        )
      })
    }

    const [res] = await q.count()
    return parseInt(String(res?.count || '0'))
  }

export const getMonthlyMeasurementItemsFactory =
  (deps: { db: Knex }) => async (measurementId: string) => {
    return await tables
      .measurementItems(deps.db)
      .where(MonthlyMeasurementItems.col.measurementId, measurementId)
      .orderBy(MonthlyMeasurementItems.col.sortIndex, 'asc')
      .orderBy(MonthlyMeasurementItems.col.boqDepth, 'asc')
      .orderBy(MonthlyMeasurementItems.col.boqCode, 'asc')
      .orderBy(MonthlyMeasurementItems.col.id, 'asc')
  }

export const getMonthlyMeasurementByIdFactory =
  (deps: { db: Knex }) => async (measurementId: string) => {
    return await tables
      .measurements(deps.db)
      .where(MonthlyMeasurements.col.id, measurementId)
      .first()
  }

export const getMonthlyMeasurementByIdForProjectFactory =
  (deps: { db: Knex }) =>
  async (params: { measurementId: string; projectId: string }) => {
    return await tables
      .measurements(deps.db)
      .where(MonthlyMeasurements.col.id, params.measurementId)
      .andWhere(MonthlyMeasurements.col.project_id, params.projectId)
      .first()
  }

export const getMonthlyMeasurementByProjectCodeFactory =
  (deps: { db: Knex }) => async (params: { projectId: string; code: string }) => {
    return await tables
      .measurements(deps.db)
      .where(MonthlyMeasurements.col.project_id, params.projectId)
      .andWhere(MonthlyMeasurements.col.code, params.code)
      .first()
  }

export const getQualityAcceptanceApproveStatusByIdsFactory =
  (deps: { db: Knex }) => async (params: { ids: string[] }) => {
    if (!params.ids.length) return []
    return await tables
      .qualityForms(deps.db)
      .select([QualityAcceptanceForms.col.id, QualityAcceptanceForms.col.approveStatus])
      .whereIn(QualityAcceptanceForms.col.id, params.ids)
  }

export const getQualityAcceptanceFormsByIdsFactory =
  (deps: { db: Knex }) => async (params: { ids: string[] }) => {
    if (!params.ids.length) return []
    return await tables
      .qualityForms(deps.db)
      .whereIn(QualityAcceptanceForms.col.id, params.ids)
  }

export const updateQualityAcceptanceApproveStatusByIdsFactory =
  (deps: { db: Knex }) =>
  async (params: { ids: string[]; approveStatus: string | null }) => {
    if (!params.ids.length) return 0
    return await tables
      .qualityForms(deps.db)
      .whereIn(QualityAcceptanceForms.col.id, params.ids)
      .update({
        approveStatus: params.approveStatus,
        updatedAt: new Date()
      })
  }

export const deleteMonthlyMeasurementItemsByMeasurementIdFactory =
  (deps: { db: Knex }) => async (measurementId: string) => {
    return await tables
      .measurementItems(deps.db)
      .where(MonthlyMeasurementItems.col.measurementId, measurementId)
      .delete()
  }

export const deleteMonthlyMeasurementByIdFactory =
  (deps: { db: Knex }) => async (measurementId: string) => {
    const deleted = await tables
      .measurements(deps.db)
      .where(MonthlyMeasurements.col.id, measurementId)
      .delete()
    return deleted > 0
  }
