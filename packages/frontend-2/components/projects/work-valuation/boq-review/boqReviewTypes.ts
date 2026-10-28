/**
 * 清单复核与签证变更管理 —— 前端核心类型定义与纯计算函数
 * 适配 sznb 审批流规范与三方工程量（施工单位 -> 财务监理 -> 合约部）核定机制
 */

export type ReviewKind = 'review' | 'change'

export type ReviewStage = 'contractor' | 'supervisor' | 'contract'

export type ApproveStatus =
  | 'START'
  | 'DRAFT'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'RETURNED'
  | 'REJECTED'
  | 'APPROVED'
  | 'CANCELED'
  | 'CANCELLED'

export type ReviewRowSource = 'create' | 'import' | 'file'

export interface BoqReviewRow {
  id: string
  recordId?: string
  projectId?: string
  sortIndex?: number
  source: ReviewRowSource
  boqItemId?: string | null
  sourceCode?: string | null
  parentCode?: string | null
  code: string
  name: string
  unit: string
  /** 原变更/签证量（只读基数，主要用于签证变更单） */
  baseChangeQty: number | string
  /** 复核量（施工单位填报） */
  reviewQty?: number | string
  /** 财务监理审核复核量 */
  reviewQtySupervisor?: number | string
  /** 合约部审核复核量 */
  reviewQtyContract?: number | string
  /** 变更/签证量（本次增量，施工单位填报） */
  changeQty?: number | string
  /** 财务监理审核本次签证变更量 */
  changeQtySupervisor?: number | string
  /** 合约部审核本次签证变更量 */
  changeQtyContract?: number | string
  /** 复核单价（元） */
  reviewUnitPrice: number | string
  beforeSnapshot?: Record<string, unknown> | null
  afterSnapshot?: Record<string, unknown> | null
}

export interface BoqReviewAttachment {
  id?: string
  name: string
  size?: number | string
  blobId?: string
  url?: string
  uploadedAt?: string
  uploadedBy?: string
}

export interface BoqReviewHistoryEntry {
  at: string
  by: string
  action: string
  reason?: string
  createdCount?: number
  updatedCount?: number
}

export interface BoqReviewStepChainItem {
  id: string
  stepIndex: number
  name: string
  status: string
  approverIds: string[]
  approverNames: string[]
  approverUsers?: Array<{ id: string; name: string }>
  approvedByIds?: string[]
  approvedByNames?: string[]
  approvedByUsers?: Array<{ id: string; name: string }>
  requiredApprovals?: number
  startedAt?: string | null
  completedAt?: string | null
}

export interface BoqReviewActionItem {
  id: string
  instanceId: string
  stepId?: string | null
  stepName?: string | null
  action: string
  actorId: string
  actorName: string
  fromStatus?: string | null
  toStatus?: string | null
  comment?: string | null
  createdAt: string
}

export interface BoqReviewRecord {
  id: string
  projectId: string
  kind: ReviewKind
  code: string
  reason: string
  applicant: string
  applicantId?: string | null
  applyDate: string
  approveStatus: ApproveStatus
  flowInstanceId?: string | null
  bindingId?: string | null
  effectiveAt?: string | null
  attachments: BoqReviewAttachment[]
  history: BoqReviewHistoryEntry[]
  itemCount: number
  reviewTotalAmount?: number
  changeTotalAmount?: number
  totalAmount?: number
  currentStep?: number | null
  currentStepName?: string
  currentStepApprovers?: string[]
  currentStage: ReviewStage
  approvalChain?: BoqReviewStepChainItem[]
  steps?: BoqReviewStepChainItem[]
  actions?: BoqReviewActionItem[]
  rows: BoqReviewRow[]
  createdAt: string
  updatedAt: string
}

// ─── 页面元数据 ─────────────────────────────────────────────────────────────

export const KIND_META = {
  review: {
    prefix: 'FH',
    title: '复核工程量',
    tabLabel: '复核工程量管理',
    createLabel: '+ 新增复核工程量',
    reasonLabel: '复核原因',
    addLabel: '新增清单项',
    short: '复核单'
  },
  change: {
    prefix: 'QZ',
    title: '签证变更量',
    tabLabel: '签证变更管理',
    createLabel: '+ 新增签证变更量',
    reasonLabel: '签证变更原因',
    addLabel: '新增清单项',
    short: '签证变更单'
  }
} as const

export const ROLE_META: Record<
  ReviewStage,
  { label: string; short: string; nextStage: ReviewStage | null }
