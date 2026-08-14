import { db } from '@/db/knex'
import {
  getBlobFactory,
  updateBlobFactory,
  upsertBlobFactory
} from '@/modules/blobstorage/repositories'
import {
  getDynamicPublicObjectStorage,
  getSignedUrlFactory,
  getBlobMetadataFromStorage,
  abortMultipartUploadFactory,
  completeMultipartUploadFactory,
  createMultipartUploadFactory,
  getMultipartUploadPartSignedUrlFactory,
  listMultipartUploadPartsFactory
} from '@/modules/blobstorage/clients/objectStorage'
import { generatePresignedUrlFactory } from '@/modules/blobstorage/services/presigned'
import {
  abortBlobMultipartUploadFactory,
  completeBlobMultipartUploadFactory,
  createBlobMultipartUploadFactory,
  getBlobMultipartPartUploadUrlFactory,
  listBlobMultipartUploadPartsFactory
} from '@/modules/blobstorage/services/multipartUpload'
import type { MultipartUploadPart } from '@/modules/blobstorage/domain/storageOperations'
import { getFileSizeLimit } from '@/modules/blobstorage/services/management'
import { getBranchesByIdsFactory } from '@/modules/core/repositories/branches'
import {
  storeApiTokenFactory,
  storeTokenResourceAccessDefinitionsFactory,
  storeTokenScopesFactory,
  storeUserServerAppTokenFactory
} from '@/modules/core/repositories/tokens'
import { createAppTokenFactory } from '@/modules/core/services/tokens'
import { FileUploads } from '@/modules/core/dbSchema'
import {
  getFileInfoFactoryV2,
  saveUploadFileFactory,
  saveUploadFileFactoryV2,
  updateFileUploadFactory
} from '@/modules/fileuploads/repositories/fileUploads'
import { fileImportQueues } from '@/modules/fileuploads/queues/fileimports'
import {
  FileUploadConvertedStatus,
  type FileUploadRecord,
  type FileUploadRecordV2
} from '@/modules/fileuploads/helpers/types'
import {
  insertNewUploadAndNotifyFactory,
  insertNewUploadAndNotifyFactoryV2,
  notifyChangeInFileStatus
} from '@/modules/fileuploads/services/management'
import { registerUploadCompleteAndStartFileImportFactory } from '@/modules/fileuploads/services/presigned'
import { registerMultipartUploadCompleteAndStartFileImportFactory } from '@/modules/fileuploads/services/multipart'
import { pushJobToFileImporterFactory } from '@/modules/fileuploads/services/createFileImport'
import { dispatchRvtFileImportFactory } from '@/modules/fileuploads/services/rvt'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { getEventBus } from '@/modules/shared/services/eventBus'
import {
  fileImportServiceShouldUsePrivateObjectsServerUrl,
  getFileUploadUrlExpiryMinutes,
  getPrivateObjectsServerOrigin,
  getServerOrigin
} from '@/modules/shared/helpers/envHelper'
import { resolveFrontendOriginFromRequest } from '@/modules/shared/helpers/frontendOrigin'
import { registerCompletedUploadFactory } from '@/modules/blobstorage/services/presigned'
import { TIME } from '@speckle/shared'
import { getFeatureFlags } from '@speckle/shared/environment'
import { BadRequestError } from '@/modules/shared/errors'
import type { Request } from 'express'
import cryptoRandomString from 'crypto-random-string'
import { logger } from '@/observability/logging'

const { FF_NEXT_GEN_FILE_IMPORTER_ENABLED } = getFeatureFlags()

export const getLatestModelFileUploadFactory =
  (deps: { db: Awaited<ReturnType<typeof getProjectDbClient>> }) =>
  async (params: {
    projectId: string
    modelId: string
  }): Promise<FileUploadRecordV2 | undefined> => {
    const record = await deps
      .db<FileUploadRecord>(FileUploads.name)
      .where({
        [FileUploads.col.streamId]: params.projectId,
        [FileUploads.col.modelId]: params.modelId
      })
      .orderBy(FileUploads.col.uploadDate, 'desc')
      .first()

    if (!record) return undefined

    return {
      ...record,
      projectId: record.streamId
    }
  }

