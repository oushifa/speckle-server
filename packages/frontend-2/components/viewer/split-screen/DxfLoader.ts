import DxfParser from 'dxf-parser'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Vector3
} from 'three'
import type { Object3D } from 'three'

const ACI_COLORS: number[] = [
  0xffffff, 0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff, 0xffffff, 0x808080,
  0xc0c0c0, 0xff0000, 0xff3f3f, 0xff7f7f, 0xffbfbf, 0xffdfdf, 0xbf0000, 0xbf2f2f, 0xbf5f5f,
  0xbf8f8f, 0xbfafaf, 0x7f0000, 0x7f1f1f, 0x7f3f3f, 0x7f5f5f, 0x7f7f7f, 0x3f0000, 0x3f0f0f,
  0x3f1f1f, 0x3f2f2f, 0x3f3f3f, 0xff3f00, 0xff5f00, 0xff7f00, 0xff9f00, 0xffbf00, 0xbf2f00,
  0xbf4700, 0xbf5f00, 0xbf7700, 0xbf8f00, 0x7f1f00, 0x7f2f00, 0x7f3f00, 0x7f4f00, 0x7f5f00,
  0x3f0f00, 0x3f1700, 0x3f1f00, 0x3f2700, 0x3f2f00, 0xff7f00, 0xff9f00, 0xffbf00, 0xffdf00,
  0xffff00, 0xbf5f00, 0xbf7700, 0xbf8f00, 0xbfa700, 0xbfbf00, 0x7f3f00, 0x7f4f00, 0x7f5f00,
  0x7f6f00, 0x7f7f00, 0x3f1f00, 0x3f2700, 0x3f2f00, 0x3f3700, 0x3f3f00, 0xbfff00, 0x7fff00,
  0x3fff00, 0x00ff00, 0x00ff3f, 0x8fbf00, 0x5fbf00, 0x2fbf00, 0x00bf00, 0x00bf2f, 0x5f7f00,
  0x3f7f00, 0x1f7f00, 0x007f00, 0x007f1f, 0x2f3f00, 0x1f3f00, 0x0f3f00, 0x003f00, 0x003f0f,
  0x00ff7f, 0x00ffbf, 0x00ffff, 0x00bfff, 0x007fff, 0x00bf5f, 0x00bf8f, 0x00bfbf, 0x008fbf,
  0x005fbf, 0x007f3f, 0x007f5f, 0x007f7f, 0x005f7f, 0x003f7f, 0x003f1f, 0x003f2f, 0x003f3f,
  0x002f3f, 0x001f3f, 0x003fff, 0x0000ff, 0x3f00ff, 0x7f00ff, 0xbf00ff, 0x002fbf, 0x0000bf,
  0x2f00bf, 0x5f00bf, 0x8f00bf, 0x001f7f, 0x00007f, 0x1f007f, 0x3f007f, 0x5f007f, 0x000f3f,
  0x00003f, 0x0f003f, 0x1f003f, 0x2f003f, 0xff00ff, 0xff00bf, 0xff007f, 0xff003f, 0xff0000,
  0xbf00bf, 0xbf008f, 0xbf005f, 0xbf002f, 0xbf0000, 0x7f007f, 0x7f005f, 0x7f003f, 0x7f001f,
  0x7f0000, 0x3f003f, 0x3f002f, 0x3f001f, 0x3f000f, 0x3f0000, 0x333333, 0x505050, 0x696969,
  0x828282, 0xb4b4b4, 0xffffff
]

const getAciColor = (colorIndex: number | undefined | null): number => {
  if (typeof colorIndex !== 'number') return 0x111827
  if (colorIndex > 255) return colorIndex
  return ACI_COLORS[colorIndex] ?? 0x111827
}

const ensureContrastOnLightBg = (hex: number) => {
  const color = new Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  if (hsl.l < 0.65) return hex
  return new Color().setHSL(hsl.h, hsl.s, 0.28).getHex()
}

