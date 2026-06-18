import { Router, type Request } from 'express'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import { db } from '@/db/knex'
import {
  approveApprovalInstanceFactory,
  approvalBindingSubjectTypes,
  cancelApprovalInstanceFactory,
  getApprovalBindingByIdFactory,
  getApprovalBindingBySubjectFactory,
  getApprovalInstanceDetailsFactory,
  listApprovalInstancesByBindingIdFactory,
  rejectApprovalInstanceFactory,
  resubmitApprovalBindingFactory,
  returnApprovalInstanceToStartFactory,
  returnApprovalInstanceToStepFactory,
  submitApprovalBindingFactory
} from '@/modules/flow/services/approvalBindings'
import {
  setApprovalFlowDefinitionActiveStateFactory,
  getActiveApprovalFlowByCategoryFactory
} from '@/modules/flow/repositories/approvalFlows'
import {
  createApprovalFlowDefinitionWithStepsFactory
} from '@/modules/flow/services/approvalFlows'
import { BadRequestError, UnauthorizedError } from '@/modules/shared/errors'
import { normalizeCategory, ApprovalFlowCategory } from '@/modules/flow/helpers/category'

const bindingIdParamsSchema = z.object({
  bindingId: z.string().trim().min(1).max(10)
})

const instanceIdParamsSchema = z.object({
  instanceId: z.string().trim().min(1).max(10)
})

const bySubjectQuerySchema = z
  .object({
    projectId: z.string().trim().min(1).max(10),
    subjectType: z.enum(approvalBindingSubjectTypes),
    subjectId: z.string().trim().min(1),
    subjectTable: z.string().trim().min(1).max(255).optional()
  })
  .superRefine((value, ctx) => {
    if (value.subjectType === 'FORM_RECORD' && !value.subjectTable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subjectTable'],
        message: 'subjectTable is required when subjectType is FORM_RECORD'
      })
    }
  })

const submitBindingBodySchema = z
  .object({
    projectId: z.string().trim().min(1).max(10),
    subjectType: z.enum(approvalBindingSubjectTypes),
    subjectId: z.string().trim().min(1),
    subjectTable: z.string().trim().min(1).max(255).nullable().optional(),
    definitionId: z.string().trim().min(1).max(10),
    formData: z.record(z.string(), z.unknown()).nullable().optional(),
    comment: z.string().trim().min(1).max(4000).nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (value.subjectType === 'FORM_RECORD' && !value.subjectTable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subjectTable'],
        message: 'subjectTable is required when subjectType is FORM_RECORD'
      })
    }
  })

const resubmitBindingBodySchema = z.object({
  formData: z.record(z.string(), z.unknown()).nullable().optional(),
  comment: z.string().trim().min(1).max(4000).nullable().optional()
})

const approveInstanceBodySchema = z.object({
  comment: z.string().trim().min(1).max(4000).nullable().optional()
})

const returnToStartBodySchema = z.object({
  comment: z.string().trim().min(1).max(4000)
})

const returnToStepBodySchema = z.object({
  targetStep: z.coerce.number().int().min(1),
  comment: z.string().trim().min(1).max(4000)
})

const rejectInstanceBodySchema = z.object({
  comment: z.string().trim().min(1).max(4000)
})

const cancelInstanceBodySchema = z.object({
  comment: z.string().trim().min(1).max(4000).nullable().optional()
})

const requireAuthenticatedUser = (req: Request) => {
  if (!req.context.auth || !req.context.userId) {
    throw new UnauthorizedError()
  }

  return req.context.userId
}

