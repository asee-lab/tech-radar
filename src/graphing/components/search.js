const d3 = require('d3')

const AutoComplete = require('../../util/autoComplete')
const { selectRadarQuadrant, removeScrollListener } = require('../components/quadrants')
const appState = require('../../util/appState')

function renderSearch(radarHeader, quadrants) {
  const searchContainer = radarHeader.append('div').classed('search-container', true)

  searchContainer
    .append('input')
    .classed('search-container__input', true)
    .attr('placeholder', 'Search this radar')
    .attr('id', 'auto-complete')

  AutoComplete('#auto-complete', quadrants, function (e, ui) {
    const item = ui.item

    if (appState.isManifestMode() && item.versionId) {
      const { navigateToBlipDetail } = require('../blipDetail')
      navigateToBlipDetail(item.blipName, item.versionId)
      return
    }

    if (appState.isManifestMode() && item.blip) {
      const { navigateToBlipDetail } = require('../blipDetail')
      navigateToBlipDetail(item.blip.name(), appState.getCurrentVersionId())
      return
    }

    const blipId = item.blip.id()
    const quadrant = item.quadrant

    selectRadarQuadrant(quadrant.order, quadrant.startAngle, quadrant.quadrant.name())
    const blipElement = d3.select(
      `.blip-list__item-container[data-blip-id="${blipId}"] .blip-list__item-container__name`,
    )

    removeScrollListener()
    blipElement.dispatch('search-result-click')

    setTimeout(() => {
      blipElement.node().scrollIntoView({
        behavior: 'smooth',
      })
    }, 1500)
  })
}

module.exports = {
  renderSearch,
}
