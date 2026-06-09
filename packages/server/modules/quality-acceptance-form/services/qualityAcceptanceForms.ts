import type { Knex } from 'knex'
import cryptoRandomString from 'crypto-random-string'
import { getBoqItemFactory } from '@/modules/bop-item/repositories/boq'
import { getApprovalFlowDefinitionByIdFactory } from '@/modules/flow/repositories/approvalFlows'
import { startApprovalFlowFactory } from '@/modules/flow/services/approvalFlows'
import {
  createQualityAcceptanceFormFactory,
  deleteQualityAcceptanceFormFactory
} from '@/modules/quality-acceptance-form/repositories/qualityAcceptanceForms'
import type { BimElementEntry, BIM } from '@/modules/quality-acceptance-form/helpers/types'
import { BadRequestError } from '@/modules/shared/errors'

export const QUALITY_ACCEPTANCE_FORM_TABLE = 'quality_acceptance_forms'

export type CreateQualityAcceptanceFormInput = {
  projectId: string
  flowId?: string | null
  name?: string | null
  boqItemId?: string | null
  code?: string | null
  inspectionLotNumber?: string | null
  acceptancePart?: string | null
  acceptanceContent?: string | null
  actualStartDate?: string | number | null
  actualFinishDate?: string | number | null
  inspector?: string | null
  attachments?: string[] | null
  workVolume?: number | null
  unit?: string | null
  BIM?: BIM | null
  BIMelement?: string[] | null
  timeZone?: string | null
  approveStatus?: string | number | null
}

export type ImportQualityAcceptanceFormItem = Omit<
  CreateQualityAcceptanceFormInput,
  'projectId'
> & {
  rowNumber: number
}

export type ImportQualityAcceptanceFormResult = {
  createdCount: number
  failedCount: number
  createdItems: Array<{
    rowNumber: number
    id: string
    boqItemId: string | null
    code: string | null
    inspectionLotNumber: string | null
  }>
  failedRows: Array<{
    rowNumber: number
    error: string
  }>
}

