import type {
  GetStream,
  GetStreamCollaborators
} from '@/modules/core/domain/streams/operations'
import type { GetFirstAdmin } from '@/modules/core/domain/users/operations'
import { ProjectRecordVisibility } from '@/modules/core/helpers/types'
import { Roles } from '@speckle/shared'

export const getPreviewExecutionUserFactory =
  (deps: {
    getFirstAdmin: GetFirstAdmin
    getStream: GetStream
    getStreamCollaborators: GetStreamCollaborators
  }) =>
  async (streamId: string) => {
    const previewAdmin = await deps.getFirstAdmin()

    if (previewAdmin?.id) {
      const previewAdminStream = await deps.getStream({
        streamId,
        userId: previewAdmin.id
      })

      if (
        previewAdminStream &&
        (previewAdminStream.visibility === ProjectRecordVisibility.Public ||
          !!previewAdminStream.role)
      ) {
        return previewAdmin.id
      }
    }

    const owners = await deps.getStreamCollaborators(streamId, Roles.Stream.Owner, {
      limit: 1
    })
    if (owners[0]?.id) return owners[0].id

    const collaborators = await deps.getStreamCollaborators(streamId, undefined, {
      limit: 1
    })
    return collaborators[0]?.id
  }
