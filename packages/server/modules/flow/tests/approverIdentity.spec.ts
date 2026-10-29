import { expect } from 'chai'
import { isAssignedApprover } from '@/modules/flow/helpers/approverIdentity'

describe('approval step identity', () => {
  it('accepts the assigned user id', () => {
    expect(isAssignedApprover(['user-1'], 'user-1')).to.equal(true)
  })

  it('accepts a verified email in legacy assignments', () => {
    expect(
      isAssignedApprover(['REVIEWER@example.com'], 'user-1', 'reviewer@example.com')
    ).to.equal(true)
  })

  it('accepts an approver matching online format (e.g. 1555515560222@163.com)', () => {
    expect(
      isAssignedApprover(['1555515560222@163.com'], 'user-999', '1555515560222@163.com')
    ).to.equal(true)
  })

  it('accepts an approver matching userName', () => {
    expect(
      isAssignedApprover(['财务监理李工'], 'user-1', 'li@example.com', '财务监理李工')
    ).to.equal(true)
    expect(
      isAssignedApprover(['Supervisor-A '], 'user-1', null, 'supervisor-a')
    ).to.equal(true)
  })

  it('does not accept another user without a verified matching email or name', () => {
    expect(
      isAssignedApprover(['user-2'], 'user-1', 'user-1@example.com', '张三')
    ).to.equal(false)
    expect(isAssignedApprover(['reviewer@example.com'], 'user-1')).to.equal(false)
    expect(isAssignedApprover(['合约部王工'], 'user-1', null, '李四')).to.equal(false)
  })

  it('keeps unrestricted steps available to any authenticated user', () => {
    expect(isAssignedApprover([], 'user-1')).to.equal(true)
  })
})
