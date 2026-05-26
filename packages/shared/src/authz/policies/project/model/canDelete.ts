import { err, ok } from 'true-myth/result'
import {
  MaybeUserContext,
  ModelContext,
  ProjectContext
} from '../../../domain/context.js'
import { AuthPolicy } from '../../../domain/policies.js'
import { ensureMinimumServerRoleFragment } from '../../../fragments/server.js'
import { Loaders } from '../../../domain/loaders.js'
import {
  ReservedModelNotDeletableError,
  ModelNotFoundError,
  ProjectNotFoundError,
  ServerNoAccessError,
  ServerNoSessionError,
  ServerNotEnoughPermissionsError
} from '../../../domain/authErrors.js'
import { Roles } from '../../../../core/constants.js'

export const canDeleteModelPolicy: AuthPolicy<
  | typeof Loaders.getModel
  | typeof Loaders.getServerRole,
  ProjectContext & MaybeUserContext & ModelContext,
  InstanceType<
    | typeof ProjectNotFoundError
    | typeof ServerNoAccessError
    | typeof ServerNoSessionError
    | typeof ModelNotFoundError
    | typeof ReservedModelNotDeletableError
    | typeof ServerNotEnoughPermissionsError
  >
> =
  (loaders) =>
  async ({ userId, projectId, modelId }) => {
    // Allow model deletion for any logged-in server user.
    const ensuredServerRole = await ensureMinimumServerRoleFragment(loaders)({
      userId,
      role: Roles.Server.User
    })
    if (ensuredServerRole.isErr) {
      return err(ensuredServerRole.error)
    }

    // Ensure 'main'/'globals' doesn't get deleted
    const model = await loaders.getModel({
      projectId,
      modelId
    })
    if (!model) {
      return err(new ModelNotFoundError())
    }

    if (model.name === 'main') {
      return err(
        new ReservedModelNotDeletableError("The 'main' model cannot be deleted")
      )
    }
    if (model.name === 'globals') {
      return err(
        new ReservedModelNotDeletableError("The 'globals' model cannot be deleted")
      )
    }

    return ok()
  }
