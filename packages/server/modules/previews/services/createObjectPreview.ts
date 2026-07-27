import { DefaultAppIds } from '@/modules/auth/defaultApps'
import type {
  GetStream,
  GetStreamCollaborators
} from '@/modules/core/domain/streams/operations'
import type { CreateAndStoreAppToken } from '@/modules/core/domain/tokens/operations'
import type { GetFirstAdmin } from '@/modules/core/domain/users/operations'
import type {
  CreateObjectPreview,
  RequestObjectPreview,
  StoreObjectPreview
} from '@/modules/previews/domain/operations'
import { Scopes, TIME_MS } from '@speckle/shared'
import { TokenResourceIdentifierType } from '@/modules/core/domain/tokens/types'
import { toJobId } from '@speckle/shared/workers/previews'
import { PreviewProjectOwnerNotFoundError } from '@/modules/previews/errors/errors'
import { getPreviewExecutionUserFactory } from '@/modules/previews/services/previewExecutionUser'

export const createObjectPreviewFactory =
  ({
    getFirstAdmin,
    getStream,
    getStreamCollaborators,
    createAppToken,
    requestObjectPreview,
    storeObjectPreview,
    serverOrigin
  }: {
    getFirstAdmin: GetFirstAdmin
    getStream: GetStream
    getStreamCollaborators: GetStreamCollaborators
    serverOrigin: string
    createAppToken: CreateAndStoreAppToken
    requestObjectPreview: RequestObjectPreview
    storeObjectPreview: StoreObjectPreview
  }): CreateObjectPreview => {
    const getPreviewExecutionUser = getPreviewExecutionUserFactory({
      getFirstAdmin,
      getStream,
      getStreamCollaborators
    })

    return async ({ streamId, objectId, priority }) => {
      const userId = await getPreviewExecutionUser(streamId)
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
        `/streams/${streamId}/objects/${objectId}`,
        serverOrigin
      ).toString()

      await requestObjectPreview({
        jobId,
        token,
        url
      })
      return true
    }
  }
