import { BadRequestError } from '@/modules/shared/errors'
import { ensureError } from '@speckle/shared'
import Busboy from 'busboy'
import type { Request } from 'express'
import { getFileSizeLimit } from '@/modules/blobstorage/services/management'

export const createBusboy = (
  req: Request,
  fileSizeLimit: number = getFileSizeLimit()
) => {
  let busboy: Busboy.Busboy
  try {
    // Busboy does some validation of user input (headers) on creation
    busboy = Busboy({
      headers: req.headers,
      defParamCharset: 'utf8',
      limits: { fileSize: fileSizeLimit }
    })
    return busboy
  } catch (err) {
    throw new BadRequestError(
      err instanceof Error ? err.message : 'Error while uploading blob',
      ensureError(err, 'Unknown error while uploading blob')
    )
  }
}
