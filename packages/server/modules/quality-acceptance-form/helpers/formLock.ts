/**
 * 质量验收单的"锁定"判定。
 *
 * 业务规则：查验中（PENDING）、已查验（APPROVED）的单据已经进入查验流程，
 * 禁止编辑（含附件上传）；被月度验工占用（occupiedMeasurementId 非空）的单据同样禁止编辑。
 * 前端列表按钮、GraphQL 更新接口、Excel/第三方导入共用这里的判定，避免口径不一致。
 */
export const LOCKED_QUALITY_ACCEPTANCE_APPROVE_STATUSES = [
  'PENDING',
  'APPROVED'
] as const

export const normalizeQualityAcceptanceApproveStatus = (
  status?: string | number | null
): string =>
  status === null || status === undefined ? '' : String(status).trim().toUpperCase()

export const isQualityAcceptanceFormStatusLocked = (params: {
  approveStatus?: string | number | null
}): boolean =>
  (LOCKED_QUALITY_ACCEPTANCE_APPROVE_STATUSES as readonly string[]).includes(
    normalizeQualityAcceptanceApproveStatus(params.approveStatus)
  )

export const isQualityAcceptanceFormLocked = (params: {
  approveStatus?: string | number | null
  occupiedMeasurementId?: string | null
}): boolean =>
  !!params.occupiedMeasurementId || isQualityAcceptanceFormStatusLocked(params)

export const QUALITY_ACCEPTANCE_LOCKED_BY_STATUS_MESSAGE =
  '该质量验收单处于查验中或已查验状态，不可编辑'
export const QUALITY_ACCEPTANCE_OCCUPIED_MESSAGE =
  '该质量验收单已被月度验工关联，不可修改'
