import { err, ok } from 'true-myth/result'
import {
  ProjectNoAccessError,
  ProjectNotEnoughPermissionsError,
  ProjectNotFoundError,
  ServerNoAccessError,
  ServerNoSessionError,
  ServerNotEnoughPermissionsError,
  WorkspaceNoAccessError,
  WorkspaceNotEnoughPermissionsError,
  WorkspaceSsoSessionNoAccessError
} from '../../../domain/authErrors.js'
import { MaybeUserContext, ProjectContext } from '../../../domain/context.js'
import { Loaders } from '../../../domain/loaders.js'
import { AuthPolicy } from '../../../domain/policies.js'
import { checkIfAdminOverrideEnabledFragment } from '../../../fragments/server.js'
import { ensureImplicitProjectMemberWithReadAccessFragment } from '../../../fragments/projects.js'

export const canCreateProjectVersionPolicy: AuthPolicy<
  | typeof Loaders.getProject
  | typeof Loaders.getEnv
  | typeof Loaders.getServerRole
  | typeof Loaders.getWorkspaceRole
  | typeof Loaders.getWorkspace
  | typeof Loaders.getWorkspaceSsoProvider
  | typeof Loaders.getWorkspaceSsoSession
  | typeof Loaders.getAdminOverrideEnabled
  | typeof Loaders.getProjectRole
  | typeof Loaders.hasCustomPermission,
  MaybeUserContext & ProjectContext,
  InstanceType<
    | typeof ProjectNotFoundError
    | typeof ServerNoAccessError
    | typeof ServerNoSessionError
    | typeof ProjectNoAccessError
    | typeof WorkspaceNoAccessError
    | typeof WorkspaceSsoSessionNoAccessError
    | typeof WorkspaceNotEnoughPermissionsError
    | typeof ProjectNotEnoughPermissionsError
    | typeof ServerNotEnoughPermissionsError
  >
> =
  (loaders) =>
  async ({ userId, projectId }) => {
    const isAdminOverrideEnabled = await checkIfAdminOverrideEnabledFragment(loaders)({
      userId
    })
    if (isAdminOverrideEnabled.isOk && isAdminOverrideEnabled.value) return ok()

    if (userId && loaders.hasCustomPermission) {
      const hasCustomPublish = await loaders.hasCustomPermission({
        userId,
        permissionCode: 'file-management:publish'
      })
      if (!hasCustomPublish) {
        return err(new ProjectNotEnoughPermissionsError())
      }
    }

    // Ensure user has at least implicit membership & read access
    const hasReadAccess = await ensureImplicitProjectMemberWithReadAccessFragment(
      loaders
    )({
      userId,
      projectId
    })
    if (hasReadAccess.isErr) {
      return err(hasReadAccess.error)
    }

    return ok()
  }
