import type { Router, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { z } from 'zod'
import { allowCrossOriginResourceAccessMiddelware } from '@/modules/shared/middleware/security'
import { ensureError } from '@speckle/shared'
import { resolveStatusCode } from '@/modules/core/rest/defaultErrorHandler'
import { DRAWINGS_PROJECT } from '@/modules/core/drawings/constants'
import { getServerOrigin } from '@/modules/shared/helpers/envHelper'
import { ensureDrawingsProjectFactory } from '@/modules/core/drawings/ensure'
import db from '@/db/knex'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { createBusboy } from '@/modules/blobstorage/rest/busboy'
import { getBlobMetadataFactory } from '@/modules/blobstorage/repositories'
import { processNewFileStreamFactory } from '@/modules/blobstorage/services/streams'
import {
  createBranchFactory,
  deleteBranchByIdFactory,
  getBranchByIdFactory,
  getStreamBranchByNameFactory,
  markCommitBranchUpdatedFactory,
  updateBranchFactory
} from '@/modules/core/repositories/branches'
import {
  BranchCommits,
  Branches,
  Commits,
  Streams,
  knex
} from '@/modules/core/dbSchema'
import {
  deleteCommitsFactory,
  createCommitFactory,
  getCommitFactory,
  insertBranchCommitsFactory,
  insertStreamCommitsFactory,
  updateCommitFactory
} from '@/modules/core/repositories/commits'
import {
  getObjectChildrenStreamFactory,
  getObjectFactory,
  storeSingleObjectIfNotFoundFactory
} from '@/modules/core/repositories/objects'
import { createCommitByBranchIdFactory } from '@/modules/core/services/commit/management'
import { createObjectFactory } from '@/modules/core/services/objects/management'
import { VersionEvents } from '@/modules/core/domain/commits/events'
import { ModelEvents } from '@/modules/core/domain/branches/events'
import { getEventBus } from '@/modules/shared/services/eventBus'

const drawingsErrHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!err) return next()
  const error = ensureError(err)
  const status = resolveStatusCode(error)
  res.status(status).json({ error: error.message })
}

const requireUserMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.context.auth || !req.context.userId) {
    return res.status(401).json({ error: 'User not authenticated' })
  }
  next()
}

const createModelBodySchema = z.object({
  name: z.string().min(1).max(512),
  description: z.string().max(65536).nullable().optional()
})

const updateModelBodySchema = z.object({
  name: z.string().min(1).max(512).optional(),
  description: z.string().max(65536).nullable().optional()
})

const updateVersionBodySchema = z.object({
  message: z.string().max(65536).optional()
})

const listModelsQuerySchema = z.object({
  search: z.string().optional(),
  page: z
    .preprocess(
      (v) => (typeof v === 'string' && v.length ? parseInt(v) : undefined),
      z.number().int().min(1).optional()
    )
    .optional(),
  pageSize: z
    .preprocess(
      (v) => (typeof v === 'string' && v.length ? parseInt(v) : undefined),
      z.number().int().min(1).max(200).optional()
    )
    .optional()
})

const listVersionsQuerySchema = z.object({
  limit: z
    .preprocess(
      (v) => (typeof v === 'string' && v.length ? parseInt(v) : undefined),
      z.number().int().min(1).max(100).optional()
    )
    .optional(),
  cursorCreatedAt: z.string().optional(),
  cursorId: z.string().optional()
})

const drawingsFileTypePriority = ['dxf', 'dwg', 'glb', 'gltf', 'obj']

const normalizeFileType = (v: unknown) => {
  if (typeof v !== 'string') return null
  const trimmed = v.trim().toLowerCase()
  if (!trimmed.length) return null
  return trimmed.replace(/^\./, '')
}

const normalizeFileExtFromName = (v: unknown) => {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed.length) return null
  const ext = trimmed.split('.').pop()?.toLowerCase()
  return ext?.length ? ext : null
}

type BlobMetadataCandidate = {
  blobId: string
  fileName: string
  fileType: string
  fileSize: number | null
  hasExplicitBlobId: boolean
}

