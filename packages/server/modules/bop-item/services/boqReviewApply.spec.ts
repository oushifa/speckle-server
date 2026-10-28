import { expect } from 'chai'
import type { Knex } from 'knex'
import {
  normalizeNumberText,
  parseOptionalNumber,
  roundTo,
  editQtyField,
  calcReviewRow,
  validateReviewRows,
  applyBoqReviewRecordToBoqItemsFactory,
  BOQ_REVIEW_RECORDS_TABLE,
  BOQ_REVIEW_ROWS_TABLE,
  type BoqReviewRowInput
} from '@/modules/bop-item/services/boqReviewApply'
import { normalizeCategory } from '@/modules/flow/helpers/category'
import {
  createBoqReviewRecordFactory,
  deleteBoqReviewRecordFactory,
  generateNextBoqReviewCodeFactory,
  getBoqItemAuditTraceFactory,
  getBoqItemsTraceSummaryFactory,
  getBoqReviewRecordDetailFactory,
  listBoqReviewRecordsFactory,
  saveBoqReviewRecordFactory
} from '@/modules/bop-item/repositories/boqReviews'

/**
 * 轻量级内存 Knex 模拟器，用于确定性测试 `applyBoqReviewRecordToBoqItemsFactory` 与 `boqReviews` 仓储
 */
function createInMemoryKnex(initialTables: {
  boq_review_records?: Array<Record<string, any>>
  boq_review_rows?: Array<Record<string, any>>
  boq_items?: Array<Record<string, any>>
  approval_flow_bindings?: Array<Record<string, any>>
  approval_flow_instances?: Array<Record<string, any>>
  approval_flow_instance_steps?: Array<Record<string, any>>
  approval_flow_actions?: Array<Record<string, any>>
  users?: Array<Record<string, any>>
}) {
  const store: Record<string, Array<Record<string, any>>> = {
    [BOQ_REVIEW_RECORDS_TABLE]: (initialTables.boq_review_records || []).map((r) => ({
      ...r
    })),
    [BOQ_REVIEW_ROWS_TABLE]: (initialTables.boq_review_rows || []).map((r) => ({
      ...r
    })),
    boq_items: (initialTables.boq_items || []).map((r) => ({ ...r })),
    approval_flow_bindings: (initialTables.approval_flow_bindings || []).map((r) => ({
      ...r
    })),
    approval_flow_instances: (initialTables.approval_flow_instances || []).map((r) => ({
      ...r
    })),
    approval_flow_instance_steps: (
      initialTables.approval_flow_instance_steps || []
    ).map((r) => ({
      ...r
    })),
    approval_flow_actions: (initialTables.approval_flow_actions || []).map((r) => ({
      ...r
    })),
    users: (initialTables.users || []).map((r) => ({ ...r }))
  }

  const stripTablePrefix = (col: string) => {
    const s = String(col)
    const idx = s.lastIndexOf('.')
    return idx >= 0 ? s.slice(idx + 1) : s
  }

  const createQueryBuilder = (tableName: string) => {
    const predicates: Array<(row: Record<string, any>) => boolean> = []
    const orders: Array<{ col: string; dir: 'asc' | 'desc' }> = []

    const addWhere = (colOrObj: any, opOrVal?: any, maybeVal?: any) => {
      if (typeof colOrObj === 'object' && colOrObj !== null) {
        for (const [k, v] of Object.entries(colOrObj)) {
          const cleanKey = stripTablePrefix(k)
          predicates.push((row) => row[cleanKey] === v)
        }
        return builder
      }
      const col = stripTablePrefix(String(colOrObj))
      if (maybeVal !== undefined) {
        const op = String(opOrVal)
        predicates.push((row) => {
          if (op === '>') return Number(row[col]) > Number(maybeVal)
          if (op === '>=') return Number(row[col]) >= Number(maybeVal)
          if (op === '<') return Number(row[col]) < Number(maybeVal)
          if (op === '<=') return Number(row[col]) <= Number(maybeVal)
          if (op === '!=' || op === '<>') return row[col] !== maybeVal
          return row[col] === maybeVal
        })
      } else {
        predicates.push((row) => row[col] === opOrVal)
      }
      return builder
    }

    const getMatchedRows = () => {
      const table = store[tableName] || []
      let matched = table.filter((row) => predicates.every((fn) => fn(row)))
      if (orders.length > 0) {
        matched = [...matched].sort((a, b) => {
          for (const { col, dir } of orders) {
            const va = a[col]
            const vb = b[col]
            if (va === vb) continue
            const cmp = va < vb ? -1 : 1
            return dir === 'desc' ? -cmp : cmp
          }
          return 0
        })
      }
      return matched
    }

    const builder: any = {
      where: addWhere,
      andWhere: addWhere,
      whereIn(col: string, values: any[]) {
        const cleanCol = stripTablePrefix(col)
        const set = new Set(values)
        predicates.push((row) => set.has(row[cleanCol]))
        return builder
      },
      whereNull(col: string) {
        const cleanCol = stripTablePrefix(col)
        predicates.push((row) => row[cleanCol] === null || row[cleanCol] === undefined)
        return builder
      },
      select() {
        return builder
      },
      orderBy(col: string, dir: 'asc' | 'desc' = 'asc') {
        orders.push({ col: stripTablePrefix(col), dir })
        return builder
      },
      async first() {
        const rows = getMatchedRows()
        return rows[0] ? { ...rows[0] } : undefined
      },
      async insert(payload: Record<string, any> | Array<Record<string, any>>) {
        if (!store[tableName]) store[tableName] = []
        const items = Array.isArray(payload) ? payload : [payload]
        for (const item of items) {
          store[tableName].push({ ...item })
        }
        return items
      },
      async update(patch: Record<string, any>) {
        const table = store[tableName] || []
        let count = 0
        for (const row of table) {
          if (predicates.every((fn) => fn(row))) {
            Object.assign(row, patch)
            count += 1
          }
        }
        return count
      },
      async delete() {
        const table = store[tableName] || []
        const kept = table.filter((row) => !predicates.every((fn) => fn(row)))
        const deletedCount = table.length - kept.length
        store[tableName] = kept
        return deletedCount
      },
      async del() {
        return builder.delete()
      },
      async increment(col: string, delta = 1) {
        const cleanCol = stripTablePrefix(col)
        const table = store[tableName] || []
        let count = 0
        for (const row of table) {
          if (predicates.every((fn) => fn(row))) {
            row[cleanCol] = Number(row[cleanCol] ?? 0) + delta
            count += 1
          }
        }
        return count
      },
      then(onFulfilled?: (value: any) => any, onRejected?: (reason: any) => any) {
        return Promise.resolve(getMatchedRows().map((r) => ({ ...r }))).then(
          onFulfilled,
          onRejected
        )
      }
    }

    return builder
  }

  const dbFn: any = (tableName: string) => createQueryBuilder(tableName)
  dbFn.isTransaction = false
  dbFn.transaction = async (cb: (trx: Knex) => Promise<any>) => {
    const trxFn: any = (tableName: string) => createQueryBuilder(tableName)
    trxFn.isTransaction = true
    return await cb(trxFn as unknown as Knex)
  }

  return {
    db: dbFn as unknown as Knex,
    store
  }
}

