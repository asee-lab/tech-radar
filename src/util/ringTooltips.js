const RING_HELP = {
  adopt:
    'We feel strongly that the teams in the group should be adopting these. Many teams use it on their projects.',
  trial:
    "Worth pursuing. It is important to understand how to build up this capability. We've seen some teams using it successfully and other teams should try it on a project that can handle the risk.",
  assess: 'Worth exploring in some experiment, spike or PoC with the goal of understanding how it will affect your products and codebases.',
  hold: 'Proceed with caution. You should move away from this technology at first opportunity. Adopting it now will likely lead to significant technical debt and maintenance headaches that need to be justified.',
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
    .attr('viewBox', '0 0 20 20')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('tabindex', '0')
    .attr('aria-label', label)
    .attr('aria-describedby', tooltipId)
    .attr('role', 'button')

  const group = svg.append('g')
  group
    .append('circle')
    .attr('r', '9')
    .attr('cy', '10')
    .attr('cx', '10')
    .attr('fill', '#163c4d')
    .attr('stroke', 'black')
  group
    .append('text')
    .attr('font-style', 'normal')
    .attr('font-weight', 'bold')
    .attr('xml:space', 'preserve')
    .attr('style', 'text-anchor: middle;')
    .attr('font-size', '13px')
    .attr('y', '15')
    .attr('x', '10')
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
