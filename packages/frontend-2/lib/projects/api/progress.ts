import type { Optional } from '@speckle/shared'
import type { PostBlobResponse } from '~~/lib/core/api/blobStorage'

export type ProgressPlanFile = {
  id: string
  projectId: string
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | string | null
  creator: string
  updater: string
  createdAt: string
  updatedAt: string
}

export type ProgressPlanImportSummary = {
  status: 'completed' | 'failed'
  importedTaskCount: number
  error?: string
}

export type ProgressPlanUploadResult = {
  data: ProgressPlanFile
  importSummary?: ProgressPlanImportSummary
}

export type ProgressPlanTaskBimSelection = {
  modelId: string
  applicationIds: string[]
}

export type ProgressPlanTaskMilestoneType = 'project' | 'phase' | 'acceptance'

export type ActualProgressRecordBimSelection = {
  modelId: string
  applicationIds: string[]
}

export type ProgressPlanTask = {
  id: string
  projectId: string
  planFileId: string | null
  externalId: string | null
  sysTaskId: string | null
  quantity: string | null
  unit: string | null
  wbs: string | null
  taskName: string
  parentId: string | null
  level: number
  sortOrder: number
  duration: string | null
  startDate: string | null
  endDate: string | null
  milestoneType: ProgressPlanTaskMilestoneType | null
  milestoneDescription: string | null
  isCriticalTask: boolean
  predecessor: string | null
  inspection: string | null
  BIM: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  hasChildren: boolean
  canEditBimAssociation: boolean
  totalElementCount: number
  finishedElementCount: number
  inProgressElementCount: number
  notStartedElementCount: number
  delayedElementCount: number
  completionRate: number
  taskStatus: ProgressTaskSnapshotStatus | null
  totalTaskCount: number
  linkedTaskCount: number
  finishedTaskCount: number
  delayedTaskCount: number
  createdAt: string
  updatedAt: string
}

export type ActualProgressRecord = {
  id: string
  projectId: string
  taskName: string
  year: string
  month: string
  day: string
  weekDay: string
  reportDate: string
  startElementCodes: string
  finishElementCodes: string
  startModelIds: string[]
  startApplicationIds: string[]
  startSelections: ActualProgressRecordBimSelection[]
  finishModelIds: string[]
  finishApplicationIds: string[]
  finishSelections: ActualProgressRecordBimSelection[]
  startBIM: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  finishBIM: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  BIM: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  remark: string
  highTemperature: string
  lowTemperature: string
  morningWeather: string
  afternoonWeather: string
  nightCondition: string
  constructionRecord: string
  qualityRecord: string
  safetyRecord: string
  mortarConcreteSampleRecord: string
  materialEquipmentRecord: string
  siteAppearanceRecord: string
  overtimeRecord: string
  otherRecord: string
  siteLeader: string
  reporter: string
  constructionLog: string
  yearMonth?: string
  tasks?: Array<{
    linkedPlanTaskId: string | null
    taskName: string
    plannedVolume: string | number
    completedVolume: string | number
    unit: string
    selections: Array<{ modelId: string; applicationIds: string[] }>
  }>
  workers?: string[]
  createdAt: string
  updatedAt: string
}

export type ActualProgressRecordInput = {
  taskName: string
  reportDate: string
  startElementCodes?: string
  finishElementCodes?: string
  startModelIds?: string[]
  startApplicationIds?: string[]
  startSelections?: ActualProgressRecordBimSelection[]
  finishModelIds?: string[]
  finishApplicationIds?: string[]
  finishSelections?: ActualProgressRecordBimSelection[]
  startBIM?: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  finishBIM?: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  BIM?: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  remark?: string
  highTemperature?: string
  lowTemperature?: string
  morningWeather?: string
  afternoonWeather?: string
  nightCondition?: string
  constructionRecord?: string
  qualityRecord?: string
  safetyRecord?: string
  mortarConcreteSampleRecord?: string
  materialEquipmentRecord?: string
  siteAppearanceRecord?: string
  overtimeRecord?: string
  otherRecord?: string
  reporter?: string
  siteLeader?: string
  constructionLog?: string
  yearMonth?: string
  tasks?: Array<{
    linkedPlanTaskId: string | null
    taskName: string
    plannedVolume: string | number
    completedVolume: string | number
    unit: string
    selections: Array<{ modelId: string; applicationIds: string[] }>
  }>
  workers?: string[]
}

