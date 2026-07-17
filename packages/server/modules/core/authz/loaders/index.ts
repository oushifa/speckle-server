import { defineModuleLoaders } from '@/modules/loaders'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import {
  adminOverrideEnabled,
  getFeatureFlags
} from '@/modules/shared/helpers/envHelper'
import { db } from '@/db/knex'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'

// TODO: Move everything to use dataLoaders
export default defineModuleLoaders(async () => {
  const getStream = getStreamFactory({ db })

  return {
    getAdminOverrideEnabled: async () => adminOverrideEnabled(),
    getEnv: async () => getFeatureFlags(),
    getProject: async ({ projectId }, { dataLoaders }) => {
      return await dataLoaders.streams.getStream.load(projectId)
    },
    getProjectRole: async ({ userId, projectId }) => {
      const project = await getStream({ streamId: projectId, userId })
      return project?.role || null
    },
    getServerRole: async ({ userId }, { dataLoaders }) => {
      return (await dataLoaders.users.getUser.load(userId))?.role || null
    },
    getProjectRoleCounts: async ({ projectId, role }, { dataLoaders }) => {
      const counts = await dataLoaders.streams.getCollaboratorCounts.load(projectId)
      return counts?.[role] || 0
    },
    getProjectModelCount: async ({ projectId }, { dataLoaders }) => {
      const db = await getProjectDbClient({ projectId })
      return await dataLoaders.forRegion({ db }).streams.getBranchCount.load(projectId)
    },
    getModel: async ({ projectId, modelId }, { dataLoaders }) => {
      const db = await getProjectDbClient({ projectId })
      const model = await dataLoaders.forRegion({ db }).branches.getById.load(modelId)
      if (!model) return null

      return {
        ...model,
        projectId: model.streamId
      }
    },
    getVersion: async ({ projectId, versionId }, { dataLoaders }) => {
      const db = await getProjectDbClient({ projectId })
      const version = await dataLoaders
        .forRegion({ db })
        .commits.getById.load(versionId)
      if (!version) return null

      return {
        ...version,
        projectId,
        authorId: version.author
      }
    },
    hasCustomPermission: async ({ userId, permissionCode }: { userId: string; permissionCode: string }) => {
      if (!userId) return false
      try {
        const { getMyEffectivePermissionFactory } = await import('@/modules/custom-role/repositories/customRoles')
        const getMyEffectivePermission = getMyEffectivePermissionFactory({ db })
        const perm = await getMyEffectivePermission({ userId })
        if (perm.isAdmin) return true
        if (perm.roleId === null) return true // Default to true if no custom roles assigned
        return perm.modelPerms.includes(permissionCode)
      } catch (e) {
        console.error('Error in hasCustomPermission loader:', e)
        return false
      }
    },
    hasProjectDataPermission: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      if (!userId) return null
      try {
        const { getMyEffectivePermissionFactory } = await import('@/modules/custom-role/repositories/customRoles')
        const getMyEffectivePermission = getMyEffectivePermissionFactory({ db })
        const perm = await getMyEffectivePermission({ userId })
        
        if (perm.roleId === null) return null // Fallback to default check
        
        if (perm.isAdmin) return true
        
        // Check if the user has project view permission
        if (!perm.modelPerms.includes('ent-projects:view')) return false
        
        // If dataPerm is 'all', they can read any project
        if (perm.dataPerms.includes('all')) return true
        
        // If dataPerm is 'self', they must be the owner of the project (stream)
        if (perm.dataPerms.includes('self')) {
          const streamAcl = await db('stream_acl')
            .where({ resourceId: projectId, userId, role: 'stream:owner' })
            .first()
          if (streamAcl) return true
        }
        
        // If dataPerm is 'project' (or 'dept' as fallback), they must be a collaborator
        if (perm.dataPerms.includes('project') || perm.dataPerms.includes('dept')) {
          const streamAcl = await db('stream_acl')
            .where({ resourceId: projectId, userId })
            .first()
          if (streamAcl) return true
        }
        
        return false
      } catch (e) {
        console.error('Error in hasProjectDataPermission loader:', e)
        return false
      }
    }
  }
})
