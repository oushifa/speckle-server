export type QualityAcceptanceAttachment = {
  id: string
  fileName: string
  fileType: string
  fileSize: number | null
}

export type QualityAcceptanceForm = {
  id: string
  name: string
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
  BIMelement: string[]
  timeZone: string
  approveStatus: number
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
