import { EventEmitter } from 'events'

export type DrawingConversionUpdateEvent = {
  projectId: string
  drawingId: string
  conversionStatus: string | null
  convertedBlobId: string | null
  conversionError: string | null
}

const emitter = new EventEmitter()

const getEventKey = (projectId: string, drawingId: string) =>
  `DRAWING_CONVERSION_UPDATED:${projectId}:${drawingId}`

const getProjectEventKey = (projectId: string) =>
  `DRAWING_CONVERSION_UPDATED_PROJECT:${projectId}`

export const emitDrawingConversionUpdated = (payload: DrawingConversionUpdateEvent) => {
  emitter.emit(getEventKey(payload.projectId, payload.drawingId), payload)
}

export const emitProjectDrawingConversionUpdated = (payload: DrawingConversionUpdateEvent) => {
  emitter.emit(getProjectEventKey(payload.projectId), payload)
}

export const onDrawingConversionUpdated = (
  projectId: string,
  drawingId: string,
  listener: (payload: DrawingConversionUpdateEvent) => void
) => {
  const key = getEventKey(projectId, drawingId)
  emitter.on(key, listener)
  return () => emitter.off(key, listener)
}

export const onProjectDrawingConversionUpdated = (
  projectId: string,
  listener: (payload: DrawingConversionUpdateEvent) => void
) => {
  const key = getProjectEventKey(projectId)
  emitter.on(key, listener)
  return () => emitter.off(key, listener)
}
