import { QualityAcceptanceForms } from '@/modules/core/dbSchema'
import type { QualityAcceptanceFormRecord } from '@/modules/core/helpers/types'
import type { Knex } from 'knex'
import { clamp } from 'lodash-es'

const tables = {
  forms: (db: Knex) => db<QualityAcceptanceFormRecord>(QualityAcceptanceForms.name)
}

export const QUALITY_ACCEPTANCE_FORMS_SORT_FIELDS = [
  'updatedAt',
  'actualFinishDate'
] as const

export type QualityAcceptanceFormsSortField =
  (typeof QUALITY_ACCEPTANCE_FORMS_SORT_FIELDS)[number]

export type SortOrder = 'asc' | 'desc'

/** 质量验收列表默认按验收日期倒序（无验收日期的排在最后） */
export const DEFAULT_QUALITY_ACCEPTANCE_FORMS_SORT: {
  sortBy: QualityAcceptanceFormsSortField
  sortOrder: SortOrder
} = {
  sortBy: 'actualFinishDate',
  sortOrder: 'desc'
}

export const normalizeQualityAcceptanceFormsSort = (params: {
  sortBy?: string | null
  sortOrder?: string | null
}): { sortBy: QualityAcceptanceFormsSortField; sortOrder: SortOrder } => {
  const sortBy = QUALITY_ACCEPTANCE_FORMS_SORT_FIELDS.includes(
    params.sortBy as QualityAcceptanceFormsSortField
  )
    ? (params.sortBy as QualityAcceptanceFormsSortField)
    : DEFAULT_QUALITY_ACCEPTANCE_FORMS_SORT.sortBy
  const sortOrder: SortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc'
  return { sortBy, sortOrder }
}

export const getQualityAcceptanceFormsFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    cursor?: string | null
    limit?: number | null
    search?: string | null
    sortBy?: QualityAcceptanceFormsSortField | null
    sortOrder?: SortOrder | null
  }) => {
    const limit = clamp(params.limit || 25, 1, 100)
    const { sortBy, sortOrder } = normalizeQualityAcceptanceFormsSort(params)
    const sortColumn =
      sortBy === 'actualFinishDate'
        ? QualityAcceptanceForms.col.actualFinishDate
        : QualityAcceptanceForms.col.updatedAt
    const idColumn = QualityAcceptanceForms.col.id

    const q = tables
      .forms(deps.db)
      .where(QualityAcceptanceForms.col.project_id, params.projectId)
      // 验收日期可能为空，空值始终排在最后
      .orderByRaw(`?? ${sortOrder} nulls last`, [sortColumn])
      .orderByRaw(`?? ${sortOrder}`, [idColumn])
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
      const separatorIndex = params.cursor.lastIndexOf('|')
      const cursorRaw =
        separatorIndex >= 0 ? params.cursor.slice(0, separatorIndex) : params.cursor
      const cursorId =
        separatorIndex >= 0 ? params.cursor.slice(separatorIndex + 1) : ''
      // 升序时后续数据更大，降序时后续数据更小
      const comparator = sortOrder === 'asc' ? '>' : '<'

      if (cursorId) {
        if (sortBy === 'actualFinishDate') {
          const numericCursor = cursorRaw === '' ? null : Number(cursorRaw)
          if (numericCursor === null || Number.isFinite(numericCursor)) {
            q.andWhere((w) => {
              if (numericCursor === null) {
                // 游标位于空值区间，只继续取空值记录
                w.whereNull(sortColumn).andWhere(idColumn, comparator, cursorId)
                return
              }
              w.where(sortColumn, comparator, numericCursor).orWhere((w2) => {
                w2.where(sortColumn, '=', numericCursor).andWhere(
                  idColumn,
                  comparator,
                  cursorId
                )
              })
              // 空值排在最后，非空游标之后仍可能跟一批空值记录
              w.orWhereNull(sortColumn)
            })
          }
        } else {
          const cursorDate = new Date(cursorRaw)
          q.andWhere((w) => {
            w.where(sortColumn, comparator, cursorDate).orWhere((w2) => {
              w2.where(sortColumn, '=', cursorDate).andWhere(
                idColumn,
                comparator,
                cursorId
              )
            })
          })
        }
      }
    }

    const items = await q
    const hasMore = items.length > limit
    const trimmed = hasMore ? items.slice(0, limit) : items
    const last = trimmed[trimmed.length - 1]

    let cursor: string | null = null
    if (hasMore && last) {
      if (sortBy === 'actualFinishDate') {
        const rawValue =
          last.actualFinishDate === null || last.actualFinishDate === undefined
            ? ''
            : String(last.actualFinishDate)
        cursor = `${rawValue}|${last.id}`
      } else {
        cursor = `${new Date(last.updatedAt).toISOString()}|${last.id}`
      }
    }

    return {
      items: trimmed,
      cursor
    }
  }

export const getQualityAcceptanceFormByIdFactory =
  (deps: { db: Knex }) =>
  async (params: { formId: string; projectId?: string | null }) => {
    const q = tables.forms(deps.db).where(QualityAcceptanceForms.col.id, params.formId)
    if (params.projectId) {
      q.andWhere(QualityAcceptanceForms.col.project_id, params.projectId)
    }
    return await q.first()
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
    const payload = {
      ...form,
      BIM: form.BIM ? JSON.stringify(form.BIM) : null
    }
    const [created] = (await tables
      .forms(deps.db)
      .insert(payload as any)
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
    const payload: any = {
      ...form,
      updatedAt: new Date()
    }
    if (form.BIM !== undefined) {
      payload.BIM = form.BIM ? JSON.stringify(form.BIM) : null
    }
    const [updated] = (await tables
      .forms(deps.db)
      .where(QualityAcceptanceForms.col.id, formId)
      .update(payload, '*')) as QualityAcceptanceFormRecord[]
    return updated
  }
