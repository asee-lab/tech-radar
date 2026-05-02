const Chance = require('chance')
const { graphConfig } = require('./config')
const { toRadian } = require('../util/mathUtils')
const { renderBlipDescription } = require('./components/quadrantTables')
const Blip = require('../models/blip')
const isEmpty = require('lodash/isEmpty')
const { replaceSpaceWithHyphens, removeAllSpaces } = require('../util/stringUtil')
const RingCalculator = require('../util/ringCalculator')
const config = require('../config')
const featureToggles = config().featureToggles
const _ = {
  sortBy: require('lodash/sortBy'),
}

// Ring radii match what quadrants.js draws: same RING_RATIOS table, same
// multiplier (effectiveQuadrantWidth = CENTER = quadrantWidth + quadrantsGap/2).
const getRingRadius = function (ringIndex) {
  const radius = RingCalculator.RING_RATIOS[ringIndex] * graphConfig.effectiveQuadrantWidth
  return radius || 0
}

function getBorderWidthOffset(quadrantOrder, adjustY, adjustX) {
  let borderWidthYOffset = 0,
    borderWidthXOffset = 0

  if (quadrantOrder !== 'first') {
    borderWidthYOffset = adjustY < 0 ? 0 : graphConfig.quadrantsGap
    borderWidthXOffset = adjustX > 0 ? graphConfig.quadrantsGap : 0
  }
  return { borderWidthYOffset, borderWidthXOffset }
}

function calculateRadarBlipCoordinates(minRadius, maxRadius, startAngle, quadrantOrder, chance, blip) {
  const adjustX = Math.sin(toRadian(startAngle)) - Math.cos(toRadian(startAngle))
  const adjustY = -Math.cos(toRadian(startAngle)) - Math.sin(toRadian(startAngle))
  const { borderWidthYOffset, borderWidthXOffset } = getBorderWidthOffset(quadrantOrder, adjustY, adjustX)
  const radius = chance.floating({
    min: minRadius + blip.width / 2,
    max: maxRadius - blip.width,
  })

  let angleDelta = (Math.asin(blip.width / 2 / radius) * 180) / (Math.PI - 1.25)
  angleDelta = angleDelta > 45 ? 45 : angleDelta
  const angle = toRadian(chance.integer({ min: angleDelta, max: 90 - angleDelta }))

  let x = graphConfig.quadrantWidth + radius * Math.cos(angle) * adjustX + borderWidthXOffset
  let y = graphConfig.quadrantHeight + radius * Math.sin(angle) * adjustY + borderWidthYOffset

  return avoidBoundaryCollision(x, y, adjustX, adjustY)
}

function thereIsCollision(coordinates, allCoordinates, blipWidth) {
  return allCoordinates.some(function (currentCoordinates) {
    return (
      Math.abs(currentCoordinates.coordinates[0] - coordinates[0]) <
        currentCoordinates.width / 2 + blipWidth / 2 + 10 &&
      Math.abs(currentCoordinates.coordinates[1] - coordinates[1]) < currentCoordinates.width / 2 + blipWidth / 2 + 10
    )
  })
}

function avoidBoundaryCollision(x, y, adjustX, adjustY) {
  const size = graphConfig.quadrantWidth * 2 + graphConfig.quadrantsGap
  if (
    (adjustY > 0 && y + graphConfig.blipWidth > size) ||
    (adjustY < 0 && y + graphConfig.blipWidth > graphConfig.quadrantHeight)
  ) {
    y = y - graphConfig.blipWidth
  }
  if (adjustX < 0 && x - graphConfig.blipWidth > graphConfig.quadrantWidth) {
    x += graphConfig.blipWidth
  }
  if (adjustX > 0 && x + graphConfig.blipWidth < graphConfig.quadrantWidth + graphConfig.quadrantsGap) {
    x -= graphConfig.blipWidth
  }
  return [x, y]
}

