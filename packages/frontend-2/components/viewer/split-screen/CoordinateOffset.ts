export interface CoordinateOffset {
  dx: number
  dy: number
  dz: number
  scale: number
  rotationZ: number
}

export type CalibrationPointPair = {
  index: 1 | 2 | 3
  cad: { x: number; y: number; z: number }
  speckle: { x: number; y: number; z: number }
}

export const DEFAULT_OFFSET: CoordinateOffset = {
  dx: 0,
  dy: 0,
  dz: 0,
  scale: 1,
  rotationZ: 0
}

const rotateZ = (point: { x: number; y: number; z: number }, radians: number) => {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
    z: point.z
  }
}

export const transformCadToSpecklePoint = (
  point: { x: number; y: number; z: number },
  offset: CoordinateOffset
) => {
  const scaled = {
    x: point.x * (offset.scale || 1),
    y: point.y * (offset.scale || 1),
    z: point.z * (offset.scale || 1)
  }
  const rotated = rotateZ(scaled, offset.rotationZ || 0)

  return {
    x: rotated.x + offset.dx,
    y: rotated.y + offset.dy,
    z: rotated.z + offset.dz
  }
}

export const transformSpeckleToCadPoint = (
  point: { x: number; y: number; z: number },
  offset: CoordinateOffset
) => {
  const translated = {
    x: point.x - offset.dx,
    y: point.y - offset.dy,
    z: point.z - offset.dz
  }
  const rotated = rotateZ(translated, -(offset.rotationZ || 0))
  const scale = offset.scale || 1

  return {
    x: rotated.x / scale,
    y: rotated.y / scale,
    z: rotated.z / scale
  }
}

const average = (values: number[]) =>
  values.reduce((sum, current) => sum + current, 0) / Math.max(values.length, 1)

const distance2D = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

export function calcTransformFromCalibrationPoints(
  pointPairs: CalibrationPointPair[]
): CoordinateOffset {
  if (pointPairs.length < 2) {
    return { ...DEFAULT_OFFSET }
  }

  const cadA = pointPairs[0].cad
  const cadB = pointPairs[1].cad
  const speckleA = pointPairs[0].speckle
  const speckleB = pointPairs[1].speckle

  const cadVector = {
    x: cadB.x - cadA.x,
    y: cadB.y - cadA.y
  }
  const speckleVector = {
    x: speckleB.x - speckleA.x,
    y: speckleB.y - speckleA.y
  }

  const cadDistance = distance2D({ x: cadA.x, y: cadA.y }, { x: cadB.x, y: cadB.y })
  const speckleDistance = distance2D({ x: speckleA.x, y: speckleA.y }, { x: speckleB.x, y: speckleB.y })
  const scale =
    cadDistance > Number.EPSILON && speckleDistance > Number.EPSILON
      ? speckleDistance / cadDistance
      : 1

  const rotationZ =
    Math.atan2(speckleVector.y, speckleVector.x) -
    Math.atan2(cadVector.y, cadVector.x)

  const deltas = pointPairs.map((pair) => {
    const rotatedCad = transformCadToSpecklePoint(pair.cad, {
      dx: 0,
      dy: 0,
      dz: 0,
      scale,
      rotationZ
    })

    return {
      dx: pair.speckle.x - rotatedCad.x,
      dy: pair.speckle.y - rotatedCad.y,
      dz: pair.speckle.z - rotatedCad.z
    }
  })

  return {
    dx: average(deltas.map((item) => item.dx)),
    dy: average(deltas.map((item) => item.dy)),
    dz: average(deltas.map((item) => item.dz)),
    scale,
    rotationZ
  }
}
