import cryptoRandomString from 'crypto-random-string'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { BlobUploadStatus } from '@speckle/shared/blobs'
import { TIME_MS, ensureError } from '@speckle/shared'
import { getObjectKey } from '@/modules/blobstorage/helpers/blobs'
import { getBlobMetadataFactory, upsertBlobFactory } from '@/modules/blobstorage/repositories'
import { getObjectStreamFactory } from '@/modules/blobstorage/repositories/blobs'
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
import type stream from 'stream'

const generateId = () => cryptoRandomString({ length: 10 })

const wait = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms))

const getFetchErrorDetails = (e: unknown) => {
  const err = ensureError(e) as Error & { cause?: unknown }
  const cause = (err as { cause?: unknown }).cause as
    | { code?: string; message?: string; name?: string }
    | undefined
  return {
    message: err.message || 'fetch failed',
    causeName: cause?.name,
    causeCode: cause?.code,
    causeMessage: cause?.message
  }
}

const streamToBuffer = async (readable: stream.Readable) => {
  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

const downloadWithRetry = async (url: string, tries: number, stage: string) => {
  let lastErr: Error | null = null
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10 * TIME_MS.minute) })
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length) throw new Error('Downloaded DXF is empty')
      return buf
    } catch (e) {
      const safeUrl = redactUrl(url)
      const details = getFetchErrorDetails(e)
      lastErr = new Error(
        `${stage} fetch failed: ${details.message}\n` +
          `cause: ${JSON.stringify({
            name: details.causeName,
            code: details.causeCode,
            message: details.causeMessage
          })}\n` +
          `url: ${JSON.stringify(safeUrl)}`
      )
      await wait(2000)
    }
  }
  throw lastErr || new Error('Download failed')
}

const getResponseHeaders = (res: Response) =>
  Object.fromEntries([...res.headers.entries()].sort(([a], [b]) => a.localeCompare(b)))

const formatOdaRawResponse = (params: {
  endpoint: string
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}) =>
  JSON.stringify(
    {
      endpoint: params.endpoint,
      status: params.status,
      statusText: params.statusText,
      headers: params.headers,
      body: params.body
    },
    null,
    2
  )

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

const resolveOdaDownloadUrl = (params: {
  odaBaseUrl: string
  url?: string
  urlPath?: string
  path?: string
}) => {
  const rawUrl = typeof params.url === 'string' ? params.url.trim() : ''
  if (rawUrl) {
    const parsed = new URL(rawUrl, params.odaBaseUrl)
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
      return new URL(`${parsed.pathname}${parsed.search}`, params.odaBaseUrl).toString()
    }
    return parsed.toString()
  }

  const rawUrlPath = typeof params.urlPath === 'string' ? params.urlPath.trim() : ''
  if (rawUrlPath) {
    return new URL(rawUrlPath, params.odaBaseUrl).toString()
  }

  const rawPath = typeof params.path === 'string' ? params.path.trim() : ''
  if (rawPath) {
    const normalizedPath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath
    return new URL(`/download/${normalizedPath}`, params.odaBaseUrl).toString()
  }

  return null
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

  const endpoint = `${params.odaBaseUrl}/convert/local`
  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(10 * TIME_MS.minute)
  })
  const rawBody = await res.text()
  const rawResponse = formatOdaRawResponse({
    endpoint,
    status: res.status,
    statusText: res.statusText,
    headers: getResponseHeaders(res),
    body: rawBody
  })
  console.info('ODA convert/local raw response\n%s', rawResponse)

  if (!res.ok) {
    throw new Error(`ODA convert/local failed.\n${rawResponse}`)
  }

  let json: { url?: string; url_path?: string; path?: string; error?: string | null }
  try {
    json = (rawBody ? JSON.parse(rawBody) : {}) as {
      url?: string
      url_path?: string
      path?: string
      error?: string | null
    }
  } catch {
    throw new Error(`ODA convert/local returned non-JSON response.\n${rawResponse}`)
  }

  const odaError = typeof json.error === 'string' ? json.error.trim() : ''
  if (odaError) {
    throw new Error(`ODA convert/local returned error: ${odaError}\n${rawResponse}`)
  }

  const resolvedUrl = resolveOdaDownloadUrl({
    odaBaseUrl: params.odaBaseUrl,
    url: json.url,
    urlPath: json.url_path,
    path: json.path
  })
  if (resolvedUrl) return resolvedUrl

  throw new Error(`ODA convert/local response missing dxf url.\n${rawResponse}`)
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

    const odaBaseUrl = getOdaBaseUrl().replace(/\/+$/, '')
    const getObjectStream = getObjectStreamFactory({ storage: projectStorage.private })
    const dwgStream = await getObjectStream({ objectKey: blobMeta.objectKey! })
    const dwgBuffer = await streamToBuffer(dwgStream)

    const dxfUrl = await convertViaLocal({
      odaBaseUrl,
      fileBuffer: dwgBuffer,
      fileName: record.fileName
    })

    const dxfBuffer = await downloadWithRetry(dxfUrl, 5, 'download dxf from ODA (local convert)')

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
