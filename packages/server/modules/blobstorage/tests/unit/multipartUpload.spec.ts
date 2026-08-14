import {
  createBlobMultipartUploadFactory,
  completeBlobMultipartUploadFactory,
  abortBlobMultipartUploadFactory,
  listBlobMultipartUploadPartsFactory,
  getBlobMultipartPartUploadUrlFactory
} from '@/modules/blobstorage/services/multipartUpload'
import { UserInputError } from '@/modules/core/errors/userinput'
import { expectToThrow } from '@/test/assertionHelper'
import { expect } from 'chai'
import cryptoRandomString from 'crypto-random-string'
import { testLogger } from '@/observability/logging'
import { BlobUploadStatus } from '@speckle/shared/blobs'
import { AlreadyRegisteredBlobError } from '@/modules/blobstorage/errors'

const buildBlob = (overrides: Record<string, unknown> = {}) => ({
  id: cryptoRandomString({ length: 10 }),
  streamId: cryptoRandomString({ length: 10 }),
  userId: cryptoRandomString({ length: 10 }),
  objectKey: cryptoRandomString({ length: 10 }),
  fileName: 'test.stl',
  fileType: 'stl',
  fileSize: null,
  uploadStatus: BlobUploadStatus.Pending,
  uploadError: null,
  createdAt: new Date(),
  fileHash: null,
  multipartUploadId: null,
  ...overrides
})

