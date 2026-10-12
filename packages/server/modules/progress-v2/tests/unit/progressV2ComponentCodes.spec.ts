import { expect } from 'chai'
import { parseProgressV2ComponentCodes } from '@/modules/progress-v2/services/progressV2ComponentCodes'

describe('parseProgressV2ComponentCodes', () => {
  it('展开波浪号连写区间（进度管理导入回归用例）', () => {
    const { codes, value } = parseProgressV2ComponentCodes('CB1-10~CB1-20', 2)
    expect(codes).to.have.length(11)
    expect(codes[0]).to.equal('CB1-10')
    expect(codes.at(-1)).to.equal('CB1-20')
    // 写回记录时保留用户原始的紧凑写法，不铺开
    expect(value).to.equal('CB1-10~CB1-20')
  })

  it('兼容区间终点省略前缀与全角波浪号', () => {
    expect(parseProgressV2ComponentCodes('CB1-10~20', 2).codes.at(-1)).to.equal(
      'CB1-20'
    )
    expect(parseProgressV2ComponentCodes('CB1-10～CB1-11', 2).codes).to.deep.equal([
      'CB1-10',
      'CB1-11'
    ])
  })

  it('兼容波浪号两侧带空格的写法', () => {
    expect(parseProgressV2ComponentCodes('CB1-10 ~ CB1-20', 2).codes).to.have.length(11)
  })

  it('支持多种分隔符混用并去重', () => {
    const { codes } = parseProgressV2ComponentCodes(
      'CB1-10~CB1-12, CB2-01；CB2-02、CB2-03 CB1-12',
      2
    )
    expect(codes).to.deep.equal([
      'CB1-10',
      'CB1-11',
      'CB1-12',
      'CB2-01',
      'CB2-02',
      'CB2-03'
    ])
  })

  it('普通编码列表按解析结果回写（统一分隔符）', () => {
    expect(parseProgressV2ComponentCodes('CB1-10 ;CB1-11', 2)).to.deep.equal({
      codes: ['CB1-10', 'CB1-11'],
      value: 'CB1-10, CB1-11'
    })
  })

  it('空值不参与解析', () => {
    expect(parseProgressV2ComponentCodes(null, 2)).to.deep.equal({
      codes: [],
      value: null
    })
    expect(parseProgressV2ComponentCodes('', 2)).to.deep.equal({
      codes: [],
      value: ''
    })
  })

  it('一个片段包含多个波浪号时报错并带行号', () => {
    expect(() => parseProgressV2ComponentCodes('CB1-13~CB1~123', 7)).to.throw(
      "第 7 行序号码中包含错误的连写方式：'CB1-13~CB1~123'，连写只能包含一个波浪号"
    )
  })

  it('区间过大时按行报错，避免手误拖死导入', () => {
    expect(() => parseProgressV2ComponentCodes('CB1-1~CB1-999999999', 3)).to.throw(
      '第 3 行序号码区间过大（单行最多 5000 个），请拆分后导入'
    )
    expect(parseProgressV2ComponentCodes('CB1-1~CB1-5000', 3).codes).to.have.length(
      5000
    )
    // 多个区间合并后同样受单行上限约束
    expect(() =>
      parseProgressV2ComponentCodes('CB1-1~CB1-3000, CB2-1~CB2-3000', 3)
    ).to.throw('第 3 行序号码区间过大（单行最多 5000 个），请拆分后导入')
  })

  it('单行纯编码过多时也报错', () => {
    const manyCodes = Array.from({ length: 5001 }, (_, i) => `CB1-${i + 1}`).join(', ')
    expect(() => parseProgressV2ComponentCodes(manyCodes, 9)).to.throw(
      '第 9 行序号码过多（单行最多 5000 个），请拆分后导入'
    )
  })

  it('无法识别成区间的写法原样保留，不误展开', () => {
    // 倒序区间
    expect(parseProgressV2ComponentCodes('CB1-20~CB1-10', 2).codes).to.deep.equal([
      'CB1-20',
      'CB1-10'
    ])
    // 两端前缀不一致
    expect(parseProgressV2ComponentCodes('CB1-10~AB2-20', 2).codes).to.deep.equal([
      'CB1-10',
      'AB2-20'
    ])
  })
})
