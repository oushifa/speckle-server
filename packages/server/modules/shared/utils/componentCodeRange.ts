/**
 * 构件编码（序号码）的波浪号连写工具。
 *
 * 现场台账里同一批构件常写成 `CB1-10~CB1-20`、`CB13~123` 这类区间写法，
 * 质量验收与进度管理的 Excel 导入、导出共用这里的同一套展开/压缩规则，
 * 避免同一条连写口径在多个模块里各写一遍导致行为不一致。
 */

const TILDE_REGEX = /[~～]/

/** 片段是否为波浪号连写写法 */
export const isComponentCodeRange = (part: string) => TILDE_REGEX.test(part)

/**
 * 找出写法非法的连写片段：一个片段只能包含一个波浪号。
 * 例如 `CB1-13~CB1~123` 无法判断区间边界，属于非法写法。
 */
export const findInvalidComponentCodeRanges = (parts: string[]): string[] =>
  parts.filter((part) => part.split(TILDE_REGEX).length > 2)

/**
 * 展开单个波浪号区间写法：
 * - `CB1-10~CB1-20` -> CB1-10 ... CB1-20
 * - `CB1-10~20`     -> CB1-10 ... CB1-20（区间终点省略前缀）
 * - `CB13~123`      -> CB13 ... CB123（按起点数字宽度补零）
 *
 * 无法识别成「同前缀 + 递增数字」时按普通片段处理（拆分两端，不展开）。
 * `maxCount` 用于防止手误写出超大区间（如 `CB1-1~CB1-999999999`）把服务端拖死。
 */
export const expandComponentCodeRange = (
  rangeStr: string,
  options: { maxCount?: number } = {}
): string[] => {
  const trimmed = rangeStr.trim()
  if (!TILDE_REGEX.test(trimmed)) {
    return [trimmed]
  }

  const parts = trimmed.split(TILDE_REGEX).map((p) => p.trim())
  if (parts.length !== 2) {
    return [trimmed]
  }

  const [start, end] = parts
  const startMatch = start.match(/^(.*?)(\d+)$/)
  const endMatch = end.match(/^(.*?)(\d+)$/)
  if (!startMatch || !endMatch) {
    return [start, end]
  }

  const prefix = startMatch[1]
  const startNumStr = startMatch[2]
  const endNumStr = endMatch[2]

  // 区间终点带前缀时必须与起点前缀一致，否则视为两个独立编码
  if (endMatch[1] !== '' && prefix !== endMatch[1]) {
    return [start, end]
  }

  const startNum = parseInt(startNumStr, 10)
  const endNum = parseInt(endNumStr, 10)
  if (startNum > endNum) {
    return [start, end]
  }

  const count = endNum - startNum + 1
  const { maxCount } = options
  if (maxCount !== undefined && count > maxCount) {
    throw new Error(`连写区间展开数量过大：'${trimmed}' 将展开为 ${count} 个编码`)
  }

  const width = startNumStr.length
  const results: string[] = []
  for (let i = startNum; i <= endNum; i++) {
    results.push(prefix + String(i).padStart(width, '0'))
  }
  return results
}

/**
 * 把连续的序号码压缩回 `CB1-10~CB1-20` 形式（导出口径）。
 * 相同前缀与数字宽度为一组，只有连续递增的号码才会被压缩。
 */
export const compressComponentCodeRanges = (codes: string[]): string => {
  if (!codes || codes.length === 0) return ''

  type Parsed = {
    prefix: string
    num: number
    width: number
  }
  const parsedItems: Parsed[] = []
  const nonParsable: string[] = []

  for (const code of codes) {
    const trimmed = (code || '').trim()
    if (!trimmed) continue
    const match = trimmed.match(/^(.*?)(\d+)$/)
    if (match) {
      parsedItems.push({
        prefix: match[1],
        num: parseInt(match[2], 10),
        width: match[2].length
      })
    } else {
      nonParsable.push(trimmed)
    }
  }

  const groups = new Map<string, Parsed[]>()
  for (const item of parsedItems) {
    const key = `${item.prefix}::${item.width}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }

  const resultSegments: string[] = []

  for (const [key, items] of groups.entries()) {
    const lastColonIdx = key.lastIndexOf('::')
    const prefix = key.substring(0, lastColonIdx)
    const width = parseInt(key.substring(lastColonIdx + 2), 10)

    const uniqueNums = Array.from(new Set(items.map((it) => it.num))).sort(
      (a, b) => a - b
    )

    const formatNum = (n: number) => prefix + String(n).padStart(width, '0')

    let k = 0
    while (k < uniqueNums.length) {
      let endIdx = k
      while (
        endIdx + 1 < uniqueNums.length &&
        uniqueNums[endIdx + 1] === uniqueNums[endIdx] + 1
      ) {
        endIdx++
      }

      if (endIdx > k) {
        const endNumStr = String(uniqueNums[endIdx]).padStart(width, '0')
        resultSegments.push(`${formatNum(uniqueNums[k])}~${endNumStr}`)
      } else {
        resultSegments.push(formatNum(uniqueNums[k]))
      }
      k = endIdx + 1
    }
  }

  resultSegments.push(...nonParsable)
  return resultSegments.join(', ')
}
