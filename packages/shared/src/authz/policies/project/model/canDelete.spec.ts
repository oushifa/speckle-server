import { describe, expect, it } from 'vitest'
import { Roles } from '../../../../core/constants.js'
import { getModelFake } from '../../../../tests/fakes.js'
import {
  ModelNotFoundError,
  ReservedModelNotDeletableError,
  ServerNoAccessError,
  ServerNoSessionError
} from '../../../domain/authErrors.js'
import { canDeleteModelPolicy } from './canDelete.js'

const buildSUT = (overrides?: Partial<Parameters<typeof canDeleteModelPolicy>[0]>) =>
  canDeleteModelPolicy({
    getModel: getModelFake({
      id: 'model-id',
      projectId: 'project-id',
      authorId: 'user-id',
      name: 'model-name'
    }),
    getServerRole: async () => Roles.Server.User,
    ...overrides
  })

describe('canDeleteModelPolicy', () => {
  it('returns error if user is not logged in', async () => {
    const sut = buildSUT()

    const result = await sut({
      userId: undefined,
      projectId: 'project-id',
      modelId: 'model-id'
    })
    expect(result).toBeAuthErrorResult({
      code: ServerNoSessionError.code
    })
  })

  it('returns error if user not found', async () => {
    const sut = buildSUT({
      getServerRole: async () => null
    })

    const result = await sut({
      userId: 'user-id',
      projectId: 'project-id',
      modelId: 'model-id'
    })
    expect(result).toBeAuthErrorResult({
      code: ServerNoAccessError.code
    })
  })

  it('returns error if model not found', async () => {
    const sut = buildSUT({
      getModel: async () => null
    })

    const result = await sut({
      userId: 'user-id',
      projectId: 'project-id',
      modelId: 'model-id'
    })
    expect(result).toBeAuthErrorResult({
      code: ModelNotFoundError.code
    })
  })

  it('returns error if model is reserved', async () => {
    const sut = buildSUT({
      getModel: getModelFake({
        id: 'model-id',
        projectId: 'project-id',
        name: 'main',
        authorId: 'user-id'
      })
    })

    const result = await sut({
      userId: 'user-id',
      projectId: 'project-id',
      modelId: 'main'
    })

    expect(result).toBeAuthErrorResult({
      code: ReservedModelNotDeletableError.code
    })
  })

  it('returns error if model is globals', async () => {
    const sut = buildSUT({
      getModel: getModelFake({
        id: 'model-id',
        projectId: 'project-id',
        name: 'globals',
        authorId: 'user-id'
      })
    })

    const result = await sut({
      userId: 'user-id',
      projectId: 'project-id',
      modelId: 'model-id'
    })
    expect(result).toBeAuthErrorResult({
      code: ReservedModelNotDeletableError.code
    })
  })

  it('returns ok for any logged-in server user when model is deletable', async () => {
    const sut = buildSUT({
      getModel: getModelFake({
        id: 'model-id',
        projectId: 'project-id',
        authorId: 'other-user-id',
        name: 'model-name'
      })
    })
    const result = await sut({
      userId: 'user-id',
      projectId: 'project-id',
      modelId: 'model-id'
    })
    expect(result).toBeAuthOKResult()
  })
})