const findBlobMetadataCandidates = (
  node: unknown,
  candidates: BlobMetadataCandidate[]
): void => {
  if (!node) return
  if (Array.isArray(node)) {
    for (const i of node) findBlobMetadataCandidates(i, candidates)
    return
  }

  if (typeof node !== 'object') return

  const anyNode = node as Record<string, unknown>
  const fileName = anyNode.fileName
  const fileType = anyNode.fileType

  if (typeof fileName === 'string' && typeof fileType === 'string') {
    const hasExplicitBlobId = typeof anyNode.blobId === 'string'
    const blobId: string | null = hasExplicitBlobId
      ? (anyNode.blobId as string)
      : typeof anyNode.id === 'string'
      ? anyNode.id
      : null
    if (blobId) {
      candidates.push({
        blobId,
        fileName,
        fileType,
        fileSize: typeof anyNode.fileSize === 'number' ? anyNode.fileSize : null,
        hasExplicitBlobId
      })
    }
  }

  for (const v of Object.values(anyNode)) {
    findBlobMetadataCandidates(v, candidates)
  }
}

const rankBlobCandidates = (candidates: BlobMetadataCandidate[]) => {
  if (!candidates.length) return null

  return candidates
    .map((c) => {
      const type = normalizeFileType(c.fileType) || normalizeFileExtFromName(c.fileName)
      const idx = type ? drawingsFileTypePriority.indexOf(type) : -1
      return {
        c,
        idx: idx === -1 ? 999 : idx,
        explicitScore: c.hasExplicitBlobId ? 0 : 1
      }
    })
    .sort((a, b) => a.idx - b.idx || a.explicitScore - b.explicitScore)
    .map((entry) => entry.c)
}

