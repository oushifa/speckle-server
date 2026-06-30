import type { Knex } from 'knex'
import axios from 'axios'
import dayjs from 'dayjs'
import { BadRequestError } from '@/modules/shared/errors'

// ==========================================
// 辅助方法：读取环境变量配置并获取 API Base URL 与 Token
// ==========================================
const getApiConfig = () => {
  const baseUrl = process.env.BUDGET_API_BASE_URL
  const token = process.env.BUDGET_API_TOKEN

  if (!baseUrl) {
    throw new BadRequestError('系统未配置预算系统接口基地址(BUDGET_API_BASE_URL)')
  }
  if (!token) {
    throw new BadRequestError('系统未配置预算系统授权Token(BUDGET_API_TOKEN)')
  }

  return {
    cleanBaseUrl: baseUrl.replace(/\/$/, ''),
    token,
    pushHeaders: {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超时
    }
  }
}

// ==========================================
// 辅助方法：获取月度验工与项目各项基础公共数据
// ==========================================
const getBaseSyncData = async (params: {
  projectId: string
  measurementId: string
  db: Knex
  projectDb: Knex
}) => {
  const { projectId, measurementId, db, projectDb } = params

  const project = await db('streams').where({ id: projectId }).first()
  if (!project) {
    throw new BadRequestError('项目不存在')
  }

  const measurement = await projectDb('monthly_measurements').where({ id: measurementId }).first()
  if (!measurement) {
    throw new BadRequestError('月度验工单不存在')
  }

  if (measurement.approveStatus !== 'APPROVED') {
    throw new BadRequestError('只有已通过审核的月度验工单才可以同步数据')
  }

  const paymentDetails = await projectDb('monthly_payment_details').where({ measurementId }).first()
  const paymentRequests = await projectDb('monthly_payment_requests').where({ measurementId }).first()

  return { project, measurement, paymentDetails, paymentRequests }
}

export type BudgetSyncType = 'settlement' | 'paymentDetail' | 'paymentPool'

type BudgetSyncPreview = {
  url: string
  requestBody: Record<string, unknown>
}

const buildSettlementInfoSyncPreview = async (params: {
  projectId: string
  measurementId: string
  db: Knex
  projectDb: Knex
}): Promise<BudgetSyncPreview> => {
  const { project, measurement, paymentDetails, paymentRequests } =
    await getBaseSyncData(params)
  const { cleanBaseUrl, token } = getApiConfig()

  const constructionUnitName = project.constructionUnit
    ? (
        await params.db('departments')
          .where({ id: project.constructionUnit })
          .select('name')
          .first()
      )?.name || ''
    : ''

  const confirmedPrice =
    project.contractPrice !== null && project.contractPrice !== undefined
      ? Number(project.contractPrice).toFixed(4)
      : '0.0000'

  const [{ total }] = await params.projectDb('monthly_measurement_items')
    .where('measurementId', params.measurementId)
    .andWhere('isSummaryRow', false)
    .select(
      params.projectDb.raw(
        'SUM(COALESCE("investmentQty", 0) * COALESCE("price", 0)) as total'
      )
    )
  const settlementTotalAmount = Number(total || 0).toFixed(2)

  const ruralLaborsSalary =
    paymentDetails?.migrantWorkerSalary !== null &&
    paymentDetails?.migrantWorkerSalary !== undefined
      ? Number(paymentDetails.migrantWorkerSalary).toFixed(4)
      : '0.0000'

  const baseDateTs = Number(measurement.baseDate)
  const year = dayjs(baseDateTs).format('YYYY')
  const month = dayjs(baseDateTs).format('MM')

  const settlementKeyContentObj = {
    auditreportId: measurement.id,
    budgetContent: project.bidSection || '',
    businessUnit: project.businessUnit || '',
    businessUnitName: project.businessUnitName || '',
    companyID: project.companyId || '',
    companyName: project.employer || '',
    confirmedPrice,
    contractName: project.contractName || '',
    contractNo: project.contractCode || '',
    financialSupervisionComment: paymentRequests?.reqInvestmentOpinion || '',
    financialSupervisionUnit: constructionUnitName,
    month,
    paytToCompany: project.contractor || '',
    CTProjectId: project.projectPackageItemguid || '',
    projectName: project.name || '',
    projectPackageItemguid: project.projectPackageItemguid || '',
    ruralLaborsSalary,
    settlementPhase: measurement.roundName || '0',
    settlementTotalAmount,
    year
  }

  return {
    url: `${cleanBaseUrl}/api/ToPaymentPool/Push_SettlementInfo`,
    requestBody: {
      token,
      settlementKeyContent: settlementKeyContentObj
    }
  }
}

