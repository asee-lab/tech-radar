const d3 = require('d3')

const config = require('../../config')
const appState = require('../../util/appState')
const { addPdfCoverTitle } = require('../pdfPage')
const featureToggles = config().featureToggles

function formatVolumeLabel(label) {
  const manifest = appState.getManifest()
  const currentVersionId = appState.getCurrentVersionId()
  if (!manifest || !currentVersionId) return label

  const index = manifest.versions.findIndex((version) => version.id === currentVersionId)
  if (index === -1) return label

  const volume = manifest.versions.length - index
  return `Vol ${volume} | ${label}`
}

function renderBanner(renderFullRadar) {
  if (featureToggles.UIRefresh2022) {
    const documentTitle = formatVolumeLabel(document.title[0].toUpperCase() + document.title.slice(1))

    document.title = documentTitle
    const subtitle = d3.select('.hero-banner__subtitle-text')
    if (subtitle.empty()) {
      d3.select('.hero-banner__wrapper').append('p').classed('hero-banner__subtitle-text', true).text(document.title)
    } else {
      subtitle.text(document.title)
    }
    d3.select('.hero-banner__title-text').on('click', renderFullRadar)

    addPdfCoverTitle(documentTitle)
  } else {
    const header = d3.select('body').insert('header', '#radar')
    header
      .append('div')
      .attr('class', 'radar-title')
      .append('div')
      .attr('class', 'radar-title__text')
      .append('h1')
      .text(document.title)
      .style('cursor', 'pointer')
      .on('click', renderFullRadar)

    header
      .select('.radar-title')
      .append('div')
      .attr('class', 'radar-title__logo')
      .html('<a href="https://www.asee.rs"> <img src="/images/asee-logo.svg" /> </a>')
  }
}

module.exports = {
  renderBanner,
}