> = {
  contractor: { label: '施工单位', short: '施工', nextStage: 'supervisor' },
  supervisor: { label: '财务监理', short: '监理', nextStage: 'contract' },
  contract: { label: '合约部', short: '合约', nextStage: null }
}

export const STATUS_META: Record<
  string,
  { label: string; tone: 'warning' | 'primary' | 'success' | 'danger' | 'neutral' }
> = {
  START: { label: '草稿', tone: 'warning' },
  DRAFT: { label: '草稿', tone: 'warning' },
  PENDING: { label: '审批中', tone: 'primary' },
  IN_REVIEW: { label: '审批中', tone: 'primary' },
  RETURNED: { label: '已退回', tone: 'warning' },
  REJECTED: { label: '已驳回', tone: 'danger' },
  APPROVED: { label: '已生效', tone: 'success' },
  CANCELED: { label: '已取消', tone: 'neutral' },
  CANCELLED: { label: '已取消', tone: 'neutral' }
}

export function formatApproveStatusBadge(
  status: string | null | undefined,
  currentStepName?: string | null
): { label: string; tone: 'warning' | 'primary' | 'success' | 'danger' | 'neutral' } {
  const norm = String(status || 'START').toUpperCase()
  if ((norm === 'PENDING' || norm === 'IN_REVIEW') && currentStepName) {
    return {
      label: `待${currentStepName}`,
      tone: 'primary'
    }
  }
  return STATUS_META[norm] || { label: norm || '未知', tone: 'neutral' }
}

// ─── 数值解析与格式化 ────────────────────────────────────────────────────────

export function toNum(v: string | number | undefined | null): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function parseOptionalNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined
  const cleaned = typeof val === 'number' ? val : Number(String(val).replace(/,/g, ''))
  return Number.isFinite(cleaned) ? cleaned : undefined
}

export function roundTo(val: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round((val + Number.EPSILON) * factor) / factor
}

export function normalizeNumberText(input: unknown): string | null {
  if (input === null || input === undefined) return null
  const s = String(input)
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\uFF0E/g, '.')
    .replace(/\uFF0C/g, ',')
    .replace(/[\uFF0D\u2013\u2014\u2212]/g, '-')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/,/g, '')
    .replace(/[\s\u00A0\u3000]/g, '')
  if (s === '') return null
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null
  return s
}

