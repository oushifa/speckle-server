import { expect } from 'chai'
import { buildModelCustomLabelPayload } from '@/modules/core/services/modelCustomLabelExport'

describe('Model custom label export', () => {
  it('uses applicationId as the exported element id', () => {
    const payload = buildModelCustomLabelPayload({
      modelSeedId: 'seed-123',
      modelName: 'Test Model',
      versionCreatedAt: '2026-05-18T00:00:00.000Z',
      rootId: 'root-1',
      objectMap: new Map([
        [
          'root-1',
          {
            id: 'root-1',
            childrenIds: ['child-1'],
            raw: {
              elements: [{ referencedId: 'child-1' }]
            }
          }
        ],
        [
          'child-1',
          {
            id: 'child-1',
            childrenIds: [],
            raw: {
              applicationId: 'app-001',
              originalId: 'orig-001',
              parameters: {
                Name: 'Wall A'
              }
            }
          }
        ]
      ])
    })

    expect(payload.model.id).to.eq('seed-123')
    expect(payload.elements).to.deep.equal([
      {
        id: 'app-001',
        parameters: {
          Name: 'Wall A'
        }
      }
    ])
  })

  it('skips objects whose applicationId is just the Speckle object id', () => {
    const payload = buildModelCustomLabelPayload({
      modelSeedId: 'seed-123',
      modelName: 'Test Model',
      versionCreatedAt: '2026-05-18T00:00:00.000Z',
      rootId: 'root-1',
      objectMap: new Map([
        [
          'root-1',
          {
            id: 'root-1',
            childrenIds: ['site-1', 'wall-1'],
            raw: {
              elements: [{ referencedId: 'site-1' }, { referencedId: 'wall-1' }]
            }
          }
        ],
        [
          'site-1',
          {
            id: 'site-1',
            childrenIds: [],
            raw: {
              applicationId: 'site-1',
              parameters: {
                Type: 'IfcSite'
              }
            }
          }
        ],
        [
          'wall-1',
          {
            id: 'wall-1',
            childrenIds: [],
            raw: {
              applicationId: 'biz-wall-001',
              parameters: {
                Name: 'Wall A'
              }
            }
          }
        ]
      ])
    })

    expect(payload.elements).to.deep.equal([
      {
        id: 'biz-wall-001',
        parameters: {
          Name: 'Wall A'
        }
      }
    ])
  })
})
