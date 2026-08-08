import { db } from '@/db/knex'
import { getBlobMetadataFactory } from '@/modules/blobstorage/repositories'
import { getObjectStreamFactory } from '@/modules/blobstorage/repositories/blobs'
import { getFileStreamFactory } from '@/modules/blobstorage/services/management'
import {
  getStreamBranchByNameFactory,
  markCommitBranchUpdatedFactory
} from '@/modules/core/repositories/branches'
import {
  getCommitBranchFactory,
  getCommitFactory,
  switchCommitBranchFactory,
  updateCommitFactory
} from '@/modules/core/repositories/commits'
import { getStreamFactory, getCommitStreamFactory } from '@/modules/core/repositories/streams'
import { getUserFactory } from '@/modules/core/repositories/users'
import { updateCommitAndNotifyFactory } from '@/modules/core/services/commit/management'
import { getFileInfoFactoryV2 } from '@/modules/fileuploads/repositories/fileUploads'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getProjectModelSyncTaskFactory,
  updateProjectModelSyncTaskFactory
} from '@/modules/model-sync/repositories/tasks'
import {
  ModelSyncTaskError,
  normalizeModelSyncTaskError
} from '@/modules/model-sync/services/errors'
import { emitModelSyncTaskUpdated } from '@/modules/model-sync/services/events'
import {
  loginToDtpFactory,
  getDtpUploadConfigFactory,
  pollDtpModelTransformUntilFinishedFactory,
  triggerDtpModelTransformFactory,
  uploadBufferToDtpFactory
} from '@/modules/model-sync/services/dtp'
import { getEventBus } from '@/modules/shared/services/eventBus'

const sleep = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms))

const streamToBuffer = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk)
      continue
    }

    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk))
      continue
    }

    chunks.push(Buffer.from(chunk as ArrayBufferLike))
  }
  return Buffer.concat(chunks)
}

const waitForConvertedUploadFactory =
  (deps: {
    getFileInfo: ReturnType<typeof getFileInfoFactoryV2>
  }) =>
  async (params: {
    projectId: string
    fileUploadId: string
    waitMs?: number
    maxAttempts?: number
  }) => {
    const waitMs = params.waitMs || 5000
    const maxAttempts = params.maxAttempts || 240

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const upload = await deps.getFileInfo({
        fileId: params.fileUploadId,
        projectId: params.projectId
      })
      if (!upload) {
        throw new ModelSyncTaskError('FILE_UPLOAD_NOT_FOUND', '未找到模型上传记录', false)
      }

      if (upload.convertedStatus === FileUploadConvertedStatus.Error) {
        throw new ModelSyncTaskError(
          'FILE_CONVERSION_FAILED',
          upload.convertedMessage || '模型转换失败',
          false
        )
      }

      if (
        upload.convertedStatus === FileUploadConvertedStatus.Completed &&
        upload.convertedCommitId
      ) {
        return upload
      }

      await sleep(waitMs)
    }

    throw new ModelSyncTaskError('FILE_CONVERSION_TIMEOUT', '等待 Speckle 模型转换超时', true)
  }

