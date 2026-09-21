import cryptoRandomString from 'crypto-random-string'
import type { Knex } from 'knex'
import { BlobUploadStatus } from '@speckle/shared/blobs'
import { getObjectKey } from '@/modules/blobstorage/helpers/blobs'
import { getBlobFactory, upsertBlobFactory } from '@/modules/blobstorage/repositories'
import {
  getObjectStreamFactory,
  storeFileStreamFactory
} from '@/modules/blobstorage/repositories/blobs'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getCommitBranchFactory,
  getCommitFactory,
  switchCommitBranchFactory,
  updateCommitFactory
} from '@/modules/core/repositories/commits'
import {
  getBranchByIdFactory,
  getBranchLatestCommitsFactory,
  getStreamBranchByNameFactory,
  markCommitBranchUpdatedFactory
} from '@/modules/core/repositories/branches'
import {
  getCommitStreamFactory,
  getStreamFactory
} from '@/modules/core/repositories/streams'
import { updateCommitAndNotifyFactory } from '@/modules/core/services/commit/management'
import { FileUploads } from '@/modules/core/dbSchema'
import { notifyChangeInFileStatus } from '@/modules/fileuploads/services/management'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import type { FileUploadRecord } from '@/modules/fileuploads/helpers/types'
import {
  saveUploadFileFactory,
  updateFileUploadFactory
} from '@/modules/fileuploads/repositories/fileUploads'
import {
  createViewerObjectCustomAttributeFactory,
  getViewerObjectCustomAttributesFactory
} from '@/modules/viewer/repositories/viewerObjectCustomAttributes'
import { getEventBus } from '@/modules/shared/services/eventBus'

export type AttachImportedModelSourceResult = {
  sourceFileId: string | null
  sourceFileName: string | null
  seedId: string | null
  assetId: string | null
  assetName: string | null
  copiedAttributeCount: number
}

const buildAttributeKey = (applicationId: string, name: string) =>
  `${applicationId}::${name}`

const getLatestFileUpload = async (params: {
  db: Knex
  projectId: string
  modelId: string
}): Promise<FileUploadRecord | undefined> =>
  await params
    .db<FileUploadRecord>(FileUploads.name)
    .where({
      [FileUploads.col.streamId]: params.projectId,
      [FileUploads.col.modelId]: params.modelId
    })
    .orderBy(FileUploads.col.uploadDate, 'desc')
    .first()

/**
 * 从模型库导入模型后，把「源文件 / 中海同步标识 / 自定义属性」补齐到目标模型。
 *
 * 背景：从模型库导入只复制了对象树并新建版本，没有带上 file_uploads / blob 以及
 * 中海（DTP）的 seedId/assetId/assetName。因此导入后的模型既没有源文件可下载，
 * 也无法参与中海同步，`bim-custom-label` 导出还会因为缺少 seedId 直接报错。
 *
 * 该服务把源模型最新版本对应的源文件复制到目标项目（重新写入 blob_storage 与
 * file_uploads），并继承源版本的中海标识、复制自定义属性。
 */
