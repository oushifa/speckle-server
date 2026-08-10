import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  ActiveRvtConversionJobStatuses,
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
import {
  buildRvtJobLogContext,
  createRvtConvertLogger
} from '@/modules/rvt-conversion/services/logging'

const serviceUpdater = 'rvt-conversion-service'
const lifecycleLogger = createRvtConvertLogger('lifecycle')
const TerminalProgressPhases = new Set(['completed', 'failed'])
const TerminalModelSyncStatuses = new Set(['succeeded', 'failed'])

const isTerminalProgressPhase = (phase: string | null | undefined) =>
  !!phase && TerminalProgressPhases.has(phase)

const isTerminalModelSyncStatus = (
  status: ProjectModelSyncTaskRecord['status'] | undefined
) => !!status && TerminalModelSyncStatuses.has(status)

const isTerminalFileUploadStatus = (
  status: FileUploadRecord['convertedStatus'] | FileUploadConvertedStatus | undefined
) => status === FileUploadConvertedStatus.Completed || status === FileUploadConvertedStatus.Error

const hasChanged = <T>(current: T, next: T) => current !== next
type FileUploadTerminalGuardState = Pick<
  FileUploadRecord,
  | 'convertedStatus'
  | 'convertedMessage'
  | 'convertedCommitId'
  | 'progressPercent'
  | 'progressPhase'
  | 'progressMessage'
>

const applyTerminalGuardToFileUploadState = (
  current: FileUploadTerminalGuardState,
  next: FileUploadTerminalGuardState
) => {
  let ignoredTerminalStatusRegression = false
  let ignoredTerminalPhaseRegression = false

  if (
    isTerminalFileUploadStatus(current.convertedStatus) &&
    !isTerminalFileUploadStatus(next.convertedStatus)
  ) {
    ignoredTerminalStatusRegression = true
    next.convertedStatus = current.convertedStatus
    next.convertedMessage = current.convertedMessage
    next.convertedCommitId = current.convertedCommitId
  }

  if (
    isTerminalProgressPhase(current.progressPhase) &&
    !isTerminalProgressPhase(next.progressPhase)
  ) {
    ignoredTerminalPhaseRegression = true
    next.progressPercent = current.progressPercent
    next.progressPhase = current.progressPhase
    next.progressMessage = current.progressMessage
  }

  return {
    next,
    ignoredTerminalStatusRegression,
    ignoredTerminalPhaseRegression
  }
}

