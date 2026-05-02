require('../../helpers/jsdom')

jest.mock('d3', () => require('d3/dist/d3.min.js'))

jest.mock('../../../src/graphing/components/quadrants', () => ({
  stickQuadrantOnScroll: jest.fn(),
}))

jest.mock('../../../src/graphing/blipDetail', () => ({
  navigateToBlipDetail: jest.fn(),
}))

const appState = require('../../../src/util/appState')
const { renderBlipDescription } = require('../../../src/graphing/components/quadrantTables')
const { navigateToBlipDetail } = require('../../../src/graphing/blipDetail')

describe('quadrantTables', () => {
  const ring = { order: () => 0, name: () => 'Adopt' }
  const quadrant = { order: 'first' }
  const tip = { show: jest.fn(), hide: jest.fn().mockReturnThis(), style: jest.fn().mockReturnThis() }
  const blip = {
    id: () => 1,
    name: () => 'Testcontainers',
    blipText: () => '7',
    description: () => '<p>Use <a href="Kafka">Kafka</a> and <a href="https://example.com">external docs</a>.</p>',
    groupIdInGraph: () => '',
    isGroup: () => false,
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="quadrant-table first">
        <ul class="blip-list" data-ring-order="0"></ul>
      </div>
      <svg id="radar-plot"></svg>
      <div id="radar"></div>
      <div class="graph-header"></div>
      <g><a id="blip-link-1" class="blip-link" data-blip-id="1"></a></g>
      <g><a id="blip-link-2" class="blip-link" data-blip-id="2"></a></g>
    `

    appState.setManifestData({
      manifest: { versions: [{ id: '2026.04', label: 'April 2026' }] },
      versions: new Map(),
      blipHistory: new Map([
        [
          'kafka',
          [
            {
              name: 'Kafka',
              versionId: '2026.04',
              versionLabel: 'April 2026',
              quadrant: 'Platforms',
              ring: 'trial',
              description: '',
            },
          ],
        ],
      ]),
      currentVersionId: '2026.04',
    })

    navigateToBlipDetail.mockClear()
  })

  it('renders read more and toggles a single expanded description', () => {
    renderBlipDescription(blip, ring, quadrant, tip, null, [])

    const secondBlip = {
      ...blip,
      id: () => 2,
      name: () => 'Redis',
      description: () => '<p>Use <a href="Kafka">Kafka</a>.</p>',
    }
    renderBlipDescription(secondBlip, ring, quadrant, tip, null, [])

    const buttons = Array.from(document.querySelectorAll('.read-more-btn'))
    buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(document.querySelector('#blip-description-1').classList.contains('expanded')).toBe(true)
    expect(buttons[0].textContent).toContain('Show less')

    buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(document.querySelector('#blip-description-1').classList.contains('expanded')).toBe(false)
    expect(document.querySelector('#blip-description-2').classList.contains('expanded')).toBe(true)
  })

  it('renders view blip history cta with manifest url and related blips metadata', () => {
    renderBlipDescription(blip, ring, quadrant, tip, null, [])

    const historyLink = document.querySelector('.cmp-blip-history a')
    expect(historyLink.getAttribute('href')).toBe('/?blip=Testcontainers')

    historyLink.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(navigateToBlipDetail).toHaveBeenCalledWith('Testcontainers', '2026.04')

    const relatedPill = document.querySelector('.related-blip-item__href')
    expect(relatedPill).not.toBeNull()
    expect(relatedPill.querySelector('.blip-ring').textContent).toBe('trial')
    expect(relatedPill.querySelector('.blip-quadrant').getAttribute('data-quadrant-name')).toBe('Platforms')
  })
})
