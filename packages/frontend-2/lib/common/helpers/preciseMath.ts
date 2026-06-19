/**
 * High precision math helpers to avoid floating point number tail issues in JavaScript.
 */

export const preciseMul = (a: number, b: number): number => {
  return Math.round(a * b * 100) / 100
}

export const preciseAdd = (a: number, b: number): number => {
  return Math.round((a + b) * 100) / 100
}
