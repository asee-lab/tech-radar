// Single source of truth for the radar's ring boundaries.
// Each ratio is the outer radius of the corresponding ring, expressed as a
// fraction of the radar's max radius. Widths:
//   Adopt  0.49  (innermost — gets the leftover space)
//   Trial  0.17
//   Assess 0.17
//   Hold   0.17  (outermost)
// Trial and Assess are intentionally the same width as Hold so that Adopt has
// the most radial real estate, which is where the densest blip clusters live.
const RING_RATIOS = [0, 0.49, 0.66, 0.83, 1.0]

const RingCalculator = function (numberOfRings, maxRadius) {
  var self = {}

  self.getRingRadius = function (ringIndex) {
    const radius = RING_RATIOS[ringIndex] * maxRadius
    return radius || 0
  }

  return self
}

RingCalculator.RING_RATIOS = RING_RATIOS

module.exports = RingCalculator