export const prepareModelSyncUploadFactory =
  () =>
  async (params: {
    projectId: string
    userId: string
    fileName: string
    req: Request
  }) => {
    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId: params.projectId }),
      getProjectObjectStorage({ projectId: params.projectId })
    ])

    const generatePresignedUrl = generatePresignedUrlFactory({
      getSignedUrl: getSignedUrlFactory({
        objectStorage: getDynamicPublicObjectStorage({
          objectStorage: projectStorage.public,
          frontendOrigin: resolveFrontendOriginFromRequest(params.req)
        })
      }),
      upsertBlob: upsertBlobFactory({
        db: projectDb
      })
    })

    const fileId = cryptoRandomString({ length: 10 })
    const uploadUrl = await generatePresignedUrl({
      projectId: params.projectId,
      blobId: fileId,
      userId: params.userId,
      fileName: params.fileName,
      urlExpiryDurationSeconds: getFileUploadUrlExpiryMinutes() * TIME.minute
    })

    return {
      fileId,
      uploadUrl
    }
  }

export const startModelFileImportFactory =
  () =>
  async (params: {
    projectId: string
    modelId: string
    userId: string
    fileId: string
    etag: string
  }) => {
    if (!params.etag) {
      throw new BadRequestError('ETag is required')
    }

    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId: params.projectId }),
      getProjectObjectStorage({ projectId: params.projectId })
    ])

    const model = (
      await getBranchesByIdsFactory({ db: projectDb })([params.modelId], {
        streamId: params.projectId
      })
    )[0]
    if (!model) {
      throw new BadRequestError('Model not found')
    }

    const pushJobToFileImporter = pushJobToFileImporterFactory({
      getServerOrigin: fileImportServiceShouldUsePrivateObjectsServerUrl()
        ? getPrivateObjectsServerOrigin
        : getServerOrigin,
      createAppToken: createAppTokenFactory({
        storeApiToken: storeApiTokenFactory({ db }),
        storeTokenScopes: storeTokenScopesFactory({ db }),
        storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory({
          db
        }),
        storeUserServerAppToken: storeUserServerAppTokenFactory({ db })
      })
    })

    const insertNewUploadAndNotifyV2 = insertNewUploadAndNotifyFactoryV2({
      queues: fileImportQueues,
      allowUnscheduledFileTypes: ['rvt'],
      pushJobToFileImporter,
      saveUploadFile: saveUploadFileFactoryV2({ db: projectDb }),
      emit: getEventBus().emit
    })

    const insertNewUploadAndNotify = insertNewUploadAndNotifyFactory({
      saveUploadFile: saveUploadFileFactory({ db: projectDb }),
      emit: getEventBus().emit
    })

    const registerUploadCompleteAndStartFileImport =
      registerUploadCompleteAndStartFileImportFactory({
        registerCompletedUpload: registerCompletedUploadFactory({
          logger,
          getBlob: getBlobFactory({ db: projectDb }),
          updateBlob: updateBlobFactory({ db: projectDb }),
          getBlobMetadata: getBlobMetadataFromStorage({
            objectStorage: projectStorage.private
          })
        }),
        insertNewUploadAndNotify: FF_NEXT_GEN_FILE_IMPORTER_ENABLED
          ? insertNewUploadAndNotifyV2
          : insertNewUploadAndNotify,
        getFileInfo: getFileInfoFactoryV2({ db: projectDb }),
        getModelsByIds: getBranchesByIdsFactory({ db: projectDb })
      })

    const emitFileStatusChange = notifyChangeInFileStatus({
      eventEmit: getEventBus().emit
    })
    const updateFileUpload = updateFileUploadFactory({ db: projectDb })
    const dispatchRvtFileImport = dispatchRvtFileImportFactory({ db: projectDb })

    const upload = await registerUploadCompleteAndStartFileImport({
      projectId: params.projectId,
      fileId: params.fileId,
      modelId: params.modelId,
      userId: params.userId,
      expectedETag: params.etag,
      maximumFileSize: getFileSizeLimit()
    })

    if (upload.fileType.toLocaleLowerCase() === 'rvt') {
      try {
        await dispatchRvtFileImport({
          projectId: params.projectId,
          modelId: model.id,
          modelName: model.name,
          fileUpload: upload,
          userId: params.userId
        })
      } catch (error) {
        const failedFile = await updateFileUpload({
          id: upload.id,
          upload: {
            convertedStatus: FileUploadConvertedStatus.Error,
            convertedMessage:
              error instanceof Error ? error.message : 'Failed to dispatch RVT file import.',
            convertedLastUpdate: new Date()
          }
        })

        await emitFileStatusChange({
          file: failedFile
        })
      }
    }

    return upload
  }

