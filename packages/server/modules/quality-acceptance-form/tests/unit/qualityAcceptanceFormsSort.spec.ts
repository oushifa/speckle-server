import { expect } from 'chai'
import { normalizeQualityAcceptanceFormsSort } from '@/modules/quality-acceptance-form/repositories/qualityAcceptanceForms'

describe('qualityAcceptanceFormsSort', () => {
  it('默认按验收日期倒序', () => {
    expect(normalizeQualityAcceptanceFormsSort({})).to.deep.equal({
      sortBy: 'actualFinishDate',
      sortOrder: 'desc'
    })
  })

  it('支持按验收日期排序', () => {
    expect(
      normalizeQualityAcceptanceFormsSort({
        sortBy: 'actualFinishDate',
        sortOrder: 'asc'
      })
    ).to.deep.equal({ sortBy: 'actualFinishDate', sortOrder: 'asc' })
    expect(
      normalizeQualityAcceptanceFormsSort({ sortBy: 'actualFinishDate' })
    ).to.deep.equal({ sortBy: 'actualFinishDate', sortOrder: 'desc' })
  })

  it('仍可显式按更新时间排序', () => {
    expect(
      normalizeQualityAcceptanceFormsSort({
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      })
    ).to.deep.equal({ sortBy: 'updatedAt', sortOrder: 'desc' })
  })

  it('忽略未支持的排序字段与方向', () => {
    expect(
      normalizeQualityAcceptanceFormsSort({
        sortBy: 'name; drop table users',
        sortOrder: 'ascending'
      })
    ).to.deep.equal({ sortBy: 'actualFinishDate', sortOrder: 'desc' })
  })
})
