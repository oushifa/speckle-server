import type { Knex } from 'knex'
import type { EventBusEmit } from '@/modules/shared/services/eventBus'
import type { BranchRecord } from '@/modules/core/helpers/types'
import { ProjectRecordVisibility } from '@/modules/core/helpers/types'
import {
  MODEL_LIBRARY_PROJECT_ID,
  MODEL_LIBRARY_PROJECT_NAME,
  PROJECT_USAGES
} from '@/modules/core/constants/modelLibrary'
import {
  getProjectFactory,
  storeProjectFactory
} from '@/modules/core/repositories/projects'
import { updateStreamFactory } from '@/modules/core/repositories/streams'
import {
  createBranchFactory,
  getStreamBranchByNameFactory
} from '@/modules/core/repositories/branches'
import { createBranchAndNotifyFactory } from '@/modules/core/services/branch/management'

export const ensureModelLibraryProjectFactory =
  ({ db }: { db: Knex }) =>
  async () => {
    const getProject = getProjectFactory({ db })
    const storeProject = storeProjectFactory({ db })
    const updateStream = updateStreamFactory({ db })
    const systemDescription = 'System managed project for model storage.'

    const existingProject = await getProject({ projectId: MODEL_LIBRARY_PROJECT_ID })
    if (existingProject) {
      const needsUpdate =
        existingProject.usage !== PROJECT_USAGES.StorageOnly ||
        existingProject.name !== MODEL_LIBRARY_PROJECT_NAME ||
        existingProject.description !== systemDescription ||
        existingProject.visibility !== ProjectRecordVisibility.Private

      if (!needsUpdate) return existingProject

      await updateStream({
        id: MODEL_LIBRARY_PROJECT_ID,
        name: MODEL_LIBRARY_PROJECT_NAME,
        description: systemDescription,
        visibility: 'PRIVATE',
        usage: PROJECT_USAGES.StorageOnly
      })

      return await getProject({ projectId: MODEL_LIBRARY_PROJECT_ID })
    }

    const now = new Date()
    await storeProject({
      project: {
        id: MODEL_LIBRARY_PROJECT_ID,
        name: MODEL_LIBRARY_PROJECT_NAME,
        address: null,
        progress: null,
        startDate: null,
        endDate: null,
        responsible: null,
        status: null,
        timeZone: null,
        description: systemDescription,
        clonedFrom: null,
        createdAt: now,
        updatedAt: now,
        allowPublicComments: false,
        workspaceId: null,
        regionKey: null,
        visibility: ProjectRecordVisibility.Private,
        usage: PROJECT_USAGES.StorageOnly
      }
    })

    return await getProject({ projectId: MODEL_LIBRARY_PROJECT_ID })
  }

export const ensureModelLibraryModelFactory =
  ({ db, eventEmit }: { db: Knex; eventEmit: EventBusEmit }) =>
  async (params: { name: string; description?: string | null; userId: string }) => {
    const normalizedName = params.name
      .split('/')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .join('/')
      .toLowerCase()

    if (!normalizedName.length) {
      throw new Error('Model name is required')
    }

    const getStreamBranchByName = getStreamBranchByNameFactory({ db })
    const existingModel = await getStreamBranchByName(
      MODEL_LIBRARY_PROJECT_ID,
      normalizedName
    )
    if (existingModel) return existingModel

    const createBranchAndNotify = createBranchAndNotifyFactory({
      getStreamBranchByName,
      createBranch: createBranchFactory({ db }),
      eventEmit
    })

    return (await createBranchAndNotify(
      {
        projectId: MODEL_LIBRARY_PROJECT_ID,
        name: normalizedName,
        description: params.description ?? null
      },
      params.userId
    )) as BranchRecord
  }
