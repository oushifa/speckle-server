import { Roles, TIME } from '@speckle/shared'
import type { Resolvers } from '@/modules/core/graph/generated/graphql'
import { db } from '@/db/knex'
import {
  getBranchPendingVersionsFactory,
  getFileInfoFactory,
  getFileInfoFactoryV2,
  getModelUploadsItemsFactory,
  getModelUploadsTotalCountFactory,
  getStreamFileUploadsFactory,
  getStreamPendingModelsFactory,
  saveUploadFileFactory,
  saveUploadFileFactoryV2,
  updateFileUploadFactory
} from '@/modules/fileuploads/repositories/fileUploads'
import {
  FileImportSubscriptions,
  filteredSubscribe
} from '@/modules/shared/utils/subscriptions'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  BadRequestError,
  ForbiddenError,
  MisconfiguredEnvironmentError
} from '@/modules/shared/errors'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import { throwForNotHavingServerRole } from '@/modules/shared/authz'
import {
  fileImportServiceShouldUsePrivateObjectsServerUrl,
  getFileImporterQueuePostgresUrl,
  getFileUploadUrlExpiryMinutes,
  getPrivateObjectsServerOrigin,
  getServerOrigin,
  isFileUploadsEnabled
} from '@/modules/shared/helpers/envHelper'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import {
  getBlobFactory,
  updateBlobFactory,
  upsertBlobFactory
} from '@/modules/blobstorage/repositories'
import {
  getDynamicPublicObjectStorage,
  getBlobMetadataFromStorage,
  getSignedUrlFactory,
  abortMultipartUploadFactory,
  completeMultipartUploadFactory,
  createMultipartUploadFactory,
  getMultipartUploadPartSignedUrlFactory,
  listMultipartUploadPartsFactory
} from '@/modules/blobstorage/clients/objectStorage'
import {
  abortBlobMultipartUploadFactory,
  completeBlobMultipartUploadFactory,
  createBlobMultipartUploadFactory,
  getBlobMultipartPartUploadUrlFactory,
  listBlobMultipartUploadPartsFactory
} from '@/modules/blobstorage/services/multipartUpload'
import { registerUploadCompleteAndStartFileImportFactory } from '@/modules/fileuploads/services/presigned'
import { registerMultipartUploadCompleteAndStartFileImportFactory } from '@/modules/fileuploads/services/multipart'
import {
  generatePresignedUrlFactory,
  registerCompletedUploadFactory
} from '@/modules/blobstorage/services/presigned'
import { getEventBus } from '@/modules/shared/services/eventBus'
import {
  insertNewUploadAndNotifyFactory,
  insertNewUploadAndNotifyFactoryV2,
  notifyChangeInFileStatus
} from '@/modules/fileuploads/services/management'
import {
  storeApiTokenFactory,
  storeTokenResourceAccessDefinitionsFactory,
  storeTokenScopesFactory,
  storeUserServerAppTokenFactory
} from '@/modules/core/repositories/tokens'
import { createAppTokenFactory } from '@/modules/core/services/tokens'
import { fileImportQueues } from '@/modules/fileuploads/queues/fileimports'
import { pushJobToFileImporterFactory } from '@/modules/fileuploads/services/createFileImport'
import { getBranchesByIdsFactory } from '@/modules/core/repositories/branches'
import { getFileSizeLimit } from '@/modules/blobstorage/services/management'
import cryptoRandomString from 'crypto-random-string'
import { getFeatureFlags } from '@speckle/shared/environment'
import { throwIfResourceAccessNotAllowed } from '@/modules/core/helpers/token'
import { TokenResourceIdentifierType } from '@/modules/core/domain/tokens/types'
import { getModelUploadsFactory } from '@/modules/fileuploads/services/management'
import type {
  FileUploadRecord,
  FileUploadRecordV2
} from '@/modules/fileuploads/helpers/types'
import { onFileImportResultFactory } from '@/modules/fileuploads/services/resultHandler'
import { onFileImportProgressFactory } from '@/modules/fileuploads/services/progressHandler'
import type { FileImportResultPayload } from '@speckle/shared/workers/fileimport'
import { JobResultStatus } from '@speckle/shared/workers/fileimport'
import type { GraphQLContext } from '@/modules/shared/helpers/typeHelper'
import { updateBackgroundJobFactory } from '@/modules/backgroundjobs/repositories/backgroundjobs'
import { configureClient } from '@/knexfile'
import { dispatchRvtFileImportFactory } from '@/modules/fileuploads/services/rvt'
import {
  EXTERNAL_CONVERTIBLE_FILE_TYPES,
  FileUploadConvertedStatus,
  isExternalConvertibleFileType
} from '@/modules/fileuploads/helpers/types'