describe('BOQ Review Apply & Flow Category Service Unit Tests', () => {
  describe('normalizeCategory (BOQ_REVIEW)', () => {
    it('能够将 BOQ_REVIEW 及中文别名归一为 BOQ_REVIEW', () => {
      expect(normalizeCategory('BOQ_REVIEW')).to.equal('BOQ_REVIEW')
      expect(normalizeCategory('清单审核')).to.equal('BOQ_REVIEW')
      expect(normalizeCategory('清单变更')).to.equal('BOQ_REVIEW')
      expect(normalizeCategory('复核工程量')).to.equal('BOQ_REVIEW')
      expect(normalizeCategory('签证变更')).to.equal('BOQ_REVIEW')
    })
  })

  describe('normalizeNumberText & parseOptionalNumber & roundTo', () => {
    it('正确归一全角数字、全角小数点、全角负号、千分位、零宽字符与空白', () => {
      expect(normalizeNumberText(' １，２３４．５６ ')).to.equal('1234.56')
      expect(normalizeNumberText('－50.25')).to.equal('-50.25')
      expect(normalizeNumberText('−1,000.5')).to.equal('-1000.5')
      expect(normalizeNumberText('\u200B123.45\uFEFF')).to.equal('123.45')
      expect(normalizeNumberText('.75')).to.equal('.75')
      expect(normalizeNumberText('100.')).to.equal('100.')
    })

    it('遇到非数字或空值时返回空串', () => {
      expect(normalizeNumberText(null)).to.equal('')
      expect(normalizeNumberText(undefined)).to.equal('')
      expect(normalizeNumberText('')).to.equal('')
      expect(normalizeNumberText('   ')).to.equal('')
      expect(normalizeNumberText('abc')).to.equal('')
      expect(normalizeNumberText('12.3.4')).to.equal('')
      expect(normalizeNumberText('--10')).to.equal('')
    })

    it('parseOptionalNumber 与 roundTo 正确处理精度和边界', () => {
      expect(parseOptionalNumber('1,234.56')).to.equal(1234.56)
      expect(parseOptionalNumber('')).to.equal(undefined)
      expect(parseOptionalNumber('invalid')).to.equal(undefined)
      expect(roundTo(1.005, 2)).to.equal(1.01)
      expect(roundTo(12.3456789, 6)).to.equal(12.345679)
    })
  })

  describe('editQtyField（三方量默认跟随与手动修改独立性）', () => {
    it('复核单：施工单位修改时，未独立改过的财务监理与合约部自动跟随', () => {
      let row: BoqReviewRowInput = {
        code: '040101001001',
        reviewQty: 100
      }

      // 初次由施工单位设为 120，监理与合约部为空，自动跟随为 120
      row = editQtyField(row, 'contractor', 120, 'review')
      expect(row.reviewQty).to.equal(120)
      expect(row.reviewQtySupervisor).to.equal(120)
      expect(row.reviewQtyContract).to.equal(120)

      // 施工单位再次改为 150，由于监理和合约部都等于旧施工单位值 120，继续跟随为 150
      row = editQtyField(row, 'contractor', 150, 'review')
      expect(row.reviewQty).to.equal(150)
      expect(row.reviewQtySupervisor).to.equal(150)
      expect(row.reviewQtyContract).to.equal(150)
    })

    it('复核单：财务监理手动修改后，合约部默认跟随监理，且不再受施工单位后续改动覆盖', () => {
      let row: BoqReviewRowInput = {
        code: '040101001001',
        reviewQty: 100,
        reviewQtySupervisor: 100,
        reviewQtyContract: 100
      }

      // 财务监理审定为 90，合约部等于旧监理值 100，自动跟随为 90
      row = editQtyField(row, 'supervisor', 90, 'review')
      expect(row.reviewQty).to.equal(100)
      expect(row.reviewQtySupervisor).to.equal(90)
      expect(row.reviewQtyContract).to.equal(90)

      // 合约部手动审定为 85，仅修改合约部列
      row = editQtyField(row, 'contract', 85, 'review')
      expect(row.reviewQty).to.equal(100)
      expect(row.reviewQtySupervisor).to.equal(90)
      expect(row.reviewQtyContract).to.equal(85)

      // 财务监理再次修改为 88，因合约部 (85) != 旧监理 (90)，合约部保持 85 不被覆盖
      row = editQtyField(row, 'supervisor', 88, 'review')
      expect(row.reviewQtySupervisor).to.equal(88)
      expect(row.reviewQtyContract).to.equal(85)

      // 施工单位再次修改为 110，监理 (88) 与合约部 (85) 均已被独立修改过，保持不变
      row = editQtyField(row, 'contractor', 110, 'review')
      expect(row.reviewQty).to.equal(110)
      expect(row.reviewQtySupervisor).to.equal(88)
      expect(row.reviewQtyContract).to.equal(85)
    })

    it('签证单：changeQty / changeQtySupervisor / changeQtyContract 同样满足三方跟随与独立性', () => {
      let row: BoqReviewRowInput = {
        code: '040101001002',
        changeQty: 20
      }

      row = editQtyField(row, 'contractor', 25, 'change')
      expect(row.changeQty).to.equal(25)
      expect(row.changeQtySupervisor).to.equal(25)
      expect(row.changeQtyContract).to.equal(25)

      row = editQtyField(row, 'supervisor', -10, 'change')
      expect(row.changeQty).to.equal(25)
      expect(row.changeQtySupervisor).to.equal(-10)
      expect(row.changeQtyContract).to.equal(-10)

      row = editQtyField(row, 'contract', -8, 'change')
      expect(row.changeQtyContract).to.equal(-8)

      row = editQtyField(row, 'supervisor', -12, 'change')
      expect(row.changeQtySupervisor).to.equal(-12)
      expect(row.changeQtyContract).to.equal(-8)
    })
  })

  describe('calcReviewRow（复核单与签证单计算公式）', () => {
    it('复核单计算公式：按合约部->监理->施工单位优先级取有效复核量，叠加历史变更量计算总工程量与复核总价', () => {
      const row: BoqReviewRowInput = {
        code: '040101001001',
        reviewQty: 100,
        reviewQtySupervisor: 95,
        reviewQtyContract: 90,
        baseChangeQty: 10,
        changeQty: 0,
        reviewUnitPrice: 50.5
      }

      const res = calcReviewRow(row, 'review')
      expect(res.effectiveQty).to.equal(90)
      expect(res.effectiveReviewQty).to.equal(90)
      expect(res.changeQtyTotal).to.equal(10)
      expect(res.totalQtyWithChange).to.equal(100)
      expect(res.finAuditQty).to.equal(100)
      expect(res.reviewTotalPrice).to.equal(5050)
      expect(res.reviewTotal).to.equal(5050)

      // 指定 stage 查看特定阶段下的结果
      const supRes = calcReviewRow(row, 'review', 'supervisor')
      expect(supRes.effectiveQty).to.equal(95)
      expect(supRes.totalQtyWithChange).to.equal(105)
      expect(supRes.reviewTotalPrice).to.equal(roundTo(105 * 50.5, 2))
    })

    it('签证变更单计算公式：支持正负增量，计算累计变更量、含变更总工程量、复核总价与本次变更金额', () => {
      const row: BoqReviewRowInput = {
        code: '040101001001',
        reviewQty: 200,
        baseChangeQty: 15,
        changeQty: -25,
        changeQtySupervisor: -20,
        changeQtyContract: -20,
        reviewUnitPrice: 100
      }

      const res = calcReviewRow(row, 'change')
      expect(res.effectiveQty).to.equal(-20)
      expect(res.effectiveChangeQty).to.equal(-20)
      expect(res.changeQtyTotal).to.equal(-5) // 15 + (-20)
      expect(res.totalQtyWithChange).to.equal(195) // 200 + (-5)
      expect(res.reviewTotalPrice).to.equal(19500)
      expect(res.changeAmount).to.equal(-2000)
    })
  })

  describe('validateReviewRows（明细行校验规则）', () => {
    it('空明细数组报错', () => {
      const issues = validateReviewRows([], 'review')
      expect(issues).to.have.length(1)
      expect(issues[0].message).to.include('至少需要一条清单明细')
    })

    it('校验编码必填、单内重复、与既有清单编码冲突、名称与计量单位必填', () => {
      const existingCodes = new Set(['040101001001', '040101001002'])
      const rows: BoqReviewRowInput[] = [
        {
          source: 'import',
          code: '',
          name: '',
          unit: '',
          reviewQty: 10,
          reviewUnitPrice: 20
        },
        {
          source: 'import',
          code: '040101001001',
          name: '既有清单项1',
          unit: 'm3',
          reviewQty: 10,
          reviewUnitPrice: 20
        },
        {
          source: 'import',
          code: '040101001001', // 单内重复
          name: '既有清单项1重复',
          unit: 'm3',
          reviewQty: 15,
          reviewUnitPrice: 20
        },
        {
          source: 'create',
          code: '040101001002', // 新建项与既有正式清单编码冲突
          name: '冲突新建项',
          unit: 'm2',
          reviewQty: 5,
          reviewUnitPrice: 30
        }
      ]

      const issues = validateReviewRows(rows, 'review', existingCodes)
      const messages = issues.map((x) => x.message)
      expect(messages.some((m) => m.includes('清单编码不能为空'))).to.be.true
      expect(messages.some((m) => m.includes('清单名称不能为空'))).to.be.true
      expect(messages.some((m) => m.includes('计量单位不能为空'))).to.be.true
      expect(messages.some((m) => m.includes('在本复核单内重复'))).to.be.true
      expect(
        messages.some((m) =>
          m.includes('清单编码「040101001002」已存在于正式清单，请修改编码')
        )
      ).to.be.true
    })

    it('签证变更单所有明细变更量全为 0 时报错', () => {
      const rows: BoqReviewRowInput[] = [
        {
          source: 'import',
          code: '040101001001',
          name: '土方开挖',
          unit: 'm3',
          changeQty: 0,
          reviewUnitPrice: 45
        },
        {
          source: 'import',
          code: '040101001002',
          name: '土方回填',
          unit: 'm3',
          changeQty: '0',
          reviewUnitPrice: 30
        }
      ]

      const issues = validateReviewRows(rows, 'change')
      expect(issues.some((x) => x.message.includes('本单所有明细的签证变更量都是 0')))
        .to.be.true
    })
  })

  describe('applyBoqReviewRecordToBoqItemsFactory（终审通过写回 boq_items 事务与幂等）', () => {
    const projectId = 'proj000001'

    it('复核单（kind=review）：引入项覆盖 reviewQuantity/reviewPrice，保留原 changeQuantity；新建项插在来源项正下方且合同量价为 0', async () => {
      const { db, store } = createInMemoryKnex({
        boq_items: [
          {
            id: 'sub1',
            projectId,
            parentId: null,
            type: 'SUBSECTION',
            code: '040101',
            name: '土方工程',
            unit: null,
            quantity: null,
            price: null,
            amount: '3000',
            reviewQuantity: null,
            changeQuantity: null,
            reviewPrice: null,
            reviewAmount: null,
            sortOrder: 0,
            depth: 3,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z')
          },
          {
            id: 'item1',
            projectId,
            parentId: 'sub1',
            type: 'ITEM',
            code: '040101001001',
            name: '挖一般土方',
            unit: 'm3',
            quantity: '100',
            price: '20',
            amount: '2000',
            reviewQuantity: '100',
            changeQuantity: '10', // 已有签证量 10
            reviewPrice: '20',
            reviewAmount: '2200',
            sortOrder: 0,
            depth: 4,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z')
          },
          {
            id: 'item2',
            projectId,
            parentId: 'sub1',
            type: 'ITEM',
            code: '040101001002',
            name: '余方弃置',
            unit: 'm3',
            quantity: '50',
            price: '20',
            amount: '1000',
            reviewQuantity: '50',
            changeQuantity: '0',
            reviewPrice: '20',
            reviewAmount: '1000',
            sortOrder: 1,
            depth: 4,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z')
          }
        ],
        boq_review_records: [
          {
            id: 'rec_review_1',
            projectId,
            kind: 'review',
            code: 'FH-202610-001',
            reason: '首轮工程量复核',
            applicant: '张三',
            approveStatus: 'PENDING',
            effectiveAt: null,
            history: []
          }
        ],
        boq_review_rows: [
          {
            id: 'row_import_1',
            recordId: 'rec_review_1',
            projectId,
            sortIndex: 0,
            source: 'import',
            boqItemId: 'item1',
            code: '040101001001',
            name: '挖一般土方',
            unit: 'm3',
            reviewQty: '120',
            reviewQtySupervisor: '115',
            reviewQtyContract: '110', // 最终合约部审定复核量为 110
            reviewUnitPrice: '25'
          },
          {
            id: 'row_create_1',
            recordId: 'rec_review_1',
            projectId,
            sortIndex: 1,
            source: 'create',
            boqItemId: null,
            sourceCode: '040101001001', // 在 item1 正下方新增
            parentCode: '040101',
            code: '040101001001-1',
            name: '新增机械破碎岩石',
            unit: 'm3',
            reviewQty: '30',
            reviewQtySupervisor: '30',
            reviewQtyContract: '28',
            reviewUnitPrice: '80'
          }
        ]
      })

      let costRecalculated = 0
      const applyReview = applyBoqReviewRecordToBoqItemsFactory({
        db,
        recalculateProjectCostSummary: async () => {
          costRecalculated += 1
        }
      })

      const res = await applyReview({
        recordId: 'rec_review_1',
        projectId,
        actorId: 'user_approver'
      })

      expect(res.alreadyEffective).to.be.false
      expect(res.createdCount).to.equal(1)
      expect(res.updatedCount).to.equal(1)
      expect(costRecalculated).to.equal(1)

      // 1. 检查引入项 item1：reviewQuantity 覆盖为 110，保留原 changeQuantity=10，reviewPrice=25，reviewAmount=(110+10)*25=3000
      const updatedItem1 = store.boq_items.find((x) => x.id === 'item1')!
      expect(updatedItem1.reviewQuantity).to.equal('110')
      expect(updatedItem1.changeQuantity).to.equal('10')
      expect(updatedItem1.reviewPrice).to.equal('25')
      expect(updatedItem1.reviewAmount).to.equal('3000')
      // 原合同量价不变
      expect(updatedItem1.quantity).to.equal('100')
      expect(updatedItem1.price).to.equal('20')
      expect(updatedItem1.amount).to.equal('2000')

      // 2. 检查新建项：插在 item1 (sortOrder=0) 正下方，即 sortOrder=1，而原 item2 的 sortOrder 被顺延为 2
      const createdItem = store.boq_items.find((x) => x.code === '040101001001-1')!
      expect(createdItem).to.exist
      expect(createdItem.parentId).to.equal('sub1')
      expect(createdItem.depth).to.equal(4)
      expect(createdItem.sortOrder).to.equal(1)
      // 合同量价必须为 0
      expect(createdItem.quantity).to.equal('0')
      expect(createdItem.price).to.equal('0')
      expect(createdItem.amount).to.equal('0')
      // 复核字段：reviewQuantity=28, changeQuantity=0, reviewPrice=80, reviewAmount=2240
      expect(createdItem.reviewQuantity).to.equal('28')
      expect(createdItem.changeQuantity).to.equal('0')
      expect(createdItem.reviewPrice).to.equal('80')
      expect(createdItem.reviewAmount).to.equal('2240')

      const item2 = store.boq_items.find((x) => x.id === 'item2')!
      expect(item2.sortOrder).to.equal(2)

      // 3. 再次调用触发幂等保护，不重复插入、不重复修改
      const secondRes = await applyReview({
        recordId: 'rec_review_1',
        projectId,
        actorId: 'user_approver'
      })
      expect(secondRes.alreadyEffective).to.be.true
      expect(secondRes.createdCount).to.equal(0)
      expect(secondRes.updatedCount).to.equal(0)
      expect(store.boq_items.filter((x) => x.type === 'ITEM')).to.have.length(3)
    })

    it('签证变更单（kind=change）：引入项累加 changeQuantity（支持正负），新建项写入 changeQuantity 且合同量价为 0，幂等防重', async () => {
      const { db, store } = createInMemoryKnex({
        boq_items: [
          {
            id: 'item1',
            projectId,
            parentId: 'sub1',
            type: 'ITEM',
            code: '040101001001',
            name: '挖一般土方',
            unit: 'm3',
            quantity: '100',
            price: '20',
            amount: '2000',
            reviewQuantity: '110',
            changeQuantity: '10',
            reviewPrice: '25',
            reviewAmount: '3000',
            sortOrder: 0,
            depth: 4,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z')
          }
        ],
        boq_review_records: [
          {
            id: 'rec_change_1',
            projectId,
            kind: 'change',
            code: 'QZ-202610-001',
            reason: '设计变更签证',
            applicant: '李四',
            approveStatus: 'PENDING',
            effectiveAt: null,
            history: []
          }
        ],
        boq_review_rows: [
          {
            id: 'row_change_import',
            recordId: 'rec_change_1',
            projectId,
            sortIndex: 0,
            source: 'import',
            boqItemId: 'item1',
            code: '040101001001',
            name: '挖一般土方',
            unit: 'm3',
            baseChangeQty: '10',
            changeQty: '-6',
            changeQtySupervisor: '-5',
            changeQtyContract: '-4', // 最终审定核减 4
            reviewUnitPrice: '25'
          },
          {
            id: 'row_change_create',
            recordId: 'rec_change_1',
            projectId,
            sortIndex: 1,
            source: 'create',
            boqItemId: null,
            sourceCode: '040101001001',
            code: '040101001001-QZ1',
            name: '签证新增降水台班',
            unit: '台班',
            changeQty: '12',
            changeQtySupervisor: '10',
            changeQtyContract: '10',
            reviewUnitPrice: '500'
          }
        ]
      })

      const applyChange = applyBoqReviewRecordToBoqItemsFactory({
        db,
        recalculateProjectCostSummary: async () => {}
      })

      const res = await applyChange({
        recordId: 'rec_change_1',
        projectId,
        actorId: 'user_approver'
      })

      expect(res.alreadyEffective).to.be.false
      expect(res.createdCount).to.equal(1)
      expect(res.updatedCount).to.equal(1)

      // 1. 引入项 item1：reviewQuantity 保持 110，changeQuantity 累加 10 + (-4) = 6，reviewAmount = (110 + 6) * 25 = 2900
      const item1 = store.boq_items.find((x) => x.id === 'item1')!
      expect(item1.reviewQuantity).to.equal('110')
      expect(item1.changeQuantity).to.equal('6')
      expect(item1.reviewPrice).to.equal('25')
      expect(item1.reviewAmount).to.equal('2900')

      // 2. 签证新建项：quantity/price/amount = '0', reviewQuantity = '0', changeQuantity = '10', reviewPrice = '500', reviewAmount = '5000'
      const newItem = store.boq_items.find((x) => x.code === '040101001001-QZ1')!
      expect(newItem).to.exist
      expect(newItem.quantity).to.equal('0')
      expect(newItem.price).to.equal('0')
      expect(newItem.amount).to.equal('0')
      expect(newItem.reviewQuantity).to.equal('0')
      expect(newItem.changeQuantity).to.equal('10')
      expect(newItem.reviewPrice).to.equal('500')
      expect(newItem.reviewAmount).to.equal('5000')
      expect(newItem.sortOrder).to.equal(1)

      // 3. 幂等校验：重复调用不会再次累加 changeQuantity
      const res2 = await applyChange({
        recordId: 'rec_change_1',
        projectId,
        actorId: 'user_approver'
      })
      expect(res2.alreadyEffective).to.be.true
      expect(store.boq_items.find((x) => x.id === 'item1')!.changeQuantity).to.equal(
        '6'
      )
    })
  })

  describe('boqReviews Repository（流水编号、CRUD、审批流串联与清单项审核追溯）', () => {
    const projectId = 'proj000002'

    it('generateNextBoqReviewCodeFactory 自动递增复核单与签证单流水号', async () => {
      const { db } = createInMemoryKnex({
        boq_review_records: [
          { id: '1', projectId, kind: 'review', code: 'FH-2026-001' },
          { id: '2', projectId, kind: 'review', code: 'FH-2026-004' },
          { id: '3', projectId, kind: 'change', code: 'QZ-2026-002' }
        ]
      })

      const genCode = generateNextBoqReviewCodeFactory({ db })
      expect(await genCode({ projectId, kind: 'review', year: '2026' })).to.equal(
        'FH-2026-005'
      )
      expect(await genCode({ projectId, kind: 'change', year: '2026' })).to.equal(
        'QZ-2026-003'
      )
    })

    it('create / save / list / detail / audit-trace / trace-summary 完整闭环', async () => {
      const { db, store } = createInMemoryKnex({
        boq_items: [
          {
            id: 'boq_item_1',
            projectId,
            parentId: null,
            type: 'ITEM',
            code: '040101001001',
            name: '挖一般土方',
            unit: 'm3',
            quantity: '100',
            price: '20',
            amount: '2000',
            reviewQuantity: '100',
            changeQuantity: '0',
            reviewPrice: '20',
            reviewAmount: '2000',
            sortOrder: 0,
            depth: 4,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z')
          }
        ],
        users: [
          { id: 'u_contractor', name: '张施工' },
          { id: 'u_supervisor', name: '王监理' },
          { id: 'u_contract', name: '李合约' }
        ]
      })

      const createRecord = createBoqReviewRecordFactory({ db, mainDb: db })
      const saveRecord = saveBoqReviewRecordFactory({ db, mainDb: db })
      const listRecords = listBoqReviewRecordsFactory({ db, mainDb: db })
      const getDetail = getBoqReviewRecordDetailFactory({ db, mainDb: db })
      const getAuditTrace = getBoqItemAuditTraceFactory({ db, mainDb: db })
      const getTraceSummary = getBoqItemsTraceSummaryFactory({ db, mainDb: db })
      const deleteRecord = deleteBoqReviewRecordFactory({ db })

      // 1. 新建复核单草稿并自动填充三方量默认跟随
      const created = await createRecord({
        projectId,
        kind: 'review',
        reason: '地质情况复核',
        applicant: '张施工',
        applicantId: 'u_contractor',
        rows: [
          {
            source: 'import',
            boqItemId: 'boq_item_1',
            code: '040101001001',
            name: '挖一般土方',
            unit: 'm3',
            reviewQty: 120,
            reviewUnitPrice: 25
          }
        ]
      })

      expect(created.code).to.match(/^FH-\d{4}-001$/)
      expect(created.rows).to.have.length(1)
      // 施工单位填写 120 后，监理和合约部默认跟随为 120
      expect(created.rows[0].reviewQty).to.equal(120)
      expect(created.rows[0].reviewQtySupervisor).to.equal(120)
      expect(created.rows[0].reviewQtyContract).to.equal(120)
      expect(created.reviewTotalAmount).to.equal(3000)

      // 2. 模拟关联审批流绑定、步骤与动作
      store.approval_flow_bindings.push({
        id: 'bind_1',
        projectId,
        subjectType: 'FORM_RECORD',
        subjectId: created.id,
        subjectTable: BOQ_REVIEW_RECORDS_TABLE,
        subjectKey: `${BOQ_REVIEW_RECORDS_TABLE}:${created.id}`,
        currentInstanceId: 'inst_1',
        status: 'IN_REVIEW'
      })
      store.approval_flow_instances.push({
        id: 'inst_1',
        bindingId: 'bind_1',
        status: 'PENDING',
        currentStep: 2,
        createdBy: 'u_contractor'
      })
      store.approval_flow_instance_steps.push(
        {
          id: 'step_1',
          instanceId: 'inst_1',
          stepIndex: 1,
          name: '施工单位提交',
          status: 'APPROVED',
          approverIds: ['u_contractor'],
          approvedByIds: ['u_contractor']
        },
        {
          id: 'step_2',
          instanceId: 'inst_1',
          stepIndex: 2,
          name: '财务监理审核',
          status: 'PENDING',
          approverIds: ['u_supervisor'],
          approvedByIds: []
        },
        {
          id: 'step_3',
          instanceId: 'inst_1',
          stepIndex: 3,
          name: '合约部审核',
          status: 'WAITING',
          approverIds: ['u_contract'],
          approvedByIds: []
        }
      )
      store.approval_flow_actions.push({
        id: 'act_1',
        instanceId: 'inst_1',
        stepId: 'step_1',
        action: 'STEP_APPROVED',
        actorId: 'u_contractor',
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
        comment: '已按图纸复核提交',
        createdAt: new Date('2026-10-01T10:00:00Z')
      })

      // 3. 列表与详情查询能够返回当前待办节点、审批人与完整审批链
      const list = await listRecords({
        projectId,
        kind: 'review',
        search: '挖一般土方'
      })
      expect(list).to.have.length(1)
      expect(list[0].approveStatus).to.equal('PENDING')
      expect(list[0].currentStepName).to.equal('财务监理审核')
      expect(list[0].currentStepApprovers).to.deep.equal(['王监理'])
      expect(list[0].currentStage).to.equal('supervisor')
      expect(list[0].approvalChain).to.have.length(3)

      // 4. 财务监理保存修改后，再次查看详情
      const updated = await saveRecord({
        projectId,
        recordId: created.id,
        rows: [
          {
            ...created.rows[0],
            reviewQtySupervisor: 115,
            reviewQtyContract: 115
          }
        ]
      })
      expect(updated.rows[0].reviewQtySupervisor).to.equal(115)
      expect(updated.actions).to.have.length(1)
      expect(updated.actions[0].actorName).to.equal('张施工')

      // 5. 清单项审核流程追溯查询 getBoqItemAuditTraceFactory 与 getBoqItemsTraceSummaryFactory
      const trace = await getAuditTrace({
        projectId,
        itemId: 'boq_item_1'
      })
      expect(trace.item.code).to.equal('040101001001')
      expect(trace.records).to.have.length(1)
      expect(trace.records[0].code).to.equal(created.code)
      expect(trace.records[0].reviewQtySupervisor).to.equal(115)
      expect(trace.records[0].steps).to.have.length(3)
      expect(trace.records[0].actions[0].comment).to.equal('已按图纸复核提交')

      const summary = await getTraceSummary({ projectId })
      expect(summary.summaryByItemId['boq_item_1'].totalCount).to.equal(1)
      expect(summary.summaryByItemId['boq_item_1'].pendingCount).to.equal(1)
      expect(summary.summaryByCode['040101001001'].latestCode).to.equal(created.code)

      // 6. 删除单据
      await deleteRecord({ projectId, recordId: created.id })
      const afterDel = await getDetail({ projectId, recordId: created.id })
      expect(afterDel).to.be.null
    })
  })
})
