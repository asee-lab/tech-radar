const appState = require('./appState')
const { graphConfig } = require('../graphing/config')

const PAGE_SIZE = 10

function getItemQuadrantName(item) {
  return (item.quadrant && item.quadrant.quadrant && item.quadrant.quadrant.name()) || item.quadrantName || ''
}

function getItemRingName(item) {
  return item.blip ? item.blip.ring().name() : item.ring || ''
}

function getItemRingValue(item) {
  return getItemRingName(item).toLowerCase()
}

function getItemDescription(item) {
  return item.blip ? item.blip.description() : item.description || ''
}

function getItemSlug(item) {
  return item.blip ? item.blip.slug() : item.slug || ''
}

function getItemName(item) {
  return item.blipName || item.value || (item.blip && item.blip.name()) || ''
}

function getVersionMeta(versionId) {
  const manifest = appState.getManifest()
  const versions = appState.getVersions()
  const entry = versions && versionId ? versions.get(versionId) : null
  const manifestEntry = manifest && versionId ? manifest.versions.find((v) => v.id === versionId) : null
  return {
    versionId,
    versionLabel: (entry && entry.label) || (manifestEntry && manifestEntry.label) || versionId || '',
    versionDate: (entry && entry.date) || (manifestEntry && manifestEntry.date) || '',
  }
}

function parseVersionTime(item) {
  const time = item.versionDate ? new Date(item.versionDate).getTime() : Number.NaN
  if (!Number.isNaN(time)) return time
  const idTime = item.versionId ? new Date(`${item.versionId.replace('.', '-')}-01`).getTime() : Number.NaN
  return Number.isNaN(idTime) ? 0 : idTime
}

function buildCurrentRadarSource(quadrants) {
  const currentVersionId = appState.getCurrentVersionId()
  const versionMeta = getVersionMeta(currentVersionId)
  let sourceOrder = 0
  return quadrants.reduce((acc, quadrant) => {
    return [
      ...acc,
      ...quadrant.quadrant.blips().map((blip) => ({
        blip,
        quadrant,
        quadrantName: quadrant.quadrant.name(),
        ring: blip.ring().name(),
        description: blip.description(),
        slug: blip.slug(),
        sourceOrder: sourceOrder++,
        value: blip.name(),
        ...versionMeta,
      })),
    ]
  }, [])
}

function buildCrossVersionSource(currentQuadrants) {
  const history = appState.getBlipHistory()
  const currentVersionId = appState.getCurrentVersionId()
  if (!history) return buildCurrentRadarSource(currentQuadrants)

  const source = []
  let sourceOrder = 0
  const seenHistories = new Set()

  history.forEach((entries) => {
    if (!entries || !entries.length || seenHistories.has(entries)) return
    seenHistories.add(entries)

    const newest = entries[0]
    source.push({
      blipName: newest.name,
      versionId: newest.versionId,
      versionLabel: newest.versionLabel || newest.versionId,
      versionDate: newest.versionDate,
      quadrantName: newest.quadrant,
      ring: newest.ring,
      description: newest.description,
      slug: newest.slug || '',
      sourceOrder: sourceOrder++,
      value: newest.name,
      nonCurrent: newest.versionId !== currentVersionId,
    })
  })

  return source
}

function buildSearchSource(quadrants) {
  return appState.isManifestMode() ? buildCrossVersionSource(quadrants) : buildCurrentRadarSource(quadrants)
}

function normaliseFilterValue(value) {
  return (value || '').toLowerCase()
}

function matchesFilters(item, filters) {
  if (!filters) return true
  const ring = getItemRingValue(item)
  if (filters.rings && filters.rings.size > 0 && !filters.rings.has(ring)) return false
  const quadrantName = getItemQuadrantName(item)
  if (filters.quadrants && filters.quadrants.size > 0 && !filters.quadrants.has(quadrantName)) return false
  return true
}

function matchesTerm(item, term) {
  const terms = term.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const name = getItemName(item).toLowerCase()
  const description = getItemDescription(item).toLowerCase()
  return terms.every((t) => name.includes(t) || description.includes(t))
}

function sortRecentFirst(items) {
  return [...items].sort((a, b) => {
    const dateDelta = parseVersionTime(b) - parseVersionTime(a)
    if (dateDelta) return dateDelta
    return (a.sourceOrder || 0) - (b.sourceOrder || 0)
  })
}

function filterByTerm(source, term) {
  return source.filter((item) => matchesTerm(item, term))
}

function filterAndRank(source, term, filters) {
  const terms = term.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return sortRecentFirst(source.filter((item) => matchesFilters(item, filters)))

  const scored = []
  source.forEach((item) => {
    if (!matchesFilters(item, filters)) return
    const name = getItemName(item).toLowerCase()
    const description = getItemDescription(item).toLowerCase()
    if (!terms.every((t) => name.includes(t) || description.includes(t))) return
    const firstTerm = terms[0] || ''
    const prefixRank = name.startsWith(firstTerm) ? 0 : 1
    scored.push({ item, prefixRank, date: parseVersionTime(item), name })
  })
  scored.sort((a, b) => a.prefixRank - b.prefixRank || b.date - a.date || a.name.localeCompare(b.name))
  return scored.map((s) => s.item)
}

function paginate(items, page, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIndex = (currentPage - 1) * pageSize
  return {
    currentPage,
    pageItems: items.slice(startIndex, startIndex + pageSize),
    pageSize,
    start: items.length ? startIndex + 1 : 0,
    end: Math.min(startIndex + pageSize, items.length),
    total: items.length,
    totalPages,
  }
}

function countBy(items, getter) {
  return items.reduce((counts, item) => {
    const key = getter(item)
    if (!key) return counts
    counts.set(key, (counts.get(key) || 0) + 1)
    return counts
  }, new Map())
}

function orderedValues(values, configuredOrder, normalise = (value) => value) {
  const remaining = new Set(values)
  const ordered = configuredOrder.map(normalise).filter((value) => {
    if (!remaining.has(value)) return false
    remaining.delete(value)
    return true
  })
  return [...ordered, ...Array.from(remaining).sort((a, b) => a.localeCompare(b))]
}

function getFilterOptions(source, term = '') {
  const termMatches = filterByTerm(source, term)
  const quadrantCounts = countBy(termMatches, getItemQuadrantName)
  const ringCounts = countBy(termMatches, getItemRingValue)
  const quadrantValues = orderedValues(quadrantCounts.keys(), graphConfig.quadrants)
  const ringValues = orderedValues(ringCounts.keys(), graphConfig.rings, (ring) => ring.toLowerCase())

  return {
    quadrants: quadrantValues.map((value) => ({ value, label: value, count: quadrantCounts.get(value) || 0 })),
    rings: ringValues.map((value) => ({ value, label: formatRingName(value), count: ringCounts.get(value) || 0 })),
  }
}

function formatRingName(ring) {
  const match = graphConfig.rings.find((configured) => configured.toLowerCase() === ring.toLowerCase())
  return match || ring.charAt(0).toUpperCase() + ring.slice(1)
}

module.exports = {
  PAGE_SIZE,
  buildCurrentRadarSource,
  buildCrossVersionSource,
  buildSearchSource,
  filterAndRank,
  formatRingName,
  getFilterOptions,
  getItemDescription,
  getItemName,
  getItemQuadrantName,
  getItemRingName,
  getItemRingValue,
  getItemSlug,
  paginate,
  sortRecentFirst,
}
