import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'
import { createInterface } from 'node:readline'
import { fetch } from 'undici'
import { logger } from '@/observability/logging'

type OutputFormat = 'bimp-tree' | 'flat' | 'raw'

type CliArgs = {
  serverUrl: string
  token: string
  projectId: string
  modelId: string
  outputPath?: string
  outputFormat: OutputFormat
}

type GraphqlResponse = {
  data?: {
    project?: {
      model?: {
        id: string
        name?: string | null
        versions?: {
          items?: Array<{
            id: string
            referencedObject: string
            createdAt: string
          }>
        }
      }
    }
  }
  errors?: Array<{ message?: string }>
}

type ExportNode = {
  id: string
  name: string
  visible: boolean
  children: ExportNode[]
}

type ObjectLite = {
  id: string
  name: string
  visible: boolean
  childrenIds: string[]
  raw: Record<string, unknown>
}

type TreeExportPayload = {
  models: Array<{
    model: {
      id: string
      name: string
      timestamp: string
    }
    tree: ExportNode
  }>
}

type FlatExportPayload = {
  model: {
    id: string
    name: string
    timestamp: string
  }
  elements: Array<{
    id: string
    parameters: Record<string, string | number | boolean | null>
  }>
}
// yarn tsx --import ./esmLoader.js ./scripts/exportModelJsonById.ts \
//   --server-url http://127.0.0.1:3000 \
//   --token eea37ce50b8ff5fe92aaaea9e67c69b1e7f1e66904 \
//   --project-id 9f8aa19967 \
//   --model-id 68d88865fd \
//   --output-format flat \
//   --output ./model-elements.json
const getArgValue = (flag: string): string | undefined => {
  const args = process.argv.slice(2)
  const byEquals = args.find((arg) => arg.startsWith(`${flag}=`))
  if (byEquals) return byEquals.slice(flag.length + 1)

  const flagIndex = args.findIndex((arg) => arg === flag)
  if (flagIndex === -1) return undefined
  return args[flagIndex + 1]
}

const getRequiredConfig = (): CliArgs => {
  const serverUrl = getArgValue('--server-url') || process.env.SPECKLE_SERVER_URL
  const token = getArgValue('--token') || process.env.SPECKLE_TOKEN
  const projectId = getArgValue('--project-id') || process.env.SPECKLE_PROJECT_ID
  const modelId = getArgValue('--model-id') || process.env.SPECKLE_MODEL_ID
  const outputPath = getArgValue('--output') || process.env.OUTPUT
  const outputFormatArg =
    getArgValue('--output-format') || process.env.OUTPUT_FORMAT || 'bimp-tree'
  const outputFormat: OutputFormat =
    outputFormatArg === 'raw'
      ? 'raw'
      : outputFormatArg === 'flat'
      ? 'flat'
      : 'bimp-tree'

  const missing: string[] = []
  if (!serverUrl) missing.push('server-url or SPECKLE_SERVER_URL')
  if (!token) missing.push('token or SPECKLE_TOKEN')
  if (!projectId) missing.push('project-id or SPECKLE_PROJECT_ID')
  if (!modelId) missing.push('model-id or SPECKLE_MODEL_ID')

  if (missing.length) {
    throw new Error(`Missing required arguments: ${missing.join(', ')}`)
  }

  return {
    serverUrl: serverUrl!,
    token: token!,
    projectId: projectId!,
    modelId: modelId!,
    outputPath,
    outputFormat
  }
}

