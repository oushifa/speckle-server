export const ApprovalFlowCategory = {
  MODEL_REVIEW: { id: 'MODEL_REVIEW', name: '模型审核', resourceType: 'MODEL' },
  MONTHLY_INSPECTION: { id: 'MONTHLY_INSPECTION', name: '月度验工', resourceType: 'FORMS' },
  SAFETY_MEASURE: { id: 'SAFETY_MEASURE', name: '安全文明措施费', resourceType: 'FORMS' }
} as const

export type ApprovalFlowCategoryId = keyof typeof ApprovalFlowCategory

export const normalizeCategory = (category: string | null | undefined): ApprovalFlowCategoryId => {
  const c = category?.trim()
  if (!c) return 'MONTHLY_INSPECTION'
  if (c === 'MODEL_REVIEW' || c === '模型审核' || c === '模型' || c === '模型管理') {
    return 'MODEL_REVIEW'
  }
  if (
    c === 'SAFETY_MEASURE' ||
    c === '安全文明措施费' ||
    c === '安全文明措施'
  ) {
    return 'SAFETY_MEASURE'
  }
  if (
    c === 'MONTHLY_INSPECTION' ||
    c === '月度验工' ||
    c === '表单' ||
    c === '质量验收' ||
    c === '验工计价'
  ) {
    return 'MONTHLY_INSPECTION'
  }
  return 'MONTHLY_INSPECTION'
}
