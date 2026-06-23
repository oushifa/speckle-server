import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import crypto from 'crypto'
import { db } from '@/db/knex'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  streamWritePermissionsPipelineFactory,
  streamReadPermissionsPipelineFactory
} from '@/modules/shared/authz'
import { UnauthorizedError, ForbiddenError } from '@/modules/shared/errors'
import { Roles } from '@speckle/shared'
import {
  getPrepaymentItemFactory,
  getPrepaymentItemsPageFactory,
  insertPrepaymentItemFactory,
  updatePrepaymentItemFactory,
  deletePrepaymentItemFactory
} from '../repositories/prepayment'
import {
  getMainMaterialFactory,
  getMainMaterialsPageFactory,
  insertMainMaterialFactory,
  updateMainMaterialFactory,
  deleteMainMaterialFactory
} from '../repositories/mainMaterial'


const routeParamsSchema = z.object({
  projectId: z.string().trim().min(1)
})

const getPrepaymentSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
})

const prepaymentItemBodySchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(255, '名称最大支持255个字符'),
  type: z.enum(['预付数', '预留数'], {
    errorMap: () => ({ message: '类型只能是 "预付数" 或 "预留数"' })
  }),
  percentage: z.number().nullable().optional(),
  category: z.enum(
    [
      '税费调整',
      '税费调整后合计',
      '中期支付预留',
      '中期支付预留返还',
      '预付款',
      '预付款扣回'
    ],
    {
      errorMap: () => ({
        message: '无效的类别'
      })
    }
  )
})

const mainMaterialBodySchema = z.object({
  name: z.string().trim().min(1, '材料名称不能为空').max(255),
  specification: z.string().trim().min(1, '规格型号不能为空').max(255),
  unit: z.string().trim().min(1, '单位不能为空').max(50),
  referencePrice: z.number({ required_error: '参考单价不能为空' }),
  category: z.enum(['钢材', '混凝土', '管材', '骨料'], {
    errorMap: () => ({ message: '类别无效，必须是钢材、混凝土、管材、骨料之一' })
  })
})

