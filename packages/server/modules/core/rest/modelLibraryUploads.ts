import type { NextFunction, Request, Response, Router } from 'express'
import cors from 'cors'
import cryptoRandomString from 'crypto-random-string'
import { TIME, ensureError, Roles } from '@speckle/shared'
import { db } from '@/db/knex'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { throwForNotHavingServerRole } from '@/modules/shared/authz'
import {
  MODEL_LIBRARY_PROJECT_ID,
  MODEL_LIBRARY_PROJECT_NAME
} from '@/modules/core/constants/modelLibrary'
import {
  ensureModelLibraryModelFactory,
  ensureModelLibraryProjectFactory
} from '@/modules/core/services/streams/modelLibrary'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { upsertBlobFactory } from '@/modules/blobstorage/repositories'
import {
  getDynamicPublicObjectStorage,
  getSignedUrlFactory
} from '@/modules/blobstorage/clients/objectStorage'
import { generatePresignedUrlFactory } from '@/modules/blobstorage/services/presigned'
import {
  getFileUploadUrlExpiryMinutes,
  isFileUploadsEnabled,
  fileImportServiceShouldUsePrivateObjectsServerUrl,
  getPrivateObjectsServerOrigin,
  getServerOrigin
} from '@/modules/shared/helpers/envHelper'
import { getEventBus } from '@/modules/shared/services/eventBus'
import {
  getBlobFactory,
  updateBlobFactory
} from '@/modules/blobstorage/repositories'
import { getBlobMetadataFromStorage } from '@/modules/blobstorage/clients/objectStorage'
import { registerCompletedUploadFactory } from '@/modules/blobstorage/services/presigned'
import {
  insertNewUploadAndNotifyFactory,
  insertNewUploadAndNotifyFactoryV2
} from '@/modules/fileuploads/services/management'
import { fileImportQueues } from '@/modules/fileuploads/queues/fileimports'
import { pushJobToFileImporterFactory } from '@/modules/fileuploads/services/createFileImport'
import { createAppTokenFactory } from '@/modules/core/services/tokens'
import {
  storeApiTokenFactory,
  storeTokenResourceAccessDefinitionsFactory,
  storeTokenScopesFactory,
  storeUserServerAppTokenFactory
} from '@/modules/core/repositories/tokens'
import { saveUploadFileFactory, saveUploadFileFactoryV2 } from '@/modules/fileuploads/repositories/fileUploads'
import { registerUploadCompleteAndStartFileImportFactory } from '@/modules/fileuploads/services/presigned'
import { getBranchesByIdsFactory } from '@/modules/core/repositories/branches'
import { getFileInfoFactoryV2 } from '@/modules/fileuploads/repositories/fileUploads'
import { getFileSizeLimit } from '@/modules/blobstorage/services/management'
import { getFeatureFlags } from '@speckle/shared/environment'
import { BadRequestError, ForbiddenError } from '@/modules/shared/errors'
import { dispatchRvtFileImportFactory } from '@/modules/fileuploads/services/rvt'
import { notifyChangeInFileStatus } from '@/modules/fileuploads/services/management'
import { updateFileUploadFactory } from '@/modules/fileuploads/repositories/fileUploads'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import { resolveFrontendOriginFromRequest } from '@/modules/shared/helpers/frontendOrigin'

const { FF_NEXT_GEN_FILE_IMPORTER_ENABLED } = getFeatureFlags()

const modelLibraryUploadsErrHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!err) return next()
  const error = ensureError(err)
  const status = resolveStatusCode(error)
  res.status(status).json({ error: error.message })
}

const ensureServerUser = async (req: Request) => {
  await throwForNotHavingServerRole(req.context, Roles.Server.User)
  if (!req.context.userId) throw new ForbiddenError('No userId provided')
  if (!isFileUploadsEnabled()) {
    throw new BadRequestError('File uploads are not enabled for this server')
  }
  return req.context.userId
}

