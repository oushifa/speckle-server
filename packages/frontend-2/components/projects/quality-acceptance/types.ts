export type QualityAcceptanceAttachment = {
  id: string
  fileName: string
  fileType: string
  fileSize: number | null
}

export type BimElements = {
  modelId: string
  bimIds: string[]
  applicationIds: string[]
}

export type QualityAcceptanceForm = {
  id: string
  name: string
  boqItemId: string
  code: string
  inspectionLotNumber: string
  acceptancePart: string
  acceptanceContent: string
  actualStartDate: number
  actualFinishDate: number
  inspector: string
  attachments: QualityAcceptanceAttachment[]
  creator: string
  workVolume: number
  unit: string
  bimElements: BimElements | null
  timeZone: string
  approveStatus: string | null
  createdAt: number
  updatedAt: number
}

export type QualityAcceptanceCreateInput = Omit<
  QualityAcceptanceForm,
  'id' | 'createdAt' | 'updatedAt' | 'attachments'
> & {
  attachments: string[]
  flowId?: string
}
