import { expect } from 'chai'
import {
  isQualityAcceptanceFormLocked,
  isQualityAcceptanceFormStatusLocked
} from '@/modules/quality-acceptance-form/helpers/formLock'

describe('qualityAcceptanceFormLock', () => {
  it('查验中/已查验状态禁止编辑', () => {
    expect(isQualityAcceptanceFormStatusLocked({ approveStatus: 'PENDING' })).to.equal(
      true
    )
    expect(isQualityAcceptanceFormStatusLocked({ approveStatus: 'APPROVED' })).to.equal(
      true
    )
    // 兼容小写与前后空格
    expect(
      isQualityAcceptanceFormStatusLocked({ approveStatus: ' approved ' })
    ).to.equal(true)
  })

  it('未查验/已拒绝/已取消状态不因状态本身被锁定', () => {
    for (const approveStatus of [
      null,
      undefined,
      '',
      'START',
      'REJECTED',
      'CANCELED'
    ]) {
      expect(
        isQualityAcceptanceFormStatusLocked({ approveStatus }),
        `status=${String(approveStatus)}`
      ).to.equal(false)
    }
  })

  it('被月度验工占用的单据始终锁定', () => {
    expect(
      isQualityAcceptanceFormLocked({
        approveStatus: null,
        occupiedMeasurementId: 'mm12345678'
      })
    ).to.equal(true)
    expect(
      isQualityAcceptanceFormLocked({
        approveStatus: 'APPROVED',
        occupiedMeasurementId: null
      })
    ).to.equal(true)
    expect(
      isQualityAcceptanceFormLocked({
        approveStatus: 'REJECTED',
        occupiedMeasurementId: null
      })
    ).to.equal(false)
  })
})