function findBlipCoordinates(blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing, quadrantOrder) {
  const maxIterations = 200
  const chance = new Chance(
    Math.PI *
      graphConfig.quadrantWidth *
      graphConfig.quadrantHeight *
      graphConfig.quadrantsGap *
      graphConfig.blipWidth *
      maxIterations,
  )
  let coordinates = calculateRadarBlipCoordinates(minRadius, maxRadius, startAngle, quadrantOrder, chance, blip)
  let iterationCounter = 0
  let foundAPlace = false

  while (iterationCounter < maxIterations) {
    if (thereIsCollision(coordinates, allBlipCoordinatesInRing, blip.width)) {
      coordinates = calculateRadarBlipCoordinates(minRadius, maxRadius, startAngle, quadrantOrder, chance, blip)
    } else {
      foundAPlace = true
      break
    }
    iterationCounter++
  }
  if (!featureToggles.UIRefresh2022 && !foundAPlace && blip.width > graphConfig.minBlipWidth) {
    blip.width = blip.width - 1
    blip.scale = Math.max((blip.scale || 1) - 0.1, 0.7)
    return findBlipCoordinates(blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing, quadrantOrder)
  } else {
    return coordinates
  }
}

// --- New placement algorithm (UIRefresh2022) ---
//
// Goals:
//   1. Blip icons never extend beyond the ring band (inner / outer arc).
//   2. Blip icons stay clear of the quadrant axes (the cross hairs).
//   3. Blips never overlap nor touch each other (Euclidean check + padding).
//
// Strategy:
//   a) Try a deterministic grid of candidate positions (3 radial layers ×
//      N angular slots). This finds clean placements even in dense rings.
//   b) Fall back to seeded random sampling if no grid slot works.
//   c) As a last resort, shrink the blip a touch and retry.
//
// We do NOT do post-hoc boundary nudging — every candidate is constructed
// to fit by construction.

const RING_PADDING = 4 // px clearance from inner / outer ring arc
const AXIS_PADDING = 4 // px clearance from the inset edge of the quadrant rectangle
const BLIP_PADDING = 4 // extra separation between blip envelopes
// Worst-case visual envelope radius across all blip statuses:
//   - "no change" / regular: inner solid disc only, r = 12
//   - "moved in" / "moved out": inner disc + partial outer arc on a 36×36 box,
//     outer extent r = 18
//   - "new": inner disc + full outer ring on a 36×36 box, outer extent r = 18
// The drawn centre is also offset by ~2 px from the logical (x, y) because the
// group is translated to (x-16, y-16) while the inner disc and outer ring are
// drawn at (cx, cy) = (18, 18). 18 + 2 = 20 covers the worst case for both
// ring/axis clearance and pairwise collision, regardless of blip status.
const EFFECTIVE_RADIUS = 20

function quadrantAdjustments(startAngle) {
  return {
    adjustX: Math.sin(toRadian(startAngle)) - Math.cos(toRadian(startAngle)),
    adjustY: -Math.cos(toRadian(startAngle)) - Math.sin(toRadian(startAngle)),
  }
}

function polarToCartesian(radius, angle, startAngle) {
  // The ring arcs are translated to (effectiveQuadrantWidth, effectiveQuadrantHeight),
  // which is the meeting point of all four quadrant rectangles. Place blips relative
  // to that same origin so a polar `radius` exactly equals the on-screen distance
  // from the radar centre.
  const cx = graphConfig.effectiveQuadrantWidth
  const cy = graphConfig.effectiveQuadrantHeight
  const { adjustX, adjustY } = quadrantAdjustments(startAngle)
  const x = cx + radius * Math.cos(angle) * adjustX
  const y = cy + radius * Math.sin(angle) * adjustY
  return [x, y]
}

function cartesianToLocalPolar(x, y, startAngle) {
  const cx = graphConfig.effectiveQuadrantWidth
  const cy = graphConfig.effectiveQuadrantHeight
  const { adjustX, adjustY } = quadrantAdjustments(startAngle)
  const dx = (x - cx) * adjustX
  const dy = (y - cy) * adjustY
  return { r: Math.hypot(dx, dy), a: Math.atan2(dy, dx), adjustX, adjustY, cx, cy }
}

