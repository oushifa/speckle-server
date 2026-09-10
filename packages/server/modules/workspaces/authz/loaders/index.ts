import type { Knex } from 'knex'
import { db } from '@/db/knex'
import { getProjectModelsCountsFactory } from '@/modules/core/repositories/branches'
import { getExplicitProjects } from '@/modules/core/repositories/streams'
import { getWorkspacePlanFactory } from '@/modules/gatekeeper/repositories/billing'
import { defineModuleLoaders } from '@/modules/loaders'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  getUserSsoSessionFactory,
  getWorkspaceSsoProviderRecordFactory
} from '@/modules/workspaces/repositories/sso'
import {
  getUserEligibleWorkspacesFactory,
  getWorkspaceRoleForUserFactory
} from '@/modules/workspaces/repositories/workspaces'
import { getWorkspaceModelCountFactory } from '@/modules/workspaces/services/workspaceLimits'
import { getUsersCurrentAndEligibleToBecomeAMemberWorkspaces } from '@/modules/workspaces/services/retrieval'
import { findEmailsByUserIdFactory } from '@/modules/core/repositories/userEmails'
import { queryAllProjectsFactory } from '@/modules/core/services/projects'

// TODO: Move everything to use dataLoaders
export default defineModuleLoaders(async () => {
  const getWorkspacePlan = getWorkspacePlanFactory({ db })

  return {
    getWorkspace: async ({ workspaceId }, { dataLoaders }) => {
      return (await dataLoaders.workspaces!.getWorkspace.load(workspaceId)) || null
    },
    getWorkspaceRole: async ({ userId, workspaceId }) => {
      const role = await getWorkspaceRoleForUserFactory({ db })({
        userId,
        workspaceId
      })
      return role?.role || null
    },
    getWorkspaceSsoSession: async ({ userId, workspaceId }) => {
      const ssoSession = await getUserSsoSessionFactory({ db })({
        userId,
        workspaceId
      })
      return ssoSession || null
    },
    getWorkspaceSsoProvider: async ({ workspaceId }) => {
      const ssoProvider = await getWorkspaceSsoProviderRecordFactory({ db })({
        workspaceId
      })
      return ssoProvider || null
    },
    getWorkspaceSeat: async ({ userId, workspaceId }, { dataLoaders }) => {
      return (
        (
          await dataLoaders.gatekeeper!.getUserWorkspaceSeat.load({
            userId,
            workspaceId
          })
        )?.type || null
      )
    },
    getWorkspaceModelCount: async ({ workspaceId }) => {
      return await getWorkspaceModelCountFactory({
        queryAllProjects: queryAllProjectsFactory({
          getExplicitProjects: getExplicitProjects({ db })
        }),
        // Projects can live in different regions, so group the ids by regional db and run
        // one batched count per db instead of one query per project.
        getProjectModelsCounts: async (projectIds) => {
          const projectIdsByDb = new Map<Knex, string[]>()
          for (const projectId of projectIds) {
            const regionDb = await getProjectDbClient({ projectId })
            const ids = projectIdsByDb.get(regionDb)
            if (ids) ids.push(projectId)
            else projectIdsByDb.set(regionDb, [projectId])
          }

          const counts: { streamId: string; count: number }[] = []
          for (const [regionDb, ids] of projectIdsByDb) {
            counts.push(...(await getProjectModelsCountsFactory({ db: regionDb })(ids)))
          }
          return counts
        }
      })({ workspaceId })
    },
    getWorkspaceProjectCount: async ({ workspaceId }, { dataLoaders }) => {
      return await dataLoaders.workspaces!.getProjectCount.load(workspaceId)
    },
    getWorkspacePlan: async ({ workspaceId }) => {
      return await getWorkspacePlan({ workspaceId })
    },
    getUsersCurrentAndEligibleToBecomeAMemberWorkspaces: async ({ userId }) => {
      return await getUsersCurrentAndEligibleToBecomeAMemberWorkspaces({
        findEmailsByUserId: findEmailsByUserIdFactory({ db }),
        getUserEligibleWorkspaces: getUserEligibleWorkspacesFactory({ db })
      })({ userId })
    },
    getWorkspaceLimits: async ({ workspaceId }, { dataLoaders }) => {
      return await dataLoaders.gatekeeper!.getWorkspaceLimits.load(workspaceId)
    }
  }
})
