const d3 = require('d3')

const {
  buildSearchSource,
  filterAndRank,
  formatRingName,
  getFilterOptions,
  getItemDescription,
  getItemName,
  getItemQuadrantName,
  getItemRingName,
  getItemRingValue,
  paginate,
} = require('../../util/searchData')
const { constructSearchUrl } = require('../../util/urlUtils')
const appState = require('../../util/appState')

function stripHtml(html) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return div.textContent || div.innerText || ''
}

function getFilters() {
  return {
    quadrants: new Set(
      Array.from(document.querySelectorAll('.radar-search-page input[name="quadrant"]:checked')).map((el) => el.value),
    ),
    rings: new Set(
      Array.from(document.querySelectorAll('.radar-search-page input[name="ring"]:checked')).map((el) => el.value),
    ),
  }
}

function selectSearchResult(item) {
  const { navigateToBlipDetail } = require('../blipDetail')

  if (appState.isManifestMode() && item.versionId) {
    navigateToBlipDetail(item.slug || item.blipName, item.versionId)
    return
  }

  if (appState.isManifestMode() && item.blip) {
    navigateToBlipDetail(item.blip.slug() || item.blip.name(), appState.getCurrentVersionId())
    return
  }

  const { selectRadarQuadrant, removeScrollListener } = require('./quadrants')
  const blipId = item.blip.id()
  const quadrant = item.quadrant

  hideSearchPage()
  selectRadarQuadrant(quadrant.order, quadrant.startAngle, quadrant.quadrant.name())
  const blipElement = d3.select(`.blip-list__item-container[data-blip-id="${blipId}"] .blip-list__item-container__name`)
  removeScrollListener()
  blipElement.dispatch('search-result-click')
}

function renderEmptyState(resultsContainer, query) {
  const empty = resultsContainer.append('div').classed('radar-search-page__empty', true)
  empty.append('p').classed('radar-search-page__empty-title', true).text('No blips are found.')
  if (query) {
    empty.append('p').classed('radar-search-page__empty-query', true).text(`No results for '${query}'`)
  }
  empty.append('p').classed('radar-search-page__empty-suggestions-title', true).text('Suggestions :')
  const suggestions = empty.append('ul').classed('radar-search-page__empty-suggestions', true)
  suggestions.append('li').text('Try checking the spelling')
  suggestions.append('li').text('Try a different keyword')
  suggestions.append('li').text('Try changing or removing the filters')
}

function renderResultCount(resultsContainer, pageInfo, query) {
  const count = resultsContainer.append('p').classed('radar-search-page__result-count', true)
  if (!pageInfo.total) {
    count.text(query ? `No results for '${query}'` : 'No blips are found.')
    return
  }

  const range = `Showing ${pageInfo.start}-${pageInfo.end} out of ${pageInfo.total} blips`
  count.text(query ? `${range} for '${query}'` : range)
}

function renderPagination(resultsContainer, pageInfo, onPageChange) {
  if (pageInfo.totalPages <= 1) return

  const pagination = resultsContainer.append('nav').classed('radar-search-page__pagination', true).attr('aria-label', 'Search results pages')

  pagination
    .append('button')
    .attr('type', 'button')
    .attr('disabled', pageInfo.currentPage === 1 ? true : null)
    .text('Previous')
    .on('click', () => onPageChange(pageInfo.currentPage - 1))

  for (let page = 1; page <= pageInfo.totalPages; page++) {
    pagination
      .append('button')
      .attr('type', 'button')
      .classed('active', page === pageInfo.currentPage)
      .attr('aria-current', page === pageInfo.currentPage ? 'page' : null)
      .text(page)
      .on('click', () => onPageChange(page))
  }

  pagination
    .append('button')
    .attr('type', 'button')
    .attr('disabled', pageInfo.currentPage === pageInfo.totalPages ? true : null)
    .text('Next')
    .on('click', () => onPageChange(pageInfo.currentPage + 1))
}

function renderResults(resultsContainer, results, query, page, onPageChange) {
  resultsContainer.selectAll('*').remove()
  const pageInfo = paginate(results, page)

  resultsContainer
    .append('div')
    .classed('radar-search-page__results-heading', true)
    .append('h2')
    .text(query ? 'Search results' : 'Recent blips')
  renderResultCount(d3.select('.radar-search-page__results-heading'), pageInfo, query)

  if (!results.length) {
    renderEmptyState(resultsContainer, query)
    return
  }

  const list = resultsContainer.append('ul').classed('radar-search-page__results-list', true)
  pageInfo.pageItems.forEach((item) => {
    const result = list.append('li').classed('radar-search-page__result', true)
    const button = result.append('button').classed('radar-search-page__result-link', true).attr('type', 'button')

    button
      .append('h3')
      .classed('radar-search-page__result-title', true)
      .text(getItemName(item))

    const meta = button.append('span').classed('radar-search-page__result-meta', true)
    meta.append('span').classed('radar-search-page__result-version', true).text(item.versionLabel || item.versionId || '')
    meta.append('span').classed('radar-search-page__result-ring-marker', true).text(formatRingName(getItemRingName(item)))
    meta.append('span').classed('radar-search-page__result-quadrant-marker', true).text(getItemQuadrantName(item))
    if (item.nonCurrent) {
      meta.append('span').classed('radar-search-page__result-old-blip', true).text('Old Blip')
    }

    const description = stripHtml(getItemDescription(item)).trim()
    if (description) {
      button
        .append('span')
        .classed('radar-search-page__result-description', true)
        .text(description.length > 190 ? `${description.slice(0, 187)}...` : description)
    }

    button.on('click', () => selectSearchResult(item))
  })

  renderPagination(resultsContainer, pageInfo, onPageChange)
}