// Worst-case pairwise separation between drawn blip centres. We use the same
// EFFECTIVE_RADIUS for every blip so the largest possible envelope (the "new"
// status outer ring) is always honoured, regardless of which two statuses
// happen to land next to each other.
function pairSeparation() {
  return 2 * EFFECTIVE_RADIUS + BLIP_PADDING
}

// Smallest radius at which a blip's axis clearance is geometrically possible.
// At r = axisHalfChord*sqrt(2) the only valid angle is exactly PI/4 (aMin == aMax),
// so we add a tiny epsilon to keep a usable angular wedge.
function minUsableRadius() {
  return axisHalfChord() * Math.SQRT2 + 1e-3
}

// Force-directed relaxation: gently nudge colliding blips apart while clamping
// them to the ring band and the quadrant wedge. Converges in ~10-30 iterations.
function relaxBlipsInRing(allCoords, ringIndex, startAngle) {
  if (allCoords.length < 2) return
  const innerArc = getRingRadius(ringIndex)
  const outerArc = getRingRadius(ringIndex + 1)
  // 60 iterations is enough for sparsely populated rings, but in the worst
  // case (e.g. 5 new/moved blips packed against the inset axes of Adopt)
  // boundary clamping eats half of each push, so we give the algorithm more
  // budget. Empirically converges well below 200 iterations even in the
  // densest configuration.
  const MAX_ITER = 200
  const need = pairSeparation()
  // Inner clamp must respect BOTH the ring band AND the axis-clearance
  // geometry. Otherwise a blip pushed toward the radar centre gets clamped
  // to a radius where no angle satisfies both axis constraints, and the
  // angle clamp then snaps it onto the inset stripe cross.
  const minR = Math.max(innerArc + RING_PADDING + EFFECTIVE_RADIUS, minUsableRadius())
  const maxR = outerArc - RING_PADDING - EFFECTIVE_RADIUS

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let maxMove = 0
    for (let i = 0; i < allCoords.length; i++) {
      const a = allCoords[i]
      let fx = 0
      let fy = 0
      for (let j = 0; j < allCoords.length; j++) {
        if (i === j) continue
        const b = allCoords[j]
        const dx = a.coordinates[0] - b.coordinates[0]
        const dy = a.coordinates[1] - b.coordinates[1]
        const d = Math.hypot(dx, dy)
        if (d > 0 && d < need) {
          const overlap = need - d
          fx += (dx / d) * overlap * 0.5
          fy += (dy / d) * overlap * 0.5
        } else if (d === 0) {
          // Coincident — push i in an arbitrary direction
          fx += BLIP_PADDING * 0.5
          fy += BLIP_PADDING * 0.5
        }
      }
      if (fx === 0 && fy === 0) continue

      let nx = a.coordinates[0] + fx
      let ny = a.coordinates[1] + fy

      // Clamp the new position to the ring band and quadrant wedge using the
      // same envelopes as the placement step (EFFECTIVE_RADIUS for ring arcs,
      // axisHalfChord() for the inset axes, minUsableRadius() to avoid the
      // degenerate "no angle satisfies both axes" zone near the centre).
      const lp = cartesianToLocalPolar(nx, ny, startAngle)
      const r = Math.max(minR, Math.min(maxR, lp.r))
      const ac = angleClearanceFromAxis(r)
      const aMin = ac
      const aMax = Math.PI / 2 - ac
      const angle = Math.max(aMin, Math.min(aMax, lp.a))
      nx = lp.cx + r * Math.cos(angle) * lp.adjustX
      ny = lp.cy + r * Math.sin(angle) * lp.adjustY

      const moved = Math.hypot(nx - a.coordinates[0], ny - a.coordinates[1])
      if (moved > maxMove) maxMove = moved
      a.coordinates[0] = nx
      a.coordinates[1] = ny
    }
    if (maxMove < 0.1) break
  }
}

function isClearOfOthers(coords, allCoords /*, blipWidth */) {
  const need = pairSeparation()
  const need2 = need * need
  for (let idx = 0; idx < allCoords.length; idx++) {
    const other = allCoords[idx]
    const dx = coords[0] - other.coordinates[0]
    const dy = coords[1] - other.coordinates[1]
    if (dx * dx + dy * dy < need2) return false
  }
  return true
}

