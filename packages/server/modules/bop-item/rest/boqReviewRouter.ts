import { Router, json } from 'express'
import type { Request, Response } from 'express'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  streamReadPermissionsPipelineFactory,
  streamWritePermissionsPipelineFactory
} from '@/modules/shared/authz'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { db } from '@/db/knex'
import { adminOverrideEnabled } from '@/modules/shared/helpers/envHelper'
import { UnauthorizedError } from '@/modules/shared/errors'
import { ensureError, Roles } from '@speckle/shared'
import {
  ApprovalFlowInstanceStatus,
  getActiveApprovalFlowByCategoryFactory
} from '@/modules/flow/repositories/approvalFlows'
import {
  approveApprovalInstanceFactory,
  rejectApprovalInstanceFactory,
  resubmitApprovalBindingFactory,
  returnApprovalInstanceToStartFactory,
  returnApprovalInstanceToStepFactory,
  submitApprovalBindingFactory,
  syncBindingStatusFromInstanceFactory
} from '@/modules/flow/services/approvalBindings'
import { updateApprovalFlowStatusFactory } from '@/modules/flow/services/approvalFlows'
import {
  ApprovalFlowSubscriptions,
  publish
} from '@/modules/shared/utils/subscriptions'
import {
  BOQ_REVIEW_RECORDS_TABLE,
  validateReviewRows,
  type BoqReviewKind,
  type BoqReviewRowInput
} from '@/modules/bop-item/services/boqReviewApply'
import {
  createBoqReviewRecordFactory,
  deleteBoqReviewRecordFactory,
  getBoqItemAuditTraceFactory,
  getBoqItemsTraceSummaryFactory,
  getBoqReviewRecordDetailFactory,
  listBoqReviewRecordsFactory,
  saveBoqReviewRecordFactory
} from '@/modules/bop-item/repositories/boqReviews'

const hasServerAdminOverride = (req: Request) =>
  adminOverrideEnabled() && req.context.role === Roles.Server.Admin

const normalizeApprovalStatus = (status: string | null | undefined) =>
  String(status || 'START')
    .trim()
    .toUpperCase()

const isRegularDeleteAllowedStatus = (status: string | null | undefined) => {
  const normalized = normalizeApprovalStatus(status)
  return ['START', 'DRAFT', 'RETURNED', 'REJECTED', 'CANCELED', 'CANCELLED'].includes(
    normalized
  )
}

const isAdminDeleteAllowedStatus = (status: string | null | undefined) => {
  const normalized = normalizeApprovalStatus(status)
  return (
    isRegularDeleteAllowedStatus(normalized) ||
    normalized === 'PENDING' ||
    normalized === 'IN_REVIEW'
  )
}

const publishApprovalFlowTodoCountUpdated = async () => {
  await publish(ApprovalFlowSubscriptions.ApprovalFlowTodoCountUpdated, {
    approvalFlowTodoCountUpdated: {
      pendingForMeCount: 0
    }
  })
}

const cancelPendingApprovalFlowBeforeDelete = async (params: {
  instanceId?: string | null
  userId: string
}) => {
  if (!params.instanceId) return false

  const instance = await db('approval_flow_instances')
    .where('id', params.instanceId)
    .select('id', 'status')
    .first()
  if (!instance || instance.status !== ApprovalFlowInstanceStatus.Pending) return false

  await updateApprovalFlowStatusFactory({ db })({
    instanceId: params.instanceId,
    userId: params.userId,
    targetStatus: ApprovalFlowInstanceStatus.Canceled,
    comment: '清单审核单据已删除，系统自动取消审批流程',
    forceByAdmin: true
  })

  return true
}

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message
  return String(e)
}

