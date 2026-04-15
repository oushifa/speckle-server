/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TokenResourceIdentifierType } from '@/modules/core/domain/tokens/types'
import type { BaseMetaRecord } from '@/modules/core/helpers/meta'
import type { Nullable } from '@/modules/shared/helpers/typeHelper'
import type { ServerRoles } from '@speckle/shared'

export type UserRecord = {
  id: string
  suuid: string
  createdAt: Date
  name: string
  bio: Nullable<string>
  company: Nullable<string>
  email: string
  verified: boolean
  avatar: Nullable<string>
  profiles: Nullable<string>
  /**
   * Marked as optional, cause most queries delete it
   */
  passwordDigest?: Nullable<string>
  ip: Nullable<string>
}

/**
 * Reduced record with fields that are OK to show publicly
 */
export type LimitedUserRecord = Pick<
  UserRecord,
  'id' | 'name' | 'bio' | 'company' | 'verified' | 'avatar' | 'createdAt'
>

export type UserWithRole<User extends LimitedUserRecord = UserRecord> = User & {
  role: ServerRoles
}

export type UsersMetaRecord<V = any> = {
  userId: string
} & BaseMetaRecord<V>

export type ServerAclRecord = {
  userId: string
  role: string
}

export const ProjectRecordVisibility = <const>{
  Public: 'public',
  Private: 'private',
  Workspace: 'workspace'
}

export type ProjectRecordVisibility =
  (typeof ProjectRecordVisibility)[keyof typeof ProjectRecordVisibility]

export type StreamRecord = {
  id: string
  name: string
  address: Nullable<string>
  progress: Nullable<number>
  startDate: Nullable<bigint>
  endDate: Nullable<bigint>
  timeZone: Nullable<string>
  responsible: Nullable<string>
  status: Nullable<string>
  description: Nullable<string>
  clonedFrom: Nullable<string>
  createdAt: Date
  updatedAt: Date
  allowPublicComments: boolean
  workspaceId: Nullable<string>
  regionKey: Nullable<string>
  visibility: ProjectRecordVisibility
}

export type StreamAclRecord = {
  userId: string
  resourceId: string
  role: string
}

export type StreamFavoriteRecord = {
  streamId: string
  userId: string
  createdAt: Date
  cursor: string
}

export type ServerConfigRecord = {
  id: number
  name: string
  company: string
  description: string
  adminContact: string
  termsOfService: string
  canonicalUrl: string
  completed: boolean
  inviteOnly: boolean
  guestModeEnabled: boolean
}

export type ServerInfo = ServerConfigRecord & {
  /**
   * Dynamically resolved from env vars
   */
  version: string
  migration?: { movedFrom?: string; movedTo?: string }
  configuration: {
    objectSizeLimitBytes: number
    objectMultipartUploadSizeLimitBytes: number
    isEmailEnabled: boolean
    emailVerificationTimeoutMinutes: number
  }
}

export type CommitRecord = {
  id: string
  referencedObject: string
  author: Nullable<string>
  message: Nullable<string>
  createdAt: Date
  sourceApplication: Nullable<string>
  totalChildrenCount: Nullable<number>
  parents: Nullable<string[]>
}

export type BranchCommitRecord = {
  branchId: string
  commitId: string
}

export type StreamCommitRecord = {
  streamId: string
  commitId: string
}

export type BranchRecord = {
  id: string
  streamId: string
  authorId: string | null
  name: string
  description: Nullable<string>
  approveStatus?: Nullable<string>
  createdAt: Date
  updatedAt: Date
}

export type QualityAcceptanceFormRecord = {
  id: string
  name?: Nullable<string>
  boqItemId?: Nullable<string>
  code?: Nullable<string>
  inspectionLotNumber?: Nullable<string>
  acceptancePart?: Nullable<string>
  acceptanceContent?: Nullable<string>
  actualStartDate?: Nullable<string>
  actualFinishDate?: Nullable<string>
  inspector?: Nullable<string>
  attachments?: Nullable<string[]>
  creator?: Nullable<string>
  project_id?: Nullable<string>
  workVolume?: Nullable<number>
  unit?: Nullable<string>
  BIMelement?: Nullable<string[]>
  bimElements?: Nullable<{
    modelId?: Nullable<string>
    bimIds?: Nullable<string[]>
  }>
  timeZone?: Nullable<string>
  approveStatus?: Nullable<string>
  createdAt: Date
  updatedAt: Date
}

export type MonthlyMeasurementRecord = {
  id: string
  project_id: string
  unit?: Nullable<string>
  code: string
  baseDate: string
  approveStatus?: Nullable<string>
  flowInstanceId?: Nullable<string>
  creator?: Nullable<string>
  createdAt: Date
  updatedAt: Date
}

