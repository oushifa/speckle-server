import type { Collection } from '@/modules/shared/helpers/dbHelper'
import type { BoqItemRecord, BoqItemType } from '@/modules/core/repositories/boq'
import { boqItemTypes } from '@/modules/core/repositories/boq'
import { BoqItemNotFoundError, BoqItemValidationError } from '@/modules/core/errors/boq'
import { clamp } from 'lodash-es'
import cryptoRandomString from 'crypto-random-string'

const typeDepthMap: Record<BoqItemType, number> = {
  PROJECT: 0,
  CATEGORY: 1,
  SECTION: 2,
  SUBSECTION: 3,
  ITEM: 4
}

const parentChildTypeMap: Partial<Record<BoqItemType, BoqItemType>> = {
  PROJECT: 'CATEGORY',
  CATEGORY: 'SECTION',
  SECTION: 'SUBSECTION',
  SUBSECTION: 'ITEM'
}

const requiredParentTypeMap: Partial<Record<BoqItemType, BoqItemType>> = {
  CATEGORY: 'PROJECT',
  SECTION: 'CATEGORY',
  SUBSECTION: 'SECTION',
  ITEM: 'SUBSECTION'
}

export type BoqItem = {
  id: string
  projectId: string
  parentId: string | null
  type: BoqItemType
  code: string
  name: string
  unit: string | null
  quantity: number | null
  price: number | null
  sortOrder: number
  depth: number
  createdAt: Date
  updatedAt: Date
  hasChildren: boolean
  children: BoqItem[]
}