export function parseDxfToGroup(text: string): Object3D {
  const parser = new DxfParser()
  const dxf = parser.parseSync(text)
  if (!dxf) throw new Error('DXF parse failed')

  const group = new Group()
  const colorBuffers = new Map<number, number[]>()
  const blocks = (dxf.blocks || {}) as Record<
    string,
    {
      entities?: any[]
      position?: { x?: number; y?: number; z?: number }
    }
  >

  const pushSegment = (p1: Vector3, p2: Vector3, color: number) => {
    if (!colorBuffers.has(color)) colorBuffers.set(color, [])
    colorBuffers.get(color)?.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
  }

  const getEntityColor = (entity: any, parentLayer: string) => {
    let colorNum = entity.color
    if (colorNum === undefined || colorNum === null || colorNum === 256) {
      const layerName = entity.layer || parentLayer
      const layer = dxf.tables?.layer?.layers?.[layerName]
      colorNum = layer?.color
    }
    return ensureContrastOnLightBg(getAciColor(colorNum))
  }

  const transformVertex = (vertex: Record<string, number>, matrix: Matrix4) =>
    new Vector3(vertex.x || 0, vertex.y || 0, vertex.z || 0).applyMatrix4(matrix)

  const walkEntities = (entities: any[], matrix: Matrix4, parentLayer = '0') => {
    for (const entity of entities) {
      const color = getEntityColor(entity, parentLayer)

      switch (entity.type) {
        case 'LINE': {
          if (entity.vertices?.length >= 2) {
            pushSegment(
              transformVertex(entity.vertices[0], matrix),
              transformVertex(entity.vertices[1], matrix),
              color
            )
          }
          break
        }
        case 'LWPOLYLINE':
        case 'lwpolyline':
        case 'POLYLINE': {
          const vertices = entity.vertices || []
          if (vertices.length < 2) break

          for (let i = 0; i < vertices.length - 1; i++) {
            pushSegment(
              transformVertex(vertices[i], matrix),
              transformVertex(vertices[i + 1], matrix),
              color
            )
          }

          const isClosed = entity.shape === true || (entity.flags & 1) === 1
          if (isClosed) {
            pushSegment(
              transformVertex(vertices[vertices.length - 1], matrix),
              transformVertex(vertices[0], matrix),
              color
            )
          }
          break
        }
        case 'CIRCLE':
        case 'ARC': {
          const radius = entity.radius
          if (!radius) break

          const center = entity.center || { x: 0, y: 0, z: 0 }
          const startAngle = entity.startAngle || 0
          let endAngle = entity.endAngle !== undefined ? entity.endAngle : Math.PI * 2
          if (startAngle > endAngle) endAngle += Math.PI * 2

          const steps = 48
          let previous = transformVertex(
            {
              x: center.x + Math.cos(startAngle) * radius,
              y: center.y + Math.sin(startAngle) * radius,
              z: center.z || 0
            },
            matrix
          )

          for (let i = 1; i <= steps; i++) {
            const angle = startAngle + ((endAngle - startAngle) * i) / steps
            const current = transformVertex(
              {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.sin(angle) * radius,
                z: center.z || 0
              },
              matrix
            )
            pushSegment(previous, current, color)
            previous = current
          }
          break
        }
        case 'INSERT': {
          if (!entity.name || !blocks[entity.name]?.entities?.length) break

          const block = blocks[entity.name]
          const blockMatrix = new Matrix4()
          const rotation = ((entity.rotation || 0) * Math.PI) / 180
          blockMatrix.makeRotationZ(rotation)
          blockMatrix.scale(
            new Vector3(entity.xScale || 1, entity.yScale || 1, entity.zScale || 1)
          )
          blockMatrix.setPosition(
            entity.position?.x || 0,
            entity.position?.y || 0,
            entity.position?.z || 0
          )

          const offsetMatrix = new Matrix4().makeTranslation(
            -(block.position?.x || 0),
            -(block.position?.y || 0),
            -(block.position?.z || 0)
          )

          walkEntities(
            block.entities || [],
            matrix.clone().multiply(blockMatrix).multiply(offsetMatrix),
            entity.layer || parentLayer
          )
          break
        }
        default:
          break
      }
    }
  }

  if (dxf.entities?.length) {
    walkEntities(dxf.entities, new Matrix4())
  }

  for (const [color, positions] of colorBuffers.entries()) {
    if (!positions.length) continue

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    group.add(new LineSegments(geometry, new LineBasicMaterial({ color })))
  }

  return group
}
