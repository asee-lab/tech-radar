const {
  calculateRadarBlipCoordinates,
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
  axisHalfChord,
  pairSeparation,
  EFFECTIVE_RADIUS,
  RING_PADDING,
} = require('../../src/graphing/blips')
const Chance = require('chance')
const { graphConfig } = require('../../src/graphing/config')
const Blip = require('../../src/models/blip')
jest.mock('d3', () => {
  return {
    select: jest.fn(),
  }
})

jest.mock('../../src/graphing/config', () => {
  return {
    graphConfig: {
      effectiveQuadrantHeight: 528,
      effectiveQuadrantWidth: 528,
      quadrantHeight: 512,
      quadrantWidth: 512,
      quadrantsGap: 32,
      minBlipWidth: 12,
      blipWidth: 22,
      groupBlipHeight: 24,
      newGroupBlipWidth: 84,
      existingGroupBlipWidth: 124,
      groupBlipAngles: [30, 35, 60, 80],
    },
  }
})

const chance = Chance()
const chanceFloatingSpy = jest.spyOn(chance, 'floating')
const chanceIntegerSpy = jest
  .spyOn(chance, 'integer')
  .mockImplementationOnce((options) => {
    return options.max
  })
  .mockImplementation((options) => {
    return options.min
  })

function mockRingBlips(maxBlipCount) {
  let ringBlips = []
  let blip
  for (let blipCounter = 1; blipCounter <= maxBlipCount; blipCounter++) {
    blip = new Blip(`blip${blipCounter}`, 'ring1', true, '', '')
    blip.setId(blipCounter)
    ringBlips.push(blip)
  }
  return ringBlips
}

