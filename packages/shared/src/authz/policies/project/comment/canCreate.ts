import { err, ok } from 'true-myth/result'
import { MaybeUserContext, ProjectContext } from '../../../domain/context.js'
import { AuthPolicy } from '../../../domain/policies.js'
import { ensureMinimumServerRoleFragment } from '../../../fragments/server.js'
import { Loaders } from '../../../domain/loaders.js'
import {
  ProjectNotEnoughPermissionsError,
  ProjectNotFoundError,
  ServerNoAccessError,
  ServerNoSessionError,
  ServerNotEnoughPermissionsError
} from '../../../domain/authErrors.js'

export const canCreateProjectCommentPolicy: AuthPolicy<
  | typeof Loaders.getProject
  | typeof Loaders.getServerRole
  | typeof Loaders.getEnv
  | typeof Loaders.getWorkspaceRole
  | typeof Loaders.getWorkspace
  | typeof Loaders.getWorkspaceSsoProvider
  | typeof Loaders.getWorkspaceSsoSession
  | typeof Loaders.getProjectRole,
  MaybeUserContext & ProjectContext,
  InstanceType<
    | typeof ProjectNotFoundError
    | typeof ServerNoAccessError
    | typeof ServerNoSessionError
    | typeof ProjectNotEnoughPermissionsError
    | typeof ServerNotEnoughPermissionsError
  >
> =
  (loaders) =>
  async ({ userId, projectId }) => {
    // Ensure server access
    const ensuredServerRole = await ensureMinimumServerRoleFragment(loaders)({
      userId
    })
    if (ensuredServerRole.isErr) {
      return err(ensuredServerRole.error)
    }

    const project = await loaders.getProject({ projectId })
    if (!project) return err(new ProjectNotFoundError())

    return ok()
  }
