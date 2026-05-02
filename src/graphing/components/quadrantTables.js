const d3 = require('d3')
const { graphConfig, getScale, uiConfig } = require('../config')
const { selectRadarQuadrant, stickQuadrantOnScroll } = require('./quadrants')
const { removeAllSpaces } = require('../../util/stringUtil')
const { enrichDescriptionLinks } = require('../../util/internalLinks')
const appState = require('../../util/appState')
const { renderRelatedBlipsList } = require('../../util/relatedBlips')
const { constructBlipDetailUrl } = require('../../util/urlUtils')
const { renderRingTooltip } = require('../../util/ringTooltips')

const SELECT_QUADRANT_ANIMATION_DELAY = 1500

function collapseExpandedBlips() {
  d3.selectAll('.blip-list__item-container.expand').classed('expand', false)
  d3.selectAll('.blip-list__item-container__description.expanded').classed('expanded', false)
  d3.selectAll('.blip-list__item-container__name').attr('aria-expanded', 'false')
  d3.selectAll('.read-more-btn').classed('expanded', false).select('span').text('Read more')
}

function expandBlipContainer(blipItemDiv, description, readMoreButton) {
  collapseExpandedBlips()
  blipItemDiv.classed('expand', true)
  description.classed('expanded', true)
  blipItemDiv.select('.blip-list__item-container__name').attr('aria-expanded', 'true')
  readMoreButton.classed('expanded', true).select('span').text('Show less')
}

function toggleBlipExpansion(blipItemDiv) {
  const description = blipItemDiv.select('.blip-list__item-container__description')
  const readMoreButton = blipItemDiv.select('.read-more-btn')
  const shouldExpand = !description.classed('expanded')

  if (shouldExpand) {
    expandBlipContainer(blipItemDiv, description, readMoreButton)
  } else {
    collapseExpandedBlips()
  }

  const isQuadrantView = d3.select('svg#radar-plot').classed('quadrant-view')
  if (isQuadrantView && window.innerWidth >= uiConfig.tabletViewWidth) {
    stickQuadrantOnScroll()
  }
}

function findBlipListContainer(blipId) {
  let selectedBlipContainer = d3.select(`.blip-list__item-container[data-blip-id="${blipId}"]`)
  if (selectedBlipContainer.empty()) {
    selectedBlipContainer = d3.select(`.blip-list__item-container[data-group-id="${blipId}"]`)
  }
  return selectedBlipContainer
}

