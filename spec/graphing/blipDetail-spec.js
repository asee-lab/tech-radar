require('../helpers/jsdom')

jest.mock('d3', () => {
  const fs = require('fs')
  const path = require('path')
  const vm = require('vm')
  const module = { exports: {} }
  const code = fs.readFileSync(path.join(process.cwd(), 'node_modules/d3-selection/dist/d3-selection.js'), 'utf8')
  vm.runInNewContext(code, {
    exports: module.exports,
    module,
    require,
    document: global.document,
    window: global.window,
  })
  return module.exports
})

jest.mock('../../src/util/internalLinks', () => ({
  enrichDescriptionLinks: jest.fn(),
}))

jest.mock('../../src/util/relatedBlips', () => ({
  renderRelatedBlipsList: jest.fn(),
}))

jest.mock('../../src/util/ringTooltips', () => ({
  renderRingTooltip: jest.fn(),
}))

const appState = require('../../src/util/appState')
const { renderBlipDetail } = require('../../src/graphing/blipDetail')

describe('blipDetail', () => {
  beforeEach(() => {
    window.scrollTo = jest.fn()
  })

  afterEach(() => {
    appState.setManifestData({ manifest: null, versions: null, blipHistory: null, currentVersionId: null })
  })

  it('renders a not-current notice for blips absent from the manifest current edition', () => {
    document.body.innerHTML = '<main></main>'
    appState.setManifestData({
      manifest: {
        current: '2026.04',
        versions: [
          { id: '2026.04', label: 'April 2026' },
          { id: '2025.10', label: 'October 2025' },
        ],
      },
      versions: new Map(),
      blipHistory: new Map([
        [
          'retired tool',
          [
            {
              versionId: '2025.10',
              versionLabel: 'October 2025',
              versionDate: '2025-10-01',
              name: 'Retired Tool',
              ring: 'assess',
              description: '<p>Older assessment.</p>',
            },
          ],
        ],
      ]),
      currentVersionId: '2026.04',
    })

    renderBlipDetail('retired tool', '2026.04')

    expect(document.querySelector('.blip-detail__not-current h2').textContent).toBe('NOT ON THE CURRENT EDITION')
    expect(document.querySelector('.blip-detail__not-current').textContent).toContain(
      'This blip is not on the current edition of the Radar.',
    )
    expect(document.querySelector('.cmp-blip-timeline__date--lastmodified').textContent).toBe(
      'Last updated : Oct 31, 2025',
    )
  })

  it('does not render the not-current notice when the blip is in the manifest current edition', () => {
    document.body.innerHTML = '<main></main>'
    appState.setManifestData({
      manifest: { current: '2026.04', versions: [{ id: '2026.04', label: 'April 2026' }] },
      versions: new Map(),
      blipHistory: new Map([
        [
          'microsoft sql server',
          [
            {
              versionId: '2026.04',
              versionLabel: 'April 2026',
              versionDate: '2026-04-01',
              name: 'Microsoft SQL Server',
              ring: 'adopt',
              description: '<p>Current assessment.</p>',
            },
          ],
        ],
      ]),
      currentVersionId: '2026.04',
    })

    renderBlipDetail('microsoft sql server', '2026.04')

    expect(document.querySelector('.blip-detail__not-current')).toBeNull()
    expect(document.querySelector('.cmp-blip-timeline__date--lastmodified').textContent).toBe(
      'Last updated : Apr 30, 2026',
    )
  })
})
