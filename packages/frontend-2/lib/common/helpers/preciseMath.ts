/**
 * High precision math helpers to avoid floating point number tail issues in JavaScript.
 */

export const preciseMul = (a: number | string, b: number | string): number => {
  return Math.round(Number(a || 0) * Number(b || 0) * 100) / 100
}

export const preciseAdd = (a: number | string, b: number | string): number => {
  return Math.round((Number(a || 0) + Number(b || 0)) * 100) / 100
}