const buildIntermediatePaymentSyncPreview = async (params: {
  projectId: string
  measurementId: string
  db: Knex
  projectDb: Knex
}): Promise<BudgetSyncPreview> => {
  const { projectId, measurementId, projectDb } = params
  const { project, measurement, paymentDetails, paymentRequests } =
    await getBaseSyncData(params)
  const { cleanBaseUrl, token } = getApiConfig()

  const currentItems = await projectDb('monthly_measurement_items').where({
    measurementId
  })

  const boqItems = await projectDb('boq_items')
    .where('projectId', projectId)
    .select('id', 'type', 'parentId', 'amount')
  const boqTypeMap = new Map<string, string>()
  const boqAmountMap = new Map<string, number | null>()
  for (const boq of boqItems) {
    boqTypeMap.set(boq.id, boq.type)
    boqAmountMap.set(boq.id, boq.amount === null ? null : Number(boq.amount))
  }

  const itemMap = new Map<string, any>()
  for (const item of currentItems) {
    itemMap.set(item.boqItemId, {
      record: item,
      children: [],
      contractAmount: 0,
      contractorAmount: 0,
      supervisionAmount: 0,
      headquartersAmount: 0,
      investmentAmount: 0,
      contractorPayAmt: 0,
      investmentPayAmt: 0,
      contractPayAmt: 0,
      leaderPayAmt: 0,
      historyCumulative: 0,
      historyYearly: 0,
      historyPay: 0
    })
  }

  for (const item of currentItems) {
    if (item.boqParentId && itemMap.has(item.boqParentId)) {
      itemMap.get(item.boqParentId)!.children.push(item.boqItemId)
    }
  }

  const calculateAmounts = (boqItemId: string) => {
    const node = itemMap.get(boqItemId)
    if (!node) return

    if (!node.record.isSummaryRow) {
      const price = Number(node.record.price || 0)
      const boqAmt = boqAmountMap.get(node.record.boqItemId)
      if (boqAmt !== undefined && boqAmt !== null) {
        node.contractAmount = boqAmt
      } else {
        node.contractAmount = Number(node.record.pendingTotalQty || 0) * price
      }

      node.contractorAmount = Number(node.record.contractorQty || 0) * price
      node.supervisionAmount = Number(node.record.supervisionQty || 0) * price
      node.headquartersAmount = Number(node.record.headquartersQty || 0) * price
      node.investmentAmount = Number(node.record.investmentQty || 0) * price
      node.contractorPayAmt = Number(node.record.contractorPayAmt || 0)
      node.investmentPayAmt = Number(node.record.investmentPayAmt || 0)
      node.contractPayAmt = Number(node.record.contractPayAmt || 0)
      node.leaderPayAmt = Number(node.record.leaderPayAmt || 0)

      node.historyCumulative = Number(node.record.lastCumulativeQty || 0) * price
      node.historyYearly = Number(node.record.yearlyCumulativeQty || 0) * price
      node.historyPay = Number(node.record.lastCumulativePay || 0)
      return
    }

    for (const childId of node.children) {
      calculateAmounts(childId)
      const child = itemMap.get(childId)
      if (child) {
        node.contractAmount += child.contractAmount
        node.contractorAmount += child.contractorAmount
        node.supervisionAmount += child.supervisionAmount
        node.headquartersAmount += child.headquartersAmount
        node.investmentAmount += child.investmentAmount
        node.contractorPayAmt += child.contractorPayAmt
        node.investmentPayAmt += child.investmentPayAmt
        node.contractPayAmt += child.contractPayAmt
        node.leaderPayAmt += child.leaderPayAmt
        node.historyCumulative += child.historyCumulative
        node.historyYearly += child.historyYearly
        node.historyPay += child.historyPay
      }
    }
  }

  for (const item of currentItems) {
    if (!item.boqParentId || !itemMap.has(item.boqParentId)) {
      calculateAmounts(item.boqItemId)
    }
  }

  const hasCategory = currentItems.some(
    (item) => boqTypeMap.get(item.boqItemId) === 'CATEGORY'
  )
  const aggregatedDisplayItems = currentItems.filter((item) => {
    if (hasCategory) {
      return boqTypeMap.get(item.boqItemId) === 'CATEGORY'
    }
    return !item.boqParentId
  })

  const round2 = (num: number) => Math.round(num * 100) / 100

  const aggregatedList = aggregatedDisplayItems.map((item) => {
    const sums = itemMap.get(item.boqItemId)!
    const cumulativeAmount = sums.historyCumulative + sums.investmentAmount
    return {
      boqItemId: item.boqItemId,
      boqCode: item.boqCode,
      boqName: item.boqName,
      contractAmount: round2(sums.contractAmount),
      investmentAmount: round2(sums.investmentAmount),
      leaderPayAmt: round2(sums.leaderPayAmt),
      cumulativeAmount: round2(cumulativeAmount),
      lastCumulativePay: round2(sums.historyPay)
    }
  })

  const paymentDetailRows: any[] = []
  let totalContract = 0
  let totalThisMoney = 0
  let totalAccuMoney = 0
  let totalThisPayment = 0
  let totalAccuPayment = 0

  aggregatedList.forEach((row) => {
    const contTotalPrice = row.contractAmount
    const thisMoney = row.investmentAmount
    const accuMoney = row.cumulativeAmount
    const thisPayment = thisMoney
    const accuPayment = row.lastCumulativePay + thisPayment

    totalContract += contTotalPrice
    totalThisMoney += thisMoney
    totalAccuMoney += accuMoney
    totalThisPayment += thisPayment
    totalAccuPayment += accuPayment

    paymentDetailRows.push({
      accuMoney: accuMoney.toFixed(2),
      accuPayment: accuPayment.toFixed(2),
      contTotalPrice: contTotalPrice.toFixed(2),
      itemName: row.boqName || '',
      tag: '1',
      thisMoney: thisMoney.toFixed(2),
      thisPayment: thisPayment.toFixed(2),
      typeName: '1'
    })
  })

  const N = aggregatedList.length
  paymentDetailRows.push({
    accuMoney: totalAccuMoney.toFixed(2),
    accuPayment: totalAccuPayment.toFixed(2),
    contTotalPrice: totalContract.toFixed(2),
    itemName: `合计 1-${N}`,
    tag: '4',
    thisMoney: totalThisMoney.toFixed(2),
    thisPayment: totalThisPayment.toFixed(2),
    typeName: `合计 1-${N}`
  })

  const extraPayItems = Array.isArray(paymentDetails?.extraPayItems)
    ? paymentDetails.extraPayItems
    : []
  extraPayItems.forEach((extra: any) => {
    const thisPaymentVal = Number(extra.leaderPayAmt || 0)
    const accuPaymentVal = thisPaymentVal

    paymentDetailRows.push({
      accuPayment: accuPaymentVal.toFixed(2),
      itemName: extra.name || '',
      thisPayment: thisPaymentVal.toFixed(2),
      typeName: extra.category || ''
    })
  })

  const thisPaymentInYuan = Number(paymentDetails?.interimPayProgress || 0) * 10000
  const lastCumulativePaymentInYuan = Number(paymentRequests?.lastCumulativePayment || 0)
  const accuPaymentInYuan = lastCumulativePaymentInYuan + thisPaymentInYuan

  const baseDateTs = Number(measurement.baseDate)
  const year = dayjs(baseDateTs).format('YYYY')
  const month = dayjs(baseDateTs).format('MM')

  const paymentDetailJson = JSON.stringify(paymentDetailRows)

  return {
    url: `${cleanBaseUrl}/api/Push_IntermediatePayementInfo`,
    requestBody: {
      accuPayment: accuPaymentInYuan.toFixed(2),
      auditreportId: measurement.id,
      ctProjectId: project.projectPackageItemguid || '',
      guid: project.projectPackageItemguid || '',
      paymentDetail: paymentDetailJson,
      planToPayLabor: Number(paymentDetails?.migrantWorkerSalary || 0).toFixed(4),
      planToPayTotal: Number(paymentDetails?.interimPayProgress || 0).toFixed(4),
      projectCode: project.projectNumber || '',
      projectName: project.name || '',
      projectPackageItemName: project.contractName || '',
      remark: paymentDetails?.interimRemark || '',
      semipaymentId: measurement.id,
      thisPayment: thisPaymentInYuan.toFixed(2),
      token,
      yearPlanTotalFinance: `${year}${month}`,
      yearPlanTotalWork: '0'
    }
  }
}