export const prepareModelSyncMultipartUploadFactory =
  () =>
  async (params: {
    projectId: string
    userId: string
    fileName: string
  }) => {
    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId: params.projectId }),
      getProjectObjectStorage({ projectId: params.projectId })
    ])

    const createMultipart = createBlobMultipartUploadFactory({
      getBlob: getBlobFactory({ db: projectDb }),
      createMultipartUpload: createMultipartUploadFactory({
        objectStorage: projectStorage.private
      }),
      upsertBlob: upsertBlobFactory({ db: projectDb }),
      updateBlob: updateBlobFactory({ db: projectDb }),
      abortMultipartUpload: abortMultipartUploadFactory({
        objectStorage: projectStorage.private
      })
    })

    const fileId = cryptoRandomString({ length: 10 })
    const { uploadId } = await createMultipart({
      projectId: params.projectId,
      blobId: fileId,
      userId: params.userId,
      fileName: params.fileName
    })

    return { fileId, uploadId }
  }

export const getModelSyncPartUploadUrlFactory =
  () =>
  async (params: {
    projectId: string
    fileId: string
    uploadId: string
    partNumber: number
    req: Request
  }) => {
    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId: params.projectId }),
      getProjectObjectStorage({ projectId: params.projectId })
    ])

    const getPartUrl = getBlobMultipartPartUploadUrlFactory({
      getBlob: getBlobFactory({ db: projectDb }),
      getMultipartUploadPartSignedUrl: getMultipartUploadPartSignedUrlFactory({
        objectStorage: getDynamicPublicObjectStorage({
          objectStorage: projectStorage.public,
          frontendOrigin: resolveFrontendOriginFromRequest(params.req)
        })
      })
    })

    return await getPartUrl({
      projectId: params.projectId,
      blobId: params.fileId,
      uploadId: params.uploadId,
      partNumber: params.partNumber,
      urlExpiryDurationSeconds: getFileUploadUrlExpiryMinutes() * TIME.minute
    })
  }

export const listModelSyncUploadedPartsFactory =
  () =>
  async (params: {
    projectId: string
    fileId: string
    uploadId: string
  }) => {
    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId: params.projectId }),
      getProjectObjectStorage({ projectId: params.projectId })
    ])

    const listParts = listBlobMultipartUploadPartsFactory({
      getBlob: getBlobFactory({ db: projectDb }),
      listMultipartUploadParts: listMultipartUploadPartsFactory({
        objectStorage: projectStorage.private
      })
    })

    return await listParts({
      projectId: params.projectId,
      blobId: params.fileId,
      uploadId: params.uploadId
    })
  }

export const abortModelSyncMultipartUploadFactory =
  () =>
  async (params: {
    projectId: string
    fileId: string
    uploadId: string
  }) => {
    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId: params.projectId }),
      getProjectObjectStorage({ projectId: params.projectId })
    ])

    const abortMultipart = abortBlobMultipartUploadFactory({
      getBlob: getBlobFactory({ db: projectDb }),
      abortMultipartUpload: abortMultipartUploadFactory({
        objectStorage: projectStorage.private
      }),
      updateBlob: updateBlobFactory({ db: projectDb })
    })

    await abortMultipart({
      projectId: params.projectId,
      blobId: params.fileId,
      uploadId: params.uploadId
    })
  }

