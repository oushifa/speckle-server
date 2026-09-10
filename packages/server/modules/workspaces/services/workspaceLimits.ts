import type { QueryAllProjects } from '@/modules/core/domain/projects/operations'
import type { GetWorkspaceModelCount } from '@/modules/workspaces/domain/operations'

export const getWorkspaceModelCountFactory =
  (deps: {
    queryAllProjects: QueryAllProjects
    /**
     * Batched: resolves the model count of many projects at once, so the caller can do one
     * query per regional db instead of one query per project.
     */
    getProjectModelsCounts: (
      projectIds: string[]
    ) => Promise<{ streamId: string; count: number }[]>
  }): GetWorkspaceModelCount =>
  async ({ workspaceId }) => {
    const projectIds: string[] = []

    for await (const projects of deps.queryAllProjects({ workspaceId })) {
      for (const project of projects) {
        projectIds.push(project.id)
      }
    }

    if (!projectIds.length) return 0

    const counts = await deps.getProjectModelsCounts(projectIds)
    return counts.reduce((acc, curr) => acc + curr.count, 0)
  }
