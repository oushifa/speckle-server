import { expect } from 'chai'
import {
  getObjectStorage,
  getSignedDownloadUrlFactory,
  type ObjectStorage
} from '@/modules/blobstorage/clients/objectStorage'
import { getRvtConversionDownloadStorage } from '@/modules/rvt-conversion/services/storage'

describe('RVT conversion storage', () => {
  const publicEndpoint = 'http://47.100.77.97:64484'
  const internalEndpoint = 'http://192.168.0.25:9000'
  let existingInternalEndpoint: string | undefined
  let existingPublicEndpoint: string | undefined

  const buildPublicStorage = (): ObjectStorage =>
    getObjectStorage({
      credentials: {
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin'
      },
      endpoint: publicEndpoint,
      region: 'us-east-1',
      bucket: 'speckle-server'
    })

  before(() => {
    existingInternalEndpoint = process.env['RVT_CONVERSION_INTERNAL_S3_ENDPOINT']
    existingPublicEndpoint = process.env['S3_PUBLIC_ENDPOINT']
  })

  after(() => {
    if (existingInternalEndpoint === undefined)
      delete process.env['RVT_CONVERSION_INTERNAL_S3_ENDPOINT']
    else
      process.env['RVT_CONVERSION_INTERNAL_S3_ENDPOINT'] = existingInternalEndpoint

    if (existingPublicEndpoint === undefined) delete process.env['S3_PUBLIC_ENDPOINT']
    else process.env['S3_PUBLIC_ENDPOINT'] = existingPublicEndpoint
  })

  it('signs sourceFileUrl with RVT_CONVERSION_INTERNAL_S3_ENDPOINT when configured', async () => {
    process.env['RVT_CONVERSION_INTERNAL_S3_ENDPOINT'] = internalEndpoint
    process.env['S3_PUBLIC_ENDPOINT'] = publicEndpoint

    const storage = getRvtConversionDownloadStorage({
      public: buildPublicStorage()
    })
    const getSignedDownloadUrl = getSignedDownloadUrlFactory({
      objectStorage: storage
    })

    const sourceFileUrl = await getSignedDownloadUrl({
      objectKey: 'rvt-conversion/source/project/file/test-model.rvt',
      urlExpiryDurationSeconds: 300
    })

    expect(new URL(sourceFileUrl).origin).to.equal(internalEndpoint)
  })

  it('falls back to S3_PUBLIC_ENDPOINT when RVT_CONVERSION_INTERNAL_S3_ENDPOINT is absent', async () => {
    delete process.env['RVT_CONVERSION_INTERNAL_S3_ENDPOINT']
    process.env['S3_PUBLIC_ENDPOINT'] = publicEndpoint

    const storage = getRvtConversionDownloadStorage({
      public: buildPublicStorage()
    })
    const getSignedDownloadUrl = getSignedDownloadUrlFactory({
      objectStorage: storage
    })

    const sourceFileUrl = await getSignedDownloadUrl({
      objectKey: 'rvt-conversion/source/project/file/test-model.rvt',
      urlExpiryDurationSeconds: 300
    })

    expect(new URL(sourceFileUrl).origin).to.equal(publicEndpoint)
  })
})
