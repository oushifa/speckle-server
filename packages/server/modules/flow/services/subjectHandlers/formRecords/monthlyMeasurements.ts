import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getMonthlyMeasurementByIdForProjectFactory,
  getMonthlyMeasurementItemsFactory
} from '@/modules/quality-acceptance-form/repositories/monthlyMeasurements'
import { BadRequestError, NotFoundError } from '@/modules/shared/errors'
import type {
  ApprovalSubjectDescriptor,
  ApprovalSubjectHandler,
  ApprovalSubjectSnapshot
} from '@/modules/flow/services/subjectHandlers/types'

const MONTHLY_MEASUREMENT_TABLE = 'monthly_measurements'

const assertMonthlyMeasurementSubject = (params: ApprovalSubjectDescriptor) => {
  if (params.subjectType !== 'FORM_RECORD') {
    throw new BadRequestError('Monthly measurement handler only supports FORM_RECORD')
  }
  if (params.subjectTable !== MONTHLY_MEASUREMENT_TABLE) {
    throw new BadRequestError('Unexpected subjectTable for monthly measurement handler')
  }
}

const getMonthlyMeasurement = async (params: ApprovalSubjectDescriptor) => {
  assertMonthlyMeasurementSubject(params)
  const projectDb = await getProjectDbClient({ projectId: params.projectId })
  const getMeasurementById = getMonthlyMeasurementByIdForProjectFactory({
    db: projectDb
  })
  const measurement = await getMeasurementById({
    measurementId: params.subjectId,
    projectId: params.projectId
  })
  if (!measurement) {
    throw new NotFoundError('Monthly measurement not found')
  }
  return { measurement, projectDb }
}

export const monthlyMeasurementApprovalSubjectHandler: ApprovalSubjectHandler = {
  async getSubjectSnapshot(
    params: ApprovalSubjectDescriptor
  ): Promise<ApprovalSubjectSnapshot> {
    const { measurement, projectDb } = await getMonthlyMeasurement(params)
    const getItems = getMonthlyMeasurementItemsFactory({ db: projectDb })
    const items = await getItems(measurement.id)

    return {
      subjectType: 'FORM_RECORD',
      subjectTable: MONTHLY_MEASUREMENT_TABLE,
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
      items: items.map((item) => ({
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
        pendingTotalQty: item.pendingTotalQty ?? 0,
        approvedCumulativeQty: item.approvedCumulativeQty ?? 0,
        measuredQty: item.measuredQty ?? 0,
        remark: item.remark || null,
        sourceAcceptanceIds: item.sourceAcceptanceIds || []
      }))
    }
  },
  async canSubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getMonthlyMeasurement(params)
  },
  async canResubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getMonthlyMeasurement(params)
  },
  async canEditWhenReturned(params: ApprovalSubjectDescriptor): Promise<void> {
    await getMonthlyMeasurement(params)
  }
}
