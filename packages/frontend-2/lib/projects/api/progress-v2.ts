import type { Optional } from '@speckle/shared'
import type { PostBlobResponse } from '~~/lib/core/api/blobStorage'

export type ProgressV2PlanFile = {
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

export type ProgressV2PlanTask = {
  id: string
  projectId: string
  planFileId: string | null
  externalId: string | null
  sysTaskId: string | null
  quantity: string | null
  unit: string | null
  wbs: string | null
  name: string
  taskName?: string
  parentId: string | null
  level: number
  sortOrder: number
  duration: string | null
  planStart: string | null
  planEnd: string | null
  startDate?: string | null
  endDate?: string | null
  predecessor: string | null
  creator: string
  updater: string
  createdAt: string
  updatedAt: string
  hasChildren?: boolean
  children?: ProgressV2PlanTask[]
}

export type ProgressV2AnnualPlan = {
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

export type ProgressV2AnnualPlanTask = {
  id: string
  projectId: string
  annualPlanId: string
  externalId: string | null
  sysTaskId: string | null
  quantity: string | null
  unit: string | null
  wbs: string | null
  name: string
  taskName?: string
  parentId: string | null
  level: number
  sortOrder: number
  duration: string | null
  planStart: string | null
  planEnd: string | null
  startDate?: string | null
  endDate?: string | null
  predecessor: string | null
  creator: string
  updater: string
  createdAt: string
  updatedAt: string
  hasChildren?: boolean
  children?: ProgressV2AnnualPlanTask[]
}

export type MonthlyPlanTaskItem = {
  id: string
  taskName: string
  startDate?: string | null
  endDate?: string | null
  plannedVolume?: string | null
  actualVolume?: string | null
  unit?: string | null
  progressPercent?: number
  responsible?: string | null
  remark?: string | null
}

export type ProgressV2MonthlyPlan = {
  id: string
  projectId: string
  yearMonth: string
  title: string | null
  remark: string | null
  tasks: MonthlyPlanTaskItem[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ProgressV2ActualRecord = {
  id: string
  projectId: string
  taskName: string
  sectionName: string | null
  reportDate: string
  actualStartDate: string | null
  actualEndDate: string | null
  progressPercent: number
  weather: string | null
  highTemperature: string | null
  lowTemperature: string | null
  constructionRecord: string | null
  qualityRecord: string | null
  safetyRecord: string | null
  reporter: string | null
  remark: string | null
  creator: string
  updater: string
  createdAt: string
  updatedAt: string
}

export type ProgressV2Milestone = {
  id: string
  projectId: string
  taskName: string
  plannedStart: string | null
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  status: string
  milestoneType: string | null
  responsible: string | null
  remark: string | null
  tags: string[]
  creator: string
  updater: string
  createdAt: string
  updatedAt: string
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

// ==========================================
// 1. 总进度计划 Plan File & Tasks
// ==========================================
export async function getLatestProgressV2PlanFile(params: {
  projectId: string
  apiOrigin: string
}) {
  const { projectId, apiOrigin } = params
  try {
    const payload = await $fetch<{ data: ProgressV2PlanFile | null }>(
      new URL(`/api/v1/projects/${projectId}/progress-v2/plan-file`, apiOrigin).toString(),
      { method: 'GET', cache: 'no-store' }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function uploadProgressV2PlanFile(
  params: {
    projectId: string
    file: File
    apiOrigin: string
  },
  callbacks?: { onProgress?: (percentage: number) => void }
) {
  const { projectId, file, apiOrigin } = params
  const { onProgress } = callbacks || {}
  const data = new FormData()
  data.append('file', file)

  try {
    onProgress?.(10)
    const uploadPayload = await $fetch<PostBlobResponse>(
      new URL(`/api/stream/${projectId}/blob`, apiOrigin).toString(),
      { method: 'POST', body: data }
    )
    const uploadResults = (uploadPayload as Optional<PostBlobResponse>)?.uploadResults || []
    const result = uploadResults.find((r) => r.formKey === 'file')
    if (!result?.blobId) throw new Error('上传计划文件到对象存储失败')

    onProgress?.(50)
    const payload = await $fetch<{
      success: boolean
      data: { planFile: ProgressV2PlanFile; taskCount: number }
    }>(
      new URL(`/api/v1/projects/${projectId}/progress-v2/plan-file`, apiOrigin).toString(),
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
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getProgressV2PlanTasks(params: {
  projectId: string
  apiOrigin: string
}): Promise<ProgressV2PlanTask[]> {
  const { projectId, apiOrigin } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2PlanTask[] }>(
      new URL(`/api/v1/projects/${projectId}/progress-v2/plan-tasks`, apiOrigin).toString(),
      { method: 'GET', cache: 'no-store' }
    )
    return (payload.data || []).map((t) => ({
      ...t,
      taskName: t.name,
      startDate: t.planStart ? t.planStart.slice(0, 10) : '',
      endDate: t.planEnd ? t.planEnd.slice(0, 10) : ''
    }))
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export function getProgressV2PlanFileDownloadUrl(params: {
  projectId: string
  apiOrigin: string
}): string {
  return new URL(
    `/api/v1/projects/${params.projectId}/progress-v2/plan-file/download`,
    params.apiOrigin
  ).toString()
}

// ==========================================
// 2. 年度计划 Annual Plans & Tasks
// ==========================================
export async function listProgressV2AnnualPlans(params: {
  projectId: string
  apiOrigin: string
  year?: number
}): Promise<ProgressV2AnnualPlan[]> {
  const { projectId, apiOrigin, year } = params
  try {
    const url = new URL(`/api/v1/projects/${projectId}/progress-v2/annual-plans`, apiOrigin)
    if (year) url.searchParams.set('year', String(year))
    const payload = await $fetch<{ success: boolean; data: ProgressV2AnnualPlan[] }>(
      url.toString(),
      { method: 'GET', cache: 'no-store' }
    )
    return payload.data || []
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function createProgressV2AnnualPlan(params: {
  projectId: string
  apiOrigin: string
  data: {
    year: number
    name: string
    startDate: string
    endDate: string
    preparedBy?: string | null
    remark?: string | null
  }
}) {
  const { projectId, apiOrigin, data } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2AnnualPlan }>(
      new URL(`/api/v1/projects/${projectId}/progress-v2/annual-plans`, apiOrigin).toString(),
      { method: 'POST', body: data }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressV2AnnualPlan(params: {
  projectId: string
  annualPlanId: string
  apiOrigin: string
  data: Partial<{
    year: number
    name: string
    startDate: string
    endDate: string
    preparedBy: string | null
    remark: string | null
  }>
}) {
  const { projectId, annualPlanId, apiOrigin, data } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2AnnualPlan }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/annual-plans/${annualPlanId}`,
        apiOrigin
      ).toString(),
      { method: 'PUT', body: data }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function deleteProgressV2AnnualPlan(params: {
  projectId: string
  annualPlanId: string
  apiOrigin: string
}) {
  const { projectId, annualPlanId, apiOrigin } = params
  try {
    const payload = await $fetch<{ success: boolean }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/annual-plans/${annualPlanId}`,
        apiOrigin
      ).toString(),
      { method: 'DELETE' }
    )
    return payload.success
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function uploadProgressV2AnnualPlanFile(
  params: {
    projectId: string
    annualPlanId: string
    file: File
    apiOrigin: string
  },
  callbacks?: { onProgress?: (percentage: number) => void }
) {
  const { projectId, annualPlanId, file, apiOrigin } = params
  const { onProgress } = callbacks || {}
  const data = new FormData()
  data.append('file', file)

  try {
    onProgress?.(10)
    const uploadPayload = await $fetch<PostBlobResponse>(
      new URL(`/api/stream/${projectId}/blob`, apiOrigin).toString(),
      { method: 'POST', body: data }
    )
    const uploadResults = (uploadPayload as Optional<PostBlobResponse>)?.uploadResults || []
    const result = uploadResults.find((r) => r.formKey === 'file')
    if (!result?.blobId) throw new Error('上传文件到对象存储失败')

    onProgress?.(50)
    const payload = await $fetch<{
      success: boolean
      data: { annualPlanId: string; taskCount: number }
    }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/annual-plans/${annualPlanId}/plan-file`,
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
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function getProgressV2AnnualPlanTasks(params: {
  projectId: string
  annualPlanId: string
  apiOrigin: string
}): Promise<ProgressV2AnnualPlanTask[]> {
  const { projectId, annualPlanId, apiOrigin } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2AnnualPlanTask[] }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/annual-plans/${annualPlanId}/tasks`,
        apiOrigin
      ).toString(),
      { method: 'GET', cache: 'no-store' }
    )
    return (payload.data || []).map((t) => ({
      ...t,
      taskName: t.name,
      startDate: t.planStart ? t.planStart.slice(0, 10) : '',
      endDate: t.planEnd ? t.planEnd.slice(0, 10) : ''
    }))
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// ==========================================
// 3. 月度计划 Monthly Plans
// ==========================================
export async function listProgressV2MonthlyPlans(params: {
  projectId: string
  apiOrigin: string
}): Promise<ProgressV2MonthlyPlan[]> {
  const { projectId, apiOrigin } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2MonthlyPlan[] }>(
      new URL(`/api/v1/projects/${projectId}/progress-v2/monthly-plans`, apiOrigin).toString(),
      { method: 'GET', cache: 'no-store' }
    )
    return (payload.data || []).map((item) => ({
      ...item,
      tasks: typeof item.tasks === 'string' ? JSON.parse(item.tasks) : item.tasks || []
    }))
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function createProgressV2MonthlyPlan(params: {
  projectId: string
  apiOrigin: string
  data: {
    yearMonth: string
    title?: string | null
    remark?: string | null
    tasks?: MonthlyPlanTaskItem[]
  }
}) {
  const { projectId, apiOrigin, data } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2MonthlyPlan }>(
      new URL(`/api/v1/projects/${projectId}/progress-v2/monthly-plans`, apiOrigin).toString(),
      { method: 'POST', body: data }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressV2MonthlyPlan(params: {
  projectId: string
  monthlyPlanId: string
  apiOrigin: string
  data: {
    title?: string | null
    remark?: string | null
    tasks?: MonthlyPlanTaskItem[]
  }
}) {
  const { projectId, monthlyPlanId, apiOrigin, data } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2MonthlyPlan }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/monthly-plans/${monthlyPlanId}`,
        apiOrigin
      ).toString(),
      { method: 'PUT', body: data }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function deleteProgressV2MonthlyPlan(params: {
  projectId: string
  monthlyPlanId: string
  apiOrigin: string
}) {
  const { projectId, monthlyPlanId, apiOrigin } = params
  try {
    const payload = await $fetch<{ success: boolean }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/monthly-plans/${monthlyPlanId}`,
        apiOrigin
      ).toString(),
      { method: 'DELETE' }
    )
    return payload.success
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// ==========================================
// 4. 进度管理 Actual Records
// ==========================================
export async function listProgressV2ActualRecords(params: {
  projectId: string
  apiOrigin: string
  search?: string
}): Promise<ProgressV2ActualRecord[]> {
  const { projectId, apiOrigin, search } = params
  try {
    const url = new URL(`/api/v1/projects/${projectId}/progress-v2/actual-records`, apiOrigin)
    if (search) url.searchParams.set('search', search)
    const payload = await $fetch<{ success: boolean; data: ProgressV2ActualRecord[] }>(
      url.toString(),
      { method: 'GET', cache: 'no-store' }
    )
    return payload.data || []
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function createProgressV2ActualRecord(params: {
  projectId: string
  apiOrigin: string
  data: {
    taskName: string
    sectionName?: string | null
    reportDate: string
    actualStartDate?: string | null
    actualEndDate?: string | null
    progressPercent?: number
    weather?: string | null
    highTemperature?: string | null
    lowTemperature?: string | null
    constructionRecord?: string | null
    qualityRecord?: string | null
    safetyRecord?: string | null
    reporter?: string | null
    remark?: string | null
  }
}) {
  const { projectId, apiOrigin, data } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2ActualRecord }>(
      new URL(`/api/v1/projects/${projectId}/progress-v2/actual-records`, apiOrigin).toString(),
      { method: 'POST', body: data }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressV2ActualRecord(params: {
  projectId: string
  recordId: string
  apiOrigin: string
  data: Partial<{
    taskName: string
    sectionName: string | null
    reportDate: string
    actualStartDate: string | null
    actualEndDate: string | null
    progressPercent: number
    weather: string | null
    highTemperature: string | null
    lowTemperature: string | null
    constructionRecord: string | null
    qualityRecord: string | null
    safetyRecord: string | null
    reporter: string | null
    remark: string | null
  }>
}) {
  const { projectId, recordId, apiOrigin, data } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2ActualRecord }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/actual-records/${recordId}`,
        apiOrigin
      ).toString(),
      { method: 'PUT', body: data }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function deleteProgressV2ActualRecord(params: {
  projectId: string
  recordId: string
  apiOrigin: string
}) {
  const { projectId, recordId, apiOrigin } = params
  try {
    const payload = await $fetch<{ success: boolean }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/actual-records/${recordId}`,
        apiOrigin
      ).toString(),
      { method: 'DELETE' }
    )
    return payload.success
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

// ==========================================
// 5. 里程碑管理 Milestones
// ==========================================
export async function listProgressV2Milestones(params: {
  projectId: string
  apiOrigin: string
  search?: string
}): Promise<ProgressV2Milestone[]> {
  const { projectId, apiOrigin, search } = params
  try {
    const url = new URL(`/api/v1/projects/${projectId}/progress-v2/milestones`, apiOrigin)
    if (search) url.searchParams.set('search', search)
    const payload = await $fetch<{ success: boolean; data: ProgressV2Milestone[] }>(
      url.toString(),
      { method: 'GET', cache: 'no-store' }
    )
    return (payload.data || []).map((item) => ({
      ...item,
      tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags || []
    }))
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function createProgressV2Milestone(params: {
  projectId: string
  apiOrigin: string
  data: {
    taskName: string
    plannedStart?: string | null
    plannedEnd?: string | null
    actualStart?: string | null
    actualEnd?: string | null
    status?: string
    milestoneType?: string | null
    responsible?: string | null
    remark?: string | null
    tags?: string[]
  }
}) {
  const { projectId, apiOrigin, data } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2Milestone }>(
      new URL(`/api/v1/projects/${projectId}/progress-v2/milestones`, apiOrigin).toString(),
      { method: 'POST', body: data }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function updateProgressV2Milestone(params: {
  projectId: string
  milestoneId: string
  apiOrigin: string
  data: Partial<{
    taskName: string
    plannedStart: string | null
    plannedEnd: string | null
    actualStart: string | null
    actualEnd: string | null
    status: string
    milestoneType: string | null
    responsible: string | null
    remark: string | null
    tags: string[]
  }>
}) {
  const { projectId, milestoneId, apiOrigin, data } = params
  try {
    const payload = await $fetch<{ success: boolean; data: ProgressV2Milestone }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/milestones/${milestoneId}`,
        apiOrigin
      ).toString(),
      { method: 'PUT', body: data }
    )
    return payload.data
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}

export async function deleteProgressV2Milestone(params: {
  projectId: string
  milestoneId: string
  apiOrigin: string
}) {
  const { projectId, milestoneId, apiOrigin } = params
  try {
    const payload = await $fetch<{ success: boolean }>(
      new URL(
        `/api/v1/projects/${projectId}/progress-v2/milestones/${milestoneId}`,
        apiOrigin
      ).toString(),
      { method: 'DELETE' }
    )
    return payload.success
  } catch (error) {
    throw new Error(parseUnknownError(error))
  }
}
