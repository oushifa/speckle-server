import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import {
  insertNewUploadAndNotifyFactory,
  insertNewUploadAndNotifyFactoryV2,
  notifyChangeInFileStatus
} from '@/modules/fileuploads/services/management'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  saveUploadFileFactory,
  saveUploadFileFactoryV2,
  getFileInfoFactoryV2,
  updateFileUploadFactory
} from '@/modules/fileuploads/repositories/fileUploads'
import { getCommitFactory } from '@/modules/core/repositories/commits'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import type { FileUploadRecord } from '@/modules/fileuploads/helpers/types'
import { db } from '@/db/knex'
import { streamWritePermissionsPipelineFactory } from '@/modules/shared/authz'
import { getStreamBranchByNameFactory } from '@/modules/core/repositories/branches'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { createBusboy } from '@/modules/blobstorage/rest/busboy'
import { processNewFileStreamFactory } from '@/modules/blobstorage/services/streams'
import { getBlobFactory } from '@/modules/blobstorage/repositories'
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

  const bindFileRouteParamsSchema = z.object({
    projectId: z.string().trim().min(1),
    versionId: z.string().trim().min(1)
  })

  const bindFileBodySchema = z.object({
    fileId: z.string().trim().min(1),
    fileName: z.string().trim().optional(),
    fileSize: z.number().int().nonnegative().optional(),
    fileType: z.string().trim().optional()
  })

  app.post(
    '/api/v1/projects/:projectId/versions/:versionId/bind-file',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream: getStreamFactory({ db })
      })
    ),
    validateRequest({
      params: bindFileRouteParamsSchema,
      body: bindFileBodySchema
    }),
    async (req, res) => {
      const { projectId, versionId } = req.params
      const { fileId, fileName, fileSize, fileType } = req.body

      const projectDb = await getProjectDbClient({ projectId })

      // Check if commit/version exists and belongs to project
      const getCommit = getCommitFactory({ db: projectDb })
      const commit = await getCommit(versionId, { streamId: projectId })
      if (!commit) {
        return res.status(404).json({ error: 'Version not found in project.' })
      }

      // Check if file upload exists and belongs to project
      const getFileInfo = getFileInfoFactoryV2({ db: projectDb })
      let fileUpload = await getFileInfo({ fileId, projectId })
      if (!fileUpload) {
        // Fallback: Check if blob exists in blob_storage
        const getBlob = getBlobFactory({ db: projectDb })
        const storedBlob = await getBlob({ streamId: projectId, blobId: fileId })
        if (!storedBlob) {
          return res.status(404).json({ error: 'File upload not found in project.' })
        }

        // Insert new file_uploads record using metadata
        const saveUploadFile = saveUploadFileFactoryV2({ db: projectDb })
        fileUpload = await saveUploadFile({
          fileId: storedBlob.id,
          projectId: storedBlob.streamId,
          modelId: commit.branchId,
          userId: storedBlob.userId || req.context.userId || '',
          fileName: fileName || storedBlob.fileName || 'unknown',
          fileType: fileType || storedBlob.fileType || fileName?.split('.').pop() || 'unknown',
          fileSize: fileSize || storedBlob.fileSize || 0,
          modelName: ''
        })

        // Ensure blob upload status is marked as Completed
        await projectDb('blob_storage')
          .where({ id: fileId, streamId: projectId })
          .update({
            uploadStatus: 2, // Completed
            fileSize: fileSize || storedBlob.fileSize || 0
          })
      }

      // Update the file upload record
      const updateFileUpload = updateFileUploadFactory({ db: projectDb })
      const updatedFile = (await updateFileUpload({
        id: fileId,
        upload: {
          convertedStatus: FileUploadConvertedStatus.Completed,
          convertedCommitId: versionId,
          convertedMessage: null,
          convertedLastUpdate: new Date(),
          modelId: commit.branchId
        }
      })) as FileUploadRecord

      // Emit event notification
      const emitFileStatusChange = notifyChangeInFileStatus({
        eventEmit: getEventBus().emit
      })
      await emitFileStatusChange({
        file: updatedFile
      })

      return res.status(200).json({ upload: updatedFile })
    }
  )

  return app
}
