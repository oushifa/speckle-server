import { EventEmitter } from 'events'
import type { ProjectModelSyncTaskRecord } from '@/modules/model-sync/repositories/tasks'

const emitter = new EventEmitter()

const getTaskEventKey = (projectId: string, modelId: string, taskId: string) =>
  `MODEL_SYNC_TASK_UPDATED:${projectId}:${modelId}:${taskId}`

const getModelEventKey = (projectId: string, modelId: string) =>
  `MODEL_SYNC_MODEL_UPDATED:${projectId}:${modelId}`

export const emitModelSyncTaskUpdated = (payload: ProjectModelSyncTaskRecord) => {
  emitter.emit(getTaskEventKey(payload.projectId, payload.modelId, payload.id), payload)
  emitter.emit(getModelEventKey(payload.projectId, payload.modelId), payload)
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

export const onModelSyncModelUpdated = (
  projectId: string,
  modelId: string,
  listener: (payload: ProjectModelSyncTaskRecord) => void
) => {
  const key = getModelEventKey(projectId, modelId)
  emitter.on(key, listener)
  return () => emitter.off(key, listener)
}