const { FF_NEXT_GEN_FILE_IMPORTER_ENABLED } = getFeatureFlags()

const getFileUploadModel = async (params: {
  upload: FileUploadRecord | FileUploadRecordV2
  ctx: GraphQLContext
}) => {
  const { upload, ctx } = params
  const projectId = 'streamId' in upload ? upload.streamId : upload.projectId

  const projectDb = await getProjectDbClient({ projectId })
  if ('modelId' in upload && upload.modelId) {
    return await ctx.loaders
      .forRegion({ db: projectDb })
      .branches.getById.load(upload.modelId)
  }

  if ('branchName' in upload && upload.branchName) {
    return await ctx.loaders
      .forRegion({ db: projectDb })
      .streams.getStreamBranchByName.forStream(projectId)
      .load(upload.branchName.toLowerCase())
  }

  return null
}

const handleRvtFileImportDispatch = async (params: {
  ctx: GraphQLContext
  projectId: string
  userId: string
  upload: FileUploadRecordV2 & { modelName: string }
  dispatchRvtFileImport: ReturnType<typeof dispatchRvtFileImportFactory>
  updateFileUpload: ReturnType<typeof updateFileUploadFactory>
  emitFileStatusChange: ReturnType<typeof notifyChangeInFileStatus>
}) => {
  const {
    ctx,
    projectId,
    userId,
    upload,
    dispatchRvtFileImport,
    updateFileUpload,
    emitFileStatusChange
  } = params

  if (!isExternalConvertibleFileType(upload.fileType)) return

  ctx.log.info(
    {
      projectId,
      fileUploadId: upload.id,
      fileName: upload.fileName,
      fileType: upload.fileType,
      modelId: upload.modelId,
      modelName: upload.modelName,
      userId
    },
    'External convert GraphQL identified convertible upload'
  )

  try {
    if (!upload.modelId || !upload.modelName) {
      throw new BadRequestError(
        `${upload.fileType.toUpperCase()} file import requires a target model.`
      )
    }

    ctx.log.info(
      {
        projectId,
        fileUploadId: upload.id,
        fileName: upload.fileName,
        fileType: upload.fileType,
        modelId: upload.modelId,
        modelName: upload.modelName,
        userId
      },
      'External convert GraphQL dispatching job'
    )

    await dispatchRvtFileImport({
      projectId,
      modelId: upload.modelId,
      modelName: upload.modelName,
      fileUpload: upload,
      userId
    })

    ctx.log.info(
      {
        projectId,
        fileUploadId: upload.id,
        fileName: upload.fileName,
        fileType: upload.fileType,
        modelId: upload.modelId,
        modelName: upload.modelName,
        userId
      },
      'External convert GraphQL dispatched job successfully'
    )
  } catch (error) {
    ctx.log.error(
      {
        err: error,
        projectId,
        fileUploadId: upload.id,
        fileName: upload.fileName,
        fileType: upload.fileType,
        modelId: upload.modelId,
        modelName: upload.modelName,
        userId
      },
      'External convert GraphQL failed to dispatch job'
    )

    const failedFile = await updateFileUpload({
      id: upload.id,
      upload: {
        convertedStatus: FileUploadConvertedStatus.Error,
        convertedMessage:
          error instanceof Error
            ? error.message
            : `Failed to dispatch ${upload.fileType.toUpperCase()} file import.`,
        convertedLastUpdate: new Date()
      }
    })

    await emitFileStatusChange({
      file: failedFile
    })

    ctx.log.warn(
      {
        projectId,
        fileUploadId: failedFile.id,
        fileName: failedFile.fileName,
        convertedStatus: failedFile.convertedStatus,
        convertedMessage: failedFile.convertedMessage
      },
      'RVT CONVERT GraphQL marked upload as error after dispatch failure'
    )
  }
}