export const prepaymentRouterFactory = (): Router => {
  const app = Router()
  const getStream = getStreamFactory({ db })

  // 1. 查询预付(留)款条目列表
  app.get(
    '/api/v1/projects/:projectId/prepayment-items',
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream
      })
    ),
    validateRequest({
      params: routeParamsSchema,
      query: getPrepaymentSchema.shape.query
    }),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const { search, page, limit } = req.query as any

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const offset = (page - 1) * limit

        const { items, totalCount } = await getPrepaymentItemsPageFactory({ db: projectDb })({
          projectId,
          search,
          offset,
          limit
        })

        return res.status(200).json({
          data: items,
          meta: {
            total: totalCount,
            page,
            limit
          }
        })
      } catch (err) {
        req.log.error(err, 'Get prepayment items error')
        return res.status(500).json({ error: '获取预付(留)款条目失败' })
      }
    }
  )

  // 2. 新增预付(留)款条目
  app.post(
    '/api/v1/projects/:projectId/prepayment-items',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    validateRequest({
      params: routeParamsSchema,
      body: prepaymentItemBodySchema
    }),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const { name, type, percentage, category } = req.body

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const id = crypto.randomBytes(5).toString('hex')

        const newItem = {
          id,
          projectId,
          name,
          type,
          percentage: percentage ?? null,
          category,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        await insertPrepaymentItemFactory({ db: projectDb })(newItem)

        return res.status(201).json({ data: newItem })
      } catch (err) {
        req.log.error(err, 'Create prepayment item error')
        return res.status(500).json({ error: '创建预付(留)款条目失败' })
      }
    }
  )

  // 3. 更新预付(留)款条目
  app.put(
    '/api/v1/projects/:projectId/prepayment-items/:id',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    validateRequest({
      params: routeParamsSchema.extend({ id: z.string().trim().min(1) }),
      body: prepaymentItemBodySchema
    }),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const { name, type, percentage, category } = req.body

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const existing = await getPrepaymentItemFactory({ db: projectDb })({ projectId, id })
        if (!existing) {
          return res.status(404).json({ error: 'Prepayment item not found.' })
        }

        const updated = {
          name,
          type,
          percentage: percentage ?? null,
          category,
          updatedAt: new Date()
        }

        await updatePrepaymentItemFactory({ db: projectDb })({
          projectId,
          id,
          item: updated
        })

        return res.status(200).json({
          data: {
            ...existing,
            ...updated
          }
        })
      } catch (err) {
        req.log.error(err, 'Update prepayment item error')
        return res.status(500).json({ error: '更新预付(留)款条目失败' })
      }
    }
  )

  // 4. 删除预付(留)款条目
  app.delete(
    '/api/v1/projects/:projectId/prepayment-items/:id',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    validateRequest({
      params: routeParamsSchema.extend({ id: z.string().trim().min(1) })
    }),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const existing = await getPrepaymentItemFactory({ db: projectDb })({ projectId, id })
        if (!existing) {
          return res.status(404).json({ error: 'Prepayment item not found.' })
        }

        await deletePrepaymentItemFactory({ db: projectDb })({ projectId, id })

        return res.status(200).json({ data: { id } })
      } catch (err) {
        req.log.error(err, 'Delete prepayment item error')
        return res.status(500).json({ error: '删除预付(留)款条目失败' })
      }
    }
  )

  // ==================== 主材库 REST 接口 ====================

  // 5. 查询主材库列表
  app.get(
    '/api/v1/projects/:projectId/main-materials',
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream
      })
    ),
    validateRequest({
      params: routeParamsSchema,
      query: getPrepaymentSchema.shape.query
    }),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const { search, page, limit } = req.query as any

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const offset = (page - 1) * limit

        const { items, totalCount } = await getMainMaterialsPageFactory({ db: projectDb })({
          projectId,
          search,
          offset,
          limit
        })

        return res.status(200).json({
          data: items,
          meta: {
            total: totalCount,
            page,
            limit
          }
        })
      } catch (err) {
        req.log.error(err, 'Get main materials error')
        return res.status(500).json({ error: '获取主材库列表失败' })
      }
    }
  )

  // 6. 新增主材条目
  app.post(
    '/api/v1/projects/:projectId/main-materials',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    validateRequest({
      params: routeParamsSchema,
      body: mainMaterialBodySchema
    }),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const { name, specification, unit, referencePrice, category } = req.body

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const id = crypto.randomBytes(5).toString('hex')

        const newItem = {
          id,
          projectId,
          name,
          specification,
          unit,
          referencePrice,
          category,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        await insertMainMaterialFactory({ db: projectDb })(newItem)

        return res.status(201).json({ data: newItem })
      } catch (err) {
        req.log.error(err, 'Create main material error')
        return res.status(500).json({ error: '创建主材条目失败' })
      }
    }
  )

  // 7. 更新主材条目
  app.put(
    '/api/v1/projects/:projectId/main-materials/:id',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    validateRequest({
      params: routeParamsSchema.extend({ id: z.string().trim().min(1) }),
      body: mainMaterialBodySchema
    }),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const { name, specification, unit, referencePrice, category } = req.body

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const existing = await getMainMaterialFactory({ db: projectDb })({ projectId, id })
        if (!existing) {
          return res.status(404).json({ error: 'Main material not found.' })
        }

        const updated = {
          name,
          specification,
          unit,
          referencePrice,
          category,
          updatedAt: new Date()
        }

        await updateMainMaterialFactory({ db: projectDb })({
          projectId,
          id,
          item: updated
        })

        return res.status(200).json({
          data: {
            ...existing,
            ...updated
          }
        })
      } catch (err) {
        req.log.error(err, 'Update main material error')
        return res.status(500).json({ error: '更新主材条目失败' })
      }
    }
  )

  // 8. 删除主材条目
  app.delete(
    '/api/v1/projects/:projectId/main-materials/:id',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    validateRequest({
      params: routeParamsSchema.extend({ id: z.string().trim().min(1) })
    }),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const existing = await getMainMaterialFactory({ db: projectDb })({ projectId, id })
        if (!existing) {
          return res.status(404).json({ error: 'Main material not found.' })
        }

        await deleteMainMaterialFactory({ db: projectDb })({ projectId, id })

        return res.status(200).json({ data: { id } })
      } catch (err) {
        req.log.error(err, 'Delete main material error')
        return res.status(500).json({ error: '删除主材条目失败' })
      }
    }
  )

  return app
}