const buildPaymentPoolSyncPreview = async (params: {
  projectId: string
  measurementId: string
  db: Knex
  projectDb: Knex
}): Promise<BudgetSyncPreview> => {
  const { measurementId, projectDb, db } = params
  const { project, measurement, paymentDetails, paymentRequests } =
    await getBaseSyncData(params)
  const { cleanBaseUrl, token } = getApiConfig()

  const constructionUnitName = project.constructionUnit
    ? (
        await db('departments')
          .where({ id: project.constructionUnit })
          .select('name')
          .first()
      )?.name || ''
    : ''

  const [{ total }] = await projectDb('monthly_measurement_items')
    .where('measurementId', measurementId)
    .andWhere('isSummaryRow', false)
    .select(
      projectDb.raw(
        'SUM(COALESCE("investmentQty", 0) * COALESCE("price", 0)) as total'
      )
    )
  const settlementTotalAmount = Number(total || 0).toFixed(2)

  const thisPaymentInYuan = Number(paymentDetails?.interimPayProgress || 0) * 10000
  const lastCumulativePaymentInYuan = Number(paymentRequests?.lastCumulativePayment || 0)
  const accuPaymentInYuan = lastCumulativePaymentInYuan + thisPaymentInYuan

  const baseDateTs = Number(measurement.baseDate)
  const year = dayjs(baseDateTs).format('YYYY')
  const month = dayjs(baseDateTs).format('MM')

  const toPaymentPoolModel = {
    Category: 'Construction',
    ProjectName: project.name || '',
    CTProjectID: project.projectPackageItemguid || '',
    ProjectPackageItemGuid: project.projectPackageItemguid || '',
    ProjectPackageItemName: project.contractName || '',
    BudgetCategory: '工程款',
    BudgetContent: '建筑工程投资',
    PaymentPhase: measurement.paymentPhase || '进度款',
    ContractID: project.id,
    ContractNo: project.contractCode || '',
    ContractName: project.contractName || '',
    ContractPrice: Number(project.contractPrice || 0),
    ContractPaymentTotalIncludeCurrent: accuPaymentInYuan,
    ContractPaymentTotalExcludeCurrent: lastCumulativePaymentInYuan,
    ContractWorkloadTotalIncludeCurrent: accuPaymentInYuan,
    ContractWorkloadTotalExcludeCurrent: null,
    HighlightPartName: '',
    HighlightPartPrice: 0.0,
    HighlightPaymentTotalIncludeCurrent2: 0.0,
    HighlightPaymentTotalExcludeCurrent2: null,
    HighlightPartNameLv2: null,
    HighlightPartPriceLv2: null,
    HighlightPaymentTotalIncludeCurrent2Lv2: null,
    HighlightPaymentTotalExcludeCurrent2Lv2: null,
    Year: year,
    Month: month,
    AuditReportId: measurement.id,
    SettlementYearMonth: `${year}${month}`,
    SettlementPhase: measurement.roundName || '0',
    SettlementWorkload: Number(settlementTotalAmount),
    SettlementTotalAmount: Number(settlementTotalAmount),
    SettlementRuralLaborsSalary: null,
    SettlementConstructionAmount: null,
    SettlementMaterialAmount: null,
    SettlementProphaseAmount: null,
    SettlementOtherAmount: null,
    Confirmed: thisPaymentInYuan,
    Estimated: 0.0,
    ConstructionAmount: thisPaymentInYuan,
    RuralLaborsSalary: Number(paymentDetails?.migrantWorkerSalary || 0) * 10000,
    MaterialAmount: 0.0,
    ProphaseAmount: 0.0,
    ProphaseLineMigrationAmount: 0.0,
    ProphaseConstructionAmount: 0.0,
    OtherAmount: 0.0,
    DetailedDescription:
      measurement.detailedDescription || `${year}年${month}月验工计价`,
    GuaranteeLetterValidTo: '',
    PayToCompany: project.contractor || '',
    FinancialSupervisionComment: paymentRequests?.reqInvestmentOpinion || '',
    FinancialSupervisionCompany: constructionUnitName,
    ReceiverBankNameRuralLabor: '',
    ReceiverAccountNameRuralLabor: '',
    ReceiverAccountNumberRuralLabor: '',
    ReceiverBankNameMNC: '',
    ReceiverAccountNameMNC: '',
    ReceiverAccountNumberMNC: '',
    PlanToPayTotalAmount: thisPaymentInYuan,
    BusinessRemark: paymentDetails?.interimRemark || '',
    HasInvoicePlan: 1,
    BusinessUnitID: project.businessUnit || '',
    BusinessUnitName: project.businessUnitName || ''
  }

  return {
    url: `${cleanBaseUrl}/api/ToPaymentPool/PushToPaymentPool`,
    requestBody: {
      token,
      toPaymentPoolModel
    }
  }
}

