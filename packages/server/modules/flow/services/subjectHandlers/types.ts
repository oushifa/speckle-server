import type { ApprovalBindingSubjectType } from '@/modules/flow/services/approvalBindings'

export type ApprovalSubjectDescriptor = {
  projectId: string
  subjectType: ApprovalBindingSubjectType
  subjectId: string
  subjectTable?: string | null
}

export type ApprovalSubjectSnapshot = Record<string, unknown>

export interface ApprovalSubjectHandler {
  getSubjectSnapshot(params: ApprovalSubjectDescriptor): Promise<ApprovalSubjectSnapshot>
  canSubmit(params: ApprovalSubjectDescriptor): Promise<void>
  canResubmit(params: ApprovalSubjectDescriptor): Promise<void>
  canEditWhenReturned(params: ApprovalSubjectDescriptor): Promise<void>
}

export const getApprovalSubjectHandlerKey = (params: {
  subjectType: ApprovalBindingSubjectType
  subjectTable?: string | null
}) => {
  if (params.subjectType === 'FORM_RECORD') {
    return `${params.subjectType}:${params.subjectTable || '*'}`
  }

  return params.subjectType
}
