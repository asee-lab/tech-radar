const appState = require('../../src/util/appState')
const {
  collectRelatedBlipsFromDescription,
  getRelatedBlipSummaries,
} = require('../../src/util/relatedBlips')

describe('relatedBlips util', () => {
  beforeEach(() => {
    appState.setManifestData({
      manifest: null,
      versions: null,
      currentVersionId: '2026.04',
      blipHistory: new Map([
        [
          'progressive context disclosure',
          [
            {
              versionId: '2026.04',
              versionLabel: 'April 2026',
              name: 'Progressive context disclosure',
              ring: 'trial',
              quadrant: 'Techniques',
            },
          ],
        ],
        [
          'context graph',
          [
            {
              versionId: '2026.04',
              versionLabel: 'April 2026',
              name: 'Context graph',
              ring: 'assess',
              quadrant: 'Techniques',
            },
          ],
        ],
      ]),
    })
  })

  it('collects unique internal links from a description', () => {
    const html = `
      <p><a href="#Progressive context disclosure">Progressive context disclosure</a></p>
      <p><a href="Context graph">Context graph</a></p>
      <p><a href="https://example.com">external</a></p>
      <p><a href="/radar/techniques/passkeys">path</a></p>
      <p><a href="#Progressive context disclosure">duplicate</a></p>
    `

    expect(collectRelatedBlipsFromDescription(html)).toEqual(['Progressive context disclosure', 'Context graph'])
  })

  it('resolves related blip summaries from manifest history', () => {
    const html = `
      <p><a href="#Progressive context disclosure">Progressive context disclosure</a></p>
      <p><a href="Context graph">Context graph</a></p>
    `

    expect(getRelatedBlipSummaries(html, '2026.04', 'Context engineering')).toEqual([
      {
        name: 'Progressive context disclosure',
        ring: 'trial',
        quadrant: 'Techniques',
        versionId: '2026.04',
        versionLabel: 'April 2026',
      },
      {
        name: 'Context graph',
        ring: 'assess',
        quadrant: 'Techniques',
        versionId: '2026.04',
        versionLabel: 'April 2026',
      },
    ])
  })
})