export const getBudgetSyncPreview = async (params: {
  type: BudgetSyncType
  projectId: string
  measurementId: string
  db: Knex
  projectDb: Knex
}) => {
  if (params.type === 'settlement') {
    return buildSettlementInfoSyncPreview(params)
  }
  if (params.type === 'paymentDetail') {
    return buildIntermediatePaymentSyncPreview(params)
  }
  return buildPaymentPoolSyncPreview(params)
}

// ==========================================
// 【接口 1】同步验工计价结果接口 (Push_SettlementInfo)
// ==========================================
export const syncSettlementInfoToBudget = async (params: {
  projectId: string
  measurementId: string
  db: Knex
  projectDb: Knex
}) => {
  const { pushHeaders } = getApiConfig()
  const { url, requestBody } = await buildSettlementInfoSyncPreview(params)
  console.log('[DEBUG] 开始同步计价结果:')
  console.log(`[DEBUG] 请求URL: ${url}`)
  console.log(`[DEBUG] 请求Body:\n${JSON.stringify(requestBody, null, 2)}`)

  try {
    const response = await axios.post(url, requestBody, pushHeaders)
    const resData = response.data
    console.log('[DEBUG] 计价结果同步返回数据:', JSON.stringify(resData, null, 2))

    const isSuccess = resData?.status === 'Success' || resData?.Status === 'Success'
    if (!isSuccess) {
      throw new Error(resData?.messages || resData?.message || '验工计价接口返回失败状态')
    }
    return { success: true, message: resData?.messages || resData?.message || '计价结果同步成功' }
  } catch (error: any) {
    console.error('[DEBUG] 同步至 Push_SettlementInfo 接口发生异常:')
    if (error.response) {
      console.error('[DEBUG] 异常Response状态:', error.response.status)
      console.error('[DEBUG] 异常Response数据:', JSON.stringify(error.response.data, null, 2))
      console.error('[DEBUG] 异常Response头部:', JSON.stringify(error.response.headers, null, 2))
    } else {
      console.error('[DEBUG] 异常信息:', error.message)
    }
    const errorMsg = error.response?.data?.message || error.response?.data?.messages || error.response?.data?.error || error.message || '网络连接异常'
    throw new Error(`同步计价结果失败: ${errorMsg}`)
  }
}