const toNullableNumber = (value: string | null): number | null => {
  if (value === null || value === undefined) return null
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

const toBoqItem = (item: BoqItemRecord): BoqItem => ({
  ...item,
  quantity: toNullableNumber(item.quantity),
  price: toNullableNumber(item.price),
  hasChildren: false,
  children: []
})

const validateType = (type: string): type is BoqItemType => {
  return boqItemTypes.includes(type as BoqItemType)
}

const buildBoqTree = (items: BoqItemRecord[]) => {
  const nodes = items.map(toBoqItem)
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const roots: BoqItem[] = []

  nodes.forEach((item) => {
    if (!item.parentId) {
      roots.push(item)
      return
    }
    const parent = byId.get(item.parentId)
    if (!parent) {
      roots.push(item)
      return
    }
    parent.children.push(item)
    parent.hasChildren = true
  })

  return roots
}

export type GetBoqTree = (params: {
  projectId: string
  search?: string | null
}) => Promise<BoqItem[]>

export const getBoqTreeFactory =
  (deps: {
    getBoqItems: (params: { projectId: string }) => Promise<BoqItemRecord[]>
  }): GetBoqTree =>
  async ({ projectId, search }) => {
    const items = await deps.getBoqItems({ projectId })
    if (!search?.length) return buildBoqTree(items)

    const normalizedSearch = search.toLocaleLowerCase()
    const byId = new Map(items.map((item) => [item.id, item]))
    const includedIds = new Set<string>()

    items.forEach((item) => {
      const matched =
        item.name.toLocaleLowerCase().includes(normalizedSearch) ||
        item.code.toLocaleLowerCase().includes(normalizedSearch)
      if (!matched) return
      includedIds.add(item.id)
      let parentId = item.parentId
      while (parentId) {
        includedIds.add(parentId)
        parentId = byId.get(parentId)?.parentId || null
      }
    })

    const filtered = items.filter((item) => includedIds.has(item.id))
    return buildBoqTree(filtered)
  }

export type GetBoqSelectorOptions = (params: {
  projectId: string
  parentId: string | null
  search?: string | null
  limit?: number | null
}) => Promise<Collection<BoqItem>>

export const getBoqSelectorOptionsFactory =
  (deps: {
    getBoqItem: (params: {
      projectId: string
      id: string
    }) => Promise<BoqItemRecord | undefined>
    getBoqItemsByParent: (params: {
      projectId: string
      parentId: string | null
      type?: BoqItemType
      search?: string | null
      limit?: number | null
    }) => Promise<BoqItemRecord[]>
    countBoqItems: (params: {
      projectId: string
      parentId: string | null
      search?: string | null
    }) => Promise<number>
  }): GetBoqSelectorOptions =>
  async ({ projectId, parentId, search, limit }) => {
    let nextType: BoqItemType | undefined = 'PROJECT'

    if (parentId) {
      const parent = await deps.getBoqItem({ projectId, id: parentId })
      if (!parent) throw new BoqItemNotFoundError()
      nextType = parentChildTypeMap[parent.type]
    }

    if (!nextType) {
      return {
        items: [],
        totalCount: 0,
        cursor: null
      }
    }

    const selectorLimit = clamp(limit ?? 50, 1, 200)
    const [items, totalCount] = await Promise.all([
      deps.getBoqItemsByParent({
        projectId,
        parentId,
        search,
        type: nextType,
        limit: selectorLimit
      }),
      deps.countBoqItems({ projectId, parentId, search })
    ])

    return {
      items: items.map(toBoqItem),
      totalCount,
      cursor: null
    }
  }

export type CreateBoqItem = (params: {
  projectId: string
  parentId?: string | null
  type: string
  code: string
  name: string
  unit?: string | null
  quantity?: number | null
  price?: number | null
  sortOrder?: number | null
}) => Promise<BoqItem>

export const createBoqItemFactory =
  (deps: {
    getBoqItem: (params: {
      projectId: string
      id: string
    }) => Promise<BoqItemRecord | undefined>
    getSiblingMaxSortOrder: (params: {
      projectId: string
      parentId: string | null
    }) => Promise<number | null>
    insertBoqItem: (item: BoqItemRecord) => Promise<void>
  }): CreateBoqItem =>
  async ({
    projectId,
    parentId,
    type,
    code,
    name,
    unit,
    quantity,
    price,
    sortOrder
  }) => {
    if (!validateType(type)) {
      throw new BoqItemValidationError('Invalid BOQ item type')
    }

    const resolvedParentId: string | null = parentId ?? null
    if (type === 'PROJECT') {
      if (resolvedParentId) {
        throw new BoqItemValidationError('PROJECT type cannot have parent')
      }
    } else {
      if (!resolvedParentId) {
        throw new BoqItemValidationError(`${type} type must have parent`)
      }
      const parent = await deps.getBoqItem({ projectId, id: resolvedParentId })
      if (!parent) throw new BoqItemNotFoundError()
      const requiredType = requiredParentTypeMap[type]
      if (parent.type !== requiredType) {
        throw new BoqItemValidationError(
          `Invalid parent type for ${type}, expected ${requiredType}`
        )
      }
    }

    const maxSortOrder = await deps.getSiblingMaxSortOrder({
      projectId,
      parentId: resolvedParentId
    })
    const now = new Date()
    const item: BoqItemRecord = {
      id: cryptoRandomString({ length: 10 }),
      projectId,
      parentId: resolvedParentId,
      type,
      code,
      name,
      unit: unit ?? null,
      quantity: quantity === null || quantity === undefined ? null : String(quantity),
      price: price === null || price === undefined ? null : String(price),
      sortOrder: sortOrder ?? (maxSortOrder !== null ? maxSortOrder + 1 : 0),
      depth: typeDepthMap[type],
      createdAt: now,
      updatedAt: now
    }
    await deps.insertBoqItem(item)
    return toBoqItem(item)
  }

export type UpdateBoqItem = (params: {
  projectId: string
  itemId: string
  code?: string | null
  name?: string | null
  unit?: string | null
  quantity?: number | null
  price?: number | null
  sortOrder?: number | null
}) => Promise<BoqItem>

export const updateBoqItemFactory =
  (deps: {
    getBoqItem: (params: {
      projectId: string
      id: string
    }) => Promise<BoqItemRecord | undefined>
    updateBoqItem: (params: {
      projectId: string
      id: string
      item: Partial<
        Pick<
          BoqItemRecord,
          | 'parentId'
          | 'code'
          | 'name'
          | 'unit'
          | 'quantity'
          | 'price'
          | 'sortOrder'
          | 'updatedAt'
        >
      >
    }) => Promise<number>
  }): UpdateBoqItem =>
  async ({ projectId, itemId, code, name, unit, quantity, price, sortOrder }) => {
    const item = await deps.getBoqItem({ projectId, id: itemId })
    if (!item) throw new BoqItemNotFoundError()

    const updated: BoqItemRecord = {
      ...item,
      code: code ?? item.code,
      name: name ?? item.name,
      unit: unit !== undefined ? unit : item.unit,
      quantity:
        quantity === undefined
          ? item.quantity
          : quantity === null
          ? null
          : String(quantity),
      price: price === undefined ? item.price : price === null ? null : String(price),
      sortOrder: sortOrder ?? item.sortOrder,
      updatedAt: new Date()
    }

    await deps.updateBoqItem({
      projectId,
      id: itemId,
      item: {
        code: updated.code,
        name: updated.name,
        unit: updated.unit,
        quantity: updated.quantity,
        price: updated.price,
        sortOrder: updated.sortOrder,
        updatedAt: updated.updatedAt
      }
    })

    return toBoqItem(updated)
  }

export type MoveBoqItem = (params: {
  projectId: string
  itemId: string
  parentId?: string | null
  sortOrder?: number | null
}) => Promise<BoqItem>

export const moveBoqItemFactory =
  (deps: {
    getBoqItem: (params: {
      projectId: string
      id: string
    }) => Promise<BoqItemRecord | undefined>
    getBoqItems: (params: { projectId: string }) => Promise<BoqItemRecord[]>
    getSiblingMaxSortOrder: (params: {
      projectId: string
      parentId: string | null
    }) => Promise<number | null>
    updateBoqItem: (params: {
      projectId: string
      id: string
      item: Partial<
        Pick<
          BoqItemRecord,
          | 'parentId'
          | 'code'
          | 'name'
          | 'unit'
          | 'quantity'
          | 'price'
          | 'sortOrder'
          | 'updatedAt'
        >
      >
    }) => Promise<number>
  }): MoveBoqItem =>
  async ({ projectId, itemId, parentId, sortOrder }) => {
    const item = await deps.getBoqItem({ projectId, id: itemId })
    if (!item) throw new BoqItemNotFoundError()

    const nextParentId = parentId ?? null
    if (item.type === 'PROJECT') {
      if (nextParentId) {
        throw new BoqItemValidationError('PROJECT type cannot have parent')
      }
    } else {
      if (!nextParentId) {
        throw new BoqItemValidationError(`${item.type} type must have parent`)
      }
      const parent = await deps.getBoqItem({ projectId, id: nextParentId })
      if (!parent) throw new BoqItemNotFoundError()
      const requiredType = requiredParentTypeMap[item.type]
      if (parent.type !== requiredType) {
        throw new BoqItemValidationError(
          `Invalid parent type for ${item.type}, expected ${requiredType}`
        )
      }
      const allItems = await deps.getBoqItems({ projectId })
      const byId = new Map(allItems.map((i) => [i.id, i]))
      let cursor: string | null = nextParentId
      while (cursor) {
        if (cursor === item.id) {
          throw new BoqItemValidationError('Cannot move BOQ item under its own subtree')
        }
        cursor = byId.get(cursor)?.parentId || null
      }
    }

    const maxSortOrder = await deps.getSiblingMaxSortOrder({
      projectId,
      parentId: nextParentId
    })
    const nextSortOrder = sortOrder ?? (maxSortOrder !== null ? maxSortOrder + 1 : 0)
    const updatedAt = new Date()

    await deps.updateBoqItem({
      projectId,
      id: itemId,
      item: {
        parentId: nextParentId,
        sortOrder: nextSortOrder,
        updatedAt
      }
    })

    return toBoqItem({
      ...item,
      parentId: nextParentId,
      sortOrder: nextSortOrder,
      updatedAt
    })
  }

export type DeleteBoqItem = (params: {
  projectId: string
  itemId: string
  cascade?: boolean | null
}) => Promise<boolean>

export const deleteBoqItemEntryFactory =
  (deps: {
    getBoqItem: (params: {
      projectId: string
      id: string
    }) => Promise<BoqItemRecord | undefined>
    hasBoqChildren: (params: { projectId: string; id: string }) => Promise<boolean>
    deleteBoqItem: (params: { projectId: string; id: string }) => Promise<number>
    deleteBoqItemSubtree: (params: { projectId: string; id: string }) => Promise<void>
  }): DeleteBoqItem =>
  async ({ projectId, itemId, cascade }) => {
    const item = await deps.getBoqItem({ projectId, id: itemId })
    if (!item) throw new BoqItemNotFoundError()

    const hasChildren = await deps.hasBoqChildren({ projectId, id: itemId })
    if (hasChildren && !cascade) {
      throw new BoqItemValidationError(
        'BOQ item has children, set cascade=true to delete'
      )
    }

    if (cascade) {
      await deps.deleteBoqItemSubtree({ projectId, id: itemId })
      return true
    }

    await deps.deleteBoqItem({ projectId, id: itemId })
    return true
  }
