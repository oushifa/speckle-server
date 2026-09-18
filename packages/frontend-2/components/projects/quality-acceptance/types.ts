export type QualityAcceptanceAttachment = {
  id: string
  fileName: string
  fileType: string
  fileSize: number | null
}

export type BimElementEntry = {
  modelId: string
  applicationIds: string[]
  bimIds: (string | null)[]
}

/**
 * 提取单个 BIM 条目的构件序号码，并与 applicationIds 按位对齐。
 * bimIds 的语义即构件序号码；历史手工新增的单据曾把 applicationId 兜底写进
 * bimIds（见后端 normalizeBIM 旧逻辑），这里按位过滤掉与 applicationId 相同的
 * 占位值，避免把对象 ID 当成序号码展示。
 */
export const getAlignedBimSerialCodes = (entry: BimElementEntry): (string | null)[] =>
  (entry.applicationIds || []).map((applicationId, index) => {
    const code = (entry.bimIds?.[index] || '').trim()
    if (!code || code === applicationId) return null
    return code
  })

/** 汇总 BIM 关联中的构件序号码（去重，忽略未解析项） */
export const getBimSerialCodes = (
  BIM: BimElementEntry[] | null | undefined
): string[] => {
  if (!BIM?.length) return []
  const seen = new Set<string>()
  const codes: string[] = []
  for (const entry of BIM) {
    for (const code of getAlignedBimSerialCodes(entry)) {
      if (!code || seen.has(code)) continue
      seen.add(code)
      codes.push(code)
    }
  }
  return codes
}

/**
 * BIM 构件选择项，结构上与 CommonModelObjectMultiModelSelectDrawer 的
 * selections 模型保持一致。
 */
export type BimSelectionGroup = {
  modelId: string
  applicationIds: string[]
  componentCodes?: string[]
  componentCodesAligned?: (string | null)[]
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
  BIM: BimElementEntry[] | null
  timeZone: string
  approveStatus: string | null
  occupiedMeasurementId?: string | null
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
