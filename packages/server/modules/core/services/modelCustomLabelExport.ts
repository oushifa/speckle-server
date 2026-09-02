import type { Readable } from 'node:stream'

export type FlatValue = string | number | boolean | null

export type ModelCustomLabelFlatPayload = {
  model: {
    id: string
    name: string
    timestamp: string
  }
  elements: Array<{
    id: string
    applicationId?: string
    elementId?: string
    parameters: Record<string, FlatValue>
  }>
}

type ObjectLite = {
  id: string
  childrenIds: string[]
  raw: Record<string, unknown>
}

type ObjectStreamRow = {
  id: string
  dataText?: string
  data?: Record<string, unknown>
}

const TREE_CHILD_KEYS = ['elements', 'children', '@elements', '@children', 'objects']

const UNIT_SYMBOL_MAP: Record<string, string> = {
  'cubic metre': 'm3',
  'square metre': 'm2',
  metre: 'm',
  millimetre: 'mm'
}

const IFC_CATEGORY_MAP: Record<string, string> = {
  IfcWall: 'OST_Walls',
  IfcSlab: 'OST_Floors',
  IfcBeam: 'OST_StructuralFraming',
  IfcColumn: 'OST_StructuralColumns',
  IfcFooting: 'OST_StructuralFoundation',
  IfcSite: 'OST_Site',
  IfcBuilding: 'OST_Buildings',
  IfcBuildingStorey: 'OST_Levels',
  IfcRoof: 'OST_Roofs',
  IfcDoor: 'OST_Doors',
  IfcWindow: 'OST_Windows',
  IfcStair: 'OST_Stairs'
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export type SourceFileType = 'ifc' | 'rvt' | null

export const inferSourceFileType = (modelName: string): SourceFileType => {
  const lower = modelName.trim().toLowerCase()
  if (lower.endsWith('.ifc')) return 'ifc'
  if (lower.endsWith('.rvt')) return 'rvt'
  return null
}

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length) return value
  }
  return undefined
}

export const pickIdString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

const normalizeParameterValue = (value: unknown): FlatValue | undefined => {
  if (value === null) return null
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  return undefined
}

const extractRefIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const refs: string[] = []
  for (const item of value) {
    if (isObject(item) && typeof item.referencedId === 'string') {
      refs.push(item.referencedId)
    }
  }
  return refs
}

const objectToLite = (id: string, obj: Record<string, unknown>): ObjectLite => {
  const childrenIdsSet = new Set<string>()
  for (const key of TREE_CHILD_KEYS) {
    const refs = extractRefIds(obj[key])
    refs.forEach((refId) => childrenIdsSet.add(refId))
  }

  return {
    id,
    childrenIds: [...childrenIdsSet],
    raw: obj
  }
}

export const indexObjectsFromStream = async (
  rows: AsyncIterable<ObjectStreamRow>
): Promise<Map<string, ObjectLite>> => {
  const objectMap = new Map<string, ObjectLite>()

  for await (const row of rows) {
    try {
      const parsed =
        row.data ||
        (row.dataText ? (JSON.parse(row.dataText) as Record<string, unknown>) : null)
      if (!parsed) continue
      objectMap.set(row.id, objectToLite(row.id, parsed))
    } catch {
      // Ignore malformed rows and continue parsing the rest
    }
  }

  return objectMap
}

export async function* mergeRootAndChildrenStream(params: {
  rootObject: { id: string; data?: Record<string, unknown> | null }
  childObjectStream: Readable
}): AsyncGenerator<ObjectStreamRow> {
  if (params.rootObject.data) {
    yield {
      id: params.rootObject.id,
      data: params.rootObject.data
    }
  }

  for await (const row of params.childObjectStream as AsyncIterable<ObjectStreamRow>) {
    yield row
  }
}

const collectReachableIds = (
  rootId: string,
  map: Map<string, ObjectLite>,
  visited = new Set<string>()
): Set<string> => {
  if (visited.has(rootId)) return visited
  visited.add(rootId)
  const node = map.get(rootId)
  for (const childId of node?.childrenIds || []) {
    collectReachableIds(childId, map, visited)
  }
  return visited
}

