import { expect } from 'chai'
import cryptoRandomString from 'crypto-random-string'
import {
  getObjectPreviewBufferOrFilepathFactory,
  sendObjectPreviewFactory
} from '@/modules/previews/services/management'
import { PreviewPriority, PreviewStatus } from '@/modules/previews/domain/consts'

describe('preview management @previews', () => {
  it('returns an error preview payload for previews in an error state', async () => {
    const logger = {
      child: () => ({
        info: () => {},
        warn: () => {}
      })
    }
    const result = await getObjectPreviewBufferOrFilepathFactory({
      getObject: async () =>
        ({
          data: {},
          id: cryptoRandomString({ length: 32 })
        }) as never,
      getObjectPreviewInfo: async () => ({
        streamId: cryptoRandomString({ length: 10 }),
        objectId: cryptoRandomString({ length: 32 }),
        previewStatus: PreviewStatus.ERROR,
        priority: PreviewPriority.LOW,
        lastUpdate: new Date(),
        preview: null,
        attempts: 1
      }),
      createObjectPreview: async () => true,
      getPreviewImage: async () => null,
      logger: logger as never
    })({
      streamId: cryptoRandomString({ length: 10 }),
      objectId: cryptoRandomString({ length: 32 })
    })

    expect(result.type).to.equal('file')
    expect(result.error).to.equal(true)
    expect(result.errorCode).to.equal('PREVIEW_ERROR_STATE')
    expect(result.previewStatus).to.equal('error')
  })

  it('sets preview status headers on the response', async () => {
    const headers: Record<string, string> = {}
    let sentFile: string | undefined
    const sendObjectPreview = sendObjectPreviewFactory({
      getObjectPreviewBufferOrFilepath: async () => ({
        type: 'file',
        file: '/tmp/preview.png',
        error: true,
        errorCode: 'PREVIEW_ERROR_STATE',
        previewStatus: 'error'
      }),
      getStream: async () =>
        ({
          id: cryptoRandomString({ length: 10 }),
          name: 'test stream'
        }) as never,
      makeOgImage: async () => Buffer.from('image')
    })

    await sendObjectPreview(
      { query: {}, params: { streamId: cryptoRandomString({ length: 10 }) } } as never,
      {
        set: (key: string, value: string) => {
          headers[key] = value
        },
        sendFile: (file: string) => {
          sentFile = file
        }
      } as never,
      cryptoRandomString({ length: 10 }),
      cryptoRandomString({ length: 32 })
    )

    expect(headers['X-Preview-Status']).to.equal('error')
    expect(headers['X-Preview-Error']).to.equal('true')
    expect(headers['X-Preview-Error-Code']).to.equal('PREVIEW_ERROR_STATE')
    expect(sentFile).to.equal('/tmp/preview.png')
  })
})
