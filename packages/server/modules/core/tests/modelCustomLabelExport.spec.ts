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

  it('prefers elementId for .rvt models', () => {
    const payload = buildModelCustomLabelPayload({
      modelSeedId: 'seed-rvt',
      modelName: 'school.rvt',
      versionCreatedAt: '2026-05-18T00:00:00.000Z',
      rootId: 'root-1',
      objectMap: new Map([
        [
          'root-1',
          {
            id: 'root-1',
            childrenIds: ['wall-1', 'wall-2'],
            raw: {
              elements: [{ referencedId: 'wall-1' }, { referencedId: 'wall-2' }]
            }
          }
        ],
        [
          'wall-1',
          {
            id: 'wall-1',
            childrenIds: [],
            raw: {
              applicationId: 'a72d6cd0-434a-4b6f-a2a2-7266a0224d8e-0013e779',
              elementId: 1304441,
              parameters: {
                Category: '墙'
              }
            }
          }
        ],
        [
          'wall-2',
          {
            id: 'wall-2',
            childrenIds: [],
            raw: {
              applicationId: 'fallback-app-id',
              parameters: {
                Category: '墙'
              }
            }
          }
        ]
      ])
    })

    expect(payload.elements).to.deep.equal([
      {
        id: '1304441',
        applicationId: 'a72d6cd0-434a-4b6f-a2a2-7266a0224d8e-0013e779',
        elementId: '1304441',
        parameters: {
          Category: '墙'
        }
      },
      {
        id: 'fallback-app-id',
        applicationId: 'fallback-app-id',
        parameters: {
          Category: '墙'
        }
      }
    ])
  })

  it('prefers elementId regardless of model name or extension', () => {
    const payload = buildModelCustomLabelPayload({
      modelSeedId: 'seed-custom',
      modelName: '56 - 副本 (3)',
      versionCreatedAt: '2026-05-18T00:00:00.000Z',
      rootId: 'root-1',
      objectMap: new Map([
        [
          'root-1',
          {
            id: 'root-1',
            childrenIds: ['wall-1', 'wall-2'],
            raw: {
              elements: [{ referencedId: 'wall-1' }, { referencedId: 'wall-2' }]
            }
          }
        ],
        [
          'wall-1',
          {
            id: 'wall-1',
            childrenIds: [],
            raw: {
              applicationId: 'b5e6a1bb-53d4-4786-9605-392660652267-00051cc0',
              elementId: 335040,
              parameters: {
                Category: '楼板'
              }
            }
          }
        ],
        [
          'wall-2',
          {
            id: 'wall-2',
            childrenIds: [],
            raw: {
              applicationId: 'fallback-app-id',
              parameters: {
                Category: '墙'
              }
            }
          }
        ]
      ])
    })

    expect(payload.elements).to.deep.equal([
      {
        id: '335040',
        applicationId: 'b5e6a1bb-53d4-4786-9605-392660652267-00051cc0',
        elementId: '335040',
        parameters: {
          Category: '楼板'
        }
      },
      {
        id: 'fallback-app-id',
        applicationId: 'fallback-app-id',
        parameters: {
          Category: '墙'
        }
      }
    ])
  })
})