export const attachImportedModelSourceFactory =
  () =>
  async (params: {
    sourceProjectId: string
    sourceModelId: string
    targetProjectId: string
    targetModelId: string
    targetVersionId?: string | null
    userId: string
  }): Promise<AttachImportedModelSourceResult> => {
    const { sourceProjectId, sourceModelId, targetProjectId, targetModelId } = params

    const [sourceDb, targetDb, sourceStorage, targetStorage] = await Promise.all([
      getProjectDbClient({ projectId: sourceProjectId }),
      getProjectDbClient({ projectId: targetProjectId }),
      getProjectObjectStorage({ projectId: sourceProjectId }),
      getProjectObjectStorage({ projectId: targetProjectId })
    ])

    const getTargetModel = getBranchByIdFactory({ db: targetDb })
    const targetModel = await getTargetModel(targetModelId, {
      streamId: targetProjectId
    })
    if (!targetModel) {
      throw new Error('Target model not found')
    }

    const [sourceVersion] = await getBranchLatestCommitsFactory({ db: sourceDb })(
      [sourceModelId],
      sourceProjectId,
      { limit: 1 }
    )

    const targetVersion = params.targetVersionId
      ? await getCommitFactory({ db: targetDb })(params.targetVersionId, {
          streamId: targetProjectId
        })
      : (
          await getBranchLatestCommitsFactory({ db: targetDb })(
            [targetModelId],
            targetProjectId,
            { limit: 1 }
          )
        )[0]

    if (!targetVersion) {
      throw new Error('Target version not found')
    }

    const result: AttachImportedModelSourceResult = {
      sourceFileId: null,
      sourceFileName: null,
      seedId: sourceVersion?.seedId || null,
      assetId: sourceVersion?.assetId || null,
      assetName: sourceVersion?.assetName || null,
      copiedAttributeCount: 0
    }

    // 1) 继承中海（DTP）同步标识，让导入模型直接处于「已同步」状态
    if (sourceVersion) {
      const patch: { seedId?: string; assetId?: string; assetName?: string } = {}
      if (sourceVersion.seedId && sourceVersion.seedId !== targetVersion.seedId) {
        patch.seedId = sourceVersion.seedId
      }
      if (sourceVersion.assetId && sourceVersion.assetId !== targetVersion.assetId) {
        patch.assetId = sourceVersion.assetId
      }
      if (
        sourceVersion.assetName &&
        sourceVersion.assetName !== targetVersion.assetName
      ) {
        patch.assetName = sourceVersion.assetName
      }

      if (Object.keys(patch).length) {
        const updateCommitAndNotify = updateCommitAndNotifyFactory({
          getCommit: getCommitFactory({ db: targetDb }),
          getStream: getStreamFactory({ db: targetDb }),
          getCommitStream: getCommitStreamFactory({ db: targetDb }),
          getStreamBranchByName: getStreamBranchByNameFactory({ db: targetDb }),
          getCommitBranch: getCommitBranchFactory({ db: targetDb }),
          switchCommitBranch: switchCommitBranchFactory({ db: targetDb }),
          updateCommit: updateCommitFactory({ db: targetDb }),
          emitEvent: getEventBus().emit,
          markCommitBranchUpdated: markCommitBranchUpdatedFactory({ db: targetDb })
        })

        await updateCommitAndNotify(
          {
            projectId: targetProjectId,
            versionId: targetVersion.id,
            ...patch,
            skipStandardUpdateAuth: true
          },
          params.userId
        )
      }
    }

    // 2) 复制源文件（blob + file_uploads），保证源文件可下载且可再次发起中海同步
    const sourceUpload = await getLatestFileUpload({
      db: sourceDb,
      projectId: sourceProjectId,
      modelId: sourceModelId
    })

    if (sourceUpload?.fileName) {
      const existingTargetUpload = await getLatestFileUpload({
        db: targetDb,
        projectId: targetProjectId,
        modelId: targetModelId
      })

      if (existingTargetUpload) {
        result.sourceFileId = existingTargetUpload.id
        result.sourceFileName = existingTargetUpload.fileName
      } else {
        const sourceBlob = await getBlobFactory({ db: sourceDb })({
          streamId: sourceProjectId,
          blobId: sourceUpload.id
        })
        const sourceObjectKey =
          sourceBlob?.objectKey || getObjectKey(sourceProjectId, sourceUpload.id)

        const fileStream = await getObjectStreamFactory({
          storage: sourceStorage.private
        })({ objectKey: sourceObjectKey })

        const targetBlobId = cryptoRandomString({ length: 10 })
        const targetObjectKey = getObjectKey(targetProjectId, targetBlobId)
        const { fileHash } = await storeFileStreamFactory({
          storage: targetStorage.private
        })({ objectKey: targetObjectKey, fileStream })

        const fileSize = sourceUpload.fileSize ?? sourceBlob?.fileSize ?? null

        await upsertBlobFactory({ db: targetDb })({
          id: targetBlobId,
          streamId: targetProjectId,
          userId: params.userId,
          objectKey: targetObjectKey,
          fileName: sourceUpload.fileName,
          fileType: sourceUpload.fileType || 'unknown',
          fileSize,
          uploadStatus: BlobUploadStatus.Completed,
          fileHash
        })

        await saveUploadFileFactory({ db: targetDb })({
          fileId: targetBlobId,
          streamId: targetProjectId,
          branchName: targetModel.name,
          userId: params.userId,
          fileName: sourceUpload.fileName,
          fileType: sourceUpload.fileType || 'unknown',
          fileSize,
          modelId: targetModelId
        })

        const updatedUpload = await updateFileUploadFactory({ db: targetDb })({
          id: targetBlobId,
          upload: {
            convertedStatus: FileUploadConvertedStatus.Completed,
            convertedMessage: '从模型库导入',
            convertedCommitId: targetVersion.id,
            convertedLastUpdate: new Date(),
            progressPercent: 100,
            progressPhase: 'completed',
            progressMessage: '从模型库导入完成'
          }
        })

        result.sourceFileId = targetBlobId
        result.sourceFileName = sourceUpload.fileName

        await notifyChangeInFileStatus({ eventEmit: getEventBus().emit })({
          file: updatedUpload
        })
      }
    }

    // 3) 复制自定义属性，保证「导出模型数据」内容与模型库一致
    const getSourceAttributes = getViewerObjectCustomAttributesFactory({ db: sourceDb })
    const getTargetAttributes = getViewerObjectCustomAttributesFactory({ db: targetDb })
    const createTargetAttribute = createViewerObjectCustomAttributeFactory({
      db: targetDb
    })

    const [sourceAttributes, targetAttributes] = await Promise.all([
      getSourceAttributes({ projectId: sourceProjectId, modelId: sourceModelId }),
      getTargetAttributes({ projectId: targetProjectId, modelId: targetModelId })
    ])

    if (sourceAttributes.length) {
      const existingKeys = new Set(
        targetAttributes.map((attribute) =>
          buildAttributeKey(attribute.applicationId, attribute.name)
        )
      )

      for (const attribute of sourceAttributes) {
        if (!attribute.applicationId || !attribute.name) continue
        const key = buildAttributeKey(attribute.applicationId, attribute.name)
        if (existingKeys.has(key)) continue

        await createTargetAttribute({
          projectId: targetProjectId,
          modelId: targetModelId,
          applicationId: attribute.applicationId,
          authorId: attribute.authorId ?? null,
          name: attribute.name,
          value: attribute.value ?? ''
        })
        existingKeys.add(key)
        result.copiedAttributeCount++
      }
    }

    return result
  }