export default (app: Router) => {
  const route = '/api/internal/model-library'
  const ensureModelLibraryProject = ensureModelLibraryProjectFactory({ db })

  app.options(`${route}/models/ensure`, cors(), allowCrossOriginResourceAccessMiddelware())
  app.options(`${route}/uploads/prepare`, cors(), allowCrossOriginResourceAccessMiddelware())
  app.options(`${route}/uploads/import`, cors(), allowCrossOriginResourceAccessMiddelware())

  app.post(
    `${route}/models/ensure`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await ensureServerUser(req)
        await ensureModelLibraryProject()

        const { name, description } = req.body || {}
        if (!name || typeof name !== 'string') {
          throw new BadRequestError('Model name is required')
        }

        const projectDb = await getProjectDbClient({ projectId: MODEL_LIBRARY_PROJECT_ID })
        const model = await ensureModelLibraryModelFactory({
          db: projectDb,
          eventEmit: getEventBus().emit
        })({
          name,
          description: typeof description === 'string' ? description : null,
          userId
        })

        res.json({
          data: {
            projectId: MODEL_LIBRARY_PROJECT_ID,
            projectName: MODEL_LIBRARY_PROJECT_NAME,
            model
          }
        })
      } catch (err) {
        next(err)
      }
    }
  )

  app.post(
    `${route}/uploads/prepare`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await ensureServerUser(req)
        await ensureModelLibraryProject()

        const { fileName, modelName, modelDescription } = req.body || {}
        if (!fileName || typeof fileName !== 'string') {
          throw new BadRequestError('File name is required')
        }
        if (!modelName || typeof modelName !== 'string') {
          throw new BadRequestError('Model name is required')
        }

        const [projectDb, projectStorage] = await Promise.all([
          getProjectDbClient({ projectId: MODEL_LIBRARY_PROJECT_ID }),
          getProjectObjectStorage({ projectId: MODEL_LIBRARY_PROJECT_ID })
        ])

        const model = await ensureModelLibraryModelFactory({
          db: projectDb,
          eventEmit: getEventBus().emit
        })({
          name: modelName,
          description: typeof modelDescription === 'string' ? modelDescription : null,
          userId
        })

        const generatePresignedUrl = generatePresignedUrlFactory({
          getSignedUrl: getSignedUrlFactory({
            objectStorage: getDynamicPublicObjectStorage({
              objectStorage: projectStorage.public,
              frontendOrigin: resolveFrontendOriginFromRequest(req)
            })
          }),
          upsertBlob: upsertBlobFactory({
            db: projectDb
          })
        })
        const fileId = cryptoRandomString({ length: 10 })
        const uploadUrl = await generatePresignedUrl({
          projectId: MODEL_LIBRARY_PROJECT_ID,
          blobId: fileId,
          userId,
          fileName,
          urlExpiryDurationSeconds: getFileUploadUrlExpiryMinutes() * TIME.minute
        })

        res.json({
          data: {
            projectId: MODEL_LIBRARY_PROJECT_ID,
            projectName: MODEL_LIBRARY_PROJECT_NAME,
            modelId: model.id,
            modelName: model.name,
            fileId,
            uploadUrl
          }
        })
      } catch (err) {
        next(err)
      }
    }
  )

  app.post(
    `${route}/uploads/import`,
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await ensureServerUser(req)
        await ensureModelLibraryProject()

        const { etag, fileId, modelId, modelName, modelDescription } = req.body || {}
        if (!etag || typeof etag !== 'string') {
          throw new BadRequestError('ETag is required')
        }
        if (!fileId || typeof fileId !== 'string') {
          throw new BadRequestError('File ID is required')
        }
        if (!modelId && (!modelName || typeof modelName !== 'string')) {
          throw new BadRequestError('Model ID or model name is required')
        }

        const [projectDb, projectStorage] = await Promise.all([
          getProjectDbClient({ projectId: MODEL_LIBRARY_PROJECT_ID }),
          getProjectObjectStorage({ projectId: MODEL_LIBRARY_PROJECT_ID })
        ])

        const ensureModelLibraryModel = ensureModelLibraryModelFactory({
          db: projectDb,
          eventEmit: getEventBus().emit
        })
        const resolvedModel = modelId
          ? (await getBranchesByIdsFactory({ db: projectDb })([modelId], {
              streamId: MODEL_LIBRARY_PROJECT_ID
            }))[0]
          : await ensureModelLibraryModel({
              name: modelName,
              description: typeof modelDescription === 'string' ? modelDescription : null,
              userId
            })

        if (!resolvedModel) {
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
              logger: req.log,
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

        const emitFileStatusChange = notifyChangeInFileStatus({
          eventEmit: getEventBus().emit
        })
        const updateFileUpload = updateFileUploadFactory({ db: projectDb })
        const dispatchRvtFileImport = dispatchRvtFileImportFactory({ db: projectDb })

        const upload = await registerUploadCompleteAndStartFileImport({
          projectId: MODEL_LIBRARY_PROJECT_ID,
          fileId,
          modelId: resolvedModel.id,
          userId,
          expectedETag: etag,
          maximumFileSize: getFileSizeLimit()
        })

        if (upload.fileType.toLocaleLowerCase() === 'rvt') {
          try {
            await dispatchRvtFileImport({
              projectId: MODEL_LIBRARY_PROJECT_ID,
              modelId: resolvedModel.id,
              modelName: resolvedModel.name,
              fileUpload: upload,
              userId
            })
          } catch (error) {
            req.log.error(
              { err: error, projectId: MODEL_LIBRARY_PROJECT_ID, fileId: upload.id },
              'Failed to dispatch RVT file import for model library upload'
            )

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

        res.json({
          data: {
            ...upload,
            projectId: MODEL_LIBRARY_PROJECT_ID,
            projectName: MODEL_LIBRARY_PROJECT_NAME,
            modelId: resolvedModel.id,
            modelName: resolvedModel.name
          }
        })
      } catch (err) {
        next(err)
      }
    }
  )

  app.use(route, modelLibraryUploadsErrHandler)
}