const fileImporterConnectionUri = getFileImporterQueuePostgresUrl()
const queueDb = fileImporterConnectionUri
  ? configureClient({ postgres: { connectionUri: fileImporterConnectionUri } }).public
  : db

const fileUploadMutations: Resolvers['FileUploadMutations'] = {
  async generateUploadUrl(_parent, args, ctx) {
    const { projectId } = args.input
    if (!ctx.userId) {
      throw new ForbiddenError('No userId provided')
    }

    await throwForNotHavingServerRole(ctx, Roles.Server.User)

    throwIfResourceAccessNotAllowed({
      resourceId: projectId,
      resourceType: TokenResourceIdentifierType.Project,
      resourceAccessRules: ctx.resourceAccessRules
    })

    if (!isFileUploadsEnabled())
      throw new BadRequestError('File uploads are not enabled for this server')

    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId }),
      getProjectObjectStorage({ projectId })
    ])

    const generatePresignedUrl = generatePresignedUrlFactory({
      getSignedUrl: getSignedUrlFactory({
        objectStorage: getDynamicPublicObjectStorage({
          objectStorage: projectStorage.public,
          frontendOrigin: ctx.frontendOrigin
        })
      }),
      upsertBlob: upsertBlobFactory({
        db: projectDb
      })
    })
    const blobId = cryptoRandomString({ length: 10 })

    const url = await generatePresignedUrl({
      projectId: args.input.projectId,
      blobId,
      userId: ctx.userId,
      fileName: args.input.fileName,
      urlExpiryDurationSeconds: getFileUploadUrlExpiryMinutes() * TIME.minute
    })

    return { url, fileId: blobId }
  },
  async startFileImport(_parent, args, ctx) {
    const { projectId } = args.input
    if (!ctx.userId) {
      throw new ForbiddenError('No userId provided')
    }

    await throwForNotHavingServerRole(ctx, Roles.Server.User)

    throwIfResourceAccessNotAllowed({
      resourceId: projectId,
      resourceType: TokenResourceIdentifierType.Project,
      resourceAccessRules: ctx.resourceAccessRules
    })

    if (!isFileUploadsEnabled())
      throw new BadRequestError('File uploads are not enabled for this server')

    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId }),
      getProjectObjectStorage({ projectId })
    ])

    const pushJobToFileImporter = pushJobToFileImporterFactory({
      getServerOrigin: fileImportServiceShouldUsePrivateObjectsServerUrl()
        ? getPrivateObjectsServerOrigin
        : getServerOrigin,
      createAppToken: createAppTokenFactory({
        storeApiToken: storeApiTokenFactory({ db }),
        storeTokenScopes: storeTokenScopesFactory({ db }),
        storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory(
          { db }
        ),
        storeUserServerAppToken: storeUserServerAppTokenFactory({ db })
      })
    })

    const insertNewUploadAndNotifyV2 = insertNewUploadAndNotifyFactoryV2({
      queues: fileImportQueues,
      allowUnscheduledFileTypes: [...EXTERNAL_CONVERTIBLE_FILE_TYPES],
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
          logger: ctx.log,
          getBlob: getBlobFactory({ db: projectDb }),
          updateBlob: updateBlobFactory({
            db: projectDb
          }),
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

    const maximumFileSize = getFileSizeLimit()
    const emitFileStatusChange = notifyChangeInFileStatus({
      eventEmit: getEventBus().emit
    })
    const updateFileUpload = updateFileUploadFactory({ db: projectDb })
    const dispatchRvtFileImport = dispatchRvtFileImportFactory({ db: projectDb })

    const uploadedFileData = await registerUploadCompleteAndStartFileImport({
      projectId: args.input.projectId,
      fileId: args.input.fileId,
      modelId: args.input.modelId,
      userId: ctx.userId,
      expectedETag: args.input.etag,
      maximumFileSize
    })

    await handleRvtFileImportDispatch({
      ctx,
      projectId,
      userId: ctx.userId,
      upload: uploadedFileData,
      dispatchRvtFileImport,
      updateFileUpload,
      emitFileStatusChange
    })

    return {
      ...uploadedFileData,
      streamId: uploadedFileData.projectId,
      branchName: uploadedFileData.modelName
    }
  },

  async createMultipartUpload(_parent, args, ctx) {
    const { projectId } = args.input
    if (!ctx.userId) {
      throw new ForbiddenError('No userId provided')
    }

    await throwForNotHavingServerRole(ctx, Roles.Server.User)

    throwIfResourceAccessNotAllowed({
      resourceId: projectId,
      resourceType: TokenResourceIdentifierType.Project,
      resourceAccessRules: ctx.resourceAccessRules
    })

    if (!isFileUploadsEnabled())
      throw new BadRequestError('File uploads are not enabled for this server')

    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId }),
      getProjectObjectStorage({ projectId })
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

    const blobId = cryptoRandomString({ length: 10 })
    const { uploadId } = await createMultipart({
      projectId: args.input.projectId,
      userId: ctx.userId,
      blobId,
      fileName: args.input.fileName
    })

    return { fileId: blobId, uploadId }
  },

  async getPartUploadUrl(_parent, args, ctx) {
    const { projectId, fileId, uploadId, partNumber } = args.input
    if (!ctx.userId) {
      throw new ForbiddenError('No userId provided')
    }

    await throwForNotHavingServerRole(ctx, Roles.Server.User)

    throwIfResourceAccessNotAllowed({
      resourceId: projectId,
      resourceType: TokenResourceIdentifierType.Project,
      resourceAccessRules: ctx.resourceAccessRules
    })

    if (!isFileUploadsEnabled())
      throw new BadRequestError('File uploads are not enabled for this server')

    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId }),
      getProjectObjectStorage({ projectId })
    ])

    const getPartUrl = getBlobMultipartPartUploadUrlFactory({
      getBlob: getBlobFactory({ db: projectDb }),
      getMultipartUploadPartSignedUrl: getMultipartUploadPartSignedUrlFactory({
        objectStorage: getDynamicPublicObjectStorage({
          objectStorage: projectStorage.public,
          frontendOrigin: ctx.frontendOrigin
        })
      })
    })

    const url = await getPartUrl({
      projectId,
      blobId: fileId,
      uploadId,
      partNumber,
      urlExpiryDurationSeconds: getFileUploadUrlExpiryMinutes() * TIME.minute
    })

    return { url, partNumber }
  },

  async completeMultipartUpload(_parent, args, ctx) {
    const { projectId } = args.input
    if (!ctx.userId) {
      throw new ForbiddenError('No userId provided')
    }

    await throwForNotHavingServerRole(ctx, Roles.Server.User)

    throwIfResourceAccessNotAllowed({
      resourceId: projectId,
      resourceType: TokenResourceIdentifierType.Project,
      resourceAccessRules: ctx.resourceAccessRules
    })

    if (!isFileUploadsEnabled())
      throw new BadRequestError('File uploads are not enabled for this server')

    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId }),
      getProjectObjectStorage({ projectId })
    ])

    const pushJobToFileImporter = pushJobToFileImporterFactory({
      getServerOrigin: fileImportServiceShouldUsePrivateObjectsServerUrl()
        ? getPrivateObjectsServerOrigin
        : getServerOrigin,
      createAppToken: createAppTokenFactory({
        storeApiToken: storeApiTokenFactory({ db }),
        storeTokenScopes: storeTokenScopesFactory({ db }),
        storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory(
          { db }
        ),
        storeUserServerAppToken: storeUserServerAppTokenFactory({ db })
      })
    })

    const insertNewUploadAndNotifyV2 = insertNewUploadAndNotifyFactoryV2({
      queues: fileImportQueues,
      allowUnscheduledFileTypes: [...EXTERNAL_CONVERTIBLE_FILE_TYPES],
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
          logger: ctx.log,
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

    const maximumFileSize = getFileSizeLimit()
    const emitFileStatusChange = notifyChangeInFileStatus({
      eventEmit: getEventBus().emit
    })
    const updateFileUpload = updateFileUploadFactory({ db: projectDb })
    const dispatchRvtFileImport = dispatchRvtFileImportFactory({ db: projectDb })

    const uploadedFileData = await registerMultipartUploadCompleteAndStartFileImport({
      projectId: args.input.projectId,
      fileId: args.input.fileId,
      modelId: args.input.modelId,
      userId: ctx.userId,
      uploadId: args.input.uploadId,
      parts: args.input.parts,
      maximumFileSize
    })

    await handleRvtFileImportDispatch({
      ctx,
      projectId,
      userId: ctx.userId,
      upload: uploadedFileData,
      dispatchRvtFileImport,
      updateFileUpload,
      emitFileStatusChange
    })

    return {
      ...uploadedFileData,
      streamId: uploadedFileData.projectId,
      branchName: uploadedFileData.modelName
    }
  },

  async abortMultipartUpload(_parent, args, ctx) {
    const { projectId, fileId, uploadId } = args.input
    if (!ctx.userId) {
      throw new ForbiddenError('No userId provided')
    }

    await throwForNotHavingServerRole(ctx, Roles.Server.User)

    throwIfResourceAccessNotAllowed({
      resourceId: projectId,
      resourceType: TokenResourceIdentifierType.Project,
      resourceAccessRules: ctx.resourceAccessRules
    })

    if (!isFileUploadsEnabled())
      throw new BadRequestError('File uploads are not enabled for this server')

    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId }),
      getProjectObjectStorage({ projectId })
    ])

    const abortMultipart = abortBlobMultipartUploadFactory({
      getBlob: getBlobFactory({ db: projectDb }),
      abortMultipartUpload: abortMultipartUploadFactory({
        objectStorage: projectStorage.private
      }),
      updateBlob: updateBlobFactory({ db: projectDb })
    })

    await abortMultipart({ projectId, blobId: fileId, uploadId })
    return true
  },

  async listUploadedParts(_parent, args, ctx) {
    const { projectId, fileId, uploadId } = args.input
    if (!ctx.userId) {
      throw new ForbiddenError('No userId provided')
    }

    await throwForNotHavingServerRole(ctx, Roles.Server.User)

    throwIfResourceAccessNotAllowed({
      resourceId: projectId,
      resourceType: TokenResourceIdentifierType.Project,
      resourceAccessRules: ctx.resourceAccessRules
    })

    if (!isFileUploadsEnabled())
      throw new BadRequestError('File uploads are not enabled for this server')

    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId }),
      getProjectObjectStorage({ projectId })
    ])

    const listParts = listBlobMultipartUploadPartsFactory({
      getBlob: getBlobFactory({ db: projectDb }),
      listMultipartUploadParts: listMultipartUploadPartsFactory({
        objectStorage: projectStorage.private
      })
    })

    const parts = await listParts({ projectId, blobId: fileId, uploadId })
    return { parts }
  },

  async finishFileImport(_parent, args, ctx) {
    if (!FF_NEXT_GEN_FILE_IMPORTER_ENABLED)
      throw new MisconfiguredEnvironmentError('File import next gen is not enabled')

    // NOTE: jobId in this context is actually the blobId of the uploaded file
    // We keep the naming for backwards compatibility reasons
    const { projectId, jobId, status, warnings, reason, result } = args.input
    const userId = ctx.userId
    if (!userId) {
      throw new ForbiddenError('No userId provided')
    }

    throwIfResourceAccessNotAllowed({
      resourceId: projectId,
      resourceType: TokenResourceIdentifierType.Project,
      resourceAccessRules: ctx.resourceAccessRules
    })

    await throwForNotHavingServerRole(ctx, Roles.Server.User)

    let jobResult: FileImportResultPayload
    if (status === JobResultStatus.Error) {
      if (!reason) throw new BadRequestError('No error reason provided')

      jobResult = {
        status: JobResultStatus.Error,
        reason,
        result
      }
    } else {
      if (!result.versionId) throw new BadRequestError('VersionId not provided')

      jobResult = {
        status: JobResultStatus.Success,
        warnings: warnings || [],
        result: {
          ...result,
          versionId: result.versionId
        }
      }
    }

    const logger = ctx.log.child({
      projectId,
      streamId: projectId, //legacy
      userId,
      blobId: jobId
    })

    const projectDb = await getProjectDbClient({ projectId })
    const onFileImportResult = onFileImportResultFactory({
      logger: logger.child({ fileUploadStatus: status }),
      updateFileUpload: updateFileUploadFactory({ db: projectDb }),
      getFileInfo: getFileInfoFactoryV2({ db: projectDb }),
      updateBackgroundJob: updateBackgroundJobFactory({
        db: queueDb
      }),
      eventEmit: getEventBus().emit,
      FF_NEXT_GEN_FILE_IMPORTER_ENABLED
    })

    await onFileImportResult({
      blobId: jobId,
      jobResult
    })

    return true
  },

  async updateFileImportProgress(_parent, args, ctx) {
    if (!FF_NEXT_GEN_FILE_IMPORTER_ENABLED)
      throw new MisconfiguredEnvironmentError('File import next gen is not enabled')

    const { projectId, jobId, progressPercent, progressPhase, progressMessage } =
      args.input
    const userId = ctx.userId
    if (!userId) {
      throw new ForbiddenError('No userId provided')
    }

    throwIfResourceAccessNotAllowed({
      resourceId: projectId,
      resourceType: TokenResourceIdentifierType.Project,
      resourceAccessRules: ctx.resourceAccessRules
    })

    await throwForNotHavingServerRole(ctx, Roles.Server.User)

    const projectDb = await getProjectDbClient({ projectId })
    const onFileImportProgress = onFileImportProgressFactory({
      logger: ctx.log.child({
        projectId,
        streamId: projectId,
        userId,
        blobId: jobId
      }),
      updateFileUpload: updateFileUploadFactory({ db: projectDb }),
      getFileInfo: getFileInfoFactoryV2({ db: projectDb }),
      eventEmit: getEventBus().emit
    })

    await onFileImportProgress({
      blobId: jobId,
      progressPercent: progressPercent ?? null,
      progressPhase: progressPhase ?? null,
      progressMessage: progressMessage ?? null
    })

    return true
  }
}

