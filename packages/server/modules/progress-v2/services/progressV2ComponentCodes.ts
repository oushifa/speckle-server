/**
 * 进度管理「序号码」单元格解析。
 *
 * 现场台账里同一批构件常写成 `CB1-10~CB1-20` 这类连写区间，导入时要先展开，
 * 再去反查 BIM 关联；这里独立成模块便于单测，不掺杂 Excel/DB 依赖。
 */
import {
  expandComponentCodeRange,
  findInvalidComponentCodeRanges,
  isComponentCodeRange
} from '@/modules/shared/utils/componentCodeRange'

/** 支持逗号、分号、顿号、换行与空白分隔的多个序号码 */
const splitCodes = (value: string) =>
  value
    .split(/[,，;；、\n\r\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

/**
 * 单个单元格允许展开的序号码上限。
 * 仅用于拦截「手误写成超大区间」这类脏数据，正常台账一行远小于该值。
 */
const MAX_CODES_PER_CELL = 5000

/**
 * 解析「序号码」单元格：
 * - 支持逗号、分号、顿号、空白分隔的多个序号码
 * - 支持波浪号连写区间（如 `CB1-10~CB1-20`、`CB13~123`、`CB1-10~20`），
 *   展开后再去反查 BIM 关联，展开结果会落到记录的 BIM 字段里
 *
 * 返回的 `codes` 是展开后的完整序号码列表（用于 BIM 反查）；
 * `value` 是写回记录的构件编码：含连写区间时保留原始写法不铺开，
 * 便于台账回看、导出时保持紧凑；纯编码列表则按解析结果回写。
 *
 * 一个片段包含多个波浪号时无法判断区间边界，按行号抛出可定位的错误。
 */
export const parseProgressV2ComponentCodes = (
  rawValue: string | null,
  rowNumber: number
): { codes: string[]; value: string | null } => {
  if (!rawValue) return { codes: [], value: rawValue }

  // 先去掉波浪号两侧的空白，兼容 `CB1-10 ~ CB1-20` 这类写法
  const normalized = rawValue.replace(/\s*([~～])\s*/g, '$1')
  const parts = splitCodes(normalized)

  const invalidRangePart = findInvalidComponentCodeRanges(parts)[0]
  if (invalidRangePart) {
    throw new Error(
      `第 ${rowNumber} 行序号码中包含错误的连写方式：'${invalidRangePart}'，连写只能包含一个波浪号`
    )
  }

  let expanded: string[] = []
  try {
    for (const part of parts) {
      const remaining = MAX_CODES_PER_CELL - expanded.length
      expanded = expanded.concat(
        expandComponentCodeRange(part, { maxCount: Math.max(remaining, 0) })
      )
    }
  } catch {
    throw new Error(
      `第 ${rowNumber} 行序号码区间过大（单行最多 ${MAX_CODES_PER_CELL} 个），请拆分后导入`
    )
  }

  const codes = Array.from(new Set(expanded))
  const value = parts.some(isComponentCodeRange) ? rawValue : codes.join(', ')
  if (codes.length > MAX_CODES_PER_CELL) {
    throw new Error(
      `第 ${rowNumber} 行序号码过多（单行最多 ${MAX_CODES_PER_CELL} 个），请拆分后导入`
    )
  }

  return { codes, value }
}
