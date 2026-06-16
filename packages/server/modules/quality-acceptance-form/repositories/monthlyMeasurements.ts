import {
  BoqItems,
  MonthlyMeasurementItems,
  MonthlyMeasurements,
  MonthlyMeasurementDetails,
  MonthlyPaymentDetails,
  MonthlyPaymentRequests,
  QualityAcceptanceForms
} from '@/modules/core/dbSchema'
import type {
  MonthlyMeasurementItemRecord,
  MonthlyMeasurementRecord,
  MonthlyMeasurementDetailRecord,
  MonthlyPaymentDetailRecord,
  MonthlyPaymentRequestRecord,
  QualityAcceptanceFormRecord
} from '@/modules/core/helpers/types'
import type { BoqItemRecord } from '@/modules/bop-item/repositories/boq'
import type { Knex } from 'knex'
import { clamp } from 'lodash-es'
import cryptoRandomString from 'crypto-random-string'

const tables = {
  measurements: (db: Knex) => db<MonthlyMeasurementRecord>(MonthlyMeasurements.name),
  measurementItems: (db: Knex) =>
    db<MonthlyMeasurementItemRecord>(MonthlyMeasurementItems.name),
  measurementDetails: (db: Knex) =>
    db<MonthlyMeasurementDetailRecord>(MonthlyMeasurementDetails.name),
  paymentDetails: (db: Knex) =>
    db<MonthlyPaymentDetailRecord>(MonthlyPaymentDetails.name),
  paymentRequests: (db: Knex) =>
    db<MonthlyPaymentRequestRecord>(MonthlyPaymentRequests.name),
  qualityForms: (db: Knex) =>
    db<QualityAcceptanceFormRecord>(QualityAcceptanceForms.name),
  boqItems: (db: Knex) => db<BoqItemRecord>(BoqItems.name)
}

export const getQualityAcceptanceFormsBeforeBaseDateFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    baseDate: number
    startDate?: number | null
    endDate?: number | null
  }) => {
    const q = tables
      .qualityForms(deps.db)
      .where(QualityAcceptanceForms.col.project_id, params.projectId)

    if (params.startDate || params.endDate) {
      q.andWhere((qb) => {
        qb.whereNull(QualityAcceptanceForms.col.approveStatus).orWhere(
          QualityAcceptanceForms.col.approveStatus,
          ''
        )
      })
      if (params.startDate) {
        q.andWhere(
          QualityAcceptanceForms.col.actualFinishDate,
          '>=',
          String(params.startDate)
        )
      }
      if (params.endDate) {
        q.andWhere(
          QualityAcceptanceForms.col.actualFinishDate,
          '<=',
          String(params.endDate)
        )
      }
    } else {
      q.andWhere((qb) => {
        qb.whereNull(QualityAcceptanceForms.col.approveStatus).orWhere(
          QualityAcceptanceForms.col.approveStatus,
          'APPROVED'
        )
      })
      q.andWhere(
        QualityAcceptanceForms.col.actualFinishDate,
        '<=',
        String(params.baseDate)
      )
    }

    return await q
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
    await Promise.all([
      tables.measurementDetails(deps.db).where({ measurementId }).delete(),
      tables.paymentDetails(deps.db).where({ measurementId }).delete(),
      tables.paymentRequests(deps.db).where({ measurementId }).delete(),
      tables.measurementItems(deps.db).where({ measurementId }).delete()
    ])
    const deleted = await tables
      .measurements(deps.db)
      .where(MonthlyMeasurements.col.id, measurementId)
      .delete()
    return deleted > 0
  }

export const getMonthlyMeasurementDetailsFactory =
  (deps: { db: Knex }) => async (measurementId: string) => {
    return await tables.measurementDetails(deps.db).where({ measurementId }).first()
  }

export const upsertMonthlyMeasurementDetailsFactory =
  (deps: { db: Knex }) =>
  async (measurementId: string, payload: Partial<MonthlyMeasurementDetailRecord>) => {
    const qb = tables.measurementDetails(deps.db)
    const existing = await qb.where({ measurementId }).first()
    if (existing) {
      const [updated] = await qb
        .where({ measurementId })
        .update({
          ...payload,
          updatedAt: new Date()
        })
        .returning('*')
      return updated
    } else {
      const [created] = await qb
        .insert({
          id: cryptoRandomString({ length: 10 }),
          measurementId,
          ...payload,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning('*')
      return created
    }
  }

export const getMonthlyPaymentDetailsFactory =
  (deps: { db: Knex }) => async (measurementId: string) => {
    return await tables.paymentDetails(deps.db).where({ measurementId }).first()
  }

export const upsertMonthlyPaymentDetailsFactory =
  (deps: { db: Knex }) =>
  async (measurementId: string, payload: Partial<MonthlyPaymentDetailRecord>) => {
    const qb = tables.paymentDetails(deps.db)
    const existing = await qb.where({ measurementId }).first()
    const normalizedPayload = { ...payload } as Record<string, unknown>
    if (payload.extraPayItems !== undefined) {
      normalizedPayload.extraPayItems = deps.db.raw('?::jsonb', [
        JSON.stringify(payload.extraPayItems)
      ])
    }
    if (existing) {
      const updatePayload: Record<string, unknown> = {
        ...normalizedPayload,
        updatedAt: new Date()
      }
      const [updated] = await qb
        .where({ measurementId })
        .update(updatePayload)
        .returning('*')
      return updated
    } else {
      const insertPayload: Record<string, unknown> = {
        id: cryptoRandomString({ length: 10 }),
        measurementId,
        ...normalizedPayload,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      const [created] = await qb.insert(insertPayload).returning('*')
      return created
    }
  }

export const getMonthlyPaymentRequestsFactory =
  (deps: { db: Knex }) => async (measurementId: string) => {
    return await tables.paymentRequests(deps.db).where({ measurementId }).first()
  }

export const upsertMonthlyPaymentRequestsFactory =
  (deps: { db: Knex }) =>
  async (measurementId: string, payload: Partial<MonthlyPaymentRequestRecord>) => {
    const qb = tables.paymentRequests(deps.db)
    const existing = await qb.where({ measurementId }).first()
    if (existing) {
      const [updated] = await qb
        .where({ measurementId })
        .update({
          ...payload,
          updatedAt: new Date()
        })
        .returning('*')
      return updated
    } else {
      const [created] = await qb
        .insert({
          id: cryptoRandomString({ length: 10 }),
          measurementId,
          ...payload,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning('*')
      return created
    }
  }

export const updateMonthlyMeasurementItemsBatchFactory =
  (deps: { db: Knex }) =>
  async (
    measurementId: string,
    items: Array<{ boqItemId: string } & Record<string, unknown>>
  ) => {
    const qb = tables.measurementItems(deps.db)
    for (const item of items) {
      const { boqItemId, ...fields } = item
      await qb.where({ measurementId, boqItemId }).update({
        ...fields,
        updatedAt: new Date()
      })
    }
  }