describe('Multipart upload service @blobstorage', () => {
  describe('createBlobMultipartUploadFactory', () => {
    it('creates a multipart upload and persists the upload id', async () => {
      const uploadId = cryptoRandomString({ length: 20 })
      let upserted: unknown

      const SUT = createBlobMultipartUploadFactory({
        getBlob: async () => undefined,
        createMultipartUpload: async () => ({ uploadId }),
        upsertBlob: async (blob) => {
          upserted = blob
          return buildBlob(blob)
        },
        updateBlob: async ({ item }) => buildBlob(item),
        abortMultipartUpload: async () => undefined
      })

      const result = await SUT({
        projectId: cryptoRandomString({ length: 10 }),
        userId: cryptoRandomString({ length: 10 }),
        blobId: cryptoRandomString({ length: 10 }),
        fileName: 'test.stl'
      })

      expect(result.uploadId).to.equal(uploadId)
      expect(upserted).to.have.property('multipartUploadId', uploadId)
      expect(upserted).to.have.property('uploadStatus', BlobUploadStatus.Pending)
    })

    it('returns the existing upload id when the blob is already pending', async () => {
      const uploadId = cryptoRandomString({ length: 20 })
      let createCalled = false

      const SUT = createBlobMultipartUploadFactory({
        getBlob: async () => buildBlob({ multipartUploadId: uploadId }),
        createMultipartUpload: async () => {
          createCalled = true
          return { uploadId: cryptoRandomString({ length: 20 }) }
        },
        upsertBlob: async (blob) => buildBlob(blob),
        updateBlob: async ({ item }) => buildBlob(item),
        abortMultipartUpload: async () => undefined
      })

      const result = await SUT({
        projectId: cryptoRandomString({ length: 10 }),
        userId: cryptoRandomString({ length: 10 }),
        blobId: cryptoRandomString({ length: 10 }),
        fileName: 'test.stl'
      })

      expect(result.uploadId).to.equal(uploadId)
      expect(createCalled).to.be.false
    })

    it('errors when the file name has no extension', async () => {
      const SUT = createBlobMultipartUploadFactory({
        getBlob: async () => undefined,
        createMultipartUpload: async () => ({ uploadId: 'u' }),
        upsertBlob: async (blob) => buildBlob(blob),
        updateBlob: async ({ item }) => buildBlob(item),
        abortMultipartUpload: async () => undefined
      })

      const thrown = await expectToThrow(() =>
        SUT({
          projectId: cryptoRandomString({ length: 10 }),
          userId: cryptoRandomString({ length: 10 }),
          blobId: cryptoRandomString({ length: 10 }),
          fileName: 'no-extension'
        })
      )
      expect(thrown).to.be.instanceOf(UserInputError)
    })
  })

  describe('completeBlobMultipartUploadFactory', () => {
    it('completes the multipart upload and marks the blob completed', async () => {
      const uploadId = cryptoRandomString({ length: 20 })
      const etag = `"${cryptoRandomString({ length: 32 })}-2"`
      let updated: Record<string, unknown> | undefined

      const SUT = completeBlobMultipartUploadFactory({
        getBlob: async () => buildBlob({ multipartUploadId: uploadId }),
        completeMultipartUpload: async () => ({ eTag: etag }),
        getBlobMetadataFromStorage: async () => ({ contentLength: 123, eTag: etag }),
        updateBlob: async ({ item }) => {
          updated = item as Record<string, unknown>
          return buildBlob(item)
        },
        logger: testLogger
      })

      const result = await SUT({
        projectId: cryptoRandomString({ length: 10 }),
        blobId: cryptoRandomString({ length: 10 }),
        uploadId,
        parts: [{ partNumber: 1, etag: '"a"' }],
        maximumFileSize: 1000
      })

      expect(result.uploadStatus).to.equal(BlobUploadStatus.Completed)
      expect(updated).to.have.property('fileHash', etag)
      expect(updated).to.have.property('fileSize', 123)
      expect(updated).to.have.property('multipartUploadId', null)
    })

    it('errors when the blob is already completed', async () => {
      const SUT = completeBlobMultipartUploadFactory({
        getBlob: async () =>
          buildBlob({
            uploadStatus: BlobUploadStatus.Completed,
            multipartUploadId: 'u'
          }),
        completeMultipartUpload: async () => ({ eTag: '"etag"' }),
        getBlobMetadataFromStorage: async () => ({ contentLength: 1, eTag: '"etag"' }),
        updateBlob: async ({ item }) => buildBlob(item),
        logger: testLogger
      })

      const thrown = await expectToThrow(() =>
        SUT({
          projectId: cryptoRandomString({ length: 10 }),
          blobId: cryptoRandomString({ length: 10 }),
          uploadId: 'u',
          parts: [{ partNumber: 1, etag: '"a"' }],
          maximumFileSize: 1000
        })
      )
      expect(thrown).to.be.instanceOf(AlreadyRegisteredBlobError)
    })

    it('errors when the completed file exceeds the maximum size', async () => {
      const SUT = completeBlobMultipartUploadFactory({
        getBlob: async () => buildBlob({ multipartUploadId: 'u' }),
        completeMultipartUpload: async () => ({ eTag: '"etag"' }),
        getBlobMetadataFromStorage: async () => ({ contentLength: 100, eTag: '"etag"' }),
        updateBlob: async ({ item }) => buildBlob(item),
        logger: testLogger
      })

      const thrown = await expectToThrow(() =>
        SUT({
          projectId: cryptoRandomString({ length: 10 }),
          blobId: cryptoRandomString({ length: 10 }),
          uploadId: 'u',
          parts: [{ partNumber: 1, etag: '"a"' }],
          maximumFileSize: 10
        })
      )
      expect(thrown).to.be.instanceOf(UserInputError)
      expect(thrown.message).to.contain('File size exceeds maximum')
    })
  })

  describe('abortBlobMultipartUploadFactory', () => {
    it('aborts the multipart upload and clears the stored upload id', async () => {
      const uploadId = cryptoRandomString({ length: 20 })
      let aborted = false
      let updated: Record<string, unknown> | undefined

      const SUT = abortBlobMultipartUploadFactory({
        getBlob: async () => buildBlob({ multipartUploadId: uploadId }),
        abortMultipartUpload: async () => {
          aborted = true
        },
        updateBlob: async ({ item }) => {
          updated = item as Record<string, unknown>
          return buildBlob(item)
        }
      })

      await SUT({
        projectId: cryptoRandomString({ length: 10 }),
        blobId: cryptoRandomString({ length: 10 }),
        uploadId
      })

      expect(aborted).to.be.true
      expect(updated).to.have.property('multipartUploadId', null)
    })
  })

  describe('listBlobMultipartUploadPartsFactory', () => {
    it('returns the uploaded parts', async () => {
      const uploadId = cryptoRandomString({ length: 20 })
      const parts = [
        { partNumber: 1, etag: '"a"', size: 100 },
        { partNumber: 2, etag: '"b"', size: 200 }
      ]

      const SUT = listBlobMultipartUploadPartsFactory({
        getBlob: async () => buildBlob({ multipartUploadId: uploadId }),
        listMultipartUploadParts: async () => parts
      })

      const result = await SUT({
        projectId: cryptoRandomString({ length: 10 }),
        blobId: cryptoRandomString({ length: 10 }),
        uploadId
      })

      expect(result).to.deep.equal(parts)
    })
  })

  describe('getBlobMultipartPartUploadUrlFactory', () => {
    it('returns a pre-signed url for the part', async () => {
      const uploadId = cryptoRandomString({ length: 20 })
      const SUT = getBlobMultipartPartUploadUrlFactory({
        getBlob: async () => buildBlob({ multipartUploadId: uploadId }),
        getMultipartUploadPartSignedUrl: async ({ partNumber }) =>
          `https://example.com/part-${partNumber}`
      })

      const url = await SUT({
        projectId: cryptoRandomString({ length: 10 }),
        blobId: cryptoRandomString({ length: 10 }),
        uploadId,
        partNumber: 3,
        urlExpiryDurationSeconds: 60
      })

      expect(url).to.equal('https://example.com/part-3')
    })
  })
})
