import type {
  RvtConversionJob,
  RvtConversionJobStatus
} from '~/lib/projects/composables/useRvtConversion'

export type PersistedRvtJob = {
  id: string
  projectId: string
  modelId: string
  sourceFileName: string
  status: RvtConversionJobStatus
  versionId: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

type PersistedRvtJobsState = {
  jobs: PersistedRvtJob[]
}

const stateKey = 'rvt-active-jobs'

const createInitialState = (): PersistedRvtJobsState => ({
  jobs: []
})

const toPersistedJob = (job: RvtConversionJob): PersistedRvtJob => ({
  id: job.id,
  projectId: job.projectId,
  modelId: job.modelId,
  sourceFileName: job.sourceFileName,
  status: job.status,
  versionId: job.versionId,
  errorMessage: job.errorMessage,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt
})

export const useRvtPendingJobs = () => {
  const jobsState = useState<PersistedRvtJobsState>(stateKey, createInitialState)

  const jobs = computed(() => jobsState.value.jobs || [])

  const upsertJob = (job: RvtConversionJob | PersistedRvtJob) => {
    const persisted = 'sourceFileName' in job ? job : toPersistedJob(job)
    const existingIndex = jobs.value.findIndex((item) => item.id === persisted.id)
    const nextJobs = jobs.value.slice()

    if (existingIndex === -1) {
      nextJobs.unshift(persisted)
    } else {
      nextJobs[existingIndex] = persisted
    }

    jobsState.value = {
      jobs: nextJobs
    }
  }

  const setProjectJobs = (
    projectId: string,
    projectJobs: Array<RvtConversionJob | PersistedRvtJob>,
    modelId?: string
  ) => {
    const normalizedJobs = projectJobs.map((job) =>
      'sourceFileName' in job ? job : toPersistedJob(job)
    )
    const otherProjectJobs = jobs.value.filter((job) => {
      if (job.projectId !== projectId) return true
      if (!modelId) return false
      return job.modelId !== modelId
    })

    jobsState.value = {
      jobs: [...normalizedJobs, ...otherProjectJobs]
    }
  }

  const removeJob = (jobId: string) => {
    jobsState.value = {
      jobs: jobs.value.filter((job) => job.id !== jobId)
    }
  }

  const getProjectJobs = (projectId: string) =>
    jobs.value.filter((job) => job.projectId === projectId)

  const getModelJob = (params: { projectId: string; modelId?: string | null }) => {
    if (!params.modelId) return null

    return (
      jobs.value.find(
        (job) => job.projectId === params.projectId && job.modelId === params.modelId
      ) || null
    )
  }

  return {
    jobs,
    upsertJob,
    setProjectJobs,
    removeJob,
    getProjectJobs,
    getModelJob
  }
}
