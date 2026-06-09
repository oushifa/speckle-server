import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { QUALITY_ACCEPTANCE_FORM_TABLE } from '@/modules/quality-acceptance-form/services/qualityAcceptanceForms'
import { getQualityAcceptanceFormByIdFactory } from '@/modules/quality-acceptance-form/repositories/qualityAcceptanceForms'
import { BadRequestError, NotFoundError } from '@/modules/shared/errors'
import type {
  ApprovalSubjectDescriptor,
  ApprovalSubjectHandler,
  ApprovalSubjectSnapshot
} from '@/modules/flow/services/subjectHandlers/types'

const assertQualityAcceptanceSubject = (params: ApprovalSubjectDescriptor) => {
  if (params.subjectType !== 'FORM_RECORD') {
    throw new BadRequestError('Quality acceptance handler only supports FORM_RECORD')
  }
  if (params.subjectTable !== QUALITY_ACCEPTANCE_FORM_TABLE) {
    throw new BadRequestError('Unexpected subjectTable for quality acceptance handler')
  }
}

const getQualityAcceptanceForm = async (params: ApprovalSubjectDescriptor) => {
  assertQualityAcceptanceSubject(params)
  const projectDb = await getProjectDbClient({ projectId: params.projectId })
  const getFormById = getQualityAcceptanceFormByIdFactory({ db: projectDb })
  const form = await getFormById({
    formId: params.subjectId,
    projectId: params.projectId
  })
  if (!form) {
    throw new NotFoundError('Quality acceptance form not found')
  }
  return form
}

export const qualityAcceptanceApprovalSubjectHandler: ApprovalSubjectHandler = {
  async getSubjectSnapshot(
    params: ApprovalSubjectDescriptor
  ): Promise<ApprovalSubjectSnapshot> {
    const form = await getQualityAcceptanceForm(params)
    return {
      subjectType: 'FORM_RECORD',
      subjectTable: QUALITY_ACCEPTANCE_FORM_TABLE,
      formId: form.id,
      projectId: form.project_id || params.projectId,
      title: form.name || null,
      code: form.code || null,
      inspectionLotNumber: form.inspectionLotNumber || null,
      acceptancePart: form.acceptancePart || null,
      acceptanceContent: form.acceptanceContent || null,
      inspector: form.inspector || null,
      unit: form.unit || null,
      workVolume: form.workVolume ?? null,
      creator: form.creator || null,
      actualStartDate: form.actualStartDate || null,
      actualFinishDate: form.actualFinishDate || null,
      BIM: form.BIM || null,
      attachments: form.attachments || null,
      updatedAt:
        form.updatedAt instanceof Date ? form.updatedAt.toISOString() : form.updatedAt
    }
  },
  async canSubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getQualityAcceptanceForm(params)
  },
  async canResubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getQualityAcceptanceForm(params)
  },
  async canEditWhenReturned(params: ApprovalSubjectDescriptor): Promise<void> {
    await getQualityAcceptanceForm(params)
  }
}
