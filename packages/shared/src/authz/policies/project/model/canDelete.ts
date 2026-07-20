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
    // Ensure 'main'/'globals' doesn't get deleted by non-admin users
    const model = await loaders.getModel({
      projectId,
      modelId
    })
    if (!model) {
      return err(new ModelNotFoundError())
    }

    const isReservedModel =
      model.name === 'main' || model.name === 'globals'

    if (isReservedModel) {
      // Only server admins can delete reserved models
      const ensuredAdminRole = await ensureMinimumServerRoleFragment(loaders)({
        userId,
        role: Roles.Server.Admin
      })
      if (ensuredAdminRole.isErr) {
        return err(
          new ReservedModelNotDeletableError(
            `The '${model.name}' model cannot be deleted`
          )
        )
      }
      // Admin user - allow deletion
      return ok()
    }

    // For non-reserved models, allow deletion for any logged-in server user
    const ensuredServerRole = await ensureMinimumServerRoleFragment(loaders)({
      userId,
      role: Roles.Server.User
    })
    if (ensuredServerRole.isErr) {
      return err(ensuredServerRole.error)
    }

    return ok()
  }
