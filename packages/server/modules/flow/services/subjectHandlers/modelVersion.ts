import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { getCommitFactory } from '@/modules/core/repositories/commits'
import { BadRequestError, NotFoundError } from '@/modules/shared/errors'
import type {
  ApprovalSubjectDescriptor,
  ApprovalSubjectHandler,
  ApprovalSubjectSnapshot
} from '@/modules/flow/services/subjectHandlers/types'

const assertModelVersionSubject = (params: ApprovalSubjectDescriptor) => {
  if (params.subjectType !== 'MODEL_VERSION') {
    throw new BadRequestError('Model version handler only supports MODEL_VERSION')
  }
}

const getModelVersion = async (params: ApprovalSubjectDescriptor) => {
  assertModelVersionSubject(params)
  const projectDb = await getProjectDbClient({ projectId: params.projectId })
  const getCommit = getCommitFactory({ db: projectDb })
  const commit = await getCommit(params.subjectId, { streamId: params.projectId })
  if (!commit) {
    throw new NotFoundError('Model version not found')
  }
  return { commit, projectDb }
}

export const modelVersionApprovalSubjectHandler: ApprovalSubjectHandler = {
  async getSubjectSnapshot(
    params: ApprovalSubjectDescriptor
  ): Promise<ApprovalSubjectSnapshot> {
    const { commit, projectDb } = await getModelVersion(params)

    let versionNumber = 1
    if (commit.branchId) {
      const result = await projectDb('branch_commits')
        .innerJoin('commits', 'commits.id', 'branch_commits.commitId')
        .where('branch_commits.branchId', commit.branchId)
        .andWhere('commits.createdAt', '<=', commit.createdAt)
        .count<{ count: string | number }>('commits.id as count')
        .first()
      const countVal = result?.count
      versionNumber = countVal ? parseInt(countVal.toString(), 10) : 1
    }

    return {
      versionId: commit.id,
      modelId: commit.branchId || null,
      modelName: commit.branchName || null,
      branchId: commit.branchId || null,
      versionNumber,
      commitId: commit.id,
      createdAt:
        commit.createdAt instanceof Date ? commit.createdAt.toISOString() : commit.createdAt,
      createdBy: commit.author || null,
      message: commit.message || null,
      sourceApplication: commit.sourceApplication || null,
      referencedObject: commit.referencedObject || null
    }
  },
  async canSubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getModelVersion(params)
  },
  async canResubmit(params: ApprovalSubjectDescriptor): Promise<void> {
    await getModelVersion(params)
  },
  async canEditWhenReturned(params: ApprovalSubjectDescriptor): Promise<void> {
    await getModelVersion(params)
  }
}
