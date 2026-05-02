const d3 = require('d3')

const RING_HELP = {
  adopt: 'We feel strongly that the industry should be adopting these items. We use them when appropriate on our projects.',
  trial:
    'Worth pursuing. It is important to understand how to build up this capability. Enterprises should try this technology on a project that can handle the risk.',
  assess: 'Worth exploring with the goal of understanding how it will affect your enterprise.',
  hold: 'Proceed with caution',
  caution: 'Proceed with caution',
}

function normaliseRingName(ringName) {
  return (ringName || '').trim().toLowerCase()
}

function getRingHelpText(ringName) {
  return RING_HELP[normaliseRingName(ringName)] || RING_HELP.hold
}

function renderTooltipIcon(parentSelection, ringName, tooltipId) {
  const label = `More info about ${normaliseRingName(ringName)}`
  const svg = parentSelection
    .append('svg')
    .attr('class', 'ring-tooltip--icon')
    .attr('width', '20')
    .attr('height', '20')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('tabindex', '0')
    .attr('aria-label', label)
    .attr('aria-describedby', tooltipId)
    .attr('role', 'button')

  const group = svg.append('g')
  group
    .append('circle')
    .attr('r', '12.5')
    .attr('cy', '12.5')
    .attr('cx', '12.5')
    .attr('fill', '#163c4d')
    .attr('stroke', 'black')
  group
    .append('text')
    .attr('font-style', 'normal')
    .attr('font-weight', 'bold')
    .attr('xml:space', 'preserve')
    .attr('style', 'text-anchor: middle;')
    .attr('font-size', '16px')
    .attr('y', '20')
    .attr('x', '13')
    .attr('fill', 'white')
    .text('?')
}

function renderRingTooltip(parentSelection, ringName, idSuffix = 'default') {
  const tooltipId = `${normaliseRingName(ringName)}-${idSuffix}-help-text`
  const help = parentSelection
    .append('span')
    .classed('ring-tooltip--help', true)
    .attr('id', `${normaliseRingName(ringName)}-${idSuffix}`)
    .attr('data-ring-name', normaliseRingName(ringName))

  renderTooltipIcon(help, ringName, tooltipId)

  parentSelection
    .append('span')
    .classed('ring-tooltip--text', true)
    .attr('id', tooltipId)
    .attr('role', 'tooltip')
    .attr('aria-hidden', 'true')
    .text(getRingHelpText(ringName))
}

module.exports = {
  RING_HELP,
  getRingHelpText,
  renderRingTooltip,
}