const applyTerminalGuardToModelSyncTaskPatch = (
  current: ProjectModelSyncTaskRecord,
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
) => {
  const nextPatch = { ...patch }
  let ignoredTerminalStatusRegression = false
  let ignoredTerminalPhaseRegression = false

  if (
    'status' in nextPatch &&
    isTerminalModelSyncStatus(current.status) &&
    !isTerminalModelSyncStatus(nextPatch.status)
  ) {
    ignoredTerminalStatusRegression = true
    nextPatch.status = current.status
    if ('error' in nextPatch) nextPatch.error = current.error
    if ('errorCode' in nextPatch) nextPatch.errorCode = current.errorCode
    if ('retriable' in nextPatch) nextPatch.retriable = current.retriable
  }

  if (
    'progressPhase' in nextPatch &&
    isTerminalProgressPhase(current.progressPhase) &&
    !isTerminalProgressPhase(nextPatch.progressPhase)
  ) {
    ignoredTerminalPhaseRegression = true
    nextPatch.progressPhase = current.progressPhase
    if ('progressPercent' in nextPatch) nextPatch.progressPercent = current.progressPercent
    if ('progressMessage' in nextPatch) nextPatch.progressMessage = current.progressMessage
  }

  return {
    nextPatch,
    ignoredTerminalStatusRegression,
    ignoredTerminalPhaseRegression
  }
}

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
        ...buildRvtJobLogContext(params.job),
        convertedStatus: params.status,
        convertedCommitId: params.convertedCommitId,
        hasConvertedMessage: !!params.convertedMessage,
        progressPercent: params.progressPercent ?? null,
        progressPhase: params.progressPhase ?? null
      },
      'RVT_CONVERT file upload status sync started'
    )

    const fileUpload = await getFileInfo({
      fileId: params.job.sourceFileId,
      projectId: params.job.projectId
    })
    if (!fileUpload) {
      lifecycleLogger.warn(
        {
          ...buildRvtJobLogContext(params.job)
        },
        'RVT_CONVERT file upload not found during status sync'
      )
      return
    }

    const nextUploadState = applyTerminalGuardToFileUploadState(fileUpload, {
      convertedStatus: params.status,
      convertedMessage: params.convertedMessage,
      convertedCommitId: params.convertedCommitId,
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
    })

    if (
      !hasChanged(fileUpload.convertedStatus, nextUploadState.next.convertedStatus) &&
      !hasChanged(fileUpload.convertedMessage, nextUploadState.next.convertedMessage) &&
      !hasChanged(fileUpload.convertedCommitId, nextUploadState.next.convertedCommitId) &&
      !hasChanged(fileUpload.progressPercent, nextUploadState.next.progressPercent) &&
      !hasChanged(fileUpload.progressPhase, nextUploadState.next.progressPhase) &&
      !hasChanged(fileUpload.progressMessage, nextUploadState.next.progressMessage)
    ) {
      if (
        nextUploadState.ignoredTerminalStatusRegression ||
        nextUploadState.ignoredTerminalPhaseRegression
      ) {
        lifecycleLogger.info(
          {
            ...buildRvtJobLogContext(params.job),
            ignoredTerminalStatusRegression:
              nextUploadState.ignoredTerminalStatusRegression,
            ignoredTerminalPhaseRegression:
              nextUploadState.ignoredTerminalPhaseRegression
          },
          'RVT_CONVERT file upload update ignored due to terminal state guard'
        )
      }
      return
    }

    const updatedFile = (await updateFileUpload({
      id: fileUpload.id,
      upload: {
        convertedStatus: nextUploadState.next.convertedStatus,
        convertedMessage: nextUploadState.next.convertedMessage,
        convertedCommitId: nextUploadState.next.convertedCommitId,
        convertedLastUpdate: new Date(),
        progressPercent: nextUploadState.next.progressPercent,
        progressPhase: nextUploadState.next.progressPhase,
        progressMessage: nextUploadState.next.progressMessage
      }
    })) as FileUploadRecord

    lifecycleLogger.info(
      {
        ...buildRvtJobLogContext(params.job),
        convertedStatus: updatedFile.convertedStatus,
        convertedCommitId: updatedFile.convertedCommitId,
        progressPercent: updatedFile.progressPercent,
        progressPhase: updatedFile.progressPhase
      },
      'RVT_CONVERT file upload status updated'
    )

    await emitFileStatusChange({
      file: updatedFile
    })

    lifecycleLogger.info(
      {
        ...buildRvtJobLogContext(params.job)
      },
      'RVT_CONVERT file upload status event emitted'
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

  lifecycleLogger.info(
    {
      ...buildRvtJobLogContext(params.job),
      relatedTaskCount: relatedTasks.length,
      patch: params.patch
    },
    'RVT_CONVERT model sync task sync started'
  )

  for (const task of relatedTasks) {
    const nextTaskPatch = applyTerminalGuardToModelSyncTaskPatch(task, params.patch)

    const patchChanged = Object.entries(nextTaskPatch.nextPatch).some(([key, value]) => {
      const currentValue = task[key as keyof ProjectModelSyncTaskRecord]
      return hasChanged(currentValue, value as typeof currentValue)
    })

    if (!patchChanged) {
      if (
        nextTaskPatch.ignoredTerminalStatusRegression ||
        nextTaskPatch.ignoredTerminalPhaseRegression
      ) {
        lifecycleLogger.info(
          {
            ...buildRvtJobLogContext(params.job),
            relatedTaskId: task.id,
            ignoredTerminalStatusRegression:
              nextTaskPatch.ignoredTerminalStatusRegression,
            ignoredTerminalPhaseRegression:
              nextTaskPatch.ignoredTerminalPhaseRegression
          },
          'RVT_CONVERT model sync task update ignored due to terminal state guard'
        )
      }
      continue
    }

    const updatedTask = await updateTask({
      projectId: task.projectId,
      modelId: task.modelId,
      taskId: task.id,
      patch: nextTaskPatch.nextPatch
    })

    if (updatedTask) {
      lifecycleLogger.info(
        {
          ...buildRvtJobLogContext(params.job),
          relatedTaskId: updatedTask.id,
          relatedTaskStatus: updatedTask.status,
          relatedTaskProgressPhase: updatedTask.progressPhase,
          relatedTaskProgressPercent: updatedTask.progressPercent
        },
        'RVT_CONVERT model sync task updated'
      )
      emitModelSyncTaskUpdated(updatedTask)
    }
  }

  lifecycleLogger.info(
    {
      ...buildRvtJobLogContext(params.job),
      relatedTaskCount: relatedTasks.length
    },
    'RVT_CONVERT model sync task sync completed'
  )
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
  lifecycleLogger.info(
    {
      projectId: params.projectId,
      jobId: params.taskId,
      externalTaskId: params.externalTaskId || null
    },
    'RVT_CONVERT acknowledge lifecycle started'
  )

  const { projectDb, getJob, updateJob, syncFileUploadFromRvtJob } =
    await getJobServices(params.projectId)
  const job = await getJob({ id: params.taskId })
  if (!job) {
    lifecycleLogger.warn(
      {
        projectId: params.projectId,
        jobId: params.taskId,
        externalTaskId: params.externalTaskId || null
      },
      'RVT_CONVERT acknowledge lifecycle job not found'
    )
    return null
  }

  const updatedJob = await updateJob({
    id: params.taskId,
    item: {
      status: 'acknowledged',
      externalTaskId: params.externalTaskId || job.externalTaskId,
      acknowledgedAt: job.acknowledgedAt || new Date(),
      updater: serviceUpdater
    }
  })

  lifecycleLogger.info(
    {
      ...buildRvtJobLogContext(updatedJob || job),
      externalTaskId: params.externalTaskId || job.externalTaskId || null,
      acknowledgedAt: (updatedJob || job).acknowledgedAt
    },
    'RVT_CONVERT acknowledge lifecycle persisted job state'
  )

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

  lifecycleLogger.info(
    {
      ...buildRvtJobLogContext(updatedJob || job),
      externalTaskId: (updatedJob || job).externalTaskId || null
    },
    'RVT_CONVERT acknowledge lifecycle completed'
  )

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
  lifecycleLogger.info(
    {
      projectId: params.projectId,
      jobId: params.taskId,
      phase: params.phase,
      progress: params.progress,
      externalTaskId: params.externalTaskId || null,
      current: params.current ?? null,
      total: params.total ?? null
    },
    'RVT_CONVERT progress lifecycle started'
  )

  const { projectDb, getJob, updateJob, syncFileUploadFromRvtJob } =
    await getJobServices(params.projectId)
  const job = await getJob({ id: params.taskId })
  if (!job) {
    lifecycleLogger.warn(
      {
        projectId: params.projectId,
        jobId: params.taskId,
        phase: params.phase,
        progress: params.progress
      },
      'RVT_CONVERT progress lifecycle job not found'
    )
    return null
  }

  if (!ActiveRvtConversionJobStatuses.includes(job.status)) {
    lifecycleLogger.info(
      {
        ...buildRvtJobLogContext(job),
        phase: params.phase,
        progress: params.progress,
        externalTaskId: params.externalTaskId || null
      },
      'RVT_CONVERT progress lifecycle ignored because job is already completed'
    )
    return job
  }

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

  lifecycleLogger.info(
    {
      ...buildRvtJobLogContext(updatedJob || job),
      phase: params.phase,
      progress: params.progress,
      progressState
    },
    'RVT_CONVERT progress lifecycle persisted job state'
  )

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

  lifecycleLogger.info(
    {
      ...buildRvtJobLogContext(updatedJob || job),
      phase: params.phase,
      progress: params.progress,
      progressState
    },
    'RVT_CONVERT progress lifecycle completed'
  )

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
  lifecycleLogger.info(
    params.status === 'success'
      ? {
          projectId: params.projectId,
          jobId: params.taskId,
          status: params.status,
          externalTaskId: params.externalTaskId || null,
          versionId: params.versionId
        }
      : {
          projectId: params.projectId,
          jobId: params.taskId,
          status: params.status,
          externalTaskId: params.externalTaskId || null,
          errorMessage: params.errorMessage
        },
    'RVT_CONVERT result lifecycle started'
  )

  const { projectDb, getJob, updateJob, syncFileUploadFromRvtJob } =
    await getJobServices(params.projectId)
  const job = await getJob({ id: params.taskId })
  if (!job) {
    lifecycleLogger.warn(
      {
        projectId: params.projectId,
        jobId: params.taskId,
        status: params.status
      },
      'RVT_CONVERT result lifecycle job not found'
    )
    return null
  }

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

  lifecycleLogger.info(
    {
      ...buildRvtJobLogContext(updatedJob || job),
      externalTaskId: params.externalTaskId || job.externalTaskId || null,
      versionId: params.status === 'success' ? params.versionId : null,
      errorMessage: params.status === 'failed' ? params.errorMessage : null,
      finishedAt: (updatedJob || job).finishedAt
    },
    'RVT_CONVERT result lifecycle persisted job state'
  )

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

  lifecycleLogger.info(
    {
      ...buildRvtJobLogContext(updatedJob || job),
      finalStatus: params.status,
      versionId: params.status === 'success' ? params.versionId : null
    },
    'RVT_CONVERT result lifecycle completed'
  )

  return updatedJob || job
}
