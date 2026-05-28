import cryptoRandomString from 'crypto-random-string'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { BlobUploadStatus } from '@speckle/shared/blobs'
import { TIME, ensureError } from '@speckle/shared'
import { getObjectKey } from '@/modules/blobstorage/helpers/blobs'
import { getBlobMetadataFactory, upsertBlobFactory } from '@/modules/blobstorage/repositories'
import { getSignedDownloadUrlFactory } from '@/modules/blobstorage/clients/objectStorage'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { getProjectObjectStorage } from '@/modules/multiregion/utils/blobStorageSelector'
import {
  getProjectDrawingFactory,
  updateProjectDrawingFactory
} from '@/modules/drawings/repositories/drawings'
import { getOdaBaseUrl } from '@/modules/shared/helpers/envHelper'
import {
  emitDrawingConversionUpdated,
  emitProjectDrawingConversionUpdated
} from '@/modules/drawings/services/conversionEvents'

const generateId = () => cryptoRandomString({ length: 10 })

const wait = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms))

const downloadWithRetry = async (url: string, tries: number) => {
  let lastErr: Error | null = null
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length) throw new Error('Downloaded DXF is empty')
      return buf
    } catch (e) {
      lastErr = ensureError(e)
      await wait(2000)
    }
  }
  throw lastErr || new Error('Download failed')
}

const readErrorBody = async (res: Response) => {
  try {
    const text = await res.text()
    return text.slice(0, 2000)
  } catch {
    return ''
  }
}

const redactUrl = (url: string) => {
  try {
    const u = new URL(url)
    return {
      origin: u.origin,
      pathname: u.pathname,
      queryKeys: [...u.searchParams.keys()],
      hasQuery: u.search.length > 0
    }
  } catch {
    return { origin: '', pathname: '', queryKeys: [], hasQuery: false }
  }
}

const checkUrlAccessible = async (url: string) => {
  const summary = { ok: false, status: 0, contentType: '', contentLength: '' }
  try {
    const head = await fetch(url, { method: 'HEAD' })
    summary.status = head.status
    summary.ok = head.ok
    summary.contentType = head.headers.get('content-type') || ''
    summary.contentLength = head.headers.get('content-length') || ''
    if (head.ok) return summary
  } catch {
  }

  try {
    const range = await fetch(url, { headers: { Range: 'bytes=0-0' } })
    summary.status = range.status
    summary.ok = range.ok
    summary.contentType = range.headers.get('content-type') || ''
    summary.contentLength =
      range.headers.get('content-length') || range.headers.get('content-range') || ''
    return summary
  } catch {
    return summary
  }
}

const convertViaUrl = async (params: { odaBaseUrl: string; sourceUrl: string }) => {
  const form = new FormData()
  form.set('url', params.sourceUrl)

  const res = await fetch(`${params.odaBaseUrl}/convert/url`, {
    method: 'POST',
    body: form
  })
  if (!res.ok) {
    const body = await readErrorBody(res)
    const safeUrl = redactUrl(params.sourceUrl)
    const preflight = await checkUrlAccessible(params.sourceUrl)
    throw new Error(
      `ODA convert/url failed (${res.status}): ${body || res.statusText}\n` +
        `preflight: ${JSON.stringify(preflight)}\n` +
        `sourceUrl: ${JSON.stringify(safeUrl)}`
    )
  }

  const json = (await res.json()) as { url?: string }
  const url = json.url?.trim()
  if (!url) throw new Error('ODA convert/url response missing dxf url')
  return url
}

const convertViaLocal = async (params: {
  odaBaseUrl: string
  fileBuffer: Buffer
  fileName: string
}) => {
  const file = new File([new Uint8Array(params.fileBuffer)], params.fileName, {
    type: 'application/acad'
  })

  const form = new FormData()
  form.set('file', file)

  const res = await fetch(`${params.odaBaseUrl}/convert/local`, {
    method: 'POST',
    body: form
  })
  if (!res.ok) {
    const body = await readErrorBody(res)
    throw new Error(`ODA convert/local failed (${res.status}): ${body || res.statusText}`)
  }

  const json = (await res.json()) as { url?: string }
  const url = json.url?.trim()
  if (!url) throw new Error('ODA convert/local response missing dxf url')
  return url
}

