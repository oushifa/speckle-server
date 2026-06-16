import { ProjectEvents } from '@/modules/core/domain/projects/events'
import { generateProjectName } from '@/modules/core/domain/projects/logic'
import type {
  CreateProject,
  DeleteProject,
  DeleteProjectAndCommits,
  QueryAllProjects,
  StoreProject,
  StoreProjectRole
} from '@/modules/core/domain/projects/operations'
import type {
  Project,
  StreamWithOptionalRole
} from '@/modules/core/domain/streams/types'
import { ProjectQueryError } from '@/modules/core/errors/projects'
import { ProjectVisibility } from '@/modules/core/graph/generated/graphql'
import { mapGqlToDbProjectVisibility } from '@/modules/core/helpers/project'
import type { EventBusEmit } from '@/modules/shared/services/eventBus'
import { Roles } from '@speckle/shared'
import cryptoRandomString from 'crypto-random-string'
import type { GetExplicitProjects } from '@/modules/core/domain/streams/operations'
import type { DeleteProjectCommits } from '@/modules/core/domain/commits/operations'

export const createNewProjectFactory =
  ({
    storeProject,
    storeProjectRole,
    emitEvent
  }: {
    storeProject: StoreProject
    storeProjectRole: StoreProjectRole
    emitEvent: EventBusEmit
  }): CreateProject =>
  async ({
    description,
    name,
    regionKey,
    visibility,
    workspaceId,
    ownerId,
    address,
    timeZone,
    responsible,
    status,
    progress,
    startDate,
    endDate,
    projectNumber,
    contractCode,
    contractName,
    employer,
    contractor,
    constructionUnit,
    supervisionUnit
  }) => {
    visibility =
      visibility ||
      (workspaceId ? ProjectVisibility.Workspace : ProjectVisibility.Private)

    const project: Project = {
      id: cryptoRandomString({ length: 10 }),
      address: address || '',
      progress: progress || 0,
      startDate: startDate || null,
      endDate: endDate || null,
      timeZone: timeZone || null,
      responsible: responsible || null,
      status: status || null,
      projectNumber: projectNumber || null,
      contractCode: contractCode || null,
      contractName: contractName || null,
      employer: employer || null,
      contractor: contractor || null,
      constructionUnit: constructionUnit || null,
      supervisionUnit: supervisionUnit || null,
      name: name || generateProjectName(),
      description: description || '',
      visibility: mapGqlToDbProjectVisibility(visibility),
      createdAt: new Date(),
      clonedFrom: null,
      updatedAt: new Date(),
      workspaceId: workspaceId || null,
      regionKey: regionKey || null,
      allowPublicComments: false
    }

    await storeProject({ project })
    const projectId = project.id

    await storeProjectRole({ projectId, userId: ownerId, role: Roles.Stream.Owner })

    await emitEvent({
      eventName: ProjectEvents.Created,
      payload: {
        project,
        ownerId,
        input: {
          description: project.description,
          name: project.name,
          visibility
        }
      }
    })

    await emitEvent({
      eventName: ProjectEvents.PermissionsAdded,
      payload: {
        project,
        activityUserId: ownerId,
        targetUserId: ownerId,
        role: Roles.Stream.Owner,
        previousRole: null
      }
    })
    return project
  }

export const queryAllProjectsFactory = ({
  getExplicitProjects
}: {
  getExplicitProjects: GetExplicitProjects
}): QueryAllProjects =>
  async function* queryAllWorkspaceProjects({
    userId,
    workspaceId
  }): AsyncGenerator<StreamWithOptionalRole[], void, unknown> {
    let currentCursor: string | null = null
    let iterationCount = 0

    if (!userId && !workspaceId)
      throw new ProjectQueryError('No user or workspace ID provided')

    do {
      if (iterationCount > 500) throw new ProjectQueryError('Too many iterations')

      const { items, cursor } = await getExplicitProjects({
        cursor: currentCursor,
        limit: 100,
        filter: {
          workspaceId,
          userId
        }
      })

      yield items

      currentCursor = cursor
      iterationCount++
    } while (!!currentCursor)
  }

export const deleteProjectAndCommitsFactory =
  (deps: {
    deleteProject: DeleteProject
    deleteProjectCommits: DeleteProjectCommits
  }): DeleteProjectAndCommits =>
  async (project) => {
    await deps.deleteProjectCommits(project)
    await deps.deleteProject(project)
  }
