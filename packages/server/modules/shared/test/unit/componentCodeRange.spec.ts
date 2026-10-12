import { expect } from 'chai'
import {
  compressComponentCodeRanges,
  expandComponentCodeRange,
  findInvalidComponentCodeRanges,
  isComponentCodeRange
} from '@/modules/shared/utils/componentCodeRange'

describe('componentCodeRange', () => {
  describe('expandComponentCodeRange', () => {
    it('展开用户台账里的连写区间 CB1-10~CB1-20', () => {
      expect(expandComponentCodeRange('CB1-10~CB1-20')).to.deep.equal([
        'CB1-10',
        'CB1-11',
        'CB1-12',
        'CB1-13',
        'CB1-14',
        'CB1-15',
        'CB1-16',
        'CB1-17',
        'CB1-18',
        'CB1-19',
        'CB1-20'
      ])
    })

    it('区间终点省略前缀时按起点前缀展开', () => {
      expect(expandComponentCodeRange('CB1-10~12')).to.deep.equal([
        'CB1-10',
        'CB1-11',
        'CB1-12'
      ])
    })

    it('数字宽度按起点补零（与质量验收既有口径一致）', () => {
      expect(expandComponentCodeRange('CB13~123')).to.have.length(111)
      expect(expandComponentCodeRange('CB13~123')[0]).to.equal('CB13')
      expect(expandComponentCodeRange('CB13~123').at(-1)).to.equal('CB123')
      expect(expandComponentCodeRange('CB01~CB03')).to.deep.equal([
        'CB01',
        'CB02',
        'CB03'
      ])
    })

    it('兼容全角波浪号', () => {
      expect(expandComponentCodeRange('CB1-01～CB1-02')).to.deep.equal([
        'CB1-01',
        'CB1-02'
      ])
    })

    it('普通编码原样返回', () => {
      expect(expandComponentCodeRange('CB1-10')).to.deep.equal(['CB1-10'])
      expect(expandComponentCodeRange(' CB1-10 ')).to.deep.equal(['CB1-10'])
    })

    it('无法识别成区间的写法只拆分两端，不展开', () => {
      // 倒序
      expect(expandComponentCodeRange('CB1-20~CB1-10')).to.deep.equal([
        'CB1-20',
        'CB1-10'
      ])
      // 两端前缀不一致
      expect(expandComponentCodeRange('CB1-10~AB2-20')).to.deep.equal([
        'CB1-10',
        'AB2-20'
      ])
      // 没有数字后缀
      expect(expandComponentCodeRange('XX~YY')).to.deep.equal(['XX', 'YY'])
    })
  })

  describe('findInvalidComponentCodeRanges', () => {
    it('一个片段包含多个波浪号视为非法连写', () => {
      expect(findInvalidComponentCodeRanges(['CB1-13~CB1~123'])).to.deep.equal([
        'CB1-13~CB1~123'
      ])
    })

    it('合法的单波浪号区间不报错', () => {
      expect(
        findInvalidComponentCodeRanges(['CB1-10~CB1-20', 'CB13~123', 'CB1-10'])
      ).to.deep.equal([])
    })
  })

  it('isComponentCodeRange 判断片段是否含波浪号', () => {
    expect(isComponentCodeRange('CB1-10~CB1-20')).to.equal(true)
    expect(isComponentCodeRange('CB1-10')).to.equal(false)
  })

  describe('compressComponentCodeRanges', () => {
    it('连续号码压缩回区间写法', () => {
      expect(compressComponentCodeRanges(['CB1-10', 'CB1-11', 'CB1-12'])).to.equal(
        'CB1-10~12'
      )
    })

    it('乱序输入也能正确压缩', () => {
      expect(compressComponentCodeRanges(['CB1-11', 'CB1-10', 'CB1-12'])).to.equal(
        'CB1-10~12'
      )
    })

    it('不同前缀 / 不同数字宽度分组压缩', () => {
      expect(
        compressComponentCodeRanges(['CB1-01', 'CB1-02', 'CB2-05', 'CB1-03'])
      ).to.equal('CB1-01~03, CB2-05')
    })

    it('单个编码与空输入', () => {
      expect(compressComponentCodeRanges(['CB13'])).to.equal('CB13')
      expect(compressComponentCodeRanges([])).to.equal('')
    })

    it('展开再压缩可回到紧凑写法（导出 -> 再导入闭环）', () => {
      expect(
        compressComponentCodeRanges(expandComponentCodeRange('CB1-10~CB1-20'))
      ).to.equal('CB1-10~20')
      // 压缩结果仍可再次展开
      expect(
        expandComponentCodeRange(
          compressComponentCodeRanges(['CB1-10', 'CB1-11', 'CB1-12'])
        )
      ).to.deep.equal(['CB1-10', 'CB1-11', 'CB1-12'])
    })
  })
})
