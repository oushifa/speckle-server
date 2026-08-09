import type { IncomingMessage } from 'http'
import type { RvtConversionJob } from '@/modules/rvt-conversion/repositories/jobs'
import { moduleLogger } from '@/observability/logging'

export const RVT_CONVERT_LOG_TAG = 'RVT_CONVERT'

export const createRvtConvertLogger = (component: string) =>
  moduleLogger.child({
    module: 'rvt-conversion',
    component,
    tag: RVT_CONVERT_LOG_TAG
  })

export const buildRvtJobLogContext = (
  job: Pick<
    RvtConversionJob,
    'id' | 'projectId' | 'modelId' | 'sourceFileId' | 'sourceFileName' | 'status'
  >
) => ({
  jobId: job.id,
  projectId: job.projectId,
  modelId: job.modelId,
  sourceFileId: job.sourceFileId,
  sourceFileName: job.sourceFileName,
  jobStatus: job.status
})

export const getWorkerRequestLogContext = (request: IncomingMessage) => {
  const forwardedFor = request.headers['x-forwarded-for']
  const requestUrl = new URL(request.url || '', 'http://localhost')

  return {
    remoteAddress:
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim() || request.socket.remoteAddress || null
        : request.socket.remoteAddress || null,
    remotePort: request.socket.remotePort || null,
    requestPath: requestUrl.pathname,
    hasTokenQuery: !!requestUrl.searchParams.get('token'),
    hasWorkerTokenHeader: typeof request.headers['x-rvt-worker-token'] === 'string'
  }
}

export const summarizeRawWsMessage = (raw: unknown) => {
  const rawString = typeof raw === 'string' ? raw : String(raw)
  return rawString.length > 500 ? `${rawString.slice(0, 500)}...` : rawString
}