function getRingPolarBounds(ringIndex /*, blip */) {
  // For the innermost ring (Adopt) the geometric inner bound + envelope
  // (e.g. 0 + 4 + 20 = 24) is smaller than the smallest radius where axis
  // clearance is even possible. Without this guard the sampler can return
  // angles that satisfy `aMin == aMax == PI/2`, which makes the relaxation
  // step snap blips onto the inset stripe cross.
  const innerR = Math.max(getRingRadius(ringIndex) + RING_PADDING + EFFECTIVE_RADIUS, minUsableRadius())
  const outerR = getRingRadius(ringIndex + 1) - RING_PADDING - EFFECTIVE_RADIUS
  return { innerR, outerR }
}

// Minimum perpendicular distance from the radar centre that a blip's drawn
// centre must keep on each axis. The quadrant rectangles are inset from the
// radar centre by `quadrantsGap / 2`, so an axis-clearance based purely on
// the geometric axis through the centre lets the disc spill into the visible
// stripe cross. We reserve gap/2 for the inset, plus EFFECTIVE_RADIUS for the
// blip envelope, plus AXIS_PADDING for breathing room.
function axisHalfChord() {
  return graphConfig.quadrantsGap / 2 + EFFECTIVE_RADIUS + AXIS_PADDING
}

function angleClearanceFromAxis(radius /*, blipWidth */) {
  const halfChord = axisHalfChord()
  if (radius <= halfChord) return Math.PI / 2 // band too thin near origin
  return Math.asin(Math.min(1, halfChord / radius))
}

// Visit order that maximises spread (e.g., for n=8 → [0,4,2,6,1,5,3,7]).
function bitReversedSequence(n) {
  const out = []
  const seen = new Set()
  let step = n
  while (step >= 1) {
    for (let i = 0; i < n; i += step) {
      if (!seen.has(i)) {
        out.push(i)
        seen.add(i)
      }
    }
    step = step / 2
    if (!Number.isInteger(step) && step >= 1) step = Math.floor(step)
  }
  for (let i = 0; i < n; i++) if (!seen.has(i)) out.push(i)
  return out
}

function findClearPlacement(blip, ringIndex, startAngle, quadrantOrder, allBlipCoordinatesInRing) {
  let { innerR, outerR } = getRingPolarBounds(ringIndex, blip)
  if (outerR <= innerR) {
    // Band narrower than the blip — nothing fits cleanly.
    // Place at band centre, deterministic angle, accept overlap.
    const bandWidth = getRingRadius(ringIndex + 1) - getRingRadius(ringIndex)
    console.warn(
      `Radar ring ${ringIndex} is geometrically too narrow for blips: band width ${bandWidth.toFixed(1)}px ` +
        `< required ${(2 * (RING_PADDING + EFFECTIVE_RADIUS)).toFixed(1)}px. Blips will overlap.`,
    )
    const r = (getRingRadius(ringIndex) + getRingRadius(ringIndex + 1)) / 2
    return polarToCartesian(r, Math.PI / 4, startAngle)
  }

  const seed =
    Math.PI *
    graphConfig.quadrantWidth *
    graphConfig.quadrantHeight *
    graphConfig.quadrantsGap *
    graphConfig.blipWidth *
    (ringIndex + 1) *
    (allBlipCoordinatesInRing.length + 1)
  const chance = new Chance(Math.floor(seed))

  const sample = () => {
    const r = chance.floating({ min: innerR, max: outerR })
    const ac = angleClearanceFromAxis(r)
    const aMin = ac
    const aMax = Math.PI / 2 - ac
    if (aMax <= aMin) return null
    const a = chance.floating({ min: aMin, max: aMax })
    return polarToCartesian(r, a, startAngle)
  }

  // 1. Seeded random sampling — return the first strictly-clear position.
  //    With organic randomness this produces a natural-looking distribution.
  for (let i = 0; i < 1000; i++) {
    const coords = sample()
    if (coords && isClearOfOthers(coords, allBlipCoordinatesInRing)) {
      return coords
    }
  }

  // 2. Deterministic candidate grid (3 radial layers × 18 angular slots,
  //    bit-reversed iteration so successive blips land far apart).
  const layers = 3
  const candPerLayer = 18
  const visitOrder = bitReversedSequence(candPerLayer)
  for (let li = 0; li < layers; li++) {
    const layerR = innerR + ((outerR - innerR) * (li + 0.5)) / layers
    if (layerR < innerR || layerR > outerR) continue
    const ac = angleClearanceFromAxis(layerR)
    const aMin = ac
    const aMax = Math.PI / 2 - ac
    if (aMax <= aMin) continue
    const phase = chance.floating({ min: 0, max: 1 })
    for (let k = 0; k < visitOrder.length; k++) {
      const t = ((visitOrder[k] + phase) % candPerLayer) / candPerLayer
      const a = aMin + (aMax - aMin) * t
      const coords = polarToCartesian(layerR, a, startAngle)
      if (isClearOfOthers(coords, allBlipCoordinatesInRing)) {
        return coords
      }
    }
  }

  // 3. Best-of-N fallback — when no fully-clear position exists, pick the
  //    candidate that maximises the distance to its nearest neighbour.
  //    This degrades gracefully (small overlaps if the ring is truly full)
  //    without shrinking the blip itself.
  let best = null
  let bestMinDist = -1
  for (let i = 0; i < 500; i++) {
    const coords = sample()
    if (!coords) continue
    let minDist = Infinity
    for (let j = 0; j < allBlipCoordinatesInRing.length; j++) {
      const other = allBlipCoordinatesInRing[j]
      const dx = coords[0] - other.coordinates[0]
      const dy = coords[1] - other.coordinates[1]
      const d2 = dx * dx + dy * dy
      if (d2 < minDist) minDist = d2
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist
      best = coords
    }
  }
  if (best) return best

  // Final last resort.
  const r = (innerR + outerR) / 2
  return polarToCartesian(r, Math.PI / 4, startAngle)
}

