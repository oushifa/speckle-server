import { getObjectStorage, type ObjectStorage } from '@/modules/blobstorage/clients/objectStorage'
import { getRvtConversionInternalS3Endpoint } from '@/modules/shared/helpers/envHelper'

export const getRvtConversionDownloadStorage = (projectStorage: {
  public: ObjectStorage
}) => {
  const internalEndpoint = getRvtConversionInternalS3Endpoint()
  if (!internalEndpoint) return projectStorage.public

  return getObjectStorage({
    ...projectStorage.public.params,
    endpoint: internalEndpoint
  })
}
