import { expect } from 'chai'
import { beforeEachContext } from '@/test/hooks'
import { db } from '@/db/knex'
import { createTestUser } from '@/test/authHelper'
import { createTestStream } from '@/test/speckle-helpers/streamHelper'
import { normalizeCategory } from '@/modules/flow/helpers/category'
import {
  getActiveApprovalFlowByCategoryFactory,
  getApprovalFlowDefinitionsByTemplateFactory,
  setApprovalFlowDefinitionActiveStateFactory
} from '@/modules/flow/repositories/approvalFlows'
import {
  createApprovalFlowDefinitionWithStepsFactory
} from '@/modules/flow/services/approvalFlows'
import type { BasicTestUser } from '@/test/authHelper'
import type { BasicTestStream } from '@/test/speckle-helpers/streamHelper'
import cryptoRandomString from 'crypto-random-string'

const createDefinitionWithSteps = createApprovalFlowDefinitionWithStepsFactory({ db })
const getActiveFlowByCategory = getActiveApprovalFlowByCategoryFactory({ db })
const getDefinitionsByTemplate = getApprovalFlowDefinitionsByTemplateFactory({ db })
const setFlowActiveState = setApprovalFlowDefinitionActiveStateFactory({ db })

describe('Approval Flow Category and Version Management Tests', () => {
  let user: BasicTestUser
  let stream: BasicTestStream

  before(async () => {
    await beforeEachContext()
    
    user = await createTestUser({
      name: 'Category Tester',
      email: 'categorytester@example.com',
      password: 'password123',
      id: ''
    })
    
    stream = await createTestStream(
      {
        name: 'Category Version Test Project',
        description: 'Test project for categories and versions'
      },
      user
    )
  })

  after(async () => {
    // Cleanup definitions and steps in the stream
    const definitions = await db('approval_flow_definitions').where('projectId', stream.id)
    const definitionIds = definitions.map(d => d.id)
    if (definitionIds.length) {
      await db('approval_flow_definition_steps').whereIn('definitionId', definitionIds).del()
      await db('approval_flow_definitions').whereIn('id', definitionIds).del()
    }
  })

  describe('normalizeCategory Helper', () => {
    it('should correctly normalize category values', () => {
      expect(normalizeCategory('MODEL_REVIEW')).to.equal('MODEL_REVIEW')
      expect(normalizeCategory('模型审核')).to.equal('MODEL_REVIEW')
      expect(normalizeCategory('模型')).to.equal('MODEL_REVIEW')
      expect(normalizeCategory('模型管理')).to.equal('MODEL_REVIEW')

      expect(normalizeCategory('MONTHLY_INSPECTION')).to.equal('MONTHLY_INSPECTION')
      expect(normalizeCategory('月度验工')).to.equal('MONTHLY_INSPECTION')
      expect(normalizeCategory('表单')).to.equal('MONTHLY_INSPECTION')
      expect(normalizeCategory('质量验收')).to.equal('MONTHLY_INSPECTION')
      expect(normalizeCategory('验工计价')).to.equal('MONTHLY_INSPECTION')

      // Fallback
      expect(normalizeCategory(undefined)).to.equal('MONTHLY_INSPECTION')
      expect(normalizeCategory('')).to.equal('MONTHLY_INSPECTION')
      expect(normalizeCategory('invalid_val')).to.equal('MONTHLY_INSPECTION')
    })
  })

  describe('Category Version & Active Toggle Logic', () => {
    it('should support multiple versions of a flow under the same category', async () => {
      const templateId = cryptoRandomString({ length: 10 })

      // 1. Create version 1 (V1)
      const flowV1 = await createDefinitionWithSteps({
        templateId,
        projectId: stream.id,
        name: 'Model Review Flow V1',
        resourceType: 'MODEL',
        isActive: true,
        triggerConfig: { category: 'MODEL_REVIEW' },
        steps: [{ name: 'Step 1', approverIds: [user.id] }],
        createdBy: user.id
      })

      expect(flowV1).to.exist
      expect(flowV1.version).to.equal(1)
      expect(flowV1.isActive).to.be.true

      // 2. Query active flow for MODEL_REVIEW, should get V1
      const active1 = await getActiveFlowByCategory({
        projectId: stream.id,
        category: 'MODEL_REVIEW'
      })
      expect(active1).to.exist
      expect(active1!.id).to.equal(flowV1.id)

      // 3. Create version 2 (V2) under the same templateId (reusing templateId simulates new version saving)
      const flowV2 = await createDefinitionWithSteps({
        templateId,
        projectId: stream.id,
        name: 'Model Review Flow V2',
        resourceType: 'MODEL',
        isActive: true, // We want to active V2
        previousVersionId: flowV1.id,
        triggerConfig: { category: 'MODEL_REVIEW' },
        steps: [{ name: 'Step 1', approverIds: [user.id] }, { name: 'Step 2', approverIds: [user.id] }],
        createdBy: user.id
      })


      expect(flowV2).to.exist
      expect(flowV2.version).to.equal(2)
      expect(flowV2.isActive).to.be.true

      // 4. Manually set V2 as active to see if it deactivates V1 (simulating toggle logic)
      await setFlowActiveState({
        definitionId: flowV2.id,
        isActive: true
      })

      // 5. Query V1 and V2 states from DB
      const allVersions = await getDefinitionsByTemplate(templateId)
      expect(allVersions).to.have.lengthOf(2)
      
      const updatedV1 = allVersions.find(v => v.id === flowV1.id)
      const updatedV2 = allVersions.find(v => v.id === flowV2.id)

      expect(updatedV1!.isActive).to.be.false
      expect(updatedV2!.isActive).to.be.true

      // 6. Test querying active flow by category again, should yield V2
      const active2 = await getActiveFlowByCategory({
        projectId: stream.id,
        category: 'MODEL_REVIEW'
      })
      expect(active2).to.exist
      expect(active2!.id).to.equal(flowV2.id)

      // 7. Toggle V1 back to active
      await setFlowActiveState({
        definitionId: flowV1.id,
        isActive: true
      })

      const finalVersions = await getDefinitionsByTemplate(templateId)
      const finalV1 = finalVersions.find(v => v.id === flowV1.id)
      const finalV2 = finalVersions.find(v => v.id === flowV2.id)

      expect(finalV1!.isActive).to.be.true
      expect(finalV2!.isActive).to.be.false

      // 8. Active flow by category should now be V1 again
      const active3 = await getActiveFlowByCategory({
        projectId: stream.id,
        category: '模型审核' // Test passing chinese name
      })
      expect(active3).to.exist
      expect(active3!.id).to.equal(flowV1.id)
    })
  })
})