const toFlatPrimitiveRecord = (value: unknown): Record<string, FlatValue> => {
  const out: Record<string, FlatValue> = {}
  if (!isObject(value)) return out

  const walk = (input: unknown, parentKey = '') => {
    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        const nextKey = parentKey ? `${parentKey}[${i}]` : `[${i}]`
        walk(input[i], nextKey)
      }
      return
    }

    const primitive = normalizeParameterValue(input)
    if (primitive !== undefined) {
      if (parentKey) out[parentKey] = primitive
      return
    }

    if (!isObject(input)) return
    for (const [key, nestedValue] of Object.entries(input)) {
      const nextKey = parentKey ? `${parentKey}.${key}` : key
      walk(nestedValue, nextKey)
    }
  }

  walk(value)
  return out
}

const pickParametersSource = (raw: Record<string, unknown>) => {
  if (isObject(raw.parameters)) return raw.parameters
  if (isObject(raw.properties)) return raw.properties
  return undefined
}

type QuantityValue = {
  value: number
  units?: string
}

const formatNumber = (value: number): string => {
  const fixed = value.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}

const normalizeUnit = (unit: string): string => {
  const normalized = unit.trim().toLowerCase()
  return UNIT_SYMBOL_MAP[normalized] || unit
}

const formatQuantityValue = ({ value, units }: QuantityValue): string => {
  const num = formatNumber(value)
  if (!units || !units.trim().length) return num
  return `${num} ${normalizeUnit(units)}`
}

const collectNamedQuantities = (
  input: unknown,
  out: Map<string, QuantityValue> = new Map<string, QuantityValue>()
): Map<string, QuantityValue> => {
  if (Array.isArray(input)) {
    for (const item of input) collectNamedQuantities(item, out)
    return out
  }
  if (!isObject(input)) return out

  const maybeName = typeof input.name === 'string' ? input.name : undefined
  const maybeValue = typeof input.value === 'number' ? input.value : undefined
  const maybeUnits = typeof input.units === 'string' ? input.units : undefined
  if (maybeName && maybeValue !== undefined) {
    out.set(maybeName, { value: maybeValue, units: maybeUnits })
  }

  for (const value of Object.values(input)) {
    collectNamedQuantities(value, out)
  }
  return out
}

const pickFirstQuantity = (
  quantities: Map<string, QuantityValue>,
  candidates: string[]
): QuantityValue | undefined => {
  for (const key of candidates) {
    const hit = quantities.get(key)
    if (hit) return hit
  }
  return undefined
}

const extractReference = (
  properties: Record<string, unknown> | undefined
): string | undefined => {
  if (!properties || !isObject(properties['Property Sets'])) return undefined
  const propertySets = properties['Property Sets']
  for (const value of Object.values(propertySets)) {
    if (!isObject(value)) continue
    if (typeof value.Reference === 'string' && value.Reference.trim().length) {
      return value.Reference
    }
  }
  return undefined
}

const setQuantityField = (
  out: Record<string, FlatValue>,
  label: string,
  quantities: Map<string, QuantityValue>,
  candidates: string[]
) => {
  const found = pickFirstQuantity(quantities, candidates)
  if (found) out[label] = formatQuantityValue(found)
}