function expandAndScrollToBlip(blipId, delay = 0) {
  setTimeout(() => {
    const selectedBlipContainer = findBlipListContainer(blipId)
    if (selectedBlipContainer.empty()) return

    expandBlipContainer(
      selectedBlipContainer,
      selectedBlipContainer.select('.blip-list__item-container__description'),
      selectedBlipContainer.select('.read-more-btn'),
    )

    if (window.innerWidth >= uiConfig.tabletViewWidth) {
      stickQuadrantOnScroll()
    }

    selectedBlipContainer.select('button.blip-list__item-container__name').node()?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, delay)
}

function fadeOutAllBlips() {
  d3.selectAll('g > a.blip-link').attr('opacity', 0.3)
}

function fadeInSelectedBlip(selectedBlipOnGraph) {
  selectedBlipOnGraph.attr('opacity', 1.0)
}

function highlightBlipInTable(selectedBlip) {
  selectedBlip.classed('highlight', true)
}

function highlightBlipInGraph(blipIdToFocus) {
  fadeOutAllBlips()
  const selectedBlipOnGraph = d3.select(`g > a.blip-link[data-blip-id='${blipIdToFocus}']`)
  fadeInSelectedBlip(selectedBlipOnGraph)
}

function renderBlipDescription(blip, ring, quadrant, tip, groupBlipTooltipText, quadrants) {
  let blipTableItem = d3.select(`.quadrant-table.${quadrant.order} ul[data-ring-order='${ring.order()}']`)
  if (!groupBlipTooltipText) {
    blipTableItem = blipTableItem.append('li').classed('blip-list__item', true)
    const blipItemDiv = blipTableItem
      .append('div')
      .classed('blip-list__item-container', true)
      .attr('data-blip-id', blip.id())

    if (blip.groupIdInGraph()) {
      blipItemDiv.attr('data-group-id', blip.groupIdInGraph())
    }

    const blipItemContainer = blipItemDiv
      .append('button')
      .classed('blip-list__item-container__name', true)
      .attr('aria-expanded', 'false')
      .attr('aria-controls', `blip-description-${blip.id()}`)
      .attr('aria-hidden', 'true')
      .attr('tabindex', -1)
      .on('click search-result-click', function (e) {
        e.stopPropagation()
        toggleBlipExpansion(blipItemDiv)
      })

    blipItemContainer
      .append('span')
      .classed('blip-list__item-container__name-value', true)
      .text(`${blip.blipText()}. ${blip.name()}`)
    blipItemContainer.append('span').classed('blip-list__item-container__name-arrow', true)

    blipItemDiv
      .append('div')
      .classed('blip-list__item-container__description', true)
      .attr('id', `blip-description-${blip.id()}`)
      .html(blip.description())

    const readMoreButton = blipItemDiv
      .append('button')
      .classed('read-more-btn', true)
      .attr('type', 'button')
      .attr('aria-controls', `blip-description-${blip.id()}`)
      .attr('aria-label', `Read more about ${blip.name()}`)
      .on('click', function (e) {
        e.stopPropagation()
        toggleBlipExpansion(blipItemDiv)
      })
    readMoreButton.append('span').text('Read more')

    if (blip.description() && quadrants) {
      const descriptionElement = document.getElementById(`blip-description-${blip.id()}`)
      if (descriptionElement) {
        enrichDescriptionLinks(descriptionElement, quadrants, appState.getCurrentVersionId())
      }
    }

    if (appState.isManifestMode()) {
      const history = blipItemDiv.append('div').classed('cmp-blip-history', true)
      history
        .append('a')
        .classed('ctaDefaultLink cmp__link-with-arrow', true)
        .attr('href', constructBlipDetailUrl(blip.slug() || blip.name()))
        .attr('aria-label', 'View blip history')
        .on('click', function (event) {
          event.preventDefault()
          event.stopPropagation()
          const { navigateToBlipDetail } = require('../blipDetail')
          navigateToBlipDetail(blip.slug() || blip.name(), appState.getCurrentVersionId())
        })
        .append('span')
        .classed('cta-name', true)
        .text('View blip history')
      history.select('a').append('span').classed('cta-arrow', true)

      renderRelatedBlipsList(blipItemDiv, blip.description(), appState.getCurrentVersionId(), blip.name())
    }
  }
  const blipGraphItem = d3.select(`g a#blip-link-${removeAllSpaces(blip.id())}`)
  const mouseOver = function (e) {
    const targetElement = e.target.classList.contains('blip-link') ? e.target : e.target.parentElement
    const isGroupIdInGraph = !targetElement.classList.contains('blip-link') ? true : false
    const blipWrapper = d3.select(targetElement)
    const blipIdToFocus = blip.groupIdInGraph() ? blipWrapper.attr('data-group-id') : blipWrapper.attr('data-blip-id')
    const selectedBlipOnGraph = d3.select(`g > a.blip-link[data-blip-id='${blipIdToFocus}']`)
    highlightBlipInGraph(blipIdToFocus)
    highlightBlipInTable(blipTableItem)

    const isQuadrantView = d3.select('svg#radar-plot').classed('quadrant-view')
    const displayToolTip = blip.isGroup() ? !isQuadrantView : !blip.groupIdInGraph()
    const toolTipText = blip.isGroup() ? groupBlipTooltipText : blip.name()

    if (displayToolTip && !isGroupIdInGraph) {
      tip.show(toolTipText, selectedBlipOnGraph.node())

      const selectedBlipCoords = selectedBlipOnGraph.node().getBoundingClientRect()

      const tipElement = d3.select('div.d3-tip')
      const tipElementCoords = tipElement.node().getBoundingClientRect()

      tipElement
        .style(
          'left',
          `${parseInt(
            selectedBlipCoords.left + window.scrollX - tipElementCoords.width / 2 + selectedBlipCoords.width / 2,
          )}px`,
        )
        .style('top', `${parseInt(selectedBlipCoords.top + window.scrollY - tipElementCoords.height)}px`)
    }
  }

  const mouseOut = function () {
    d3.selectAll('g > a.blip-link').attr('opacity', 1.0)
    blipTableItem.classed('highlight', false)
    tip.hide().style('left', 0).style('top', 0)
  }

  const blipClick = function (e) {
    const isQuadrantView = d3.select('svg#radar-plot').classed('quadrant-view')
    const targetElement = e.target.classList.contains('blip-link') ? e.target : e.target.parentElement
    const blipId = d3.select(targetElement).attr('data-blip-id')

    if (appState.isManifestMode()) {
      e.stopPropagation()
      highlightBlipInGraph(blipId)

      if (!isQuadrantView) {
        selectRadarQuadrant(quadrant.order, quadrant.startAngle, quadrant.quadrant.name())
      }

      expandAndScrollToBlip(blipId, isQuadrantView ? 0 : SELECT_QUADRANT_ANIMATION_DELAY)
      return
    }

    if (isQuadrantView) {
      e.stopPropagation()
    }

    highlightBlipInGraph(blipId)

    expandAndScrollToBlip(blipId, isQuadrantView ? 0 : SELECT_QUADRANT_ANIMATION_DELAY)
  }

  !groupBlipTooltipText &&
    blipTableItem.on('mouseover', mouseOver).on('mouseout', mouseOut).on('focusin', mouseOver).on('focusout', mouseOut)
  blipGraphItem
    .on('mouseover', mouseOver)
    .on('mouseout', mouseOut)
    .on('focusin', mouseOver)
    .on('focusout', mouseOut)
    .on('click', blipClick)
}

function renderQuadrantTables(quadrants, rings) {
  const radarContainer = d3.select('#radar')

  const quadrantTablesContainer = radarContainer.append('div').classed('quadrant-table__container', true)
  quadrants.forEach(function (quadrant) {
    const scale = getScale()
    let quadrantContainer
    if (window.innerWidth < uiConfig.tabletViewWidth && window.innerWidth >= uiConfig.mobileViewWidth) {
      quadrantContainer = quadrantTablesContainer
        .append('div')
        .classed('quadrant-table', true)
        .classed(quadrant.order, true)
        .style(
          'margin',
          `${
            graphConfig.quadrantHeight * scale +
            graphConfig.quadrantsGap * scale +
            graphConfig.quadrantsGap * 2 +
            uiConfig.legendsHeight
          }px auto 0px`,
        )
        .style('left', '0')
        .style('right', 0)
    } else {
      quadrantContainer = quadrantTablesContainer
        .append('div')
        .classed('quadrant-table', true)
        .classed(quadrant.order, true)
    }

    const ringNames = Array.from(
      new Set(
        quadrant.quadrant
          .blips()
          .map((blip) => blip.ring())
          .map((ring) => ring.name()),
      ),
    )
    ringNames.forEach(function (ringName) {
      quadrantContainer
        .append('h2')
        .classed('quadrant-table__ring-name', true)
        .attr('data-ring-name', ringName)
        .call((header) => {
          header.append('span').classed('quadrant-table__ring-name-label', true).text(ringName)
          renderRingTooltip(header, ringName, `${quadrant.order}-${ringName}`)
        })
      quadrantContainer
        .append('ul')
        .classed('blip-list', true)
        .attr('data-ring-order', rings.filter((ring) => ring.name() === ringName)[0].order())
    })
  })
}

module.exports = {
  renderQuadrantTables,
  renderBlipDescription,
}
