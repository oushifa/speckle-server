import TreeModel, { type Model } from 'tree-model'
import { NodeRenderView } from './NodeRenderView.js'
import { RenderTree } from './RenderTree.js'
import { AsyncPause } from '../World.js'
import { NodeMap } from './NodeMap.js'
import Logger from '../utils/Logger.js'

export type TreeNode = TreeModel.Node<NodeData>
export type SearchPredicate = (node: TreeNode) => boolean

export interface NodeData {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: { [prop: string]: any }
  children: TreeNode[]
  atomic: boolean
  nestedNodes?: TreeNode[]
  subtreeId?: number
  renderView?: NodeRenderView | null
  instanced?: boolean
  color?: number
}

export class WorldTree {
  private renderTreeInstances: { [id: string]: RenderTree } = {}
  private nodeMaps: { [id: string]: NodeMap } = {}
  private applicationNodeMaps: {
    [subtreeId: number]: { [applicationId: string]: { [id: string]: TreeNode } }
  } = {}
  private bimNodesMap: {
    [subtreeId: number]: { [bimId: string]: { [id: string]: TreeNode } }
  } = {}
  private readonly supressWarnings = true
  public static readonly ROOT_ID = 'ROOT'
  private subtreeId: number = 0

  public constructor() {
    this.tree = new TreeModel()
    this._root = this.parse({
      id: WorldTree.ROOT_ID,
      raw: {},
      atomic: true,
      children: [],
      renderView: null
    })
  }

  /** The root render tree will always be non-null because it will always contain the root */
  public getRenderTree(): RenderTree
  public getRenderTree(subtreeId: string): RenderTree | null
  public getRenderTree(subtreeId?: string): RenderTree | null {
    if (!this._root) {
      console.error(`WorldTree not initialised`)
      return null
    }

    const renderTreeRoot = subtreeId ? this.findSubtree(subtreeId) : this.root
    if (!renderTreeRoot) {
      return null
    }
    const subtreeRootId = renderTreeRoot.model.id
    if (!this.renderTreeInstances[subtreeRootId]) {
      this.renderTreeInstances[subtreeRootId] = new RenderTree(this, renderTreeRoot)
    }

    return this.renderTreeInstances[subtreeRootId]
  }

  private tree: TreeModel
  public _root: TreeNode

  public get root(): TreeNode {
    return this._root
  }

  private get nextSubtreeId(): number {
    return ++this.subtreeId
  }

  public get nodeCount(): number {
    let nodeCount = 0
    for (const k in this.nodeMaps) nodeCount += this.nodeMaps[k].nodeCount
    return nodeCount
  }

  public isRoot(node: TreeNode): boolean {
    return node === this._root
  }

  public isSubtreeRoot(node: TreeNode) {
    return node.parent === this._root
  }

  public parse(model: Model<NodeData>): TreeNode {
    return this.tree.parse(model)
  }

  public addSubtree(node: TreeNode) {
    if (this.nodeMaps[node.id]) {
      Logger.error(`Subtree with id ${node.id} already exists!`)
      return
    }
    const subtreeId = this.nextSubtreeId
    node.model.subtreeId = subtreeId
    this.nodeMaps[subtreeId] = new NodeMap(node)
    this.applicationNodeMaps[subtreeId] = {}
    this.registerApplicationNode(node)
    this._root.addChild(node)
  }

  public addNode(node: TreeNode, parent: TreeNode | null) {
    if (parent === null || parent.model.subtreeId === undefined) {
      Logger.error(`Invalid parent node!`)
      return
    }
    const subtreeId = parent.model.subtreeId
    node.model.subtreeId = subtreeId
    if (this.nodeMaps[subtreeId]?.addNode(node)) {
      this.registerApplicationNode(node)
      if (this.bimNodesMap[subtreeId]) {
        this.registerBimNode(node)
      }
      parent.addChild(node)
    }
  }

  public removeNode(node: TreeNode, removeChildren: boolean): void {
    const children = node.children
    const subtreeId = node.model.subtreeId
    this.unregisterApplicationNode(node)
    if (subtreeId !== undefined && this.bimNodesMap[subtreeId]) {
      this.unregisterBimNode(node)
    }
    this.nodeMaps[node.model.subtreeId]?.removeNode(node)
    node.drop()
    if (!removeChildren || !children) return
    for (let k = 0; k < children.length; k++) {
      this.removeNode(children[k], removeChildren)
    }
  }

  public hasNodeId(id: string, subtreeId: number = 1) {
    return this.nodeMaps[subtreeId] && this.nodeMaps[subtreeId].hasNodeId(id)
  }

  public hasInstanceId(id: string, subtreeId: number = 1) {
    return this.nodeMaps[subtreeId] && this.nodeMaps[subtreeId].hasInstanceId(id)
  }

