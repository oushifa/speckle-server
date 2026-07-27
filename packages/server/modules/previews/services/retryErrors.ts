import type { Logger } from '@/observability/logging'
import type {
  GetNumberOfJobsInRequestQueue,
  GetPaginatedObjectPreviewsInErrorState,
  GetPaginatedObjectPreviewsPage,
  GetPaginatedObjectPreviewsTotalCount,
  RequestObjectPreview,
  UpdateObjectPreview
} from '@/modules/previews/domain/operations'
import { PreviewStatus } from '@/modules/previews/domain/consts'
import { Roles, Scopes, TIME_MS } from '@speckle/shared'
import { DefaultAppIds } from '@/modules/auth/defaultApps'
import { TokenResourceIdentifierType } from '@/modules/core/domain/tokens/types'
import type { GetStreamCollaborators } from '@/modules/core/domain/streams/operations'
import type { CreateAndStoreAppToken } from '@/modules/core/domain/tokens/operations'
import type { GetFirstAdmin } from '@/modules/core/domain/users/operations'
import {
  getPreviewServiceMaxQueueBackpressure,
  getPreviewServiceTimeoutMilliseconds
} from '@/modules/shared/helpers/envHelper'

export const getPaginatedObjectPreviewInErrorStateFactory =
  (deps: {
    getPaginatedObjectPreviewsPage: GetPaginatedObjectPreviewsPage
    getPaginatedObjectPreviewsTotalCount: GetPaginatedObjectPreviewsTotalCount
    maximumNumberOfAttempts?: number
    stalePendingThresholdMs?: number
  }): GetPaginatedObjectPreviewsInErrorState =>
  async (params) => {
    const maximumNumberOfAttempts = deps.maximumNumberOfAttempts ?? 3
    const stalePendingThresholdMs =
      deps.stalePendingThresholdMs ?? getPreviewServiceTimeoutMilliseconds()
    const stalePendingUpdatedBefore = new Date(Date.now() - stalePendingThresholdMs)

    const errorFilter = {
      status: PreviewStatus.ERROR,
      maxNumberOfAttempts: maximumNumberOfAttempts
    }
    const stalePendingFilter = {
      status: PreviewStatus.PENDING,
      maxNumberOfAttempts: maximumNumberOfAttempts,
      updatedBefore: stalePendingUpdatedBefore
    }

    const [errorResult, errorTotalCount, stalePendingResult, stalePendingTotalCount] =
      await Promise.all([
        deps.getPaginatedObjectPreviewsPage({
          ...params,
          filter: errorFilter
        }),
        deps.getPaginatedObjectPreviewsTotalCount({
          ...params,
          filter: errorFilter
        }),
        deps.getPaginatedObjectPreviewsPage({
          ...params,
          filter: stalePendingFilter
        }),
        deps.getPaginatedObjectPreviewsTotalCount({
          ...params,
          filter: stalePendingFilter
        })
      ])

    const items = [...errorResult.items, ...stalePendingResult.items]
      .sort((a, b) => {
        const lastUpdateDiff = a.lastUpdate.getTime() - b.lastUpdate.getTime()
        if (lastUpdateDiff !== 0) return lastUpdateDiff
        return a.objectId.localeCompare(b.objectId)
      })
      .slice(0, params.limit)

    return {
      items,
      cursor: null,
      totalCount: errorTotalCount + stalePendingTotalCount
    }
  }

export const retryFailedPreviewsFactory = (deps: {
  getPaginatedObjectPreviewsInErrorState: GetPaginatedObjectPreviewsInErrorState
  updateObjectPreview: UpdateObjectPreview
  getFirstAdmin: GetFirstAdmin
  getStreamCollaborators: GetStreamCollaborators
  serverOrigin: string
  createAppToken: CreateAndStoreAppToken
  requestObjectPreview: RequestObjectPreview
  getNumberOfJobsInQueue: GetNumberOfJobsInRequestQueue
  region: string
}) => {
  const {
    getPaginatedObjectPreviewsInErrorState,
    updateObjectPreview,
    getFirstAdmin,
    getStreamCollaborators,
    serverOrigin,
    createAppToken,
    requestObjectPreview,
    getNumberOfJobsInQueue,
    region
  } = deps
  return async (params: { logger: Logger }): Promise<boolean> => {
    const { logger } = params
    const { items, totalCount } = await getPaginatedObjectPreviewsInErrorState({
      limit: 1, //get the least recent item that has errored
      cursor: null // always get the first item
    })
    if (items.length === 0) {
      //NOTE we rely on the items returned, as this accounts for the cursor position. More errored items might have been added since the last time we checked and changed the totalCount.
      logger.info(
        { region },
        "No object previews in an error or stale pending state were found within database region '{region}'"
      )
      return false
    }

    // do not retry if we have backpressure in the queue
    const queueLength = await getNumberOfJobsInQueue()
    if (queueLength > getPreviewServiceMaxQueueBackpressure()) {
      logger.info(
        { region, queueLength, totalErroredPreviewCount: totalCount },
        "Backpressure detected in the preview request queue, as the queue length is already {queueLength} jobs. Found {totalErroredPreviewCount} object previews in an error or stale pending state within database region '{region}', but are not retrying any on this iteration."
      )
      return false
    }

    const objPreview = items[0]
    const { streamId, objectId } = objPreview

    logger.info(
      {
        totalErroredPreviewCount: totalCount,
        streamId, //legacy
        projectId: streamId,
        objectId,
        attempts: objPreview.attempts,
        region
      },
      "Found {totalErroredPreviewCount} object previews in an error or stale pending state within database region '{region}'. Attempting to retry one: {projectId}.{objectId}. Previous attempts: {attempts}"
    )

    await updateObjectPreview({
      objectPreview: {
        ...objPreview,
        previewStatus: PreviewStatus.PENDING, // move it to pending so it doesn't get picked up again
        incrementAttempts: true // increment the number of attempts
      }
    })

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
      logger.warn(
        { streamId, projectId: streamId, objectId, region },
        "Could not retry preview for {projectId}.{objectId} in region '{region}' because no preview execution user was found."
      )
      return false
    }

    // Prefer a server admin so preview generation does not depend on project roles.
    const token = await createAppToken({
      appId: DefaultAppIds.Web,
      name: `preview-${streamId}@${objectId}`,
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
    const url = new URL(`/streams/${streamId}/objects/${objectId}`, serverOrigin).toString()
    await requestObjectPreview({ jobId: `${streamId}.${objectId}`, token, url })

    return true
  }
}
