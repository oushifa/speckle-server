import { QUALITY_ACCEPTANCE_FORM_TABLE } from '@/modules/quality-acceptance-form/services/qualityAcceptanceForms'
import { qualityAcceptanceApprovalSubjectHandler } from '@/modules/flow/services/subjectHandlers/formRecords/qualityAcceptance'
import { modelVersionApprovalSubjectHandler } from '@/modules/flow/services/subjectHandlers/modelVersion'
import { monthlyMeasurementApprovalSubjectHandler } from '@/modules/flow/services/subjectHandlers/formRecords/monthlyMeasurements'
import { safetyMeasuresApprovalSubjectHandler } from '@/modules/flow/services/subjectHandlers/formRecords/safetyMeasures'
import {
  getApprovalSubjectHandlerKey,
  type ApprovalSubjectDescriptor,
  type ApprovalSubjectHandler
} from '@/modules/flow/services/subjectHandlers/types'

const genericApprovalSubjectHandler: ApprovalSubjectHandler = {
  async getSubjectSnapshot(params: ApprovalSubjectDescriptor) {
    return {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      subjectTable: params.subjectTable || null,
      projectId: params.projectId
    }
  },
  async canSubmit(): Promise<void> {},
  async canResubmit(): Promise<void> {},
  async canEditWhenReturned(): Promise<void> {}
}

const approvalSubjectHandlers = new Map<string, ApprovalSubjectHandler>([
  [
    getApprovalSubjectHandlerKey({
      subjectType: 'FORM_RECORD',
      subjectTable: QUALITY_ACCEPTANCE_FORM_TABLE
    }),
    qualityAcceptanceApprovalSubjectHandler
  ],
  [
    getApprovalSubjectHandlerKey({
      subjectType: 'MODEL_VERSION'
    }),
    modelVersionApprovalSubjectHandler
  ],
  [
    getApprovalSubjectHandlerKey({
      subjectType: 'FORM_RECORD',
      subjectTable: 'monthly_measurements'
    }),
    monthlyMeasurementApprovalSubjectHandler
  ],
  [
    getApprovalSubjectHandlerKey({
      subjectType: 'FORM_RECORD',
      subjectTable: 'safety_measures'
    }),
    safetyMeasuresApprovalSubjectHandler
  ]
])

export const getApprovalSubjectHandler = (params: {
  subjectType: ApprovalSubjectDescriptor['subjectType']
  subjectTable?: string | null
}) =>
  approvalSubjectHandlers.get(getApprovalSubjectHandlerKey(params)) ||
  genericApprovalSubjectHandler


