const d3 = require('d3')

const { setupInternalLinks } = require('../util/internalLinks')
const { constructBlipDetailUrl, constructVersionUrl } = require('../util/urlUtils')
const appState = require('../util/appState')

const STATUS_ICONS = {
  new: '/images/new.svg',
  'moved in': '/images/moved.svg',
  'moved out': '/images/moved.svg',
  'no change': '/images/no-change.svg',
}

function statusLabel(status) {
  if (!status) return ''
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusModifier(status) {
  if (!status) return ''
  return status.replace(/\s+/g, '-')
}

function ringLabel(ring) {
  if (!ring) return ''
  return ring.charAt(0).toUpperCase() + ring.slice(1)
}

function findVersionLabel(versionId) {
  const manifest = appState.getManifest()
  if (!manifest) return versionId
  const entry = manifest.versions.find((v) => v.id === versionId)
  return entry ? entry.label : versionId
}

function appendStatusBadge(parent, status, modifierClass = 'blip-detail__status') {
  if (!status) return null
  const badge = parent
    .append('span')
    .attr('class', `${modifierClass} ${modifierClass}--${statusModifier(status)}`)
  const iconSrc = STATUS_ICONS[status]
  if (iconSrc) {
    badge
      .append('img')
      .attr('src', iconSrc)
      .attr('alt', '')
      .attr('aria-hidden', 'true')
      .classed(`${modifierClass}-icon`, true)
  }
  badge.append('span').text(statusLabel(status))
  return badge
}

function collectRelatedBlips(descriptionHtml) {
  if (!descriptionHtml) return []
  const doc = new DOMParser().parseFromString(`<div>${descriptionHtml}</div>`, 'text/html')
  const anchors = doc.querySelectorAll('a')
  const names = new Set()
  anchors.forEach((a) => {
    const href = a.getAttribute('href') || ''
    if (!href || href.includes('://')) return
    const name = href.startsWith('#') ? href.substring(1) : href
    if (name) names.add(name)
  })
  return Array.from(names)
}

function resolveBlipName(nameLowerOrMixed) {
  const history = appState.getBlipHistory()
  if (!history) return null
  const lower = nameLowerOrMixed.toLowerCase()
  const entries = history.get(lower)
  if (!entries || !entries.length) return null
  return entries[0].name
}

function hideRadarView() {
  d3.select('main .graph-header').style('display', 'none')
  d3.select('#radar').style('display', 'none')
  d3.select('main .all-quadrants-mobile').style('display', 'none')
  d3.select('main .graph-footer').style('display', 'none')
  d3.selectAll('main .home-page').style('display', 'none')
  d3.select('#error-container').style('display', 'none')
}

function showRadarView() {
  d3.select('main .graph-header').style('display', null)
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

function renderBlipDetail(blipName, versionId) {
  const history = appState.getBlipHistory()
  if (!history) return

  const entries = history.get(blipName.toLowerCase())
  if (!entries || !entries.length) {
    console.warn(`Blip "${blipName}" not found in any version`)
    return
  }

  const canonicalName = entries[0].name
  document.title = `${canonicalName} — asee & payten radar`

  hideRadarView()
  d3.select('main .blip-detail').remove()

  const container = d3.select('main').append('div').classed('blip-detail', true)

  const targetVersion = versionId || appState.getCurrentVersionId() || entries[0].versionId
  const current = entries.find((e) => e.versionId === targetVersion) || entries[0]

  // Breadcrumb (Quadrant > Blip name) — clickable Quadrant returns to radar
  const breadcrumb = container.append('nav').classed('blip-detail__breadcrumb', true)
  breadcrumb
    .append('button')
    .attr('type', 'button')
    .classed('blip-detail__breadcrumb-link', true)
    .text(current.quadrant)
    .on('click', () => navigateToRadar(targetVersion))
  breadcrumb.append('span').classed('blip-detail__breadcrumb-sep', true).text('›')
  breadcrumb.append('span').classed('blip-detail__breadcrumb-current', true).text(canonicalName)

  // Back to radar
  container
    .append('button')
    .classed('blip-detail__back', true)
    .attr('type', 'button')
    .text('← Back to radar')
    .on('click', () => navigateToRadar(targetVersion))

  // Hero
  const hero = container.append('div').classed('blip-detail__hero', true)
  hero.append('h1').classed('blip-detail__name', true).text(canonicalName)
  const meta = hero.append('div').classed('blip-detail__meta', true)
  meta.append('span').classed('blip-detail__version', true).text(findVersionLabel(current.versionId))
  meta.append('span').classed('blip-detail__ring', true).text(ringLabel(current.ring))
  if (current.status) appendStatusBadge(meta, current.status)

  // Current description
  const currentSection = container.append('section').classed('blip-detail__current', true)
  const currentDescEl = currentSection.append('div').classed('blip-detail__description', true).node()
  currentDescEl.innerHTML = current.description || ''
  setupInternalLinks(currentDescEl, [], targetVersion)

  // Related blips
  const relatedNames = collectRelatedBlips(current.description)
    .map((n) => resolveBlipName(n))
    .filter((n) => !!n && n.toLowerCase() !== canonicalName.toLowerCase())
  const uniqRelated = Array.from(new Set(relatedNames))
  if (uniqRelated.length > 0) {
    const related = container.append('section').classed('blip-detail__related', true)
    related.append('h2').text('Related blips')
    const list = related.append('ul').classed('blip-detail__related-list', true)
    uniqRelated.forEach((name) => {
      const li = list.append('li').classed('blip-detail__related-item', true)
      li.append('a')
        .classed('blip-detail__related-link internal-link', true)
        .attr('href', constructBlipDetailUrl(targetVersion, name))
        .text(name)
        .on('click', (e) => {
          e.preventDefault()
          navigateToBlipDetail(name, targetVersion)
        })
    })
  }

  // Other volumes (history) — card list
  const olderEntries = entries.filter((e) => e.versionId !== targetVersion)
  if (olderEntries.length > 0) {
    const timeline = container.append('section').classed('blip-detail__timeline', true)
    timeline.append('h2').text('Other volumes')
    const rail = timeline.append('ol').classed('blip-detail__timeline-list', true)
    olderEntries.forEach((entry) => {
      const card = rail
        .append('li')
        .classed('blip-detail__timeline-card', true)
        .attr('role', 'link')
        .attr('tabindex', 0)
        .on('click', () => navigateToBlipDetail(canonicalName, entry.versionId))
        .on('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigateToBlipDetail(canonicalName, entry.versionId)
          }
        })

      const header = card.append('div').classed('blip-detail__timeline-header', true)
      header
        .append('span')
        .classed('blip-detail__timeline-version', true)
        .text(findVersionLabel(entry.versionId))
      header.append('span').classed('blip-detail__timeline-ring', true).text(ringLabel(entry.ring))
      if (entry.status) appendStatusBadge(header, entry.status, 'blip-detail__status')

      const desc = card.append('div').classed('blip-detail__timeline-description', true).node()
      desc.innerHTML = entry.description || ''
      // Stop link clicks from triggering the card click handler.
      d3.select(desc)
        .selectAll('a')
        .on('click.stopcard', function (e) {
          e.stopPropagation()
        })
      setupInternalLinks(desc, [], entry.versionId)
    })
  }
}

function navigateToBlipDetail(blipName, versionId) {
  const effectiveVersion = versionId || appState.getCurrentVersionId()
  const url = constructBlipDetailUrl(effectiveVersion, blipName)
  window.history.pushState({ type: 'blip', blipName, versionId: effectiveVersion }, '', url)
  renderBlipDetail(blipName, effectiveVersion)
}

module.exports = {
  renderBlipDetail,
  navigateToBlipDetail,
  showRadarView,
  hideRadarView,
}
