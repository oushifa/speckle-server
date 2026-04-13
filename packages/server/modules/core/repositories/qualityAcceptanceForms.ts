import { QualityAcceptanceForms } from '@/modules/core/dbSchema'
import type { QualityAcceptanceFormRecord } from '@/modules/core/helpers/types'
import type { Knex } from 'knex'
import { clamp } from 'lodash-es'

const tables = {
  forms: (db: Knex) => db<QualityAcceptanceFormRecord>(QualityAcceptanceForms.name)
}

export const getQualityAcceptanceFormsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    cursor?: string | null
    limit?: number | null
    search?: string | null
  }) => {
    const limit = clamp(params.limit || 25, 1, 100)
    const q = tables
      .forms(deps.db)
      .where(QualityAcceptanceForms.col.project_id, params.projectId)
      .orderBy(QualityAcceptanceForms.col.updatedAt, 'desc')
      .orderBy(QualityAcceptanceForms.col.id, 'desc')
      .limit(limit + 1)

    if (params.search) {
      q.andWhere((qb) => {
        qb.whereILike(QualityAcceptanceForms.col.name, `%${params.search}%`)
          .orWhereILike(QualityAcceptanceForms.col.code, `%${params.search}%`)
          .orWhereILike(
            QualityAcceptanceForms.col.inspectionLotNumber,
            `%${params.search}%`
          )
          .orWhereILike(QualityAcceptanceForms.col.acceptancePart, `%${params.search}%`)
          .orWhereILike(
            QualityAcceptanceForms.col.acceptanceContent,
            `%${params.search}%`
          )
      })
    }

    if (params.cursor) {
      const [cursorDateRaw, cursorId] = params.cursor.split('|')
      if (cursorDateRaw && cursorId) {
        const cursorDate = new Date(cursorDateRaw)
        q.andWhere((w) => {
          w.where(QualityAcceptanceForms.col.updatedAt, '<', cursorDate).orWhere(
            (w2) => {
              w2.where(QualityAcceptanceForms.col.updatedAt, '=', cursorDate).andWhere(
                QualityAcceptanceForms.col.id,
                '<',
                cursorId
              )
            }
          )
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

export const countQualityAcceptanceFormsFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string; search?: string | null }) => {
    const q = tables
      .forms(deps.db)
      .where(QualityAcceptanceForms.col.project_id, params.projectId)
    if (params.search) {
      q.andWhere((qb) => {
        qb.whereILike(QualityAcceptanceForms.col.name, `%${params.search}%`)
          .orWhereILike(QualityAcceptanceForms.col.code, `%${params.search}%`)
          .orWhereILike(
            QualityAcceptanceForms.col.inspectionLotNumber,
            `%${params.search}%`
          )
          .orWhereILike(QualityAcceptanceForms.col.acceptancePart, `%${params.search}%`)
          .orWhereILike(
            QualityAcceptanceForms.col.acceptanceContent,
            `%${params.search}%`
          )
      })
    }
    const [res] = await q.count()
    return parseInt(String(res?.count || '0'))
  }

export const createQualityAcceptanceFormFactory =
  (deps: { db: Knex }) => async (form: QualityAcceptanceFormRecord) => {
    const [created] = (await tables
      .forms(deps.db)
      .insert(form)
      .returning('*')) as QualityAcceptanceFormRecord[]
    return created
  }

export const deleteQualityAcceptanceFormFactory =
  (deps: { db: Knex }) => async (id: string) => {
    const deleted = await tables
      .forms(deps.db)
      .where(QualityAcceptanceForms.col.id, id)
      .delete()
    return deleted > 0
  }

export const updateQualityAcceptanceFormFactory =
  (deps: { db: Knex }) =>
  async (formId: string, form: Partial<QualityAcceptanceFormRecord>) => {
    const payload: Partial<QualityAcceptanceFormRecord> = {
      ...form,
      updatedAt: new Date()
    }
    const [updated] = (await tables
      .forms(deps.db)
      .where(QualityAcceptanceForms.col.id, formId)
      .update(payload, '*')) as QualityAcceptanceFormRecord[]
    return updated
  }
