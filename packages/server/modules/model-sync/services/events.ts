import { EventEmitter } from 'events'
import type { ProjectModelSyncTaskRecord } from '@/modules/model-sync/repositories/tasks'

const emitter = new EventEmitter()

const getTaskEventKey = (projectId: string, modelId: string, taskId: string) =>
  `MODEL_SYNC_TASK_UPDATED:${projectId}:${modelId}:${taskId}`

export const emitModelSyncTaskUpdated = (payload: ProjectModelSyncTaskRecord) => {
  emitter.emit(getTaskEventKey(payload.projectId, payload.modelId, payload.id), payload)
}

export const onModelSyncTaskUpdated = (
  projectId: string,
  modelId: string,
  taskId: string,
  listener: (payload: ProjectModelSyncTaskRecord) => void
) => {
  const key = getTaskEventKey(projectId, modelId, taskId)
  emitter.on(key, listener)
  return () => emitter.off(key, listener)
}
