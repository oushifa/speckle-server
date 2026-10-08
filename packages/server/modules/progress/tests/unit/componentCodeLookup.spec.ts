import { expect } from 'chai'
import { extractComponentCodeFromObjectData } from '@/modules/progress/services/componentCodeLookup'

describe('extractComponentCodeFromObjectData', () => {
  it('returns the full concatenated code', () => {
    const code = extractComponentCodeFromObjectData({
      分类对象代码: 'ABC',
      空间代码: 'S1',
      分部分项代码: 'SEC',
      序号码: 'W03'
    })

    expect(code).to.equal('ABCS1SECW03')
  })

  it('prefers a directly stored component code over the concatenated one', () => {
    const code = extractComponentCodeFromObjectData({
      构件编码: '14-94.01.05.00.00.1NB01010102E01',
      分类对象代码: 'ABC',
      序号码: 'W03'
    })

    expect(code).to.equal('14-94.01.05.00.00.1NB01010102E01')
  })

  it('uses the default space code when the object has none', () => {
    const code = extractComponentCodeFromObjectData(
      { 分类对象代码: 'ABC', 分部分项代码: 'SEC', 序号码: 'W03' },
      { defaultSpaceCode: 'SPACE' }
    )

    expect(code).to.equal('ABCSPACESECW03')
  })

  it('reads Speckle { name, value } parameter nodes', () => {
    const code = extractComponentCodeFromObjectData({
      parameters: {
        code: { name: '构件编码', value: 'CB-01' },
        serial: { name: '序号码', value: 'W05' }
      }
    })

    expect(code).to.equal('CB-01')
  })

  it('returns null when no code can be resolved', () => {
    expect(extractComponentCodeFromObjectData({})).to.equal(null)
    expect(extractComponentCodeFromObjectData(null)).to.equal(null)
    expect(extractComponentCodeFromObjectData({ 空间代码: 'S1' })).to.equal(null)
  })
})
