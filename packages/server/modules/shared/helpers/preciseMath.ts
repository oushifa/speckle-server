/**
 * High precision math operations to avoid floating point issues.
 */

export const preciseMul = (a: number | string, b: number | string): number => {
  return Math.round(Number(a || 0) * Number(b || 0) * 100) / 100
}

export const preciseAdd = (a: number | string, b: number | string): number => {
  return Math.round((Number(a || 0) + Number(b || 0)) * 100) / 100
}
