import type { Knex } from 'knex'
import { createStreamFactory, getStreamFactory } from '@/modules/core/repositories/streams'
import { createBranchFactory } from '@/modules/core/repositories/branches'
import { DRAWINGS_PROJECT } from '@/modules/core/drawings/constants'
import { Streams } from '@/modules/core/dbSchema'

export const ensureDrawingsProjectFactory =
  (deps: { db: Knex }) => async () => {
    const getStream = getStreamFactory(deps)
    const createStream = createStreamFactory(deps)
    const createBranch = createBranchFactory(deps)

    const existing = await getStream({ streamId: DRAWINGS_PROJECT.id })
    if (!existing) {
      await createStream({
        id: DRAWINGS_PROJECT.id,
        name: DRAWINGS_PROJECT.name,
        description: '',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        allowPublicComments: false
      })
    }

    await deps
      .db(Streams.name)
      .where(Streams.col.id, DRAWINGS_PROJECT.id)
      .andWhereNot(Streams.col.type, 'library')
      .update({ [Streams.withoutTablePrefix.col.type]: 'library' })
  }
