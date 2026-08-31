import { db } from '@/db/knex'
import { getBlobMetadataFactory } from '@/modules/blobstorage/repositories'
import { getObjectStreamFactory } from '@/modules/blobstorage/repositories/blobs'
import { getFileStreamFactory } from '@/modules/blobstorage/services/management'
import {
  getBranchByIdFactory,
  getStreamBranchByNameFactory,
  markCommitBranchUpdatedFactory
} from '@/modules/core/repositories/branches'
import {
  getCommitBranchFactory,
  getCommitFactory,
  switchCommitBranchFactory,
  updateCommitFactory
} from '@/modules/core/repositories/commits'
import {
  acquireTaskLockFactory,
  releaseTaskLockFactory
} from '@/modules/core/repositories/scheduledTasks'
import {
  getStreamFactory,
  getCommitStreamFactory
} from '@/modules/core/repositories/streams'
import { getUserFactory } from '@/modules/core/repositories/users'
import { updateCommitAndNotifyFactory } from '@/modules/core/services/commit/management'
import {
  getFileInfoFactoryV2,
  updateFileUploadFactory
} from '@/modules/fileuploads/repositories/fileUploads'
import {
  FileUploadConvertedStatus,
  isExternalConvertibleFileType
} from '@/modules/fileuploads/helpers/types'
import { dispatchRvtFileImportFactory } from '@/modules/fileuploads/services/rvt'
import { notifyChangeInFileStatus } from '@/modules/fileuploads/services/management'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getProjectModelSyncTaskFactory,
  updateProjectModelSyncTaskFactory
} from '@/modules/model-sync/repositories/tasks'
import {
  getQueueDb,
  getQueuePositionsByBlobIds,
  QUEUE_SUPPORTED_FILE_TYPES
} from '@/modules/model-sync/services/queuePosition'
import {
  MODEL_SYNC_AUTO_RETRY_INTERVAL_MS,
  MODEL_SYNC_AUTO_RETRY_LIMIT,
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
import {
  getRetryStatusForEntryPoint,
  resolveRetryEntryPoint,
  type ModelSyncRetryEntryPoint
} from '@/modules/model-sync/services/retry'
import { getEventBus } from '@/modules/shared/services/eventBus'

const sleep = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms))

