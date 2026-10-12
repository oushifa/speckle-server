import { expect } from 'chai'
import { preciseAdd, preciseMul, wanToYuan } from '@/modules/shared/helpers/preciseMath'

describe('preciseMath', () => {
  describe('wanToYuan', () => {
    it('万元折算成元时抹掉浮点尾差', () => {
      // 回归用例：工程费用支付申请单的「上期末累计付款」曾显示
      // 230284474.99999999，根因就是直接写 `万元 * 10000`
      expect(23028.4475 * 10000).to.not.equal(230284475)
      expect(wanToYuan(23028.4475)).to.equal(230284475)
    })

    it('兼容数据库 numeric 字段返回的字符串', () => {
      expect(wanToYuan('23028.4475')).to.equal(230284475)
      expect(wanToYuan('0.0000')).to.equal(0)
    })

    it('空值按 0 处理', () => {
      expect(wanToYuan(null as unknown as string)).to.equal(0)
      expect(wanToYuan(undefined as unknown as string)).to.equal(0)
    })
  })

  it('preciseAdd / preciseMul 结果保留两位小数', () => {
    expect(preciseAdd(0.1, 0.2)).to.equal(0.3)
    expect(preciseMul(3.3, 0.1)).to.equal(0.33)
  })
})