const normalizeOptionalString = (value?: string | null) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const normalizeOptionalDateValue = (
  value?: string | number | null
): string | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return String(value)
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const normalizeAttachments = (attachments?: string[] | null) => {
  if (!Array.isArray(attachments) || !attachments.length) return null

  const normalized = Array.from(
    new Set(
      attachments
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )

  return normalized.length ? normalized : null
}

export const normalizeApproveStatus = (status?: string | number | null) =>
  status === null || status === undefined ? null : String(status)

export const normalizeBIM = (
  bim?: BIM | null,
  legacyBimElement?: string[] | null
): BIM | null => {
  if (Array.isArray(bim) && bim.length > 0) {
    const normalized = bim
      .map((entry): BimElementEntry | null => {
        const modelId = typeof entry.modelId === 'string' ? entry.modelId.trim() : ''
        if (!modelId) return null
        const applicationIds = Array.isArray(entry.applicationIds)
          ? entry.applicationIds.filter((id): id is string => typeof id === 'string' && !!id.trim())
          : []
        // bimIds 与 applicationIds 对齐，长度不足时补 null
        const rawBimIds = Array.isArray(entry.bimIds) ? entry.bimIds : []
        const bimIds: (string | null)[] = applicationIds.map((_, idx) => {
          const raw = rawBimIds[idx]
          return typeof raw === 'string' && raw.trim() ? raw.trim() : null
        })
        return { modelId, applicationIds, bimIds }
      })
      .filter((e): e is BimElementEntry => e !== null && e.applicationIds.length > 0)

    if (normalized.length > 0) return normalized
  }

  // 兼容旧 BIMelement 字段（字符串数组），但不再支持单独的 modelId 格式
  if (Array.isArray(legacyBimElement) && legacyBimElement.length > 0) {
    const ids = legacyBimElement.filter((id): id is string => typeof id === 'string' && !!id.trim())
    if (ids.length > 0) {
      return [{ modelId: '', applicationIds: ids, bimIds: ids.map(() => null) }]
    }
  }

  return null
}

export const createQualityAcceptanceFormEntryFactory =
  (deps: { db: Knex; projectDb: Knex }) =>
  async (params: {
    input: CreateQualityAcceptanceFormInput
    actorUserId?: string | null
    creator?: string | null
  }) => {
    const projectId = normalizeOptionalString(params.input.projectId)
    if (!projectId) throw new BadRequestError('Project ID is required.')

    const flowId = normalizeOptionalString(params.input.flowId)
    if (flowId && !params.actorUserId) {
      throw new BadRequestError('flowId requires an authenticated user.')
    }

    const boqItemId = normalizeOptionalString(params.input.boqItemId)
    const getBoqItem = getBoqItemFactory({ db: deps.projectDb })
    const boqItem = boqItemId
      ? await getBoqItem({
          projectId,
          id: boqItemId
        })
      : null

    if (boqItemId && !boqItem) {
      throw new BadRequestError(`BOQ item ${boqItemId} not found in project.`)
    }

    const now = new Date()
    const createQualityAcceptanceForm = createQualityAcceptanceFormFactory({
      db: deps.projectDb
    })
    const deleteQualityAcceptanceForm = deleteQualityAcceptanceFormFactory({
      db: deps.projectDb
    })

    const created = await createQualityAcceptanceForm({
      id: cryptoRandomString({ length: 10 }),
      name: normalizeOptionalString(params.input.name) ?? boqItem?.name ?? null,
      boqItemId,
      code: normalizeOptionalString(params.input.code) ?? boqItem?.code ?? null,
      inspectionLotNumber: normalizeOptionalString(params.input.inspectionLotNumber),
      acceptancePart: normalizeOptionalString(params.input.acceptancePart),
      acceptanceContent: normalizeOptionalString(params.input.acceptanceContent),
      actualStartDate: normalizeOptionalDateValue(params.input.actualStartDate),
      actualFinishDate: normalizeOptionalDateValue(params.input.actualFinishDate),
      inspector: normalizeOptionalString(params.input.inspector),
      attachments: normalizeAttachments(params.input.attachments),
      creator: params.creator ?? params.actorUserId ?? null,
      ['project_id']: projectId,
      workVolume:
        params.input.workVolume === null || params.input.workVolume === undefined
          ? null
          : params.input.workVolume,
      unit: normalizeOptionalString(params.input.unit) ?? boqItem?.unit ?? null,
      BIM: normalizeBIM(
        params.input.BIM ?? null,
        params.input.BIMelement ?? null
      ),
      timeZone: normalizeOptionalString(params.input.timeZone),
      approveStatus: normalizeApproveStatus(params.input.approveStatus),
      createdAt: now,
      updatedAt: now
    })

    if (flowId) {
      const definition = await getApprovalFlowDefinitionByIdFactory({ db: deps.db })(flowId)
      if (!definition || !definition.isActive || definition.resourceType !== 'FORMS') {
        throw new BadRequestError('No active FORMS flow definition found for this form.')
      }

      try {
        await startApprovalFlowFactory({ db: deps.db })({
          definitionId: flowId,
          projectId,
          resourceId: `${QUALITY_ACCEPTANCE_FORM_TABLE}:${created.id}`,
          formData: {
            formTable: QUALITY_ACCEPTANCE_FORM_TABLE,
            formId: created.id,
            projectId
          },
          userId: params.actorUserId!
        })
      } catch (e) {
        await deleteQualityAcceptanceForm(created.id)
        throw e
      }
    }

    return created
  }

export const importQualityAcceptanceFormsFactory =
  (deps: { db: Knex; projectDb: Knex }) =>
  async (params: {
    projectId: string
    items: ImportQualityAcceptanceFormItem[]
    actorUserId?: string | null
    creator?: string | null
  }): Promise<ImportQualityAcceptanceFormResult> => {
    const createQualityAcceptanceFormEntry = createQualityAcceptanceFormEntryFactory(deps)
    let createdCount = 0
    const createdItems: ImportQualityAcceptanceFormResult['createdItems'] = []
    const failedRows: ImportQualityAcceptanceFormResult['failedRows'] = []

    for (const item of params.items) {
      try {
        const created = await createQualityAcceptanceFormEntry({
          input: {
            ...item,
            projectId: params.projectId
          },
          actorUserId: params.actorUserId,
          creator: params.creator
        })

        createdCount += 1
        createdItems.push({
          rowNumber: item.rowNumber,
          id: created.id,
          boqItemId: created.boqItemId || null,
          code: created.code || null,
          inspectionLotNumber: created.inspectionLotNumber || null
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failedRows.push({
          rowNumber: item.rowNumber,
          error: message
        })
      }
    }

    return {
      createdCount,
      failedCount: failedRows.length,
      createdItems,
      failedRows
    }
  }