export const registerBoqReviewRoutes = (app: Router): void => {
  const getStream = getStreamFactory({ db })

  // 1. 获取项目内所有清单项的审核追溯摘要计数映射
  app.get(
    '/api/v1/projects/:projectId/boq/trace-summary',
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const summary = await getBoqItemsTraceSummaryFactory({
          db: projectDb,
          mainDb: db
        })({ projectId })

        return res.status(200).json(summary)
      } catch (e) {
        req.log.error(ensureError(e), 'BOQ trace-summary error')
        return res.status(500).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 2. 获取单条清单项的完整变更与审批追溯历史
  app.get(
    '/api/v1/projects/:projectId/boq/items/:itemId/audit-trace',
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId, itemId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const trace = await getBoqItemAuditTraceFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          itemId
        })

        return res.status(200).json(trace)
      } catch (e) {
        const msg = getErrorMessage(e)
        if (msg.includes('不存在')) {
          return res.status(404).json({ error: msg })
        }
        req.log.error(ensureError(e), 'BOQ item audit-trace error')
        return res.status(500).json({ error: msg })
      }
    }
  )

  // 3. 查询复核单 / 签证变更单列表
  app.get(
    '/api/v1/projects/:projectId/boq/reviews',
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const kind = req.query.kind ? String(req.query.kind) : undefined
        const search = req.query.search ? String(req.query.search) : undefined

        const projectDb = await getProjectDbClient({ projectId })
        const items = await listBoqReviewRecordsFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          kind,
          search
        })

        return res.status(200).json({
          items,
          records: items,
          totalCount: items.length
        })
      } catch (e) {
        req.log.error(ensureError(e), 'BOQ reviews list error')
        return res.status(500).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 4. 新建复核单 / 签证变更单草稿
  app.post(
    '/api/v1/projects/:projectId/boq/reviews',
    json({ limit: '10mb' }),
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const body = req.body || {}
        const kind: BoqReviewKind = body.kind === 'change' ? 'change' : 'review'

        let defaultApplicant = '施工单位'
        const userRow = await db('users').where('id', userId).select('name').first()
        if (userRow?.name) {
          defaultApplicant = String(userRow.name)
        }

        const projectDb = await getProjectDbClient({ projectId })
        const created = await createBoqReviewRecordFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          kind,
          code: body.code ? String(body.code) : undefined,
          reason: body.reason ? String(body.reason) : '',
          applicant: body.applicant ? String(body.applicant) : defaultApplicant,
          applicantId: userId,
          applyDate: body.applyDate ? String(body.applyDate) : undefined,
          attachments: Array.isArray(body.attachments) ? body.attachments : [],
          history: Array.isArray(body.history) ? body.history : undefined,
          rows: Array.isArray(body.rows) ? body.rows : []
        })

        return res.status(201).json({
          success: true,
          record: created,
          ...created
        })
      } catch (e) {
        req.log.error(ensureError(e), 'Create BOQ review error')
        return res.status(400).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 5. 获取复核单 / 签证变更单详情
  app.get(
    '/api/v1/projects/:projectId/boq/reviews/:recordId',
    authMiddlewareCreator(
      streamReadPermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId, recordId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const detail = await getBoqReviewRecordDetailFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          recordId
        })

        if (!detail) {
          return res.status(404).json({ error: '清单审核单据不存在' })
        }

        return res.status(200).json({
          record: detail,
          ...detail
        })
      } catch (e) {
        req.log.error(ensureError(e), 'Get BOQ review detail error')
        return res.status(500).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 6. 保存更新复核单 / 签证变更单信息与明细行
  app.put(
    '/api/v1/projects/:projectId/boq/reviews/:recordId',
    json({ limit: '10mb' }),
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId, recordId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const existing = await projectDb(BOQ_REVIEW_RECORDS_TABLE)
          .where('id', recordId)
          .andWhere('projectId', projectId)
          .first()

        if (!existing) {
          return res.status(404).json({ error: '清单审核单据不存在' })
        }

        if (existing.approveStatus === 'APPROVED' && existing.effectiveAt) {
          return res.status(400).json({ error: '已审核通过并生效的单据不可修改' })
        }

        const body = req.body || {}
        const updated = await saveBoqReviewRecordFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          recordId,
          reason: body.reason,
          applicant: body.applicant,
          applyDate: body.applyDate,
          attachments: body.attachments,
          history: body.history,
          appendHistoryAction: body.appendHistoryAction,
          rows: Array.isArray(body.rows) ? body.rows : undefined
        })

        return res.status(200).json({
          success: true,
          record: updated,
          ...updated
        })
      } catch (e) {
        req.log.error(ensureError(e), 'Update BOQ review error')
        return res.status(400).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 7. 删除复核单 / 签证变更单
  app.delete(
    '/api/v1/projects/:projectId/boq/reviews/:recordId',
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId, recordId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const isAdminOverride = hasServerAdminOverride(req)
        const projectDb = await getProjectDbClient({ projectId })
        const record = await projectDb(BOQ_REVIEW_RECORDS_TABLE)
          .where('id', recordId)
          .andWhere('projectId', projectId)
          .first()

        if (!record) {
          return res.status(404).json({ error: '清单审核单据不存在' })
        }

        const binding = await db('approval_flow_bindings')
          .where('subjectKey', `${BOQ_REVIEW_RECORDS_TABLE}:${recordId}`)
          .select('id', 'status', 'currentInstanceId')
          .first()

        const currentStatus = binding ? binding.status : record.approveStatus || 'START'

        if (
          (!isAdminOverride && !isRegularDeleteAllowedStatus(currentStatus)) ||
          (isAdminOverride && !isAdminDeleteAllowedStatus(currentStatus))
        ) {
          return res.status(400).json({
            error: isAdminOverride
              ? '已审核通过并生效的单据不支持删除'
              : '送审后审批中或已通过的单据不可删除'
          })
        }

        const didCancelPendingFlow = await cancelPendingApprovalFlowBeforeDelete({
          instanceId: binding?.currentInstanceId || record.flowInstanceId,
          userId
        })

        await deleteBoqReviewRecordFactory({ db: projectDb })({
          projectId,
          recordId
        })

        if (binding) {
          await db('approval_flow_bindings')
            .where('subjectKey', `${BOQ_REVIEW_RECORDS_TABLE}:${recordId}`)
            .delete()
        }
        if (didCancelPendingFlow) {
          await publishApprovalFlowTodoCountUpdated()
        }

        return res.status(200).json({ success: true })
      } catch (e) {
        req.log.error(ensureError(e), 'Delete BOQ review error')
        return res.status(400).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 8. 送审复核单 / 签证变更单（发起或重新提交 BOQ_REVIEW 工作流）
  app.post(
    '/api/v1/projects/:projectId/boq/reviews/:recordId/submit',
    json({ limit: '10mb' }),
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId, recordId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const project = await getStream({ streamId: projectId })
        if (!project) {
          return res.status(404).json({ error: 'Project not found.' })
        }

        const projectDb = await getProjectDbClient({ projectId })
        const existing = await projectDb(BOQ_REVIEW_RECORDS_TABLE)
          .where('id', recordId)
          .andWhere('projectId', projectId)
          .first()

        if (!existing) {
          return res.status(404).json({ error: '清单审核单据不存在' })
        }

        const body = req.body || {}
        // 若送审时请求体带了最新表单与明细数据，先保存更新
        if (
          body.reason !== undefined ||
          body.applicant !== undefined ||
          body.applyDate !== undefined ||
          body.attachments !== undefined ||
          Array.isArray(body.rows)
        ) {
          await saveBoqReviewRecordFactory({ db: projectDb, mainDb: db })({
            projectId,
            recordId,
            reason: body.reason,
            applicant: body.applicant,
            applyDate: body.applyDate,
            attachments: body.attachments,
            rows: Array.isArray(body.rows)
              ? (body.rows as BoqReviewRowInput[])
              : undefined
          })
        }

        const detail = await getBoqReviewRecordDetailFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          recordId
        })

        if (!detail) {
          return res.status(404).json({ error: '清单审核单据不存在' })
        }

        // 查询现有正式清单编码集合，校验新建项是否冲突及各项必填与数值合法性
        const boqCodesRows = await projectDb('boq_items')
          .where('projectId', projectId)
          .select('code')
        const existingBoqCodes = new Set<string>(
          boqCodesRows.map((r: any) => String(r.code || '').trim()).filter(Boolean)
        )

        const validationIssues = validateReviewRows(
          detail.rows,
          detail.kind,
          existingBoqCodes,
          { stage: 'contractor' }
        )
        if (validationIssues.length > 0) {
          const errors = validationIssues.map((x) => x.message)
          return res.status(400).json({
            error: errors[0],
            errors,
            issues: validationIssues
          })
        }

        const binding = await db('approval_flow_bindings')
          .where('subjectKey', `${BOQ_REVIEW_RECORDS_TABLE}:${recordId}`)
          .select('id', 'status', 'currentInstanceId')
          .first()

        const currentStatus = binding ? binding.status : detail.approveStatus || 'START'
        if (
          currentStatus === 'IN_REVIEW' ||
          currentStatus === 'PENDING' ||
          currentStatus === 'APPROVED'
        ) {
          return res.status(400).json({ error: '该单据已送审或已通过，请勿重复送审' })
        }

        const userRow = await db('users').where('id', userId).select('name').first()
        const actorName = userRow?.name
          ? String(userRow.name)
          : detail.applicant || '施工单位'
        const remark =
          (typeof body.remark === 'string' && body.remark.trim()) ||
          (typeof body.comment === 'string' && body.comment.trim()) ||
          ''

        let instanceId: string | null = null
        let historyActionLabel = '提交审核'

        if (currentStatus === 'RETURNED' && binding) {
          const resubmitApprovalBinding = resubmitApprovalBindingFactory({ db })
          const result = await resubmitApprovalBinding({
            bindingId: binding.id,
            formData: {
              formTable: BOQ_REVIEW_RECORDS_TABLE,
              formId: recordId,
              projectId,
              kind: detail.kind
            },
            comment:
              remark || `重新送审${detail.kind === 'change' ? '签证变更单' : '复核单'}`,
            actorUserId: userId
          })
          instanceId = result.currentInstanceId
          historyActionLabel = '重新提交审核'
        } else {
          const getActiveByCategory = getActiveApprovalFlowByCategoryFactory({ db })
          const activeDef = await getActiveByCategory({
            projectId,
            category: 'BOQ_REVIEW'
          })

          if (!activeDef) {
            return res.status(400).json({
              error:
                '未找到启用的清单审核流程，请先前往「项目设置 -> 审批流程 -> 清单审核」创建并启用。'
            })
          }

          const submitApprovalBinding = submitApprovalBindingFactory({ db })
          const result = await submitApprovalBinding({
            projectId,
            subjectType: 'FORM_RECORD',
            subjectId: recordId,
            subjectTable: BOQ_REVIEW_RECORDS_TABLE,
            definitionId: activeDef.id,
            formData: {
              formTable: BOQ_REVIEW_RECORDS_TABLE,
              formId: recordId,
              projectId,
              kind: detail.kind
            },
            comment:
              remark || `送审${detail.kind === 'change' ? '签证变更单' : '复核单'}`,
            actorUserId: userId
          })
          instanceId = result.currentInstanceId
        }

        // 若第 1 个步骤（stepIndex === 1）名称匹配 /施工单位|发起/ 且后续还有步骤（如财务监理审核），
        // 自动推进第 1 步，使送审后直接流转到第 2 步「财务监理审核」
        if (instanceId) {
          const instanceSteps = await db('approval_flow_instance_steps')
            .where('instanceId', instanceId)
            .orderBy('stepIndex', 'asc')
          const firstApprovalStep = instanceSteps.find((s: any) => s.stepIndex === 1)
          const hasNextApprovalStep = instanceSteps.some((s: any) => s.stepIndex > 1)

          if (
            firstApprovalStep &&
            firstApprovalStep.status === 'PENDING' &&
            hasNextApprovalStep &&
            /施工单位|发起/.test(String(firstApprovalStep.name || ''))
          ) {
            await updateApprovalFlowStatusFactory({ db })({
              instanceId,
              userId,
              targetStatus: ApprovalFlowInstanceStatus.Approved,
              comment: remark || '施工单位提交送审',
              forceByAdmin: true
            })
            await syncBindingStatusFromInstanceFactory({ db })({
              instanceId,
              updater: userId
            })
          }
        }

        await saveBoqReviewRecordFactory({ db: projectDb, mainDb: db })({
          projectId,
          recordId,
          appendHistoryAction: {
            by: actorName,
            action: historyActionLabel,
            ...(remark ? { reason: remark } : {})
          }
        })

        await projectDb(BOQ_REVIEW_RECORDS_TABLE)
          .where('id', recordId)
          .andWhere('projectId', projectId)
          .update({
            flowInstanceId: instanceId,
            approveStatus: 'PENDING',
            updatedAt: new Date()
          })

        const refreshed = await getBoqReviewRecordDetailFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          recordId
        })

        return res.status(200).json({
          success: true,
          instanceId,
          record: refreshed,
          ...(refreshed || {})
        })
      } catch (e) {
        req.log.error(ensureError(e), 'Submit BOQ review error')
        return res.status(400).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 9. 审批通过当前节点（支持同时保存审核人修改的三方量）
  app.post(
    '/api/v1/projects/:projectId/boq/reviews/:recordId/approve',
    json({ limit: '10mb' }),
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId, recordId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const projectDb = await getProjectDbClient({ projectId })
        const body = req.body || {}
        const comment =
          (typeof body.comment === 'string' && body.comment.trim()) ||
          (typeof body.remark === 'string' && body.remark.trim()) ||
          null

        if (Array.isArray(body.rows)) {
          await saveBoqReviewRecordFactory({ db: projectDb, mainDb: db })({
            projectId,
            recordId,
            rows: body.rows as BoqReviewRowInput[]
          })
        }

        const detailBefore = await getBoqReviewRecordDetailFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          recordId
        })
        if (!detailBefore) {
          return res.status(404).json({ error: '清单审核单据不存在' })
        }
        if (!detailBefore.flowInstanceId) {
          return res.status(400).json({ error: '该单据尚未关联审批流程实例' })
        }

        const userRow = await db('users').where('id', userId).select('name').first()
        const actorName = userRow?.name
          ? String(userRow.name)
          : detailBefore.currentStepName || '审批人'

        await saveBoqReviewRecordFactory({ db: projectDb, mainDb: db })({
          projectId,
          recordId,
          appendHistoryAction: {
            by: actorName,
            action: `${detailBefore.currentStepName || '节点'}审核通过`,
            ...(comment ? { reason: comment } : {})
          }
        })

        await approveApprovalInstanceFactory({ db })({
          instanceId: detailBefore.flowInstanceId,
          comment,
          actorUserId: userId
        })

        const refreshed = await getBoqReviewRecordDetailFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          recordId
        })

        return res.status(200).json({
          success: true,
          record: refreshed,
          ...(refreshed || {})
        })
      } catch (e) {
        req.log.error(ensureError(e), 'Approve BOQ review error')
        return res.status(400).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 10. 驳回/退回当前节点（支持退回发起人、退回指定步骤或直接驳回）
  app.post(
    '/api/v1/projects/:projectId/boq/reviews/:recordId/return',
    json({ limit: '10mb' }),
    authMiddlewareCreator(
      streamWritePermissionsPipelineFactory({
        getStream
      })
    ),
    async (req: Request, res: Response) => {
      const { projectId, recordId } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      try {
        const projectDb = await getProjectDbClient({ projectId })
        const body = req.body || {}
        const comment = String(body.comment || body.reason || body.remark || '').trim()
        if (!comment) {
          return res.status(400).json({ error: '请填写退回/驳回原因' })
        }

        if (Array.isArray(body.rows)) {
          await saveBoqReviewRecordFactory({ db: projectDb, mainDb: db })({
            projectId,
            recordId,
            rows: body.rows as BoqReviewRowInput[]
          })
        }

        const detailBefore = await getBoqReviewRecordDetailFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          recordId
        })
        if (!detailBefore) {
          return res.status(404).json({ error: '清单审核单据不存在' })
        }
        if (!detailBefore.flowInstanceId) {
          return res.status(400).json({ error: '该单据尚未关联审批流程实例' })
        }

        const userRow = await db('users').where('id', userId).select('name').first()
        const actorName = userRow?.name
          ? String(userRow.name)
          : detailBefore.currentStepName || '审批人'

        const targetStep =
          body.targetStep !== undefined && body.targetStep !== null
            ? Number(body.targetStep)
            : 0
        const mode = String(body.mode || 'start')

        if (mode === 'reject') {
          await rejectApprovalInstanceFactory({ db })({
            instanceId: detailBefore.flowInstanceId,
            comment,
            actorUserId: userId
          })
        } else if (targetStep > 0) {
          await returnApprovalInstanceToStepFactory({ db })({
            instanceId: detailBefore.flowInstanceId,
            targetStep,
            comment,
            actorUserId: userId
          })
        } else {
          await returnApprovalInstanceToStartFactory({ db })({
            instanceId: detailBefore.flowInstanceId,
            comment,
            actorUserId: userId
          })
        }

        await saveBoqReviewRecordFactory({ db: projectDb, mainDb: db })({
          projectId,
          recordId,
          appendHistoryAction: {
            by: actorName,
            action: `${detailBefore.currentStepName || '节点'}退回修改`,
            reason: comment
          }
        })

        const refreshed = await getBoqReviewRecordDetailFactory({
          db: projectDb,
          mainDb: db
        })({
          projectId,
          recordId
        })

        return res.status(200).json({
          success: true,
          record: refreshed,
          ...(refreshed || {})
        })
      } catch (e) {
        req.log.error(ensureError(e), 'Return BOQ review error')
        return res.status(400).json({ error: getErrorMessage(e) })
      }
    }
  )
}
