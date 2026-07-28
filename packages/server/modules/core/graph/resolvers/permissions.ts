import type { Resolvers } from '@/modules/core/graph/generated/graphql'
import { Authz } from '@speckle/shared'
import { db } from '@/db/knex'
import { getMyEffectivePermissionFactory } from '@/modules/custom-role/repositories/customRoles'

const getMyEffectivePermission = getMyEffectivePermissionFactory({ db })

export default {
  Project: {
    permissions: (parent) => ({ projectId: parent.id })
  },
  Model: {
    permissions: (parent) => ({
      projectId: parent.streamId,
      modelId: parent.id
    })
  },
  Version: {
    permissions: (parent) => ({
      projectId: parent.streamId,
      versionId: parent.id
    })
  },
  User: {
    permissions: () => ({})
  },
  PermissionCheckResult: {
    errorMessage: (parent) => (parent.authorized ? undefined : parent.message)
  },
  ProjectPermissionChecks: {
    canCreateModel: async (parent, _args, ctx) => {
      let res: any
      if (ctx.userId) {
        try {
          const perm = await getMyEffectivePermission({ userId: ctx.userId })
          if (perm.roleId !== null) {
            const authorized = perm.isAdmin || perm.modelPerms.includes('file-management:create')
            res = authorized
              ? { authorized: true, code: 'OK', message: 'OK', payload: null }
              : { authorized: false, code: 'FORBIDDEN', message: '您的角色没有创建模型的权限。', payload: null }
            console.log(`[SPECKLE-DUI-LOG] Check canCreateModel (CustomRole):`, JSON.stringify({ userId: ctx.userId, projectId: parent.projectId, result: res }))
            return res
          }
        } catch (e) {
          console.error('Check custom permission error in canCreateModel:', e)
        }
      }
      const canCreateModel = await ctx.authPolicies.project.model.canCreate({
        userId: ctx.userId,
        projectId: parent.projectId
      })
      res = Authz.toGraphqlResult(canCreateModel)
      console.log(`[SPECKLE-DUI-LOG] Check canCreateModel (Standard):`, JSON.stringify({ userId: ctx.userId, projectId: parent.projectId, result: res }))
      return res
    },
    canMoveToWorkspace: async (parent, args, ctx) => {
      const canMoveToWorkspace = await ctx.authPolicies.project.canMoveToWorkspace({
        userId: ctx.userId,
        projectId: parent.projectId,
        workspaceId: args.workspaceId ?? undefined
      })
      return Authz.toGraphqlResult(canMoveToWorkspace)
    },
    canRead: async (parent, _args, ctx) => {
      const canRead = await ctx.authPolicies.project.canRead({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canRead)
    },
    canUpdate: async (parent, _args, ctx) => {
      const canUpdate = await ctx.authPolicies.project.canUpdate({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canUpdate)
    },
    canDelete: async (parent, _args, ctx) => {
      const canDelete = await ctx.authPolicies.project.canDelete({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canDelete)
    },
    canUpdateAllowPublicComments: async (parent, _args, ctx) => {
      const canUpdateAllowPublicComments =
        await ctx.authPolicies.project.canUpdateAllowPublicComments({
          projectId: parent.projectId,
          userId: ctx.userId
        })
      return Authz.toGraphqlResult(canUpdateAllowPublicComments)
    },
    canReadSettings: async (parent, _args, ctx) => {
      const canReadSettings = await ctx.authPolicies.project.canReadSettings({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canReadSettings)
    },
    canReadWebhooks: async (parent, _args, ctx) => {
      const canReadWebhooks = await ctx.authPolicies.project.canReadWebhooks({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canReadWebhooks)
    },
    canLeave: async (parent, _args, ctx) => {
      const canLeave = await ctx.authPolicies.project.canLeave({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canLeave)
    },
    canRequestRender: async (parent, _args, ctx) => {
      const canRequestRender = await ctx.authPolicies.project.version.canRequestRender({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canRequestRender)
    },
    canPublish: async (parent, _args, ctx) => {
      if (ctx.userId) {
        try {
          const perm = await getMyEffectivePermission({ userId: ctx.userId })
          if (perm.roleId !== null) {
            const authorized = perm.isAdmin || perm.modelPerms.includes('file-management:publish')
            return authorized
              ? { authorized: true, code: 'OK', message: 'OK', payload: null }
              : { authorized: false, code: 'FORBIDDEN', message: '您的角色没有发布模型的权限。', payload: null }
          }
        } catch (e) {
          console.error('Check custom permission error in canPublish:', e)
        }
      }
      const canPublish = await ctx.authPolicies.project.canPublish({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canPublish)
    },
    canLoad: async (parent, _args, ctx) => {
      if (ctx.userId) {
        try {
          const perm = await getMyEffectivePermission({ userId: ctx.userId })
          if (perm.roleId !== null) {
            const authorized = perm.isAdmin || perm.modelPerms.includes('file-management:download')
            return authorized
              ? { authorized: true, code: 'OK', message: 'OK', payload: null }
              : { authorized: false, code: 'FORBIDDEN', message: '您的角色没有加载模型的权限。', payload: null }
          }
        } catch (e) {
          console.error('Check custom permission error in canLoad:', e)
        }
      }
      const canLoad = await ctx.authPolicies.project.canLoad({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canLoad)
    },
    canInvite: async (parent, _args, ctx) => {
      const canInvite = await ctx.authPolicies.project.canInvite({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canInvite)
    },
    canReadEmbedTokens: async (parent, _args, ctx) => {
      const canReadEmbedTokens = await ctx.authPolicies.project.canReadEmbedTokens({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canReadEmbedTokens)
    },
    canCreateEmbedTokens: async (parent, _args, ctx) => {
      const canCreateEmbedTokens = await ctx.authPolicies.project.canUpdateEmbedTokens({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canCreateEmbedTokens)
    },
    canRevokeEmbedTokens: async (parent, _args, ctx) => {
      const canUpdateEmbedTokens = await ctx.authPolicies.project.canUpdateEmbedTokens({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canUpdateEmbedTokens)
    }
  },
  ModelPermissionChecks: {
    canUpdate: async (parent, _args, ctx) => {
      const canUpdate = await ctx.authPolicies.project.model.canUpdate({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      const res = Authz.toGraphqlResult(canUpdate)
      console.log(`[SPECKLE-DUI-LOG] Check canUpdate:`, JSON.stringify({ userId: ctx.userId, projectId: parent.projectId, modelId: parent.modelId, result: res }))
      return res
    },
    canDelete: async (parent, _args, ctx) => {
      const canDelete = await ctx.authPolicies.project.model.canDelete({
        projectId: parent.projectId,
        userId: ctx.userId,
        modelId: parent.modelId
      })
      const res = Authz.toGraphqlResult(canDelete)
      console.log(`[SPECKLE-DUI-LOG] Check canDelete:`, JSON.stringify({ userId: ctx.userId, projectId: parent.projectId, modelId: parent.modelId, result: res }))
      return res
    },
    canCreateVersion: async (parent, _args, ctx) => {
      let res: any
      if (ctx.userId) {
        try {
          const perm = await getMyEffectivePermission({ userId: ctx.userId })
          if (perm.roleId !== null) {
            const authorized = perm.isAdmin || perm.modelPerms.includes('file-management:publish')
            res = authorized
              ? { authorized: true, code: 'OK', message: 'OK', payload: null }
              : { authorized: false, code: 'FORBIDDEN', message: '您的角色没有发布版本的权限。', payload: null }
            console.log(`[SPECKLE-DUI-LOG] Check canCreateVersion (CustomRole):`, JSON.stringify({ userId: ctx.userId, projectId: parent.projectId, modelId: parent.modelId, result: res }))
            return res
          }
        } catch (e) {
          console.error('Check custom permission error in canCreateVersion:', e)
        }
      }
      const canCreate = await ctx.authPolicies.project.version.canCreate({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      res = Authz.toGraphqlResult(canCreate)
      console.log(`[SPECKLE-DUI-LOG] Check canCreateVersion (Standard):`, JSON.stringify({ userId: ctx.userId, projectId: parent.projectId, modelId: parent.modelId, result: res }))
      return res
    },
    canCreateIngestion: async (parent, _args, ctx) => {
      let res: any
      if (ctx.userId) {
        try {
          const perm = await getMyEffectivePermission({ userId: ctx.userId })
          if (perm.roleId !== null) {
            const authorized = perm.isAdmin || perm.modelPerms.includes('file-management:publish')
            res = authorized
              ? { authorized: true, code: 'OK', message: 'OK', payload: null }
              : { authorized: false, code: 'FORBIDDEN', message: '您的角色没有发布版本的权限。', payload: null }
            console.log(`[SPECKLE-DUI-LOG] Check canCreateIngestion (CustomRole):`, JSON.stringify({ userId: ctx.userId, projectId: parent.projectId, modelId: parent.modelId, result: res }))
            return res
          }
        } catch (e) {
          console.error('Check custom permission error in canCreateIngestion:', e)
        }
      }
      const canCreate = await ctx.authPolicies.project.version.canCreate({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      res = Authz.toGraphqlResult(canCreate)
      console.log(`[SPECKLE-DUI-LOG] Check canCreateIngestion (Standard):`, JSON.stringify({ userId: ctx.userId, projectId: parent.projectId, modelId: parent.modelId, result: res }))
      return res
    }
  },
  VersionPermissionChecks: {
    canUpdate: async (parent, _args, ctx) => {
      const canUpdate = await ctx.authPolicies.project.version.canUpdate({
        projectId: parent.projectId,
        userId: ctx.userId,
        versionId: parent.versionId
      })
      return Authz.toGraphqlResult(canUpdate)
    },
    canReceive: async (parent, _args, ctx) => {
      const canReceive = await ctx.authPolicies.project.version.canReceive({
        projectId: parent.projectId,
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(canReceive)
    }
  },
  RootPermissionChecks: {
    canCreatePersonalProject: async (_parent, _args, ctx) => {
      const canCreatePersonalProject = await ctx.authPolicies.project.canCreatePersonal(
        {
          userId: ctx.userId
        }
      )
      return Authz.toGraphqlResult(canCreatePersonalProject)
    },
    canCreateWorkspace: async (_parent, _args, ctx) => {
      const policyResult = await ctx.authPolicies.workspace.canCreateWorkspace({
        userId: ctx.userId
      })
      return Authz.toGraphqlResult(policyResult)
    }
  }
} as Resolvers
