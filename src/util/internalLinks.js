const d3 = require('d3')
const { selectRadarQuadrant, removeScrollListener } = require('../graphing/components/quadrants')

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
 */
function navigateToBlip(blipName, quadrants) {
  // Find the blip across all quadrants
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

/**
 * Sets up click handlers for internal links in blip descriptions
 * @param {HTMLElement} descriptionElement - DOM element containing the description
 * @param {Array} quadrants - Array of quadrant objects with blips
 */
function setupInternalLinks(descriptionElement, quadrants) {
  // Convert to D3 selection if needed
  const selection = d3.select(descriptionElement)

  // Find all links in the description
  selection.selectAll('a').each(function () {
    const link = d3.select(this)
    const href = link.attr('href')

    // Check if it's an internal link (format: #blip-name or just blip-name)
    if (href && (href.startsWith('#') || !href.includes('://'))) {
      // Extract blip name from the link
      const blipName = href.startsWith('#') ? href.substring(1) : href

      // Add click handler
      link.on('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        navigateToBlip(blipName, quadrants)
      })

      // Add visual indicator that it's an internal link
      link.classed('internal-link', true)
    }
  })
}

module.exports = {
  navigateToBlip,
  setupInternalLinks,
}
