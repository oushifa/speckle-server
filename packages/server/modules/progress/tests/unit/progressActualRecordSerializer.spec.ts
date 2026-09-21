import { expect } from 'chai'
import type { ProgressActualRecord } from '@/modules/progress/repositories/progressActualRecords'
import {
  buildBimEntryDetails,
  collectUnresolvedApplicationIds,
  serializeActualRecord
} from '@/modules/progress/services/progressActualRecordSerializer'

const buildRecord = (
  overrides: Partial<ProgressActualRecord> = {}
): ProgressActualRecord => ({
  id: 'record-1',
  projectId: 'project-1',
  taskName: '二层墙体施工日报',
  reportDate: '2026-05-14',
  startElementCodes: null,
  finishElementCodes: null,
  startBIM: null,
  finishBIM: null,
  BIM: null,
  remark: null,
  highTemperature: null,
  lowTemperature: null,
  morningWeather: null,
  afternoonWeather: null,
  nightCondition: null,
  constructionRecord: null,
  qualityRecord: null,
  safetyRecord: null,
  mortarConcreteSampleRecord: null,
  materialEquipmentRecord: null,
  siteAppearanceRecord: null,
  overtimeRecord: null,
  otherRecord: null,
  siteLeader: null,
  reporter: null,
  constructionLog: null,
  creator: 'user-1',
  updater: 'user-1',
  createdAt: new Date('2026-05-14T00:00:00.000Z'),
  updatedAt: new Date('2026-05-14T00:00:00.000Z'),
  yearMonth: '2026-05',
  tasks: null,
  workers: null,
  ...overrides
})

describe('progressActualRecordSerializer', () => {
  describe('buildBimEntryDetails', () => {
    it('aligns component codes with applicationIds and prefers stored bimIds', () => {
      const details = buildBimEntryDetails(
        [
          {
            modelId: 'model-a',
            applicationIds: ['app-1', 'app-2'],
            bimIds: ['CB-01', null]
          }
        ],
        new Map([['app-2', 'CLASS_SPACE_SECTION_CB-02']])
      )

      expect(details).to.have.length(1)
      expect(details[0].componentCodes).to.deep.equal([
        'CB-01',
        'CLASS_SPACE_SECTION_CB-02'
      ])
      expect(details[0].components).to.deep.equal([
        { modelId: 'model-a', applicationId: 'app-1', componentCode: 'CB-01' },
        {
          modelId: 'model-a',
          applicationId: 'app-2',
          componentCode: 'CLASS_SPACE_SECTION_CB-02'
        }
      ])
    })

    it('falls back to null when neither stored code nor lookup matches', () => {
      const details = buildBimEntryDetails(
        [{ modelId: 'model-a', applicationIds: ['app-9'], bimIds: [] }],
        new Map()
      )

      expect(details[0].componentCodes).to.deep.equal([null])
      expect(details[0].components[0].componentCode).to.equal(null)
    })
  })

  describe('collectUnresolvedApplicationIds', () => {
    it('only collects components without a stored code', () => {
      const ids = collectUnresolvedApplicationIds([
        buildRecord({
          startBIM: [
            {
              modelId: 'model-a',
              applicationIds: ['app-1', 'app-2'],
              bimIds: ['CB-01', null]
            }
          ],
          tasks: [
            {
              taskName: '二层墙体',
              selections: [{ modelId: 'model-a', applicationIds: ['app-3'] }]
            }
          ]
        })
      ])

      expect(ids).to.deep.equal(['app-2', 'app-3'])
    })
  })

  describe('serializeActualRecord', () => {
    it('returns deduped componentCodes and modelId/applicationId mapping details', () => {
      const serialized = serializeActualRecord(
        buildRecord({
          startBIM: [
            {
              modelId: 'model-a',
              applicationIds: ['app-1', 'app-2'],
              bimIds: ['CB-01', null]
            }
          ],
          finishBIM: [
            { modelId: 'model-a', applicationIds: ['app-4'], bimIds: ['CB-04'] }
          ],
          tasks: [
            {
              taskName: '二层墙体',
              linkedPlanTaskId: 'plan-task-1',
              selections: [{ modelId: 'model-a', applicationIds: ['app-1', 'app-3'] }]
            }
          ]
        }),
        new Map([
          ['app-2', 'FULL-CB-02'],
          ['app-3', 'FULL-CB-03']
        ])
      )

      expect(serialized.componentCodes).to.deep.equal([
        'CB-01',
        'FULL-CB-02',
        'CB-04',
        'FULL-CB-03'
      ])

      expect(serialized.bimComponents).to.deep.equal([
        {
          scope: 'start',
          modelId: 'model-a',
          applicationId: 'app-1',
          componentCode: 'CB-01'
        },
        {
          scope: 'start',
          modelId: 'model-a',
          applicationId: 'app-2',
          componentCode: 'FULL-CB-02'
        },
        {
          scope: 'finish',
          modelId: 'model-a',
          applicationId: 'app-4',
          componentCode: 'CB-04'
        },
        {
          scope: 'task',
          modelId: 'model-a',
          applicationId: 'app-1',
          componentCode: 'CB-01',
          taskName: '二层墙体',
          linkedPlanTaskId: 'plan-task-1'
        },
        {
          scope: 'task',
          modelId: 'model-a',
          applicationId: 'app-3',
          componentCode: 'FULL-CB-03',
          taskName: '二层墙体',
          linkedPlanTaskId: 'plan-task-1'
        }
      ])

      expect(serialized.tasks[0].selections[0].componentCodes).to.deep.equal([
        'CB-01',
        'FULL-CB-03'
      ])
    })

    it('keeps returning an empty component list for records without BIM links', () => {
      const serialized = serializeActualRecord(buildRecord())

      expect(serialized.componentCodes).to.deep.equal([])
      expect(serialized.bimComponents).to.deep.equal([])
      expect(serialized.startBIM).to.deep.equal([])
      expect(serialized.finishBIM).to.deep.equal([])
      expect(serialized.tasks).to.deep.equal([])
    })
  })
})
