import {
  getObjectStorage,
  getSignedDownloadUrlFactory
} from '@/modules/blobstorage/clients/objectStorage'
import { getObjectKey } from '@/modules/blobstorage/helpers/blobs'
import type { FileUploadRecordV2 } from '@/modules/fileuploads/helpers/types'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import {
  createRvtConversionJobFactory,
  type RvtConversionJob,
  updateRvtConversionJobFactory
} from '@/modules/rvt-conversion/repositories/jobs'
import { createRvtConversionDelegatedToken } from '@/modules/rvt-conversion/services/tokens'
import { dispatchRvtConversionJob } from '@/modules/rvt-conversion/services/wsDispatcher'
import { getRvtConversionInternalS3Endpoint } from '@/modules/shared/helpers/envHelper'
import type { Knex } from 'knex'

const downloadUrlExpirySeconds = 24 * 60 * 60
const sourceApplicationDefault = 'External RVT Converter'

export const dispatchRvtFileImportFactory =
  (deps: { db: Knex }) =>
  async (params: {
    projectId: string
    modelId: string
    modelName: string
    fileUpload: FileUploadRecordV2
    userId: string
  }): Promise<RvtConversionJob> => {
    const { projectId, modelId, modelName, fileUpload, userId } = params
    const projectStorage = await getProjectObjectStorage({ projectId })
    const internalEndpoint = getRvtConversionInternalS3Endpoint()
    const downloadStorage = internalEndpoint
      ? getObjectStorage({
          ...projectStorage.public.params,
          endpoint: internalEndpoint
        })
      : projectStorage.public
    const getSignedDownloadUrl = getSignedDownloadUrlFactory({
      objectStorage: downloadStorage
    })
    const objectKey = getObjectKey(projectId, fileUpload.id)
    const createJob = createRvtConversionJobFactory({ db: deps.db })
    const updateJob = updateRvtConversionJobFactory({ db: deps.db })

    const job = await createJob({
      projectId,
      modelId,
      sourceFileId: fileUpload.id,
      sourceFileName: fileUpload.fileName,
      sourceObjectKey: objectKey,
      sourceFileSize: fileUpload.fileSize,
      versionMessage: null,
      sourceApplication: sourceApplicationDefault,
      creator: userId
    })

    try {
      const [{ id: tokenId, token }, sourceFileUrl] = await Promise.all([
        createRvtConversionDelegatedToken({
          userId,
          projectId,
          modelId,
          jobId: job.id
        }),
        getSignedDownloadUrl({
          objectKey,
          urlExpiryDurationSeconds: downloadUrlExpirySeconds
        })
      ])

      const dispatchedJob = await updateJob({
        id: job.id,
        item: {
          status: 'dispatched',
          dispatchedAt: new Date()
        }
      })

      await dispatchRvtConversionJob({
        job: dispatchedJob || job,
        branchName: modelName || null,
        sourceFileUrl,
        speckleToken: token,
        speckleTokenId: tokenId
      })

      return dispatchedJob || job
    } catch (error) {
      await updateJob({
        id: job.id,
        item: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Failed to dispatch job.'
        }
      })

      throw error
    }
  }
