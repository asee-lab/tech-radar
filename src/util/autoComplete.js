const $ = require('jquery')
require('jquery-ui/ui/widgets/autocomplete')

const config = require('../config')
const featureToggles = config().featureToggles
const appState = require('./appState')

$.widget('custom.radarcomplete', $.ui.autocomplete, {
  _create: function () {
    this._super()
    this.widget().menu('option', 'items', '> :not(.ui-autocomplete-quadrant)')
  },
  _renderMenu: function (ul, items) {
    let currentQuadrant = ''

    items.forEach((item) => {
      const quadrantName = (item.quadrant && item.quadrant.quadrant && item.quadrant.quadrant.name()) || item.quadrantName || ''
      if (quadrantName !== currentQuadrant) {
        ul.append(`<li class='ui-autocomplete-quadrant'>${quadrantName}</li>`)
        currentQuadrant = quadrantName
      }
      const li = this._renderItemData(ul, item)
      if (quadrantName) {
        li.attr('aria-label', `${quadrantName}:${item.value}`)
      }
    })
  },
})

function buildCurrentRadarSource(quadrants) {
  return quadrants.reduce((acc, quadrant) => {
    return [
      ...acc,
      ...quadrant.quadrant.blips().map((blip) => ({
        blip,
        quadrant,
        quadrantName: quadrant.quadrant.name(),
        value: blip.name(),
      })),
    ]
  }, [])
}

function buildCrossVersionSource(currentQuadrants) {
  const history = appState.getBlipHistory()
  const currentVersionId = appState.getCurrentVersionId()
  if (!history) return buildCurrentRadarSource(currentQuadrants)

  const currentSource = buildCurrentRadarSource(currentQuadrants)
  const seen = new Set(currentSource.map((i) => i.value.toLowerCase()))

  history.forEach((entries) => {
    const nameLower = entries[0].name.toLowerCase()
    if (seen.has(nameLower)) return
    const newest = entries[0]
    currentSource.push({
      blipName: newest.name,
      versionId: newest.versionId,
      quadrantName: newest.quadrant,
      ring: newest.ring,
      description: newest.description,
      value: newest.name,
      nonCurrent: newest.versionId !== currentVersionId,
    })
    seen.add(nameLower)
  })

  return currentSource
}

function matchesFilters(item, filters) {
  if (!filters) return true
  const ring = (item.blip ? item.blip.ring().name() : item.ring || '').toLowerCase()
  if (filters.rings.size > 0 && !filters.rings.has(ring)) return false
  const quadrantName = (item.quadrant && item.quadrant.quadrant && item.quadrant.quadrant.name()) || item.quadrantName || ''
  if (filters.quadrants.size > 0 && !filters.quadrants.has(quadrantName)) return false
  return true
}

function filterAndRank(source, term, filters) {
  const terms = term.toLowerCase().split(/\s+/).filter(Boolean)
  const scored = []
  source.forEach((item) => {
    if (!matchesFilters(item, filters)) return
    const name = (item.value || '').toLowerCase()
    if (!terms.every((t) => name.includes(t))) return
    const firstTerm = terms[0] || ''
    const prefixRank = name.startsWith(firstTerm) ? 0 : 1
    scored.push({ item, prefixRank, name })
  })
  scored.sort((a, b) => a.prefixRank - b.prefixRank || a.name.localeCompare(b.name))
  return scored.map((s) => s.item)
}

const AutoComplete = (el, quadrants, cb, filters) => {
  const manifestMode = appState.isManifestMode()
  const source = manifestMode ? buildCrossVersionSource(quadrants) : buildCurrentRadarSource(quadrants)

  if (featureToggles.UIRefresh2022) {
    $(el).autocomplete({
      appendTo: '.search-container',
      source: (request, response) => {
        response(filterAndRank(source, request.term, filters))
      },
      select: cb.bind({}),
    })
  } else {
    $(el).radarcomplete({
      source: (request, response) => {
        response(filterAndRank(source, request.term, filters))
      },
      select: cb.bind({}),
    })
  }
}

module.exports = AutoComplete
