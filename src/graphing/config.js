const quadrantSize = 512
const quadrantGap = 32

const getQuadrants = () => {
  const quadrants = JSON.parse(process.env.QUADRANTS || null) || [
    'Techniques',
    'Platforms',
    'Tools',
    'Languages & Frameworks',
  ]
  console.log('🎯 Configured quadrants:', quadrants)
  return quadrants
}

const getRings = () => {
  return JSON.parse(process.env.RINGS || null) || ['Adopt', 'Trial', 'Assess', 'Hold']
}

const isBetween = (number, startNumber, endNumber) => {
  return startNumber <= number && number <= endNumber
}
const isValidConfig = () => {
  return getQuadrants().length === 4 && isBetween(getRings().length, 1, 4)
}

const graphConfig = {
  effectiveQuadrantHeight: quadrantSize + quadrantGap / 2,
  effectiveQuadrantWidth: quadrantSize + quadrantGap / 2,
  quadrantHeight: quadrantSize,
  quadrantWidth: quadrantSize,
  quadrantsGap: quadrantGap,
  minBlipWidth: 12,
  blipWidth: 22,
  groupBlipHeight: 24,
  newGroupBlipWidth: 88,
  existingGroupBlipWidth: 124,
  rings: getRings(),
  quadrants: getQuadrants(),
  groupBlipAngles: [30, 35, 60, 80],
  // Capacity headroom per ring before the radar collapses individual blips
  // into a single grouped marker. Adopt was originally 8 when its radius
  // ratio was 0.316; with Adopt now widened to 0.49 (Trial/Assess matched to
  // Hold's 0.17 width) the inner ring has the most real estate, so it gets
  // the highest cap. Trial and Assess share Hold's ring width and therefore
  // the same headroom.
  maxBlipsInRings: [22, 18, 18, 18],
}

const uiConfig = {
  subnavHeight: 60,
  bannerHeight: 200,
  tabletBannerHeight: 300,
  headerHeight: 80,
  legendsHeight: 320,
  tabletViewWidth: 1280,
  mobileViewWidth: 768,
}

function getScale() {
  return window.innerWidth < 1800 ? 1.25 : 1.5
}

function getGraphSize() {
  return graphConfig.effectiveQuadrantHeight + graphConfig.effectiveQuadrantWidth
}

function getScaledQuadrantWidth(scale) {
  return graphConfig.quadrantWidth * scale
}

function getScaledQuadrantHeightWithGap(scale) {
  return (graphConfig.quadrantHeight + graphConfig.quadrantsGap) * scale
}

module.exports = {
  graphConfig,
  uiConfig,
  getScale,
  getGraphSize,
  getScaledQuadrantWidth,
  getScaledQuadrantHeightWithGap,
  isValidConfig,
}