const getAuthHeader = (token: string) =>
  token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`

const normalizeServerUrl = (serverUrl: string) => serverUrl.replace(/\/+$/, '')

const getLatestVersionObject = async (args: CliArgs) => {
  const authHeader = getAuthHeader(args.token)
  const endpoint = `${normalizeServerUrl(args.serverUrl)}/graphql`
  const query = `
    query($projectId: String!, $modelId: String!) {
      project(id: $projectId) {
        model(id: $modelId) {
          id
          name
          versions(limit: 1) {
            items {
              id
              referencedObject
              createdAt
            }
          }
        }
      }
    }
  `

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables: {
        projectId: args.projectId,
        modelId: args.modelId
      }
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`GraphQL request failed (${response.status}): ${errText}`)
  }

  const body = (await response.json()) as GraphqlResponse
  if (body.errors?.length) {
    throw new Error(
      `GraphQL returned errors: ${body.errors
        .map((e) => e.message || 'Unknown GraphQL error')
        .join('; ')}`
    )
  }

  const latest = body.data?.project?.model?.versions?.items?.[0]
  if (!latest?.referencedObject) {
    throw new Error('No version found for this model, or referencedObject is empty.')
  }

  return {
    modelId: body.data?.project?.model?.id || args.modelId,
    modelName: body.data?.project?.model?.name || null,
    versionId: latest.id,
    objectId: latest.referencedObject,
    createdAt: latest.createdAt
  }
}

const TREE_CHILD_KEYS = ['elements', 'children', '@elements', '@children', 'objects']

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

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

const pickNodeName = (obj: Record<string, unknown>, fallbackId: string) => {
  const candidates = [obj.name, obj.longName, obj.ifcType, obj.speckle_type]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length) return c
  }
  return fallbackId
}

const objectToLite = (id: string, obj: Record<string, unknown>): ObjectLite => {
  const childrenIdsSet = new Set<string>()
  for (const key of TREE_CHILD_KEYS) {
    const refs = extractRefIds(obj[key])
    refs.forEach((r) => childrenIdsSet.add(r))
  }

  return {
    id,
    name: pickNodeName(obj, id),
    visible: typeof obj.visible === 'boolean' ? obj.visible : true,
    childrenIds: [...childrenIdsSet],
    raw: obj
  }
}

const indexObjectsFromJsonlStream = async (
  body: NodeWebReadableStream<Uint8Array>
): Promise<Map<string, ObjectLite>> => {
  const map = new Map<string, ObjectLite>()
  const input = Readable.fromWeb(body)
  const rl = createInterface({ input, crlfDelay: Infinity })

  for await (const line of rl) {
    const firstTab = line.indexOf('\t')
    if (firstTab <= 0) continue

    const id = line.slice(0, firstTab).trim()
    const jsonPart = line.slice(firstTab + 1)
    if (!id || !jsonPart) continue

    try {
      const parsed = JSON.parse(jsonPart) as Record<string, unknown>
      map.set(id, objectToLite(id, parsed))
    } catch {
      // Ignore malformed lines and continue parsing the rest
    }
  }

  return map
}

const buildTreeNode = (
  rootId: string,
  map: Map<string, ObjectLite>,
  ancestors = new Set<string>()
): ExportNode => {
  const source = map.get(rootId)
  const name = source?.name || (ancestors.size === 0 ? 'Root' : rootId)
  const visible = source?.visible ?? true

  if (ancestors.has(rootId)) {
    return { id: rootId, name, visible, children: [] }
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(rootId)

  const childIds = source?.childrenIds || []
  const children = childIds.map((childId) => buildTreeNode(childId, map, nextAncestors))

  return {
    id: rootId,
    name,
    visible,
    children
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

const normalizeParameterValue = (
  value: unknown
): string | number | boolean | null | undefined => {
  if (value === null) return null
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value
  return undefined
}

const toFlatPrimitiveRecord = (
  value: unknown
): Record<string, string | number | boolean | null> => {
  const out: Record<string, string | number | boolean | null> = {}
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
    for (const [k, v] of Object.entries(input)) {
      const nextKey = parentKey ? `${parentKey}.${k}` : k
      walk(v, nextKey)
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

const UNIT_SYMBOL_MAP: Record<string, string> = {
  'cubic metre': 'm³',
  'square metre': 'm²',
  metre: 'm',
  millimetre: 'mm'
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

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length) return value
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
  out: Record<string, string | number | boolean | null>,
  label: string,
  quantities: Map<string, QuantityValue>,
  candidates: string[]
) => {
  const found = pickFirstQuantity(quantities, candidates)
  if (found) out[label] = formatQuantityValue(found)
}

const buildDisplayParameters = (
  raw: Record<string, unknown>
): Record<string, string | number | boolean | null> => {
  const out: Record<string, string | number | boolean | null> = {}

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

const getElementExportId = (obj: ObjectLite): string => {
  // Flat 导出统一使用 Speckle 对象 ID，避免落到业务名称/外部 GUID
  return obj.id
}

const writeFlatPayload = async (
  args: CliArgs,
  modelName: string,
  versionCreatedAt: string,
  rootId: string,
  map: Map<string, ObjectLite>
) => {
  const reachableIds = collectReachableIds(rootId, map)
  const dedupedElements = new Map<
    string,
    Record<string, string | number | boolean | null>
  >()

  for (const id of reachableIds) {
    if (id === rootId) continue
    const item = map.get(id)
    if (!item) continue

    const source = pickParametersSource(item.raw)
    const displayParameters = buildDisplayParameters(item.raw)
    const parameters = Object.keys(displayParameters).length
      ? displayParameters
      : toFlatPrimitiveRecord(source)
    if (!Object.keys(parameters).length) continue

    const exportId = getElementExportId(item)
    const existing = dedupedElements.get(exportId)
    if (!existing) {
      dedupedElements.set(exportId, { ...parameters })
      continue
    }

    // 相同业务 ID 的多条记录合并：保留已有值，补齐缺失字段
    for (const [key, value] of Object.entries(parameters)) {
      const hasCurrent = Object.prototype.hasOwnProperty.call(existing, key)
      if (!hasCurrent || existing[key] === null || existing[key] === '') {
        existing[key] = value
      }
    }
  }

  const elements: FlatExportPayload['elements'] = []
  for (const [id, parameters] of dedupedElements.entries()) {
    elements.push({ id, parameters })
  }

  const payload: FlatExportPayload = {
    model: {
      id: args.modelId,
      name: modelName,
      timestamp: versionCreatedAt
    },
    elements
  }

  const outputPath = args.outputPath || `model-${args.modelId}-flat-parameters.json`
  const resolvedOutputPath = resolve(outputPath)
  const writeStream = createWriteStream(resolvedOutputPath, { encoding: 'utf8' })
  writeStream.write(JSON.stringify(payload, null, 2))
  writeStream.end()

  await new Promise<void>((resolveDone, rejectDone) => {
    writeStream.on('finish', () => resolveDone())
    writeStream.on('error', rejectDone)
  })

  logger.info(
    { outputPath: resolvedOutputPath, elementCount: elements.length },
    'Flat parameters JSON export completed'
  )
}

const writeTreePayload = async (
  args: CliArgs,
  modelName: string,
  versionCreatedAt: string,
  rootNode: ExportNode
) => {
  const payload: TreeExportPayload = {
    models: [
      {
        model: {
          id: args.modelId,
          name: modelName,
          timestamp: versionCreatedAt
        },
        tree: rootNode
      }
    ]
  }

  const outputPath = args.outputPath || `model-${args.modelId}-bimp-tree.json`
  const resolvedOutputPath = resolve(outputPath)
  const writeStream = createWriteStream(resolvedOutputPath, { encoding: 'utf8' })
  writeStream.write(JSON.stringify(payload, null, 2))
  writeStream.end()

  await new Promise<void>((resolveDone, rejectDone) => {
    writeStream.on('finish', () => resolveDone())
    writeStream.on('error', rejectDone)
  })

  logger.info({ outputPath: resolvedOutputPath }, 'BIMP tree JSON export completed')
}

const exportByFormat = async (args: CliArgs) => {
  const latest = await getLatestVersionObject(args)
  const authHeader = getAuthHeader(args.token)
  const endpoint = `${normalizeServerUrl(args.serverUrl)}/objects/${args.projectId}/${
    latest.objectId
  }`

  logger.info(
    {
      projectId: args.projectId,
      modelId: args.modelId,
      versionId: latest.versionId,
      objectId: latest.objectId,
      outputFormat: args.outputFormat
    },
    'Resolved latest model version and starting export'
  )

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'text/plain'
    }
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Download request failed (${response.status}): ${errText}`)
  }
  if (!response.body) {
    throw new Error('Download response body is empty.')
  }

  if (args.outputFormat === 'raw') {
    const outputPath =
      args.outputPath || `model-${args.modelId}-version-${latest.versionId}-full.jsonl`
    const resolvedOutputPath = resolve(outputPath)
    const readStream = Readable.fromWeb(
      response.body as unknown as NodeWebReadableStream<Uint8Array>
    )
    const writeStream = createWriteStream(resolvedOutputPath, { encoding: 'utf8' })
    await pipeline(readStream, writeStream)
    logger.info(
      {
        outputPath: resolvedOutputPath,
        versionId: latest.versionId,
        objectId: latest.objectId
      },
      'Raw full JSONL export completed'
    )
    return
  }

  const objectMap = await indexObjectsFromJsonlStream(
    response.body as unknown as NodeWebReadableStream<Uint8Array>
  )
  const modelName = latest.modelName || args.modelId
  if (args.outputFormat === 'flat') {
    await writeFlatPayload(
      args,
      modelName,
      latest.createdAt,
      latest.objectId,
      objectMap
    )
    return
  }

  const tree = buildTreeNode(latest.objectId, objectMap)
  await writeTreePayload(args, modelName, latest.createdAt, tree)
}

const main = async () => {
  const args = getRequiredConfig()
  await exportByFormat(args)
}

void main().catch((err) => {
  logger.error(err, 'Failed to export model JSON by modelId')
  process.exitCode = 1
})
