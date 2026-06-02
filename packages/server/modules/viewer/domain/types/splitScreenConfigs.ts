export type SplitScreenDrawing = {
  projectId: string
  modelId: string
  modelName: string
  versionId: string
  versionCreatedAt: string
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | null
}

export type SplitScreenConfigCameraState = {
  cad: Record<string, unknown> | null
  speckle: Record<string, unknown> | null
}

export type SplitScreenConfig = {
  id: string
  projectId: string
  name: string
  description: string | null
  drawing: SplitScreenDrawing | null
  splitRatio: number
  calibrationPoints: unknown[] | null
  transform: Record<string, unknown> | null
  cameraState: SplitScreenConfigCameraState | null
  sectionBox: Record<string, unknown> | null
  creator: string
  updater: string
  createdAt: Date
  updatedAt: Date
}
