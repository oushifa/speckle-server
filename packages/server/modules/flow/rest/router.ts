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
import { BadRequestError, UnauthorizedError } from '@/modules/shared/errors'

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

  return app
}