// ==========================================
// 【接口 2】同步中间支付单信息接口 (Push_IntermediatePayementInfo)
// ==========================================
export const syncIntermediatePaymentInfoToBudget = async (params: {
  projectId: string
  measurementId: string
  db: Knex
  projectDb: Knex
}) => {
  const { pushHeaders } = getApiConfig()
  const { url, requestBody } = await buildIntermediatePaymentSyncPreview(params)
  console.log('[DEBUG] 开始同步中间支付单:')
  console.log(`[DEBUG] 请求URL: ${url}`)
  console.log(`[DEBUG] 请求Body:\n${JSON.stringify(requestBody, null, 2)}`)

  try {
    const response = await axios.post(url, requestBody, pushHeaders)
    const resData = response.data
    console.log('[DEBUG] 中间支付单同步返回数据:', JSON.stringify(resData, null, 2))

    const isSuccess = resData?.status === 'Success' || resData?.Status === 'Success'
    if (!isSuccess) {
      throw new Error(resData?.messages || resData?.message || '中间支付单接口返回失败状态')
    }
    return { success: true, message: resData?.messages || resData?.message || '中间支付单同步成功' }
  } catch (error: any) {
    console.error('[DEBUG] 同步至 Push_IntermediatePayementInfo 接口发生异常:')
    if (error.response) {
      console.error('[DEBUG] 异常Response状态:', error.response.status)
      console.error('[DEBUG] 异常Response数据:', JSON.stringify(error.response.data, null, 2))
      console.error('[DEBUG] 异常Response头部:', JSON.stringify(error.response.headers, null, 2))
    } else {
      console.error('[DEBUG] 异常信息:', error.message)
    }
    const errorMsg = error.response?.data?.message || error.response?.data?.messages || error.response?.data?.error || error.message || '网络连接异常'
    throw new Error(`同步中间支付单失败: ${errorMsg}`)
  }
}

