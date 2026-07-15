import { err, ok } from 'true-myth/result'
import { MaybeUserContext, ProjectContext } from '../../domain/context.js'
import { AuthPolicy } from '../../domain/policies.js'
import { Roles } from '../../../core/constants.js'
import { ensureImplicitProjectMemberWithReadAccessFragment } from '../../fragments/projects.js'
import { Loaders } from '../../domain/loaders.js'
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
} from '../../domain/authErrors.js'
import { checkIfAdminOverrideEnabledFragment } from '../../fragments/server.js'

type PolicyLoaderKeys =
  | typeof Loaders.getProject
  | typeof Loaders.getServerRole
  | typeof Loaders.getEnv
  | typeof Loaders.getAdminOverrideEnabled
  | typeof Loaders.getWorkspaceRole
  | typeof Loaders.getWorkspace
  | typeof Loaders.getWorkspaceSsoProvider
  | typeof Loaders.getWorkspaceSsoSession
  | typeof Loaders.getProjectRole
  | typeof Loaders.hasCustomPermission

type PolicyArgs = ProjectContext & MaybeUserContext

type PolicyErrors = InstanceType<
  | typeof ProjectNoAccessError
  | typeof ProjectNotFoundError
  | typeof WorkspaceNoAccessError
  | typeof ServerNoAccessError
  | typeof ServerNoSessionError
  | typeof ServerNotEnoughPermissionsError
  | typeof WorkspaceSsoSessionNoAccessError
  | typeof WorkspaceNotEnoughPermissionsError
  | typeof ProjectNotEnoughPermissionsError
>

export const canLoadPolicy: AuthPolicy<PolicyLoaderKeys, PolicyArgs, PolicyErrors> =
  (loaders) =>
  async ({ userId, projectId }) => {
    if (publiclyLoadableProjects.includes(projectId)) {
      return ok()
    }
    const hasAdminAccess = await checkIfAdminOverrideEnabledFragment(loaders)({
      userId
    })
    if (hasAdminAccess.isOk && hasAdminAccess.value) {
      return ok()
    }

    if (userId) {
      const hasCustomLoad = await loaders.hasCustomPermission({
        userId,
        permissionCode: 'file-management:download'
      })
      if (!hasCustomLoad) {
        return err(
          new ProjectNotEnoughPermissionsError({
            message: "Your role on this project doesn't give you permission to load."
          })
        )
      }
    }

    const ensuredReadAccess = await ensureImplicitProjectMemberWithReadAccessFragment(
      loaders
    )({
      userId,
      projectId
    })
    if (ensuredReadAccess.isErr) {
      return err(ensuredReadAccess.error)
    }

    return ok()
  }

const publiclyLoadableProjects = [
  '8be1007be1' // Demo models
]