export const triggerProjectDrawingDwgToDxfConversion = async (params: {
  projectId: string
  drawingId: string
  userId: string
}): Promise<void> => {
  const { projectId, drawingId, userId } = params
  const [projectDb, projectStorage] = await Promise.all([
    getProjectDbClient({ projectId }),
    getProjectObjectStorage({ projectId })
  ])

  const getDrawing = getProjectDrawingFactory({ db: projectDb })
  const updateDrawing = updateProjectDrawingFactory({ db: projectDb })

  const record = await getDrawing({ projectId, drawingId })
  if (!record) return
  if (record.fileType !== 'dwg') return
  if (record.conversionStatus === 'processing' || record.conversionStatus === 'done') return

  await updateDrawing({
    projectId,
    drawingId,
    patch: {
      conversionStatus: 'processing',
      conversionError: null,
      updater: userId
    }
  })
  const processingPayload = {
    projectId,
    drawingId,
    conversionStatus: 'processing',
    convertedBlobId: record.convertedBlobId,
    conversionError: null
  }
  emitDrawingConversionUpdated(processingPayload)
  emitProjectDrawingConversionUpdated(processingPayload)

  try {
    const blobMeta = await getBlobMetadataFactory({ db: projectDb })({
      streamId: projectId,
      blobId: record.blobId
    })

    const getSignedDownloadUrl = getSignedDownloadUrlFactory({
      objectStorage: projectStorage.public
    })

    const dwgUrl = await getSignedDownloadUrl({
      objectKey: blobMeta.objectKey!,
      urlExpiryDurationSeconds: 30 * TIME.minute
    })

    const odaBaseUrl = getOdaBaseUrl().replace(/\/+$/, '')
    let dxfUrl: string
    try {
      dxfUrl = await convertViaUrl({ odaBaseUrl, sourceUrl: dwgUrl })
    } catch {
      const dwgBuffer = await downloadWithRetry(dwgUrl, 3)
      dxfUrl = await convertViaLocal({
        odaBaseUrl,
        fileBuffer: dwgBuffer,
        fileName: record.fileName
      })
    }

    const dxfBuffer = await downloadWithRetry(dxfUrl, 5)
    const convertedBlobId = generateId()
    const objectKey = getObjectKey(projectId, convertedBlobId)

    const putRes = await projectStorage.private.client.send(
      new PutObjectCommand({
        Bucket: projectStorage.private.bucket,
        Key: objectKey,
        Body: dxfBuffer,
        ContentType: 'application/dxf'
      })
    )

    await upsertBlobFactory({ db: projectDb })({
      id: convertedBlobId,
      streamId: projectId,
      userId,
      objectKey,
      fileName: record.fileName.replace(/\.dwg$/i, '.dxf'),
      fileType: 'dxf',
      fileSize: dxfBuffer.length,
      uploadStatus: BlobUploadStatus.Completed,
      fileHash: putRes.ETag || null
    })

    await updateDrawing({
      projectId,
      drawingId,
      patch: {
        convertedBlobId,
        conversionStatus: 'done',
        conversionError: null,
        updater: userId
      }
    })
    const donePayload = {
      projectId,
      drawingId,
      conversionStatus: 'done',
      convertedBlobId,
      conversionError: null
    }
    emitDrawingConversionUpdated(donePayload)
    emitProjectDrawingConversionUpdated(donePayload)
  } catch (e) {
    const err = ensureError(e)
    await updateDrawing({
      projectId,
      drawingId,
      patch: {
        conversionStatus: 'failed',
        conversionError: err.message.slice(0, 2000),
        updater: userId
      }
    })
    const failedPayload = {
      projectId,
      drawingId,
      conversionStatus: 'failed',
      convertedBlobId: null,
      conversionError: err.message.slice(0, 2000)
    }
    emitDrawingConversionUpdated(failedPayload)
    emitProjectDrawingConversionUpdated(failedPayload)
  }
}
