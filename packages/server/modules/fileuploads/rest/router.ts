import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  insertNewUploadAndNotifyFactory,
  insertNewUploadAndNotifyFactoryV2
} from '@/modules/fileuploads/services/management'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  saveUploadFileFactory,
  saveUploadFileFactoryV2
} from '@/modules/fileuploads/repositories/fileUploads'
import { db } from '@/db/knex'
import { streamWritePermissionsPipelineFactory } from '@/modules/shared/authz'
import { getStreamBranchByNameFactory } from '@/modules/core/repositories/branches'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { createBusboy } from '@/modules/blobstorage/rest/busboy'
import { processNewFileStreamFactory } from '@/modules/blobstorage/services/streams'
import { UnauthorizedError } from '@/modules/shared/errors'
import type { Nullable } from '@speckle/shared'
import { ensureError } from '@speckle/shared'
import { UploadRequestErrorMessage } from '@/modules/fileuploads/helpers/rest'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { getFeatureFlags } from '@speckle/shared/environment'
import { BranchNotFoundError } from '@/modules/core/errors/branch'
import { fileImportQueues } from '@/modules/fileuploads/queues/fileimports'
import { pushJobToFileImporterFactory } from '@/modules/fileuploads/services/createFileImport'
import {
  fileImportServiceShouldUsePrivateObjectsServerUrl,
  getPrivateObjectsServerOrigin,
  getServerOrigin
} from '@/modules/shared/helpers/envHelper'
import { createAppTokenFactory } from '@/modules/core/services/tokens'
import {
  storeApiTokenFactory,
  storeTokenResourceAccessDefinitionsFactory,
  storeTokenScopesFactory,
  storeUserServerAppTokenFactory
} from '@/modules/core/repositories/tokens'

const { FF_NEXT_GEN_FILE_IMPORTER_ENABLED } = getFeatureFlags()

export const fileuploadRouterFactory = (): Router => {
  const processNewFileStream = processNewFileStreamFactory()

  const app = Router()

  const handleUploadRequest = async (req: Request, res: Response) => {
    const fileType =
      req.params.fileType ||
      (typeof req.query.fileType === 'string' ? req.query.fileType : '')
    const branchName =
      req.params.modelName ||
      req.params.branchName ||
      (typeof req.query.modelName === 'string' ? req.query.modelName : '') ||
      'main'
    const projectId = req.params.projectId || req.params.streamId
    const userId = req.context.userId

    if (!userId) {
      throw new UnauthorizedError('User not authenticated.')
    }
    const logger = req.log.child({
      projectId,
      streamId: projectId, //legacy
      userId,
      branchName
    })

    const projectDb = await getProjectDbClient({ projectId })
    const getStreamBranchByName = getStreamBranchByNameFactory({ db: projectDb })
    const branch = await getStreamBranchByName(projectId, branchName)
    if (!branch) {
      throw new BranchNotFoundError('Branch {branchName} was not found', {
        info: { branchName }
      })
    }

    const insertNewUploadAndNotify = insertNewUploadAndNotifyFactory({
      saveUploadFile: saveUploadFileFactory({ db: projectDb }),
      emit: getEventBus().emit
    })

    const pushJobToFileImporter = pushJobToFileImporterFactory({
      getServerOrigin: fileImportServiceShouldUsePrivateObjectsServerUrl()
        ? getPrivateObjectsServerOrigin
        : getServerOrigin,
      createAppToken: createAppTokenFactory({
        storeApiToken: storeApiTokenFactory({ db }),
        storeTokenScopes: storeTokenScopesFactory({ db }),
        storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory(
          {
            db
          }
        ),
        storeUserServerAppToken: storeUserServerAppTokenFactory({ db })
      })
    })

    const insertNewUploadAndNotifyV2 = insertNewUploadAndNotifyFactoryV2({
      queues: fileImportQueues,
      pushJobToFileImporter,
      saveUploadFile: saveUploadFileFactoryV2({ db: projectDb }),
      emit: getEventBus().emit
    })

    const saveFileUploads = async ({
      uploadResults
    }: {
      uploadResults: Array<{
        blobId: string
        fileName: string
        fileSize: Nullable<number>
      }>
    }) => {
      await Promise.all(
        uploadResults.map(async (upload) => {
          await (FF_NEXT_GEN_FILE_IMPORTER_ENABLED
            ? insertNewUploadAndNotifyV2
            : insertNewUploadAndNotify)({
            fileId: upload.blobId,
            streamId: projectId, //legacy
            projectId,
            branchName: branch.name || branchName, //legacy
            userId,
            fileName: upload.fileName,
            fileType: fileType || upload.fileName?.split('.').pop() || '', //FIXME
            fileSize: upload.fileSize,
            modelName: branch.name || branchName,
            modelId: branch.id
          })
        })
      )
    }

    const busboy = createBusboy(req)
    const newFileStreamProcessor = await processNewFileStream({
      busboy,
      streamId: projectId,
      userId,
      logger,
      onFinishAllFileUploads: async (uploadResults) => {
        try {
          await saveFileUploads({
            uploadResults
          })
        } catch (err) {
          logger.error(ensureError(err), 'File importer handling error @deprecated')
          res.status(500)
        }

        res.setHeader(
          'Warning',
          'Deprecated API; use POST /graphql (mutation.fileUploadMutations.generateUploadUrl), then PUT (to the provided url), then POST /graphql (mutation.fileUploadMutations.startFileImport)'
        )

        res.status(201).send({ uploadResults })
      },
      onError: () => {
        res.contentType('application/json')
        res.status(400).end(UploadRequestErrorMessage)
      }
    })

    req.pipe(newFileStreamProcessor)
  }

  /**
   * @deprecated use POST /graphql (mutation.fileUploadMutations.generateUploadUrl), then PUT (to the provided url), then POST /graphql (mutation.fileUploadMutations.startFileImport)
   */
  app.post(
    '/api/file/:fileType/:streamId/:branchName?',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    async (req, res) => await handleUploadRequest(req, res)
  )

  app.post(
    '/api/v1/projects/:projectId/models/upload/:fileType/:modelName?',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    async (req, res) => await handleUploadRequest(req, res)
  )

  return app
}
