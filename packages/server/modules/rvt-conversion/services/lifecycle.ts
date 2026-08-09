import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getRvtConversionJobByIdFactory,
  updateRvtConversionJobFactory,
  type RvtConversionJob
} from '@/modules/rvt-conversion/repositories/jobs'
import {
  listProjectModelSyncTasksByFileUploadIdFactory,
  type ProjectModelSyncTaskRecord,
  updateProjectModelSyncTaskFactory
} from '@/modules/model-sync/repositories/tasks'
import { emitModelSyncTaskUpdated } from '@/modules/model-sync/services/events'
import {
  getFileInfoFactoryV2,
  updateFileUploadFactory
} from '@/modules/fileuploads/repositories/fileUploads'
import { notifyChangeInFileStatus } from '@/modules/fileuploads/services/management'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { FileUploadConvertedStatus } from '@/modules/fileuploads/helpers/types'
import type { FileUploadRecord } from '@/modules/fileuploads/helpers/types'
import { moduleLogger } from '@/observability/logging'

const serviceUpdater = 'rvt-conversion-service'
const lifecycleLogger = moduleLogger.child({
  module: 'rvt-conversion',
  component: 'lifecycle'
})

const syncFileUploadFromRvtJobFactory = (deps: {
  projectDb: Awaited<ReturnType<typeof getProjectDbClient>>
}) => {
  const getFileInfo = getFileInfoFactoryV2({ db: deps.projectDb })
  const updateFileUpload = updateFileUploadFactory({ db: deps.projectDb })
  const emitFileStatusChange = notifyChangeInFileStatus({
    eventEmit: getEventBus().emit
  })

  return async (params: {
    job: RvtConversionJob
    status: FileUploadConvertedStatus
    convertedMessage: string | null
    convertedCommitId: string | null
    progressPercent?: number | null
    progressPhase?: string | null
    progressMessage?: string | null
  }) => {
    lifecycleLogger.info(
      {
        projectId: params.job.projectId,
        modelId: params.job.modelId,
        jobId: params.job.id,
        sourceFileId: params.job.sourceFileId,
        convertedStatus: params.status,
        convertedCommitId: params.convertedCommitId,
        hasConvertedMessage: !!params.convertedMessage
      },
      'RVT CONVERT file upload status sync started'
    )

    const fileUpload = await getFileInfo({
      fileId: params.job.sourceFileId,
      projectId: params.job.projectId
    })
    if (!fileUpload) {
      lifecycleLogger.warn(
        {
          projectId: params.job.projectId,
          modelId: params.job.modelId,
          jobId: params.job.id,
          sourceFileId: params.job.sourceFileId
        },
        'RVT CONVERT file upload not found during status sync'
      )
      return
    }

    const updatedFile = (await updateFileUpload({
      id: fileUpload.id,
      upload: {
        convertedStatus: params.status,
        convertedMessage: params.convertedMessage,
        convertedCommitId: params.convertedCommitId,
        convertedLastUpdate: new Date(),
        progressPercent:
          params.progressPercent === undefined
            ? fileUpload.progressPercent
            : params.progressPercent,
        progressPhase:
          params.progressPhase === undefined
            ? fileUpload.progressPhase
            : params.progressPhase,
        progressMessage:
          params.progressMessage === undefined
            ? fileUpload.progressMessage
            : params.progressMessage
      }
    })) as FileUploadRecord

    lifecycleLogger.info(
      {
        projectId: params.job.projectId,
        modelId: params.job.modelId,
        jobId: params.job.id,
        sourceFileId: params.job.sourceFileId,
        convertedStatus: updatedFile.convertedStatus,
        convertedCommitId: updatedFile.convertedCommitId
      },
      'RVT CONVERT file upload status updated'
    )

    await emitFileStatusChange({
      file: updatedFile
    })

    lifecycleLogger.info(
      {
        projectId: params.job.projectId,
        modelId: params.job.modelId,
        jobId: params.job.id,
        sourceFileId: params.job.sourceFileId
      },
      'RVT CONVERT file upload status event emitted'
    )
  }
}

const getJobServices = async (projectId: string) => {
  const projectDb = await getProjectDbClient({ projectId })
  return {
    projectDb,
    getJob: getRvtConversionJobByIdFactory({ db: projectDb }),
    updateJob: updateRvtConversionJobFactory({ db: projectDb }),
    syncFileUploadFromRvtJob: syncFileUploadFromRvtJobFactory({ projectDb })
  }
}

const syncRelatedModelSyncTasksFromRvtJob = async (params: {
  projectDb: Awaited<ReturnType<typeof getProjectDbClient>>
  job: RvtConversionJob
  patch: Partial<
    Pick<
      ProjectModelSyncTaskRecord,
      | 'status'
      | 'versionId'
      | 'progressPercent'
      | 'progressPhase'
      | 'progressMessage'
      | 'error'
      | 'errorCode'
      | 'retriable'
      | 'updater'
    >
  >
}) => {
  const listTasksByFileUploadId = listProjectModelSyncTasksByFileUploadIdFactory({
    db: params.projectDb
  })
  const updateTask = updateProjectModelSyncTaskFactory({ db: params.projectDb })
  const relatedTasks = await listTasksByFileUploadId({
    projectId: params.job.projectId,
    fileUploadId: params.job.sourceFileId,
    activeOnly: true
  })

  for (const task of relatedTasks) {
    const updatedTask = await updateTask({
      projectId: task.projectId,
      modelId: task.modelId,
      taskId: task.id,
      patch: params.patch
    })

    if (updatedTask) {
      emitModelSyncTaskUpdated(updatedTask)
    }
  }
}

