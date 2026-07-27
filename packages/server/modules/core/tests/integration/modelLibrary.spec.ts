import { expect } from 'chai'
import { db } from '@/db/knex'
import { Roles } from '@speckle/shared'
import type { BasicTestUser } from '@/test/authHelper'
import { createTestUser } from '@/test/authHelper'
import { beforeEachContext } from '@/test/hooks'
import {
  getStreamFactory,
  grantStreamPermissionsFactory
} from '@/modules/core/repositories/streams'
import {
  ensureModelLibraryModelFactory,
  ensureModelLibraryProjectAccessFactory
} from '@/modules/core/services/streams/modelLibrary'
import { MODEL_LIBRARY_PROJECT_ID } from '@/modules/core/constants/modelLibrary'
import { getEventBus } from '@/modules/shared/services/eventBus'

describe('Model library project access', () => {
  const getStream = getStreamFactory({ db })
  const grantStreamPermissions = grantStreamPermissionsFactory({ db })
  const ensureModelLibraryProjectAccess = ensureModelLibraryProjectAccessFactory({ db })
  const ensureModelLibraryModel = ensureModelLibraryModelFactory({
    db,
    eventEmit: getEventBus().emit
  })

  beforeEach(async () => {
    await beforeEachContext()
  })

  it('grants contributors access to users preparing model library uploads', async () => {
    const user: BasicTestUser = {
      name: 'model library uploader',
      email: '',
      id: ''
    }
    await createTestUser(user)

    const beforeAccess = await getStream({
      streamId: MODEL_LIBRARY_PROJECT_ID,
      userId: user.id
    })
    expect(beforeAccess?.role).to.not.equal(Roles.Stream.Contributor)

    const project = await ensureModelLibraryProjectAccess({ userId: user.id })

    expect(project?.role).to.equal(Roles.Stream.Contributor)
  })

  it('upgrades existing reviewers so file imports can write versions', async () => {
    const user: BasicTestUser = {
      name: 'model library reviewer',
      email: '',
      id: ''
    }
    await createTestUser(user)

    await ensureModelLibraryProjectAccess({ userId: user.id })
    await grantStreamPermissions({
      streamId: MODEL_LIBRARY_PROJECT_ID,
      userId: user.id,
      role: Roles.Stream.Reviewer
    })

    const project = await ensureModelLibraryProjectAccess({ userId: user.id })

    expect(project?.role).to.equal(Roles.Stream.Contributor)
  })

  it('ensures project access while creating or reusing a model', async () => {
    const user: BasicTestUser = {
      name: 'model library model creator',
      email: '',
      id: ''
    }
    await createTestUser(user)

    await ensureModelLibraryModel({
      name: 'Architecture/IFC',
      userId: user.id
    })

    const project = await getStream({
      streamId: MODEL_LIBRARY_PROJECT_ID,
      userId: user.id
    })

    expect(project?.role).to.equal(Roles.Stream.Contributor)
  })
})