export const flowRouterFactory = (): Router => {
  const app = Router()

  const getApprovalBindingBySubject = getApprovalBindingBySubjectFactory({ db })
  const getApprovalBindingById = getApprovalBindingByIdFactory({ db })
  const listApprovalInstancesByBindingId = listApprovalInstancesByBindingIdFactory({ db })
  const getApprovalInstanceDetails = getApprovalInstanceDetailsFactory({ db })
  const submitApprovalBinding = submitApprovalBindingFactory({ db })
  const resubmitApprovalBinding = resubmitApprovalBindingFactory({ db })
  const approveApprovalInstance = approveApprovalInstanceFactory({ db })
  const returnApprovalInstanceToStart = returnApprovalInstanceToStartFactory({ db })
  const returnApprovalInstanceToStep = returnApprovalInstanceToStepFactory({ db })
  const rejectApprovalInstance = rejectApprovalInstanceFactory({ db })
  const cancelApprovalInstance = cancelApprovalInstanceFactory({ db })

  app.get(
    '/api/approval-bindings/by-subject',
    validateRequest({
      query: bySubjectQuerySchema
    }),
    async (req, res) => {
      const query = bySubjectQuerySchema.parse(req.query)
      const result = await getApprovalBindingBySubject({
        projectId: query.projectId,
        subjectType: query.subjectType,
        subjectId: query.subjectId,
        subjectTable: query.subjectTable || null
      })

      return res.status(200).send(result)
    }
  )

  app.get(
    '/api/approval-bindings/:bindingId',
    validateRequest({
      params: bindingIdParamsSchema
    }),
    async (req, res) => {
      const { bindingId } = bindingIdParamsSchema.parse(req.params)
      const result = await getApprovalBindingById(bindingId)

      return res.status(200).send(result)
    }
  )

  app.get(
    '/api/approval-bindings/:bindingId/instances',
    validateRequest({
      params: bindingIdParamsSchema
    }),
    async (req, res) => {
      const { bindingId } = bindingIdParamsSchema.parse(req.params)
      const result = await listApprovalInstancesByBindingId(bindingId)

      return res.status(200).send(result)
    }
  )

  app.get(
    '/api/approval-instances/:instanceId',
    validateRequest({
      params: instanceIdParamsSchema
    }),
    async (req, res) => {
      const { instanceId } = instanceIdParamsSchema.parse(req.params)
      const result = await getApprovalInstanceDetails(instanceId)

      return res.status(200).send(result)
    }
  )

  app.post(
    '/api/approval-bindings/submit',
    validateRequest({
      body: submitBindingBodySchema
    }),
    async (req, res) => {
      const actorUserId = requireAuthenticatedUser(req)
      const body = submitBindingBodySchema.parse(req.body)
      const result = await submitApprovalBinding({
        projectId: body.projectId,
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        subjectTable: body.subjectTable || null,
        definitionId: body.definitionId,
        formData: body.formData || null,
        comment: body.comment || null,
        actorUserId
      })

      return res.status(201).send(result)
    }
  )

  app.post(
    '/api/approval-bindings/:bindingId/resubmit',
    validateRequest({
      params: bindingIdParamsSchema,
      body: resubmitBindingBodySchema
    }),
    async (req, res) => {
      const actorUserId = requireAuthenticatedUser(req)
      const { bindingId } = bindingIdParamsSchema.parse(req.params)
      const body = resubmitBindingBodySchema.parse(req.body)
      const result = await resubmitApprovalBinding({
        bindingId,
        formData: body.formData || null,
        comment: body.comment || null,
        actorUserId
      })

      return res.status(200).send(result)
    }
  )

  app.post(
    '/api/approval-instances/:instanceId/approve',
    validateRequest({
      params: instanceIdParamsSchema,
      body: approveInstanceBodySchema
    }),
    async (req, res) => {
      const actorUserId = requireAuthenticatedUser(req)
      const { instanceId } = instanceIdParamsSchema.parse(req.params)
      const body = approveInstanceBodySchema.parse(req.body)
      const result = await approveApprovalInstance({
        instanceId,
        comment: body.comment || null,
        actorUserId
      })

      return res.status(200).send(result)
    }
  )

  app.post(
    '/api/approval-instances/:instanceId/return-to-start',
    validateRequest({
      params: instanceIdParamsSchema,
      body: returnToStartBodySchema
    }),
    async (req, res) => {
      const actorUserId = requireAuthenticatedUser(req)
      const { instanceId } = instanceIdParamsSchema.parse(req.params)
      const body = returnToStartBodySchema.parse(req.body)
      const result = await returnApprovalInstanceToStart({
        instanceId,
        comment: body.comment,
        actorUserId
      })

      return res.status(200).send(result)
    }
  )

  app.post(
    '/api/approval-instances/:instanceId/return-to-step',
    validateRequest({
      params: instanceIdParamsSchema,
      body: returnToStepBodySchema
    }),
    async (req, res) => {
      const actorUserId = requireAuthenticatedUser(req)
      const { instanceId } = instanceIdParamsSchema.parse(req.params)
      const body = returnToStepBodySchema.parse(req.body)
      if (body.targetStep <= 0) {
        throw new BadRequestError('targetStep must be greater than 0 for return-to-step')
      }
      const result = await returnApprovalInstanceToStep({
        instanceId,
        targetStep: body.targetStep,
        comment: body.comment,
        actorUserId
      })

      return res.status(200).send(result)
    }
  )

  app.post(
    '/api/approval-instances/:instanceId/reject',
    validateRequest({
      params: instanceIdParamsSchema,
      body: rejectInstanceBodySchema
    }),
    async (req, res) => {
      const actorUserId = requireAuthenticatedUser(req)
      const { instanceId } = instanceIdParamsSchema.parse(req.params)
      const body = rejectInstanceBodySchema.parse(req.body)
      const result = await rejectApprovalInstance({
        instanceId,
        comment: body.comment,
        actorUserId
      })

      return res.status(200).send(result)
    }
  )

  app.post(
    '/api/approval-instances/:instanceId/cancel',
    validateRequest({
      params: instanceIdParamsSchema,
      body: cancelInstanceBodySchema
    }),
    async (req, res) => {
      const actorUserId = requireAuthenticatedUser(req)
      const { instanceId } = instanceIdParamsSchema.parse(req.params)
      const body = cancelInstanceBodySchema.parse(req.body)
      const result = await cancelApprovalInstance({
        instanceId,
        comment: body.comment || null,
        actorUserId
      })

      return res.status(200).send(result)
    }
  )

  app.get(
    '/api/users',
    async (req, res) => {
      requireAuthenticatedUser(req)
      const users = await db('users')
        .select('id', 'name', 'avatar')
        .orderBy('name', 'asc')

      return res.status(200).send(users)
    }
  )

  app.get(
    '/api/projects/:projectId/approval-definitions',
    async (req, res) => {
      requireAuthenticatedUser(req)
      const { projectId } = req.params

      const definitions = await db('approval_flow_definitions')
        .where('projectId', projectId)
        .orderBy('version', 'desc')
        .orderBy('updatedAt', 'desc')

      const result = []
      for (const def of definitions) {
        const steps = await db('approval_flow_definition_steps')
          .where('definitionId', def.id)
          .orderBy('stepIndex', 'asc')

        const stepsWithUsers = []
        for (const step of steps) {
          const approvers = await db('users')
            .select('id', 'name', 'avatar')
            .whereIn('id', step.approverIds || [])

          stepsWithUsers.push({
            id: step.id,
            role: step.name,
            approvers: approvers.map(u => u.name),
            selectedApprovers: approvers.map(u => ({
              id: u.id,
              name: u.name,
              avatar: u.avatar || null
            })),
            mode: step.requiredApprovals === 1 ? 'OR' : 'AND'
          })
        }

        const categoryId = normalizeCategory(def.triggerConfig?.category || (def.resourceType === 'MODEL' ? 'MODEL_REVIEW' : 'MONTHLY_INSPECTION'))
        const categoryInfo = ApprovalFlowCategory[categoryId]
        const category = { id: categoryInfo.id, name: categoryInfo.name }
        const description = def.triggerConfig?.description || ''

        result.push({
          id: def.id,
          templateId: def.templateId,
          name: def.name,
          category,
          isActive: def.isActive,
          version: def.version,
          description,
          steps: stepsWithUsers,
          createdAt: def.createdAt,
          updatedAt: def.updatedAt
        })
      }

      return res.status(200).send(result)
    }
  )

  app.post(
    '/api/projects/:projectId/approval-definitions',
    async (req, res) => {
      const actorUserId = requireAuthenticatedUser(req)
      const { projectId } = req.params
      const body = req.body

      const categoryId = normalizeCategory(body.category)
      const categoryConfig = ApprovalFlowCategory[categoryId]
      const resourceType = categoryConfig.resourceType

      const createWithSteps = createApprovalFlowDefinitionWithStepsFactory({ db })
      
      const steps = (body.steps || []).map((s: any) => {
        const approverIds = (s.selectedApprovers || []).map((u: any) => u.id)
        return {
          name: s.role || '审批节点',
          approverIds,
          requiredApprovals: s.mode === 'OR' ? 1 : approverIds.length,
          timeoutHours: null
        }
      })

      const triggerConfig = {
        category: categoryConfig.id,
        description: body.description || ''
      }

      let templateId = body.templateId || body.id
      if (templateId && templateId.startsWith('flow-')) {
        templateId = null
      }

      // Enforce unique workflow template/family per category within a project
      let searchCategories: string[]
      if (categoryId === 'MODEL_REVIEW') {
        searchCategories = ['MODEL_REVIEW', '模型审核', '模型', '模型管理']
      } else if (categoryId === 'SAFETY_MEASURE') {
        searchCategories = ['SAFETY_MEASURE', '安全文明措施费', '安全文明措施']
      } else {
        searchCategories = ['MONTHLY_INSPECTION', '月度验工', '表单', '质量验收', '验工计价']
      }

      const existingDefinition = await db('approval_flow_definitions')
        .where('projectId', projectId)
        .whereIn(db.raw(`"triggerConfig"->>'category'`) as any, searchCategories)
        .first()

      if (existingDefinition) {
        templateId = existingDefinition.templateId
      }

      const definition = await createWithSteps({
        templateId,
        projectId,
        name: body.name,
        resourceType,
        isActive: body.isActive ?? true,
        triggerConfig,
        steps,
        createdBy: actorUserId
      })

      return res.status(201).send(definition)
    }
  )

  app.get(
    '/api/approval-categories',
    async (req, res) => {
      requireAuthenticatedUser(req)
      const list = Object.values(ApprovalFlowCategory).map(c => ({
        id: c.id,
        name: c.name
      }))
      return res.status(200).send(list)
    }
  )

  app.get(
    '/api/projects/:projectId/approval-definitions/active',
    async (req, res) => {
      requireAuthenticatedUser(req)
      const { projectId } = req.params
      const categoryParam = req.query.category as string
      if (!categoryParam) {
        throw new BadRequestError('category is required')
      }

      const getActiveByCategory = getActiveApprovalFlowByCategoryFactory({ db })
      const def = await getActiveByCategory({
        projectId,
        category: categoryParam
      })

      if (!def) {
        return res.status(404).send({ error: 'No active definition found for category' })
      }

      const steps = await db('approval_flow_definition_steps')
        .where('definitionId', def.id)
        .orderBy('stepIndex', 'asc')

      const stepsWithUsers = []
      for (const step of steps) {
        const approvers = await db('users')
          .select('id', 'name', 'avatar')
          .whereIn('id', step.approverIds || [])

        stepsWithUsers.push({
          id: step.id,
          role: step.name,
          approvers: approvers.map(u => u.name),
          selectedApprovers: approvers.map(u => ({
            id: u.id,
            name: u.name,
            avatar: u.avatar || null
          })),
          mode: step.requiredApprovals === 1 ? 'OR' : 'AND'
        })
      }

      const id = normalizeCategory((def.triggerConfig as any)?.category)
      const categoryInfo = ApprovalFlowCategory[id]
      const description = def.triggerConfig?.description || ''

      return res.status(200).send({
        id: def.id,
        templateId: def.templateId,
        name: def.name,
        category: { id: categoryInfo.id, name: categoryInfo.name },
        isActive: def.isActive,
        version: def.version,
        description,
        steps: stepsWithUsers,
        createdAt: def.createdAt,
        updatedAt: def.updatedAt
      })
    }
  )

  app.post(
    '/api/projects/:projectId/approval-definitions/:id/toggle-active',
    async (req, res) => {
      requireAuthenticatedUser(req)
      const { id } = req.params
      const { isActive } = req.body

      const setDefinitionActive = setApprovalFlowDefinitionActiveStateFactory({ db })
      const definition = await setDefinitionActive({
        definitionId: id,
        isActive
      })

      return res.status(200).send(definition)
    }
  )

  app.delete(
    '/api/projects/:projectId/approval-definitions/:id',
    async (req, res) => {
      requireAuthenticatedUser(req)
      const { id } = req.params
      
      await db('approval_flow_definition_steps').where('definitionId', id).del()
      await db('approval_flow_definitions').where('id', id).del()

      return res.status(200).send({ success: true })
    }
  )

  return app
}
