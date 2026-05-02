const d3 = require('d3')
const { constructSheetUrl, constructVersionUrl } = require('../../util/urlUtils')
const appState = require('../../util/appState')

function resolveManifestLabel(id) {
  const manifest = appState.getManifest()
  if (!manifest) return id
  const entry = manifest.versions.find((v) => v.id === id)
  return entry ? entry.label : id
}

function renderAlternativeRadars(radarFooter, alternatives, currentSheet) {
  const manifestMode = appState.isManifestMode()

  let target = radarFooter
  if (manifestMode) {
    const hero = d3.select('.hero-banner__wrapper')
    if (!hero.empty()) target = hero
  }
  const alternativesContainer = target.append('div').classed('alternative-radars', true)

  if (manifestMode) {
    alternativesContainer.classed('version-selector', true)
  }

  for (let i = 0; alternatives.length > 0; i++) {
    const list = alternatives.splice(0, 5)

    const alternativesList = alternativesContainer
      .append('ul')
      .classed(`alternative-radars__list`, true)
      .classed(`alternative-radars__list__row-${i}`, true)

    if (manifestMode) {
      alternativesList.classed('version-selector__list', true)
    }

    list.forEach(function (alternative) {
      const alternativeListItem = alternativesList.append('li').classed('alternative-radars__list-item', true)
      if (manifestMode) alternativeListItem.classed('version-selector__item', true)

      const label = manifestMode ? resolveManifestLabel(alternative) : alternative
      const href = manifestMode ? constructVersionUrl(alternative) : constructSheetUrl(alternative)

      alternativeListItem
        .append('a')
        .classed('alternative-radars__list-item-link', true)
        .attr('href', href)
        .attr('role', 'tab')
        .text(label)

      if (currentSheet === alternative) {
        alternativeListItem.classed('active', true)

        d3.selectAll('.alternative-radars__list-item a').attr('aria-selected', null)
        alternativeListItem.select('a').attr('aria-selected', 'true')
      }
    })
  }
}

module.exports = {
  renderAlternativeRadars,
}
