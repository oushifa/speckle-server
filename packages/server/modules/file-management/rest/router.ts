import { Router, type RequestHandler } from 'express'
import type { Request, Response } from 'express'
import { db } from '@/db/knex'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  streamReadPermissionsPipelineFactory,
  streamWritePermissionsPipelineFactory
} from '@/modules/shared/authz'
import { createBusboy } from '@/modules/blobstorage/rest/busboy'
import { processNewFileStreamFactory } from '@/modules/blobstorage/services/streams'
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError
} from '@/modules/shared/errors'
import { Roles } from '@speckle/shared'
import {
  getProjectFilesWithModelsService,
  upsertFileOrModelMetadataService
} from '@/modules/file-management/services/fileManagement'
import {
  getProjectFileByIdFromDb,
  createProjectFileInDb,
  deleteProjectFileInDb,
  getProjectModelsFromDb
} from '@/modules/file-management/repositories/fileManagement'
import { getBlobMetadataFactory } from '@/modules/blobstorage/repositories'
import { getFileStreamFactory } from '@/modules/blobstorage/services/management'
import { getObjectStreamFactory } from '@/modules/blobstorage/repositories/blobs'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import contentDisposition from 'content-disposition'
import { corsMiddlewareFactory } from '@/modules/core/configs/cors'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import cors from 'cors'

/**
 * 源文件管理（file-management）模块单文件上传大小上限：1GB（字节）
 */
export const FILE_MANAGEMENT_MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024

