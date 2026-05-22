import { db } from '@/db/knex'
import { createTokenFactory } from '@/modules/core/services/tokens'
import {
  storeApiTokenFactory,
  storeTokenResourceAccessDefinitionsFactory,
  storeTokenScopesFactory
} from '@/modules/core/repositories/tokens'
import { TokenResourceIdentifierType } from '@/modules/core/domain/tokens/types'
import { Scopes } from '@speckle/shared'

const TokenLifetimeMs = 24 * 60 * 60 * 1000

export const createRvtConversionDelegatedToken = async (params: {
  userId: string
  projectId: string
  modelId: string
  jobId: string
}) => {
  const createToken = createTokenFactory({
    storeApiToken: storeApiTokenFactory({ db }),
    storeTokenScopes: storeTokenScopesFactory({ db }),
    storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory({
      db
    })
  })

  return await createToken({
    userId: params.userId,
    name: `rvt-conversion-${params.projectId}@${params.modelId}-${params.jobId}`,
    scopes: [
      Scopes.Streams.Read,
      Scopes.Streams.Write,
      Scopes.Profile.Read,
      Scopes.Profile.Email
    ],
    lifespan: TokenLifetimeMs,
    limitResources: [
      {
        id: params.projectId,
        type: TokenResourceIdentifierType.Project
      }
    ]
  })
}