function blipAssistiveText(blip) {
  return blip.isGroup()
    ? `\`${blip.ring().name()} ring, group of ${blip.blipText()}`
    : `${blip.ring().name()} ring, ${blip.name()}, ${blip.status()}.`
}
function addOuterCircle(parentSvg, order, scale = 1) {
  parentSvg
    .append('path')
    .attr('opacity', '1')
    .attr('class', order)
    .attr(
      'd',
      'M18 36C8.07 36 0 27.93 0 18S8.07 0 18 0c9.92 0 18 8.07 18 18S27.93 36 18 36zM18 3.14C9.81 3.14 3.14 9.81 3.14 18S9.81 32.86 18 32.86S32.86 26.19 32.86 18S26.19 3.14 18 3.14z',
    )
    .style('transform', `scale(${scale})`)
}

function addMovedInLine(parentSvg, order, scale = 1) {
  let path

  switch (order) {
    case 'first':
      path =
        'M16.5 34.44c0-.86.7-1.56 1.56-1.56c8.16 0 14.8-6.64 14.8-14.8c0-.86.7-1.56 1.56-1.56c.86 0 1.56.7 1.56 1.56C36 27.96 27.96 36 18.07 36C17.2 36 16.5 35.3 16.5 34.44z'
      break
    case 'second':
      path =
        'M16.5 1.56c0 .86.7 1.56 1.56 1.56c8.16 0 14.8 6.64 14.8 14.8c0 .86.7 1.56 1.56 1.56c.86 0 1.56-.7 1.56-1.56C36 8.04 27.96 0 18.07 0C17.2 0 16.5.7 16.5 1.56z'
      break
    case 'third':
      path =
        'M19.5 34.44c0-.86-.7-1.56-1.56-1.56c-8.16 0-14.8-6.64-14.8-14.8c0-.86-.7-1.56-1.56-1.56S0 17.2 0 18.07C0 27.96 8.04 36 17.93 36C18.8 36 19.5 35.3 19.5 34.44z'
      break
    case 'fourth':
      path =
        'M19.5 1.56c0 0.86-0.7 1.56-1.56 1.56c-8.16 0-14.8 6.64-14.8 14.8c0 0.86-0.7 1.56-1.56 1.56S0 18.8 0 17.93C0 8.04 8.04 0 17.93 0C18.8 0 19.5 0.7 19.5 1.56z'
      break
  }

  parentSvg
    .append('path')
    .attr('opacity', '1')
    .attr('class', order)
    .attr('d', path)
    .style('transform', `scale(${scale})`)
}

