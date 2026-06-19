import { Router, type RequestHandler } from 'express'
import type { Request, Response } from 'express'
import { preciseAdd, preciseMul } from '@/modules/shared/helpers/preciseMath'
import { z } from 'zod'
import { validateRequest } from 'zod-express'
import type Busboy from 'busboy'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { db } from '@/db/knex'
import { getStreamFactory } from '@/modules/core/repositories/streams'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  recalculateProjectCostSummaryFactory,
  getOrRecalculateProjectCostSummaryFactory
} from '@/modules/project-statistics/services/projectCostSummaries'
import { importQualityAcceptanceFormsFactory } from '@/modules/quality-acceptance-form/services/qualityAcceptanceForms'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import {
  streamWritePermissionsPipelineFactory,
  streamReadPermissionsPipelineFactory
} from '@/modules/shared/authz'
import { createBusboy } from '@/modules/blobstorage/rest/busboy'
import { BadRequestError, UnauthorizedError } from '@/modules/shared/errors'
import { ensureError } from '@speckle/shared'
import cryptoRandomString from 'crypto-random-string'

import {
  getMonthlyMeasurementsFactory,
  countMonthlyMeasurementsFactory,
  getMonthlyMeasurementByIdFactory,
  getMonthlyMeasurementDetailsFactory,
  upsertMonthlyMeasurementDetailsFactory,
  getMonthlyPaymentDetailsFactory,
  upsertMonthlyPaymentDetailsFactory,
  getMonthlyPaymentRequestsFactory,
  upsertMonthlyPaymentRequestsFactory,
  getMonthlyMeasurementItemsFactory,
  updateMonthlyMeasurementItemsBatchFactory,
  deleteMonthlyMeasurementByIdFactory,
  createMonthlyMeasurementFactory,
  updateMonthlyMeasurementFactory,
  insertMonthlyMeasurementItemsFactory,
  deleteMonthlyMeasurementItemsByMeasurementIdFactory,
  getQualityAcceptanceFormsBeforeBaseDateFactory,
  getProjectBoqItemsFactory,
  getQualityAcceptanceFormsByIdsFactory,
  updateQualityAcceptanceApproveStatusByIdsFactory,
  getMonthlyMeasurementByProjectCodeFactory
} from '../repositories/monthlyMeasurements'

import {
  buildMonthlyMeasurementPreviewFactory,
  createMonthlyMeasurementFromPreviewFactory
} from '../services/monthlyMeasurements'

import {
  startApprovalFlowFactory,
  updateApprovalFlowStatusFactory
} from '@/modules/flow/services/approvalFlows'
import { getActiveApprovalFlowByCategoryFactory } from '@/modules/flow/repositories/approvalFlows'
import {
  resubmitApprovalBindingFactory,
  submitApprovalBindingFactory
} from '@/modules/flow/services/approvalBindings'

const thirdPartyTokenHeader = 'x-file-conversion-token'
const serviceCreator = 'quality-acceptance-import-service'

const routeParamsSchema = z.object({
  projectId: z.string().trim().min(1)
})

const importItemSchema = z.object({
  rowNumber: z.coerce.number().int().min(1).optional(),
  boqItemId: z.string().trim().min(1).max(10),
  name: z.string().trim().max(255).optional(),
  code: z.string().trim().max(255).optional(),
  inspectionLotNumber: z.string().trim().min(1).max(255),
  acceptancePart: z.string().trim().min(1).max(1024),
  acceptanceContent: z.string().trim().max(4096).optional(),
  actualStartDate: z.coerce.number().int().nullable().optional(),
  actualFinishDate: z.coerce.number().int(),
  inspector: z.string().trim().max(64).optional(),
  workVolume: z.coerce.number().finite(),
  unit: z.string().trim().max(64).optional(),
  timeZone: z.string().trim().max(128).optional(),
  approveStatus: z.string().trim().max(64).nullable().optional()
})

const importBodySchema = z.object({
  items: z.array(importItemSchema).min(1).max(500)
})

const requireServiceToken: RequestHandler = (req, res, next) => {
  const configuredToken = process.env['FILE_CONVERSION_SERVICE_TOKEN']
  if (!configuredToken) {
    return res
      .status(500)
      .send({ error: 'FILE_CONVERSION_SERVICE_TOKEN is not configured.' })
  }

  const token = req.headers[thirdPartyTokenHeader]
  if (!token || typeof token !== 'string') {
    return res.status(401).send({
      error: `Missing ${thirdPartyTokenHeader} request header.`
    })
  }

  if (token !== configuredToken) {
    return res.status(403).send({ error: 'Invalid service token.' })
  }

  return next()
}



const calculatePaymentRequestAmounts = async (projectDb: any, measurementId: string) => {
  const items = await getMonthlyMeasurementItemsFactory({ db: projectDb })(measurementId)
  const paymentDetails = await getMonthlyPaymentDetailsFactory({ db: projectDb })(measurementId)
  const extraPayItems = Array.isArray(paymentDetails?.extraPayItems)
    ? paymentDetails.extraPayItems
    : []

  let contractorPayAmtSum = 0
  let supervisionPayAmtSum = 0
  let contractPayAmtSum = 0
  let leaderPayAmtSum = 0

  for (const item of items) {
    if (!item.isSummaryRow) {
      const price = Number(item.price || 0)
      const contractorQty = Number(item.contractorQty || 0)
      const investmentQty = Number(item.investmentQty || 0)
      
      const contractorAmt = preciseMul(contractorQty, price)
      const supervisionAmt = preciseMul(investmentQty, price)
      const contractAmt = supervisionAmt
      const leaderAmt = supervisionAmt

      contractorPayAmtSum = preciseAdd(contractorPayAmtSum, contractorAmt)
      supervisionPayAmtSum = preciseAdd(supervisionPayAmtSum, supervisionAmt)
      contractPayAmtSum = preciseAdd(contractPayAmtSum, contractAmt)
      leaderPayAmtSum = preciseAdd(leaderPayAmtSum, leaderAmt)
    }
  }

  for (const extra of extraPayItems) {
    const contractorAmt = Number(extra.contractorPayAmt || 0)
    const supervisionAmt = Number(extra.investmentPayAmt || 0)
    const contractAmt = Number(extra.contractPayAmt || 0)
    const leaderAmt = Number(extra.leaderPayAmt || 0)

    contractorPayAmtSum = preciseAdd(contractorPayAmtSum, contractorAmt)
    supervisionPayAmtSum = preciseAdd(supervisionPayAmtSum, supervisionAmt)
    contractPayAmtSum = preciseAdd(contractPayAmtSum, contractAmt)
    leaderPayAmtSum = preciseAdd(leaderPayAmtSum, leaderAmt)
  }

  return {
    contractorPayAmt: contractorPayAmtSum,
    supervisionPayAmt: supervisionPayAmtSum,
    contractPayAmt: contractPayAmtSum,
    leaderPayAmt: leaderPayAmtSum
  }
}