export default {
  Stream: {
    async fileUploads(parent) {
      const projectDb = await getProjectDbClient({ projectId: parent.id })
      return await getStreamFileUploadsFactory({ db: projectDb })({
        streamId: parent.id
      })
    },
    async fileUpload(parent, args) {
      const projectDb = await getProjectDbClient({ projectId: parent.id })
      return await getFileInfoFactory({ db: projectDb })({ fileId: args.id })
    }
  },
  Project: {
    async pendingImportedModels(parent, args) {
      const projectDb = await getProjectDbClient({ projectId: parent.id })
      return await getStreamPendingModelsFactory({ db: projectDb })(parent.id, args)
    }
  },
  Model: {
    async pendingImportedVersions(parent, args) {
      const projectDb = await getProjectDbClient({ projectId: parent.streamId })
      return await getBranchPendingVersionsFactory({ db: projectDb })(
        parent.streamId,
        {
          branchName: parent.name,
          modelId: parent.id,
          limit: args.limit
        }
      )
    },
    async uploads(parent, args) {
      const projectDb = await getProjectDbClient({ projectId: parent.streamId })
      const getModelUploads = getModelUploadsFactory({
        getModelUploadsItems: getModelUploadsItemsFactory({ db: projectDb }),
        getModelUploadsTotalCount: getModelUploadsTotalCountFactory({ db: projectDb })
      })

      return await getModelUploads({
        modelId: parent.id,
        projectId: parent.streamId,
        limit: args.input?.limit ?? 25,
        cursor: args.input?.cursor
      })
    }
  },
  FileUpload: {
    projectId: (parent) => ('streamId' in parent ? parent.streamId : parent.projectId),
    streamId: (parent) => ('streamId' in parent ? parent.streamId : parent.projectId),
    modelName: async (parent, _args, ctx) => {
      if ('branchName' in parent) return parent.branchName
      return (await getFileUploadModel({ upload: parent, ctx }))?.name
    },
    branchName: async (parent, _args, ctx) => {
      if ('branchName' in parent) return parent.branchName
      return (await getFileUploadModel({ upload: parent, ctx }))?.name
    },
    convertedVersionId: (parent) => parent.convertedCommitId,
    async model(parent, _args, ctx) {
      return await getFileUploadModel({ upload: parent, ctx })
    },
    updatedAt: (parent) => {
      return parent.convertedLastUpdate || parent.uploadDate
    }
  },
  Mutation: {
    fileUploadMutations: () => ({})
  },
  FileUploadMutations: {
    ...fileUploadMutations
  },
  Subscription: {
    projectPendingModelsUpdated: {
      subscribe: filteredSubscribe(
        FileImportSubscriptions.ProjectPendingModelsUpdated,
        async (payload, args, ctx) => {
          const { id: projectId } = args
          if (payload.projectId !== projectId) return false

          throwIfResourceAccessNotAllowed({
            resourceId: payload.projectId,
            resourceType: TokenResourceIdentifierType.Project,
            resourceAccessRules: ctx.resourceAccessRules
          })
          const canRead = await ctx.authPolicies.project.canRead({
            userId: ctx.userId!,
            projectId: payload.projectId
          })
          throwIfAuthNotOk(canRead)

          return true
        }
      )
    },
    projectPendingVersionsUpdated: {
      subscribe: filteredSubscribe(
        FileImportSubscriptions.ProjectPendingVersionsUpdated,
        async (payload, args, ctx) => {
          const { id: projectId } = args
          if (payload.projectId !== projectId) return false

          throwIfResourceAccessNotAllowed({
            resourceId: payload.projectId,
            resourceType: TokenResourceIdentifierType.Project,
            resourceAccessRules: ctx.resourceAccessRules
          })
          const canRead = await ctx.authPolicies.project.canRead({
            userId: ctx.userId!,
            projectId: payload.projectId
          })
          throwIfAuthNotOk(canRead)

          return true
        }
      )
    },
    projectFileImportUpdated: {
      subscribe: filteredSubscribe(
        FileImportSubscriptions.ProjectFileImportUpdated,
        async (payload, args, ctx) => {
          const { id: projectId } = args
          if (payload.projectId !== projectId) return false

          throwIfResourceAccessNotAllowed({
            resourceId: payload.projectId,
            resourceType: TokenResourceIdentifierType.Project,
            resourceAccessRules: ctx.resourceAccessRules
          })
          const canRead = await ctx.authPolicies.project.canRead({
            userId: ctx.userId!,
            projectId: payload.projectId
          })
          throwIfAuthNotOk(canRead)

          return true
        }
      )
    }
  }
} as Resolvers
