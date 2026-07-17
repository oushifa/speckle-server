import { err, ok } from 'true-myth/result'
import { Roles } from '../../../../core/constants.js'
import { hasMinimumWorkspaceRole } from '../../../checks/workspaceRole.js'
import {
  ProjectNotFoundError,
  ProjectNoAccessError,
  WorkspaceNoAccessError,
  WorkspaceSsoSessionNoAccessError,
  WorkspaceLimitsReachedError,
  ServerNoSessionError,
  ServerNoAccessError,
  WorkspaceReadOnlyError,
  WorkspaceNotEnoughPermissionsError,
  ProjectNotEnoughPermissionsError,
  ServerNotEnoughPermissionsError,
  PersonalProjectsLimitedError
} from '../../../domain/authErrors.js'
import { MaybeUserContext, ProjectContext } from '../../../domain/context.js'
import { AuthCheckContextLoaderKeys } from '../../../domain/loaders.js'
import { AuthPolicy } from '../../../domain/policies.js'
import { ensureImplicitProjectMemberWithWriteAccessFragment, ensureImplicitProjectMemberWithReadAccessFragment } from '../../../fragments/projects.js'
import { checkIfAdminOverrideEnabledFragment } from '../../../fragments/server.js'
import { ensureModelCanBeCreatedFragment } from '../../../fragments/workspaces.js'

type PolicyLoaderKeys =
  | typeof AuthCheckContextLoaderKeys.getEnv
  | typeof AuthCheckContextLoaderKeys.getProject
  | typeof AuthCheckContextLoaderKeys.getProjectRole
  | typeof AuthCheckContextLoaderKeys.getServerRole
  | typeof AuthCheckContextLoaderKeys.getWorkspace
  | typeof AuthCheckContextLoaderKeys.getWorkspaceRole
  | typeof AuthCheckContextLoaderKeys.getWorkspaceSsoProvider
  | typeof AuthCheckContextLoaderKeys.getWorkspaceSsoSession
  | typeof AuthCheckContextLoaderKeys.getWorkspacePlan
  | typeof AuthCheckContextLoaderKeys.getWorkspaceLimits
  | typeof AuthCheckContextLoaderKeys.getWorkspaceModelCount
  | typeof AuthCheckContextLoaderKeys.getAdminOverrideEnabled
  | typeof AuthCheckContextLoaderKeys.hasCustomPermission

type PolicyArgs = MaybeUserContext & ProjectContext

type PolicyErrors =
  | InstanceType<typeof ProjectNotFoundError>
  | InstanceType<typeof ProjectNoAccessError>
  | InstanceType<typeof WorkspaceNoAccessError>
  | InstanceType<typeof WorkspaceSsoSessionNoAccessError>
  | InstanceType<typeof WorkspaceReadOnlyError>
  | InstanceType<typeof WorkspaceLimitsReachedError>
  | InstanceType<typeof ServerNoSessionError>
  | InstanceType<typeof ServerNoAccessError>
  | InstanceType<
      | typeof WorkspaceNotEnoughPermissionsError
      | typeof ProjectNotEnoughPermissionsError
      | typeof ServerNotEnoughPermissionsError
      | typeof PersonalProjectsLimitedError
    >

export const canCreateModelPolicy: AuthPolicy<
  PolicyLoaderKeys,
  PolicyArgs,
  PolicyErrors
> =
  (loaders) =>
  async ({ userId, projectId }) => {
    const env = await loaders.getEnv()

    const isAdminOverrideEnabled = await checkIfAdminOverrideEnabledFragment(loaders)({
      userId
    })
    if (isAdminOverrideEnabled.isOk && isAdminOverrideEnabled.value) return ok()

    if (userId && loaders.hasCustomPermission) {
      const hasCustomCreate = await loaders.hasCustomPermission({
        userId,
        permissionCode: 'file-management:create'
      })
      if (!hasCustomCreate) {
        return err(new ProjectNotEnoughPermissionsError())
      }
    }

    // Ensure general read access instead of write access since custom permission allows creation
    const ensureReadAccess = await ensureImplicitProjectMemberWithReadAccessFragment(
      loaders
    )({
      userId,
      projectId
    })
    if (ensureReadAccess.isErr) {
      return err(ensureReadAccess.error)
    }

    const project = await loaders.getProject({ projectId })
    const workspaceId = project?.workspaceId
    if (userId && workspaceId && env.FF_WORKSPACES_MODULE_ENABLED) {
      const isWorkspaceAdmin = await hasMinimumWorkspaceRole(loaders)({
        userId,
        workspaceId,
        role: Roles.Workspace.Admin
      })
      if (isWorkspaceAdmin) return ok()
    }

    // Ensure (workspace?) accepts models
    const ensuredModelsAccepted = await ensureModelCanBeCreatedFragment(loaders)({
      projectId,
      userId
    })
    if (ensuredModelsAccepted.isErr) {
      return err(ensuredModelsAccepted.error)
    }

    return ok()
  }