  public hasId(id: string, subtreeId: number = 1) {
    return this.nodeMaps[subtreeId] && this.nodeMaps[subtreeId].hasId(id)
  }

  public findAll(predicate: SearchPredicate, node?: TreeNode): Array<TreeNode> {
    if (!node && !this.supressWarnings) {
      Logger.warn(`Root will be used for searching. You might not want that`)
    }
    return (node ? node : this.root).all(predicate)
  }

  public findId(id: string, subtreeId?: number): TreeNode[] | null {
    if (!id) return null

    let idNode = null
    if (subtreeId) {
      idNode = this.nodeMaps[subtreeId].getNodeById(id)
    } else {
      for (const k in this.nodeMaps) {
        const nodes = this.nodeMaps[k].getNodeById(id)
        if (nodes) idNode = [...nodes]
      }
    }
    return idNode
  }

  public findApplicationId(
    applicationId: string,
    subtreeId?: number
  ): TreeNode[] | null {
    if (!applicationId) return null
    const key = String(applicationId)

    if (subtreeId) {
      const map = this.applicationNodeMaps[subtreeId]?.[key]
      return map ? Object.values(map) : null
    }

    const nodes: TreeNode[] = []
    for (const k in this.applicationNodeMaps) {
      const map = this.applicationNodeMaps[k]?.[key]
      if (map) nodes.push(...Object.values(map))
    }

    return nodes.length ? nodes : null
  }

  /** TODO: Would rather not have this */
  public findSubtree(id: string) {
    let idNode = null
    for (const k in this.nodeMaps) {
      if ((idNode = this.nodeMaps[k].getSubtreeById(id))) break
    }
    return idNode
  }

  public getAncestors(node: TreeNode): Array<TreeNode> {
    return node.getPath().reverse().slice(1) // We skip the node itself
  }

  public getInstances(subtreeId: string): { [id: string]: Record<string, TreeNode> } {
    return this.nodeMaps[subtreeId].instances
  }

  public getDuplicates(subtreeId: string): { [id: string]: Record<string, TreeNode> } {
    return this.nodeMaps[subtreeId].duplicates
  }

  /** TO DO: We might want to add boolean as return type here too */
  public walk(predicate: SearchPredicate, node?: TreeNode): void {
    if (!node && !this.supressWarnings) {
      Logger.warn(`Root will be used for searching. You might not want that`)
    }
    this._root.walk(predicate, node)
  }

  public async walkAsync(
    predicate: SearchPredicate,
    node?: TreeNode
  ): Promise<boolean> {
    if (!node && !this.supressWarnings) {
      Logger.warn(`Root will be used for searching. You might not want that`)
    }
    const pause = new AsyncPause()

    let success = true
    async function depthFirstPreOrderAsync(
      callback: SearchPredicate,
      context: TreeNode
    ) {
      let i, childCount
      pause.tick(100)
      if (pause.needsWait) {
        await pause.wait(16)
      }

      success &&= callback(context)

      for (i = 0, childCount = context.children.length; i < childCount; i++) {
        if (!(await depthFirstPreOrderAsync(callback, context.children[i]))) break
      }
      return success
    }

    return depthFirstPreOrderAsync(predicate, node ? node : this._root)
  }

  public purge(subtreeId?: string) {
    if (subtreeId) {
      delete this.renderTreeInstances[subtreeId]
      const subtreeNode = this.findId(subtreeId)
      if (subtreeNode) {
        const currentSubtreeId = subtreeNode[0].model.subtreeId
        this.nodeMaps[currentSubtreeId].purge()
        delete this.nodeMaps[currentSubtreeId]
        delete this.applicationNodeMaps[currentSubtreeId]
        delete this.bimNodesMap[currentSubtreeId]
        // Potentially true?
        this.removeNode(subtreeNode[0], false)
      }
      return
    }

    Object.keys(this.renderTreeInstances).forEach(
      (key) => delete this.renderTreeInstances[key]
    )
    Object.keys(this.nodeMaps).forEach((key) => {
      this.nodeMaps[key].purge
      delete this.nodeMaps[key]
    })
    Object.keys(this.applicationNodeMaps).forEach((key) => {
      delete this.applicationNodeMaps[parseInt(key, 10)]
    })
    Object.keys(this.bimNodesMap).forEach((key) => {
      delete this.bimNodesMap[parseInt(key, 10)]
    })

    this._root.drop()
    this._root.children.length = 0
    this.tree = new TreeModel()
    this._root = this.tree.parse({
      id: WorldTree.ROOT_ID,
      raw: {},
      atomic: true,
      children: []
    })
  }

