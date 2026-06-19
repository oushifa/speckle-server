import type { Resolvers } from '@/modules/core/graph/generated/graphql'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { throwIfAuthNotOk } from '@/modules/shared/helpers/errorHelper'
import { adminOverrideEnabled } from '@/modules/shared/helpers/envHelper'
import { Roles } from '@speckle/shared'
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
  importBoqItemsFactory,
  moveBoqItemFactory,
  updateBoqItemFactory as updateBoqItemEntryFactory
} from '@/modules/bop-item/services/boq'
import { recalculateProjectCostSummaryFactory } from '@/modules/project-statistics/services/projectCostSummaries'

const hasServerAdminOverride = (role?: string | null) =>
  adminOverrideEnabled() && role === Roles.Server.Admin

const resolvers: Resolvers = {
  Project: {
    boqItems: async (parent, args, ctx) => {
      if (!hasServerAdminOverride(ctx.role)) {
        const canRead = await ctx.authPolicies.project.canRead({
          projectId: parent.id,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canRead)
      }

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
      if (!hasServerAdminOverride(ctx.role)) {
        const canRead = await ctx.authPolicies.project.canRead({
          projectId: parent.id,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canRead)
      }

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
      if (!hasServerAdminOverride(ctx.role)) {
        const canUpdate = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canUpdate)
      }

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const createBoqItem = createBoqItemFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        getSiblingMaxSortOrder: getSiblingMaxSortOrderFactory({ db: projectDb }),
        insertBoqItem: insertBoqItemFactory({ db: projectDb })
      })

      const created = await createBoqItem(args.input)
      await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId: args.input.projectId
      })
      return created
    },
    updateItem: async (_parent, args, ctx) => {
      if (!hasServerAdminOverride(ctx.role)) {
        const canUpdate = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canUpdate)
      }

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const updateBoqItem = updateBoqItemEntryFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        updateBoqItem: updateBoqItemFactory({ db: projectDb })
      })

      const updated = await updateBoqItem(args.input)
      await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId: args.input.projectId
      })
      return updated
    },
    moveItem: async (_parent, args, ctx) => {
      if (!hasServerAdminOverride(ctx.role)) {
        const canUpdate = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canUpdate)
      }

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const moveBoqItem = moveBoqItemFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        getBoqItems: getBoqItemsFactory({ db: projectDb }),
        getSiblingMaxSortOrder: getSiblingMaxSortOrderFactory({ db: projectDb }),
        updateBoqItem: updateBoqItemFactory({ db: projectDb })
      })

      const moved = await moveBoqItem(args.input)
      await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId: args.input.projectId
      })
      return moved
    },
    deleteItem: async (_parent, args, ctx) => {
      if (!hasServerAdminOverride(ctx.role)) {
        const canUpdate = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canUpdate)
      }

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const deleteBoqItem = deleteBoqItemEntryFactory({
        getBoqItem: getBoqItemFactory({ db: projectDb }),
        hasBoqChildren: hasBoqChildrenFactory({ db: projectDb }),
        deleteBoqItem: deleteBoqItemFactory({ db: projectDb }),
        deleteBoqItemSubtree: deleteBoqItemSubtreeFactory({ db: projectDb })
      })

      const deleted = await deleteBoqItem(args.input)
      await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId: args.input.projectId
      })
      return deleted
    },
    importItems: async (_parent, args, ctx) => {
      if (!hasServerAdminOverride(ctx.role)) {
        const canUpdate = await ctx.authPolicies.project.canRead({
          projectId: args.input.projectId,
          userId: ctx.userId
        })
        throwIfAuthNotOk(canUpdate)
      }

      const projectDb = await getProjectDbClient({ projectId: args.input.projectId })
      const importBoqItems = importBoqItemsFactory({
        getBoqItems: getBoqItemsFactory({ db: projectDb }),
        createBoqItem: createBoqItemFactory({
          getBoqItem: getBoqItemFactory({ db: projectDb }),
          getSiblingMaxSortOrder: getSiblingMaxSortOrderFactory({ db: projectDb }),
          insertBoqItem: insertBoqItemFactory({ db: projectDb })
        }),
        updateBoqItem: updateBoqItemEntryFactory({
          getBoqItem: getBoqItemFactory({ db: projectDb }),
          updateBoqItem: updateBoqItemFactory({ db: projectDb })
        })
      })

      const imported = await importBoqItems({
        projectId: args.input.projectId,
        items: args.input.items.map((item) => ({
          rowNumber: item.rowNumber,
          code: item.code,
          name: item.name,
          type: item.type,
          parentCode: item.parentCode ?? null,
          unit: item.unit ?? null,
          quantity: item.quantity ?? null,
          price: item.price ?? null,
          amount: item.amount ?? null
        }))
      })
      await recalculateProjectCostSummaryFactory({ db: projectDb })({
        projectId: args.input.projectId
      })
      return imported
    }
  }
}

export default resolvers
