const RingCalculator = require('../../src/util/ringCalculator')

describe('ringCalculator', function () {
  var ringLength, radarSize, ringCalculator
  beforeAll(function () {
    ringLength = 4
    radarSize = 500
    ringCalculator = new RingCalculator(ringLength, radarSize)
  })

  it('calculates the ring radius', function () {
    // Adopt outer radius = 0.49 * 500 = 245
    expect(ringCalculator.getRingRadius(1)).toEqual(245)
  })

  it('calculates the ring radius for invalid ring as 0', function () {
    expect(ringCalculator.getRingRadius(10)).toEqual(0)
  })

  it('exposes the canonical RING_RATIOS table', function () {
    expect(RingCalculator.RING_RATIOS).toEqual([0, 0.49, 0.66, 0.83, 1.0])
  })
})