export const runModelSyncTaskFactory =
  () =>
  async (params: {
    projectId: string
    modelId: string
    taskId: string
    userId: string
  }) => {
    const [projectDb, projectStorage] = await Promise.all([
      getProjectDbClient({ projectId: params.projectId }),
      getProjectObjectStorage({ projectId: params.projectId })
    ])

    const getTask = getProjectModelSyncTaskFactory({ db: projectDb })
    const updateTask = updateProjectModelSyncTaskFactory({ db: projectDb })
    const getFileInfo = getFileInfoFactoryV2({ db: projectDb })
    const getBlobMetadata = getBlobMetadataFactory({ db: projectDb })
    const getObjectStream = getObjectStreamFactory({
      storage: projectStorage.private
    })
    const getFileStream = getFileStreamFactory({ getBlobMetadata })

    const patchTask = async (
      patch: Parameters<typeof updateTask>[0]['patch']
    ) => {
      const updated = await updateTask({
        projectId: params.projectId,
        modelId: params.modelId,
        taskId: params.taskId,
        patch: {
          ...patch,
          updater: params.userId
        }
      })
      if (updated) emitModelSyncTaskUpdated(updated)
      return updated
    }

    try {
      const task = await getTask({
        projectId: params.projectId,
        modelId: params.modelId,
        taskId: params.taskId
      })
      if (!task) return

      const fileUploadId = task.fileUploadId || task.fileId
      if (!fileUploadId) {
        throw new ModelSyncTaskError('MISSING_FILE_UPLOAD_ID', '同步任务缺少 fileUploadId', false)
      }

      await patchTask({
        fileUploadId,
        status: 'speckle_converting',
        progressPercent: 0,
        progressPhase: null,
        progressMessage: '等待 Speckle 转换',
        error: null,
        errorCode: null,
        retriable: false
      })

      const upload = await waitForConvertedUploadFactory({ getFileInfo })({
        projectId: params.projectId,
        fileUploadId
      })
      if (!upload.convertedCommitId) {
        throw new ModelSyncTaskError(
          'VERSION_METADATA_UPDATE_FAILED',
          '模型转换完成，但未拿到 versionId',
          false
        )
      }

      await patchTask({
        fileUploadId: upload.id,
        versionId: upload.convertedCommitId,
        fileType: upload.fileType,
        fileSize: upload.fileSize || null,
        status: 'syncing_dtp_model',
        progressPercent: null,
        progressPhase: null,
        progressMessage: '正在同步 DTP 模型',
        error: null,
        errorCode: null,
        retriable: false
      })

      const user = await getUserFactory({ db })(params.userId)
      if (!user?.email) {
        throw new ModelSyncTaskError(
          'DTP_USER_CONTACT_NOT_FOUND',
          '未找到用户手机号，无法登录 DTP',
          false
        )
      }

      const fileStream = await getFileStream({
        blobId: task.fileId || upload.id,
        streamId: params.projectId,
        getObjectStream
      })
      const fileBuffer = await streamToBuffer(fileStream)

      const uploadToDtp = uploadBufferToDtpFactory({
        loginToDtp: loginToDtpFactory(),
        getDtpUploadConfig: getDtpUploadConfigFactory()
      })
      const dtpResult = await uploadToDtp({
        mobile: user.email,
        fileName: upload.fileName,
        buffer: fileBuffer
      })

      await patchTask({
        versionId: upload.convertedCommitId,
        seedId: dtpResult.seedId,
        assetId: dtpResult.assetId,
        assetName: dtpResult.assetName,
        status: 'syncing_external_ids',
        progressPercent: null,
        progressPhase: null,
        progressMessage: '正在同步外部 ID',
        error: null,
        errorCode: null,
        retriable: false
      })

      const updateCommitAndNotify = updateCommitAndNotifyFactory({
        getCommit: getCommitFactory({ db: projectDb }),
        getStream: getStreamFactory({ db: projectDb }),
        getCommitStream: getCommitStreamFactory({ db: projectDb }),
        getStreamBranchByName: getStreamBranchByNameFactory({ db: projectDb }),
        getCommitBranch: getCommitBranchFactory({ db: projectDb }),
        switchCommitBranch: switchCommitBranchFactory({ db: projectDb }),
        updateCommit: updateCommitFactory({ db: projectDb }),
        emitEvent: getEventBus().emit,
        markCommitBranchUpdated: markCommitBranchUpdatedFactory({ db: projectDb })
      })

      await updateCommitAndNotify(
        {
          projectId: params.projectId,
          versionId: upload.convertedCommitId,
          seedId: dtpResult.seedId,
          assetId: dtpResult.assetId,
          assetName: dtpResult.assetName,
          skipStandardUpdateAuth: true
        },
        params.userId
      )

      await patchTask({
        status: 'triggering_model_transform',
        progressPercent: null,
        progressPhase: null,
        progressMessage: '正在触发模型转换',
        error: null,
        errorCode: null,
        retriable: false
      })

      const triggerTransform = triggerDtpModelTransformFactory()
      const transformTaskId = await triggerTransform({
        mobile: user.email,
        assetId: dtpResult.assetId,
        assetName: dtpResult.assetName
      })

      await patchTask({
        transformTaskId,
        status: 'polling_model_transform',
        progressPercent: null,
        progressPhase: null,
        progressMessage: '正在等待模型转换完成'
      })

      const pollTransform = pollDtpModelTransformUntilFinishedFactory()
      await pollTransform({
        mobile: user.email,
        transformTaskId
      })

      await patchTask({
        status: 'succeeded',
        progressPercent: 100,
        progressPhase: null,
        progressMessage: '模型同步完成',
        error: null,
        errorCode: null,
        retriable: false
      })
    } catch (error) {
      const { message, errorCode, retriable } = normalizeModelSyncTaskError(error)
      await patchTask({
        status: 'failed',
        progressMessage: null,
        error: message,
        errorCode,
        retriable
      })
    }
  }
