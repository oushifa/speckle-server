import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { BadRequestError, NotFoundError } from '@/modules/shared/errors'
import type {
  ApprovalSubjectDescriptor,
  ApprovalSubjectHandler,
  ApprovalSubjectSnapshot
} from '@/modules/flow/services/subjectHandlers/types'

const SAFETY_MEASURES_TABLE = 'safety_measures'

const assertSafetyMeasureSubject = (params: ApprovalSubjectDescriptor) => {
  if (params.subjectType !== 'FORM_RECORD') {
    throw new BadRequestError('Safety measure handler only supports FORM_RECORD')
  }
  if (params.subjectTable !== SAFETY_MEASURES_TABLE) {
    throw new BadRequestError('Unexpected subjectTable for safety measure handler')
  }
}

const getSafetyMeasure = async (params: ApprovalSubjectDescriptor) => {
  assertSafetyMeasureSubject(params)
  const projectDb = await getProjectDbClient({ projectId: params.projectId })
  const measurement = await projectDb(SAFETY_MEASURES_TABLE)
    .where('id', params.subjectId)
    .andWhere('project_id', params.projectId)
    .first()
  if (!measurement) {
    throw new NotFoundError('Safety measure not found')
  }
  return { measurement, projectDb }
}

export const safetyMeasuresApprovalSubjectHandler: ApprovalSubjectHandler = {
  async getSubjectSnapshot(
    params: ApprovalSubjectDescriptor
  ): Promise<ApprovalSubjectSnapshot> {
    const { measurement, projectDb } = await getSafetyMeasure(params)
    const items = await projectDb('safety_measure_items')
      .where('safetyMeasureId', measurement.id)
      .orderBy('sortIndex', 'asc')
      .orderBy('boqDepth', 'asc')
      .orderBy('boqCode', 'asc')
      .orderBy('id', 'asc')

    return {
      subjectType: 'FORM_RECORD',
      subjectTable: SAFETY_MEASURES_TABLE,
      measurementId: measurement.id,
      projectId: measurement.project_id || params.projectId,
      unit: measurement.unit || null,
      code: measurement.code || null,
      baseDate: measurement.baseDate || null,
      creator: measurement.creator || null,
      createdAt:
        measurement.createdAt instanceof Date
          ? measurement.createdAt.toISOString()
          : measurement.createdAt,
      updatedAt:
        measurement.updatedAt instanceof Date
          ? measurement.updatedAt.toISOString()
          : measurement.updatedAt,
      items: items.map((item: any) => ({
        id: item.id,
        boqItemId: item.boqItemId || null,
        boqCode: item.boqCode || null,
        boqName: item.boqName || null,
        boqParentId: item.boqParentId || null,
        boqDepth: item.boqDepth ?? null,
        isSummaryRow: Boolean(item.isSummaryRow),
        sortIndex: item.sortIndex ?? null,
        uom: item.uom || null,
        price: item.price ?? 0,
        contractQty: item.contractQty ?? 0,
        contractAmount: item.contractAmount ?? 0,
        contractorQty: item.contractorQty ?? 0,
        supervisionQty: item.supervisionQty ?? 0,
        headquartersQty: item.headquartersQty ?? 0,
        engineeringQty: item.engineeringQty ?? 0,
        contractDeptQty: item.contractDeptQty ?? 0
      }))
    }
  },
  async canSubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getSafetyMeasure(params)
  },
  async canResubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getSafetyMeasure(params)
  },
  async canEditWhenReturned(params: ApprovalSubjectDescriptor): Promise<void> {
    await getSafetyMeasure(params)
  }
}
