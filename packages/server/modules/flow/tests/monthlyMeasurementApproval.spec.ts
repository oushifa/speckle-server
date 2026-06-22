import { expect } from 'chai'
import { beforeEachContext } from '@/test/hooks'
import { db } from '@/db/knex'
import { createTestUser } from '@/test/authHelper'
import { createTestStream } from '@/test/speckle-helpers/streamHelper'
import {
  createMonthlyMeasurementFactory,
  insertMonthlyMeasurementItemsFactory
} from '@/modules/quality-acceptance-form/repositories/monthlyMeasurements'
import { getApprovalSubjectHandler } from '@/modules/flow/services/subjectHandlers'
import { createApprovalFlowBindingFactory } from '@/modules/flow/repositories/approvalBindings'
import { buildApolloServer } from '@/app'
import { createAuthedTestContext } from '@/test/graphqlHelper'
import cryptoRandomString from 'crypto-random-string'
import type { ServerAndContext } from '@/test/graphqlHelper'
import type { BasicTestUser } from '@/test/authHelper'
import type { BasicTestStream } from '@/test/speckle-helpers/streamHelper'

const createMeasurement = createMonthlyMeasurementFactory({ db })
const insertMeasurementItems = insertMonthlyMeasurementItemsFactory({ db })

describe('MONTHLY_MEASUREMENT Approval Integration Tests', () => {
  let user: BasicTestUser
  let stream: BasicTestStream
  let measurementId1: string
  let measurementId2: string
  let apollo: ServerAndContext
  let definitionId: string
  let templateId: string

  before(async () => {
    await beforeEachContext()
    
    // Create test user and project
    user = await createTestUser({
      name: 'Flow Tester',
      email: 'flowtester@example.com',
      password: 'strongpassword123',
      id: ''
    })
    
    stream = await createTestStream(
      {
        name: 'Flow Test Project',
        description: 'Test project for monthly measurement approval flow'
      },
      user
    )

    // Setup Apollo server authed context
    apollo = {
      apollo: await buildApolloServer(),
      context: await createAuthedTestContext(user.id)
    }

    // Insert dummy approval flow definition for FK constraints
    definitionId = cryptoRandomString({ length: 10 })
    templateId = cryptoRandomString({ length: 10 })
    await db('approval_flow_definitions').insert({
      id: definitionId,
      templateId,
      projectId: stream.id,
      name: 'Test Definition',
      resourceType: 'FORMS',
      isActive: true,
      version: 1,
      createdBy: user.id
    })

    // Create monthly measurements
    measurementId1 = cryptoRandomString({ length: 10 })
    await createMeasurement({
      id: measurementId1,
      project_id: stream.id,
      unit: 'Engineering Dept',
      code: 'MEAS-001',
      baseDate: '1780000000',
      approveStatus: 'START',
      flowInstanceId: null,
      creator: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    await insertMeasurementItems([
      {
        id: cryptoRandomString({ length: 10 }),
        measurementId: measurementId1,
        boqItemId: 'boq-001',
        boqCode: 'B001',
        boqName: 'Concrete Base',
        boqParentId: null,
        boqDepth: 0,
        isSummaryRow: false,
        sortIndex: 1,
        uom: 'm3',
        pendingTotalQty: 100,
        approvedCumulativeQty: 20,
        measuredQty: 15,
        price: 500,
        remark: 'Initial foundation concrete',
        sourceAcceptanceIds: ['qa-001'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ])

    measurementId2 = cryptoRandomString({ length: 10 })
    await createMeasurement({
      id: measurementId2,
      project_id: stream.id,
      unit: 'Engineering Dept',
      code: 'MEAS-002',
      baseDate: '1780000000',
      approveStatus: 'START',
      flowInstanceId: null,
      creator: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  })

  after(async () => {
    // Delete bindings first to satisfy definition FK constraint
    await db('approval_flow_bindings').where('projectId', stream.id).del()
    if (definitionId) {
      await db('approval_flow_definitions').where('id', definitionId).del()
    }
  })

  it('monthly_measurements subject handler should fetch correct snapshot metadata and items list', async () => {
    const handler = getApprovalSubjectHandler({
      subjectType: 'FORM_RECORD',
      subjectTable: 'monthly_measurements'
    })
    
    const snapshot = await handler.getSubjectSnapshot({
      projectId: stream.id,
      subjectType: 'FORM_RECORD',
      subjectTable: 'monthly_measurements',
      subjectId: measurementId1
    })

    expect(snapshot).to.have.property('measurementId', measurementId1)
    expect(snapshot).to.have.property('unit', 'Engineering Dept')
    expect(snapshot).to.have.property('code', 'MEAS-001')
    expect(snapshot).to.have.property('baseDate', '1780000000')
    expect(snapshot).to.have.property('creator', user.id)

    expect(snapshot).to.have.property('items')
    const items = snapshot.items as any[]
    expect(items).to.have.lengthOf(1)
    expect(items[0]).to.have.property('boqItemId', 'boq-001')
    expect(items[0]).to.have.property('boqCode', 'B001')
    expect(items[0]).to.have.property('boqName', 'Concrete Base')
    expect(items[0]).to.have.property('measuredQty')
    expect(Number(items[0].measuredQty)).to.equal(15)
    expect(items[0]).to.have.property('price')
    expect(Number(items[0].price)).to.equal(500)
  })

  it('should block monthly measurement update mutation when status is IN_REVIEW', async () => {
    // Create an active IN_REVIEW binding
    const createBinding = createApprovalFlowBindingFactory({ db })
    const binding = await createBinding({
      projectId: stream.id,
      subjectType: 'FORM_RECORD',
      subjectId: measurementId1,
      subjectTable: 'monthly_measurements',
      subjectKey: `monthly_measurements:${measurementId1}`,
      definitionId,
      templateId,
      status: 'IN_REVIEW',
      creator: user.id,
      updater: user.id
    })

    // Execute update mutation
    const updateMutation = `
      mutation UpdateMonthlyMeasurement($input: UpdateMonthlyMeasurementInput!) {
        projectMutations {
          monthlyMeasurementMutations {
            update(input: $input) {
              id
              code
            }
          }
        }
      }
    `
    const res = await apollo.apollo.executeOperation(
      {
        query: updateMutation,
        variables: {
          input: {
            projectId: stream.id,
            id: measurementId1,
            code: 'MEAS-001-MODIFIED',
            baseDate: '1780000000'
          }
        }
      },
      { contextValue: apollo.context as any }
    )

    expect(res.body.kind).to.equal('single')
    // @ts-ignore
    const singleResult = res.body.singleResult
    if (singleResult.errors) {
      console.log('Update Error log:', JSON.stringify(singleResult.errors))
    }
    expect(singleResult.errors).to.exist
    expect(singleResult.errors[0].message).to.contain('cannot be edited while approval is in review')

    // Clean up binding
    await db('approval_flow_bindings').where('id', binding.id).del()
  })

  it('should block monthly measurement delete mutation when status is IN_REVIEW', async () => {
    // Create an active IN_REVIEW binding for measurementId2
    const createBinding = createApprovalFlowBindingFactory({ db })
    const binding = await createBinding({
      projectId: stream.id,
      subjectType: 'FORM_RECORD',
      subjectId: measurementId2,
      subjectTable: 'monthly_measurements',
      subjectKey: `monthly_measurements:${measurementId2}`,
      definitionId,
      templateId,
      status: 'IN_REVIEW',
      creator: user.id,
      updater: user.id
    })

    // Execute delete mutation
    const deleteMutation = `
      mutation DeleteMonthlyMeasurement($input: DeleteMonthlyMeasurementInput!) {
        projectMutations {
          monthlyMeasurementMutations {
            delete(input: $input)
          }
        }
      }
    `
    const res = await apollo.apollo.executeOperation(
      {
        query: deleteMutation,
        variables: {
          input: {
            projectId: stream.id,
            id: measurementId2
          }
        }
      },
      { contextValue: apollo.context as any }
    )

    expect(res.body.kind).to.equal('single')
    // @ts-ignore
    const singleResult = res.body.singleResult
    expect(singleResult.errors).to.exist
    expect(singleResult.errors[0].message).to.contain('cannot be deleted while approval is in review')

    // Clean up binding
    await db('approval_flow_bindings').where('id', binding.id).del()
  })

  it('should allow update and delete mutations when monthly measurement is not in review', async () => {
    // Attempt update
    const updateMutation = `
      mutation UpdateMonthlyMeasurement($input: UpdateMonthlyMeasurementInput!) {
        projectMutations {
          monthlyMeasurementMutations {
            update(input: $input) {
              id
              code
            }
          }
        }
      }
    `
    const resUpdate = await apollo.apollo.executeOperation(
      {
        query: updateMutation,
        variables: {
          input: {
            projectId: stream.id,
            id: measurementId1,
            code: 'MEAS-001-OK',
            baseDate: '1780000000'
          }
        }
      },
      { contextValue: apollo.context as any }
    )
    expect(resUpdate.body.kind).to.equal('single')
    // @ts-ignore
    const singleResultUpdate = resUpdate.body.singleResult
    if (singleResultUpdate.errors) {
      console.log('Allow Update Errors:', JSON.stringify(singleResultUpdate.errors))
    }
    expect(singleResultUpdate.errors).to.not.exist

    // Attempt delete
    const deleteMutation = `
      mutation DeleteMonthlyMeasurement($input: DeleteMonthlyMeasurementInput!) {
        projectMutations {
          monthlyMeasurementMutations {
            delete(input: $input)
          }
        }
      }
    `
    const resDelete = await apollo.apollo.executeOperation(
      {
        query: deleteMutation,
        variables: {
          input: {
            projectId: stream.id,
            id: measurementId1
          }
        }
      },
      { contextValue: apollo.context as any }
    )
    expect(resDelete.body.kind).to.equal('single')
    // @ts-ignore
    const singleResultDelete = resDelete.body.singleResult
    expect(singleResultDelete.errors).to.not.exist
  })
})
