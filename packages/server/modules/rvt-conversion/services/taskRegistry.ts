export type TrackedRvtConversionTask = {
  taskId: string
  projectId: string
  modelId: string
  sourceFileId: string
  workerIds: string[]
  trackedAt: Date
}

const trackedTasks = new Map<string, TrackedRvtConversionTask>()

export const trackRvtConversionTask = (
  task: Omit<TrackedRvtConversionTask, 'trackedAt'>
) => {
  const trackedTask: TrackedRvtConversionTask = {
    ...task,
    trackedAt: new Date()
  }

  trackedTasks.set(task.taskId, trackedTask)
  return trackedTask
}

export const getTrackedRvtConversionTask = (taskId: string) => trackedTasks.get(taskId) || null

export const untrackRvtConversionTask = (taskId: string) => trackedTasks.delete(taskId)

export const clearTrackedRvtConversionTasks = () => {
  trackedTasks.clear()
}
