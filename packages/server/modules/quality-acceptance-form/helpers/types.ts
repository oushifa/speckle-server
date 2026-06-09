/**
 * 单个模型的 BIM 构件关联条目。
 * bimIds 与 applicationIds 一一对应，无构件编码时以 null 占位。
 */
export type BimElementEntry = {
  modelId: string
  applicationIds: string[]
  bimIds: (string | null)[]
}

/** BIM 字段本体：支持多模型的构件关联数组 */
export type BIM = BimElementEntry[]
