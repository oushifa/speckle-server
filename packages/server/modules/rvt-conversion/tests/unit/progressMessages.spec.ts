import { expect } from 'chai'
import {
  parseRvtConversionAckMessage,
  parseRvtConversionProgressMessage,
  parseRvtConversionResultMessage
} from '../../services/progressMessages'

describe('RVT conversion progress websocket payload', () => {
  it('accepts an ack payload with task correlation fields', () => {
    const payload = parseRvtConversionAckMessage({
      type: 'rvt_conversion_ack',
      taskId: 'job-123',
      externalTaskId: 'worker-task-456'
    })

    expect(payload).to.deep.equal({
      type: 'rvt_conversion_ack',
      taskId: 'job-123',
      externalTaskId: 'worker-task-456'
    })
  })

  it('accepts a full progress payload that is easy to render in UI', () => {
    const payload = parseRvtConversionProgressMessage(
      JSON.stringify({
        type: 'rvt_conversion_progress',
        taskId: 'job-123',
        externalTaskId: 'worker-task-456',
        phase: 'converting_model',
        progress: 37,
        message: '正在转换模型',
        current: 370,
        total: 1000
      })
    )

    expect(payload).to.deep.equal({
      type: 'rvt_conversion_progress',
      taskId: 'job-123',
      externalTaskId: 'worker-task-456',
      phase: 'converting_model',
      progress: 37,
      message: '正在转换模型',
      current: 370,
      total: 1000
    })
  })

  it('accepts a minimal progress payload when only overall percent is available', () => {
    const payload = parseRvtConversionProgressMessage({
      type: 'rvt_conversion_progress',
      taskId: 'job-123',
      phase: 'uploading_version',
      progress: 82,
      message: '正在上传 Speckle 对象'
    })

    expect(payload).to.deep.equal({
      type: 'rvt_conversion_progress',
      taskId: 'job-123',
      phase: 'uploading_version',
      progress: 82,
      message: '正在上传 Speckle 对象'
    })
  })

  it('rejects payloads without a stable taskId', () => {
    const payload = parseRvtConversionProgressMessage({
      type: 'rvt_conversion_progress',
      phase: 'converting_model',
      progress: 37,
      message: '正在转换模型'
    })

    expect(payload).to.equal(null)
  })

  it('rejects payloads whose progress is outside 0-100', () => {
    const payload = parseRvtConversionProgressMessage({
      type: 'rvt_conversion_progress',
      taskId: 'job-123',
      phase: 'converting_model',
      progress: 101,
      message: '正在转换模型'
    })

    expect(payload).to.equal(null)
  })

  it('rejects payloads that send current without total', () => {
    const payload = parseRvtConversionProgressMessage({
      type: 'rvt_conversion_progress',
      taskId: 'job-123',
      phase: 'converting_model',
      progress: 37,
      message: '正在转换模型',
      current: 370
    })

    expect(payload).to.equal(null)
  })

  it('rejects payloads whose current count is greater than total', () => {
    const payload = parseRvtConversionProgressMessage({
      type: 'rvt_conversion_progress',
      taskId: 'job-123',
      phase: 'converting_model',
      progress: 37,
      message: '正在转换模型',
      current: 1001,
      total: 1000
    })

    expect(payload).to.equal(null)
  })

  it('accepts a success result payload with version id', () => {
    const payload = parseRvtConversionResultMessage({
      type: 'rvt_conversion_result',
      taskId: 'job-123',
      status: 'success',
      versionId: 'version-123'
    })

    expect(payload).to.deep.equal({
      type: 'rvt_conversion_result',
      taskId: 'job-123',
      status: 'success',
      versionId: 'version-123'
    })
  })

  it('rejects failed result payloads without an error message', () => {
    const payload = parseRvtConversionResultMessage({
      type: 'rvt_conversion_result',
      taskId: 'job-123',
      status: 'failed'
    })

    expect(payload).to.equal(null)
  })
})