function renderFilterGroup(filters, title, name, options) {
  const group = filters.append('section').classed('radar-search-page__filter-group', true)
  const groupId = `search-filter-group-${name}`
  const button = group
    .append('button')
    .classed('radar-search-page__filter-toggle', true)
    .attr('type', 'button')
    .attr('aria-expanded', 'true')
    .attr('aria-controls', groupId)
    .text(title)

  const panel = group.append('div').classed('radar-search-page__filter-options', true).attr('id', groupId)
  button.on('click', () => {
    const expanded = button.attr('aria-expanded') === 'true'
    button.attr('aria-expanded', expanded ? 'false' : 'true')
    panel.style('display', expanded ? 'none' : null)
  })

  options.forEach(({ value, label, count }) => {
    const id = `search-filter-${name}-${value.replaceAll(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`
    const labelElement = panel.append('label').attr('for', id).attr('data-filter-value', value)
    labelElement.append('input').attr('id', id).attr('name', name).attr('type', 'checkbox').attr('value', value)
    labelElement.append('span').classed('radar-search-page__filter-label', true).text(label)
    labelElement.append('span').classed('radar-search-page__filter-count', true).text(`(${count})`)
  })
}

function updateFilterCounts(source, query) {
  const options = getFilterOptions(source, query)
  const countsByType = {
    quadrant: new Map(options.quadrants.map(({ value, count }) => [value, count])),
    ring: new Map(options.rings.map(({ value, count }) => [value, count])),
  }

  d3.selectAll('.radar-search-page__filter-options label').each(function () {
    const label = d3.select(this)
    const input = label.select('input')
    const count = countsByType[input.attr('name')].get(input.attr('value')) || 0
    label.select('.radar-search-page__filter-count').text(`(${count})`)
  })
}

function updateSearchResults(source, page = 1) {
  const input = document.querySelector('.radar-search-page__input')
  const query = input ? input.value.trim() : ''
  updateFilterCounts(source, query)
  const results = filterAndRank(source, query, getFilters())
  renderResults(d3.select('.radar-search-page__results'), results, query, page, (nextPage) => updateSearchResults(source, nextPage))
}

function setSearchTabActive(active) {
  d3.selectAll('li.quadrant-subnav__list-item').classed('active-item', false).select('button').attr('aria-selected', null)
  if (active) {
    d3.select('#subnav-item-search').classed('active-item', true).select('button').attr('aria-selected', 'true')
    d3.select('span.quadrant-subnav__dropdown-selector').text('Search')
  }
}

function showSearchPage(pushState = true) {
  const versionId = appState.getCurrentVersionId()
  if (pushState) {
    window.history.pushState({ type: 'search', versionId }, '', constructSearchUrl(versionId))
  }

  d3.select('.radar-search-page').style('display', null)
  d3.select('#radar').style('display', 'none')
  d3.select('main .all-quadrants-mobile').style('display', 'none')
  d3.select('main .graph-footer').style('display', 'none')
  d3.selectAll('main .home-page').style('display', 'none')
  d3.select('#error-container').style('display', 'none')
  setSearchTabActive(true)
  document.title = 'Search all blips | asee & payten radar'
  window.scrollTo(0, 0)
}

function hideSearchPage() {
  d3.select('.radar-search-page').style('display', 'none')
  d3.select('#radar').style('display', null)
  d3.select('main .all-quadrants-mobile').style('display', null)
  d3.select('main .graph-footer').style('display', null)
  document.title = 'asee & payten radar'
}

function renderSearchPage(quadrants, onClose) {
  d3.select('main .radar-search-page').remove()

  const source = buildSearchSource(quadrants)
  const page = d3.select('main').insert('section', '#radar').classed('radar-search-page', true).style('display', 'none')
  const heading = page.append('div').classed('radar-search-page__heading', true)
  heading.append('h1').text('Search all blips')
  heading
    .append('button')
    .classed('radar-search-page__close', true)
    .attr('type', 'button')
    .attr('aria-label', 'Close search')
    .text('Close')
    .on('click', onClose)

  const form = page.append('form').classed('radar-search-page__form', true)
  form
    .append('input')
    .classed('radar-search-page__input', true)
    .attr('type', 'text')
    .attr('name', 'search-input')
    .attr('placeholder', 'Search for a blip here')
    .attr('aria-label', 'Search for a blip here')
  form.append('button').classed('radar-search-page__submit', true).attr('type', 'submit').text('Search')

  const body = page.append('div').classed('radar-search-page__body', true)
  const filters = body.append('aside').classed('radar-search-page__filters', true).attr('aria-label', 'Search filters')
  filters.append('h2').text('Filter by')
  const filterOptions = getFilterOptions(source)
  renderFilterGroup(filters, 'Quadrant', 'quadrant', filterOptions.quadrants)
  renderFilterGroup(filters, 'Ring', 'ring', filterOptions.rings)
  body.append('div').classed('radar-search-page__results', true)

  form.on('submit', (event) => {
    event.preventDefault()
    updateSearchResults(source)
  })
  page.select('.radar-search-page__input').on('input', () => updateSearchResults(source))
  page.selectAll('.radar-search-page__filters input').on('change', () => updateSearchResults(source))
  updateSearchResults(source)
}

module.exports = {
  hideSearchPage,
  renderSearchPage,
  showSearchPage,
}