export const qualityAcceptanceRouterFactory = (): Router => {
  const app = Router()
  const getStream = getStreamFactory({ db })

  // 1. 第三方导入接口 (服务间通信鉴权)
  app.post(
    '/api/v1/internal/projects/:projectId/quality-acceptance/forms/import',
    requireServiceToken,
    validateRequest({
      params: routeParamsSchema,
      body: importBodySchema
    }),
    async (req, res) => {
      const { projectId } = req.params
      const project = await getStream({ streamId: projectId })
      if (!project) {
        return res.status(404).send({ error: 'Project not found.' })
      }

      const projectDb = await getProjectDbClient({ projectId })
      const result = await importQualityAcceptanceFormsFactory({
        db,
        projectDb
      })({
        projectId,
        creator: serviceCreator,
        items: req.body.items.map((item, index) => ({
          ...item,
          rowNumber: item.rowNumber ?? index + 1
        }))
      })

      if (result.createdCount > 0) {
        await recalculateProjectCostSummaryFactory({ db: projectDb })({
          projectId
        })
      }

      return res.status(200).send({
        projectId,
        createdCount: result.createdCount,
        failedCount: result.failedCount,
        createdItems: result.createdItems,
        failedRows: result.failedRows
      })
    }
  )

  // 2. 导出 Excel 接口 (普通用户 Session 鉴权)
  app.get(
    '/api/v1/projects/:projectId/quality-acceptance/forms/export-excel',
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
        const isTemplate = req.query.template === 'true'

        const headers = [
          '验收单ID',
          '验收单名称',
          '编码',
          '检验批编号',
          '区域部位',
          '检验批内容',
          '验收日期',
          '工程量',
          '单位',
          '月度验工',
          '关联构件ID'
        ]

        let rows: any[] = []

        if (!isTemplate) {
          const q = projectDb('quality_acceptance_forms')
            .where('project_id', projectId)
            .orderBy('updatedAt', 'desc')

          const approveStatus = req.query.approveStatus as string | undefined
          if (approveStatus) {
            if (approveStatus === '__NULL__') {
              q.andWhere(function () {
                this.whereNull('approveStatus').orWhere('approveStatus', '')
              })
            } else {
              q.andWhere('approveStatus', approveStatus)
            }
          }

          const search = req.query.search as string | undefined
          if (search && search.trim()) {
            const searchPattern = `%${search.trim()}%`
            q.andWhere(function () {
              this.whereILike('name', searchPattern)
                .orWhereILike('code', searchPattern)
                .orWhereILike('inspectionLotNumber', searchPattern)
                .orWhereILike('acceptancePart', searchPattern)
                .orWhereILike('acceptanceContent', searchPattern)
            })
          }

          const items = await q

          rows = items.map((item) => {
            const id = item.id
            const name = item.name || ''
            const code = item.code || ''
            const inspectionLotNumber = item.inspectionLotNumber || ''
            const acceptancePart = item.acceptancePart || ''
            const acceptanceContent = item.acceptanceContent || ''
            const actualFinishDate = formatExportDate(item.actualFinishDate)
            const workVolumeVal =
              item.workVolume === null || item.workVolume === undefined
                ? ''
                : Number.parseFloat(item.workVolume)
            const unit = item.unit || ''
            const approveStatusVal = getStatusText(item.approveStatus)
            const bimIdsStr = getBimIdsString(item.BIM)

            return [
              id,
              name,
              code,
              inspectionLotNumber,
              acceptancePart,
              acceptanceContent,
              actualFinishDate,
              Number.isNaN(workVolumeVal) ? '' : workVolumeVal,
              unit,
              approveStatusVal,
              bimIdsStr
            ]
          })
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, '质量验收')

        const fileContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
        const safeProjectName = project.name.replace(/[\\/:*?"<>|]/g, '_')
        const encodedFileName = encodeURIComponent(`${safeProjectName}-质量验收.xlsx`)

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        res.setHeader(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodedFileName}`
        )
        return res.send(fileContent)
      } catch (e) {
        req.log.error(ensureError(e), 'Quality acceptance export error')
        return res.status(500).json({ error: getErrorMessage(e) })
      }
    }
  )

  // 3. 导入 Excel 接口 (普通用户 Session 鉴权)
  app.post(
    '/api/v1/projects/:projectId/quality-acceptance/forms/import-excel',
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

      const project = await getStream({ streamId: projectId })
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' })
      }

      let busboy: Busboy.Busboy
      try {
        busboy = createBusboy(req)
      } catch (err) {
        return res.status(400).json({ error: getErrorMessage(err) })
      }

      let isFinished = false
      let fileProcessed = false

      busboy.on('file', (name, file, info) => {
        if (fileProcessed) {
          file.resume()
          return
        }
        fileProcessed = true

        const chunks: Buffer[] = []
        file.on('data', (chunk) => {
          chunks.push(chunk)
        })

        file.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks)
            if (buffer.length === 0) {
              throw new Error('上传的 Excel 文件为空')
            }

            const workbook = XLSX.read(buffer, { type: 'buffer' })
            const firstSheetName = workbook.SheetNames[0]
            if (!firstSheetName) {
              throw new Error('Excel 中未找到工作表')
            }

            const sheet = workbook.Sheets[firstSheetName]

            // 构建项目下的构件唯一编码映射表，以便补全完整的 BIM
            const projectDb = await getProjectDbClient({ projectId })
            const bimMap = await buildBimNodesMap(projectDb, projectId)
            const importRows = parseImportRows(sheet, bimMap)

            const result = await importQualityAcceptanceFormsFactory({
              db,
              projectDb
            })({
              projectId,
              actorUserId: userId,
              items: importRows
            })

            if (result.createdCount > 0) {
              await recalculateProjectCostSummaryFactory({ db: projectDb })({
                projectId
              })
            }

            isFinished = true
            return res.status(200).json({
              success: true,
              createdCount: result.createdCount,
              failedCount: result.failedCount,
              failedRows:
                result.failedRows?.map((fr) => `第 ${fr.rowNumber} 行: ${fr.error}`) ||
                []
            })
          } catch (e) {
            req.log.error(ensureError(e), 'Quality acceptance import error')
            isFinished = true
            return res.status(400).json({ error: getErrorMessage(e) })
          }
        })
      })

      busboy.on('error', (err: unknown) => {
        if (!isFinished) {
          isFinished = true
          return res.status(400).json({ error: getErrorMessage(err) })
        }
      })

      busboy.on('finish', () => {
        if (!fileProcessed && !isFinished) {
          isFinished = true
          return res.status(400).json({ error: '没有上传文件' })
        }
      })

      req.pipe(busboy)
    }
  )

  // -------------------------------------------------------------
  // 月度验工调整：多副表 REST 接口与权限/聚合逻辑
  // -------------------------------------------------------------

  const checkEditableBeforeFlowEnd = async (
    projectDb: any,
    measurementId: string,
    userId: string
  ) => {
    const measurement = await projectDb('monthly_measurements')
      .where('id', measurementId)
      .first()
    if (!measurement) {
      throw new BadRequestError('月度验工不存在')
    }

    const isDraft = !measurement.approveStatus || measurement.approveStatus === 'START'
    if (isDraft) {
      return {
        measurement,
        pendingStep: null
      }
    }

    if (measurement.flowInstanceId) {
      const pendingStep = await db('approval_flow_instance_steps')
        .where('instanceId', measurement.flowInstanceId)
        .andWhere('status', 'PENDING')
        .orderBy('stepIndex', 'asc')
        .first()

      if (!pendingStep) {
        throw new BadRequestError('当前无可编辑的审批流节点')
      }

      if (pendingStep.approverIds && pendingStep.approverIds.length > 0) {
        if (!pendingStep.approverIds.includes(userId)) {
          throw new BadRequestError('您不是当前步骤的审批负责人')
        }
      }

      return {
        measurement,
        pendingStep
      }
    }

    throw new BadRequestError('流程已结束，数据无法修改')
  }

  const checkWritePermission = async (
    projectDb: any,
    measurementId: string,
    userId: string,
    requiredRole:
      | 'contractor'
      | 'supervision'
      | 'headquarters'
      | 'investment'
      | 'contract'
      | 'leader'
      | 'owner'
  ) => {
    const { measurement, pendingStep } = await checkEditableBeforeFlowEnd(
      projectDb,
      measurementId,
      userId
    )
    const isDraft = !measurement.approveStatus || measurement.approveStatus === 'START'
    if (isDraft) {
      if (requiredRole === 'contractor') {
        return true
      }
      throw new BadRequestError('草稿期仅允许施工单位填报数据')
    }

    if (pendingStep) {
      const stepName = (pendingStep.name || '').trim()
      const isStep = (names: string[]) => names.includes(stepName)
      if (requiredRole === 'contractor' && isStep(['施工单位'])) return true
      if (
        requiredRole === 'supervision' &&
        isStep(['施工监理经办人', '施工监理总监', '施工监理', '监理', '专业监理'])
      )
        return true
      if (
        requiredRole === 'headquarters' &&
        isStep(['现场指挥部经办人', '现场指挥', '现场指挥部', '指挥部'])
      )
        return true
      if (
        requiredRole === 'investment' &&
        isStep(['投资监理经办人', '投资监理总监', '投资监理'])
      )
        return true
      if (
        requiredRole === 'contract' &&
        isStep(['合约管理部经办人', '合约管理部负责人', '计划合同部', '合约部', '合约管理部'])
      )
        return true
      if (requiredRole === 'leader' && isStep(['分管领导'])) return true
      if (
        requiredRole === 'owner' &&
        isStep(['合约管理部负责人', '分管领导', '计划合同部', '合约部', '合约管理部'])
      )
        return true

      throw new BadRequestError(
        `当前审批步骤【${stepName}】不允许【${requiredRole}】角色修改数据`
      )
    }

    throw new BadRequestError('流程已结束，数据无法修改')
  }

  const checkWriteBeforeFlowEndPermission = async (
    projectDb: any,
    measurementId: string,
    userId: string
  ) => {
    await checkEditableBeforeFlowEnd(projectDb, measurementId, userId)
    return true
  }

  // 4. 获取月度验工列表
  app.get(
    '/api/v1/projects/:projectId/monthly-measurements',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const search = (req.query.search as string) || null
      const cursor = (req.query.cursor as string) || null
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20

      const projectDb = await getProjectDbClient({ projectId })
      const [data, totalCount] = await Promise.all([
        getMonthlyMeasurementsFactory({ db: projectDb })({
          projectId,
          search,
          cursor,
          limit
        }),
        countMonthlyMeasurementsFactory({ db: projectDb })({ projectId, search })
      ])

      const itemsWithDetails = await Promise.all(
        data.items.map(async (item) => {
          // 1. 获取创建人信息
          let creatorUser = null
          if (item.creator) {
            const u = await db('users')
              .where('id', item.creator)
              .select('id', 'name')
              .first()
            if (u) {
              creatorUser = { id: u.id, name: u.name }
            }
          }

          // 2. 计算验工总额 (非汇总行投资监理核定量的 price * investmentQty 之和)
          const [{ total }] = await projectDb('monthly_measurement_items')
            .where('measurementId', item.id)
            .andWhere('isSummaryRow', false)
            .select(
              projectDb.raw(
                'SUM(COALESCE("investmentQty", 0) * COALESCE("price", 0)) as total'
              )
            )
          const totalAmount = Number(total || 0)

          // 获取绑定信息
          const binding = await db('approval_flow_bindings')
            .where('subjectKey', `monthly_measurements:${item.id}`)
            .select('status', 'currentInstanceId')
            .first()

          let actualApproveStatus = item.approveStatus || 'START'
          let actualFlowInstanceId = item.flowInstanceId

          if (binding) {
            actualApproveStatus = binding.status
            actualFlowInstanceId = binding.currentInstanceId
          } else if (item.flowInstanceId) {
            const inst = await db('approval_flow_instances')
              .where('id', item.flowInstanceId)
              .select('status')
              .first()
            if (inst) {
              if (inst.status === 'APPROVED') {
                actualApproveStatus = 'APPROVED'
              } else if (inst.status === 'REJECTED') {
                actualApproveStatus = 'REJECTED'
              } else if (inst.status === 'CANCELED' || inst.status === 'CANCELLED') {
                actualApproveStatus = 'CANCELED'
              } else if (inst.status === 'RETURNED') {
                actualApproveStatus = 'RETURNED'
              } else {
                actualApproveStatus = 'PENDING'
              }
            }
          }

          // 3. 查询当前负责人
          let currentStepApprovers: string[] = []
          if (actualFlowInstanceId) {
            const pendingStep = await db('approval_flow_instance_steps')
              .where('instanceId', actualFlowInstanceId)
              .andWhere('status', 'PENDING')
              .orderBy('stepIndex', 'asc')
              .first()
            if (
              pendingStep &&
              pendingStep.approverIds &&
              pendingStep.approverIds.length > 0
            ) {
              const users = await db<{ name: string | null }>('users')
                .whereIn('id', pendingStep.approverIds)
                .select('name')
              currentStepApprovers = users
                .map((u) => u.name)
                .filter((name): name is string => Boolean(name))
            }
          }

          return {
            ...item,
            approveStatus: actualApproveStatus,
            flowInstanceId: actualFlowInstanceId,
            creator: creatorUser,
            totalAmount,
            currentStepApprovers
          }
        })
      )

      return res.status(200).json({
        items: itemsWithDetails,
        cursor: data.cursor,
        totalCount
      })
    }
  )

  // 5. 获取特定月度验工主表信息
  app.get(
    '/api/v1/projects/:projectId/monthly-measurements/:id',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })
      const measurement = await getMonthlyMeasurementByIdFactory({ db: projectDb })(id)
      if (!measurement || measurement.project_id !== projectId) {
        return res.status(404).json({ error: '月度验工不存在' })
      }

      // 查询审批绑定
      const binding = await db('approval_flow_bindings')
        .where('subjectKey', `monthly_measurements:${id}`)
        .select('status', 'currentInstanceId')
        .first()

      let actualApproveStatus = measurement.approveStatus || 'START'
      let actualFlowInstanceId = measurement.flowInstanceId

      if (binding) {
        actualApproveStatus = binding.status
        actualFlowInstanceId = binding.currentInstanceId
      } else if (measurement.flowInstanceId) {
        const inst = await db('approval_flow_instances')
          .where('id', measurement.flowInstanceId)
          .select('status')
          .first()
        if (inst) {
          if (inst.status === 'APPROVED') {
            actualApproveStatus = 'APPROVED'
          } else if (inst.status === 'REJECTED') {
            actualApproveStatus = 'REJECTED'
          } else if (inst.status === 'CANCELED' || inst.status === 'CANCELLED') {
            actualApproveStatus = 'CANCELED'
          } else if (inst.status === 'RETURNED') {
            actualApproveStatus = 'RETURNED'
          } else {
            actualApproveStatus = 'PENDING'
          }
        }
      }

      // 获取创建人姓名
      let creatorUser = null
      if (measurement.creator) {
        const u = await db('users')
          .where('id', measurement.creator)
          .select('id', 'name')
          .first()
        if (u) {
          creatorUser = { id: u.id, name: u.name }
        }
      }

      let flowInitiatorUser = null
      let currentStepName = ''
      let currentStepApprovers: string[] = []
      if (actualFlowInstanceId) {
        const flowInstance = await db('approval_flow_instances')
          .where('id', actualFlowInstanceId)
          .select('createdBy')
          .first()
        if (flowInstance?.createdBy) {
          const u = await db('users')
            .where('id', flowInstance.createdBy)
            .select('id', 'name')
            .first()
          if (u) {
            flowInitiatorUser = { id: u.id, name: u.name }
          }
        }

        const pendingStep = await db('approval_flow_instance_steps')
          .where('instanceId', actualFlowInstanceId)
          .andWhere('status', 'PENDING')
          .orderBy('stepIndex', 'asc')
          .first()
        if (pendingStep) {
          currentStepName = pendingStep.name || ''
          if (pendingStep.approverIds && pendingStep.approverIds.length > 0) {
            const users = await db<{ name: string | null }>('users')
              .whereIn('id', pendingStep.approverIds)
              .select('name')
            currentStepApprovers = users
              .map((u) => u.name)
              .filter((name): name is string => Boolean(name))
          }
        }
      }

      return res.status(200).json({
        ...measurement,
        approveStatus: actualApproveStatus,
        flowInstanceId: actualFlowInstanceId,
        creator: creatorUser,
        flowInitiator: flowInitiatorUser,
        currentStepName,
        currentStepApprovers
      })
    }
  )

  // 5.1 预览月度验工明细
  app.post(
    '/api/v1/projects/:projectId/monthly-measurements/preview',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const body = req.body || {}
      const baseDate = Number(body.baseDate)
      const startDate = body.startDate ? Number(body.startDate) : null
      const endDate = body.endDate ? Number(body.endDate) : null
      if (Number.isNaN(baseDate)) {
        return res.status(400).json({ error: '基准时间无效' })
      }

      const projectDb = await getProjectDbClient({ projectId })
      const buildPreview = buildMonthlyMeasurementPreviewFactory({
        getQualityAcceptanceFormsBeforeBaseDate:
          getQualityAcceptanceFormsBeforeBaseDateFactory({ db: projectDb }),
        getProjectBoqItems: getProjectBoqItemsFactory({ db: projectDb }),
        getQualityAcceptanceFormsByIds: getQualityAcceptanceFormsByIdsFactory({
          db: projectDb
        })
      })

      const preview = await buildPreview({
        projectId,
        baseDate,
        startDate,
        endDate,
        excludedAcceptanceIds: body.excludedAcceptanceIds || [],
        pinnedAcceptanceIds: body.pinnedAcceptanceIds || []
      })

      return res.status(200).json(preview)
    }
  )

  // 5.2 创建月度验工
  app.post(
    '/api/v1/projects/:projectId/monthly-measurements',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const userId = req.context.userId!
      const body = req.body || {}

      const roundName = body.roundName?.trim()
      const baseDate = Number(body.baseDate)
      const startDate = body.startDate ? Number(body.startDate) : null
      const endDate = body.endDate ? Number(body.endDate) : null
      const unit = body.unit?.trim()

      if (!baseDate || Number.isNaN(baseDate)) {
        return res.status(400).json({ error: '基准时间/年月无效' })
      }

      const projectDb = await getProjectDbClient({ projectId })

      // 自动生成编码 YG-YYYY-XXX
      const yearStr = dayjs(baseDate).format('YYYY')
      const prefix = `YG-${yearStr}-`
      const existingList = await projectDb('monthly_measurements')
        .where('project_id', projectId)
        .whereILike('code', `${prefix}%`)
        .select('code')

      let maxNum = 0
      for (const item of existingList) {
        const suffix = item.code.replace(prefix, '')
        const num = parseInt(suffix, 10)
        if (!Number.isNaN(num) && num > maxNum) {
          maxNum = num
        }
      }
      const nextNum = maxNum + 1
      const nextCode = `${prefix}${String(nextNum).padStart(3, '0')}`

      // 调用服务进行创建
      const buildPreview = buildMonthlyMeasurementPreviewFactory({
        getQualityAcceptanceFormsBeforeBaseDate:
          getQualityAcceptanceFormsBeforeBaseDateFactory({ db: projectDb }),
        getProjectBoqItems: getProjectBoqItemsFactory({ db: projectDb }),
        getQualityAcceptanceFormsByIds: getQualityAcceptanceFormsByIdsFactory({
          db: projectDb
        })
      })

      const createMonthlyMeasurement = createMonthlyMeasurementFromPreviewFactory({
        db: projectDb,
        buildPreview,
        createMeasurement: createMonthlyMeasurementFactory({ db: projectDb }),
        insertMeasurementItems: insertMonthlyMeasurementItemsFactory({ db: projectDb })
      })

      const created = await createMonthlyMeasurement({
        projectId,
        unit: unit || null,
        code: nextCode,
        baseDate,
        startDate,
        endDate,
        creator: userId,
        measuredItems: (body.measuredItems || []).map((item: any) => ({
          boqItemId: item.boqItemId,
          measuredQty: item.measuredQty ?? null,
          remark: item.remark ?? undefined
        })),
        excludedAcceptanceIds: body.excludedAcceptanceIds || []
      })

      // 存入新加字段 roundName, startDate, endDate, contractCode
      await projectDb('monthly_measurements')
        .where('id', created.measurement.id)
        .update({
          roundName: roundName || null,
          startDate: startDate ? String(startDate) : null,
          endDate: endDate ? String(endDate) : null,
          contractCode: ''
        })

      const prepaymentItemsSnapshot = await projectDb('prepayment_items')
        .where('projectId', projectId)
        .select('id', 'category', 'name')
        .orderBy('createdAt', 'desc')

      await upsertMonthlyPaymentDetailsFactory({ db: projectDb })(
        created.measurement.id,
        {
          extraPayItems: prepaymentItemsSnapshot.map((it: any) => ({
            prepaymentItemId: it.id,
            category: it.category,
            name: it.name,
            contractorPayAmt: 0,
            investmentPayAmt: 0,
            contractPayAmt: 0,
            leaderPayAmt: 0
          }))
        }
      )

      return res.status(200).json({
        ...created.measurement,
        roundName: roundName || null,
        startDate: startDate ? String(startDate) : null,
        endDate: endDate ? String(endDate) : null,
        contractCode: ''
      })
    }
  )

  // 5.3 修改月度验工
  app.put(
    '/api/v1/projects/:projectId/monthly-measurements/:id',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const body = req.body || {}

      const roundName = body.roundName?.trim()
      const baseDate = Number(body.baseDate)
      const startDate = body.startDate ? Number(body.startDate) : null
      const endDate = body.endDate ? Number(body.endDate) : null
      const unit = body.unit?.trim()

      if (!baseDate || Number.isNaN(baseDate)) {
        return res.status(400).json({ error: '基准时间/年月无效' })
      }

      const projectDb = await getProjectDbClient({ projectId })
      const existing = await getMonthlyMeasurementByIdFactory({ db: projectDb })(id)
      if (!existing || existing.project_id !== projectId) {
        return res.status(404).json({ error: '月度验工不存在' })
      }

      const binding = await db('approval_flow_bindings')
        .where('subjectKey', `monthly_measurements:${id}`)
        .select('status')
        .first()
      const currentStatus = binding ? binding.status : (existing.approveStatus || 'START')
      if (currentStatus !== 'START' && currentStatus !== 'RETURNED') {
        throw new BadRequestError('已送审，不可编辑修改')
      }

      const existingItems = await getMonthlyMeasurementItemsFactory({ db: projectDb })(
        id
      )
      const newBaseDate = Number(baseDate)
      const oldBaseDate = Number(existing.baseDate)
      const oldStartDate = existing.startDate ? Number(existing.startDate) : null
      const oldEndDate = existing.endDate ? Number(existing.endDate) : null
      const baseDateChanged = newBaseDate !== oldBaseDate
      const windowChanged = startDate !== oldStartDate || endDate !== oldEndDate

      const excludedIds = new Set(body.excludedAcceptanceIds || [])
      let selectedRows: any[]

      if (baseDateChanged || windowChanged) {
        const currentPinnedIds = Array.from(
          new Set(
            existingItems
              .flatMap((r) => r.sourceAcceptanceIds || [])
              .filter((id) => !excludedIds.has(id))
          )
        )
        const buildPreview = buildMonthlyMeasurementPreviewFactory({
          getQualityAcceptanceFormsBeforeBaseDate:
            getQualityAcceptanceFormsBeforeBaseDateFactory({ db: projectDb }),
          getProjectBoqItems: getProjectBoqItemsFactory({ db: projectDb }),
          getQualityAcceptanceFormsByIds: getQualityAcceptanceFormsByIdsFactory({
            db: projectDb
          })
        })
        const preview = await buildPreview({
          projectId,
          baseDate: newBaseDate,
          startDate,
          endDate,
          excludedAcceptanceIds: body.excludedAcceptanceIds || [],
          pinnedAcceptanceIds: currentPinnedIds
        })
        // 1. 获取所有的历史已通过的明细记录（投资监理审定量），用于重新计算 lastCumulativeQty, yearlyCumulativeQty, lastCumulativePay
        const currentYear = dayjs(newBaseDate).year()
        const approvedItems = await projectDb('monthly_measurement_items')
          .join(
            'monthly_measurements',
            'monthly_measurement_items.measurementId',
            'monthly_measurements.id'
          )
          .where('monthly_measurements.project_id', projectId)
          .andWhere('monthly_measurements.approveStatus', 'APPROVED')
          .andWhere('monthly_measurements.id', '!=', id) // 排除自身
          .select(
            'monthly_measurement_items.boqItemId',
            'monthly_measurement_items.investmentQty',
            'monthly_measurement_items.leaderPayAmt',
            'monthly_measurements.baseDate'
          )

        const historyMap = new Map<string, number>()
        const yearlyMap = new Map<string, number>()
        const payMap = new Map<string, number>()

        for (const row of approvedItems) {
          const qty = Number(row.investmentQty || 0)
          const pay = Number(row.leaderPayAmt || 0) // 只加分管领导的支付额
          const rowYear = dayjs(Number(row.baseDate)).year()

          historyMap.set(row.boqItemId, (historyMap.get(row.boqItemId) || 0) + qty)
          payMap.set(row.boqItemId, (payMap.get(row.boqItemId) || 0) + pay)
          if (rowYear === currentYear) {
            yearlyMap.set(row.boqItemId, (yearlyMap.get(row.boqItemId) || 0) + qty)
          }
        }

        const customValues = new Map(
          (body.measuredItems || []).map((item: any) => [item.boqItemId, item])
        )
        const nowTs = new Date()
        selectedRows = preview.items.map((row: any) => {
          const custom = customValues.get(row.boqItemId) as any
          const measuredQty = row.isSummaryRow
            ? 0
            : custom?.measuredQty !== null && custom?.measuredQty !== undefined
            ? Number(custom.measuredQty)
            : row.measuredQtyDefault
          const finalQty = Number.isNaN(measuredQty) ? row.measuredQtyDefault : measuredQty
          return {
            id: cryptoRandomString({ length: 10 }),
            measurementId: id,
            boqItemId: row.boqItemId,
            boqCode: row.boqCode,
            boqName: row.boqName,
            boqParentId: row.boqParentId,
            boqDepth: row.boqDepth,
            isSummaryRow: row.isSummaryRow,
            sortIndex: row.sortIndex,
            uom: row.uom,
            price: row.price,
            pendingTotalQty: row.pendingTotalQty,
            approvedCumulativeQty: row.approvedCumulativeQty,
            measuredQty: finalQty,
            contractorQty: finalQty,
            supervisionQty: finalQty,
            headquartersQty: finalQty,
            investmentQty: finalQty,
            contractorPayAmt: 0,
            investmentPayAmt: 0,
            contractPayAmt: 0,
            leaderPayAmt: 0,
            lastCumulativeQty: historyMap.get(row.boqItemId) || 0,
            yearlyCumulativeQty: yearlyMap.get(row.boqItemId) || 0,
            lastCumulativePay: payMap.get(row.boqItemId) || 0,
            remark: row.isSummaryRow ? null : custom?.remark?.trim() || null,
            sourceAcceptanceIds: row.sourceAcceptanceIds,
            createdAt: nowTs,
            updatedAt: nowTs
          }
        })
      } else {
        selectedRows = existingItems.map((item: any) => {
          if (item.isSummaryRow) return item
          const nextIds = (item.sourceAcceptanceIds || []).filter(
            (aid: any) => !excludedIds.has(aid)
          )
          return { ...item, sourceAcceptanceIds: nextIds }
        })
      }

      if (!selectedRows.length) {
        throw new BadRequestError('未找到可生成验工明细的清单项')
      }

      const customValues2 = new Map(
        (body.measuredItems || []).map((item: any) => [item.boqItemId, item])
      )

      // 如果年月没有变化，需要获取最新历史通过，以防在此期间其它月度单据审批通过了
      const currentYear = dayjs(newBaseDate).year()
      const approvedItems = await projectDb('monthly_measurement_items')
        .join(
          'monthly_measurements',
          'monthly_measurement_items.measurementId',
          'monthly_measurements.id'
        )
        .where('monthly_measurements.project_id', projectId)
        .andWhere('monthly_measurements.approveStatus', 'APPROVED')
        .andWhere('monthly_measurements.id', '!=', id)
        .select(
          'monthly_measurement_items.boqItemId',
          'monthly_measurement_items.investmentQty',
          'monthly_measurement_items.leaderPayAmt',
          'monthly_measurements.baseDate'
        )

      const historyMap = new Map<string, number>()
      const yearlyMap = new Map<string, number>()
      const payMap = new Map<string, number>()

      for (const row of approvedItems) {
        const qty = Number(row.investmentQty || 0)
        const pay = Number(row.leaderPayAmt || 0)
        const rowYear = dayjs(Number(row.baseDate)).year()

        historyMap.set(row.boqItemId, (historyMap.get(row.boqItemId) || 0) + qty)
        payMap.set(row.boqItemId, (payMap.get(row.boqItemId) || 0) + pay)
        if (rowYear === currentYear) {
          yearlyMap.set(row.boqItemId, (yearlyMap.get(row.boqItemId) || 0) + qty)
        }
      }

      const now = new Date()
      const nextItems =
        baseDateChanged || windowChanged
          ? selectedRows
          : selectedRows.map((row: any) => {
              const custom = customValues2.get(row.boqItemId) as any
              const measuredQty = row.isSummaryRow ? 0 : Number(custom?.measuredQty)
              return {
                id: cryptoRandomString({ length: 10 }),
                measurementId: id,
                boqItemId: row.boqItemId,
                boqCode: row.boqCode,
                boqName: row.boqName,
                boqParentId: row.boqParentId,
                boqDepth: row.boqDepth,
                isSummaryRow: row.isSummaryRow,
                sortIndex: row.sortIndex,
                uom: row.uom,
                price: row.price,
                pendingTotalQty: row.pendingTotalQty,
                approvedCumulativeQty: row.approvedCumulativeQty,
                measuredQty: Number.isNaN(measuredQty)
                  ? row.measuredQty ?? 0
                  : measuredQty,
                contractorQty: row.contractorQty ?? 0,
                supervisionQty: row.supervisionQty ?? 0,
                headquartersQty: row.headquartersQty ?? 0,
                investmentQty: row.investmentQty ?? 0,
                contractorPayAmt: row.contractorPayAmt ?? 0,
                investmentPayAmt: row.investmentPayAmt ?? 0,
                contractPayAmt: row.contractPayAmt ?? 0,
                leaderPayAmt: row.leaderPayAmt ?? 0,
                lastCumulativeQty: historyMap.get(row.boqItemId) || 0,
                yearlyCumulativeQty: yearlyMap.get(row.boqItemId) || 0,
                lastCumulativePay: payMap.get(row.boqItemId) || 0,
                remark: row.isSummaryRow ? null : custom?.remark?.trim() || row.remark || null,
                sourceAcceptanceIds: row.sourceAcceptanceIds,
                createdAt: now,
                updatedAt: now
              }
            })

      await projectDb.transaction(async (trx) => {
        await updateMonthlyMeasurementFactory({ db: trx })(id, {
          unit: unit || null,
          baseDate: String(baseDate),
          roundName: roundName || null,
          startDate: startDate ? String(startDate) : null,
          endDate: endDate ? String(endDate) : null
        })
        await deleteMonthlyMeasurementItemsByMeasurementIdFactory({ db: trx })(id)
        await insertMonthlyMeasurementItemsFactory({ db: trx })(nextItems)
        if (body.excludedAcceptanceIds?.length) {
          await updateQualityAcceptanceApproveStatusByIdsFactory({ db: trx })({
            ids: body.excludedAcceptanceIds,
            approveStatus: null
          })
        }
      })

      return res.status(200).json({ success: true })
    }
  )

  // 6. 删除月度验工
  app.delete(
    '/api/v1/projects/:projectId/monthly-measurements/:id',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })
      const measurement = await getMonthlyMeasurementByIdFactory({ db: projectDb })(id)
      if (!measurement) {
        return res.status(404).json({ error: '月度验工不存在' })
      }
      const binding = await db('approval_flow_bindings')
        .where('subjectKey', `monthly_measurements:${id}`)
        .select('status')
        .first()
      const currentStatus = binding ? binding.status : (measurement.approveStatus || 'START')
      if (currentStatus !== 'START' && currentStatus !== 'RETURNED') {
        throw new BadRequestError('送审后不可删除')
      }

      await projectDb.transaction(async (trx) => {
        await deleteMonthlyMeasurementByIdFactory({ db: trx })(id)
      })

      return res.status(200).json({ success: true })
    }
  )

  // 7. GET/PATCH Tab 1 月度验工审核意见与附件
  app.get(
    '/api/v1/projects/:projectId/monthly-measurements/:id/acceptance',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })
      const details = await getMonthlyMeasurementDetailsFactory({ db: projectDb })(id)
      
      let acceptanceAttachments: Array<{ blobId: string; name: string }> = []
      if (details && Array.isArray(details.acceptanceAttachments) && details.acceptanceAttachments.length > 0) {
        const blobIds = details.acceptanceAttachments
        const blobs = await projectDb('blob_storage')
          .where('streamId', projectId)
          .whereIn('id', blobIds)
          .select('id', 'fileName')
        acceptanceAttachments = blobIds.map((bid: string) => {
          const b = blobs.find((x: any) => x.id === bid)
          return { blobId: bid, name: b ? b.fileName : bid }
        })
      }

      return res.status(200).json(
        details
          ? { ...details, acceptanceAttachments }
          : {
              measurementId: id,
              acceptanceAttachments: [],
              supervisionOpinion: '',
              supervisionAuditor: '',
              headquartersOpinion: '',
              headquartersAuditor: '',
              investmentOpinion: '',
              investmentAuditor: '',
              ownerOpinion: '',
              ownerAuditor: ''
            }
      )
    }
  )

  app.patch(
    '/api/v1/projects/:projectId/monthly-measurements/:id/acceptance',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const userId = req.context.userId!
      const projectDb = await getProjectDbClient({ projectId })
      const body = req.body || {}

      const fieldsToSave: any = {}
      if ('acceptanceAttachments' in body) {
        // 附件在草稿期或流程中，允许对应可写人员修改更新
        fieldsToSave.acceptanceAttachments = (body.acceptanceAttachments || []).map((x: any) =>
          typeof x === 'string' ? x : x.blobId
        )
      }

      const existing = await getMonthlyMeasurementDetailsFactory({ db: projectDb })(id)
      const roles = ['supervision', 'headquarters', 'investment', 'owner'] as const
      const changedRoles = new Set<string>()

      for (const role of roles) {
        const opinionKey = `${role}Opinion`
        const auditorKey = `${role}Auditor`

        const nextOpinion = body[opinionKey] !== undefined ? String(body[opinionKey] || '') : undefined
        const prevOpinion = existing ? String((existing as any)[opinionKey] || '') : ''

        const nextAuditor = body[auditorKey] !== undefined ? String(body[auditorKey] || '') : undefined
        const prevAuditor = existing ? String((existing as any)[auditorKey] || '') : ''

        const isOpinionChanged = nextOpinion !== undefined && nextOpinion !== prevOpinion
        const isAuditorChanged = nextAuditor !== undefined && nextAuditor !== prevAuditor

        if (isOpinionChanged || isAuditorChanged) {
          changedRoles.add(role)
        }
      }

      if (changedRoles.size > 1) {
        throw new BadRequestError(
          '本次保存包含多角色验收意见变更，请分别在对应节点填写并保存'
        )
      }

      const requiredRole = Array.from(changedRoles)[0]
      if (requiredRole) {
        await checkWritePermission(projectDb, id, userId, requiredRole as any)
      }

      for (const role of roles) {
        const opinionKey = `${role}Opinion`
        const auditorKey = `${role}Auditor`
        const dateKey = `${role}Date`

        if (changedRoles.has(role)) {
          if (body[opinionKey] !== undefined) fieldsToSave[opinionKey] = body[opinionKey]
          if (body[auditorKey] !== undefined) fieldsToSave[auditorKey] = body[auditorKey]
          fieldsToSave[dateKey] = new Date()
        }
      }

      const updated = await upsertMonthlyMeasurementDetailsFactory({ db: projectDb })(
        id,
        fieldsToSave
      )

      let acceptanceAttachments: Array<{ blobId: string; name: string }> = []
      if (updated && Array.isArray(updated.acceptanceAttachments) && updated.acceptanceAttachments.length > 0) {
        const blobIds = updated.acceptanceAttachments
        const blobs = await projectDb('blob_storage')
          .where('streamId', projectId)
          .whereIn('id', blobIds)
          .select('id', 'fileName')
        acceptanceAttachments = blobIds.map((bid: string) => {
          const b = blobs.find((x: any) => x.id === bid)
          return { blobId: bid, name: b ? b.fileName : bid }
        })
      }

      return res.status(200).json(updated ? { ...updated, acceptanceAttachments } : null)
    }
  )

  // 8. GET/PATCH Tab 2 中间支付单
  app.get(
    '/api/v1/projects/:projectId/monthly-measurements/:id/payment-details',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })
      const details = await getMonthlyPaymentDetailsFactory({ db: projectDb })(id)

      let paymentAttachments: Array<{ blobId: string; name: string }> = []
      if (details && Array.isArray(details.paymentAttachments) && details.paymentAttachments.length > 0) {
        const blobIds = details.paymentAttachments
        const blobs = await projectDb('blob_storage')
          .where('streamId', projectId)
          .whereIn('id', blobIds)
          .select('id', 'fileName')
        paymentAttachments = blobIds.map((bid: string) => {
          const b = blobs.find((x: any) => x.id === bid)
          return { blobId: bid, name: b ? b.fileName : bid }
        })
      }

      return res.status(200).json(
        details
          ? {
              ...details,
              paymentAttachments,
              extraPayItems: Array.isArray(details.extraPayItems)
                ? details.extraPayItems
                : []
            }
          : {
              measurementId: id,
              paymentAttachments: [],
              extraPayItems: [],
              interimPayProgress: 0,
              migrantWorkerSalary: 0,
              interimRemark: '',
              contractorSign: '',
              supervisionSign: '',
              preparerSign: '',
              interimSignDate: null
            }
      )
    }
  )

  app.patch(
    '/api/v1/projects/:projectId/monthly-measurements/:id/payment-details',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const userId = req.context.userId!
      const projectDb = await getProjectDbClient({ projectId })
      const body = req.body || {}

      const fieldsToSave: any = {}
      if ('paymentAttachments' in body) {
        fieldsToSave.paymentAttachments = (body.paymentAttachments || []).map((x: any) =>
          typeof x === 'string' ? x : x.blobId
        )
      }
      if ('interimRemark' in body) fieldsToSave.interimRemark = body.interimRemark

      if ('extraPayItems' in body && Array.isArray(body.extraPayItems)) {
        const patches = body.extraPayItems as any[]
        const existing = await getMonthlyPaymentDetailsFactory({ db: projectDb })(id)
        const existingItems = Array.isArray(existing?.extraPayItems)
          ? existing!.extraPayItems
          : []

        const existingMap = new Map<string, any>(
          existingItems.map((it: any) => [it.prepaymentItemId, it])
        )

        const keys = [
          { key: 'contractorPayAmt', role: 'contractor' as const },
          { key: 'investmentPayAmt', role: 'investment' as const },
          { key: 'contractPayAmt', role: 'contract' as const },
          { key: 'leaderPayAmt', role: 'leader' as const }
        ]
        const changedRoles = new Set<string>()
        for (const patch of patches) {
          const idKey = patch?.prepaymentItemId
          if (typeof idKey !== 'string' || !idKey.trim().length) continue
          if (!existingMap.has(idKey)) continue
          const prev = existingMap.get(idKey) || {}
          for (const { key, role } of keys) {
            if (!(key in patch)) continue
            const nextVal = Number(patch[key] || 0)
            const prevVal = Number(prev[key] || 0)
            if (nextVal !== prevVal) changedRoles.add(role)
          }
        }

        if (changedRoles.size > 1) {
          throw new BadRequestError(
            '本次保存包含多角色支付字段变更，请分别在对应节点填写并保存'
          )
        }
        const requiredRole = Array.from(changedRoles)[0]
        if (requiredRole) {
          await checkWritePermission(projectDb, id, userId, requiredRole as any)
        }

        const updatedMap = new Map<string, any>(existingMap)
        for (const patch of patches) {
          const itemId = patch?.prepaymentItemId
          if (typeof itemId !== 'string' || !itemId.trim().length) continue
          if (!updatedMap.has(itemId)) continue
          const prev = updatedMap.get(itemId) || { prepaymentItemId: itemId }
          const next: any = {
            ...prev,
            prepaymentItemId: itemId,
            category: prev.category || '',
            name: prev.name || ''
          }
          for (const { key } of keys) {
            if (key in patch) next[key] = Number(patch[key] || 0)
          }
          updatedMap.set(itemId, next)
        }

        fieldsToSave.extraPayItems = Array.from(updatedMap.values())
      }

      // 承包人签字在未送审时由施工单位填写
      if ('contractorSign' in body) {
        await checkWritePermission(projectDb, id, userId, 'contractor')
        fieldsToSave.contractorSign = body.contractorSign
      }

      // 监理审定在监理步骤填写
      if ('supervisionSign' in body) {
        await checkWritePermission(projectDb, id, userId, 'supervision')
        fieldsToSave.supervisionSign = body.supervisionSign
      }

      // 两个金额字段在流程结束前均可填写，签字仍按投资监理节点控制
      const amountFields = ['interimPayProgress', 'migrantWorkerSalary']
      let hasAmountField = false
      for (const field of amountFields) {
        if (field in body) {
          hasAmountField = true
          fieldsToSave[field] = body[field]
        }
      }
      if (hasAmountField) {
        await checkWriteBeforeFlowEndPermission(projectDb, id, userId)
        fieldsToSave.interimSignDate = new Date()
      }

      if ('preparerSign' in body) {
        await checkWritePermission(projectDb, id, userId, 'investment')
        fieldsToSave.preparerSign = body.preparerSign
        fieldsToSave.interimSignDate = new Date()
      }

      const updated = await upsertMonthlyPaymentDetailsFactory({ db: projectDb })(
        id,
        fieldsToSave
      )

      let paymentAttachments: Array<{ blobId: string; name: string }> = []
      if (updated && Array.isArray(updated.paymentAttachments) && updated.paymentAttachments.length > 0) {
        const blobIds = updated.paymentAttachments
        const blobs = await projectDb('blob_storage')
          .where('streamId', projectId)
          .whereIn('id', blobIds)
          .select('id', 'fileName')
        paymentAttachments = blobIds.map((bid: string) => {
          const b = blobs.find((x: any) => x.id === bid)
          return { blobId: bid, name: b ? b.fileName : bid }
        })
      }

      return res.status(200).json(
        updated
          ? {
              ...updated,
              paymentAttachments,
              extraPayItems: Array.isArray(updated.extraPayItems)
                ? updated.extraPayItems
                : []
            }
          : null
      )
    }
  )

  // 9. GET/PATCH Tab 3 费用支付申请单
  app.get(
    '/api/v1/projects/:projectId/monthly-measurements/:id/payment-requests',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })
      const details = await getMonthlyPaymentRequestsFactory({ db: projectDb })(id)

      // 自动计算合同金额与累计已付款
      const measurement = await getMonthlyMeasurementByIdFactory({ db: projectDb })(id)
      let contractAmount = 0
      let lastCumulativePayment = 0

      if (measurement) {
        const summary = await getOrRecalculateProjectCostSummaryFactory({
          db: projectDb
        })({
          projectId
        })
        contractAmount = Number(summary.totalContractAmount || 0)

        // 历史已付款：所有历史已审批通过的月度支付单的进度款之和
        const approvedPayments = await projectDb('monthly_payment_details')
          .join(
            'monthly_measurements',
            'monthly_payment_details.measurementId',
            'monthly_measurements.id'
          )
          .where('monthly_measurements.project_id', projectId)
          .andWhere('monthly_measurements.approveStatus', 'APPROVED')
          .andWhere('monthly_measurements.id', '!=', id)
          .select('monthly_payment_details.interimPayProgress')

        lastCumulativePayment = approvedPayments.reduce(
          (sum, p) => sum + Number(p.interimPayProgress || 0) * 10000,
          0
        ) // 万元折合元
      }

      let requestAttachments: Array<{ blobId: string; name: string }> = []
      if (details && Array.isArray(details.requestAttachments) && details.requestAttachments.length > 0) {
        const blobIds = details.requestAttachments
        const blobs = await projectDb('blob_storage')
          .where('streamId', projectId)
          .whereIn('id', blobIds)
          .select('id', 'fileName')
        requestAttachments = blobIds.map((bid: string) => {
          const b = blobs.find((x: any) => x.id === bid)
          return { blobId: bid, name: b ? b.fileName : bid }
        })
      }

      const calculatedAmts = await calculatePaymentRequestAmounts(projectDb, id)

      return res.status(200).json(
        details
          ? {
              ...details,
              requestAttachments,
              ...calculatedAmts
            }
          : {
              measurementId: id,
              requestAttachments: [],
              lastCumulativePayment,
              contractAmount,
              ...calculatedAmts,
              headquartersPayAmt: 0,
              investmentPayAmt: 0,
              reqContractorOpinion: '',
              reqContractorAuditor: '',
              reqSupervisionOpinion: '',
              reqSupervisionAuditor: '',
              reqHeadquartersOpinion: '',
              reqHeadquartersAuditor: '',
              reqInvestmentOpinion: '',
              reqInvestmentAuditor: '',
              reqContractOpinion: '',
              reqContractAuditor: '',
              reqLeaderOpinion: '',
              reqLeaderAuditor: ''
            }
      )
    }
  )

  app.patch(
    '/api/v1/projects/:projectId/monthly-measurements/:id/payment-requests',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const userId = req.context.userId!
      const projectDb = await getProjectDbClient({ projectId })
      const body = req.body || {}

      const existing = await getMonthlyPaymentRequestsFactory({ db: projectDb })(id)

      const fieldsToSave: any = {}
      if ('requestAttachments' in body) {
        fieldsToSave.requestAttachments = (body.requestAttachments || []).map((x: any) =>
          typeof x === 'string' ? x : x.blobId
        )
      }

      const roles = [
        'contractor',
        'supervision',
        'headquarters',
        'investment',
        'contract',
        'leader'
      ] as const

      const changedRoles = new Set<'contractor' | 'supervision' | 'headquarters' | 'investment' | 'contract' | 'leader'>()
      for (const role of roles) {
        const opinionKey = `req${role.charAt(0).toUpperCase() + role.slice(1)}Opinion`

        let hasChange = false
        if (opinionKey in body) {
          const bodyVal = (body[opinionKey] || '').trim()
          const dbVal = ((existing as any)?.[opinionKey] || '').trim()
          if (bodyVal !== dbVal) {
            hasChange = true
          }
        }

        if (role === 'headquarters' || role === 'investment') {
          const payAmtKey = `${role}PayAmt`
          if (payAmtKey in body) {
            const bodyAmt = Number(body[payAmtKey] || 0)
            const dbAmt = Number((existing as any)?.[payAmtKey] || 0)
            if (bodyAmt !== dbAmt) {
              hasChange = true
            }
          }
        }

        if (hasChange) {
          changedRoles.add(role)
        }
      }

      if (changedRoles.size > 0) {
        let hasPermission = false
        let firstError: any = null

        for (const role of changedRoles) {
          try {
            await checkWritePermission(projectDb, id, userId, role as any)
            hasPermission = true
          } catch (err) {
            if (!firstError) {
              firstError = err
            }
          }
        }

        if (!hasPermission) {
          throw firstError || new BadRequestError('没有权限修改数据')
        }

        for (const role of changedRoles) {
          const opinionKey = `req${role.charAt(0).toUpperCase() + role.slice(1)}Opinion`
          const dateKey = `req${role.charAt(0).toUpperCase() + role.slice(1)}Date`

          if (opinionKey in body) fieldsToSave[opinionKey] = body[opinionKey]
          fieldsToSave[dateKey] = new Date()

          if (role === 'headquarters' || role === 'investment') {
            const payAmtKey = `${role}PayAmt`
            if (payAmtKey in body) {
              fieldsToSave[payAmtKey] = Number(body[payAmtKey] || 0)
            }
          }
        }
      }

      const calculatedAmts = await calculatePaymentRequestAmounts(projectDb, id)
      fieldsToSave.contractorPayAmt = calculatedAmts.contractorPayAmt
      fieldsToSave.supervisionPayAmt = calculatedAmts.supervisionPayAmt
      fieldsToSave.contractPayAmt = calculatedAmts.contractPayAmt
      fieldsToSave.leaderPayAmt = calculatedAmts.leaderPayAmt

      const updated = await upsertMonthlyPaymentRequestsFactory({ db: projectDb })(
        id,
        fieldsToSave
      )

      let requestAttachments: Array<{ blobId: string; name: string }> = []
      if (updated && Array.isArray(updated.requestAttachments) && updated.requestAttachments.length > 0) {
        const blobIds = updated.requestAttachments
        const blobs = await projectDb('blob_storage')
          .where('streamId', projectId)
          .whereIn('id', blobIds)
          .select('id', 'fileName')
        requestAttachments = blobIds.map((bid: string) => {
          const b = blobs.find((x: any) => x.id === bid)
          return { blobId: bid, name: b ? b.fileName : bid }
        })
      }

      return res.status(200).json(
        updated
          ? {
              ...updated,
              requestAttachments,
              ...calculatedAmts
            }
          : null
      )
    }
  )

  // 10. GET/PATCH 子清单树形明细填报
  app.get(
    '/api/v1/projects/:projectId/monthly-measurements/:id/detail-items',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })

      const [measurement, items] = await Promise.all([
        getMonthlyMeasurementByIdFactory({ db: projectDb })(id),
        getMonthlyMeasurementItemsFactory({ db: projectDb })(id)
      ])
      if (!measurement) {
        return res.status(404).json({ error: '月度验工不存在' })
      }

      const currentYear = dayjs(Number(measurement.baseDate)).year()
      const measurementStartDate = measurement.startDate
        ? Number(measurement.startDate)
        : null
      const measurementEndDate = measurement.endDate
        ? Number(measurement.endDate)
        : null

      const livePendingMap = new Map<
        string,
        { measuredQtyDefault: number; sourceAcceptanceIds: string[] }
      >()
      if (measurementStartDate || measurementEndDate) {
        const pendingForms = await getQualityAcceptanceFormsBeforeBaseDateFactory({
          db: projectDb
        })({
          projectId,
          baseDate: Number(measurement.baseDate),
          startDate: measurementStartDate,
          endDate: measurementEndDate
        })
        const boqItemIds = new Set(items.map((item) => item.boqItemId))
        const boqIdByCode = new Map(
          items
            .map((item) => [item.boqCode?.trim(), item.boqItemId] as const)
            .filter((entry): entry is [string, string] => Boolean(entry[0]))
        )
        for (const form of pendingForms) {
          const resolvedBoqItemId =
            form.boqItemId && boqItemIds.has(form.boqItemId)
              ? form.boqItemId
              : boqIdByCode.get(form.code?.trim() || '')
          if (!resolvedBoqItemId) continue
          const current = livePendingMap.get(resolvedBoqItemId) || {
            measuredQtyDefault: 0,
            sourceAcceptanceIds: []
          }
          current.measuredQtyDefault += Number(form.workVolume || 0)
          current.sourceAcceptanceIds.push(form.id)
          livePendingMap.set(resolvedBoqItemId, current)
        }
      }

      // 获取 boq_items 上配置的合价 amount
      const boqItems = await projectDb('boq_items')
        .where('projectId', projectId)
        .select('id', 'amount')
      const boqAmountMap = new Map<string, number | null>()
      for (const boq of boqItems) {
        boqAmountMap.set(boq.id, boq.amount === null ? null : Number(boq.amount))
      }

      const payload = items.map((item) => ({
        ...item,
        measuredQtyDefault: item.isSummaryRow
          ? 0
          : livePendingMap.get(item.boqItemId)?.measuredQtyDefault || 0,
        sourceAcceptanceIds: item.isSummaryRow
          ? item.sourceAcceptanceIds
          : livePendingMap.get(item.boqItemId)?.sourceAcceptanceIds || [],
        lastCumulativeQty: item.lastCumulativeQty || 0,
        yearlyCumulativeQty: item.yearlyCumulativeQty || 0,
        boqAmount: boqAmountMap.get(item.boqItemId) ?? null
      }))

      return res.status(200).json(payload)
    }
  )

  app.patch(
    '/api/v1/projects/:projectId/monthly-measurements/:id/detail-items',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const userId = req.context.userId!
      const projectDb = await getProjectDbClient({ projectId })
      const items = req.body.items || []

      if (!items.length) {
        return res.status(400).json({ error: '修改项列表为空' })
      }

      // 根据要修改的字段，进行权限和流程节点校验
      const boqItemIds = items.map((it: any) => it.boqItemId).filter(Boolean)
      const existingItems = await projectDb('monthly_measurement_items')
        .where('measurementId', id)
        .whereIn('boqItemId', boqItemIds)

      const existingMap = new Map<string, any>(
        existingItems.map((it: any) => [it.boqItemId, it])
      )

      const fieldRoleMap = [
        { key: 'contractorQty', role: 'contractor' as const },
        { key: 'supervisionQty', role: 'supervision' as const },
        { key: 'headquartersQty', role: 'headquarters' as const },
        { key: 'investmentQty', role: 'investment' as const },
        { key: 'contractorPayAmt', role: 'contractor' as const },
        { key: 'investmentPayAmt', role: 'investment' as const },
        { key: 'contractPayAmt', role: 'contract' as const },
        { key: 'leaderPayAmt', role: 'leader' as const }
      ]

      const changedRoles = new Set<string>()

      for (const item of items) {
        const boqItemId = item.boqItemId
        if (!boqItemId) continue
        const prev = existingMap.get(boqItemId) || {}

        for (const { key, role } of fieldRoleMap) {
          if (key in item) {
            const nextVal = Number(item[key] || 0)
            const prevVal = Number(prev[key] || 0)
            if (nextVal !== prevVal) {
              changedRoles.add(role)
            }
          }
        }
      }

      if (changedRoles.size > 0) {
        let hasPermission = false
        let firstError: any = null

        for (const role of changedRoles) {
          try {
            await checkWritePermission(projectDb, id, userId, role as any)
            hasPermission = true
            break
          } catch (err) {
            if (!firstError) {
              firstError = err
            }
          }
        }

        if (!hasPermission) {
          throw firstError || new BadRequestError('没有权限修改数据')
        }
      }

      await updateMonthlyMeasurementItemsBatchFactory({ db: projectDb })(id, items)

      // 更新主表更新时间
      await projectDb('monthly_measurements')
        .where('id', id)
        .update({ updatedAt: new Date() })

      return res.status(200).json({ success: true })
    }
  )

  // 11. 分类工程金额聚合查询接口
  app.get(
    '/api/v1/projects/:projectId/monthly-measurements/:id/aggregated-items',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const level = String(req.query.level || 'category')
        .trim()
        .toLowerCase()
      const projectDb = await getProjectDbClient({ projectId })

      const [measurement, currentItems] = await Promise.all([
        getMonthlyMeasurementByIdFactory({ db: projectDb })(id),
        getMonthlyMeasurementItemsFactory({ db: projectDb })(id)
      ])
      if (!measurement) {
        return res.status(404).json({ error: '月度验工不存在' })
      }

      // 获取当前年
      const currentYear = dayjs(Number(measurement.baseDate)).year()

      // 提前查询 boq_items 表以获取每个 item 的 amount 字段
      const boqItems = await projectDb('boq_items')
        .where('projectId', projectId)
        .select('id', 'type', 'parentId', 'amount')
      const boqTypeMap = new Map<string, string>()
      const boqAmountMap = new Map<string, number | null>()
      for (const boq of boqItems) {
        boqTypeMap.set(boq.id, boq.type)
        boqAmountMap.set(boq.id, boq.amount === null ? null : Number(boq.amount))
      }

      // 2. 自底向上金额聚合计算
      const itemMap = new Map<
        string,
        {
          record: any
          children: string[]
          contractAmount: number
          contractorAmount: number
          supervisionAmount: number
          headquartersAmount: number
          investmentAmount: number
          contractorPayAmt: number
          investmentPayAmt: number
          contractPayAmt: number
          leaderPayAmt: number
          historyCumulative: number
          historyYearly: number
          historyPay: number
        }
      >()

      for (const item of currentItems) {
        itemMap.set(item.boqItemId, {
          record: item,
          children: [],
          contractAmount: 0,
          contractorAmount: 0,
          supervisionAmount: 0,
          headquartersAmount: 0,
          investmentAmount: 0,
          contractorPayAmt: 0,
          investmentPayAmt: 0,
          contractPayAmt: 0,
          leaderPayAmt: 0,
          historyCumulative: 0,
          historyYearly: 0,
          historyPay: 0
        })
      }

      for (const item of currentItems) {
        if (item.boqParentId && itemMap.has(item.boqParentId)) {
          itemMap.get(item.boqParentId)!.children.push(item.boqItemId)
        }
      }

      const calculateAmounts = (boqItemId: string) => {
        const node = itemMap.get(boqItemId)
        if (!node) return

        if (!node.record.isSummaryRow) {
          const price = Number(node.record.price || 0)
          
          // 如果清单有合价，则直接从清单的合价获取，否则自行计算
          const boqAmt = boqAmountMap.get(node.record.boqItemId)
          if (boqAmt !== undefined && boqAmt !== null) {
            node.contractAmount = boqAmt
          } else {
            node.contractAmount = preciseMul(Number(node.record.pendingTotalQty || 0), price)
          }

          node.contractorAmount = preciseMul(Number(node.record.contractorQty || 0), price)
          node.supervisionAmount = preciseMul(Number(node.record.supervisionQty || 0), price)
          node.headquartersAmount = preciseMul(Number(node.record.headquartersQty || 0), price)
          node.investmentAmount = preciseMul(Number(node.record.investmentQty || 0), price)
          node.contractorPayAmt = Number(node.record.contractorPayAmt || 0)
          node.investmentPayAmt = Number(node.record.investmentPayAmt || 0)
          node.contractPayAmt = Number(node.record.contractPayAmt || 0)
          node.leaderPayAmt = Number(node.record.leaderPayAmt || 0)

          node.historyCumulative = preciseMul(Number(node.record.lastCumulativeQty || 0), price)
          node.historyYearly = preciseMul(Number(node.record.yearlyCumulativeQty || 0), price)
          node.historyPay = Number(node.record.lastCumulativePay || 0)
          return
        }

        for (const childId of node.children) {
          calculateAmounts(childId)
          const child = itemMap.get(childId)
          if (child) {
            node.contractAmount = preciseAdd(node.contractAmount, child.contractAmount)
            node.contractorAmount = preciseAdd(node.contractorAmount, child.contractorAmount)
            node.supervisionAmount = preciseAdd(node.supervisionAmount, child.supervisionAmount)
            node.headquartersAmount = preciseAdd(node.headquartersAmount, child.headquartersAmount)
            node.investmentAmount = preciseAdd(node.investmentAmount, child.investmentAmount)
            node.contractorPayAmt = preciseAdd(node.contractorPayAmt, child.contractorPayAmt)
            node.investmentPayAmt = preciseAdd(node.investmentPayAmt, child.investmentPayAmt)
            node.contractPayAmt = preciseAdd(node.contractPayAmt, child.contractPayAmt)
            node.leaderPayAmt = preciseAdd(node.leaderPayAmt, child.leaderPayAmt)
            node.historyCumulative = preciseAdd(node.historyCumulative, child.historyCumulative)
            node.historyYearly = preciseAdd(node.historyYearly, child.historyYearly)
            node.historyPay = preciseAdd(node.historyPay, child.historyPay)
          }
        }
      }

      for (const item of currentItems) {
        if (!item.boqParentId) {
          calculateAmounts(item.boqItemId)
        }
      }

      // 3. 根据不同页面需要，输出不同聚合层级
      const hasCategory = currentItems.some(
        (item) => boqTypeMap.get(item.boqItemId) === 'CATEGORY'
      )
      const aggregatedDisplayItems = currentItems.filter((item) => {
        if (level === 'section' && hasCategory) {
          const type = boqTypeMap.get(item.boqItemId)
          const parentType = item.boqParentId ? boqTypeMap.get(item.boqParentId) : null
          return type === 'SECTION' && parentType === 'CATEGORY'
        }
        if (hasCategory) {
          return boqTypeMap.get(item.boqItemId) === 'CATEGORY'
        }
        return !item.boqParentId
      })

      const result = aggregatedDisplayItems.map((item) => {
        const sums = itemMap.get(item.boqItemId)!
        const cumulativeAmount = preciseAdd(sums.historyCumulative, sums.investmentAmount)
        const yearlyAmount = preciseAdd(sums.historyYearly, sums.investmentAmount)
        const cumulativeRate =
          sums.contractAmount > 0
            ? Math.round((cumulativeAmount / sums.contractAmount) * 10000) / 100
            : 0

        const groupBoqItemId =
          level === 'section' && hasCategory ? item.boqParentId || null : null
        const groupRecord = groupBoqItemId ? itemMap.get(groupBoqItemId)?.record : null

        return {
          boqItemId: item.boqItemId,
          boqCode: item.boqCode,
          boqName: item.boqName,
          boqParentId: item.boqParentId,
          boqDepth: item.boqDepth,
          isSummaryRow: item.isSummaryRow,
          boqType: boqTypeMap.get(item.boqItemId) || null,
          groupBoqItemId,
          groupBoqCode: groupRecord?.boqCode || null,
          groupBoqName: groupRecord?.boqName || null,
          contractAmount: sums.contractAmount,
          contractorAmount: sums.contractorAmount,
          supervisionAmount: sums.supervisionAmount,
          headquartersAmount: sums.headquartersAmount,
          investmentAmount: sums.investmentAmount,
          contractorPayAmt: sums.contractorPayAmt,
          investmentPayAmt: sums.investmentPayAmt,
          contractPayAmt: sums.contractPayAmt,
          leaderPayAmt: sums.leaderPayAmt,
          cumulativeAmount,
          yearlyAmount,
          cumulativeRate,
          lastCumulativePay: sums.historyPay,
          remark: item.remark
        }
      })

      return res.status(200).json(result)
    }
  )

  // 12. 送审接口，二次确认后触发，启动流程实例
  app.post(
    '/api/v1/projects/:projectId/monthly-measurements/:id/submit',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const userId = req.context.userId
      if (!userId) {
        throw new UnauthorizedError('User not authenticated.')
      }

      const projectDb = await getProjectDbClient({ projectId })
      const existing = await getMonthlyMeasurementByIdFactory({ db: projectDb })(id)
      if (!existing) {
        return res.status(404).json({ error: '月度验工不存在' })
      }

      // 校验关联的审批绑定
      const binding = await db('approval_flow_bindings')
        .where('subjectKey', `monthly_measurements:${id}`)
        .select('id', 'status')
        .first()

      const currentStatus = binding ? binding.status : (existing.approveStatus || 'START')
      if (currentStatus === 'IN_REVIEW' || currentStatus === 'APPROVED') {
        throw new BadRequestError('已送审，无需重复送审')
      }

      if (currentStatus === 'RETURNED' && binding) {
        const resubmitApprovalBinding = resubmitApprovalBindingFactory({ db })
        const result = await resubmitApprovalBinding({
          bindingId: binding.id,
          formData: {
            formTable: 'monthly_measurements',
            formId: id,
            projectId
          },
          comment: (req.body.remark as string)?.trim() || '重新送审',
          actorUserId: userId
        })

        // 更新主表状态
        await projectDb('monthly_measurements').where('id', id).update({
          flowInstanceId: result.currentInstanceId,
          approveStatus: 'PENDING',
          updatedAt: new Date()
        })

        return res.status(200).json({ success: true, instanceId: result.currentInstanceId })
      }

      const getActiveByCategory = getActiveApprovalFlowByCategoryFactory({ db })
      const activeDef = await getActiveByCategory({
        projectId,
        category: 'MONTHLY_INSPECTION'
      })
      if (!activeDef) {
        throw new BadRequestError(
          '未找到已启用的月度验工审批流程，请先到项目设置中启用'
        )
      }

      const requestedTemplateId =
        typeof req.body?.templateId === 'string' ? req.body.templateId.trim() : ''
      if (requestedTemplateId && requestedTemplateId !== activeDef.templateId) {
        throw new BadRequestError(
          '当前启用的月度验工审批流程版本已变更，请重新发起送审'
        )
      }

      const templateId = requestedTemplateId || activeDef.templateId

      const submitApprovalBinding = submitApprovalBindingFactory({ db })
      const result = await submitApprovalBinding({
        projectId,
        subjectType: 'FORM_RECORD',
        subjectId: id,
        subjectTable: 'monthly_measurements',
        definitionId: activeDef.id,
        formData: {
          formTable: 'monthly_measurements',
          formId: id,
          projectId
        },
        comment: (req.body.remark as string)?.trim() || '送审',
        actorUserId: userId
      })

      // 更新主表状态
      await projectDb('monthly_measurements').where('id', id).update({
        flowInstanceId: result.currentInstanceId,
        approveStatus: 'PENDING',
        updatedAt: new Date()
      })

      return res.status(200).json({ success: true, instanceId: result.currentInstanceId })
    }
  )

  // -------------------------------------------------------------
  // 安全文明措施费 (Safety Measures) REST APIs
  // -------------------------------------------------------------

  const checkSafetyWritePermission = async (
    projectDb: any,
    measureId: string,
    userId: string,
    requiredRole: 'contractor' | 'supervision' | 'supervision_approver' | 'headquarters' | 'headquarters_approver' | 'engineering' | 'engineering_approver' | 'contract'
  ) => {
    const measure = await projectDb('safety_measures').where('id', measureId).first()
    if (!measure) {
      throw new BadRequestError('安全文明措施费单据不存在')
    }

    const isDraft = !measure.approveStatus || measure.approveStatus === 'START'
    if (isDraft) {
      if (requiredRole === 'contractor') {
        return true
      }
      throw new BadRequestError('草稿期仅允许施工单位填报数据')
    }

    if (measure.flowInstanceId) {
      const pendingStep = await db('approval_flow_instance_steps')
        .where('instanceId', measure.flowInstanceId)
        .andWhere('status', 'PENDING')
        .orderBy('stepIndex', 'asc')
        .first()

      if (!pendingStep) {
        throw new BadRequestError('当前无可编辑的审批流节点')
      }

      if (pendingStep.approverIds && pendingStep.approverIds.length > 0) {
        if (!pendingStep.approverIds.includes(userId)) {
          throw new BadRequestError('您不是当前步骤的审批负责人')
        }
      }

      const stepName = (pendingStep.name || '').trim()
      const matchRole = (role: string) => {
        if (role === 'supervision') {
          return (stepName.includes('监理') || ['监理', '专业监理', '监理工程师', '施工监理', '施工监理经办人', '施工监理总监'].includes(stepName)) && 
                 !stepName.includes('投资监理') && 
                 (stepName.includes('经办') || !stepName.includes('审核'))
        }
        if (role === 'supervision_approver') {
          return (stepName.includes('监理') || ['监理', '专业监理', '监理工程师', '施工监理', '施工监理经办人', '施工监理总监'].includes(stepName)) && 
                 !stepName.includes('投资监理') && 
                 (stepName.includes('审核') || stepName.includes('负责人'))
        }
        if (role === 'headquarters') {
          return (stepName.includes('指挥部') || stepName.includes('现场指挥')) && 
                 (stepName.includes('经办') || !stepName.includes('审核'))
        }
        if (role === 'headquarters_approver') {
          return (stepName.includes('指挥部') || stepName.includes('现场指挥')) && 
                 (stepName.includes('审核') || stepName.includes('负责人'))
        }
        if (role === 'engineering') {
          return (stepName.includes('工管') || stepName.includes('工程管理')) && 
                 (stepName.includes('经办') || !stepName.includes('审核'))
        }
        if (role === 'engineering_approver') {
          return (stepName.includes('工管') || stepName.includes('工程管理')) && 
                 (stepName.includes('审核') || stepName.includes('负责人'))
        }
        if (role === 'contract') {
          return stepName.includes('合约') || stepName.includes('计划合同') || ['合约部', '计划合同部', '合约部审核', '计划合同部经办人', '合约管理部经办人', '合约管理部负责人'].includes(stepName)
        }
        if (role === 'contractor') {
          return stepName.includes('施工单位') || stepName.includes('开始') || stepName.includes('送审')
        }
        return false
      }

      if (requiredRole === 'contractor' && matchRole('contractor')) return true
      if (requiredRole === 'supervision' && matchRole('supervision')) return true
      if (requiredRole === 'supervision_approver' && matchRole('supervision_approver')) return true
      if (requiredRole === 'headquarters' && matchRole('headquarters')) return true
      if (requiredRole === 'headquarters_approver' && matchRole('headquarters_approver')) return true
      if (requiredRole === 'engineering' && matchRole('engineering')) return true
      if (requiredRole === 'engineering_approver' && matchRole('engineering_approver')) return true
      if (requiredRole === 'contract' && matchRole('contract')) return true

      throw new BadRequestError(`当前审批步骤【${stepName}】不允许【${requiredRole}】角色修改数据`)
    }

    throw new BadRequestError('流程已结束，数据无法修改')
  }

  // 0. 获取项目下的清单树节段（至分部工程）
  app.get(
    '/api/v1/projects/:projectId/boq-sections',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const projectDb = await getProjectDbClient({ projectId })
      const list = await projectDb('boq_items')
        .where('projectId', projectId)
        .whereIn('type', ['PROJECT', 'SUBPROJECT', 'CATEGORY', 'SECTION'])
        .orderBy('depth', 'asc')
        .orderBy('sortOrder', 'asc')
        .orderBy('createdAt', 'asc')
      return res.status(200).json(list)
    }
  )

  // 1. 获取安全文明措施费列表
  app.get(
    '/api/v1/projects/:projectId/safety-measures',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const search = (req.query.search as string) || null
      const cursor = (req.query.cursor as string) || null
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20

      const projectDb = await getProjectDbClient({ projectId })

      // 分页查询安全文明措施费主表
      const q = projectDb('safety_measures')
        .where('project_id', projectId)
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
        .limit(limit + 1)

      if (search) {
        q.andWhere((qb) => {
          qb.whereILike('code', `%${search}%`).orWhereILike('unit', `%${search}%`)
        })
      }

      if (cursor) {
        const [cursorDateRaw, cursorId] = cursor.split('|')
        if (cursorDateRaw && cursorId) {
          const cursorDate = new Date(cursorDateRaw)
          q.andWhere((w) => {
            w.where('updatedAt', '<', cursorDate).orWhere((w2) => {
              w2.where('updatedAt', '=', cursorDate).andWhere('id', '<', cursorId)
            })
          })
        }
      }

      const items = await q
      const hasMore = items.length > limit
      const trimmed = hasMore ? items.slice(0, limit) : items

      // 计算本单本期金额以及累计金额
      const itemsWithDetails = await Promise.all(
        trimmed.map(async (item) => {
          let creatorUser = null
          if (item.creator) {
            const u = await db('users')
              .where('id', item.creator)
              .select('id', 'name')
              .first()
            if (u) {
              creatorUser = { id: u.id, name: u.name }
            }
          }

          // 本期金额：统计非汇总行 contractDeptAmount 的总和
          const [{ total }] = await projectDb('safety_measure_items')
            .where('safetyMeasureId', item.id)
            .andWhere('isSummaryRow', false)
            .select(projectDb.raw('SUM(COALESCE("contractDeptAmount", 0)) as total'))
          const totalAmount = Number(total || 0)

          // 累计金额：统计本项目所有已审批通过的单据金额之和
          const [{ cumulative }] = await projectDb('safety_measure_items')
            .whereIn('safetyMeasureId', function () {
              this.select('id')
                .from('safety_measures')
                .where('project_id', projectId)
                .andWhere('approveStatus', 'APPROVED')
            })
            .andWhere('isSummaryRow', false)
            .select(projectDb.raw('SUM(COALESCE("contractDeptAmount", 0)) as total'))
          const cumulativeAmount = Number(cumulative || 0)

          // 获取当前步骤负责人
          let currentStepApprovers: string[] = []
          let actualApproveStatus = item.approveStatus || 'START'
          let actualFlowInstanceId = item.flowInstanceId

          // 检查工作流绑定
          const binding = await db('approval_flow_bindings')
            .where('subjectKey', `safety_measures:${item.id}`)
            .select('status', 'currentInstanceId')
            .first()

          if (binding) {
            actualApproveStatus = binding.status
            actualFlowInstanceId = binding.currentInstanceId
          }

          if (actualFlowInstanceId) {
            const pendingStep = await db('approval_flow_instance_steps')
              .where('instanceId', actualFlowInstanceId)
              .andWhere('status', 'PENDING')
              .orderBy('stepIndex', 'asc')
              .first()
            if (pendingStep?.approverIds?.length) {
              const users = await db('users')
                .whereIn('id', pendingStep.approverIds)
                .select('name')
              currentStepApprovers = users.map((u) => u.name).filter(Boolean)
            }
          }

          return {
            ...item,
            approveStatus: actualApproveStatus,
            flowInstanceId: actualFlowInstanceId,
            creator: creatorUser,
            totalAmount,
            cumulativeAmount,
            currentStepApprovers
          }
        })
      )

      // 统计总数
      const countQ = projectDb('safety_measures').where('project_id', projectId)
      if (search) {
        countQ.andWhere((qb) => {
          qb.whereILike('code', `%${search}%`).orWhereILike('unit', `%${search}%`)
        })
      }
      const [countRes] = await countQ.count()
      const totalCount = parseInt(String(countRes?.count || '0'))

      const last = trimmed[trimmed.length - 1]
      const nextCursor = hasMore && last ? `${new Date(last.updatedAt).toISOString()}|${last.id}` : null

      return res.status(200).json({
        items: itemsWithDetails,
        cursor: nextCursor,
        totalCount
      })
    }
  )

  // 2. 获取特定安全文明措施费主表信息
  app.get(
    '/api/v1/projects/:projectId/safety-measures/:id',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })

      const measure = await projectDb('safety_measures')
        .where('id', id)
        .andWhere('project_id', projectId)
        .first()

      if (!measure) {
        return res.status(404).json({ error: '安全文明措施费单据不存在' })
      }

      // 查询绑定
      const binding = await db('approval_flow_bindings')
        .where('subjectKey', `safety_measures:${id}`)
        .select('status', 'currentInstanceId')
        .first()

      let actualApproveStatus = measure.approveStatus || 'START'
      let actualFlowInstanceId = measure.flowInstanceId

      if (binding) {
        actualApproveStatus = binding.status
        actualFlowInstanceId = binding.currentInstanceId
      }

      let creatorUser = null
      if (measure.creator) {
        const u = await db('users').where('id', measure.creator).select('id', 'name').first()
        if (u) {
          creatorUser = { id: u.id, name: u.name }
        }
      }

      let flowInitiatorUser = null
      let currentStepName = ''
      let currentStepApprovers: string[] = []

      if (actualFlowInstanceId) {
        const flowInstance = await db('approval_flow_instances')
          .where('id', actualFlowInstanceId)
          .select('createdBy')
          .first()
        if (flowInstance?.createdBy) {
          const u = await db('users').where('id', flowInstance.createdBy).select('id', 'name').first()
          if (u) {
            flowInitiatorUser = { id: u.id, name: u.name }
          }
        }

        const pendingStep = await db('approval_flow_instance_steps')
          .where('instanceId', actualFlowInstanceId)
          .andWhere('status', 'PENDING')
          .orderBy('stepIndex', 'asc')
          .first()
        if (pendingStep) {
          currentStepName = pendingStep.name || ''
          if (pendingStep.approverIds?.length) {
            const users = await db('users').whereIn('id', pendingStep.approverIds).select('name')
            currentStepApprovers = users.map((u) => u.name).filter(Boolean)
          }
        }
      }

      return res.status(200).json({
        ...measure,
        approveStatus: actualApproveStatus,
        flowInstanceId: actualFlowInstanceId,
        creator: creatorUser,
        flowInitiator: flowInitiatorUser,
        currentStepName,
        currentStepApprovers
      })
    }
  )

  // 3. 获取明细项列表（支持自底向上小计、历史已审批累计、本年累计）
  app.get(
    '/api/v1/projects/:projectId/safety-measures/:id/items',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })

      const measure = await projectDb('safety_measures').where('id', id).first()
      if (!measure) {
        return res.status(404).json({ error: '安全文明措施费单据不存在' })
      }

      const items = await projectDb('safety_measure_items')
        .where('safetyMeasureId', id)
        .orderBy('sortIndex', 'asc')
        .orderBy('boqDepth', 'asc')
        .orderBy('boqCode', 'asc')
        .orderBy('id', 'asc')

      // 获取历史已审批通过的单据以计算本年和累计数据
      const measureYear = dayjs(Number(measure.baseDate)).format('YYYY')

      // 除了本期外，所有 APPROVED 单据
      const approvedMeasures = await projectDb('safety_measures')
        .where('project_id', projectId)
        .andWhere('approveStatus', 'APPROVED')
        .andWhereNot('id', id)
        .select('id', 'baseDate')

      const approvedMeasureIds = approvedMeasures.map((m) => m.id)
      const yearlyApprovedIds = approvedMeasures
        .filter((m) => dayjs(Number(m.baseDate)).format('YYYY') === measureYear)
        .map((m) => m.id)

      // 各明细项的历史累计完成量
      const lastCumulativeMap = new Map<string, { qty: number; amt: number }>()
      if (approvedMeasureIds.length > 0) {
        const histories = await projectDb('safety_measure_items')
          .whereIn('safetyMeasureId', approvedMeasureIds)
          .andWhere('isSummaryRow', false)
          .select('boqItemId')
          .sum('contractDeptQty as qty')
          .sum('contractDeptAmount as amt')
          .groupBy('boqItemId')
        histories.forEach((h: any) => {
          lastCumulativeMap.set(h.boqItemId, { qty: Number(h.qty || 0), amt: Number(h.amt || 0) })
        })
      }

      // 各明细项的本年历史累计完成量
      const yearlyCumulativeMap = new Map<string, { qty: number; amt: number }>()
      if (yearlyApprovedIds.length > 0) {
        const histories = await projectDb('safety_measure_items')
          .whereIn('safetyMeasureId', yearlyApprovedIds)
          .andWhere('isSummaryRow', false)
          .select('boqItemId')
          .sum('contractDeptQty as qty')
          .sum('contractDeptAmount as amt')
          .groupBy('boqItemId')
        histories.forEach((h: any) => {
          yearlyCumulativeMap.set(h.boqItemId, { qty: Number(h.qty || 0), amt: Number(h.amt || 0) })
        })
      }

      // 遍历叶子节点计算本年和累计完成量
      const rowById = new Map<string, any>()
      const rowsByDepth = new Map<number, any[]>()
      
      const mappedItems = items.map((item) => {
        const contractorQty = Number(item.contractorQty || 0)
        const price = Number(item.price || 0)

        // 叶子项的累计和本年数
        let lastCumulativeQty = 0
        let lastCumulativeAmount = 0
        let cumulativeQty = 0
        let cumulativeAmount = 0
        let yearlyCumulativeQty = 0
        let yearlyCumulativeAmount = 0
        let yearlyQty = 0
        let yearlyAmount = 0
        let cumulativeRate = 0

        if (!item.isSummaryRow) {
          const history = lastCumulativeMap.get(item.boqItemId) || { qty: 0, amt: 0 }
          const yearlyHist = yearlyCumulativeMap.get(item.boqItemId) || { qty: 0, amt: 0 }

          lastCumulativeQty = history.qty
          lastCumulativeAmount = history.amt

          const contractDeptQty = Number(item.contractDeptQty || 0)
          cumulativeQty = preciseAdd(lastCumulativeQty, contractDeptQty)
          cumulativeAmount = preciseAdd(lastCumulativeAmount, preciseMul(contractDeptQty, price))

          yearlyCumulativeQty = yearlyHist.qty
          yearlyCumulativeAmount = yearlyHist.amt
          yearlyQty = preciseAdd(yearlyCumulativeQty, contractDeptQty)
          yearlyAmount = preciseAdd(yearlyCumulativeAmount, preciseMul(contractDeptQty, price))

          const contractAmount = Number(item.contractAmount || 0)
          cumulativeRate = contractAmount > 0 ? (cumulativeAmount / contractAmount) * 100 : 0
        }

        const row = {
          ...item,
          lastCumulativeQty,
          lastCumulativeAmount,
          cumulativeQty,
          cumulativeAmount,
          yearlyCumulativeQty,
          yearlyCumulativeAmount,
          yearlyQty,
          yearlyAmount,
          cumulativeRate: parseFloat(cumulativeRate.toFixed(2))
        }

        rowById.set(row.boqItemId, row)
        const depth = Number(row.boqDepth || 0)
        const bucket = rowsByDepth.get(depth)
        if (bucket) bucket.push(row)
        else rowsByDepth.set(depth, [row])

        return row
      })

      // 自底向上重新计算非叶子节点（汇总行）的小计
      const depths = Array.from(rowsByDepth.keys()).sort((a, b) => b - a)
      depths.forEach((depth) => {
        const rows = rowsByDepth.get(depth)
        if (!rows) return
        rows.forEach((row) => {
          if (!row.boqParentId) return
          const parent = rowById.get(row.boqParentId)
          if (!parent || !parent.isSummaryRow) return

          // 重新初始化父节点各项数据为 0 (仅在第一次累加时)
          if (!parent._isInitialized) {
            parent._isInitialized = true
            parent.contractorQty = 0
            parent.contractorAmount = 0
            parent.supervisionQty = 0
            parent.supervisionAmount = 0
            parent.headquartersQty = 0
            parent.headquartersAmount = 0
            parent.engineeringQty = 0
            parent.engineeringAmount = 0
            parent.contractDeptQty = 0
            parent.contractDeptAmount = 0
            
            parent.lastCumulativeQty = 0
            parent.lastCumulativeAmount = 0
            parent.cumulativeQty = 0
            parent.cumulativeAmount = 0
            parent.yearlyCumulativeQty = 0
            parent.yearlyCumulativeAmount = 0
            parent.yearlyQty = 0
            parent.yearlyAmount = 0
            parent.contractQty = 0
            parent.contractAmount = 0
          }

          parent.contractorQty = preciseAdd(parent.contractorQty, row.contractorQty || 0)
          parent.contractorAmount = preciseAdd(parent.contractorAmount, row.contractorAmount || 0)
          parent.supervisionQty = preciseAdd(parent.supervisionQty, row.supervisionQty || 0)
          parent.supervisionAmount = preciseAdd(parent.supervisionAmount, row.supervisionAmount || 0)
          parent.headquartersQty = preciseAdd(parent.headquartersQty, row.headquartersQty || 0)
          parent.headquartersAmount = preciseAdd(parent.headquartersAmount, row.headquartersAmount || 0)
          parent.engineeringQty = preciseAdd(parent.engineeringQty, row.engineeringQty || 0)
          parent.engineeringAmount = preciseAdd(parent.engineeringAmount, row.engineeringAmount || 0)
          parent.contractDeptQty = preciseAdd(parent.contractDeptQty, row.contractDeptQty || 0)
          parent.contractDeptAmount = preciseAdd(parent.contractDeptAmount, row.contractDeptAmount || 0)

          parent.lastCumulativeQty = preciseAdd(parent.lastCumulativeQty, row.lastCumulativeQty || 0)
          parent.lastCumulativeAmount = preciseAdd(parent.lastCumulativeAmount, row.lastCumulativeAmount || 0)
          parent.cumulativeQty = preciseAdd(parent.cumulativeQty, row.cumulativeQty || 0)
          parent.cumulativeAmount = preciseAdd(parent.cumulativeAmount, row.cumulativeAmount || 0)
          parent.yearlyCumulativeQty = preciseAdd(parent.yearlyCumulativeQty, row.yearlyCumulativeQty || 0)
          parent.yearlyCumulativeAmount = preciseAdd(parent.yearlyCumulativeAmount, row.yearlyCumulativeAmount || 0)
          parent.yearlyQty = preciseAdd(parent.yearlyQty, row.yearlyQty || 0)
          parent.yearlyAmount = preciseAdd(parent.yearlyAmount, row.yearlyAmount || 0)
          parent.contractQty = preciseAdd(parent.contractQty, row.contractQty || 0)
          parent.contractAmount = preciseAdd(parent.contractAmount, row.contractAmount || 0)

          const cAmount = Number(parent.contractAmount || 0)
          parent.cumulativeRate = cAmount > 0 ? parseFloat(((parent.cumulativeAmount / cAmount) * 100).toFixed(2)) : 0
        })
      })

      // 清除临时标记 _isInitialized
      mappedItems.forEach((row) => {
        delete row._isInitialized
      })

      return res.status(200).json(mappedItems)
    }
  )

  // 4. 获取签署的意见和附件列表
  app.get(
    '/api/v1/projects/:projectId/safety-measures/:id/details',
    authMiddlewareCreator(streamReadPermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })

      const details = await projectDb('safety_measure_details')
        .where('safetyMeasureId', id)
        .first()

      if (!details) {
        // 如果详情未初始化，自动初始化一个空详情
        const newDetails = {
          id: cryptoRandomString({ length: 10 }),
          safetyMeasureId: id,
          attachments: JSON.stringify([]),
          createdAt: new Date(),
          updatedAt: new Date()
        }
        await projectDb('safety_measure_details').insert(newDetails)
        return res.status(200).json({
          ...newDetails,
          attachments: []
        })
      }

      return res.status(200).json({
        ...details,
        attachments: typeof details.attachments === 'string' ? JSON.parse(details.attachments) : (details.attachments || [])
      })
    }
  )

  // 5. 新增安全文明措施费 (递归初始化清单明细)
  app.post(
    '/api/v1/projects/:projectId/safety-measures',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId } = req.params
      const userId = req.context.userId!
      const body = req.body || {}

      const roundName = body.roundName?.trim()
      const baseDate = Number(body.baseDate)
      const startDate = body.startDate ? Number(body.startDate) : null
      const endDate = body.endDate ? Number(body.endDate) : null
      const unit = body.unit?.trim()
      const boqSectionIds = body.boqSectionIds || [] // 多选分部工程

      if (!baseDate || Number.isNaN(baseDate)) {
        return res.status(400).json({ error: '基准时间/年月无效' })
      }
      if (!roundName) {
        return res.status(400).json({ error: '期数不能为空' })
      }
      if (!boqSectionIds.length) {
        return res.status(400).json({ error: '分部工程至少需要选择一项' })
      }

      const projectDb = await getProjectDbClient({ projectId })

      // 获取项目的默认承包人作为默认施工单位
      let defaultUnit = '上海建工集团股份有限公司'
      const streamRecord = await db('streams')
        .where('id', projectId)
        .select('contractor')
        .first()
      if (streamRecord && streamRecord.contractor) {
        defaultUnit = streamRecord.contractor
      }

      // 自动生成编码 AQWM-YYYYMM-XXX
      const monthStr = dayjs(baseDate).format('YYYYMM')
      const prefix = `AQWM-${monthStr}-`
      const existingList = await projectDb('safety_measures')
        .where('project_id', projectId)
        .whereILike('code', `${prefix}%`)
        .select('code')
      
      let nextNum = 1
      if (existingList.length > 0) {
        const nums = existingList
          .map((item) => {
            const part = item.code.substring(prefix.length)
            return parseInt(part, 10)
          })
          .filter((n) => !Number.isNaN(n))
        if (nums.length > 0) {
          nextNum = Math.max(...nums) + 1
        }
      }
      const code = `${prefix}${String(nextNum).padStart(3, '0')}`

      // 内存检索选中分部工程节点及其所有后代节点
      const boqItems = await projectDb('boq_items')
        .where('projectId', projectId)
        .orderBy('depth', 'asc')
        .orderBy('sortOrder', 'asc')
        .orderBy('createdAt', 'asc')

      const selectedSections = new Set(boqSectionIds)
      const itemMap = new Map()
      boqItems.forEach((item) => itemMap.set(item.id, item))

      const boqItemIdsToInclude = new Set<string>()

      const isDescendant = (item: any) => {
        if (selectedSections.has(item.id)) return true
        let parentId = item.parentId
        while (parentId) {
          if (selectedSections.has(parentId)) return true
          const p = itemMap.get(parentId)
          parentId = p ? p.parentId : null
        }
        return false
      }

      const addAncestors = (itemId: string) => {
        let current = itemMap.get(itemId)
        while (current && current.parentId) {
          const parent = itemMap.get(current.parentId)
          if (parent) {
            boqItemIdsToInclude.add(parent.id)
            if (parent.type === 'CATEGORY') {
              break
            }
          }
          current = parent
        }
      }

      boqItems.forEach((item) => {
        if (isDescendant(item)) {
          boqItemIdsToInclude.add(item.id)
          addAncestors(item.id)
        }
      })

      const selectedBoqItems = boqItems.filter((item) => boqItemIdsToInclude.has(item.id))
      if (!selectedBoqItems.length) {
        return res.status(400).json({ error: '所选分部工程下未找到清单内容' })
      }

      const parentIds = new Set(selectedBoqItems.map((item) => item.parentId).filter(Boolean))
      const measureId = cryptoRandomString({ length: 10 })

      const nextItems = selectedBoqItems.map((item, index) => {
        const isSummary = parentIds.has(item.id)
        const qty = isSummary ? 0 : Number(item.quantity || 0)
        const price = isSummary ? 0 : Number(item.price || 0)
        
        let amt = 0
        if (!isSummary) {
          if (item.amount !== null && item.amount !== undefined) {
            amt = Number(item.amount)
          } else {
            amt = preciseMul(qty, price)
          }
        }

        return {
          id: cryptoRandomString({ length: 10 }),
          safetyMeasureId: measureId,
          boqItemId: item.id,
          boqCode: item.code,
          boqName: item.name,
          boqParentId: item.parentId,
          boqDepth: item.depth,
          isSummaryRow: isSummary,
          sortIndex: index,
          uom: item.unit || null,
          price: isSummary ? null : price,
          contractQty: qty,
          contractAmount: amt,
          
          contractorQty: 0,
          contractorAmount: 0,
          supervisionQty: 0,
          supervisionAmount: 0,
          headquartersQty: 0,
          headquartersAmount: 0,
          engineeringQty: 0,
          engineeringAmount: 0,
          contractDeptQty: 0,
          contractDeptAmount: 0
        }
      })

      // 保存事务
      const created = await projectDb.transaction(async (trx) => {
        const payload = {
          id: measureId,
          project_id: projectId,
          unit: unit || defaultUnit,
          code,
          baseDate: String(baseDate),
          roundName,
          startDate: startDate ? String(startDate) : null,
          endDate: endDate ? String(endDate) : null,
          boqSectionIds: JSON.stringify(boqSectionIds),
          approveStatus: 'START',
          flowInstanceId: null,
          creator: userId
        }
        
        await trx('safety_measures').insert(payload)
        await trx('safety_measure_items').insert(nextItems)
        await trx('safety_measure_details').insert({
          id: cryptoRandomString({ length: 10 }),
          safetyMeasureId: measureId,
          attachments: JSON.stringify([]),
          createdAt: new Date(),
          updatedAt: new Date()
        })

        return payload
      })

      return res.status(201).json(created)
    }
  )

  // 6. 保存安全文明措施费（支持各方数量编辑和意见、附件保存）
  app.put(
    '/api/v1/projects/:projectId/safety-measures/:id',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const userId = req.context.userId!
      const body = req.body || {}

      const projectDb = await getProjectDbClient({ projectId })

      const measure = await projectDb('safety_measures').where('id', id).first()
      if (!measure) {
        return res.status(404).json({ error: '安全文明措施费单据不存在' })
      }

      // 根据当前流转节点进行角色和修改权限的鉴权
      let currentRole: 'contractor' | 'supervision' | 'supervision_approver' | 'headquarters' | 'headquarters_approver' | 'engineering' | 'engineering_approver' | 'contract' = 'contractor'
      const isDraft = !measure.approveStatus || measure.approveStatus === 'START'
      
      if (!isDraft && measure.flowInstanceId) {
        const pendingStep = await db('approval_flow_instance_steps')
          .where('instanceId', measure.flowInstanceId)
          .andWhere('status', 'PENDING')
          .orderBy('stepIndex', 'asc')
          .first()
        if (pendingStep) {
          const stepName = (pendingStep.name || '').trim()
          const matchRole = (role: string) => {
            if (role === 'supervision') {
              return (stepName.includes('监理') || ['监理', '专业监理', '监理工程师', '施工监理', '施工监理经办人', '施工监理总监'].includes(stepName)) && 
                     !stepName.includes('投资监理') && 
                     (stepName.includes('经办') || !stepName.includes('审核'))
            }
            if (role === 'supervision_approver') {
              return (stepName.includes('监理') || ['监理', '专业监理', '监理工程师', '施工监理', '施工监理经办人', '施工监理总监'].includes(stepName)) && 
                     !stepName.includes('投资监理') && 
                     (stepName.includes('审核') || stepName.includes('负责人'))
            }
            if (role === 'headquarters') {
              return (stepName.includes('指挥部') || stepName.includes('现场指挥')) && 
                     (stepName.includes('经办') || !stepName.includes('审核'))
            }
            if (role === 'headquarters_approver') {
              return (stepName.includes('指挥部') || stepName.includes('现场指挥')) && 
                     (stepName.includes('审核') || stepName.includes('负责人'))
            }
            if (role === 'engineering') {
              return (stepName.includes('工管') || stepName.includes('工程管理')) && 
                     (stepName.includes('经办') || !stepName.includes('审核'))
            }
            if (role === 'engineering_approver') {
              return (stepName.includes('工管') || stepName.includes('工程管理')) && 
                     (stepName.includes('审核') || stepName.includes('负责人'))
            }
            if (role === 'contract') {
              return stepName.includes('合约') || stepName.includes('计划合同') || ['合约部', '计划合同部', '合约部审核', '计划合同部经办人', '合约管理部经办人', '合约管理部负责人'].includes(stepName)
            }
            if (role === 'contractor') {
              return stepName.includes('施工单位') || stepName.includes('开始') || stepName.includes('送审')
            }
            return false
          }

          if (matchRole('supervision')) currentRole = 'supervision'
          else if (matchRole('supervision_approver')) currentRole = 'supervision_approver'
          else if (matchRole('headquarters')) currentRole = 'headquarters'
          else if (matchRole('headquarters_approver')) currentRole = 'headquarters_approver'
          else if (matchRole('engineering')) currentRole = 'engineering'
          else if (matchRole('engineering_approver')) currentRole = 'engineering_approver'
          else if (matchRole('contract')) currentRole = 'contract'
          else if (matchRole('contractor')) currentRole = 'contractor'
        }
      }

      await checkSafetyWritePermission(projectDb, id, userId, currentRole)

      // 保存明细行数量与金额（只更新有权更新的角色列）
      const itemsPayload = body.items || []
      const detailPayload = body.details || {}

      await projectDb.transaction(async (trx) => {
        // 更新明细数量与金额
        for (const it of itemsPayload) {
          const updateFields: Record<string, any> = {}
          const price = Number(it.price || 0)

          if (currentRole === 'contractor') {
            updateFields.contractorQty = Number(it.contractorQty || 0)
            updateFields.contractorAmount = preciseMul(updateFields.contractorQty, price)
          } else if (currentRole === 'supervision' || currentRole === 'supervision_approver') {
            updateFields.supervisionQty = Number(it.supervisionQty || 0)
            updateFields.supervisionAmount = preciseMul(updateFields.supervisionQty, price)
          } else if (currentRole === 'headquarters' || currentRole === 'headquarters_approver') {
            updateFields.headquartersQty = Number(it.headquartersQty || 0)
            updateFields.headquartersAmount = preciseMul(updateFields.headquartersQty, price)
          } else if (currentRole === 'engineering' || currentRole === 'engineering_approver') {
            updateFields.engineeringQty = Number(it.engineeringQty || 0)
            updateFields.engineeringAmount = preciseMul(updateFields.engineeringQty, price)
          } else if (currentRole === 'contract') {
            updateFields.contractDeptQty = Number(it.contractDeptQty || 0)
            updateFields.contractDeptAmount = preciseMul(updateFields.contractDeptQty, price)
          }

          if (Object.keys(updateFields).length > 0) {
            await trx('safety_measure_items')
              .where({ safetyMeasureId: id, boqItemId: it.boqItemId })
              .update({
                ...updateFields,
                updatedAt: new Date()
              })
          }
        }

        // 更新意见表字段
        const updateDetail: Record<string, any> = {
          updatedAt: new Date()
        }

        if (detailPayload.attachments) {
          updateDetail.attachments = JSON.stringify(detailPayload.attachments)
        }

        const now = new Date()
        const userName = await db('users').where('id', userId).select('name').first().then(u => u?.name || '未知')

        if (currentRole === 'supervision') {
          updateDetail.supervisionOpinion = detailPayload.supervisionOpinion || ''
          updateDetail.supervisionAuditor = userName
          updateDetail.supervisionDate = now
        } else if (currentRole === 'supervision_approver') {
          updateDetail.supervisionOpinion = detailPayload.supervisionOpinion || ''
          updateDetail.supervisionApproveAuditor = userName
          updateDetail.supervisionApproveDate = now
        } else if (currentRole === 'headquarters') {
          updateDetail.headquartersOpinion = detailPayload.headquartersOpinion || ''
          updateDetail.headquartersAuditor = userName
          updateDetail.headquartersDate = now
        } else if (currentRole === 'headquarters_approver') {
          updateDetail.headquartersOpinion = detailPayload.headquartersOpinion || ''
          updateDetail.headquartersApproveAuditor = userName
          updateDetail.headquartersApproveDate = now
        } else if (currentRole === 'engineering') {
          updateDetail.engineeringOpinion = detailPayload.engineeringOpinion || ''
          updateDetail.engineeringAuditor = userName
          updateDetail.engineeringDate = now
        } else if (currentRole === 'engineering_approver') {
          updateDetail.engineeringOpinion = detailPayload.engineeringOpinion || ''
          updateDetail.engineeringApproveAuditor = userName
          updateDetail.engineeringApproveDate = now
        } else if (currentRole === 'contract') {
          updateDetail.contractOpinion = detailPayload.contractOpinion || ''
          updateDetail.contractAuditor = userName
          updateDetail.contractDate = now
        }

        await trx('safety_measure_details')
          .where({ safetyMeasureId: id })
          .update(updateDetail)

        // 更新主表更新时间
        await trx('safety_measures')
          .where({ id })
          .update({ updatedAt: new Date() })
      })

      return res.status(200).json({ success: true })
    }
  )

  // 7. 删除安全文明措施费
  app.delete(
    '/api/v1/projects/:projectId/safety-measures/:id',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const projectDb = await getProjectDbClient({ projectId })

      const measure = await projectDb('safety_measures').where('id', id).first()
      if (!measure) {
        return res.status(404).json({ error: '安全文明措施费单据不存在' })
      }

      const isDraft = !measure.approveStatus || measure.approveStatus === 'START'
      if (!isDraft) {
        return res.status(400).json({ error: '送审后单据不可删除' })
      }

      await projectDb.transaction(async (trx) => {
        await trx('safety_measure_items').where({ safetyMeasureId: id }).delete()
        await trx('safety_measure_details').where({ safetyMeasureId: id }).delete()
        await trx('safety_measures').where({ id }).delete()
      })

      return res.status(200).json({ success: true })
    }
  )

  // 8. 送审安全文明措施费 (发起工作流实例)
  app.post(
    '/api/v1/projects/:projectId/safety-measures/:id/submit',
    authMiddlewareCreator(streamWritePermissionsPipelineFactory({ getStream })),
    async (req: Request, res: Response) => {
      const { projectId, id } = req.params
      const userId = req.context.userId!

      const projectDb = await getProjectDbClient({ projectId })
      const measure = await projectDb('safety_measures').where('id', id).first()
      if (!measure) {
        return res.status(404).json({ error: '安全文明措施费单据不存在' })
      }

      const isDraft = !measure.approveStatus || measure.approveStatus === 'START'
      if (!isDraft) {
        return res.status(400).json({ error: '已送审，请勿重复操作' })
      }

      // 获取启用的安全文明措施费工作流配置
      const getActiveByCategory = getActiveApprovalFlowByCategoryFactory({ db })
      const activeDef = await getActiveByCategory({
        projectId,
        category: 'SAFETY_MEASURE'
      })

      if (!activeDef) {
        return res.status(400).json({ error: '未找到启用的安全文明措施费审批流程，请先去流程设置中创建并启用。' })
      }

      // 发起工作流并绑定
      const submitApprovalBinding = submitApprovalBindingFactory({ db })
      const result = await submitApprovalBinding({
        projectId,
        subjectType: 'FORM_RECORD',
        subjectId: id,
        subjectTable: 'safety_measures',
        definitionId: activeDef.id,
        formData: {
          formTable: 'safety_measures',
          formId: id,
          projectId
        },
        comment: (req.body.remark as string)?.trim() || '送审安全文明措施费',
        actorUserId: userId
      })

      // 更新主表 flowInstanceId 与状态
      await projectDb('safety_measures').where('id', id).update({
        flowInstanceId: result.currentInstanceId,
        approveStatus: 'PENDING',
        updatedAt: new Date()
      })

      return res.status(200).json({ success: true, instanceId: result.currentInstanceId })
    }
  )

  return app
}

const formatExportDate = (date: any) => {
  if (date === null || date === undefined || date === '') return ''
  const numeric = Number(date)
  if (!Number.isNaN(numeric) && numeric > 0) {
    return dayjs(numeric).format('YYYY-MM-DD')
  }
  const parsed = dayjs(String(date))
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

const getStatusText = (status: string | null | undefined) => {
  switch (status) {
    case 'START':
      return '待查验'
    case 'PENDING':
      return '正在查验'
    case 'APPROVED':
      return '已查验'
    case 'REJECTED':
      return '已拒绝'
    case 'CANCELED':
      return '已取消'
    case null:
    case '':
      return '未查验'
    default:
      return status || '-'
  }
}

const expandSerialRange = (rangeStr: string): string[] => {
  rangeStr = rangeStr.trim()
  const tildeRegex = /[~～]/
  if (!tildeRegex.test(rangeStr)) {
    return [rangeStr]
  }
  const parts = rangeStr.split(tildeRegex).map((p) => p.trim())
  if (parts.length !== 2) {
    return [rangeStr]
  }
  const [start, end] = parts
  const startMatch = start.match(/^(.*?)(\d+)$/)
  const endMatch = end.match(/^(.*?)(\d+)$/)
  if (!startMatch || !endMatch) {
    return [start, end]
  }
  const prefix = startMatch[1]
  const startNumStr = startMatch[2]
  const endNumStr = endMatch[2]

  if (endMatch[1] !== '' && prefix !== endMatch[1]) {
    return [start, end]
  }

  const startNum = parseInt(startNumStr, 10)
  const endNum = parseInt(endNumStr, 10)
  if (startNum > endNum) {
    return [start, end]
  }
  const width = startNumStr.length
  const results: string[] = []
  for (let i = startNum; i <= endNum; i++) {
    const numStr = String(i).padStart(width, '0')
    results.push(prefix + numStr)
  }
  return results
}

const compressSerialNumbers = (numbers: string[]): string => {
  if (!numbers || numbers.length === 0) return ''

  type Parsed = {
    original: string
    prefix: string
    num: number
    width: number
  }
  const parsedItems: Parsed[] = []
  const nonParsable: string[] = []

  for (const numStr of numbers) {
    const trimmed = numStr.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^(.*?)(\d+)$/)
    if (match) {
      parsedItems.push({
        original: trimmed,
        prefix: match[1],
        num: parseInt(match[2], 10),
        width: match[2].length
      })
    } else {
      nonParsable.push(trimmed)
    }
  }

  type GroupKey = string
  const groups = new Map<GroupKey, Parsed[]>()
  for (const item of parsedItems) {
    const key = `${item.prefix}::${item.width}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }

  const resultSegments: string[] = []

  for (const [key, items] of groups.entries()) {
    const lastColonIdx = key.lastIndexOf('::')
    const prefix = key.substring(0, lastColonIdx)
    const width = parseInt(key.substring(lastColonIdx + 2), 10)

    const uniqueNums = Array.from(new Set(items.map((it) => it.num))).sort(
      (a, b) => a - b
    )

    let k = 0
    while (k < uniqueNums.length) {
      let endIdx = k
      while (
        endIdx + 1 < uniqueNums.length &&
        uniqueNums[endIdx + 1] === uniqueNums[endIdx] + 1
      ) {
        endIdx++
      }

      const formatNum = (n: number) => prefix + String(n).padStart(width, '0')
      if (endIdx > k) {
        const endNumStr = String(uniqueNums[endIdx]).padStart(width, '0')
        resultSegments.push(`${formatNum(uniqueNums[k])}~${endNumStr}`)
      } else {
        resultSegments.push(formatNum(uniqueNums[k]))
      }
      k = endIdx + 1
    }
  }

  resultSegments.push(...nonParsable)
  return resultSegments.join(', ')
}

const getBimIdsString = (bim: any) => {
  if (!bim) return ''
  let bimArr = bim
  if (typeof bim === 'string') {
    try {
      bimArr = JSON.parse(bim)
    } catch {
      return ''
    }
  }
  if (!Array.isArray(bimArr)) return ''
  const ids = bimArr.flatMap((entry: any) => entry.bimIds || [])
  const validIds = ids.filter((id: any) => typeof id === 'string' && !!id.trim())
  return compressSerialNumbers(validIds)
}

const parseExcelDate = (raw: any): number | null => {
  if (typeof raw === 'number') {
    if (raw > 100000000000) return raw
    const excelDate = XLSX.SSF.parse_date_code(raw)
    if (!excelDate) return null
    return new Date(
      excelDate.y,
      excelDate.m - 1,
      excelDate.d,
      excelDate.H,
      excelDate.M,
      excelDate.S
    ).getTime()
  }
  const parsed = dayjs(String(raw).trim())
  return parsed.isValid() ? parsed.valueOf() : null
}

const parseApproveStatus = (value: string): string | null | undefined => {
  const normalized = value.trim().toUpperCase()
  if (!normalized) return null
  if (
    normalized === '-' ||
    normalized === 'NULL' ||
    normalized === 'NONE' ||
    normalized === 'N/A' ||
    value.trim() === '未查验' ||
    value.trim() === '未验工'
  ) {
    return null
  }
  const statusMap: Record<string, string> = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELED: 'CANCELED',
    正在查验: 'PENDING',
    已查验: 'APPROVED',
    已拒绝: 'REJECTED',
    已取消: 'CANCELED'
  }
  return statusMap[normalized] || statusMap[value.trim()]
}

const parseImportRows = (
  sheet: XLSX.WorkSheet,
  bimMap: Map<string, Array<{ modelId: string; applicationId: string }>>
) => {
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: ''
  })
  if (matrix.length < 2) {
    throw new Error('Excel 中没有可导入的数据')
  }

  const headerRow = matrix[0].map((cell: any) => String(cell ?? '').trim())
  const findHeaderIndex = (keys: string[]) => {
    return headerRow.findIndex((cell: string) => keys.includes(cell))
  }

  const idIndex = findHeaderIndex(['验收单ID', '主键ID', 'ID', 'id'])
  const nameIndex = findHeaderIndex(['验收单名称', '名称'])
  const codeIndex = findHeaderIndex(['编码', '验收编码'])
  const inspectionLotNumberIndex = findHeaderIndex(['检验批编号'])
  const acceptancePartIndex = findHeaderIndex(['区域部位'])
  const acceptanceContentIndex = findHeaderIndex(['检验批内容', '验收内容'])
  const actualFinishDateIndex = findHeaderIndex(['验收日期'])
  const workVolumeIndex = findHeaderIndex(['工程量'])
  const unitIndex = findHeaderIndex(['单位'])
  const approveStatusIndex = findHeaderIndex(['月度验工', '验工状态', 'approveStatus'])
  const bimIdsIndex = findHeaderIndex(['关联构件ID', '关联构件', '构件ID', 'bimNodes'])

  if (
    inspectionLotNumberIndex < 0 ||
    acceptancePartIndex < 0 ||
    acceptanceContentIndex < 0
  ) {
    throw new Error('模板缺少必要列：检验批编号、区域部位、检验批内容')
  }

  const importRows = []

  for (let index = 0; index < matrix.length - 1; index++) {
    const row = matrix[index + 1]
    const rowNumber = index + 2

    const readValue = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return String(row[cellIndex] ?? '').trim()
    }

    const readRawValue = (cellIndex: number) => {
      if (cellIndex < 0) return ''
      return row[cellIndex]
    }

    const id = readValue(idIndex)
    const name = readValue(nameIndex)
    const code = readValue(codeIndex)
    const inspectionLotNumber = readValue(inspectionLotNumberIndex)
    const acceptancePart = readValue(acceptancePartIndex)
    const acceptanceContent = readValue(acceptanceContentIndex)
    const actualFinishDateRaw = readRawValue(actualFinishDateIndex)
    const workVolumeRaw = readValue(workVolumeIndex)
    const unit = readValue(unitIndex)
    const bimIdsRaw = readValue(bimIdsIndex)

    if (
      !id &&
      !name &&
      !code &&
      !inspectionLotNumber &&
      !acceptancePart &&
      !acceptanceContent &&
      !String(actualFinishDateRaw ?? '').trim() &&
      !workVolumeRaw &&
      !unit &&
      !bimIdsRaw
    ) {
      continue
    }

    if (!inspectionLotNumber || !acceptancePart || !acceptanceContent) {
      throw new Error(
        `第 ${rowNumber} 行缺少必要字段（检验批编号/区域部位/检验批内容）`
      )
    }

    let actualFinishDate: number | null = null
    if (String(actualFinishDateRaw ?? '').trim()) {
      actualFinishDate = parseExcelDate(actualFinishDateRaw)
      if (!actualFinishDate) {
        throw new Error(`第 ${rowNumber} 行验收日期格式不正确`)
      }
    }

    let workVolume: number | null = null
    if (workVolumeRaw) {
      const parsed = Number.parseFloat(workVolumeRaw)
      if (Number.isNaN(parsed)) {
        throw new Error(`第 ${rowNumber} 行工程量不是有效数字`)
      }
      workVolume = parsed
    }

    // 根据唯一构件编码 (bimIds) 解析补全 BIM 对象属性 (modelId, applicationId)
    let BIM = null
    if (bimIdsRaw) {
      const rawBimIds = bimIdsRaw
        .split(/[,，;；、]/)
        .map((s: string) => s.trim())
        .filter(Boolean)
      const tildeRegex = /[~～]/
      for (const part of rawBimIds) {
        if (tildeRegex.test(part) && part.split(tildeRegex).length > 2) {
          throw new Error(
            `第 ${rowNumber} 行关联构件ID中包含错误的连写方式：'${part}'，连写只能包含一个波浪号`
          )
        }
      }
      const bimIds = rawBimIds.flatMap(expandSerialRange)
      if (bimIds.length > 0) {
        const bimEntryMap = new Map<
          string,
          { modelId: string; applicationIds: string[]; bimIds: string[] }
        >()
        for (const bimId of bimIds) {
          const matches = bimMap.get(bimId) || []
          if (matches.length > 0) {
            // 只取第一个匹配以防多版本倍增构件数量
            const match = matches[0]
            if (!bimEntryMap.has(match.modelId)) {
              bimEntryMap.set(match.modelId, {
                modelId: match.modelId,
                applicationIds: [],
                bimIds: []
              })
            }
            const entry = bimEntryMap.get(match.modelId)!
            entry.applicationIds.push(match.applicationId)
            entry.bimIds.push(bimId)
          } else {
            // 兜底逻辑：若无法匹配项目下任何模型构件，则视作 modelId = ''，保留输入
            const defaultModelId = ''
            if (!bimEntryMap.has(defaultModelId)) {
              bimEntryMap.set(defaultModelId, {
                modelId: defaultModelId,
                applicationIds: [],
                bimIds: []
              })
            }
            const entry = bimEntryMap.get(defaultModelId)!
            entry.applicationIds.push(bimId)
            entry.bimIds.push(bimId)
          }
        }
        BIM = Array.from(bimEntryMap.values())
      }
    }

    importRows.push({
      id: id || null,
      rowNumber,
      flowId: null,
      name: name || acceptancePart,
      code: code || null,
      inspectionLotNumber,
      acceptancePart,
      acceptanceContent,
      actualStartDate: actualFinishDate,
      actualFinishDate,
      inspector: null,
      attachments: [],
      workVolume,
      unit: unit || null,
      BIM,
      approveStatus: null
    })
  }

  return importRows
}

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message
  return String(e)
}

