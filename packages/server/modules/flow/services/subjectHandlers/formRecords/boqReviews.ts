import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { BadRequestError, NotFoundError } from '@/modules/shared/errors'
import type {
  ApprovalSubjectDescriptor,
  ApprovalSubjectHandler,
  ApprovalSubjectSnapshot
} from '@/modules/flow/services/subjectHandlers/types'

export const BOQ_REVIEW_RECORDS_TABLE = 'boq_review_records'
const BOQ_REVIEW_ROWS_TABLE = 'boq_review_rows'

const assertBoqReviewSubject = (params: ApprovalSubjectDescriptor) => {
  if (params.subjectType !== 'FORM_RECORD') {
    throw new BadRequestError('BOQ review handler only supports FORM_RECORD')
  }
  if (params.subjectTable !== BOQ_REVIEW_RECORDS_TABLE) {
    throw new BadRequestError('Unexpected subjectTable for BOQ review handler')
  }
}

const getBoqReviewRecord = async (params: ApprovalSubjectDescriptor) => {
  assertBoqReviewSubject(params)
  const projectDb = await getProjectDbClient({ projectId: params.projectId })
  const record = await projectDb(BOQ_REVIEW_RECORDS_TABLE)
    .where('id', params.subjectId)
    .andWhere('projectId', params.projectId)
    .first()
  if (!record) {
    throw new NotFoundError('BOQ review record not found')
  }
  return { record, projectDb }
}

export const boqReviewsApprovalSubjectHandler: ApprovalSubjectHandler = {
  async getSubjectSnapshot(
    params: ApprovalSubjectDescriptor
  ): Promise<ApprovalSubjectSnapshot> {
    const { record, projectDb } = await getBoqReviewRecord(params)
    const rows = await projectDb(BOQ_REVIEW_ROWS_TABLE)
      .where('recordId', record.id)
      .orderBy('sortIndex', 'asc')
      .orderBy('id', 'asc')

    return {
      subjectType: 'FORM_RECORD',
      subjectTable: BOQ_REVIEW_RECORDS_TABLE,
      recordId: record.id,
      projectId: record.projectId || params.projectId,
      kind: record.kind || null,
      code: record.code || null,
      reason: record.reason || '',
      applicant: record.applicant || '',
      applicantId: record.applicantId || null,
      applyDate: record.applyDate || '',
      approveStatus: record.approveStatus || 'START',
      effectiveAt: record.effectiveAt || null,
      attachments: record.attachments || [],
      createdAt:
        record.createdAt instanceof Date
          ? record.createdAt.toISOString()
          : record.createdAt,
      updatedAt:
        record.updatedAt instanceof Date
          ? record.updatedAt.toISOString()
          : record.updatedAt,
      rows: rows.map((row: any) => ({
        id: row.id,
        recordId: row.recordId,
        projectId: row.projectId,
        sortIndex: row.sortIndex ?? 0,
        source: row.source || 'import',
        boqItemId: row.boqItemId || null,
        sourceCode: row.sourceCode || null,
        parentCode: row.parentCode || null,
        code: row.code || '',
        name: row.name || '',
        unit: row.unit || '',
        baseChangeQty: row.baseChangeQty ?? null,
        reviewQty: row.reviewQty ?? null,
        reviewQtySupervisor: row.reviewQtySupervisor ?? null,
        reviewQtyContract: row.reviewQtyContract ?? null,
        changeQty: row.changeQty ?? null,
        changeQtySupervisor: row.changeQtySupervisor ?? null,
        changeQtyContract: row.changeQtyContract ?? null,
        reviewUnitPrice: row.reviewUnitPrice ?? null
      }))
    }
  },
  async canSubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getBoqReviewRecord(params)
  },
  async canResubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getBoqReviewRecord(params)
  },
  async canEditWhenReturned(params: ApprovalSubjectDescriptor): Promise<void> {
    await getBoqReviewRecord(params)
  }
}