export const fileManagementRouterFactory = (): Router => {
  const router = Router()
  const processNewFileStream = processNewFileStreamFactory()

  const crossOriginCors = corsMiddlewareFactory({
    corsConfig: {
      origin: true,
      credentials: true
    }
  })

  const withAdminOverride = (middleware: RequestHandler): RequestHandler => {
    return async (req, res, next) => {
      if (req.context?.role === Roles.Server.Admin) return next()
      return middleware(req, res, next)
    }
  }

  // Preflight OPTIONS handler
  router.options('/api/projects/:projectId/files*', crossOriginCors)

  // GET /api/projects/:projectId/files - List files & models
  router.get(
    '/api/projects/:projectId/files',
    crossOriginCors,
    withAdminOverride(async (req, res, next) => {
      await authMiddlewareCreator(
        streamReadPermissionsPipelineFactory({ getStream: getStreamFactory({ db }) })
      )(req, res, next)
    }),
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId
      const search = req.query.search as string | undefined
      const source = req.query.source as string | undefined
      const category = req.query.category as string | undefined

      const files = await getProjectFilesWithModelsService({
        projectId,
        search,
        source,
        category
      })

      return res.json({ success: true, data: files })
    }
  )

  // POST /api/projects/:projectId/files/upload - File upload or record creation
  router.post(
    '/api/projects/:projectId/files/upload',
    crossOriginCors,
    withAdminOverride(async (req, res, next) => {
      await authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({ getStream: getStreamFactory({ db }) })
      )(req, res, next)
    }),
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId
      const userId = req.context?.userId
      const contentType = req.headers['content-type'] || ''

      if (contentType.includes('multipart/form-data')) {
        let fileSource = '手动上传'
        let fileCategory = '文档'
        let description = ''
        let customAttributes: any = null

        const busboy = createBusboy(req, FILE_MANAGEMENT_MAX_FILE_SIZE_BYTES)

        busboy.on('field', (fieldname, val) => {
          if (fieldname === 'source') fileSource = val
          if (fieldname === 'category') fileCategory = val
          if (fieldname === 'description') description = val
          if (fieldname === 'customAttributes') {
            try {
              customAttributes = JSON.parse(val)
            } catch {
              customAttributes = val
            }
          }
        })

        const processor = await processNewFileStream({
          busboy,
          streamId: projectId,
          userId: userId || 'system',
          logger: req.log,
          onFinishAllFileUploads: async (uploadResults) => {
            const savedRecords = []
            for (const result of uploadResults) {
              const record = await createProjectFileInDb({
                projectId,
                name: result.fileName,
                blobId: result.blobId,
                fileSize: result.fileSize,
                fileType: result.fileName.split('.').pop() || '',
                source: fileSource,
                category: fileCategory,
                customAttributes,
                description,
                uploaderId: userId,
                uploaderName: req.context?.role || 'User'
              })
              savedRecords.push(record)
            }
            res.status(201).json({ success: true, data: savedRecords })
          },
          onError: (err: any) => {
            res
              .status(400)
              .json({ success: false, error: err?.message || 'Upload failed' })
          }
        })

        req.pipe(processor)
      } else {
        // Handle JSON body
        const {
          name,
          blobId,
          fileSize,
          fileType,
          source,
          category,
          customAttributes,
          description
        } = req.body

        if (!name) {
          throw new BadRequestError('File name is required')
        }

        const record = await createProjectFileInDb({
          projectId,
          name,
          blobId: blobId || null,
          fileSize: fileSize || null,
          fileType: fileType || name.split('.').pop() || '',
          source: source || '手动上传',
          category: category || '其他',
          customAttributes: customAttributes || null,
          description: description || null,
          uploaderId: userId,
          uploaderName: req.context?.role || 'User'
        })

        return res.status(201).json({ success: true, data: record })
      }
    }
  )

  // PUT /api/projects/:projectId/files/:fileId - Update file or model metadata
  router.put(
    '/api/projects/:projectId/files/:fileId',
    crossOriginCors,
    withAdminOverride(async (req, res, next) => {
      await authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({ getStream: getStreamFactory({ db }) })
      )(req, res, next)
    }),
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId
      const fileId = req.params.fileId
      const { name, source, category, customAttributes, description } = req.body

      const updated = await upsertFileOrModelMetadataService(fileId, projectId, {
        name,
        source,
        category,
        customAttributes,
        description
      })

      return res.json({ success: true, data: updated })
    }
  )

  // DELETE /api/projects/:projectId/files/:fileId - Delete file (models protected)
  router.delete(
    '/api/projects/:projectId/files/:fileId',
    crossOriginCors,
    withAdminOverride(async (req, res, next) => {
      await authMiddlewareCreator(
        streamWritePermissionsPipelineFactory({ getStream: getStreamFactory({ db }) })
      )(req, res, next)
    }),
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId
      const fileId = req.params.fileId

      if (fileId.startsWith('model_')) {
        throw new BadRequestError('项目模型不能在文件管理中删除')
      }

      const existing = await getProjectFileByIdFromDb(projectId, fileId)
      if (!existing) {
        throw new NotFoundError('文件不存在')
      }

      if (existing.modelId) {
        throw new BadRequestError('项目模型不能在文件管理中删除')
      }

      await deleteProjectFileInDb(projectId, fileId)
      return res.json({ success: true, message: '删除成功' })
    }
  )

  // GET /api/projects/:projectId/files/:fileId/download - Download file
  router.get(
    '/api/projects/:projectId/files/:fileId/download',
    cors(),
    allowCrossOriginResourceAccessMiddelware(),
    withAdminOverride(async (req, res, next) => {
      await authMiddlewareCreator(
        streamReadPermissionsPipelineFactory({ getStream: getStreamFactory({ db }) })
      )(req, res, next)
    }),
    async (req: Request, res: Response) => {
      const projectId = req.params.projectId
      const fileId = req.params.fileId

      let blobId: string | null = null
      let fileName = 'file'

      const projectDb = await getProjectDbClient({ projectId })
      let targetModelId: string | null = null
      let targetBranchName: string | null = null

      if (fileId.startsWith('model_')) {
        targetModelId = fileId.replace('model_', '')
      } else {
        const file = await getProjectFileByIdFromDb(projectId, fileId)
        if (!file) {
          return res.status(404).send('文件不存在')
        }
        if (file.blobId) {
          blobId = file.blobId
          fileName = file.name
        } else if (file.modelId) {
          targetModelId = file.modelId
        } else {
          return res.status(404).send('文件无可供下载的源文件（Blob）')
        }
      }

      if (targetModelId) {
        const model = await projectDb('branches')
          .where('id', targetModelId)
          .andWhere('streamId', projectId)
          .first()

        if (model) {
          targetBranchName = model.name
        }

        const fileUpload = await projectDb('file_uploads')
          .where('streamId', projectId)
          .andWhere((qb) => {
            qb.where('modelId', targetModelId)
            if (targetBranchName) {
              qb.orWhere('branchName', targetBranchName)
            }
          })
          .orderBy('uploadDate', 'desc')
          .first()

        if (fileUpload) {
          blobId = fileUpload.id
          fileName = fileUpload.fileName
        }
      }

      if (!blobId) {
        return res.status(404).send('该模型无可供下载的源文件（Blob）')
      }

      const projectStorage = await getProjectObjectStorage({ projectId })

      const getBlobMetadata = getBlobMetadataFactory({ db: projectDb })
      const getFileStream = getFileStreamFactory({ getBlobMetadata })
      const getObjectStream = getObjectStreamFactory({
        storage: projectStorage.private
      })

      const fileStream = await getFileStream({
        getObjectStream,
        streamId: projectId,
        blobId
      })

      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': contentDisposition(fileName)
      })
      fileStream.pipe(res)
    }
  )

  return router
}