export function formatNumber(val: unknown, digits = 2): string {
  if (val === null || val === undefined || val === '') return '-'
  const n = toNum(val as string | number)
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export function formatMoney(val: unknown, digits = 2): string {
  return formatNumber(val, digits)
}

export function fmtMoney(n: number, digits = 2): string {
  return formatNumber(n, digits)
}

// ─── 三方工程量计算口径 ──────────────────────────────────────────────────────

/**
 * 取复核量最终审定值：合约部 > 财务监理 > 施工单位
 */
export function finalReviewQty(row: BoqReviewRow): number {
  const c = parseOptionalNumber(row.reviewQtyContract)
  if (c !== undefined) return c
  const s = parseOptionalNumber(row.reviewQtySupervisor)
  if (s !== undefined) return s
  return toNum(row.reviewQty)
}

/**
 * 取本次签证变更量审定值：合约部 > 财务监理 > 施工单位
 */
export function finalChangeQty(row: BoqReviewRow): number {
  const c = parseOptionalNumber(row.changeQtyContract)
  if (c !== undefined) return c
  const s = parseOptionalNumber(row.changeQtySupervisor)
  if (s !== undefined) return s
  return toNum(row.changeQty)
}

/**
 * 初始化行的三方量默认值（财务监理与合约部默认跟随施工单位填报）
 */
export function withQtyDefaults(row: BoqReviewRow): BoqReviewRow {
  const rev = row.reviewQty !== undefined ? row.reviewQty : 0
  const chg = row.changeQty !== undefined ? row.changeQty : 0
  return {
    ...row,
    reviewQty: rev,
    reviewQtySupervisor:
      row.reviewQtySupervisor !== undefined ? row.reviewQtySupervisor : rev,
    reviewQtyContract:
      row.reviewQtyContract !== undefined ? row.reviewQtyContract : rev,
    changeQty: chg,
    changeQtySupervisor:
      row.changeQtySupervisor !== undefined ? row.changeQtySupervisor : chg,
    changeQtyContract: row.changeQtyContract !== undefined ? row.changeQtyContract : chg
  }
}

/**
 * 编辑三方量中的某一个阶段，并维护默认跟随关系：
 * 施工单位修改填报量时，如果财务监理或合约部列仍等于修改前的施工量（说明未单独审定），则自动同步更新；
 * 财务监理修改时，若合约部列等于修改前的监理量，则自动同步合约部列。
 */
export function editQtyField(
  row: BoqReviewRow,
  stage: ReviewStage,
  value: string | number,
  kind: ReviewKind = 'review'
): BoqReviewRow {
  const next: BoqReviewRow = { ...row }

  if (kind === 'review') {
    if (stage === 'contractor') {
      const oldVal = toNum(row.reviewQty)
      next.reviewQty = value
      if (
        parseOptionalNumber(row.reviewQtySupervisor) === undefined ||
        toNum(row.reviewQtySupervisor) === oldVal
      ) {
        next.reviewQtySupervisor = value
      }
      if (
        parseOptionalNumber(row.reviewQtyContract) === undefined ||
        toNum(row.reviewQtyContract) === oldVal
      ) {
        next.reviewQtyContract = value
      }
    } else if (stage === 'supervisor') {
      const oldSup = toNum(row.reviewQtySupervisor)
      next.reviewQtySupervisor = value
      if (
        parseOptionalNumber(row.reviewQtyContract) === undefined ||
        toNum(row.reviewQtyContract) === oldSup
      ) {
        next.reviewQtyContract = value
      }
    } else {
      next.reviewQtyContract = value
    }
  } else {
    // kind === 'change'
    if (stage === 'contractor') {
      const oldVal = toNum(row.changeQty)
      next.changeQty = value
      if (
        parseOptionalNumber(row.changeQtySupervisor) === undefined ||
        toNum(row.changeQtySupervisor) === oldVal
      ) {
        next.changeQtySupervisor = value
      }
      if (
        parseOptionalNumber(row.changeQtyContract) === undefined ||
        toNum(row.changeQtyContract) === oldVal
      ) {
        next.changeQtyContract = value
      }
    } else if (stage === 'supervisor') {
      const oldSup = toNum(row.changeQtySupervisor)
      next.changeQtySupervisor = value
      if (
        parseOptionalNumber(row.changeQtyContract) === undefined ||
        toNum(row.changeQtyContract) === oldSup
      ) {
        next.changeQtyContract = value
      }
    } else {
      next.changeQtyContract = value
    }
  }

  return next
}

/**
 * 变更/签证量（累计口径）= 原变更量 + 本次增量（审定后）
 */
export function calcChangeQty(row: BoqReviewRow): number {
  return roundTo(toNum(row.baseChangeQty) + finalChangeQty(row), 4)
}

/**
 * 工程量（含变更）= 复核量 + 变更/签证量（原 + 本次；均取审核后）
 */
export function calcFinAuditQty(row: BoqReviewRow): number {
  return roundTo(finalReviewQty(row) + calcChangeQty(row), 4)
}

/**
 * 复核总价（元）= 工程量（含变更） × 复核单价（元）
 */
export function calcReviewTotal(row: BoqReviewRow): number {
  return roundTo(calcFinAuditQty(row) * toNum(row.reviewUnitPrice), 2)
}

/**
 * 本次签证变更金额 = 本次增量（审定后） × 复核单价（只算本次增量，体现单据实际增减额）
 */
export function calcChangeAmount(row: BoqReviewRow): number {
  return roundTo(finalChangeQty(row) * toNum(row.reviewUnitPrice), 2)
}

/**
 * 计算单行的所有派生值
 */
export function calcReviewRow(row: BoqReviewRow, _kind: ReviewKind = 'review') {
  const finAuditQty = calcFinAuditQty(row)
  const reviewTotal = roundTo(finAuditQty * toNum(row.reviewUnitPrice), 2)
  const changeQtyTotal = calcChangeQty(row)
  const changeAmount = calcChangeAmount(row)

  return {
    finAuditQty,
    reviewTotal,
    changeQtyTotal,
    changeAmount,
    finAuditQtyText: formatNumber(finAuditQty, 2),
    reviewTotalText: formatMoney(reviewTotal, 2),
    changeQtyTotalText: formatNumber(changeQtyTotal, 2),
    changeAmountText: formatMoney(changeAmount, 2)
  }
}

/**
 * 汇总多行合计数据
 */
export function sumReviewRows(rows: BoqReviewRow[], kind: ReviewKind = 'review') {
  return rows.reduce(
    (acc, r) => {
      const c = calcReviewRow(r, kind)
      acc.finAuditQty = roundTo(acc.finAuditQty + c.finAuditQty, 4)
      acc.reviewTotal = roundTo(acc.reviewTotal + c.reviewTotal, 2)
      acc.changeAmount = roundTo(acc.changeAmount + c.changeAmount, 2)
      acc.changeQtyTotal = roundTo(acc.changeQtyTotal + c.changeQtyTotal, 4)
      return acc
    },
    {
      finAuditQty: 0,
      reviewTotal: 0,
      changeAmount: 0,
      changeQtyTotal: 0
    }
  )
}

// ─── 校验 ───────────────────────────────────────────────────────────────────

export interface ReviewValidationIssue {
  rowIndex: number
  rowCode?: string
  field?: string
  message: string
}

export function validateReviewRows(
  rows: BoqReviewRow[],
  existingCodes: Set<string> = new Set(),
  kind: ReviewKind = 'review'
): ReviewValidationIssue[] {
  const issues: ReviewValidationIssue[] = []
  const meta = KIND_META[kind]

  if (!rows || rows.length === 0) {
    issues.push({ rowIndex: -1, message: '至少需要一条清单明细' })
    return issues
  }

  const seenCodes = new Map<string, number>()

  rows.forEach((row, i) => {
    const code = (row.code || '').trim()
    const label = code ? `清单「${code}」` : `第 ${i + 1} 行`

    if (!code) {
      issues.push({
        rowIndex: i,
        field: 'code',
        message: `第 ${i + 1} 行：清单编码不能为空`
      })
    } else {
      const prevIdx = seenCodes.get(code)
      if (prevIdx !== undefined) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          field: 'code',
          message: `清单编码「${code}」在本${meta.short}内重复（与第 ${
            prevIdx + 1
          } 行相同）`
        })
      } else {
        seenCodes.set(code, i)
      }

      if (row.source === 'create' && existingCodes.has(code)) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          field: 'code',
          message: `清单编码「${code}」已存在于正式清单中，请修改编码`
        })
      }
    }

    if (!(row.name || '').trim()) {
      issues.push({
        rowIndex: i,
        rowCode: code,
        field: 'name',
        message: `${label}：清单名称不能为空`
      })
    }
    if (!(row.unit || '').trim()) {
      issues.push({
        rowIndex: i,
        rowCode: code,
        field: 'unit',
        message: `${label}：计量单位不能为空`
      })
    }

    if (kind === 'change') {
      const chgStr = String(row.changeQty ?? '').trim()
      if (chgStr === '') {
        issues.push({
          rowIndex: i,
          rowCode: code,
          field: 'changeQty',
          message: `${label}：本次签证变更量不能为空`
        })
      } else if (normalizeNumberText(chgStr) === null) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          field: 'changeQty',
          message: `${label}：本次签证变更量「${chgStr}」不是合法数值`
        })
      }

      if (row.source === 'create') {
        const revStr = String(row.reviewQty ?? '').trim()
        if (revStr !== '' && normalizeNumberText(revStr) === null) {
          issues.push({
            rowIndex: i,
            rowCode: code,
            field: 'reviewQty',
            message: `${label}：复核量「${revStr}」不是合法数值`
          })
        }
        const prcStr = String(row.reviewUnitPrice ?? '').trim()
        if (prcStr === '') {
          issues.push({
            rowIndex: i,
            rowCode: code,
            field: 'reviewUnitPrice',
            message: `${label}：复核单价不能为空`
          })
        } else if (normalizeNumberText(prcStr) === null) {
          issues.push({
            rowIndex: i,
            rowCode: code,
            field: 'reviewUnitPrice',
            message: `${label}：复核单价「${prcStr}」不是合法数值`
          })
        }
      }
    } else {
      // kind === 'review'
      const revStr = String(row.reviewQty ?? '').trim()
      if (revStr === '') {
        issues.push({
          rowIndex: i,
          rowCode: code,
          field: 'reviewQty',
          message: `${label}：复核量不能为空`
        })
      } else if (normalizeNumberText(revStr) === null) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          field: 'reviewQty',
          message: `${label}：复核量「${revStr}」不是合法数值`
        })
      }

      const prcStr = String(row.reviewUnitPrice ?? '').trim()
      if (prcStr === '') {
        issues.push({
          rowIndex: i,
          rowCode: code,
          field: 'reviewUnitPrice',
          message: `${label}：复核单价不能为空`
        })
      } else if (normalizeNumberText(prcStr) === null) {
        issues.push({
          rowIndex: i,
          rowCode: code,
          field: 'reviewUnitPrice',
          message: `${label}：复核单价「${prcStr}」不是合法数值`
        })
      }
    }

    // 校验审核列（若填写了）
    const supVal = kind === 'change' ? row.changeQtySupervisor : row.reviewQtySupervisor
    if (
      supVal !== undefined &&
      String(supVal).trim() !== '' &&
      normalizeNumberText(supVal) === null
    ) {
      issues.push({
        rowIndex: i,
        rowCode: code,
        field: 'supervisor',
        message: `${label}：财务监理审核量「${supVal}」不是合法数值`
      })
    }
    const ctrVal = kind === 'change' ? row.changeQtyContract : row.reviewQtyContract
    if (
      ctrVal !== undefined &&
      String(ctrVal).trim() !== '' &&
      normalizeNumberText(ctrVal) === null
    ) {
      issues.push({
        rowIndex: i,
        rowCode: code,
        field: 'contract',
        message: `${label}：合约部审核量「${ctrVal}」不是合法数值`
      })
    }
  })

  if (kind === 'change') {
    const anyNonZero = rows.some((r) => toNum(r.changeQty) !== 0)
    if (!anyNonZero) {
      issues.push({
        rowIndex: -1,
        message:
          '本单所有明细的签证变更量都是 0，没有需要增加或核减的量，请至少填写一条非 0 的变更量'
      })
    }
  }

  return issues
}

