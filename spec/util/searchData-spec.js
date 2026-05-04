const {
  buildCrossVersionSource,
  filterAndRank,
  getFilterOptions,
  getItemQuadrantName,
  getItemRingName,
  paginate,
  sortRecentFirst,
} = require('../../src/util/searchData')
const appState = require('../../src/util/appState')

describe('searchData', () => {
  const source = [
    {
      value: 'Kafka',
      quadrantName: 'Runtime Infrastructure',
      ring: 'trial',
      description: 'Event streaming platform',
    },
    {
      value: 'React',
      quadrantName: 'Frameworks and libraries',
      ring: 'adopt',
      description: 'UI library',
    },
    {
      value: 'ASEE Flow',
      quadrantName: 'Runtime Infrastructure',
      ring: 'trial',
      description: 'BPMN process automation',
    },
  ]

  afterEach(() => {
    appState.setManifestData({ manifest: null, versions: null, blipHistory: null, currentVersionId: null })
  })

  it('filters by query text and ranks prefix matches first', () => {
    expect(filterAndRank(source, 'a', null).map((item) => item.value)).toEqual(['ASEE Flow', 'Kafka', 'React'])
  })

  it('filters by quadrant and ring', () => {
    const filters = {
      quadrants: new Set(['Runtime Infrastructure']),
      rings: new Set(['trial']),
    }

    expect(filterAndRank(source, 'platform', filters).map((item) => item.value)).toEqual(['Kafka'])
  })

  it('reads metadata from flat search items', () => {
    expect(getItemQuadrantName(source[0])).toBe('Runtime Infrastructure')
    expect(getItemRingName(source[0])).toBe('trial')
  })

  it('sorts recent blips by publication date and stable source order', () => {
    const recent = sortRecentFirst([
      { value: 'Old', versionDate: '2025-10-01', sourceOrder: 0 },
      { value: 'Second recent', versionDate: '2026-04-01', sourceOrder: 1 },
      { value: 'First recent', versionDate: '2026-04-01', sourceOrder: 0 },
    ])

    expect(recent.map((item) => item.value)).toEqual(['First recent', 'Second recent', 'Old'])
  })

  it('paginates results in Thoughtworks-sized pages', () => {
    const items = Array.from({ length: 23 }, (_, index) => ({ value: `Blip ${index + 1}` }))
    const page = paginate(items, 2)

    expect(page.start).toBe(11)
    expect(page.end).toBe(20)
    expect(page.total).toBe(23)
    expect(page.totalPages).toBe(3)
    expect(page.pageItems).toHaveLength(10)
  })

  it('builds ordered filter options with counts and Hold label', () => {
    const options = getFilterOptions([
      { value: 'Context engineering', quadrantName: 'Techniques', ring: 'adopt', description: '' },
      { value: 'Kafka', quadrantName: 'Tools', ring: 'hold', description: '' },
      { value: 'Flow', quadrantName: 'Tools', ring: 'trial', description: '' },
    ])

    expect(options.quadrants).toEqual([
      { value: 'Techniques', label: 'Techniques', count: 1 },
      { value: 'Tools', label: 'Tools', count: 2 },
    ])
    expect(options.rings).toEqual([
      { value: 'adopt', label: 'Adopt', count: 1 },
      { value: 'trial', label: 'Trial', count: 1 },
      { value: 'hold', label: 'Hold', count: 1 },
    ])
  })

  it('builds one cross-version search item for name and slug aliases', () => {
    const reactHistory = [
      {
        versionId: '2026.04',
        versionLabel: 'April 2026',
        versionDate: '2026-04-01',
        name: 'React JS',
        slug: 'reactjs',
        quadrant: 'Frameworks and libraries',
        ring: 'adopt',
        description: 'UI library',
      },
    ]
    const history = new Map([
      ['react js', reactHistory],
      ['reactjs', reactHistory],
    ])

    appState.setManifestData({
      manifest: { current: '2026.04', versions: [{ id: '2026.04', label: 'April 2026' }] },
      versions: new Map(),
      blipHistory: history,
      currentVersionId: '2026.04',
    })

    expect(buildCrossVersionSource([]).map((item) => item.value)).toEqual(['React JS'])
  })

  it('uses the newest entry regardless of selected radar version', () => {
    const sqlServerHistory = [
      {
        versionId: '2026.04',
        versionLabel: 'April 2026',
        versionDate: '2026-04-01',
        name: 'Microsoft SQL Server',
        slug: 'sql-server',
        quadrant: 'Runtime Infrastructure',
        ring: 'adopt',
        description: 'SQL Server 2025 update',
      },
      {
        versionId: '2025.10',
        versionLabel: 'October 2025',
        versionDate: '2025-10-01',
        name: 'Microsoft SQL Server',
        slug: 'sql-server',
        quadrant: 'Runtime Infrastructure',
        ring: 'adopt',
        description: 'Original SQL Server entry',
      },
    ]

    appState.setManifestData({
      manifest: {
        current: '2026.04',
        versions: [
          { id: '2026.04', label: 'April 2026' },
          { id: '2025.10', label: 'October 2025' },
        ],
      },
      versions: new Map(),
      blipHistory: new Map([['microsoft sql server', sqlServerHistory]]),
      currentVersionId: '2025.10',
    })

    const [item] = buildCrossVersionSource([])

    expect(item.versionId).toBe('2026.04')
    expect(item.description).toBe('SQL Server 2025 update')
    expect(item.nonCurrent).toBe(false)
  })

  it('marks search results old only when absent from the manifest current radar', () => {
    const oldOnlyHistory = [
      {
        versionId: '2025.10',
        versionLabel: 'October 2025',
        versionDate: '2025-10-01',
        name: 'Retired Tool',
        slug: 'retired-tool',
        quadrant: 'Tools',
        ring: 'assess',
        description: 'No longer on the latest radar',
      },
    ]

    appState.setManifestData({
      manifest: {
        current: '2026.04',
        versions: [
          { id: '2026.04', label: 'April 2026' },
          { id: '2025.10', label: 'October 2025' },
        ],
      },
      versions: new Map(),
      blipHistory: new Map([['retired tool', oldOnlyHistory]]),
      currentVersionId: '2026.04',
    })

    const [item] = buildCrossVersionSource([])

    expect(item.versionId).toBe('2025.10')
    expect(item.nonCurrent).toBe(true)
  })
})