const TerminalFileUploadStatuses = new Set<FileUploadConvertedStatus>([
  FileUploadConvertedStatus.Completed,
  FileUploadConvertedStatus.Error
])
const TerminalProgressPhases = new Set(['completed', 'failed'])
const PostConversionLockTimeoutMs = 30 * 60 * 1000

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
    const updateFileUpload = updateFileUploadFactory({ db: projectDb })
    const acquireTaskLock = acquireTaskLockFactory({ db })
    const releaseTaskLock = releaseTaskLockFactory({ db })
    const getBlobMetadata = getBlobMetadataFactory({ db: projectDb })
    const getObjectStream = getObjectStreamFactory({
      storage: projectStorage.private
    })
    const getFileStream = getFileStreamFactory({ getBlobMetadata })
    const getBranchById = getBranchByIdFactory({ db: projectDb })
    const getUser = getUserFactory({ db })
    const dispatchRvtFileImport = dispatchRvtFileImportFactory({ db: projectDb })
    const emitFileStatusChange = notifyChangeInFileStatus({
      eventEmit: getEventBus().emit
    })
    const uploadToDtp = uploadBufferToDtpFactory({
      loginToDtp: loginToDtpFactory(),
      getDtpUploadConfig: getDtpUploadConfigFactory()
    })
    const triggerTransform = triggerDtpModelTransformFactory()
    const pollTransform = pollDtpModelTransformUntilFinishedFactory()
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

    const patchTask = async (patch: Parameters<typeof updateTask>[0]['patch']) => {
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

    const loadTask = async () =>
      await getTask({
        projectId: params.projectId,
        modelId: params.modelId,
        taskId: params.taskId
      })

    const withPostConversionLock = async <T>(callback: () => Promise<T>) => {
      const taskName = `model-sync-post-conversion:${params.projectId}:${params.modelId}:${params.taskId}`
      const lock = await acquireTaskLock({
        taskName,
        lockExpiresAt: new Date(Date.now() + PostConversionLockTimeoutMs)
      })

      if (!lock) {
        return {
          acquired: false as const,
          result: null as T | null
        }
      }

      try {
        return {
          acquired: true as const,
          result: await callback()
        }
      } finally {
        await releaseTaskLock({ taskName })
      }
    }

    const getConvertedUploadState = async (
      task: NonNullable<Awaited<ReturnType<typeof loadTask>>>
    ) => {
      const fileUploadId = task.fileUploadId || task.fileId
      if (!fileUploadId) {
        throw new ModelSyncTaskError(
          'MISSING_FILE_UPLOAD_ID',
          '同步任务缺少 fileUploadId',
          false
        )
      }

      const upload = await getFileInfo({
        fileId: fileUploadId,
        projectId: params.projectId
      })
      if (!upload) {
        throw new ModelSyncTaskError(
          'FILE_UPLOAD_NOT_FOUND',
          '未找到模型上传记录',
          false
        )
      }

      if (upload.convertedStatus === FileUploadConvertedStatus.Error) {
        throw new ModelSyncTaskError(
          'FILE_CONVERSION_FAILED',
          upload.convertedMessage || '模型转换失败',
          false
        )
      }

      return upload
    }

    const resolveCompletedUpload = async (
      task: NonNullable<Awaited<ReturnType<typeof loadTask>>>
    ) => {
      const upload = await getConvertedUploadState(task)
      if (
        upload.convertedStatus !== FileUploadConvertedStatus.Completed ||
        !upload.convertedCommitId
      ) {
        throw new ModelSyncTaskError(
          'VERSION_METADATA_UPDATE_FAILED',
          '模型转换尚未完成或未拿到 versionId',
          false
        )
      }

      return upload
    }

    const restartConversionIfNeeded = async (
      task: NonNullable<Awaited<ReturnType<typeof loadTask>>>
    ) => {
      const fileUploadId = task.fileUploadId || task.fileId
      if (!fileUploadId) {
        throw new ModelSyncTaskError(
          'MISSING_FILE_UPLOAD_ID',
          '同步任务缺少 fileUploadId',
          false
        )
      }

      const upload = await getFileInfo({
        fileId: fileUploadId,
        projectId: params.projectId
      })
      if (!upload) {
        throw new ModelSyncTaskError(
          'FILE_UPLOAD_NOT_FOUND',
          '未找到模型上传记录',
          false
        )
      }

      // 已成功转换并包含 versionId 则无需重置
      if (
        upload.convertedStatus === FileUploadConvertedStatus.Completed &&
        upload.convertedCommitId
      ) {
        return
      }

      const normFileType = (upload.fileType || '').toLowerCase()

      // 1. 处理微服务后台队列格式 (IFC / SKP / DXF) 重试
      if (QUEUE_SUPPORTED_FILE_TYPES.has(normFileType)) {
        const resetUpload = await updateFileUpload({
          id: upload.id,
          upload: {
            convertedStatus: FileUploadConvertedStatus.Queued,
            convertedMessage: '准备重新转换',
            convertedCommitId: null,
            convertedLastUpdate: new Date(),
            progressPercent: null,
            progressPhase: null,
            progressMessage: '准备重新转换'
          }
        })

        await emitFileStatusChange({
          file: resetUpload
        })

        const queueKnex = getQueueDb()
        const existingJob = await queueKnex('background_jobs')
          .whereRaw("payload ->> 'blobId' = ?", [fileUploadId])
          .first()
        if (existingJob) {
          await queueKnex('background_jobs').where({ id: existingJob.id }).update({
            status: 'queued',
            attempt: 0,
            remainingComputeBudgetSeconds: 1200,
            updatedAt: new Date()
          })
        }
        return
      }

      // 2. 处理外部转换服务格式 (RVT / NWD / NWC) 重试
      if (!isExternalConvertibleFileType(upload.fileType)) {
        return
      }

      const shouldResetForRetry =
        TerminalFileUploadStatuses.has(
          upload.convertedStatus as FileUploadConvertedStatus
        ) ||
        (!!upload.progressPhase && TerminalProgressPhases.has(upload.progressPhase))

      if (!shouldResetForRetry) {
        return
      }

      const model = await getBranchById(task.modelId, {
        streamId: params.projectId
      })
      if (!model) {
        throw new ModelSyncTaskError(
          'UNKNOWN',
          `未找到模型，无法重新发起 ${upload.fileType.toUpperCase()} 转换`,
          false
        )
      }

      const resetUpload = await updateFileUpload({
        id: upload.id,
        upload: {
          convertedStatus: FileUploadConvertedStatus.Queued,
          convertedMessage: '准备重新转换',
          convertedCommitId: null,
          convertedLastUpdate: new Date(),
          progressPercent: null,
          progressPhase: null,
          progressMessage: '准备重新转换'
        }
      })

      await emitFileStatusChange({
        file: resetUpload
      })

      await dispatchRvtFileImport({
        projectId: params.projectId,
        modelId: task.modelId,
        modelName: model.name,
        fileUpload: {
          ...upload,
          convertedStatus: resetUpload.convertedStatus,
          convertedLastUpdate: resetUpload.convertedLastUpdate,
          convertedMessage: resetUpload.convertedMessage,
          convertedCommitId: resetUpload.convertedCommitId,
          progressPercent: resetUpload.progressPercent,
          progressPhase: resetUpload.progressPhase,
          progressMessage: resetUpload.progressMessage
        },
        userId: params.userId
      })
    }

    const ensureUserEmail = async () => {
      const user = await getUser(params.userId)
      if (!user?.email) {
        throw new ModelSyncTaskError(
          'DTP_USER_CONTACT_NOT_FOUND',
          '未找到用户手机号，无法登录 DTP',
          false
        )
      }

      return user.email
    }

    const runSpeckleStage = async (
      task: NonNullable<Awaited<ReturnType<typeof loadTask>>>
    ) => {
      const fileUploadId = task.fileUploadId || task.fileId
      if (!fileUploadId) {
        throw new ModelSyncTaskError(
          'MISSING_FILE_UPLOAD_ID',
          '同步任务缺少 fileUploadId',
          false
        )
      }

      let initialProgressMessage = '等待模型转换'
      const normFileType = task.fileType?.toLowerCase() || ''
      if (QUEUE_SUPPORTED_FILE_TYPES.has(normFileType)) {
        try {
          const queueMap = await getQueuePositionsByBlobIds([fileUploadId])
          const queueInfo = queueMap.get(fileUploadId)
          if (
            queueInfo?.status === 'queued' &&
            typeof queueInfo.queuePosition === 'number'
          ) {
            initialProgressMessage = `排队中，当前处于队列第 ${queueInfo.queuePosition} 位`
          } else if (queueInfo?.status === 'processing') {
            initialProgressMessage = '正在转换模型'
          }
        } catch {
          // ignore
        }
      }

      await patchTask({
        fileUploadId,
        status: 'speckle_converting',
        progressPercent: 0,
        progressPhase: null,
        progressMessage: initialProgressMessage,
        error: null,
        errorCode: null,
        retriable: false
      })

      await restartConversionIfNeeded(task)

      const upload = await getConvertedUploadState(task)
      const isCompleted =
        upload.convertedStatus === FileUploadConvertedStatus.Completed &&
        !!upload.convertedCommitId

      return {
        isCompleted,
        upload: isCompleted ? upload : null
      }
    }

    const runSyncStage = async (
      task: NonNullable<Awaited<ReturnType<typeof loadTask>>>
    ) => {
      const upload = await resolveCompletedUpload(task)
      const versionId = upload.convertedCommitId as string

      await patchTask({
        fileUploadId: upload.id,
        versionId,
        fileType: upload.fileType,
        fileSize: upload.fileSize || null,
        seedId: null,
        assetId: null,
        assetName: null,
        transformTaskId: null,
        status: 'syncing_dtp_model',
        progressPercent: null,
        progressPhase: null,
        progressMessage: '正在同步 DTP 模型',
        error: null,
        errorCode: null,
        retriable: false
      })

      const mobile = await ensureUserEmail()
      const fileStream = await getFileStream({
        blobId: task.fileId || upload.id,
        streamId: params.projectId,
        getObjectStream
      })
      const fileBuffer = await streamToBuffer(fileStream)
      const dtpResult = await uploadToDtp({
        mobile,
        fileName: upload.fileName,
        buffer: fileBuffer
      })

      await patchTask({
        versionId,
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

      return {
        mobile,
        assetId: dtpResult.assetId,
        assetName: dtpResult.assetName
      }
    }

    const runTransformStage = async (
      task: NonNullable<Awaited<ReturnType<typeof loadTask>>>
    ) => {
      const mobile = await ensureUserEmail()
      const assetId = task.assetId?.trim()
      const assetName = task.assetName?.trim()
      if (!assetId || !assetName) {
        throw new ModelSyncTaskError(
          'DTP_UPLOAD_RESULT_INVALID',
          '缺少中海资产标识，无法重新发起模型转换',
          false
        )
      }

      await patchTask({
        transformTaskId: null,
        status: 'triggering_model_transform',
        progressPercent: null,
        progressPhase: null,
        progressMessage: '正在触发模型转换',
        error: null,
        errorCode: null,
        retriable: false
      })

      const transformTaskId = await triggerTransform({
        mobile,
        assetId,
        assetName
      })

      await patchTask({
        transformTaskId,
        status: 'polling_model_transform',
        progressPercent: null,
        progressPhase: null,
        progressMessage: '正在等待模型转换完成'
      })

      await pollTransform({
        mobile,
        transformTaskId
      })
    }

    const runPostConversionStages = async (
      task: NonNullable<Awaited<ReturnType<typeof loadTask>>>
    ) => {
      const { acquired } = await withPostConversionLock(async () => {
        let latestTask = (await loadTask()) || task
        const currentEntryPoint = resolveRetryEntryPoint(latestTask)
        if (!currentEntryPoint) {
          return
        }

        let shouldRunTransform = false
        if (currentEntryPoint === 'speckle' || currentEntryPoint === 'sync') {
          await runSyncStage(latestTask)
          latestTask = (await loadTask()) || latestTask
          shouldRunTransform = true
        }

        if (currentEntryPoint === 'transform') {
          shouldRunTransform = true
        }

        if (shouldRunTransform) {
          latestTask = (await loadTask()) || latestTask
          await runTransformStage(latestTask)
          latestTask = (await loadTask()) || latestTask
        }

        const versionId = latestTask.versionId
        const seedId = latestTask.seedId
        const assetId = latestTask.assetId
        const assetName = latestTask.assetName

        if (versionId && seedId && assetId && assetName) {
          await updateCommitAndNotify(
            {
              projectId: params.projectId,
              versionId,
              seedId,
              assetId,
              assetName,
              skipStandardUpdateAuth: true
            },
            params.userId
          )
        }

        await patchTask({
          status: 'succeeded',
          progressPercent: 100,
          progressPhase: null,
          progressMessage: '模型同步完成',
          error: null,
          errorCode: null,
          retriable: false
        })
      })

      return acquired
    }

    const runFromEntryPoint = async (
      task: NonNullable<Awaited<ReturnType<typeof loadTask>>>,
      entryPoint: ModelSyncRetryEntryPoint
    ) => {
      if (entryPoint === 'speckle') {
        const speckleStage = await runSpeckleStage(task)
        if (!speckleStage.isCompleted) {
          return
        }
        task = (await loadTask()) || task
        await runPostConversionStages(task)
        return
      }

      await runPostConversionStages(task)
    }

    let task = await loadTask()
    if (!task) return

    while (task) {
      const entryPoint = resolveRetryEntryPoint(task)
      if (!entryPoint) return

      try {
        await runFromEntryPoint(task, entryPoint)
        return
      } catch (error) {
        const { message, errorCode, retriable } = normalizeModelSyncTaskError(error)
        const nextRetryCount: number = task.retryCount + 1
        const canAutoRetry = retriable && nextRetryCount <= MODEL_SYNC_AUTO_RETRY_LIMIT

        await patchTask({
          status: 'failed',
          progressPercent: null,
          progressPhase: null,
          progressMessage: canAutoRetry
            ? `将在 ${Math.round(
                MODEL_SYNC_AUTO_RETRY_INTERVAL_MS / 1000
              )} 秒后自动重试`
            : null,
          error: message,
          errorCode,
          retriable: canAutoRetry
        })

        if (!canAutoRetry) {
          return
        }

        await sleep(MODEL_SYNC_AUTO_RETRY_INTERVAL_MS)
        const retryStatus = getRetryStatusForEntryPoint(entryPoint)
        task =
          (await patchTask({
            status: retryStatus,
            retryCount: nextRetryCount,
            error: null,
            errorCode: null,
            retriable: false,
            progressPercent: retryStatus === 'speckle_converting' ? 0 : null,
            progressPhase: null,
            progressMessage:
              retryStatus === 'triggering_model_transform'
                ? '准备重新发起模型转换'
                : retryStatus === 'syncing_dtp_model'
                ? '准备重新同步 DTP 模型'
                : '准备重新等待模型转换'
          })) || (await loadTask())
      }
    }
  }