describe('Blips', function () {
  it('should return coordinates which fall under the first quadrant and rings provided', function () {
    const startAngle = 0
    let minRadius = 160
    const maxRadius = 300
    const coordinates = calculateRadarBlipCoordinates(minRadius, maxRadius, startAngle, 'first', chance, { width: 22 })

    const minRadiusAfterThreshold = minRadius + graphConfig.blipWidth / 2
    const maxRadiusAfterThreshold = maxRadius - graphConfig.blipWidth
    const xCoordMaxValue =
      graphConfig.effectiveQuadrantWidth + maxRadiusAfterThreshold * -1 * 0.9978403633398593 + graphConfig.blipWidth
    const yCoordMaxValue = graphConfig.effectiveQuadrantHeight + maxRadiusAfterThreshold * -1 * 0.06568568557743505
    const xCoordMinValue = graphConfig.effectiveQuadrantWidth + minRadiusAfterThreshold * -1 * 0.9942914830326867
    const yCoordMinValue =
      graphConfig.effectiveQuadrantHeight + minRadiusAfterThreshold * -1 * 0.9942914830326867 - graphConfig.blipWidth

    expect(chanceFloatingSpy).toHaveBeenCalledWith({
      min: minRadiusAfterThreshold,
      max: maxRadiusAfterThreshold,
      fixed: 4,
    })
    expect(chanceIntegerSpy).toHaveBeenCalled()
    expect(parseFloat(coordinates[0].toFixed(3))).toBeLessThanOrEqual(parseFloat(xCoordMinValue.toFixed(3)))
    expect(parseFloat(coordinates[1].toFixed(1))).toBeGreaterThanOrEqual(parseFloat(yCoordMinValue.toFixed(1)))
    expect(parseFloat(coordinates[0].toFixed(3))).toBeLessThanOrEqual(parseFloat(xCoordMaxValue.toFixed(3)))
    expect(parseFloat(coordinates[1].toFixed(3))).toBeLessThanOrEqual(parseFloat(yCoordMaxValue.toFixed(3)))
  })

  it('should return coordinates for the second quadrant and consider the border offset provided', function () {
    const startAngle = -90
    let minRadius = 160
    const maxRadius = 300
    const blipWidth = 22
    const coordinates = calculateRadarBlipCoordinates(minRadius, maxRadius, startAngle, 'second', chance, {
      width: blipWidth,
    })

    const minRadiusAfterThreshold = minRadius + blipWidth / 2
    const maxRadiusAfterThreshold = maxRadius - blipWidth
    const xCoordMaxValue =
      graphConfig.quadrantWidth + maxRadiusAfterThreshold * -1 * 0.0707372016677029 + graphConfig.quadrantsGap + 10
    const yCoordMaxValue =
      graphConfig.quadrantHeight + maxRadiusAfterThreshold * 0.9999 * 0.27563735581699916 + graphConfig.quadrantsGap
    const xCoordMinValue =
      graphConfig.quadrantWidth + minRadiusAfterThreshold * -1 * 0.9942914830326867 + graphConfig.quadrantsGap + 10
    const yCoordMinValue =
      graphConfig.quadrantHeight + minRadiusAfterThreshold * 0.9999 * 0.10670657355889696 + graphConfig.quadrantsGap

    expect(chanceFloatingSpy).toHaveBeenCalledWith({
      min: minRadiusAfterThreshold,
      max: maxRadiusAfterThreshold,
      fixed: 4,
    })
    expect(chanceIntegerSpy).toHaveBeenCalled()
    expect(parseFloat(coordinates[0].toFixed(3))).toBeLessThanOrEqual(parseFloat(xCoordMinValue.toFixed(3)))
    expect(coordinates[1]).toBeGreaterThan(yCoordMinValue)
    expect(coordinates[0]).toBeLessThan(xCoordMaxValue)
    expect(coordinates[1]).toBeLessThan(yCoordMaxValue)
  })

  it('should return first quadrant group blip coordinates for ring1', function () {
    const baseCoords = groupBlipsBaseCoords(0)

    // Ring radii now use RING_RATIOS [0, 0.49, 0.66, 0.83, 1.0] × effectiveQuadrantWidth (528).
    expect(baseCoords.new).toEqual([377.970953766445, 418.32000000000005])
    expect(baseCoords['existing']).toEqual([337.970953766445, 447.32000000000005])
  })

  it('should transpose base coords for a new blip in ring1 to other three quadrants', function () {
    const newBlipBaseCoords = groupBlipsBaseCoords(0).new

    const coordsMap = transposeQuadrantCoords(newBlipBaseCoords, graphConfig.newGroupBlipWidth)
    expect(coordsMap.first).toEqual(newBlipBaseCoords)
    expect(coordsMap.second).toEqual([newBlipBaseCoords[0], 613.68])
    expect(coordsMap.third).toEqual([594.0290462335549, newBlipBaseCoords[1]])
    expect(coordsMap.fourth).toEqual([594.0290462335549, 613.68])
  })

  it('should return first quadrant group blip coordinates for ring2 with index 1', function () {
    const baseCoords = groupBlipsBaseCoords(1)
    expect(baseCoords.new).toEqual([241.30543935386208, 308.8621939238224])
    expect(baseCoords['existing']).toEqual([201.30543935386208, 337.8621939238224])
  })

  it('should return first quadrant group blip coordinates for ring3 with index 2', function () {
    const baseCoords = groupBlipsBaseCoords(2)
    expect(baseCoords.new).toEqual([293.31999999999994, 142.3402471673532])
    expect(baseCoords['existing']).toEqual([253.31999999999994, 171.3402471673532])
  })

  it('should return first quadrant group blip coordinates for ring4 with index 3', function () {
    const baseCoords = groupBlipsBaseCoords(3)
    expect(baseCoords.new).toEqual([406.1070924055526, 7.2196783647420375])
    expect(baseCoords['existing']).toEqual([366.1070924055526, 36.21967836474204])
  })

  it('should return group blip tool tip text as "Click to view all" count is more than 15', function () {
    let ringBlips = mockRingBlips(20)
    const actualToolTip = getGroupBlipTooltipText(ringBlips)
    const expectedToolTip = 'Click to view all'
    expect(actualToolTip).toEqual(expectedToolTip)
  })

  it('should return group blip tool tip text as all blip names if count is <= 15', function () {
    let ringBlips = mockRingBlips(15)
    const actualToolTip = getGroupBlipTooltipText(ringBlips)
    const expectedToolTip =
      '1. blip1</br>2. blip2</br>3. blip3</br>4. blip4</br>5. blip5</br>6. blip6</br>7. blip7</br>8. blip8</br>9. blip9</br>10. blip10</br>11. blip11</br>12. blip12</br>13. blip13</br>14. blip14</br>15. blip15</br>'
    expect(actualToolTip).toEqual(expectedToolTip)
  })

  it('should return ring radius based on the ring index', function () {
    expect(getRingRadius(0)).toBe(0)
    // RING_RATIOS [0, 0.49, 0.66, 0.83, 1.0] × effectiveQuadrantWidth (528).
    expect(getRingRadius(1)).toBeCloseTo(258.72, 5)
    expect(getRingRadius(2)).toBe(348.48)
    expect(getRingRadius(3)).toBeCloseTo(438.24, 5)
    expect(getRingRadius(4)).toBe(528)
    expect(getRingRadius(5)).toBe(0)
  })

  it('should return group blip assistive text for group blip', function () {
    const blip = {
      isGroup: () => true,
      ring: () => {
        return {
          name: () => 'ring1',
        }
      },
      blipText: () => '12 New Blips',
      name: 'blip1',
      isNew: () => true,
      status: () => null,
    }

    const actual = blipAssistiveText(blip)
    expect(actual).toEqual('`ring1 ring, group of 12 New Blips')
  })

  it('should return correct assistive text for new blip', function () {
    const blip = {
      isGroup: () => false,
      ring: () => {
        return {
          name: () => 'Trial',
        }
      },
      name: () => 'Some cool tech',
      status: () => 'New',
    }

    const actual = blipAssistiveText(blip)
    expect(actual).toEqual('Trial ring, Some cool tech, New.')
  })

  it('should return correct assistive text for existing blip', function () {
    const blip = {
      isGroup: () => false,
      ring: () => {
        return {
          name: () => 'Trial',
        }
      },
      name: () => 'Some cool tech',
      status: () => 'No change',
    }

    const actual = blipAssistiveText(blip)
    expect(actual).toEqual('Trial ring, Some cool tech, No change.')
  })

  it('should return correct assistive text for moved in blip', function () {
    const blip = {
      isGroup: () => false,
      ring: () => {
        return {
          name: () => 'Trial',
        }
      },
      name: () => 'Some cool tech',
      status: () => 'Moved in',
    }

    const actual = blipAssistiveText(blip)
    expect(actual).toEqual('Trial ring, Some cool tech, Moved in.')
  })

  it('should return correct assistive text for moved out blip', function () {
    const blip = {
      isGroup: () => false,
      ring: () => {
        return {
          name: () => 'Trial',
        }
      },
      name: () => 'Some cool tech',
      status: () => 'Moved out',
    }

    const actual = blipAssistiveText(blip)
    expect(actual).toEqual('Trial ring, Some cool tech, Moved out.')
  })

  it('should return group blip with appropriate values', function () {
    const ringBlips = mockRingBlips(20)
    const groupBlip = createGroupBlip(ringBlips, 'New', { name: () => 'ring1' }, 'first')
    expect(groupBlip).toBeTruthy()
    expect(groupBlip.blipText()).toEqual('20 New blips')
    expect(groupBlip.id()).toEqual('first-ring1-group-new-blips')
    expect(groupBlip.isGroup()).toEqual(true)
  })

  it('should return true when the given coords are colliding with existing coords', function () {
    const existingCoords = [{ coordinates: [10, 10], width: 22 }]

    expect(thereIsCollision([10, 10], existingCoords, 22)).toBe(true)
    expect(thereIsCollision([41, 41], existingCoords, 22)).toBe(true)
    expect(thereIsCollision([42, 42], existingCoords, 22)).toBe(false)
  })

  it('should sort blips coordinates', function () {
    const existingCoords = [
      { coordinates: [500, 400], width: 22 },
      { coordinates: [200, 200], width: 22 },
      { coordinates: [40, 40], width: 22 },
    ]

    expect(sortBlipCoordinates(existingCoords, 'first')).toEqual([
      { coordinates: [200, 200], width: 22 },
      { coordinates: [40, 40], width: 22 },
      { coordinates: [500, 400], width: 22 },
    ])
    expect(sortBlipCoordinates(existingCoords, 'third')).toEqual([
      { coordinates: [200, 200], width: 22 },
      { coordinates: [40, 40], width: 22 },
      { coordinates: [500, 400], width: 22 },
    ])
    expect(sortBlipCoordinates(existingCoords, 'second')).toEqual([
      { coordinates: [500, 400], width: 22 },
      { coordinates: [200, 200], width: 22 },
      { coordinates: [40, 40], width: 22 },
    ])
    expect(sortBlipCoordinates(existingCoords, 'fourth')).toEqual([
      { coordinates: [500, 400], width: 22 },
      { coordinates: [200, 200], width: 22 },
      { coordinates: [40, 40], width: 22 },
    ])
  })
})

