/* eslint-disable camelcase -- fixture objects use the Speckle wire format */
import { describe, expect, it } from 'vitest'
import type { ObjectLoader2 } from '@speckle/objectloader2'
import { WorldTree, type TreeNode } from '../src/modules/tree/WorldTree.js'
import SpeckleConverter from '../src/modules/loaders/Speckle/SpeckleConverter.js'

/**
 * Regression coverage for the IFC importer's instancing output.
 *
 * `ifc_importer.instancing` emits exactly this shape:
 *   root
 *    ├── instanceGeometry: Objects.Other.IfcInstanceGeometry
 *    │     ├── instanceDefinitions: [InstanceDefinitionProxy]
 *    │     └── @displayValue: [ <definition meshes> ]   (detached)
 *    └── elements: [DataObject { displayValue: [InstanceProxy] }]
 *
 * These tests run the real SpeckleConverter over that graph and assert the
 * viewer consumes it (definitions resolved, instances created & shared).
 */

const DEFINITION_ID = 'ifcdef-abc'
const MESH_APPLICATION_ID = 'ifcdef-abc_0'
const MESH_OBJECT_ID = 'defmesh'
const MATRIX = [
  -1, 0, 0, -27.4673, 0, -1, 0, 57.8181, 0, 0, 1, 4.0618, 0, 0, 0, 1
]

const definitionMesh = {
  id: MESH_OBJECT_ID,
  speckle_type: 'Objects.Geometry.Mesh',
  applicationId: MESH_APPLICATION_ID,
  units: 'm',
  vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  faces: [3, 0, 1, 2]
}

const instanceProxy = (elementId: string) => ({
  id: `${elementId}-proxy`,
  speckle_type: 'Speckle.Core.Models.Instances.InstanceProxy',
  applicationId: elementId,
  definitionId: DEFINITION_ID,
  transform: MATRIX,
  units: 'm',
  maxDepth: 0
})

const dataObject = (elementId: string) => ({
  id: elementId,
  speckle_type: 'Objects.Data.DataObject',
  applicationId: elementId,
  name: `element ${elementId}`,
  properties: {},
  displayValue: [instanceProxy(elementId)]
})

const ROOT_ID = 'root'

const objects: Record<string, unknown> = {
  [ROOT_ID]: {
    id: ROOT_ID,
    speckle_type: 'Objects.Models.Collection',
    applicationId: 'root-app',
    elements: [dataObject('element-1'), dataObject('element-2')],
    instanceGeometry: {
      id: 'container',
      speckle_type: 'Objects.Other.IfcInstanceGeometry',
      instanceDefinitions: [
        {
          id: 'defproxy',
          speckle_type: 'Speckle.Core.Models.Instances.InstanceDefinitionProxy',
          applicationId: DEFINITION_ID,
          name: 'Window',
          objects: [MESH_APPLICATION_ID],
          maxDepth: 0
        }
      ],
      '@displayValue': [{ referencedId: MESH_OBJECT_ID }]
    }
  },
  [MESH_OBJECT_ID]: definitionMesh
}

const mockLoader = {
  getObject: async ({ id }: { id: string }) => objects[id]
} as unknown as ObjectLoader2

const collect = (tree: WorldTree): Promise<TreeNode[]> => {
  const nodes: TreeNode[] = []
  return tree
    .walkAsync((node: TreeNode) => {
      nodes.push(node)
      return true
    })
    .then(() => nodes)
}

const convertedTree = async () => {
  const tree = new WorldTree()
  const converter = new SpeckleConverter(mockLoader, tree)
  await converter.traverse(ROOT_ID, objects[ROOT_ID] as never, () => {})
  await converter.convertInstances()
  return tree
}

describe('IFC instancing output', () => {
  it('consumes definition geometry and creates shared instances', async () => {
    const tree = await convertedTree()
    const nodes = await collect(tree)

    const instanced = nodes.filter((node) => node.model.instanced === true)
    expect(instanced).toHaveLength(2)
    // both instances share the very same definition object (batching relies on it)
    expect(instanced[0].model.raw).toBe(instanced[1].model.raw)
    expect(instanced[0].model.raw.applicationId).toBe(MESH_APPLICATION_ID)
    // compound ids make NodeMap group them as one instance set
    for (const node of instanced) {
      expect(node.model.id.startsWith(`${MESH_OBJECT_ID}~`)).toBe(true)
    }
    // The original definition node is gone; `findId` on the definition object
    // id now resolves to the instance nodes only, which is exactly how the
    // Batcher groups them for hardware instancing.
    const byDefinition = tree.findId(MESH_OBJECT_ID) || []
    expect(byDefinition).toHaveLength(2)
    for (const node of byDefinition) {
      expect(node.model.id.startsWith(`${MESH_OBJECT_ID}~`)).toBe(true)
      expect(node.model.instanced).toBe(true)
    }
  })

  it('keeps the placement matrix on the transform node', async () => {
    const tree = await convertedTree()
    const nodes = await collect(tree)
    const transforms = nodes.filter(
      (node) => node.model.raw?.speckle_type === 'Transform'
    )
    expect(transforms).toHaveLength(2)
    for (const transform of transforms) {
      expect(transform.model.raw.matrix).toEqual(MATRIX)
      expect(transform.model.raw.units).toBe('m')
    }
  })

  it('keeps the element data objects selectable', async () => {
    const tree = await convertedTree()
    const elements = tree.findId('element-1') || []
    expect(elements).toHaveLength(1)
    expect(elements[0].model.raw.speckle_type).toBe('Objects.Data.DataObject')
    expect(elements[0].model.raw.applicationId).toBe('element-1')
  })
})
