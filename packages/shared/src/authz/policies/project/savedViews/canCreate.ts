import { Roles } from '../../../../core/constants.js'
import {
  ProjectNoAccessError,
  ProjectNotEnoughPermissionsError,
  ProjectNotFoundError,
  ServerNoAccessError,
  ServerNoSessionError,
  ServerNotEnoughPermissionsError
} from '../../../domain/authErrors.js'
import { MaybeUserContext, ProjectContext } from '../../../domain/context.js'
import { Loaders } from '../../../domain/loaders.js'
import { AuthPolicy } from '../../../domain/policies.js'
import { ensureMinimumProjectRoleFragment } from '../../../fragments/projects.js'
import {
  checkIfAdminOverrideEnabledFragment,
  ensureMinimumServerRoleFragment
} from '../../../fragments/server.js'
import { err, ok } from 'true-myth/result'

export const canCreateSavedViewPolicy: AuthPolicy<
  | typeof Loaders.getProject
  | typeof Loaders.getEnv
  | typeof Loaders.getServerRole
  | typeof Loaders.getWorkspaceRole
  | typeof Loaders.getWorkspace
  | typeof Loaders.getWorkspaceSsoProvider
  | typeof Loaders.getWorkspacePlan
  | typeof Loaders.getWorkspaceSsoSession
  | typeof Loaders.getProjectRole
  | typeof Loaders.getAdminOverrideEnabled,
  MaybeUserContext & ProjectContext,
  InstanceType<
    | typeof ProjectNotFoundError
    | typeof ServerNoAccessError
    | typeof ServerNoSessionError
    | typeof ServerNotEnoughPermissionsError
    | typeof ProjectNoAccessError
    | typeof ProjectNotEnoughPermissionsError
  >
> =
  (loaders) =>
  async ({ userId, projectId }) => {
    const ensuredServerRole = await ensureMinimumServerRoleFragment(loaders)({
      userId,
      role: Roles.Server.Guest
    })
    if (ensuredServerRole.isErr) return err(ensuredServerRole.error)

    const isAdminOverrideEnabled = await checkIfAdminOverrideEnabledFragment(loaders)({
      userId
    })
    if (isAdminOverrideEnabled.isOk && isAdminOverrideEnabled.value) return ok()

    const ensuredProjectRole = await ensureMinimumProjectRoleFragment(loaders)({
      userId: userId!,
      projectId,
      role: Roles.Stream.Contributor
    })
    if (ensuredProjectRole.isErr) {
      if (ensuredProjectRole.error.code === 'ProjectNotEnoughPermissions')
        return err(
          new ProjectNotEnoughPermissionsError({
            message:
              "Your role on this project doesn't give you permission to save views. You need the Can edit or Project owner role."
          })
        )
      return err(ensuredProjectRole.error)
    }

    return ok()
  }