export default (app: Router) => {
  const route = '/api/v1/drawings'

  const ensureDrawingsProject = ensureDrawingsProjectFactory({ db })
  const processNewFileStream = processNewFileStreamFactory()

  app.options(`${route}/*`, cors(), allowCrossOriginResourceAccessMiddelware())

  app.use(route, cors(), allowCrossOriginResourceAccessMiddelware())

  app.get(
    `${route}/project`,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await ensureDrawingsProject()

        const project = await Streams.knex<{ id: string; name: string }>(db)
          .select([Streams.col.id, Streams.col.name])
          .where(Streams.col.id, DRAWINGS_PROJECT.id)
          .first()

        res.json({
          data: {
            id: DRAWINGS_PROJECT.id,
            name: project?.name || DRAWINGS_PROJECT.name,
            type: DRAWINGS_PROJECT.type
          }
        })
      } catch (e) {
        next(e)
      }
    }
  )

  app.get(
    `${route}/models`,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { search, page, pageSize } = listModelsQuerySchema.parse(req.query)
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })

        const latestCommitIdQuery = projectDb(BranchCommits.name)
          .select(BranchCommits.col.commitId)
          .innerJoin(Commits.name, Commits.col.id, BranchCommits.col.commitId)
          .where(BranchCommits.col.branchId, knex.ref(`${Branches.name}.id`))
          .orderBy(Commits.col.createdAt, 'desc')
          .limit(1)

        const q = projectDb(Branches.name)
          .select([
            `${Branches.name}.id`,
            `${Branches.name}.name as title`,
            `${Branches.name}.streamId`,
            `${Streams.name}.name as streamName`,
            `${Branches.name}.updatedAt`,
            knex.raw(`(${latestCommitIdQuery.toQuery()}) as "latestCommitId"`)
          ])
          .select(knex.raw('count(??) as versions', [Commits.col.id]))
          .leftJoin(Streams.name, Streams.col.id, Branches.col.streamId)
          .leftJoin(BranchCommits.name, BranchCommits.col.branchId, Branches.col.id)
          .leftJoin(Commits.name, Commits.col.id, BranchCommits.col.commitId)
          .where(`${Branches.name}.streamId`, DRAWINGS_PROJECT.id)
          .whereNot(`${Branches.name}.name`, 'globals')
          .whereNot(`${Branches.name}.name`, 'main')
          .groupBy(
            `${Branches.name}.id`,
            `${Streams.name}.name`,
            `${Branches.name}.streamId`
          )
          .orderBy(`${Branches.name}.updatedAt`, 'desc')

        if (search && typeof search === 'string') {
          q.whereILike(`${Branches.name}.name`, `%${search}%`)
        }

        const isPaged = !!(page && pageSize)

        let total: number | undefined = undefined
        if (isPaged) {
          const countQuery = projectDb(Branches.name)
            .count<{ total: string }[]>({ total: '*' })
            .where(`${Branches.name}.streamId`, DRAWINGS_PROJECT.id)
            .whereNot(`${Branches.name}.name`, 'globals')
            .whereNot(`${Branches.name}.name`, 'main')

          if (search && typeof search === 'string') {
            countQuery.whereILike(`${Branches.name}.name`, `%${search}%`)
          }

          const countRow = await countQuery.first()
          total = countRow?.total ? parseInt(countRow.total) : 0

          q.limit(pageSize).offset((page - 1) * pageSize)
        }

        const rows = await q

        const formattedModels = rows.map((m) => ({
          id: m.id,
          title: m.title,
          projectId: m.streamId,
          streamName: m.streamName,
          updateTime: m.updatedAt,
          versions: parseInt(m.versions as string),
          comments: 0,
          hasModel: Boolean(m.latestCommitId),
          previewUrl: m.latestCommitId
            ? new URL(
                `/preview/${m.streamId}/commits/${m.latestCommitId}`,
                getServerOrigin()
              ).toString()
            : null,
          status: null,
          sourceApplication: null
        }))

        res.json({ data: formattedModels, ...(isPaged ? { total } : {}) })
      } catch (e) {
        next(e)
      }
    }
  )

  app.post(
    `${route}/models`,
    requireUserMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.context.userId!
        await ensureDrawingsProject()
        const body = createModelBodySchema.parse(req.body)
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })

        const getStreamBranchByName = getStreamBranchByNameFactory({ db: projectDb })
        const existing = await getStreamBranchByName(DRAWINGS_PROJECT.id, body.name)
        if (existing) return res.status(409).json({ error: 'Model already exists' })

        const createBranch = createBranchFactory({ db: projectDb })
        const model = await createBranch({
          streamId: DRAWINGS_PROJECT.id,
          name: body.name,
          description: body.description ?? null,
          authorId: userId
        })

        await getEventBus().emit({
          eventName: ModelEvents.Created,
          payload: { model, projectId: DRAWINGS_PROJECT.id }
        })

        res.status(201).json({ data: model })
      } catch (e) {
        next(e)
      }
    }
  )

  app.post(
    `${route}/models/upload`,
    requireUserMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.context.userId!
        await ensureDrawingsProject()
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })

        const fields: Record<string, string> = {}
        const busboy = createBusboy(req)
        busboy.on('field', (name: string, value: string) => {
          fields[name] = value
        })

        const uploadResultsPromise = new Promise<
          Array<{
            uploadError?: unknown
            blobId: string
            fileName: string
            fileSize: number | null
          }>
        >((resolve, reject) => {
          void processNewFileStream({
            busboy,
            streamId: DRAWINGS_PROJECT.id,
            userId,
            logger: req.log,
            onFinishAllFileUploads: async (uploadResults) => resolve(uploadResults),
            onError: (err) => reject(ensureError(err))
          }).then((processor) => {
            req.pipe(processor)
          })
        })

        const uploadResults = await uploadResultsPromise
        const ok = uploadResults.filter((r) => !r.uploadError)
        if (ok.length !== 1) {
          return res.status(400).json({ error: 'Expected exactly 1 uploaded file' })
        }

        const { blobId, fileName, fileSize } = ok[0]
        const inferredType = normalizeFileExtFromName(fileName) || 'file'
        const baseName = fileName.replace(/\.[^/.]+$/, '').trim()
        const candidateName = (
          fields.name ||
          baseName ||
          `untitled-${Date.now()}`
        ).trim()
        const modelName =
          candidateName.length > 512 ? candidateName.slice(0, 512) : candidateName

        const getStreamBranchByName = getStreamBranchByNameFactory({ db: projectDb })
        const existing = await getStreamBranchByName(DRAWINGS_PROJECT.id, modelName)

        const createBranch = createBranchFactory({ db: projectDb })
        const model = await createBranch({
          streamId: DRAWINGS_PROJECT.id,
          name: existing ? `${modelName}-${Date.now()}` : modelName,
          description: fields.description?.trim() || null,
          authorId: userId
        })

        await getEventBus().emit({
          eventName: ModelEvents.Created,
          payload: { model, projectId: DRAWINGS_PROJECT.id }
        })

        const createObject = createObjectFactory({
          storeSingleObjectIfNotFoundFactory: storeSingleObjectIfNotFoundFactory({
            db: projectDb
          })
        })
        const objectId = await createObject({
          streamId: DRAWINGS_PROJECT.id,
          object: {
            __closure: null,
            ['speckle_type']: 'Speckle.Core.Models.File',
            blobId,
            fileName,
            fileType: inferredType,
            fileSize
          }
        })

        const createCommitByBranchId = createCommitByBranchIdFactory({
          createCommit: createCommitFactory({ db: projectDb }),
          getObject: getObjectFactory({ db: projectDb }),
          getBranchById: getBranchByIdFactory({ db: projectDb }),
          insertStreamCommits: insertStreamCommitsFactory({ db: projectDb }),
          insertBranchCommits: insertBranchCommitsFactory({ db: projectDb }),
          markCommitBranchUpdated: markCommitBranchUpdatedFactory({ db: projectDb }),
          emitEvent: getEventBus().emit
        })

        const version = await createCommitByBranchId({
          streamId: DRAWINGS_PROJECT.id,
          branchId: model.id,
          objectId,
          authorId: userId,
          message: fields.message?.trim() || '',
          sourceApplication: 'drawings'
        })

        res.status(201).json({ data: { model, version } })
      } catch (e) {
        next(e)
      }
    }
  )

  app.patch(
    `${route}/models/:modelId`,
    requireUserMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.context.userId!
        const body = updateModelBodySchema.parse(req.body)
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })

        const getBranchById = getBranchByIdFactory({ db: projectDb })
        const existing = await getBranchById(req.params.modelId, {
          streamId: DRAWINGS_PROJECT.id
        })
        if (!existing) return res.status(404).json({ error: 'Model not found' })

        const updateBranch = updateBranchFactory({ db: projectDb })
        const updated = await updateBranch(req.params.modelId, {
          ...(typeof body.name === 'string' ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          updatedAt: new Date()
        })

        await getEventBus().emit({
          eventName: ModelEvents.Updated,
          payload: {
            update: { ...body, id: req.params.modelId, projectId: DRAWINGS_PROJECT.id },
            userId,
            oldModel: existing,
            newModel: updated
          }
        })

        res.json({ data: updated })
      } catch (e) {
        next(e)
      }
    }
  )

  app.delete(
    `${route}/models/:modelId`,
    requireUserMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.context.userId!
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })
        const getBranchById = getBranchByIdFactory({ db: projectDb })
        const existing = await getBranchById(req.params.modelId, {
          streamId: DRAWINGS_PROJECT.id
        })
        if (!existing) return res.status(404).json({ error: 'Model not found' })

        const deleteBranchById = deleteBranchByIdFactory({ db: projectDb })
        const deletedCount = await deleteBranchById(existing.id)
        const isDeleted = !!deletedCount

        if (isDeleted) {
          await getEventBus().emit({
            eventName: ModelEvents.Deleted,
            payload: {
              modelId: existing.id,
              model: existing,
              projectId: DRAWINGS_PROJECT.id,
              input: { id: existing.id, projectId: DRAWINGS_PROJECT.id },
              userId
            }
          })
        }

        res.json({ data: isDeleted })
      } catch (e) {
        next(e)
      }
    }
  )

  app.post(
    `${route}/models/:modelId/versions`,
    requireUserMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.context.userId!
        await ensureDrawingsProject()
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })

        const branch = await projectDb(Branches.name)
          .select([Branches.col.id, Branches.col.streamId])
          .where(Branches.col.id, req.params.modelId)
          .andWhere(Branches.col.streamId, DRAWINGS_PROJECT.id)
          .first()
        if (!branch) return res.status(404).json({ error: 'Model not found' })

        const fields: Record<string, string> = {}
        const busboy = createBusboy(req)
        busboy.on('field', (name: string, value: string) => {
          fields[name] = value
        })

        const uploadResultsPromise = new Promise<
          Array<{
            uploadError?: unknown
            blobId: string
            fileName: string
            fileSize: number | null
          }>
        >((resolve, reject) => {
          void processNewFileStream({
            busboy,
            streamId: DRAWINGS_PROJECT.id,
            userId,
            logger: req.log,
            onFinishAllFileUploads: async (uploadResults) => resolve(uploadResults),
            onError: (err) => reject(ensureError(err))
          }).then((processor) => {
            req.pipe(processor)
          })
        })

        const uploadResults = await uploadResultsPromise
        const ok = uploadResults.filter((r) => !r.uploadError)
        if (ok.length !== 1) {
          return res.status(400).json({ error: 'Expected exactly 1 uploaded file' })
        }

        const { blobId, fileName, fileSize } = ok[0]
        const inferredType = normalizeFileExtFromName(fileName) || 'file'

        const createObject = createObjectFactory({
          storeSingleObjectIfNotFoundFactory: storeSingleObjectIfNotFoundFactory({
            db: projectDb
          })
        })
        const objectId = await createObject({
          streamId: DRAWINGS_PROJECT.id,
          object: {
            __closure: null,
            ['speckle_type']: 'Speckle.Core.Models.File',
            blobId,
            fileName,
            fileType: inferredType,
            fileSize
          }
        })

        const createCommitByBranchId = createCommitByBranchIdFactory({
          createCommit: createCommitFactory({ db: projectDb }),
          getObject: getObjectFactory({ db: projectDb }),
          getBranchById: getBranchByIdFactory({ db: projectDb }),
          insertStreamCommits: insertStreamCommitsFactory({ db: projectDb }),
          insertBranchCommits: insertBranchCommitsFactory({ db: projectDb }),
          markCommitBranchUpdated: markCommitBranchUpdatedFactory({ db: projectDb }),
          emitEvent: getEventBus().emit
        })

        const version = await createCommitByBranchId({
          streamId: DRAWINGS_PROJECT.id,
          branchId: branch.id,
          objectId,
          authorId: userId,
          message: fields.message?.trim() || '',
          sourceApplication: 'drawings'
        })

        res.status(201).json({ data: version })
      } catch (e) {
        next(e)
      }
    }
  )

  app.get(
    `${route}/models/:modelId/versions`,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { limit, cursorCreatedAt, cursorId } = listVersionsQuerySchema.parse(
          req.query
        )
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })

        const branch = await projectDb(Branches.name)
          .select([Branches.col.id, Branches.col.streamId])
          .where(Branches.col.id, req.params.modelId)
          .andWhere(Branches.col.streamId, DRAWINGS_PROJECT.id)
          .first()
        if (!branch) return res.status(404).json({ error: 'Model not found' })

        const baseQuery = projectDb(Commits.name)
          .select([
            `${Commits.name}.id`,
            `${Commits.name}.message`,
            `${Commits.name}.sourceApplication`,
            `${Commits.name}.createdAt`,
            `${Commits.name}.referencedObject`
          ])
          .innerJoin(BranchCommits.name, BranchCommits.col.commitId, Commits.col.id)
          .where(BranchCommits.col.branchId, req.params.modelId)
          .orderBy(Commits.col.createdAt, 'desc')
          .orderBy(Commits.col.id, 'desc')

        if (cursorCreatedAt && cursorId) {
          const cursorDate = new Date(cursorCreatedAt)
          if (Number.isNaN(cursorDate.getTime())) {
            return res.status(400).json({ error: 'Invalid cursorCreatedAt' })
          }

          baseQuery.andWhere((qb) => {
            qb.where(Commits.col.createdAt, '<', cursorDate).orWhere((qb2) => {
              qb2
                .where(Commits.col.createdAt, '=', cursorDate)
                .andWhere(Commits.col.id, '<', cursorId)
            })
          })
        }

        if (!limit) {
          const versions = await baseQuery
          return res.json({ data: versions })
        }

        const rows = await baseQuery.limit(limit + 1)
        const hasMore = rows.length > limit
        const data = rows.slice(0, limit)
        const last = data[data.length - 1]
        const nextCursor =
          hasMore && last
            ? {
                createdAt: last.createdAt,
                id: last.id
              }
            : null

        return res.json({ data, cursor: nextCursor })
      } catch (e) {
        next(e)
      }
    }
  )

  app.get(
    `${route}/versions/:versionId/file`,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })
        const getCommit = getCommitFactory({ db: projectDb })
        const commit = await getCommit(req.params.versionId, {
          streamId: DRAWINGS_PROJECT.id
        })
        if (!commit) return res.status(404).json({ error: 'Version not found' })

        const candidates: BlobMetadataCandidate[] = []

        if (commit.message && typeof commit.message === 'string') {
          const trimmed = commit.message.trim()
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const parsed = JSON.parse(trimmed) as unknown
              findBlobMetadataCandidates(parsed, candidates)
            } catch {}
          }
        }

        const referencedObjectId = commit.referencedObject
        if (!candidates.length && referencedObjectId) {
          const getObject = getObjectFactory({ db: projectDb })
          const root = await getObject(referencedObjectId, DRAWINGS_PROJECT.id)
          if (root?.data) findBlobMetadataCandidates(root.data as unknown, candidates)

          if (!candidates.length) {
            const getObjectChildrenStream = getObjectChildrenStreamFactory({
              db: projectDb
            })
            const stream = await getObjectChildrenStream({
              streamId: DRAWINGS_PROJECT.id,
              objectId: referencedObjectId
            })

            let inspected = 0
            try {
              for await (const row of stream) {
                inspected++
                if (inspected > 5000) break
                const dataText =
                  typeof (row as { dataText?: unknown }).dataText === 'string'
                    ? ((row as { dataText: string }).dataText as string)
                    : null
                if (!dataText) continue
                if (
                  !dataText.includes('"fileName"') ||
                  !dataText.includes('"fileType"')
                )
                  continue

                try {
                  const parsed = JSON.parse(dataText) as unknown
                  findBlobMetadataCandidates(parsed, candidates)
                  if (candidates.length) break
                } catch {}
              }
            } finally {
              stream.destroy()
            }
          }
        }

        const rankedCandidates = rankBlobCandidates(candidates) || []
        const getBlobMetadata = getBlobMetadataFactory({ db: projectDb })
        let best: BlobMetadataCandidate | null = null
        for (const candidate of rankedCandidates) {
          try {
            await getBlobMetadata({
              blobId: candidate.blobId,
              streamId: DRAWINGS_PROJECT.id
            })
            best = candidate
            break
          } catch {}
        }

        if (!best)
          return res.status(404).json({ error: 'No CAD file found on version' })

        return res.json({
          data: {
            blobId: best.blobId,
            fileName: best.fileName,
            fileType: best.fileType,
            fileSize: best.fileSize
          }
        })
      } catch (e) {
        next(e)
      }
    }
  )

  app.patch(
    `${route}/versions/:versionId`,
    requireUserMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.context.userId!
        const body = updateVersionBodySchema.parse(req.body)
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })

        const getCommit = getCommitFactory({ db: projectDb })
        const existing = await getCommit(req.params.versionId, {
          streamId: DRAWINGS_PROJECT.id
        })
        if (!existing) return res.status(404).json({ error: 'Version not found' })

        const updateCommit = updateCommitFactory({ db: projectDb })
        const updated = await updateCommit(req.params.versionId, {
          ...(typeof body.message === 'string' ? { message: body.message } : {})
        })

        const markCommitBranchUpdated = markCommitBranchUpdatedFactory({
          db: projectDb
        })
        const updatedBranch = await markCommitBranchUpdated(req.params.versionId)

        await getEventBus().emit({
          eventName: VersionEvents.Updated,
          payload: {
            projectId: DRAWINGS_PROJECT.id,
            modelId: updatedBranch?.id || existing.branchId,
            versionId: req.params.versionId,
            newVersion: updated,
            oldVersion: existing,
            userId,
            update: {
              projectId: DRAWINGS_PROJECT.id,
              versionId: req.params.versionId,
              ...(typeof body.message === 'string' ? { message: body.message } : {})
            }
          }
        })

        res.json({ data: updated })
      } catch (e) {
        next(e)
      }
    }
  )

  app.delete(
    `${route}/versions/:versionId`,
    requireUserMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.context.userId!
        const projectDb = await getProjectDbClient({ projectId: DRAWINGS_PROJECT.id })

        const getCommit = getCommitFactory({ db: projectDb })
        const existing = await getCommit(req.params.versionId, {
          streamId: DRAWINGS_PROJECT.id
        })
        if (!existing) return res.status(404).json({ error: 'Version not found' })

        const markCommitBranchUpdated = markCommitBranchUpdatedFactory({
          db: projectDb
        })
        const updatedBranch = await markCommitBranchUpdated(req.params.versionId)

        const deleteCommits = deleteCommitsFactory({ db: projectDb })
        await deleteCommits([req.params.versionId])

        await getEventBus().emit({
          eventName: VersionEvents.Deleted,
          payload: {
            projectId: DRAWINGS_PROJECT.id,
            modelId: updatedBranch?.id || existing.branchId,
            versionId: req.params.versionId,
            userId,
            version: existing
          }
        })

        res.json({ data: true })
      } catch (e) {
        next(e)
      }
    }
  )

  app.use(route, drawingsErrHandler)
}
