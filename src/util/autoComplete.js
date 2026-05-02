const $ = require('jquery')
require('jquery-ui/ui/widgets/autocomplete')

const config = require('../config')
const featureToggles = config().featureToggles
const { buildSearchSource, filterAndRank, getItemQuadrantName } = require('./searchData')

$.widget('custom.radarcomplete', $.ui.autocomplete, {
  _create: function () {
    this._super()
    this.widget().menu('option', 'items', '> :not(.ui-autocomplete-quadrant)')
  },
  _renderMenu: function (ul, items) {
    let currentQuadrant = ''

    items.forEach((item) => {
      const quadrantName = getItemQuadrantName(item)
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

const AutoComplete = (el, quadrants, cb, filters) => {
  const source = buildSearchSource(quadrants)

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