// ==========================================
// 【接口 3】同步待支付申报池接口 (PushToPaymentPool)
// ==========================================
export const syncPaymentPoolToBudget = async (params: {
  projectId: string
  measurementId: string
  db: Knex
  projectDb: Knex
}) => {
  const { pushHeaders } = getApiConfig()
  const { url, requestBody } = await buildPaymentPoolSyncPreview(params)
  console.log('[DEBUG] 开始同步待支付申报池:')
  console.log(`[DEBUG] 请求URL: ${url}`)
  console.log(`[DEBUG] 请求Body:\n${JSON.stringify(requestBody, null, 2)}`)

  try {
    const response = await axios.post(url, requestBody, pushHeaders)
    const resData = response.data
    console.log('[DEBUG] 待支付申报池同步返回数据:', JSON.stringify(resData, null, 2))

    const isSuccess = resData?.status === 'Success' || resData?.Status === 'Success'
    if (!isSuccess) {
      throw new Error(resData?.messages || resData?.message || '待支付申报池接口返回失败状态')
    }
    return { success: true, message: resData?.messages || resData?.message || '待支付池同步成功' }
  } catch (error: any) {
    console.error('[DEBUG] 同步至 PushToPaymentPool 接口发生异常:')
    if (error.response) {
      console.error('[DEBUG] 异常Response状态:', error.response.status)
      console.error('[DEBUG] 异常Response数据:', JSON.stringify(error.response.data, null, 2))
      console.error('[DEBUG] 异常Response头部:', JSON.stringify(error.response.headers, null, 2))
    } else {
      console.error('[DEBUG] 异常信息:', error.message)
    }
    const errorMsg = error.response?.data?.message || error.response?.data?.messages || error.response?.data?.error || error.message || '网络连接异常'
    throw new Error(`同步至待支付申报池失败: ${errorMsg}`)
  }
}
