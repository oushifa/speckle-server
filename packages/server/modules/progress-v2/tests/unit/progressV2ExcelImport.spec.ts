/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai'
import fs from 'fs'
import * as XLSXNamespace from 'xlsx'
import {
  parseExcelDate,
  parseNullableExcelDate,
  parseImportRows,
  cleanErrorMessage,
  importProgressV2ActualRecordsFromBuffer
} from '@/modules/progress-v2/services/progressV2ExcelImport'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'

const XLSX = ((XLSXNamespace as unknown as { default?: typeof XLSXNamespace })
  .default || XLSXNamespace) as typeof XLSXNamespace

describe('progressV2ExcelImport', () => {
  const testExcelPath =
    '/Users/yujian/.gemini/antigravity/brain/932b19da-25ab-4b40-94c2-348fe0744b41/.user_uploaded/media_1793782622930_66f52f63.xlsx'

  describe('parseExcelDate / parseNullableExcelDate', () => {
    it('支持 Excel 数字序列号（如 46346 -> 2026-11-20）', () => {
      expect(parseExcelDate(46346, 2, '填报日期')).to.equal('2026-11-20')
      expect(parseNullableExcelDate(46328, 2, '计划开始时间')).to.equal('2026-11-02')
      expect(parseNullableExcelDate(46332, 2, '计划结束时间')).to.equal('2026-11-06')
    })

    it('支持纯数字字符串（如 "46346" -> 2026-11-20）', () => {
      expect(parseExcelDate('46346', 2, '填报日期')).to.equal('2026-11-20')
      expect(parseNullableExcelDate('46328', 2, '计划开始时间')).to.equal('2026-11-02')
    })

    it('支持 8 位连续数字格式（如 "20260409" -> 2026-04-09）', () => {
      expect(parseExcelDate('20260409', 2, '填报日期')).to.equal('2026-04-09')
    })

    it('支持各类常见分隔符与中文格式（-, /, ., 中文年月日）', () => {
      expect(parseExcelDate('2026-09-09', 2, '填报日期')).to.equal('2026-09-09')
      expect(parseExcelDate('2026/04/09', 2, '填报日期')).to.equal('2026-04-09')
      expect(parseExcelDate('2026.04.12', 2, '填报日期')).to.equal('2026-04-12')
      expect(parseExcelDate('2026年4月9日', 2, '填报日期')).to.equal('2026-04-09')
    })

    it('支持 Date 对象与 ISO 格式', () => {
      expect(parseExcelDate(new Date('2026-05-01T00:00:00Z'), 2, '填报日期')).to.match(
        /^2026-05-0[12]$/
      )
      expect(parseExcelDate('2026-05-01T12:00:00.000Z', 2, '填报日期')).to.match(
        /^2026-05-0[12]$/
      )
    })

    it('非法日期或年份超出 1970~2100 抛出明确友好错误，不生成超长年份', () => {
      expect(() => parseExcelDate('invalid-date', 2, '填报日期')).to.throw(
        '第 2 行填报日期格式不正确'
      )
      expect(() => parseExcelDate('1800-01-01', 2, '填报日期')).to.throw(
        '超出有效范围（1970~2100）'
      )
      expect(() => parseExcelDate('2200-01-01', 2, '填报日期')).to.throw(
        '超出有效范围（1970~2100）'
      )
      expect(() => parseExcelDate('2026-02-30', 2, '填报日期')).to.throw(
        '不是合法的日历日期'
      )
    })

    it('parseNullableExcelDate 允许空值', () => {
      expect(parseNullableExcelDate('', 2, '实际结束时间')).to.be.null
      expect(parseNullableExcelDate(null, 2, '实际结束时间')).to.be.null
      expect(parseNullableExcelDate(undefined, 2, '实际结束时间')).to.be.null
    })
  })

  describe('cleanErrorMessage', () => {
    it('清洗原生 SQL 语句，转换为人类可读的提示', () => {
      const sqlErr = new Error(
        'insert into "project_progress_v2_actual_records" ("BIM", "actualEndDate") values ($1, $2) - value too long for type character varying(10)'
      )
      const cleaned = cleanErrorMessage(sqlErr)
      expect(cleaned).to.not.include('insert into')
      expect(cleaned).to.include('字段内容长度超出限制（最大 10 个字符）')
    })

    it('清洗非空约束错误', () => {
      const sqlErr = new Error(
        'insert into "project_progress_v2_actual_records" ... - null value in column "taskName" of relation "project_progress_v2_actual_records" violates not-null constraint'
      )
      const cleaned = cleanErrorMessage(sqlErr)
      expect(cleaned).to.not.include('insert into')
      expect(cleaned).to.include('缺少必填字段内容（taskName）')
    })

    it('去除可能重复的“第 X 行”前缀', () => {
      const rowErr = new Error(
        '第 2 行包含已关联构件 [W03]，与工程已有进度重复，不予导入'
      )
      const cleaned = cleanErrorMessage(rowErr)
      expect(cleaned).to.equal('包含已关联构件 [W03]，与工程已有进度重复，不予导入')
    })
  })

  describe('parseImportRows 读取真实测试文件', () => {
    it('正确解析 1104 测试 Excel 文件的所有行并还原日期与字段', () => {
      const buf = fs.readFileSync(testExcelPath)
      const wb = XLSX.read(buf, { type: 'buffer', cellDates: false })
      const { rows, parseErrors } = parseImportRows(wb)

      expect(parseErrors).to.be.empty
      expect(rows).to.have.length(2)

      // 行 2：纯数字 Excel 序列号
      expect(rows[0].rowNumber).to.equal(2)
      expect(rows[0].taskName).to.equal('施工W02')
      expect(rows[0].componentCode).to.equal('W03')
      expect(rows[0].reportDate).to.equal('2026-11-20')
      expect(rows[0].planStartDate).to.equal('2026-11-02')
      expect(rows[0].planEndDate).to.equal('2026-11-06')
      expect(rows[0].actualStartDate).to.equal('2026-11-02')
      expect(rows[0].actualEndDate).to.equal('2026-11-06')

      // 行 3：文本日期格式
      expect(rows[1].rowNumber).to.equal(3)
      expect(rows[1].taskName).to.equal('1区W06')
      expect(rows[1].componentCode).to.equal('W04')
      expect(rows[1].reportDate).to.equal('2026-09-09')
      expect(rows[1].planStartDate).to.equal('2026-04-09')
      expect(rows[1].planEndDate).to.equal('2026-04-12')
      expect(rows[1].actualStartDate).to.equal('2026-04-09')
      expect(rows[1].actualEndDate).to.equal('2026-04-12')
    })
  })

  describe('importProgressV2ActualRecordsFromBuffer 集成与事务隔离测试', () => {
    const projectId = '65086f4b0c'
    const actorId = 'srjadmin'

    afterEach(async () => {
      const db = await getProjectDbClient({ projectId })
      // 清理测试生成的构件记录，确保不污染后续测试
      await db('project_progress_v2_actual_records')
        .where('projectId', projectId)
        .whereIn('componentCode', ['W03', 'W04', 'TEST-FAIL-01', 'TEST-OK-01'])
        .delete()
    })

    it('真实 Excel 文件能够成功导入两行记录入库，且日期与构件关联正确', async () => {
      const db = await getProjectDbClient({ projectId })
      const buf = fs.readFileSync(testExcelPath)

      const result = await importProgressV2ActualRecordsFromBuffer({
        db,
        projectId,
        buffer: buf,
        actorId
      })

      expect(result.totalCount).to.equal(2)
      expect(result.createdCount).to.equal(2)
      expect(result.updatedCount).to.equal(0)
      expect(result.failedRows).to.be.empty

      // 查询数据库校验入库值
      const dbRows = await db('project_progress_v2_actual_records')
        .where('projectId', projectId)
        .whereIn('componentCode', ['W03', 'W04'])
        .orderBy('componentCode', 'asc')

      expect(dbRows).to.have.length(2)

      const r2 = dbRows.find((r: any) => r.componentCode === 'W03')
      expect(r2).to.exist
      expect(r2.taskName).to.equal('施工W02')
      expect(r2.reportDate).to.equal('2026-11-20')
      expect(r2.planStartDate).to.be.an.instanceOf(Date)
      expect(r2.planStartDate.getFullYear()).to.equal(2026)

      const r3 = dbRows.find((r: any) => r.componentCode === 'W04')
      expect(r3).to.exist
      expect(r3.taskName).to.equal('1区W06')
      expect(r3.reportDate).to.equal('2026-09-09')
      expect(r3.planStartDate).to.be.an.instanceOf(Date)
      expect(r3.planStartDate.getFullYear()).to.equal(2026)

      // 再次导入相同文件：应当触发构件重复校验，生成业务友好提示且不泄露任何 SQL
      const dupResult = await importProgressV2ActualRecordsFromBuffer({
        db,
        projectId,
        buffer: buf,
        actorId
      })
      expect(dupResult.totalCount).to.equal(2)
      expect(dupResult.createdCount).to.equal(0)
      expect(dupResult.failedRows).to.have.length(2)
      expect(dupResult.failedRows[0].error).to.include('包含已关联构件')
      expect(dupResult.failedRows[0].error).to.include('与工程已有进度重复，不予导入')
      expect(dupResult.failedRows[0].error).to.not.include('insert into')
      expect(dupResult.failedRows[1].error).to.include('包含已关联构件')
      expect(dupResult.failedRows[1].error).to.not.include('insert into')
    })

    it('单行异常使用 Savepoint 隔离，不影响批次中其他合法行入库', async () => {
      const db = await getProjectDbClient({ projectId })

      // 构造包含 1 行非法格式（行 2）和 1 行合法数据（行 3）的 Excel
      const headers = ['任务名称', '序号码', '填报日期', '计划开始时间', '计划结束时间']
      const badRow = [
        '任务异常',
        'TEST-FAIL-01',
        '2250-01-01',
        '2026-01-01',
        '2026-01-05'
      ] // 超出范围年份
      const goodRow = [
        '任务正常',
        'TEST-OK-01',
        '2026-10-01',
        '2026-10-01',
        '2026-10-05'
      ]

      const ws = XLSX.utils.aoa_to_sheet([headers, badRow, goodRow])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '进度填报')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

      const result = await importProgressV2ActualRecordsFromBuffer({
        db,
        projectId,
        buffer: buf,
        actorId
      })

      expect(result.totalCount).to.equal(2)
      expect(result.createdCount).to.equal(1)
      expect(result.failedRows).to.have.length(1)
      expect(result.failedRows[0].rowNumber).to.equal(2)
      expect(result.failedRows[0].error).to.include('超出有效范围（1970~2100）')
      expect(result.failedRows[0].error).to.not.include('insert into')

      // 验证合法的行 3 成功持久化到数据库
      const saved = await db('project_progress_v2_actual_records')
        .where('projectId', projectId)
        .where('componentCode', 'TEST-OK-01')
        .first()

      expect(saved).to.exist
      expect(saved.taskName).to.equal('任务正常')
      expect(saved.reportDate).to.equal('2026-10-01')
    })
  })
})
