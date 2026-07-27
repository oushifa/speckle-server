import { DefaultAppIds } from '@/modules/auth/defaultApps'
import type { GetStreamCollaborators } from '@/modules/core/domain/streams/operations'
import type { CreateAndStoreAppToken } from '@/modules/core/domain/tokens/operations'
import type { GetFirstAdmin } from '@/modules/core/domain/users/operations'
import type {
  CreateObjectPreview,
  RequestObjectPreview,
  StoreObjectPreview
} from '@/modules/previews/domain/operations'
import { Roles, Scopes, TIME_MS } from '@speckle/shared'
import { TokenResourceIdentifierType } from '@/modules/core/domain/tokens/types'
import { toJobId } from '@speckle/shared/workers/previews'
import { PreviewProjectOwnerNotFoundError } from '@/modules/previews/errors/errors'

export const createObjectPreviewFactory =
  ({
    getFirstAdmin,
    getStreamCollaborators,
    createAppToken,
    requestObjectPreview,
    storeObjectPreview,
    serverOrigin
  }: {
    getFirstAdmin: GetFirstAdmin
    getStreamCollaborators: GetStreamCollaborators
    serverOrigin: string
    createAppToken: CreateAndStoreAppToken
    requestObjectPreview: RequestObjectPreview
    storeObjectPreview: StoreObjectPreview
  }): CreateObjectPreview =>
  async ({ streamId, objectId, priority }) => {
    const previewAdmin = await getFirstAdmin()
    const owners = previewAdmin
      ? []
      : await getStreamCollaborators(streamId, Roles.Stream.Owner, {
          limit: 1
        })
    const collaborators =
      previewAdmin || owners.length > 0
        ? []
        : await getStreamCollaborators(streamId, undefined, { limit: 1 })
    const userId = previewAdmin?.id || owners[0]?.id || collaborators[0]?.id
    if (!userId) {
      throw new PreviewProjectOwnerNotFoundError('No preview execution user found')
    }

    // use the database as a lock to prevent multiple jobs being created
    try {
      await storeObjectPreview({
        streamId,
        objectId,
        priority
      })
    } catch {
      return false
    }

    const jobId = toJobId({ projectId: streamId, objectId })

    // Prefer a server admin so preview generation does not depend on project roles.
    const token = await createAppToken({
      appId: DefaultAppIds.Web,
      name: `preview-${jobId}`,
      userId,
      scopes: [Scopes.Streams.Read],
      lifespan: 2 * TIME_MS.hour,
      limitResources: [
        {
          id: streamId,
          type: TokenResourceIdentifierType.Project
        }
      ]
    })
    const url = new URL(
      `/projects/${streamId}/models/${objectId}`,
      serverOrigin
    ).toString()

    await requestObjectPreview({
      jobId,
      token,
      url
    })
    return true
  }