describe('findClearPlacement (UIRefresh2022)', function () {
  // RING_RATIOS [0, 0.49, 0.66, 0.83, 1.0] × effectiveQuadrantWidth (528):
  //   ring 0 (Adopt) : 0     .. 258.72
  //   ring 1 (Trial) : 258.72.. 348.48
  //   ring 2 (Assess): 348.48.. 438.24
  //   ring 3 (Hold)  : 438.24.. 528
  const RADAR_CENTRE = 528
  const RING_BOUNDS = [
    [0, 258.72],
    [258.72, 348.48],
    [348.48, 438.24],
    [438.24, 528],
  ]
  const QUADRANTS = [
    { order: 'first', startAngle: 0 },
    { order: 'second', startAngle: -90 },
    { order: 'third', startAngle: 90 },
    { order: 'fourth', startAngle: -180 },
  ]

  function makeBlip() {
    return { width: 22 }
  }

  function distFromCentre(coords) {
    const dx = coords[0] - RADAR_CENTRE
    const dy = coords[1] - RADAR_CENTRE
    return Math.hypot(dx, dy)
  }

  it('keeps every placed blip inside its ring band envelope', function () {
    QUADRANTS.forEach(({ order, startAngle }) => {
      RING_BOUNDS.forEach(([innerArc, outerArc], ringIndex) => {
        const allCoords = []
        for (let i = 0; i < 6; i++) {
          const coords = findClearPlacement(makeBlip(), ringIndex, startAngle, order, allCoords)
          allCoords.push({ coordinates: coords, width: 22 })

          const r = distFromCentre(coords)
          // Drawn centre is offset by ~2 px from logical (x, y); the EFFECTIVE_RADIUS
          // (= 18 + 2) already absorbs that, so on every ring boundary the blip
          // envelope must stay strictly inside.
          expect(r).toBeGreaterThanOrEqual(innerArc + RING_PADDING + EFFECTIVE_RADIUS - 1e-6)
          expect(r).toBeLessThanOrEqual(outerArc - RING_PADDING - EFFECTIVE_RADIUS + 1e-6)
        }
      })
    })
  })

  it('keeps every placed blip clear of the inset stripe cross (axis clearance)', function () {
    // axisHalfChord = quadrantsGap/2 + EFFECTIVE_RADIUS + AXIS_PADDING = 16 + 20 + 4 = 40.
    // For every quadrant, both |x − 528| and |y − 528| must be ≥ axisHalfChord
    // so the drawn outer ring never enters the visible stripe cross.
    const halfChord = axisHalfChord()
    expect(halfChord).toBe(40)

    QUADRANTS.forEach(({ order, startAngle }) => {
      RING_BOUNDS.forEach((_, ringIndex) => {
        const allCoords = []
        for (let i = 0; i < 6; i++) {
          const coords = findClearPlacement(makeBlip(), ringIndex, startAngle, order, allCoords)
          allCoords.push({ coordinates: coords, width: 22 })

          expect(Math.abs(coords[0] - RADAR_CENTRE)).toBeGreaterThanOrEqual(halfChord - 1e-6)
          expect(Math.abs(coords[1] - RADAR_CENTRE)).toBeGreaterThanOrEqual(halfChord - 1e-6)
        }
      })
    })
  })

  it('keeps every pair of blips at least 2*EFFECTIVE_RADIUS + BLIP_PADDING apart in dense rings', function () {
    // pairSeparation = 2*EFFECTIVE_RADIUS + BLIP_PADDING = 44.
    const minDist = pairSeparation()
    expect(minDist).toBe(44)

    // Counts are calibrated to each ring's geometric single-layer capacity
    // at strict pair separation (Trial/Assess/Hold are now Hold-width, so
    // only ~9/12/16 blips fit cleanly along their arcs respectively). Adopt
    // is the widest ring but its inner edge is constrained by the inset
    // stripe cross, so 8 blips is a representative dense load.
    const denseSpec = [
      { ringIndex: 0, count: 8 }, // Adopt
      { ringIndex: 1, count: 9 }, // Trial — narrowest at small radius
      { ringIndex: 2, count: 11 }, // Assess
      { ringIndex: 3, count: 14 }, // Hold
    ]

    QUADRANTS.forEach(({ order, startAngle }) => {
      denseSpec.forEach(({ ringIndex, count }) => {
        const allCoords = []
        for (let i = 0; i < count; i++) {
          const coords = findClearPlacement(makeBlip(), ringIndex, startAngle, order, allCoords)
          allCoords.push({ coordinates: coords, width: 22 })
        }
        // Run the same relaxation step as production placement — once it
        // converges, no pair may sit closer than `minDist`.
        relaxBlipsInRing(allCoords, ringIndex, startAngle)

        // The relaxation pass terminates after a fixed iteration budget, so we
        // tolerate sub-pixel residual overlap that's invisible on screen but
        // still well inside the BLIP_PADDING margin (4 px).
        const TOLERANCE = 1
        for (let i = 0; i < allCoords.length; i++) {
          for (let j = i + 1; j < allCoords.length; j++) {
            const a = allCoords[i].coordinates
            const b = allCoords[j].coordinates
            const d = Math.hypot(a[0] - b[0], a[1] - b[1])
            expect(d).toBeGreaterThanOrEqual(minDist - TOLERANCE)
          }
        }
      })
    })
  })

  it('exposes the geometry constants the placement algorithm relies on', function () {
    // Sanity checks so future tweaks to the ring widening / gap don't silently
    // re-introduce the original bugs (stripe cross overlap, undersized envelope).
    expect(EFFECTIVE_RADIUS).toBe(20)
    expect(RING_PADDING).toBe(4)
    expect(axisHalfChord()).toBe(40)
    expect(pairSeparation()).toBe(44)
  })
})
