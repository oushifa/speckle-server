/**
 * High precision math operations to avoid floating point issues.
 */

export const preciseMul = (a: number | string, b: number | string): number => {
  return Math.round(Number(a || 0) * Number(b || 0) * 100) / 100
}

export const preciseAdd = (a: number | string, b: number | string): number => {
  return Math.round((Number(a || 0) + Number(b || 0)) * 100) / 100
}

/**
 * 万元 → 元，结果保留两位小数。
 *
 * 不要直接写 `wan * 10000`：例如
 * `23028.4475 * 10000 === 230284474.99999997`，
 * 该值直接返回给前端（如「上期末累计付款」这种 disabled 的数字输入框）
 * 会把浮点尾差原样暴露给用户。
 */
export const wanToYuan = (wan: number | string): number => {
  return preciseMul(wan, 10000)
}