  private registerApplicationNode(node: TreeNode) {
    const subtreeId = node.model.subtreeId
    const applicationId = node.model.raw?.applicationId
    if (!subtreeId || !applicationId) return

    const key = String(applicationId)
    if (!this.applicationNodeMaps[subtreeId]) this.applicationNodeMaps[subtreeId] = {}
    if (!this.applicationNodeMaps[subtreeId][key])
      this.applicationNodeMaps[subtreeId][key] = {}

    this.applicationNodeMaps[subtreeId][key][node.model.id] = node
  }

  private unregisterApplicationNode(node: TreeNode) {
    const subtreeId = node.model.subtreeId
    const applicationId = node.model.raw?.applicationId
    if (!subtreeId || !applicationId) return

    const key = String(applicationId)
    const map = this.applicationNodeMaps[subtreeId]?.[key]
    if (!map) return

    delete map[node.model.id]
    if (Object.keys(map).length === 0) {
      delete this.applicationNodeMaps[subtreeId][key]
    }
  }

  public getBimNodesMap(subtreeId: number): { [bimId: string]: { [id: string]: TreeNode } } {
    if (!this.bimNodesMap[subtreeId]) {
      this.buildBimNodesMap(subtreeId)
    }
    return this.bimNodesMap[subtreeId] || {}
  }

  public findBimNodeId(
    bimId: string,
    subtreeId?: number
  ): TreeNode[] | null {
    if (!bimId) return null
    const key = String(bimId)

    if (subtreeId) {
      const map = this.getBimNodesMap(subtreeId)?.[key]
      return map ? Object.values(map) : null
    }

    const nodes: TreeNode[] = []
    for (const k in this.nodeMaps) {
      const subId = parseInt(k, 10)
      const map = this.getBimNodesMap(subId)?.[key]
      if (map) nodes.push(...Object.values(map))
    }

    return nodes.length ? nodes : null
  }

  private buildBimNodesMap(subtreeId: number) {
    const allSubtreeNodes = this.nodeMaps[subtreeId]?.allNodes || []
    let spaceCode = ''

    for (const node of allSubtreeNodes) {
      if (this.isProjectInfoNode(node)) {
        const sc = this.getPropertyValue(node.model.raw, ['空间代码', 'spacecode'])
        if (sc) {
          spaceCode = sc
          break
        }
      }
    }

    const map: { [bimId: string]: { [id: string]: TreeNode } } = {}

    for (const node of allSubtreeNodes) {
      const classCode = this.getPropertyValue(node.model.raw, ['分类对象代码', 'classificationobjectcode']) || ''
      const sectionCode = this.getPropertyValue(node.model.raw, ['分部分项代码', 'sectionitemcode']) || ''
      const serialNum = this.getPropertyValue(node.model.raw, ['序号码', '序号', 'serialnumber']) || ''

      let nodeSpaceCode = spaceCode
      if (!nodeSpaceCode) {
        nodeSpaceCode = this.getPropertyValue(node.model.raw, ['空间代码', 'spacecode']) || ''
      }

      if (classCode && nodeSpaceCode && sectionCode && serialNum) {
        const bimId = serialNum
        if (bimId.trim()) {
          if (!map[bimId]) {
            map[bimId] = {}
          }
          map[bimId][node.model.id] = node
        }
      }
    }

    this.bimNodesMap[subtreeId] = map
  }

  private registerBimNode(node: TreeNode) {
    const subtreeId = node.model.subtreeId
    if (!subtreeId || !this.bimNodesMap[subtreeId]) return

    if (this.isProjectInfoNode(node)) {
      const newSpaceCode = this.getPropertyValue(node.model.raw, ['空间代码', 'spacecode'])
      if (newSpaceCode) {
        this.buildBimNodesMap(subtreeId)
        return
      }
    }

    let spaceCode = ''
    const allSubtreeNodes = this.nodeMaps[subtreeId]?.allNodes || []
    for (const n of allSubtreeNodes) {
      if (this.isProjectInfoNode(n)) {
        const sc = this.getPropertyValue(n.model.raw, ['空间代码', 'spacecode'])
        if (sc) {
          spaceCode = sc
          break
        }
      }
    }

    const classCode = this.getPropertyValue(node.model.raw, ['分类对象代码', 'classificationobjectcode']) || ''
    const sectionCode = this.getPropertyValue(node.model.raw, ['分部分项代码', 'sectionitemcode']) || ''
    const serialNum = this.getPropertyValue(node.model.raw, ['序号码', '序号', 'serialnumber']) || ''

    let nodeSpaceCode = spaceCode
    if (!nodeSpaceCode) {
      nodeSpaceCode = this.getPropertyValue(node.model.raw, ['空间代码', 'spacecode']) || ''
    }

    if (classCode && nodeSpaceCode && sectionCode && serialNum) {
      const bimId = serialNum
      if (bimId.trim()) {
        if (!this.bimNodesMap[subtreeId][bimId]) {
          this.bimNodesMap[subtreeId][bimId] = {}
        }
        this.bimNodesMap[subtreeId][bimId][node.model.id] = node
      }
    }
  }