function addMovedOutLine(parentSvg, order, scale = 1) {
  let path

  switch (order) {
    case 'first':
      path =
        'M19.5 1.56c0 0.86-0.7 1.56-1.56 1.56c-8.16 0-14.8 6.64-14.8 14.8c0 0.86-0.7 1.56-1.56 1.56S0 18.8 0 17.93C0 8.04 8.04 0 17.93 0C18.8 0 19.5 0.7 19.5 1.56z'
      break
    case 'second':
      path =
        'M19.5 34.44c0-.86-.7-1.56-1.56-1.56c-8.16 0-14.8-6.64-14.8-14.8c0-.86-.7-1.56-1.56-1.56S0 17.2 0 18.07C0 27.96 8.04 36 17.93 36C18.8 36 19.5 35.3 19.5 34.44z'
      break
    case 'third':
      path =
        'M16.5 1.56c0 .86.7 1.56 1.56 1.56c8.16 0 14.8 6.64 14.8 14.8c0 .86.7 1.56 1.56 1.56c.86 0 1.56-.7 1.56-1.56C36 8.04 27.96 0 18.07 0C17.2 0 16.5.7 16.5 1.56z'
      break
    case 'fourth':
      path =
        'M16.5 34.44c0-.86.7-1.56 1.56-1.56c8.16 0 14.8-6.64 14.8-14.8c0-.86.7-1.56 1.56-1.56c.86 0 1.56.7 1.56 1.56C36 27.96 27.96 36 18.07 36C17.2 36 16.5 35.3 16.5 34.44z'
      break
  }

  parentSvg
    .append('path')
    .attr('opacity', '1')
    .attr('class', order)
    .attr('d', path)
    .style('transform', `scale(${scale})`)
}

function drawBlipCircle(group, blip, xValue, yValue, order) {
  group
    .attr('transform', `scale(1) translate(${xValue - 16}, ${yValue - 16})`)
    .attr('aria-label', blipAssistiveText(blip))
  group
    .append('circle')
    .attr('r', '12')
    .attr('cx', '18')
    .attr('cy', '18')
    .attr('class', order)
    .style('transform', `scale(${blip.scale || 1})`)
}

function newBlip(blip, xValue, yValue, order, group) {
  drawBlipCircle(group, blip, xValue, yValue, order)
  addOuterCircle(group, order, blip.scale)
}

function movedInBlip(blip, xValue, yValue, order, group) {
  drawBlipCircle(group, blip, xValue, yValue, order)
  addMovedInLine(group, order, blip.scale)
}

function movedOutBlip(blip, xValue, yValue, order, group) {
  drawBlipCircle(group, blip, xValue, yValue, order)
  addMovedOutLine(group, order, blip.scale)
}

function existingBlip(blip, xValue, yValue, order, group) {
  drawBlipCircle(group, blip, xValue, yValue, order)
}

function groupBlip(blip, xValue, yValue, order, group) {
  group.attr('transform', `scale(1) translate(${xValue}, ${yValue})`).attr('aria-label', blipAssistiveText(blip))
  group
    .append('rect')
    .attr('x', '1')
    .attr('y', '1')
    .attr('rx', '12')
    .attr('ry', '12')
    .attr('width', blip.groupBlipWidth())
    .attr('height', graphConfig.groupBlipHeight)
    .attr('class', order)
    .style('transform', `scale(${blip.scale || 1})`)
}

