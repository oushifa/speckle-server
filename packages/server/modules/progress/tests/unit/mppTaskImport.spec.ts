import { expect } from 'chai'
import { extractTaskArrayFromCommandOutput } from '@/modules/progress/services/mppTaskImport'

describe('extractTaskArrayFromCommandOutput', () => {
  it('parses plain JSON array output', () => {
    const result = extractTaskArrayFromCommandOutput(
      '[{"name":"Task A","externalId":"1"}]'
    )

    expect(result).to.deep.equal([{ name: 'Task A', externalId: '1' }])
  })

  it('extracts JSON array when stdout starts with runtime logs', () => {
    const result =
      extractTaskArrayFromCommandOutput(`2026-05-13T14:52:28.648493Z main ERROR Log4j API could not find a logging provider.
[{"name":"Task A","externalId":"1"},{"name":"Task [B]","externalId":"2"}]`)

    expect(result).to.deep.equal([
      { name: 'Task A', externalId: '1' },
      { name: 'Task [B]', externalId: '2' }
    ])
  })

  it('skips non-json bracketed log prefixes', () => {
    const result =
      extractTaskArrayFromCommandOutput(`[main] INFO ProgressPlanMppExtractor started
[{"name":"Task A","externalId":"1"}]`)

    expect(result).to.deep.equal([{ name: 'Task A', externalId: '1' }])
  })

  it('throws when no JSON array payload exists', () => {
    expect(() => extractTaskArrayFromCommandOutput('true extractor finished')).to.throw(
      'Failed to parse JSON array from .mpp extractor stdout.'
    )
  })
})