const buildProgressMessage = (params: {
  message: string
  progress: number
  current?: number
  total?: number
}) => {
  const percent = Math.round(params.progress)
  if (params.current !== undefined && params.total !== undefined) {
    return `${params.message} (${percent}%, ${params.current}/${params.total})`
  }

  return `${params.message} (${percent}%)`
}

const buildProgressState = (params: {
  phase: string
  progress: number
  message: string
  current?: number
  total?: number
}) => ({
  progressPercent: Math.max(0, Math.min(100, params.progress)),
  progressPhase: params.phase,
  progressMessage: params.message,
  convertedMessage: buildProgressMessage(params)
})

export const acknowledgeRvtConversionJob = async (params: {
  projectId: string
  taskId: string
  externalTaskId?: string | null
}) => {
  const { projectDb, getJob, updateJob, syncFileUploadFromRvtJob } =
    await getJobServices(params.projectId)
  const job = await getJob({ id: params.taskId })
  if (!job) return null

  const updatedJob = await updateJob({
    id: params.taskId,
    item: {
      status: 'acknowledged',
      externalTaskId: params.externalTaskId || job.externalTaskId,
      acknowledgedAt: job.acknowledgedAt || new Date(),
      updater: serviceUpdater
    }
  })

  await syncFileUploadFromRvtJob({
    job: updatedJob || job,
    status: FileUploadConvertedStatus.Converting,
    convertedMessage: '转换服务已接单',
    convertedCommitId: null,
    progressPercent: 0,
    progressPhase: 'acknowledged',
    progressMessage: '转换服务已接单'
  })

  await syncRelatedModelSyncTasksFromRvtJob({
    projectDb,
    job: updatedJob || job,
    patch: {
      status: 'speckle_converting',
      progressPercent: 0,
      progressPhase: 'acknowledged',
      progressMessage: '转换服务已接单',
      error: null,
      errorCode: null,
      retriable: false,
      updater: serviceUpdater
    }
  })

  return updatedJob || job
}

export const progressRvtConversionJob = async (params: {
  projectId: string
  taskId: string
  phase: string
  progress: number
  message: string
  externalTaskId?: string | null
  current?: number
  total?: number
}) => {
  const { projectDb, getJob, updateJob, syncFileUploadFromRvtJob } =
    await getJobServices(params.projectId)
  const job = await getJob({ id: params.taskId })
  if (!job) return null

  const updatedJob = await updateJob({
    id: params.taskId,
    item: {
      status: 'acknowledged',
      externalTaskId: params.externalTaskId || job.externalTaskId,
      acknowledgedAt: job.acknowledgedAt || new Date(),
      updater: serviceUpdater
    }
  })

  const progressState = buildProgressState(params)

  await syncFileUploadFromRvtJob({
    job: updatedJob || job,
    status: FileUploadConvertedStatus.Converting,
    convertedMessage: progressState.convertedMessage,
    convertedCommitId: null,
    progressPercent: progressState.progressPercent,
    progressPhase: progressState.progressPhase,
    progressMessage: progressState.progressMessage
  })

  await syncRelatedModelSyncTasksFromRvtJob({
    projectDb,
    job: updatedJob || job,
    patch: {
      status: 'speckle_converting',
      progressPercent: progressState.progressPercent,
      progressPhase: progressState.progressPhase,
      progressMessage: progressState.progressMessage,
      error: null,
      errorCode: null,
      retriable: false,
      updater: serviceUpdater
    }
  })

  return updatedJob || job
}

export const completeRvtConversionJob = async (
  params:
    | {
        projectId: string
        taskId: string
        status: 'success'
        externalTaskId?: string | null
        versionId: string
      }
    | {
        projectId: string
        taskId: string
        status: 'failed'
        externalTaskId?: string | null
        errorMessage: string
      }
) => {
  const { projectDb, getJob, updateJob, syncFileUploadFromRvtJob } =
    await getJobServices(params.projectId)
  const job = await getJob({ id: params.taskId })
  if (!job) return null

  const now = new Date()
  const updatedJob = await updateJob({
    id: params.taskId,
    item:
      params.status === 'success'
        ? {
            status: 'succeeded',
            externalTaskId: params.externalTaskId || job.externalTaskId,
            versionId: params.versionId,
            errorMessage: null,
            finishedAt: now,
            updater: serviceUpdater
          }
        : {
            status: 'failed',
            externalTaskId: params.externalTaskId || job.externalTaskId,
            errorMessage: params.errorMessage,
            finishedAt: now,
            updater: serviceUpdater
          }
  })

  await syncFileUploadFromRvtJob({
    job: updatedJob || job,
    status:
      params.status === 'success'
        ? FileUploadConvertedStatus.Completed
        : FileUploadConvertedStatus.Error,
    convertedMessage: params.status === 'success' ? null : params.errorMessage,
    convertedCommitId: params.status === 'success' ? params.versionId : null,
    progressPercent: params.status === 'success' ? 100 : null,
    progressPhase: params.status === 'success' ? 'completed' : 'failed',
    progressMessage: params.status === 'success' ? '转换完成' : null
  })

  if (params.status === 'failed') {
    await syncRelatedModelSyncTasksFromRvtJob({
      projectDb,
      job,
      patch: {
        status: 'failed',
        progressPhase: 'failed',
        progressMessage: null,
        error: params.errorMessage,
        errorCode: 'FILE_CONVERSION_FAILED',
        retriable: false,
        updater: serviceUpdater
      }
    })
  } else {
    await syncRelatedModelSyncTasksFromRvtJob({
      projectDb,
      job: updatedJob || job,
      patch: {
        status: 'speckle_converting',
        versionId: params.versionId,
        progressPercent: 100,
        progressPhase: 'completed',
        progressMessage: '转换完成',
        error: null,
        errorCode: null,
        retriable: false,
        updater: serviceUpdater
      }
    })
  }

  return updatedJob || job
}
