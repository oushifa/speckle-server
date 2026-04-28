import type { Knex } from 'knex'
import type { ProjectCostSummaryRecord } from '@/modules/core/helpers/types'
import {
  calculateProjectCostSummaryFactory,
  getProjectCostSummaryFactory,
  upsertProjectCostSummaryFactory
} from '@/modules/project-statistics/repositories/projectCostSummaries'

export const recalculateProjectCostSummaryFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<ProjectCostSummaryRecord> => {
    const calculated = await calculateProjectCostSummaryFactory({ db: deps.db })(params)
    return await upsertProjectCostSummaryFactory({ db: deps.db })({
      projectId: params.projectId,
      totalContractAmount: calculated.totalContractAmount,
      completedAmount: calculated.completedAmount,
      currentMonthCompletedAmount: calculated.currentMonthCompletedAmount
    })
  }

export const getOrRecalculateProjectCostSummaryFactory =
  (deps: { db: Knex }) =>
  async (params: { projectId: string }): Promise<ProjectCostSummaryRecord> => {
    const found = await getProjectCostSummaryFactory({ db: deps.db })(params)
    if (found) return found
    return await recalculateProjectCostSummaryFactory({ db: deps.db })(params)
  }
