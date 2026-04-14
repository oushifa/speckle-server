import type { Resolvers } from '@/modules/core/graph/generated/graphql'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import {
  countBoqItemsFactory,
  deleteBoqItemFactory,
  deleteBoqItemSubtreeFactory,
  getBoqItemFactory,
  getBoqItemsByParentFactory,
  getBoqItemsFactory,
  getSiblingMaxSortOrderFactory,
  hasBoqChildrenFactory,
  insertBoqItemFactory,
  updateBoqItemFactory
} from '@/modules/bop-item/repositories/boq'
import {
  createBoqItemFactory,
  deleteBoqItemEntryFactory,
  getBoqSelectorOptionsFactory,
  getBoqTreeFactory,
  moveBoqItemFactory,
  updateBoqItemFactory as updateBoqItemEntryFactory
} from '@/modules/bop-item/services/boq'

const resolvers: Resolvers = {
  Project: {
    boqItems: async (parent, args, ctx) => {
      const canRead = await ctx.authPolicies.project.canRead({
        projectId: parent.id,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canRead)

      const projectDb = await getProjectDbClient({ projectId: parent.id })
      const getBoqTree = getBoqTreeFactory({
        getBoqItems: getBoqItemsFactory({ db: projectDb })
      })

      return await getBoqTree({
        projectId: parent.id,
        search: args.input?.search ?? null
      })
    },
    boqSelectorOptions: async (parent, args, ctx) => {
      const canRead = await ctx.authPolicies.project.canRead({
        projectId: parent.id,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canRead)

      const projectDb = await getProjectDbClient({ projectId: parent.id })
      const getBoqSelectorOptions = getBoqSelectorOptionsFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        getBoqItemsByParent: getBoqItemsByParentFactory({ db: projectDb }),
        countBoqItems: countBoqItemsFactory({ db: projectDb })
      })

      return await getBoqSelectorOptions({
        projectId: parent.id,
        parentId: args.input.parentId ?? null,
        search: args.input.search ?? null,
        limit: args.input.limit
      })
    }
  },
  ProjectMutations: {
    boqMutations: () => ({})
  },
  BoqMutations: {
    createItem: async (_parent, args, ctx) => {
      const canUpdate = await ctx.authPolicies.project.canUpdate({
        projectId: args.input.projectId,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canUpdate)

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const createBoqItem = createBoqItemFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        getSiblingMaxSortOrder: getSiblingMaxSortOrderFactory({ db: projectDb }),
        insertBoqItem: insertBoqItemFactory({ db: projectDb })
      })

      return await createBoqItem(args.input)
    },
    updateItem: async (_parent, args, ctx) => {
      const canUpdate = await ctx.authPolicies.project.canUpdate({
        projectId: args.input.projectId,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canUpdate)

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const updateBoqItem = updateBoqItemEntryFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        updateBoqItem: updateBoqItemFactory({ db: projectDb })
      })

      return await updateBoqItem(args.input)
    },
    moveItem: async (_parent, args, ctx) => {
      const canUpdate = await ctx.authPolicies.project.canUpdate({
        projectId: args.input.projectId,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canUpdate)

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const moveBoqItem = moveBoqItemFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        getBoqItems: getBoqItemsFactory({ db: projectDb }),
        getSiblingMaxSortOrder: getSiblingMaxSortOrderFactory({ db: projectDb }),
        updateBoqItem: updateBoqItemFactory({ db: projectDb })
      })

      return await moveBoqItem(args.input)
    },
    deleteItem: async (_parent, args, ctx) => {
      const canUpdate = await ctx.authPolicies.project.canUpdate({
        projectId: args.input.projectId,
        userId: ctx.userId
      })
      throwIfAuthNotOk(canUpdate)

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const deleteBoqItem = deleteBoqItemEntryFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        hasBoqChildren: hasBoqChildrenFactory({ db: projectDb }),
        deleteBoqItem: deleteBoqItemFactory({ db: projectDb }),
        deleteBoqItemSubtree: deleteBoqItemSubtreeFactory({ db: projectDb })
      })

      return await deleteBoqItem(args.input)
    }
  }
}

export default resolvers