// 在后端内存中构建 bimId 到 modelId / applicationId 的映射关系表 (等价于前端 WorldTree.ts 机制)
const buildBimNodesMap = async (projectDb: any, projectId: string) => {
  const bimIdMap = new Map<string, Array<{ modelId: string; applicationId: string }>>()
  try {
    // 1. 获取项目下所有的模型版本
    const commits = await projectDb('commits')
      .join('stream_commits', 'commits.id', 'stream_commits.commitId')
      .where('stream_commits.streamId', projectId)
      .select('commits.id as commitId', 'commits.referencedObject')

    if (!commits.length) return bimIdMap

    const commitIds = commits.map((c: any) => c.commitId)
    const branchCommits = await projectDb('branch_commits')
      .whereIn('commitId', commitIds)
      .select('branchId', 'commitId')
    const commitToBranchMap = new Map<string, string>()
    for (const bc of branchCommits) {
      commitToBranchMap.set(bc.commitId, bc.branchId)
    }

    const commitIdMap = new Map<string, string>() // referencedObject.id -> commitId
    for (const c of commits) {
      commitIdMap.set(c.referencedObject, c.commitId)
    }

    // 2. 获取对应的所有顶层三维根对象，提取闭包映射，用以做版本归属判定
    const rootObjectIds = commits.map((c: any) => c.referencedObject)
    const rootObjects = await projectDb('objects')
      .whereIn('id', rootObjectIds)
      .select('id', 'data')

    const objectToModelsMap = new Map<string, Set<string>>() // objectId -> Set of commitIds
    for (const rootObj of rootObjects) {
      const commitId = commitIdMap.get(rootObj.id)
      if (!commitId) continue

      const data =
        typeof rootObj.data === 'string' ? JSON.parse(rootObj.data) : rootObj.data
      const closure = data?.__closure || {}
      for (const childId of Object.keys(closure)) {
        if (!objectToModelsMap.has(childId)) {
          objectToModelsMap.set(childId, new Set())
        }
        objectToModelsMap.get(childId)!.add(commitId)
      }

      if (!objectToModelsMap.has(rootObj.id)) {
        objectToModelsMap.set(rootObj.id, new Set())
      }
      objectToModelsMap.get(rootObj.id)!.add(commitId)
    }

    // 3. 拉取项目下所有的构件数据并在内存中装配
    const objects = await projectDb('objects')
      .where('streamId', projectId)
      .select('id', 'data')

    const modelDefaultSpaceCode = new Map<string, string>() // commitId -> spaceCode
    for (const obj of objects) {
      const data = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data
      if (isProjectInfoNode(data)) {
        const sc = getPropertyValue(data, ['空间代码', 'spacecode'])
        if (sc) {
          const belongsToCommits = objectToModelsMap.get(obj.id)
          if (belongsToCommits) {
            for (const cid of belongsToCommits) {
              modelDefaultSpaceCode.set(cid, sc)
            }
          }
        }
      }
    }

    for (const obj of objects) {
      const data = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data
      if (isProjectInfoNode(data)) continue

      const serialNum = getPropertyValue(data, ['序号码', '序号', 'serialnumber']) || ''

      if (!serialNum) continue

      const belongsToCommits = objectToModelsMap.get(obj.id)
      if (!belongsToCommits) continue

      for (const cid of belongsToCommits) {
        const bimId = serialNum
        if (bimId.trim()) {
          if (!bimIdMap.has(bimId)) {
            bimIdMap.set(bimId, [])
          }
          bimIdMap.get(bimId)!.push({
            modelId: commitToBranchMap.get(cid) || cid,
            applicationId: obj.id
          })
        }
      }
    }
  } catch (err) {
    // 容错日志，但不影响主导入流程运行
    console.error('Failed to build bimNodesMap in backend:', err)
  }

  return bimIdMap
}

