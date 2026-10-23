import crs from 'crypto-random-string'
import type { Knex } from 'knex'
import { UnifiedWorkSyncRecords } from '@/modules/core/dbSchema'

export const UnifiedWorkSyncStatus = {
  Success: 'SUCCESS',
  Failed: 'FAILED'
} as const

export type UnifiedWorkSyncStatusValue =
  (typeof UnifiedWorkSyncStatus)[keyof typeof UnifiedWorkSyncStatus]

export type UnifiedWorkSyncRecord = {
  id: string
  instanceId: string
  taskId: string
  systemCode: string
  stepIndex: number
  approverId: string | null
  account: string | null
  status: UnifiedWorkSyncStatusValue
  errorType: string | null
  errorMessage: string | null
  errorDetail: Record<string, unknown> | null
  attempts: number
  lastAttemptAt: Date
  createdAt: Date
  updatedAt: Date
}

const jsonValue = (db: Knex, value: unknown) =>
  value === null || value === undefined
    ? null
    : db.raw('?::json', [JSON.stringify(value)])

export const upsertUnifiedWorkSyncRecordFactory =
  (deps: { db: Knex }) =>
  async (params: {
    instanceId: string
    taskId: string
    systemCode: string
    stepIndex: number
    approverId?: string | null
    account?: string | null
    status: UnifiedWorkSyncStatusValue
    errorType?: string | null
    errorMessage?: string | null
    errorDetail?: Record<string, unknown> | null
  }) => {
    const { db } = deps
    const now = new Date()
    const existing = await db<UnifiedWorkSyncRecord>(UnifiedWorkSyncRecords.name)
      .where('taskId', params.taskId)
      .first()

    const payload = {
      instanceId: params.instanceId,
      taskId: params.taskId,
      systemCode: params.systemCode,
      stepIndex: params.stepIndex,
      approverId: params.approverId ?? null,
      account: params.account ?? null,
      status: params.status,
      errorType: params.errorType ?? null,
      errorMessage: params.errorMessage ?? null,
      errorDetail: jsonValue(db, params.errorDetail ?? null),
      lastAttemptAt: now,
      updatedAt: now
    }

    if (existing) {
      await db(UnifiedWorkSyncRecords.name)
        .where('taskId', params.taskId)
        .update({
          ...payload,
          attempts: (existing.attempts || 0) + 1
        })
      return
    }

    await db(UnifiedWorkSyncRecords.name).insert({
      id: crs({ length: 10 }),
      ...payload,
      attempts: 1,
      createdAt: now
    })
  }

/**
 * Latest push state for a single approver's todo on an instance. Used by the
 * frontend badge, which is always rendered from the point of view of the
 * currently logged in approver.
 */
export const getUnifiedWorkSyncRecordForUserFactory =
  (deps: { db: Knex }) => async (params: { instanceId: string; userId: string }) => {
    return (
      (await deps
        .db<UnifiedWorkSyncRecord>(UnifiedWorkSyncRecords.name)
        .where('instanceId', params.instanceId)
        .where('approverId', params.userId)
        .orderBy('updatedAt', 'desc')
        .first()) || null
    )
  }

export const deleteUnifiedWorkSyncRecordFactory =
  (deps: { db: Knex }) => async (params: { taskId: string }) => {
    await deps.db(UnifiedWorkSyncRecords.name).where('taskId', params.taskId).del()
  }
