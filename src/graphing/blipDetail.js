const d3 = require('d3')

const { enrichDescriptionLinks } = require('../util/internalLinks')
const { renderRelatedBlipsList } = require('../util/relatedBlips')
const { constructBlipDetailUrl, constructVersionUrl } = require('../util/urlUtils')
const { renderRingTooltip } = require('../util/ringTooltips')
const appState = require('../util/appState')

function hideRadarView() {
  d3.select('main .graph-header').style('display', null)
  d3.select('main .radar-search-page').style('display', 'none')
  d3.select('main .radar-intro').style('display', 'none')
  d3.select('#radar').style('display', 'none')
  d3.select('main .all-quadrants-mobile').style('display', 'none')
  d3.select('main .graph-footer').style('display', 'none')
  d3.selectAll('main .home-page').style('display', 'none')
  d3.select('#error-container').style('display', 'none')
}

function showRadarView() {
  d3.select('main .graph-header').style('display', null)
  d3.select('main .radar-search-page').style('display', 'none')
  d3.select('main .radar-intro').style('display', null)
  d3.select('#radar').style('display', null)
  d3.select('main .all-quadrants-mobile').style('display', null)
  d3.select('main .graph-footer').style('display', null)
  d3.select('main .blip-detail').remove()
}

function navigateToRadar(versionId) {
  const radarUrl = constructVersionUrl(versionId || appState.getCurrentVersionId())
  window.history.pushState({ type: 'radar', versionId: versionId || appState.getCurrentVersionId() }, '', radarUrl)
  showRadarView()
  document.title = 'asee & payten radar'
}

function formatPublishedDate(dateString, fallback) {
  if (!dateString) return fallback
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return fallback

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date)
}

function scrollToTop() {
  try {
    window.scrollTo(0, 0)
  } catch (_error) {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
}

function renderTimelineEntry(wrapper, entry, index) {
  const item = wrapper.append('div').attr('blip', 'blip').classed('cmp-blip-timeline__item', true)
  item
    .append('div')
    .classed('cmp-blip-timeline__item--time', true)
    .text(entry.versionLabel || entry.versionId)

  const ring = item.append('div').classed('cmp-blip-timeline__item--ring', true)
  ring.append('span').text(` ${entry.ring.charAt(0).toUpperCase() + entry.ring.slice(1)}`)
  renderRingTooltip(ring, entry.ring, `timeline-${index}`)

  const description = item.append('div').classed('cmp-blip-timeline__item--lead blip-timeline-description', true).node()
  description.innerHTML = entry.description || ''
  enrichDescriptionLinks(description, [], entry.versionId)
}

function renderBlipDetail(blipIdentifier, versionId) {
  const history = appState.getBlipHistory()
  if (!history) return

  const entries = history.get(blipIdentifier.toLowerCase())
  if (!entries || !entries.length) {
    console.warn(`Blip "${blipIdentifier}" not found in any version`)
    return
  }

  const canonicalName = entries[0].name
  document.title = `${canonicalName} — asee & payten radar`

  hideRadarView()
  d3.select('main .blip-detail').remove()

  const container = d3.select('main').append('div').classed('blip-detail', true)

  const targetVersion = versionId || appState.getCurrentVersionId() || entries[0].versionId
  container
    .append('button')
    .classed('blip-detail__close', true)
    .attr('type', 'button')
    .text('Close')
    .on('click', () => navigateToRadar(targetVersion))

  container.append('h1').classed('blip-detail__name', true).text(canonicalName)

  const timeline = container.append('section').classed('blip-detail__timeline blipTimeline', true)
  const timelineRoot = timeline.append('div').classed('cmp-blip-timeline', true)
  const newestEntry = entries[0]
  const oldestEntry = entries[entries.length - 1]

  const dateTop = timelineRoot.append('div').classed('cmp-blip-timeline__date blip-timeline-date', true)
  dateTop
    .append('div')
    .classed('cmp-blip-timeline__date--lastmodified', true)
    .append('span')
    .text(
      `Last updated : ${formatPublishedDate(
        newestEntry.versionDate,
        newestEntry.versionLabel || newestEntry.versionId,
      )}`,
    )

  const wrapper = timelineRoot.append('div').classed('cmp-blip-timeline__wrapper blip-timeline-wrapper', true)
  entries.forEach((entry, index) => renderTimelineEntry(wrapper, entry, index))

  const dateBottom = timelineRoot.append('div').classed('cmp-blip-timeline__date', true)
  dateBottom
    .append('div')
    .classed('cmp-blip-timeline__date--published', true)
    .append('span')
    .text(
      `Published : ${formatPublishedDate(oldestEntry.versionDate, oldestEntry.versionLabel || oldestEntry.versionId)}`,
    )

  const relatedSection = container.append('section').classed('blip-detail__related', true)
  renderRelatedBlipsList(relatedSection, newestEntry.description, targetVersion, canonicalName)

  scrollToTop()
}

function navigateToBlipDetail(blipIdentifier, versionId) {
  const effectiveVersion = versionId || appState.getCurrentVersionId()
  const url = constructBlipDetailUrl(blipIdentifier)
  window.history.pushState({ type: 'blip', blipName: blipIdentifier, versionId: effectiveVersion }, '', url)
  renderBlipDetail(blipIdentifier, effectiveVersion)
}

module.exports = {
  renderBlipDetail,
  navigateToBlipDetail,
  showRadarView,
  hideRadarView,
}