const isProjectInfoNode = (raw: any): boolean => {
  if (!raw) return false

  const category = raw.category
  if (
    typeof category === 'string' &&
    (category === '项目信息' ||
      category.toLowerCase() === 'project information' ||
      category.toLowerCase() === 'project info')
  ) {
    return true
  }

  const name = raw.name
  if (
    typeof name === 'string' &&
    (name === '项目信息' ||
      name.toLowerCase() === 'project information' ||
      name.toLowerCase() === 'project info')
  ) {
    return true
  }

  const type = raw.type || raw.speckle_type
  if (
    typeof type === 'string' &&
    (type.includes('ProjectInformation') ||
      type.includes('ProjectInfo') ||
      type.includes('项目信息'))
  ) {
    return true
  }

  return false
}

const getPropertyValue = (raw: any, aliases: string[]): string | null => {
  if (!raw || typeof raw !== 'object') return null

  const clean = (val: string) =>
    val.toLowerCase().replace(/[\s_.:/\\()[\]{}（）-]/g, '')
  const normalizedAliases = aliases.map(clean)

  const entries: Array<{ key: string; path: string; value: any }> = []
  const visited = new Set()

  const flatten = (obj: any, currentPath = '') => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || visited.has(obj))
      return
    visited.add(obj)

    const ignoredKeys = [
      '__closure',
      'displayMesh',
      'displayValue',
      'totalChildrenCount',
      '__importedUrl',
      '__parents',
      'bbox'
    ]

    for (const [key, rawValue] of Object.entries(obj)) {
      if (ignoredKeys.includes(key)) continue

      const newPath = currentPath ? `${currentPath}.${key}` : key

      if (
        rawValue &&
        typeof rawValue === 'object' &&
        !Array.isArray(rawValue) &&
        'name' in rawValue &&
        'value' in rawValue
      ) {
        const param = rawValue as { name?: any; value?: any }
        const parameterName =
          typeof param.name === 'string' && param.name.length ? param.name : key
        entries.push({
          key: parameterName,
          path: newPath,
          value: param.value
        })
        continue
      }

      if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        flatten(rawValue, newPath)
        continue
      }

      entries.push({
        key,
        path: newPath,
        value: rawValue
      })
    }
  }

  flatten(raw)

  const formatVal = (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null
    if (Array.isArray(value)) return value.length ? value.join(', ') : null
    if (typeof value === 'object') return null
    return String(value)
  }

  const exactMatch = entries.find((entry) => {
    const keyNorm = clean(entry.key)
    const pathNorm = clean(entry.path)
    return normalizedAliases.some((alias) => keyNorm === alias || pathNorm === alias)
  })
  if (exactMatch) return formatVal(exactMatch.value)

  const fuzzyMatch = entries.find((entry) => {
    const keyNorm = clean(entry.key)
    const pathNorm = clean(entry.path)
    return normalizedAliases.some(
      (alias) => keyNorm.includes(alias) || pathNorm.includes(alias)
    )
  })
  if (fuzzyMatch) return formatVal(fuzzyMatch.value)

  return null
}