function drawBlipInCoordinates(blip, coordinates, order, quadrantGroup) {
  let x = coordinates[0]
  let y = coordinates[1]

  const blipId = removeAllSpaces(blip.id())

  const group = quadrantGroup
    .append('g')
    .append('a')
    .attr('href', 'javascript:void(0)')
    .attr('class', 'blip-link')
    .attr('id', 'blip-link-' + blipId)
    .attr('data-blip-id', blipId)
    .attr('data-ring-name', blip.ring().name())

  if (blip.isGroup()) {
    groupBlip(blip, x, y, order, group)
  } else if (blip.isNew()) {
    newBlip(blip, x, y, order, group)
  } else if (blip.hasMovedIn()) {
    movedInBlip(blip, x, y, order, group)
  } else if (blip.hasMovedOut()) {
    movedOutBlip(blip, x, y, order, group)
  } else {
    existingBlip(blip, x, y, order, group)
  }

  group
    .append('text')
    .attr('x', blip.isGroup() ? (blip.isNew() ? 45 : 64) : 18)
    .attr('y', blip.isGroup() ? 17 : 23)
    .style('font-size', '12px')
    .attr('font-style', 'normal')
    .attr('font-weight', 'bold')
    .attr('fill', 'white')
    .text(blip.blipText())
    .style('text-anchor', 'middle')
    .style('transform', `scale(${blip.scale || 1})`)
}

function getGroupBlipTooltipText(ringBlips) {
  let tooltipText = 'Click to view all'
  if (ringBlips.length <= 15) {
    tooltipText = ringBlips.reduce((toolTip, blip) => {
      toolTip += blip.id() + '. ' + blip.name() + '</br>'
      return toolTip
    }, '')
  }
  return tooltipText
}

const findExistingBlipCoords = function (ringIndex, deg) {
  const blipWidth = graphConfig.existingGroupBlipWidth
  const ringWidth = getRingRadius(ringIndex) - getRingRadius(ringIndex - 1)
  const halfRingRadius = getRingRadius(ringIndex) - ringWidth / 2
  const x = graphConfig.quadrantWidth - halfRingRadius * Math.cos(toRadian(deg)) - blipWidth / 2
  const y = graphConfig.quadrantHeight - halfRingRadius * Math.sin(toRadian(deg))
  return [x, y]
}

function findNewBlipCoords(existingCoords) {
  const groupBlipGap = 5
  const offsetX = graphConfig.existingGroupBlipWidth - graphConfig.newGroupBlipWidth
  const offsetY = graphConfig.groupBlipHeight + groupBlipGap
  return [existingCoords[0] + offsetX, existingCoords[1] - offsetY]
}

const groupBlipsBaseCoords = function (ringIndex) {
  const existingCoords = findExistingBlipCoords(ringIndex + 1, graphConfig.groupBlipAngles[ringIndex])

  return {
    existing: existingCoords,
    new: findNewBlipCoords(existingCoords),
  }
}

const transposeQuadrantCoords = function (coords, blipWidth) {
  const transposeX = graphConfig.effectiveQuadrantWidth * 2 - coords[0] - blipWidth
  const transposeY = graphConfig.effectiveQuadrantHeight * 2 - coords[1] - graphConfig.groupBlipHeight
  return {
    first: coords,
    second: [coords[0], transposeY],
    third: [transposeX, coords[1]],
    fourth: [transposeX, transposeY],
  }
}

function createGroupBlip(blipsInRing, blipType, ring, quadrantOrder) {
  const blipText = `${blipsInRing.length} ${blipType} blips`
  const blipId = `${quadrantOrder}-${replaceSpaceWithHyphens(ring.name())}-group-${replaceSpaceWithHyphens(
    blipType,
  )}-blips`
  const groupBlip = new Blip(blipText, ring, blipsInRing[0].isNew(), '', '')
  groupBlip.setBlipText(blipText)
  groupBlip.setId(blipId)
  groupBlip.setIsGroup(true)
  return groupBlip
}

