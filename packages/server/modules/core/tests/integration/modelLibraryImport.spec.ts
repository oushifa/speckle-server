import { expect } from 'chai'
import cryptoRandomString from 'crypto-random-string'
import { BlobUploadStatus } from '@speckle/shared/blobs'
import { beforeEachContext } from '@/test/hooks'
import type { BasicTestUser } from '@/test/authHelper'
import { createTestUser } from '@/test/authHelper'
import {
  type BasicTestStream,
  createTestStream
} from '@/test/speckle-helpers/streamHelper'
import {
  type BasicTestBranch,
  createTestBranch
} from '@/test/speckle-helpers/branchHelper'
import { createTestCommit } from '@/test/speckle-helpers/commitHelper'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { getBlobMetadataFromStorage } from '@/modules/blobstorage/clients/objectStorage'
import { storeFileStreamFactory } from '@/modules/blobstorage/repositories/blobs'
import { getObjectKey } from '@/modules/blobstorage/helpers/blobs'
import { upsertBlobFactory } from '@/modules/blobstorage/repositories'
import { getCommitFactory } from '@/modules/core/repositories/commits'
import {
  getFileInfoFactoryV2,
  saveUploadFileFactory
} from '@/modules/fileuploads/repositories/fileUploads'
import {
  createViewerObjectCustomAttributeFactory,
  getViewerObjectCustomAttributesFactory
} from '@/modules/viewer/repositories/viewerObjectCustomAttributes'
import { attachImportedModelSourceFactory } from '@/modules/core/services/streams/modelLibraryImport'

const storeSourceBlob = async (params: {
  projectId: string
  userId: string
  fileName: string
}) => {
  const [projectDb, projectStorage] = await Promise.all([
    getProjectDbClient({ projectId: params.projectId }),
    getProjectObjectStorage({ projectId: params.projectId })
  ])

  const blobId = cryptoRandomString({ length: 10 })
  const objectKey = getObjectKey(params.projectId, blobId)
  const content = Buffer.from(`source-file-${blobId}`)

  const { fileHash } = await storeFileStreamFactory({
    storage: projectStorage.private
  })({
    objectKey,
    fileStream: content
  })

  await upsertBlobFactory({ db: projectDb })({
    id: blobId,
    streamId: params.projectId,
    userId: params.userId,
    objectKey,
    fileName: params.fileName,
    fileType: 'ifc',
    fileSize: content.length,
    uploadStatus: BlobUploadStatus.Completed,
    fileHash
  })

  return { blobId, fileSize: content.length }
}

describe('Model library import source attachment', () => {
  const attachImportedModelSource = attachImportedModelSourceFactory()
  let user: BasicTestUser
  let sourceStream: BasicTestStream
  let targetStream: BasicTestStream
  let sourceModel: BasicTestBranch
  let targetModel: BasicTestBranch

  before(async () => {
    await beforeEachContext()

    user = { name: 'model library importer', email: '', id: '' }
    await createTestUser(user)

    sourceStream = await createTestStream({ name: 'source library' }, user)
    targetStream = await createTestStream({ name: 'target project' }, user)

    sourceModel = await createTestBranch({
      branch: { name: 'library-model', streamId: '', authorId: '', id: '' },
      stream: sourceStream,
      owner: user
    })
    targetModel = await createTestBranch({
      branch: { name: 'imported-model', streamId: '', authorId: '', id: '' },
      stream: targetStream,
      owner: user
    })
  })

  it('copies source file, DTP identifiers and custom attributes', async () => {
    // 源模型版本：已同步中海，带 seedId/assetId
    const sourceCommit = await createTestCommit(
      {
        id: '',
        objectId: '',
        streamId: sourceStream.id,
        authorId: user.id,
        branchId: sourceModel.id,
        seedId: 'seed-from-library',
        assetId: 'asset-from-library'
      },
      { owner: user, stream: sourceStream }
    )

    // 源模型的源文件上传记录
    const { blobId: sourceBlobId, fileSize } = await storeSourceBlob({
      projectId: sourceStream.id,
      userId: user.id,
      fileName: 'library-model.ifc'
    })
    const sourceDb = await getProjectDbClient({ projectId: sourceStream.id })
    await saveUploadFileFactory({ db: sourceDb })({
      fileId: sourceBlobId,
      streamId: sourceStream.id,
      branchName: sourceModel.name,
      userId: user.id,
      fileName: 'library-model.ifc',
      fileType: 'ifc',
      fileSize,
      modelId: sourceModel.id
    })

    // 源模型的自定义属性
    await createViewerObjectCustomAttributeFactory({ db: sourceDb })({
      projectId: sourceStream.id,
      modelId: sourceModel.id,
      applicationId: 'element-1',
      authorId: user.id,
      name: '构件编码',
      value: 'A-001'
    })

    // 目标项目里由导入流程创建的版本
    const targetCommit = await createTestCommit(
      {
        id: '',
        objectId: '',
        streamId: targetStream.id,
        authorId: user.id,
        branchId: targetModel.id
      },
      { owner: user, stream: targetStream }
    )

    const result = await attachImportedModelSource({
      sourceProjectId: sourceStream.id,
      sourceModelId: sourceModel.id,
      targetProjectId: targetStream.id,
      targetModelId: targetModel.id,
      targetVersionId: targetCommit.id,
      userId: user.id
    })

    expect(result.seedId).to.equal(sourceCommit.seedId)
    expect(result.assetId).to.equal(sourceCommit.assetId)
    expect(result.copiedAttributeCount).to.equal(1)
    expect(result.sourceFileId).to.be.a('string')
    expect(result.sourceFileName).to.equal('library-model.ifc')

    const targetDb = await getProjectDbClient({ projectId: targetStream.id })

    // 1) 目标模型拿到源文件上传记录
    const targetUpload = await getFileInfoFactoryV2({ db: targetDb })({
      fileId: result.sourceFileId as string,
      projectId: targetStream.id
    })
    expect(targetUpload?.id).to.equal(result.sourceFileId)
    expect(targetUpload?.fileName).to.equal('library-model.ifc')
    expect(targetUpload?.modelId).to.equal(targetModel.id)
    expect(targetUpload?.convertedCommitId).to.equal(targetCommit.id)

    // 2) 目标版本继承中海标识
    const getCommit = getCommitFactory({ db: targetDb })
    const updatedTargetCommit = await getCommit(targetCommit.id, {
      streamId: targetStream.id
    })
    expect(updatedTargetCommit?.seedId).to.equal('seed-from-library')
    expect(updatedTargetCommit?.assetId).to.equal('asset-from-library')

    // 3) 源文件对象确实被复制到目标项目存储
    const targetStorage = await getProjectObjectStorage({ projectId: targetStream.id })
    const metadata = await getBlobMetadataFromStorage({
      objectStorage: targetStorage.private
    })({
      objectKey: getObjectKey(targetStream.id, result.sourceFileId as string)
    })
    expect(metadata.contentLength).to.equal(fileSize)

    // 4) 自定义属性被复制
    const targetAttributes = await getViewerObjectCustomAttributesFactory({
      db: targetDb
    })({
      projectId: targetStream.id,
      modelId: targetModel.id
    })
    expect(targetAttributes).to.have.length(1)
    expect(targetAttributes[0].applicationId).to.equal('element-1')
    expect(targetAttributes[0].value).to.equal('A-001')
  })
})
