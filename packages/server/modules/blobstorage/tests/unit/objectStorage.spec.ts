import {
  getDynamicPublicObjectStorage,
  getObjectStorage
} from '@/modules/blobstorage/clients/objectStorage'
import { expect } from 'chai'

describe('Object storage client', () => {
  const originalOverrides = process.env['S3_FRONTEND_ORIGIN_ENDPOINT_OVERRIDES']

  const buildStorage = (endpoint: string) =>
    getObjectStorage({
      credentials: {
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin'
      },
      endpoint,
      region: 'us-east-1',
      bucket: 'speckle-server'
    })

  afterEach(() => {
    if (originalOverrides === undefined) {
      delete process.env['S3_FRONTEND_ORIGIN_ENDPOINT_OVERRIDES']
    } else {
      process.env['S3_FRONTEND_ORIGIN_ENDPOINT_OVERRIDES'] = originalOverrides
    }
  })

  it('uses configured override endpoint when frontend origin matches', () => {
    process.env['S3_FRONTEND_ORIGIN_ENDPOINT_OVERRIDES'] = JSON.stringify([
      {
        frontendOrigins: ['http://10.0.0.20:3000'],
        endpoint: 'http://10.0.0.30:9000'
      },
      {
        frontendOrigins: ['http://61.145.255.42:3300', 'https://files.example.com'],
        endpoint: 'http://192.168.1.50:9000'
      }
    ])

    const storage = getDynamicPublicObjectStorage({
      objectStorage: buildStorage('http://61.145.255.42:3303'),
      frontendOrigin: 'https://files.example.com'
    })

    expect(storage.params.endpoint).to.equal('http://192.168.1.50:9000')
  })

  it('supports mapping multiple frontend origins to the same endpoint', () => {
    process.env['S3_FRONTEND_ORIGIN_ENDPOINT_OVERRIDES'] = JSON.stringify([
      {
        frontendOrigins: ['http://61.145.255.42:3300', 'http://example.com'],
        endpoint: 'http://192.168.1.50:9000'
      }
    ])

    const storage = getDynamicPublicObjectStorage({
      objectStorage: buildStorage('http://61.145.255.42:3303'),
      frontendOrigin: 'http://61.145.255.42:3300'
    })

    expect(storage.params.endpoint).to.equal('http://192.168.1.50:9000')
  })

  it('falls back to hostname rewrite when no override matches', () => {
    delete process.env['S3_FRONTEND_ORIGIN_ENDPOINT_OVERRIDES']

    const storage = getDynamicPublicObjectStorage({
      objectStorage: buildStorage('http://61.145.255.42:3303'),
      frontendOrigin: 'http://192.168.0.25:3300'
    })

    expect(storage.params.endpoint).to.equal('http://192.168.0.25:3303/')
  })
})