export type MonthlyMeasurementItemRecord = {
  id: string
  measurementId: string
  boqItemId: string
  boqCode?: Nullable<string>
  boqName?: Nullable<string>
  boqParentId?: Nullable<string>
  boqDepth: number
  isSummaryRow: boolean
  sortIndex: number
  uom?: Nullable<string>
  pendingTotalQty?: Nullable<number>
  approvedCumulativeQty?: Nullable<number>
  measuredQty?: Nullable<number>
  price?: Nullable<number>
  remark?: Nullable<string>
  sourceAcceptanceIds?: Nullable<string[]>
  createdAt: Date
  updatedAt: Date
}

export type ModelFolderRecord = {
  id: string
  streamId: string
  parentFolderId: Nullable<string>
  name: string
  createdAt: Date
  updatedAt: Date
}

export type ModelFolderModelRecord = {
  folderId: string
  modelId: string
  streamId: string
  createdAt: Date
}

export type ApprovalFlowDefinitionRecord = {
  id: string
  templateId: string
  projectId: Nullable<string>
  name: string
  resourceType: string
  isActive: boolean
  version: number
  previousVersionId: Nullable<string>
  triggerConfig: Nullable<Record<string, unknown>>
  effectConfig: Nullable<Record<string, unknown>>
  formSchema: Nullable<
    Array<{
      key: string
      name: string
      type: string
      required?: boolean
      placeholder?: string | null
      options?: Array<{
        label: string
        value: string
      }>
    }>
  >
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type ApprovalFlowInstanceRecord = {
  id: string
  definitionId: Nullable<string>
  templateId: string
  definitionVersion: Nullable<number>
  projectId: Nullable<string>
  resourceType: string
  resourceId: Nullable<string>
  formData: Nullable<Record<string, unknown>>
  flowSnapshot: Nullable<Record<string, unknown>>
  status: string
  currentStep: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type ApprovalFlowActionRecord = {
  id: string
  instanceId: string
  stepId: Nullable<string>
  action: string
  fromStatus: Nullable<string>
  toStatus: Nullable<string>
  comment: Nullable<string>
  metadata: Nullable<Record<string, unknown>>
  actorId: string
  createdAt: Date
}

export type ApprovalFlowDefinitionStepRecord = {
  id: string
  definitionId: string
  name: string
  stepIndex: number
  approverIds: string[]
  requiredApprovals: number
  timeoutHours: Nullable<number>
  createdAt: Date
}

export type ApprovalFlowInstanceStepRecord = {
  id: string
  instanceId: string
  definitionStepId: Nullable<string>
  name: string
  stepIndex: number
  status: string
  approverIds: string[]
  requiredApprovals: number
  approvedByIds: string[]
  stepSnapshot: Nullable<Record<string, unknown>>
  startedAt: Nullable<Date>
  dueAt: Nullable<Date>
  completedAt: Nullable<Date>
  createdAt: Date
}

export type ApprovalFlowInstanceStepFormSnapshotRecord = {
  id: string
  instanceId: string
  stepId: string
  stepIndex: number
  snapshotType: string
  sourceType: string
  sourceId: Nullable<string>
  triggeredBy: string
  actionId: Nullable<string>
  formSnapshot: Record<string, unknown>
  createdAt: Date
}

export type ObjectRecord = {
  id: string
  speckleType: string
  totalChildrenCount: Nullable<number>
  totalChildrenCountByDepth: Nullable<Record<string, unknown>>
  createdAt: Date
  data: Nullable<Record<string, unknown>>
  streamId: string
}

export type InvalidTokenResult = {
  valid: false
  /**
   * The ID of the token used for validation.
   * This is the first 10 characters of the token string.
   */
  tokenId: string
}

export type ValidTokenResult = {
  valid: true
  scopes: string[]
  userId: string
  /**
   * The ID of the token used for validation.
   * This is the first 10 characters of the token string.
   */
  tokenId: string
  role: ServerRoles
  /**
   * Set, if the token is an app token
   */
  appId: Nullable<string>
  /**
   * Set, if the token has resource access limits (e.g. only access to specific projects)
   */
  resourceAccessRules: Nullable<TokenResourceAccessRecord[]>
}

export type TokenValidationResult = InvalidTokenResult | ValidTokenResult

export type TokenScopesRecord = {
  tokenId: string
  scopeName: string
}

export type ServerAppRecord = {
  id: string
  secret: Nullable<string>
  name: string
  description: Nullable<string>
  termsAndConditionsLink: Nullable<string>
  logo: Nullable<string>
  public: boolean
  trustByDefault: boolean
  authorId: string
  createdAt: Date
  redirectUrl: string
}

export type TokenResourceAccessRecord = {
  tokenId: string
  resourceId: string
  resourceType: TokenResourceIdentifierType
}
