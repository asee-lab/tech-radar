const appState = require('./appState')
const { constructBlipDetailUrl } = require('./urlUtils')

function collectRelatedBlipsFromDescription(descriptionHtml) {
  if (!descriptionHtml) return []

  const doc = new DOMParser().parseFromString(`<div>${descriptionHtml}</div>`, 'text/html')
  const anchors = doc.querySelectorAll('a')
  const names = new Set()

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''

    if (!href || href.includes('://') || href.startsWith('/') || href.startsWith('?')) {
      return
    }

    const name = href.startsWith('#') ? href.substring(1) : href
    if (name) {
      names.add(name)
    }
  })

  return Array.from(names)
}

function findCanonicalBlipEntry(blipName, contextVersionId) {
  const history = appState.getBlipHistory()
  if (!history) return null

  const entries = history.get(blipName.toLowerCase())
  if (!entries || !entries.length) return null

  const inContext = contextVersionId ? entries.find((entry) => entry.versionId === contextVersionId) : null
  return inContext || entries[0]
}

function getRelatedBlipSummaries(descriptionHtml, contextVersionId, currentBlipName) {
  const currentName = currentBlipName ? currentBlipName.toLowerCase() : null

  return collectRelatedBlipsFromDescription(descriptionHtml)
    .map((blipName) => findCanonicalBlipEntry(blipName, contextVersionId))
    .filter((entry) => !!entry && entry.name.toLowerCase() !== currentName)
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.name === entry.name) === index)
    .map((entry) => ({
      name: entry.name,
      ring: entry.ring,
      quadrant: entry.quadrant,
      versionId: entry.versionId,
      versionLabel: entry.versionLabel || entry.versionId,
    }))
}

function renderRelatedBlipsList(parentSelection, descriptionHtml, contextVersionId, currentBlipName) {
  const relatedBlips = getRelatedBlipSummaries(descriptionHtml, contextVersionId, currentBlipName)

  if (!relatedBlips.length) {
    return null
  }

  const container = parentSelection.append('div').classed('related-blips-container', true)
  container.append('span').classed('related-blips-heading', true).text('Related blips')

  const list = container.append('ul').classed('related-blips-list', true)

  relatedBlips.forEach((relatedBlip) => {
    const item = list.append('li').classed('related-blip-item', true)
    const link = item
      .append('a')
      .classed('related-blip-item__href', true)
      .attr('href', constructBlipDetailUrl(relatedBlip.name))
      .attr(
        'aria-label',
        `${relatedBlip.name},Quadrant ${relatedBlip.quadrant}, Ring ${relatedBlip.ring}, ${relatedBlip.versionLabel} volume`,
      )
      .on('click', function (event) {
        event.preventDefault()
        const { navigateToBlipDetail } = require('../graphing/blipDetail')
        navigateToBlipDetail(relatedBlip.name, relatedBlip.versionId)
      })

    link.append('div').classed('blip-name', true).attr('data-blip-name', relatedBlip.name).text(relatedBlip.name)
    link.append('div').classed('blip-ring', true).attr('data-ring-name', relatedBlip.ring).text(relatedBlip.ring)

    const hoverInfo = link.append('div').classed('blip-hover-info', true)
    hoverInfo
      .append('span')
      .classed(`blip-icon ${relatedBlip.quadrant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, true)
    hoverInfo
      .append('span')
      .classed('blip-quadrant', true)
      .attr('data-quadrant-name', relatedBlip.quadrant)
      .text(relatedBlip.quadrant)
    hoverInfo.append('div').classed('blip-volume', true).text(relatedBlip.versionLabel)
  })

  return container
}

module.exports = {
  collectRelatedBlipsFromDescription,
  findCanonicalBlipEntry,
  getRelatedBlipSummaries,
  renderRelatedBlipsList,
}