export type ProgressElementSnapshotStatus =
  | 'not_started'
  | 'ready_not_started'
  | 'delayed_not_started'
  | 'in_progress'
  | 'in_progress_delayed'
  | 'finished_ahead'
  | 'finished_on_time'
  | 'finished_delayed'

export type ProgressTaskSnapshotStatus =
  | 'no_bim_link'
  | 'not_started'
  | 'in_progress'
  | 'delayed'
  | 'finished_on_time'
  | 'finished_delayed'

export type ProgressElementSnapshot = {
  id: string
  projectId: string
  modelId: string
  applicationId: string
  plannedStartAt: string | null
  plannedFinishAt: string | null
  actualStartAt: string | null
  actualFinishAt: string | null
  progressStatus: ProgressElementSnapshotStatus
  progressPercent: number | null
  isAheadStart: boolean
  isDelayedFinish: boolean
  lastReportAt: string | null
  createdAt: string
  updatedAt: string
}

export type ProgressTaskSnapshot = {
  id: string
  projectId: string
  taskId: string
  taskName: string
  wbs: string | null
  totalElementCount: number
  finishedElementCount: number
  inProgressElementCount: number
  notStartedElementCount: number
  delayedElementCount: number
  completionRate: number
  plannedStartAt: string | null
  plannedFinishAt: string | null
  actualStartAt: string | null
  actualFinishAt: string | null
  taskStatus: ProgressTaskSnapshotStatus
  lastCalculatedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ProgressListMeta = {
  total: number
  page: number
  limit: number
}

export type ProgressStatistics = {
  totalElements: number
  finishedElements: number
  inProgressElements: number
  notStartedElements: number
  inProgressDelayedElements: number
  readyNotStartedElements: number
  delayedNotStartedElements: number
  finishedAheadElements: number
  finishedOnTimeElements: number
  finishedDelayedElements: number
  aheadStartElements: number
  delayedFinishElements: number
  totalTasks: number
  finishedTasks: number
  delayedTasks: number
  inProgressTasks: number
  notStartedTasks: number
  completionRate: number
}

export type RebuildProgressSnapshotsSummary = {
  status: 'completed'
  planTaskCount: number
  actualRecordCount: number
  affectedElementCount: number
  rebuiltTaskSnapshotCount: number
}

const parseUnknownError = (error: unknown) => {
  if (error instanceof Error) return error.message

  const maybeData = (error as { data?: { error?: string | { message?: string } } })
    ?.data
  const nestedError = maybeData?.error
  if (typeof nestedError === 'string') return nestedError
  if (typeof nestedError?.message === 'string') return nestedError.message

  return '请求失败'
}

export async function getLatestProgressPlanFile(params: {
  projectId: string
  apiOrigin: string
}) {
  const { projectId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: ProgressPlanFile | null }>(
      new URL(`/api/v1/projects/${projectId}/progress/plan-file`, apiOrigin).toString(),
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        }
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function uploadProgressPlanFile(
  params: {
    projectId: string
    file: File
    apiOrigin: string
  },
  callbacks?: Partial<{
    onProgress: (percentage: number) => void
  }>
) {
  const { projectId, file, apiOrigin } = params
  const { onProgress } = callbacks || {}

  const data = new FormData()
  const formKey = 'file'
  data.append(formKey, file)

  try {
    onProgress?.(0)

    const uploadPayload = await $fetch<PostBlobResponse>(
      new URL(`/api/stream/${projectId}/blob`, apiOrigin).toString(),
      {
        method: 'POST',
        body: data
      }
    )
    const uploadResults =
      (uploadPayload as Optional<PostBlobResponse>)?.uploadResults || []
    const result = uploadResults.find((r) => r.formKey === formKey)

    if (!result?.blobId) {
      throw new Error(result?.uploadError || '文件上传后未返回 blobId')
    }

    const payload = await $fetch<ProgressPlanUploadResult>(
      new URL(`/api/v1/projects/${projectId}/progress/plan-file`, apiOrigin).toString(),
      {
        method: 'POST',
        body: {
          blobId: result.blobId,
          fileName: result.fileName || file.name,
          fileType: 'mpp',
          fileSize: result.fileSize || file.size || null
        }
      }
    )

    onProgress?.(100)
    return payload
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getProgressPlanTasks(params: {
  projectId: string
  apiOrigin: string
}) {
  const { projectId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: ProgressPlanTask[] }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/plan-tasks`,
        apiOrigin
      ).toString(),
      {
        method: 'GET'
      }
    )
    return payload.data || []
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressPlanTaskBimAssociation(params: {
  projectId: string
  taskId: string
  BIM?: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  apiOrigin: string
}) {
  const { projectId, taskId, BIM, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: ProgressPlanTask }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/plan-tasks/${taskId}/bim-association`,
        apiOrigin
      ).toString(),
      {
        method: 'PUT',
        body: {
          BIM: BIM || []
        }
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressPlanTaskMarker(params: {
  projectId: string
  taskId: string
  milestoneType?: ProgressPlanTaskMilestoneType | null
  milestoneDescription?: string | null
  isCriticalTask?: boolean
  apiOrigin: string
}) {
  const {
    projectId,
    taskId,
    milestoneType,
    milestoneDescription,
    isCriticalTask,
    apiOrigin
  } = params
  try {
    const payload = await $fetch<{ data: ProgressPlanTask }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/plan-tasks/${taskId}/marker`,
        apiOrigin
      ).toString(),
      {
        method: 'PUT',
        body: {
          milestoneType: milestoneType ?? null,
          milestoneDescription: milestoneDescription ?? null,
          isCriticalTask: !!isCriticalTask
        }
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getActualProgressRecords(params: {
  projectId: string
  apiOrigin: string
}) {
  const { projectId, apiOrigin } = params
  try {
    const payload = await $fetch<{
      data: Array<
        Record<string, unknown> & {
          startBIM?: ActualProgressRecordBimSelection[]
          BIM?: ActualProgressRecordBimSelection[]
          finishBIM?: ActualProgressRecordBimSelection[]
        }
      >
    }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/actual-records`,
        apiOrigin
      ).toString(),
      {
        method: 'GET'
      }
    )
    const records = payload.data || []
    return records.map((record) => {
      const startBIM = record.startBIM || record.BIM || []
      const finishBIM = record.finishBIM || []

      const startModelIds = [...new Set(startBIM.map((e) => e.modelId))]
      const startApplicationIds = startBIM.flatMap((e) => e.applicationIds)
      const startSelections = startBIM.map((e) => ({
        modelId: e.modelId,
        applicationIds: e.applicationIds
      }))

      const finishModelIds = [...new Set(finishBIM.map((e) => e.modelId))]
      const finishApplicationIds = finishBIM.flatMap((e) => e.applicationIds)
      const finishSelections = finishBIM.map((e) => ({
        modelId: e.modelId,
        applicationIds: e.applicationIds
      }))

      return {
        ...record,
        startModelIds,
        startApplicationIds,
        startSelections,
        finishModelIds,
        finishApplicationIds,
        finishSelections
      } as unknown as ActualProgressRecord
    })
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function createActualProgressRecord(params: {
  projectId: string
  apiOrigin: string
  input: ActualProgressRecordInput
}) {
  const { projectId, apiOrigin, input } = params
  try {
    const payload = await $fetch<{ data: ActualProgressRecord }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/actual-records`,
        apiOrigin
      ).toString(),
      {
        method: 'POST',
        body: input
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function importActualProgressRecordsFromExcel(params: {
  projectId: string
  apiOrigin: string
  file: File
}) {
  const { projectId, apiOrigin, file } = params

  const data = new FormData()
  const formKey = 'file'
  data.append(formKey, file)

  try {
    const uploadPayload = await $fetch<PostBlobResponse>(
      new URL(`/api/stream/${projectId}/blob`, apiOrigin).toString(),
      {
        method: 'POST',
        body: data
      }
    )
    const uploadResults =
      (uploadPayload as Optional<PostBlobResponse>)?.uploadResults || []
    const result = uploadResults.find((r) => r.formKey === formKey)

    if (!result?.blobId) {
      throw new Error(result?.uploadError || '文件上传后未返回 blobId')
    }

    const payload = await $fetch<{ data: { createdCount: number } }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/actual-records/import`,
        apiOrigin
      ).toString(),
      {
        method: 'POST',
        body: {
          blobId: result.blobId,
          fileName: result.fileName || file.name
        }
      }
    )

    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateActualProgressRecord(params: {
  projectId: string
  recordId: string
  apiOrigin: string
  input: ActualProgressRecordInput
}) {
  const { projectId, recordId, apiOrigin, input } = params
  try {
    const payload = await $fetch<{ data: ActualProgressRecord }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/actual-records/${recordId}`,
        apiOrigin
      ).toString(),
      {
        method: 'PUT',
        body: input
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function deleteActualProgressRecord(params: {
  projectId: string
  recordId: string
  apiOrigin: string
}) {
  const { projectId, recordId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: { id: string } }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/actual-records/${recordId}`,
        apiOrigin
      ).toString(),
      {
        method: 'DELETE'
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getProgressElementSnapshots(params: {
  projectId: string
  apiOrigin: string
  modelId?: string
  progressStatus?: ProgressElementSnapshotStatus
  page?: number
  limit?: number
}) {
  const { projectId, apiOrigin, modelId, progressStatus, page, limit } = params
  try {
    const url = new URL(
      `/api/v1/projects/${projectId}/progress/element-snapshots`,
      apiOrigin
    )
    if (modelId) url.searchParams.set('modelId', modelId)
    if (progressStatus) url.searchParams.set('progressStatus', progressStatus)
    if (page) url.searchParams.set('page', String(page))
    if (limit) url.searchParams.set('limit', String(limit))

    const payload = await $fetch<{
      data: ProgressElementSnapshot[]
      meta: ProgressListMeta
    }>(url.toString(), {
      method: 'GET'
    })
    return payload
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getProgressTaskSnapshots(params: {
  projectId: string
  apiOrigin: string
  taskStatus?: ProgressTaskSnapshotStatus
  keyword?: string
  page?: number
  limit?: number
}) {
  const { projectId, apiOrigin, taskStatus, keyword, page, limit } = params
  try {
    const url = new URL(
      `/api/v1/projects/${projectId}/progress/task-snapshots`,
      apiOrigin
    )
    if (taskStatus) url.searchParams.set('taskStatus', taskStatus)
    if (keyword) url.searchParams.set('keyword', keyword)
    if (page) url.searchParams.set('page', String(page))
    if (limit) url.searchParams.set('limit', String(limit))

    const payload = await $fetch<{
      data: ProgressTaskSnapshot[]
      meta: ProgressListMeta
    }>(url.toString(), {
      method: 'GET'
    })
    return payload
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getProgressStatistics(params: {
  projectId: string
  apiOrigin: string
}) {
  const { projectId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: ProgressStatistics }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/statistics`,
        apiOrigin
      ).toString(),
      {
        method: 'GET'
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function rebuildProgressSnapshots(params: {
  projectId: string
  apiOrigin: string
}) {
  const { projectId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: RebuildProgressSnapshotsSummary }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/rebuild-snapshots`,
        apiOrigin
      ).toString(),
      {
        method: 'POST'
      }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

const parseFileNameFromDisposition = (
  headerValue: string | null,
  fallbackName: string
) => {
  if (!headerValue) return fallbackName

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const asciiMatch = headerValue.match(/filename="?([^"]+)"?/i)
  return asciiMatch?.[1] || fallbackName
}

export async function downloadLatestProgressPlanFile(params: {
  projectId: string
  apiOrigin: string
  fallbackFileName?: string
}) {
  const { projectId, apiOrigin, fallbackFileName = 'progress-plan.xml' } = params
  try {
    const response = await $fetch.raw<Blob>(
      new URL(
        `/api/v1/projects/${projectId}/progress/plan-file/download`,
        apiOrigin
      ).toString(),
      {
        method: 'GET',
        responseType: 'blob'
      }
    )

    const blob = response._data
    if (!blob) {
      throw new Error('下载失败，服务端未返回文件内容')
    }
    const fileName = parseFileNameFromDisposition(
      response.headers.get('content-disposition'),
      fallbackFileName
    )
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export type MonthlyPlanTaskItem = {
  id?: string
  taskName: string
  linkedPlanTaskId?: string | null
  linkedPlanTaskName?: string | null
  startDate: string | null
  endDate: string | null
  totalVolume: string | null
  unit: string | null
  plannedVolume: string | null
  actualVolume: string | null
  progressPercent?: number
  remark?: string | null
  bimComponentCount?: number
  bimLinked?: boolean
  selections?: Array<{ modelId: string; applicationIds: string[] }> | null
}

export type MonthlyRecordItem = {
  id: string
  projectId: string
  yearMonth: string
  createdBy: string
  createdAt: string
  updatedAt: string
  tasks: MonthlyPlanTaskItem[]
}

export async function getProgressMonthlyPlans(params: {
  projectId: string
  apiOrigin: string
}): Promise<MonthlyRecordItem[]> {
  const { projectId, apiOrigin } = params
  try {
    const response = await $fetch<{ data: MonthlyRecordItem[] }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/monthly-plans`,
        apiOrigin
      ).toString(),
      {
        method: 'GET'
      }
    )
    return response.data || []
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function createProgressMonthlyPlan(params: {
  projectId: string
  apiOrigin: string
  input: {
    yearMonth: string
    createdBy: string
    tasks: Omit<MonthlyPlanTaskItem, 'id' | 'createdAt' | 'updatedAt'>[]
  }
}): Promise<MonthlyRecordItem> {
  const { projectId, apiOrigin, input } = params
  try {
    const response = await $fetch<{ data: MonthlyRecordItem }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/monthly-plans`,
        apiOrigin
      ).toString(),
      {
        method: 'POST',
        body: input
      }
    )
    return response.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressMonthlyPlan(params: {
  projectId: string
  planId: string
  apiOrigin: string
  input: {
    yearMonth: string
    createdBy: string
    tasks: Partial<MonthlyPlanTaskItem>[]
  }
}): Promise<MonthlyRecordItem> {
  const { projectId, planId, apiOrigin, input } = params
  try {
    const response = await $fetch<{ data: MonthlyRecordItem }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/monthly-plans/${planId}`,
        apiOrigin
      ).toString(),
      {
        method: 'PUT',
        body: input
      }
    )
    return response.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function deleteProgressMonthlyPlan(params: {
  projectId: string
  planId: string
  apiOrigin: string
}): Promise<boolean> {
  const { projectId, planId, apiOrigin } = params
  try {
    await $fetch<{ data: { id: string } }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/monthly-plans/${planId}`,
        apiOrigin
      ).toString(),
      {
        method: 'DELETE'
      }
    )
    return true
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateMonthlyPlanTaskBimAssociation(params: {
  projectId: string
  planId: string
  taskId: string
  apiOrigin: string
  selections: Array<{ modelId: string; applicationIds: string[] }>
}): Promise<MonthlyPlanTaskItem> {
  const { projectId, planId, taskId, apiOrigin, selections } = params
  try {
    const response = await $fetch<{ data: MonthlyPlanTaskItem }>(
      new URL(
        `/api/v1/projects/${projectId}/progress/monthly-plans/${planId}/tasks/${taskId}/bim-association`,
        apiOrigin
      ).toString(),
      {
        method: 'PUT',
        body: { selections }
      }
    )
    return response.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// ---------------------------------------------------------------------------
// 年度计划 (Annual Plan)
// ---------------------------------------------------------------------------

export type AnnualPlan = {
  id: string
  projectId: string
  year: number
  name: string
  startDate: string
  endDate: string
  preparedBy: string | null
  blobId: string | null
  fileName: string | null
  fileSize: number | string | null
  remark: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type AnnualPlanInput = {
  year: number
  name: string
  startDate: string
  endDate: string
  preparedBy?: string | null
  blobId?: string | null
  fileName?: string | null
  fileSize?: number | string | null
  remark?: string | null
}

const annualPlansBaseUrl = (projectId: string) =>
  `/api/v1/projects/${projectId}/progress/annual-plans`

export async function getProgressAnnualPlans(params: {
  projectId: string
  apiOrigin: string
  search?: string
}): Promise<AnnualPlan[]> {
  const { projectId, apiOrigin, search } = params
  try {
    const url = new URL(annualPlansBaseUrl(projectId), apiOrigin)
    if (search && search.trim()) url.searchParams.set('search', search.trim())
    const response = await $fetch<{ data: AnnualPlan[] }>(url.toString(), {
      method: 'GET',
      cache: 'no-store'
    })
    return response.data || []
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getProgressAnnualPlan(params: {
  projectId: string
  planId: string
  apiOrigin: string
}): Promise<AnnualPlan> {
  const { projectId, planId, apiOrigin } = params
  try {
    const response = await $fetch<{ data: AnnualPlan }>(
      new URL(`${annualPlansBaseUrl(projectId)}/${planId}`, apiOrigin).toString(),
      {
        method: 'GET',
        cache: 'no-store'
      }
    )
    return response.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function createProgressAnnualPlan(params: {
  projectId: string
  apiOrigin: string
  input: AnnualPlanInput
}): Promise<AnnualPlan> {
  const { projectId, apiOrigin, input } = params
  try {
    const response = await $fetch<{ data: AnnualPlan }>(
      new URL(annualPlansBaseUrl(projectId), apiOrigin).toString(),
      {
        method: 'POST',
        body: input
      }
    )
    return response.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressAnnualPlan(params: {
  projectId: string
  planId: string
  apiOrigin: string
  input: AnnualPlanInput
}): Promise<AnnualPlan> {
  const { projectId, planId, apiOrigin, input } = params
  try {
    const response = await $fetch<{ data: AnnualPlan }>(
      new URL(`${annualPlansBaseUrl(projectId)}/${planId}`, apiOrigin).toString(),
      {
        method: 'PUT',
        body: input
      }
    )
    return response.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function deleteProgressAnnualPlan(params: {
  projectId: string
  planId: string
  apiOrigin: string
}): Promise<boolean> {
  const { projectId, planId, apiOrigin } = params
  try {
    await $fetch<{ data: { id: string } }>(
      new URL(`${annualPlansBaseUrl(projectId)}/${planId}`, apiOrigin).toString(),
      {
        method: 'DELETE'
      }
    )
    return true
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getLatestProgressAnnualPlanFile(params: {
  projectId: string
  planId: string
  apiOrigin: string
}): Promise<ProgressPlanFile | null> {
  const { projectId, planId, apiOrigin } = params
  try {
    const response = await $fetch<{ data: ProgressPlanFile | null }>(
      new URL(
        `${annualPlansBaseUrl(projectId)}/${planId}/plan-files`,
        apiOrigin
      ).toString(),
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        }
      }
    )
    return response.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function uploadProgressAnnualPlanFile(
  params: {
    projectId: string
    planId: string
    file: File
    apiOrigin: string
  },
  callbacks?: Partial<{
    onProgress: (percentage: number) => void
  }>
) {
  const { projectId, planId, file, apiOrigin } = params
  const { onProgress } = callbacks || {}

  const data = new FormData()
  const formKey = 'file'
  data.append(formKey, file)

  try {
    onProgress?.(0)

    const uploadPayload = await $fetch<PostBlobResponse>(
      new URL(`/api/stream/${projectId}/blob`, apiOrigin).toString(),
      {
        method: 'POST',
        body: data
      }
    )
    const uploadResults =
      (uploadPayload as Optional<PostBlobResponse>)?.uploadResults || []
    const result = uploadResults.find((r) => r.formKey === formKey)

    if (!result?.blobId) {
      throw new Error(result?.uploadError || '文件上传后未返回 blobId')
    }

    const payload = await $fetch<ProgressPlanUploadResult>(
      new URL(
        `${annualPlansBaseUrl(projectId)}/${planId}/plan-files`,
        apiOrigin
      ).toString(),
      {
        method: 'POST',
        body: {
          blobId: result.blobId,
          fileName: result.fileName || file.name,
          fileType: 'mpp',
          fileSize: result.fileSize || file.size || null
        }
      }
    )

    onProgress?.(100)
    return payload
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function downloadProgressAnnualPlanFile(params: {
  projectId: string
  planId: string
  apiOrigin: string
  fallbackFileName?: string
}) {
  const {
    projectId,
    planId,
    apiOrigin,
    fallbackFileName = 'progress-plan.xml'
  } = params
  try {
    const response = await $fetch.raw<Blob>(
      new URL(
        `${annualPlansBaseUrl(projectId)}/${planId}/plan-files/download`,
        apiOrigin
      ).toString(),
      {
        method: 'GET',
        responseType: 'blob'
      }
    )

    const blob = response._data
    if (!blob) {
      throw new Error('下载失败，服务端未返回文件内容')
    }
    const fileName = parseFileNameFromDisposition(
      response.headers.get('content-disposition'),
      fallbackFileName
    )
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getProgressAnnualPlanTasks(params: {
  projectId: string
  planId: string
  apiOrigin: string
}): Promise<ProgressPlanTask[]> {
  const { projectId, planId, apiOrigin } = params
  try {
    const response = await $fetch<{ data: ProgressPlanTask[] }>(
      new URL(
        `${annualPlansBaseUrl(projectId)}/${planId}/plan-tasks`,
        apiOrigin
      ).toString(),
      {
        method: 'GET'
      }
    )
    return response.data || []
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressAnnualPlanTaskBimAssociation(params: {
  projectId: string
  planId: string
  taskId: string
  BIM?: Array<{
    modelId: string
    applicationIds: string[]
    bimIds: (string | null)[]
  }> | null
  apiOrigin: string
}): Promise<ProgressPlanTask> {
  const { projectId, planId, taskId, BIM, apiOrigin } = params
  try {
    const response = await $fetch<{ data: ProgressPlanTask }>(
      new URL(
        `${annualPlansBaseUrl(projectId)}/${planId}/tasks/${taskId}/bim-association`,
        apiOrigin
      ).toString(),
      {
        method: 'PUT',
        body: {
          BIM: BIM || []
        }
      }
    )
    return response.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressAnnualPlanTaskMarker(params: {
  projectId: string
  planId: string
  taskId: string
  milestoneType?: ProgressPlanTaskMilestoneType | null
  milestoneDescription?: string | null
  isCriticalTask?: boolean
  apiOrigin: string
}): Promise<ProgressPlanTask> {
  const {
    projectId,
    planId,
    taskId,
    milestoneType,
    milestoneDescription,
    isCriticalTask,
    apiOrigin
  } = params
  try {
    const response = await $fetch<{ data: ProgressPlanTask }>(
      new URL(
        `${annualPlansBaseUrl(projectId)}/${planId}/tasks/${taskId}/marker`,
        apiOrigin
      ).toString(),
      {
        method: 'PUT',
        body: {
          milestoneType: milestoneType ?? null,
          milestoneDescription: milestoneDescription ?? null,
          isCriticalTask: !!isCriticalTask
        }
      }
    )
    return response.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}