  private unregisterBimNode(node: TreeNode) {
    const subtreeId = node.model.subtreeId
    if (!subtreeId || !this.bimNodesMap[subtreeId]) return

    if (this.isProjectInfoNode(node)) {
      this.buildBimNodesMap(subtreeId)
      return
    }

    let spaceCode = ''
    const allSubtreeNodes = this.nodeMaps[subtreeId]?.allNodes || []
    for (const n of allSubtreeNodes) {
      if (n !== node && this.isProjectInfoNode(n)) {
        const sc = this.getPropertyValue(n.model.raw, ['空间代码', 'spacecode'])
        if (sc) {
          spaceCode = sc
          break
        }
      }
    }

    const classCode = this.getPropertyValue(node.model.raw, ['分类对象代码', 'classificationobjectcode']) || ''
    const sectionCode = this.getPropertyValue(node.model.raw, ['分部分项代码', 'sectionitemcode']) || ''
    const serialNum = this.getPropertyValue(node.model.raw, ['序号码', '序号', 'serialnumber']) || ''

    let nodeSpaceCode = spaceCode
    if (!nodeSpaceCode) {
      nodeSpaceCode = this.getPropertyValue(node.model.raw, ['空间代码', 'spacecode']) || ''
    }

    if (classCode && nodeSpaceCode && sectionCode && serialNum) {
      const bimId = serialNum
      if (bimId.trim()) {
        const map = this.bimNodesMap[subtreeId][bimId]
        if (map) {
          delete map[node.model.id]
          if (Object.keys(map).length === 0) {
            delete this.bimNodesMap[subtreeId][bimId]
          }
        }
      }
    }
  }

  private isProjectInfoNode(node: TreeNode): boolean {
    const raw = node.model.raw
    if (!raw) return false

    const category = raw.category
    if (typeof category === 'string' && (category === '项目信息' || category.toLowerCase() === 'project information' || category.toLowerCase() === 'project info')) {
      return true
    }

    const name = raw.name
    if (typeof name === 'string' && (name === '项目信息' || name.toLowerCase() === 'project information' || name.toLowerCase() === 'project info')) {
      return true
    }

    const type = raw.type || raw.speckle_type
    if (typeof type === 'string' && (type.includes('ProjectInformation') || type.includes('ProjectInfo') || type.includes('项目信息'))) {
      return true
    }

    return false
  }

  private getPropertyValue(raw: any, aliases: string[]): string | null {
    if (!raw || typeof raw !== 'object') return null

    const clean = (val: string) => val.toLowerCase().replace(/[\s_.:/\\()[\]{}（）-]/g, '')
    const normalizedAliases = aliases.map(clean)

    const entries: Array<{ key: string; path: string; value: any }> = []
    const visited = new Set()

    const flatten = (obj: any, currentPath = '') => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj) || visited.has(obj)) return
      visited.add(obj)

      const ignoredKeys = [
        '__closure',
        'displayMesh',
        'displayValue',
        'totalChildrenCount',
        '__importedUrl',
        '__parents',
        'bbox'
      ]

      for (const [key, rawValue] of Object.entries(obj)) {
        if (ignoredKeys.includes(key)) continue

        const newPath = currentPath ? `${currentPath}.${key}` : key

        if (
          rawValue &&
          typeof rawValue === 'object' &&
          !Array.isArray(rawValue) &&
          'name' in rawValue &&
          'value' in rawValue
        ) {
          const param = rawValue as { name?: any; value?: any }
          const parameterName = typeof param.name === 'string' && param.name.length ? param.name : key
          entries.push({
            key: parameterName,
            path: newPath,
            value: param.value
          })
          continue
        }

        if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
          flatten(rawValue, newPath)
          continue
        }

        entries.push({
          key,
          path: newPath,
          value: rawValue
        })
      }
    }

    flatten(raw)

    const formatVal = (value: any): string | null => {
      if (value === null || value === undefined || value === '') return null
      if (Array.isArray(value)) return value.length ? value.join(', ') : null
      if (typeof value === 'object') return null
      return String(value)
    }

    const exactMatch = entries.find((entry) => {
      const keyNorm = clean(entry.key)
      const pathNorm = clean(entry.path)
      return normalizedAliases.some((alias) => keyNorm === alias || pathNorm === alias)
    })
    if (exactMatch) return formatVal(exactMatch.value)

    const fuzzyMatch = entries.find((entry) => {
      const keyNorm = clean(entry.key)
      const pathNorm = clean(entry.path)
      return normalizedAliases.some(
        (alias) => keyNorm.includes(alias) || pathNorm.includes(alias)
      )
    })
    if (fuzzyMatch) return formatVal(fuzzyMatch.value)

    return null
  }
}
