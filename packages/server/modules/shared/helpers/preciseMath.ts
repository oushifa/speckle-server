/**
 * High precision math operations to avoid floating point issues.
 */

export const preciseMul = (a: number, b: number): number => {
  return Math.round(a * b * 100) / 100
}

export const preciseAdd = (a: number, b: number): number => {
  return Math.round((a + b) * 100) / 100
}