function plotGroupBlips(ringBlips, ring, quadrantOrder, parentElement, quadrantWrapper, tooltip, quadrants) {
  let newBlipsInRing = [],
    existingBlipsInRing = []
  ringBlips.forEach((blip) => {
    blip.isNew() ? newBlipsInRing.push(blip) : existingBlipsInRing.push(blip)
  })

  const blipGroups = [newBlipsInRing, existingBlipsInRing].filter((group) => !isEmpty(group))
  blipGroups.forEach((blipsInRing) => {
    const blipType = blipsInRing[0].isNew() ? 'new' : 'existing'
    const groupBlip = createGroupBlip(blipsInRing, blipType, ring, quadrantOrder)
    const groupBlipTooltipText = getGroupBlipTooltipText(blipsInRing)
    const ringIndex = graphConfig.rings.indexOf(ring.name())
    const baseCoords = groupBlipsBaseCoords(ringIndex)[blipType]
    const blipCoordsForCurrentQuadrant = transposeQuadrantCoords(baseCoords, groupBlip.groupBlipWidth())[quadrantOrder]
    drawBlipInCoordinates(groupBlip, blipCoordsForCurrentQuadrant, quadrantOrder, parentElement)
    renderBlipDescription(groupBlip, ring, quadrantWrapper, tooltip, groupBlipTooltipText, quadrants)
    blipsInRing.forEach(function (blip) {
      blip.setGroupIdInGraph(groupBlip.id())
      renderBlipDescription(blip, ring, quadrantWrapper, tooltip, null, quadrants)
    })
  })
}

const plotRadarBlips = function (parentElement, rings, quadrantWrapper, tooltip, quadrants) {
  let blips, quadrant, startAngle, quadrantOrder

  quadrant = quadrantWrapper.quadrant
  startAngle = quadrantWrapper.startAngle
  quadrantOrder = quadrantWrapper.order

  blips = quadrant.blips()
  rings.forEach(function (ring, i) {
    const ringBlips = blips.filter(function (blip) {
      return blip.ring() === ring
    })

    if (ringBlips.length === 0) {
      return
    }

    let allBlipCoordsInRing = []

    if (ringBlips.length > graphConfig.maxBlipsInRings[i]) {
      plotGroupBlips(ringBlips, ring, quadrantOrder, parentElement, quadrantWrapper, tooltip, quadrants)
      return
    }

    // Calculate coordinates for blips using the strict-clearance algorithm…
    ringBlips.forEach(function (blip) {
      const coordinates = findClearPlacement(blip, i, startAngle, quadrantOrder, allBlipCoordsInRing)
      allBlipCoordsInRing.push({ coordinates, width: blip.width })
    })

    // …then run a force-directed relaxation pass to resolve any near-collisions
    // that the per-blip greedy algorithm couldn't avoid.
    relaxBlipsInRing(allBlipCoordsInRing, i, startAngle)

    // Sort the coordinates
    allBlipCoordsInRing = sortBlipCoordinates(allBlipCoordsInRing, quadrantOrder)

    // Draw blips using sorted coordinates
    allBlipCoordsInRing.forEach(function (blipCoords, i) {
      drawBlipInCoordinates(ringBlips[i], blipCoords.coordinates, quadrantOrder, parentElement)
      renderBlipDescription(ringBlips[i], ring, quadrantWrapper, tooltip, null, quadrants)
    })
  })
}

const sortBlipCoordinates = function (blipCoordinates, quadrantOrder) {
  return _.sortBy(blipCoordinates, (coord) => calculateAngleFromAxis(coord, quadrantOrder))
}

const calculateAngleFromAxis = function (position, quadrantOrder) {
  const [x, y] = position.coordinates

  const transposedX = x - graphConfig.effectiveQuadrantWidth
  const transposedY = y - graphConfig.effectiveQuadrantHeight

  if (quadrantOrder === 'first' || quadrantOrder === 'third') {
    return Math.atan2(transposedY, transposedX)
  }
  return Math.atan2(transposedX, transposedY)
}

module.exports = {
  calculateRadarBlipCoordinates,
  plotRadarBlips,
  getRingRadius,
  groupBlipsBaseCoords,
  transposeQuadrantCoords,
  getGroupBlipTooltipText,
  blipAssistiveText,
  createGroupBlip,
  thereIsCollision,
  sortBlipCoordinates,
  findClearPlacement,
  relaxBlipsInRing,
  getRingPolarBounds,
  axisHalfChord,
  pairSeparation,
  EFFECTIVE_RADIUS,
  RING_PADDING,
  AXIS_PADDING,
  BLIP_PADDING,
}