/**
 * 推荐新建清单编码：
 * 默认在原编码后追加 'b'，若已被占用则依次推荐 'b1', 'b2', 'b3'...
 */
export function suggestCreatedCode(
  sourceCode: string,
  existingCodes: Set<string>
): string {
  const base = (sourceCode || '').trim()
  if (!base) return 'NEW-001'

  const candidate1 = `${base}b`
  if (!existingCodes.has(candidate1)) {
    return candidate1
  }

  for (let i = 1; i <= 999; i++) {
    const candidate = `${base}b${i}`
    if (!existingCodes.has(candidate)) {
      return candidate
    }
  }

  return `${base}b-${Date.now().toString(36).slice(-4)}`
}

// ─── 清单树辅助函数 ──────────────────────────────────────────────────────────

export interface BoqTreeItem {
  id: string
  code: string
  name: string
  type: string
  unit?: string | null
  quantity?: number | string | null
  price?: number | string | null
  amount?: number | string | null
  reviewQuantity?: number | string | null
  changeQuantity?: number | string | null
  reviewPrice?: number | string | null
  children?: BoqTreeItem[] | null
  parentId?: string | null
  parentCode?: string | null
}

export function flattenBoqTree(tree: BoqTreeItem[] = []): BoqTreeItem[] {
  const result: BoqTreeItem[] = []
  function walk(nodes: BoqTreeItem[], parent?: BoqTreeItem) {
    for (const node of nodes) {
      const current = {
        ...node,
        parentId: parent ? parent.id : null,
        parentCode: parent ? parent.code : null
      }
      result.push(current)
      if (node.children && node.children.length > 0) {
        walk(node.children, current)
      }
    }
  }
  walk(tree)
  return result
}

export function collectBoqLeafItems(tree: BoqTreeItem[] = []): BoqTreeItem[] {
  const result: BoqTreeItem[] = []
  function walk(nodes: BoqTreeItem[], parent?: BoqTreeItem) {
    for (const node of nodes) {
      const isLeaf =
        !node.children || node.children.length === 0 || node.type === 'ITEM'
      if (isLeaf) {
        result.push({
          ...node,
          parentId: parent ? parent.id : null,
          parentCode: parent ? parent.code : null
        })
      }
      if (node.children && node.children.length > 0) {
        walk(node.children, node)
      }
    }
  }
  walk(tree)
  return result
}

export function collectBoqCodes(tree: BoqTreeItem[] = []): Set<string> {
  const set = new Set<string>()
  const flattened = flattenBoqTree(tree)
  for (const item of flattened) {
    if (item.code) set.add(item.code.trim())
  }
  return set
}

export function findBoqParent(tree: BoqTreeItem[], code: string): BoqTreeItem | null {
  const flattened = flattenBoqTree(tree)
  const target = flattened.find((item) => item.code === code)
  if (!target || !target.parentId) return null
  return flattened.find((item) => item.id === target.parentId) || null
}