const buildDisplayParameters = (
  raw: Record<string, unknown>
): Record<string, FlatValue> => {
  const out: Record<string, FlatValue> = {}

  const properties = isObject(raw.properties) ? raw.properties : undefined
  const attributes = isObject(properties?.Attributes)
    ? properties.Attributes
    : undefined
  const quantities = collectNamedQuantities(
    isObject(properties?.Quantities) ? properties.Quantities : {}
  )

  const type = pickString(attributes?.type, raw.ifcType)
  if (type) out.Type = type

  const typeName = pickString(attributes?.ObjectType)
  if (typeName) out.TypeName = typeName

  const categoryCandidate =
    (typeof attributes?.Category === 'string' && attributes.Category) ||
    (typeof raw.category === 'string' && raw.category) ||
    (type && IFC_CATEGORY_MAP[type]) ||
    type
  if (categoryCandidate) out.Category = categoryCandidate

  const storey = pickString(properties?.['Building Storey'])
  if (storey) out.Storey = storey

  const reference = extractReference(properties)
  if (reference) out.Reference = reference

  setQuantityField(out, 'Volume', quantities, ['NetVolume', 'GrossVolume', 'Volume'])
  setQuantityField(out, 'Area', quantities, [
    'NetSurfaceArea',
    'GrossSurfaceArea',
    'Area',
    'NetArea',
    'GrossArea',
    'NetSideArea',
    'GrossSideArea',
    'CrossSectionArea',
    'OuterSurfaceArea'
  ])
  setQuantityField(out, 'Length', quantities, ['Length'])
  setQuantityField(out, 'Width', quantities, ['Width'])
  setQuantityField(out, 'Height', quantities, ['Height'])

  return out
}

export const getSyncElementIds = (
  raw: Record<string, unknown>,
  _sourceFileType?: SourceFileType,
  speckleObjectId?: string
): { id?: string; applicationId?: string; elementId?: string } => {
  let applicationId = pickIdString(raw.applicationId, raw.originalId, raw.originalID)
  if (speckleObjectId && applicationId === speckleObjectId) {
    applicationId = undefined
  }

  let elementId = pickIdString(raw.elementId, raw.elementID)
  if (speckleObjectId && elementId === speckleObjectId) {
    elementId = undefined
  }

  return {
    id: elementId || applicationId,
    applicationId: applicationId || undefined,
    elementId: elementId || undefined
  }
}

export const getElementApplicationId = (
  raw: Record<string, unknown>,
  speckleObjectId?: string
) => {
  return getSyncElementIds(raw, null, speckleObjectId).id
}

export const buildModelCustomLabelPayload = (params: {
  modelSeedId: string
  modelName: string
  versionCreatedAt: string
  rootId: string
  objectMap: Map<string, ObjectLite>
}): ModelCustomLabelFlatPayload => {
  const reachableIds = collectReachableIds(params.rootId, params.objectMap)
  const sourceFileType = inferSourceFileType(params.modelName)
  const dedupedElements = new Map<
    string,
    {
      parameters: Record<string, FlatValue>
      applicationId?: string
      elementId?: string
    }
  >()

  for (const id of reachableIds) {
    if (id === params.rootId) continue
    const item = params.objectMap.get(id)
    if (!item) continue

    const ids = getSyncElementIds(item.raw, sourceFileType, item.id)
    const elementId = ids.id
    if (!elementId) continue

    const source = pickParametersSource(item.raw)
    const displayParameters = buildDisplayParameters(item.raw)
    const parameters = Object.keys(displayParameters).length
      ? displayParameters
      : toFlatPrimitiveRecord(source)
    if (!Object.keys(parameters).length) continue

    const existing = dedupedElements.get(elementId)
    if (!existing) {
      dedupedElements.set(elementId, {
        parameters: { ...parameters },
        ...(ids.applicationId ? { applicationId: ids.applicationId } : {}),
        ...(ids.elementId ? { elementId: ids.elementId } : {})
      })
      continue
    }

    for (const [key, value] of Object.entries(parameters)) {
      const hasCurrent = Object.prototype.hasOwnProperty.call(existing.parameters, key)
      if (
        !hasCurrent ||
        existing.parameters[key] === null ||
        existing.parameters[key] === ''
      ) {
        existing.parameters[key] = value
      }
    }
  }

  return {
    model: {
      id: params.modelSeedId,
      name: params.modelName,
      timestamp: params.versionCreatedAt
    },
    elements: [...dedupedElements.entries()].map(([id, meta]) => ({
      id,
      ...(meta.applicationId ? { applicationId: meta.applicationId } : {}),
      ...(meta.elementId ? { elementId: meta.elementId } : {}),
      parameters: meta.parameters
    }))
  }
}