export const completeModelSyncMultipartUploadFactory =
  () =>
  async (params: {
    projectId: string
    modelId: string
    userId: string
    fileId: string
    uploadId: string
    parts: MultipartUploadPart[]
  }) => {
    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId: params.projectId }),
      getProjectObjectStorage({ projectId: params.projectId })
    ])

    const model = (
      await getBranchesByIdsFactory({ db: projectDb })([params.modelId], {
        streamId: params.projectId
      })
    )[0]
    if (!model) {
      throw new BadRequestError('Model not found')
    }

    const pushJobToFileImporter = pushJobToFileImporterFactory({
      getServerOrigin: fileImportServiceShouldUsePrivateObjectsServerUrl()
        ? getPrivateObjectsServerOrigin
        : getServerOrigin,
      createAppToken: createAppTokenFactory({
        storeApiToken: storeApiTokenFactory({ db }),
        storeTokenScopes: storeTokenScopesFactory({ db }),
        storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory({
          db
        }),
        storeUserServerAppToken: storeUserServerAppTokenFactory({ db })
      })
    })

    const insertNewUploadAndNotifyV2 = insertNewUploadAndNotifyFactoryV2({
      queues: fileImportQueues,
      allowUnscheduledFileTypes: ['rvt'],
      pushJobToFileImporter,
      saveUploadFile: saveUploadFileFactoryV2({ db: projectDb }),
      emit: getEventBus().emit
    })

    const insertNewUploadAndNotify = insertNewUploadAndNotifyFactory({
      saveUploadFile: saveUploadFileFactory({ db: projectDb }),
      emit: getEventBus().emit
    })

    const registerMultipartUploadCompleteAndStartFileImport =
      registerMultipartUploadCompleteAndStartFileImportFactory({
        completeMultipartUpload: completeBlobMultipartUploadFactory({
          logger,
          getBlob: getBlobFactory({ db: projectDb }),
          updateBlob: updateBlobFactory({ db: projectDb }),
          completeMultipartUpload: completeMultipartUploadFactory({
            objectStorage: projectStorage.private
          }),
          getBlobMetadataFromStorage: getBlobMetadataFromStorage({
            objectStorage: projectStorage.private
          })
        }),
        insertNewUploadAndNotify: FF_NEXT_GEN_FILE_IMPORTER_ENABLED
          ? insertNewUploadAndNotifyV2
          : insertNewUploadAndNotify,
        getFileInfo: getFileInfoFactoryV2({ db: projectDb }),
        getModelsByIds: getBranchesByIdsFactory({ db: projectDb })
      })

    const emitFileStatusChange = notifyChangeInFileStatus({
      eventEmit: getEventBus().emit
    })
    const updateFileUpload = updateFileUploadFactory({ db: projectDb })
    const dispatchRvtFileImport = dispatchRvtFileImportFactory({ db: projectDb })

    const upload = await registerMultipartUploadCompleteAndStartFileImport({
      projectId: params.projectId,
      fileId: params.fileId,
      modelId: params.modelId,
      userId: params.userId,
      uploadId: params.uploadId,
      parts: params.parts,
      maximumFileSize: getFileSizeLimit()
    })

    if (upload.fileType.toLocaleLowerCase() === 'rvt') {
      try {
        await dispatchRvtFileImport({
          projectId: params.projectId,
          modelId: model.id,
          modelName: model.name,
          fileUpload: upload,
          userId: params.userId
        })
      } catch (error) {
        const failedFile = await updateFileUpload({
          id: upload.id,
          upload: {
            convertedStatus: FileUploadConvertedStatus.Error,
            convertedMessage:
              error instanceof Error ? error.message : 'Failed to dispatch RVT file import.',
            convertedLastUpdate: new Date()
          }
        })

        await emitFileStatusChange({
          file: failedFile
        })
      }
    }

    return upload
  }
