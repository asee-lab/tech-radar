const d3 = require('d3')
const { selectRadarQuadrant, removeScrollListener } = require('../graphing/components/quadrants')
const appState = require('./appState')

/**
 * Internal Links for Tech Radar Blips
 *
 * This module enables navigation between blips using internal links in descriptions.
 *
 * Format:
 *   Use the exact blip name (case-insensitive) in the href attribute:
 *   - With hash: <a href="#JUnit">JUnit</a>
 *   - Without hash: <a href="JUnit">JUnit</a>
 *
 * Examples:
 *   - <a href="#ASP.NET Core">ASP.NET Core</a>
 *   - <a href="#.NET Framework">.NET Framework</a>
 *   - <a href="#Continuous Integration">Continuous Integration</a>
 *
 * The link text can be anything, but the href must match the exact blip name
 * (spaces, dots, and special characters included).
 */

/**
 * Navigates to a blip when an internal link is clicked
 * @param {string} blipName - The name of the blip to navigate to (case-insensitive)
 * @param {Array} quadrants - Array of quadrant objects with blips
 * @param {string} [contextVersionId] - Preferred version to land on in manifest mode.
 *                                      Falls back to the blip's most-recent appearance
 *                                      if it doesn't exist in that version.
 */
function navigateToBlip(blipName, quadrants, contextVersionId) {
  if (appState.isManifestMode()) {
    const history = appState.getBlipHistory()
    const entries = history && history.get(blipName.toLowerCase())
    if (!entries || !entries.length) {
      console.warn(`⚠️ Internal link: Could not find blip "${blipName}"`)
      return
    }
    const preferred = contextVersionId || appState.getCurrentVersionId()
    // Prefer landing on the context version if the blip exists there; else use newest entry.
    const inContext = entries.find((e) => e.versionId === preferred)
    const targetEntry = inContext || entries[0]
    const { navigateToBlipDetail } = require('../graphing/blipDetail')
    navigateToBlipDetail(targetEntry.name, targetEntry.versionId)
    return
  }

  let targetBlip = null
  let targetQuadrant = null

  for (const quadrant of quadrants) {
    const blips = quadrant.quadrant.blips()
    const foundBlip = blips.find((b) => b.name().toLowerCase() === blipName.toLowerCase())
    if (foundBlip) {
      targetBlip = foundBlip
      targetQuadrant = quadrant
      break
    }
  }

  if (!targetBlip || !targetQuadrant) {
    console.warn(`⚠️ Internal link: Could not find blip "${blipName}"`)
    return
  }

  // Switch to the correct quadrant
  selectRadarQuadrant(targetQuadrant.order, targetQuadrant.startAngle, targetQuadrant.quadrant.name())

  // Find the blip element in the list
  const blipId = targetBlip.id()
  const blipElement = d3.select(`.blip-list__item-container[data-blip-id="${blipId}"] .blip-list__item-container__name`)

  if (blipElement.empty()) {
    console.warn(`⚠️ Internal link: Could not find DOM element for blip "${blipName}" (ID: ${blipId})`)
    return
  }

  // Dispatch the search-result-click event to trigger the same animation as search
  removeScrollListener()
  blipElement.dispatch('search-result-click')

  // Scroll to the element
  setTimeout(() => {
    blipElement.node().scrollIntoView({
      behavior: 'smooth',
    })
  }, 1500)
}

function isExternalLink(href) {
  if (!href) return false

  try {
    const url = new URL(href, window.location.href)
    return /^https?:$/.test(url.protocol) && url.origin !== window.location.origin
  } catch (_error) {
    return false
  }
}

function isInternalBlipLink(href) {
  if (!href) return false

  return (
    href.startsWith('#') ||
    (!href.includes('://') &&
      !href.startsWith('/') &&
      !href.startsWith('?') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('tel:'))
  )
}

function decorateExternalLink(link) {
  link
    .classed('pop-out', true)
    .attr('target', '_blank')
    .attr('rel', 'noopener noreferrer')
    .attr('aria-label', 'This is an external link. Opens in new tab')
}

/**
 * Sets up click handlers for internal links in blip descriptions
 * @param {HTMLElement} descriptionElement - DOM element containing the description
 * @param {Array} quadrants - Array of quadrant objects with blips
 * @param {string} [contextVersionId] - Manifest-mode version to navigate within
 */
function setupInternalLinks(descriptionElement, quadrants, contextVersionId) {
  // Convert to D3 selection if needed
  const selection = d3.select(descriptionElement)

  // Find all links in the description
  selection.selectAll('a').each(function () {
    const link = d3.select(this)
    const href = link.attr('href')

    if (isExternalLink(href)) {
      decorateExternalLink(link)
      return
    }

    // Check if it's an internal link (format: #blip-name or just blip-name)
    if (isInternalBlipLink(href)) {
      // Extract blip name from the link
      const blipName = href.startsWith('#') ? href.substring(1) : href

      // Add click handler
      link.on('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        navigateToBlip(blipName, quadrants, contextVersionId)
      })

      // Add visual indicator that it's an internal link
      link.classed('internal-link', true)
    }
  })
}

function enrichDescriptionLinks(descriptionElement, quadrants, contextVersionId) {
  setupInternalLinks(descriptionElement, quadrants, contextVersionId)
}

module.exports = {
  navigateToBlip,
  setupInternalLinks,
  enrichDescriptionLinks,
  decorateExternalLink,
  isExternalLink,
  isInternalBlipLink,
}
