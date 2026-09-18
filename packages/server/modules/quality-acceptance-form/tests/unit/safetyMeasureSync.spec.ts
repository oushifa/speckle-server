import { expect } from 'chai'
import {
  buildAutoSafetyMeasureCode,
  normalizeSafetyMeasureBaseDate,
  normalizeSectionIds,
  resolveSafetyMeasureBoqItemIds
} from '@/modules/quality-acceptance-form/services/safetyMeasureSync'

/**
 * 这些用例锁定"分部工程 → 命中清单项集合"的算法。
 *
 * 该算法必须与外部手工新建安全文明措施费时的算法（rest/router.ts 新建接口）完全一致，
 * 否则月度验工并入的清单项集合会与手工单据对不齐，安全文明措施费的累计数就会算错。
 * 一旦这里的行为被改动，请同步确认手工新建那边是否也需要调整。
 */
describe('safetyMeasureSync', () => {
  // 一棵覆盖各级节点类型的 BOQ 树：
  //
  // PROJECT(p)
  //   CATEGORY(cat)
  //     SECTION(s1)
  //       SUBSECTION(ss1)
  //         ITEM(i1)
  //         ITEM(i2)
  //     SECTION(s2)
  //       ITEM(i3)
  //   CATEGORY(cat2)
  //     SECTION(s3)
  //       ITEM(i4)
  const boqItems = [
    { id: 'p', parentId: null, type: 'PROJECT' },
    { id: 'cat', parentId: 'p', type: 'CATEGORY' },
    { id: 's1', parentId: 'cat', type: 'SECTION' },
    { id: 'ss1', parentId: 's1', type: 'SUBSECTION' },
    { id: 'i1', parentId: 'ss1', type: 'ITEM' },
    { id: 'i2', parentId: 'ss1', type: 'ITEM' },
    { id: 's2', parentId: 'cat', type: 'SECTION' },
    { id: 'i3', parentId: 's2', type: 'ITEM' },
    { id: 'cat2', parentId: 'p', type: 'CATEGORY' },
    { id: 's3', parentId: 'cat2', type: 'SECTION' },
    { id: 'i4', parentId: 's3', type: 'ITEM' }
  ]

  const resolve = (sectionIds: string[]) =>
    Array.from(resolveSafetyMeasureBoqItemIds({ boqItems, sectionIds })).sort()

  it('未选择分部工程时返回空集合', () => {
    expect(resolve([])).to.deep.equal([])
  })

  it('命中选中分部工程本身及其全部后代，并补全祖先到 CATEGORY', () => {
    // s1 本身 + ss1/i1/i2 后代 + 祖先 cat（到 CATEGORY 为止，不含 PROJECT）
    expect(resolve(['s1'])).to.deep.equal(['cat', 'i1', 'i2', 's1', 'ss1'])
  })

  it('只影响选中分部工程所在的分支', () => {
    // 不含兄弟分支 s2/i3，也不含另一个 CATEGORY 分支
    const hit = resolve(['s1'])
    expect(hit).to.not.include('i3')
    expect(hit).to.not.include('cat2')
    expect(hit).to.not.include('i4')
  })

  it('多选分部工程时取并集', () => {
    // 注意一个易错边界：补全祖先时只从"第一步命中的节点"出发向上回溯，
    // 回溯过程中被补进来的祖先不会再继续向上展开。
    // 因此这里没有 PROJECT(p)：cat2 是作为 s3 的祖先被补入的，
    // 但不会再从 cat2 继续往上补出 p。
    // 这与手工新建安全文明措施费的算法完全一致，两侧改动必须同步。
    expect(resolve(['s2', 's3'])).to.deep.equal(['cat', 'cat2', 'i3', 'i4', 's2', 's3'])
  })

  it('直接把 CATEGORY 作为选择项时，才会上溯补出 PROJECT', () => {
    // 与上一条对照：cat2 本身在选中集合里，所以会从它继续向上回溯到 p
    expect(resolve(['cat2'])).to.deep.equal(['cat2', 'i4', 'p', 's3'])
  })

  it('对不存在的分部工程 id 不产生命中', () => {
    expect(resolve(['not-exist'])).to.deep.equal([])
  })

  describe('buildAutoSafetyMeasureCode', () => {
    it('自动生成的单据占用 000 序号，保证同月排序最靠前', () => {
      // 用月中时间，避免测试机时区导致跨月
      const code = buildAutoSafetyMeasureCode(Date.UTC(2026, 0, 15))
      expect(code).to.equal('AQWM-202601-000')
    })

    it('手工单据从 001 起，不会与自动生成的编号冲突', () => {
      const auto = buildAutoSafetyMeasureCode(Date.UTC(2026, 0, 15))
      // 新建接口的取号逻辑是 max(已有序号) + 1，000 参与解析后为 0，因此下一个是 001
      const parsed = auto.slice('AQWM-202601-'.length)
      expect(parseInt(parsed, 10) + 1).to.equal(1)
    })
  })

  describe('normalizeSafetyMeasureBaseDate', () => {
    // 真实场景：月度验工的 baseDate 存的是 endOf('month')，即月末 23:59:59.999；
    // 手工安全文明措施费存的是月初 00:00:00。用本地时间构造，保证与运行机器时区无关。
    const monthEnd = new Date(2026, 8, 30, 23, 59, 59, 999).getTime()
    const monthStart = new Date(2026, 8, 1, 0, 0, 0, 0).getTime()

    it('把月末时间戳归一化到当月月初', () => {
      expect(Number(normalizeSafetyMeasureBaseDate(monthEnd))).to.equal(monthStart)
    })

    it('月初时间戳保持不变', () => {
      expect(normalizeSafetyMeasureBaseDate(monthStart)).to.equal(String(monthStart))
    })

    it('归一化后不晚于原值——否则同月的手工单据在累计里会看不到 0 期数据', () => {
      expect(Number(normalizeSafetyMeasureBaseDate(monthEnd))).to.be.lessThan(monthEnd)
    })

    it('是幂等的', () => {
      const once = normalizeSafetyMeasureBaseDate(monthEnd)
      expect(normalizeSafetyMeasureBaseDate(once)).to.equal(once)
    })

    it('不改变所属月份，因此生成的编号月份不变', () => {
      expect(
        buildAutoSafetyMeasureCode(normalizeSafetyMeasureBaseDate(monthEnd))
      ).to.equal(buildAutoSafetyMeasureCode(monthEnd))
    })
  })

  describe('normalizeSectionIds', () => {
    it('兼容 jsonb 读出为数组的形态', () => {
      expect(normalizeSectionIds(['a', 'b'])).to.deep.equal(['a', 'b'])
    })

    it('兼容历史遗留的 JSON 字符串形态', () => {
      expect(normalizeSectionIds('["a","b"]')).to.deep.equal(['a', 'b'])
    })

    it('对 null / 空串 / 非法 JSON / 非数组一律返回空数组', () => {
      expect(normalizeSectionIds(null)).to.deep.equal([])
      expect(normalizeSectionIds(undefined)).to.deep.equal([])
      expect(normalizeSectionIds('')).to.deep.equal([])
      expect(normalizeSectionIds('not-json')).to.deep.equal([])
      expect(normalizeSectionIds('{"a":1}')).to.deep.equal([])
      expect(normalizeSectionIds(123)).to.deep.equal([])
    })
  })
})
