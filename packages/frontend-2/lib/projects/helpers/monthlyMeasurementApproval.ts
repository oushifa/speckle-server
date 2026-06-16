export const monthlyMeasurementFlowStepOrder = [
  '开始',
  '施工单位',
  '施工监理经办人',
  '施工监理总监',
  '现场指挥部经办人',
  '现场指挥',
  '投资监理经办人',
  '投资监理总监',
  '合约管理部经办人',
  '合约管理部负责人',
  '分管领导',
  '结束'
] as const

export type MonthlyMeasurementFlowStatus = {
  approveStatus?: string | null
  currentStepName?: string | null
  currentStepApprovers?: string[] | null
}

export type MonthlyMeasurementFlowStepName =
  (typeof monthlyMeasurementFlowStepOrder)[number]

export const monthlyMeasurementPermissionStepMap = {
  contractor: ['施工单位'],
  supervision: ['施工监理经办人', '施工监理总监'],
  headquarters: ['现场指挥部经办人', '现场指挥'],
  investment: ['投资监理经办人', '投资监理总监'],
  contract: ['合约管理部经办人', '合约管理部负责人'],
  leader: ['分管领导'],
  owner: ['合约管理部负责人', '分管领导']
} as const

export type MonthlyMeasurementPermissionKey =
  keyof typeof monthlyMeasurementPermissionStepMap

export type MonthlyMeasurementPermissions = Record<
  MonthlyMeasurementPermissionKey,
  boolean
>

export const getMonthlyMeasurementPermissions = (
  state: MonthlyMeasurementFlowStatus
): MonthlyMeasurementPermissions => {
  const isDraft = !state.approveStatus || state.approveStatus === 'START'
  const stepName = (state.currentStepName || '').trim()

  if (isDraft) {
    return {
      contractor: true,
      supervision: false,
      headquarters: false,
      investment: false,
      contract: false,
      leader: false,
      owner: false
    }
  }

  const isStep = (names: readonly string[]) => names.includes(stepName)

  return {
    contractor: isStep(monthlyMeasurementPermissionStepMap.contractor),
    supervision: isStep(monthlyMeasurementPermissionStepMap.supervision),
    headquarters: isStep(monthlyMeasurementPermissionStepMap.headquarters),
    investment: isStep(monthlyMeasurementPermissionStepMap.investment),
    contract: isStep(monthlyMeasurementPermissionStepMap.contract),
    leader: isStep(monthlyMeasurementPermissionStepMap.leader),
    owner: isStep(monthlyMeasurementPermissionStepMap.owner)
  }
}

export type MonthlyMeasurementAuditDisplayStatus =
  | '待审核'
  | '审核中'
  | '已审核'
  | '已退回'
  | '已取消'

const getNormalizedMonthlyMeasurementStepName = (
  state: MonthlyMeasurementFlowStatus
) => {
  return (state.currentStepName || '').trim()
}

const getNormalizedMonthlyMeasurementApprovers = (
  state: MonthlyMeasurementFlowStatus
) => {
  return (state.currentStepApprovers || []).filter(
    (approver): approver is string => typeof approver === 'string' && !!approver.trim()
  )
}

export const getMonthlyMeasurementAuditDisplayStatus = (
  state: MonthlyMeasurementFlowStatus,
  stepNames: readonly string[]
): MonthlyMeasurementAuditDisplayStatus => {
  const approveStatus = (state.approveStatus || '').trim().toUpperCase()
  if (approveStatus === 'APPROVED') return '已审核'
  if (approveStatus === 'REJECTED') return '已退回'
  if (approveStatus === 'CANCELED') return '已取消'

  const targetIndexes = stepNames
    .map((name) =>
      monthlyMeasurementFlowStepOrder.indexOf(
        name as (typeof monthlyMeasurementFlowStepOrder)[number]
      )
    )
    .filter((index) => index >= 0)

  if (!targetIndexes.length) return '待审核'
  if (approveStatus === 'START' || !approveStatus) return '待审核'

  const currentStepName = getNormalizedMonthlyMeasurementStepName(state)
  const currentStepIndex = monthlyMeasurementFlowStepOrder.indexOf(
    currentStepName as (typeof monthlyMeasurementFlowStepOrder)[number]
  )

  if (currentStepIndex < 0) return '审核中'

  const firstIndex = Math.min(...targetIndexes)
  const lastIndex = Math.max(...targetIndexes)

  if (currentStepIndex < firstIndex) return '待审核'
  if (currentStepIndex > lastIndex) return '已审核'
  return '审核中'
}

export const getMonthlyMeasurementCurrentFlowInstance = (
  state: MonthlyMeasurementFlowStatus,
  stepNames: readonly string[]
) => {
  const currentStepName = getNormalizedMonthlyMeasurementStepName(state)
  const currentStepApprovers = getNormalizedMonthlyMeasurementApprovers(state)
  const currentStepApproverText = currentStepApprovers.join('、')
  const displayStatus = getMonthlyMeasurementAuditDisplayStatus(state, stepNames)
  const isCurrentStep = stepNames.some((stepName) => stepName === currentStepName)
  const isReached = displayStatus !== '待审核'

  return {
    currentStepName,
    currentStepApprovers,
    currentStepApproverText,
    displayStatus,
    isCurrentStep,
    isReached
  }
}

export const getMonthlyMeasurementFlowSignerDisplay = (
  state: MonthlyMeasurementFlowStatus,
  stepNames: readonly string[],
  storedValue?: string | null,
  options?: {
    useCurrentApprovers?: boolean
  }
) => {
  const normalizedStoredValue = (storedValue || '').trim()
  const flowInstance = getMonthlyMeasurementCurrentFlowInstance(state, stepNames)
  if (!flowInstance.isReached) return ''
  if ((options?.useCurrentApprovers ?? true) && flowInstance.isCurrentStep) {
    return flowInstance.currentStepApproverText || normalizedStoredValue
  }
  return normalizedStoredValue
}
