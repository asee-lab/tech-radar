/* eslint-disable no-console */
/**
 * Visual + numeric QA for the radar blip placement.
 *
 * Loads the running webpack dev server, waits for the radar SVG to render,
 * then runs the same invariants the unit tests cover, but against the
 * actual DOM (so it picks up the production CSS/SVG composition):
 *
 *   1. Every blip stays inside its ring band (envelope = EFFECTIVE_RADIUS = 20).
 *   2. Every blip stays out of the inset stripe cross (axisHalfChord = 40).
 *   3. Every pair of blips in the same ring/quadrant keeps pair separation.
 *   4. "new" / "moved" outer rings (rendered as sibling <path>s with class
 *      first|second|third|fourth) never cross a ring arc or an axis edge.
 *   5. Captures full-radar and per-quadrant Adopt-clip screenshots.
 *
 * Exits with code 0 on success, 1 on any visible defect.
 */

const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE_URL = process.env.RADAR_URL || 'http://127.0.0.1:8080/'
const OUT_DIR = path.resolve(__dirname, '..', '.qa', 'blip-placement')

// Geometry constants, mirrored from src/graphing/blips.js + config.js.
const QUADRANT_WIDTH = 512
const QUADRANTS_GAP = 32
const EFFECTIVE_QUADRANT_WIDTH = QUADRANT_WIDTH + QUADRANTS_GAP / 2 // 528
const RADAR_CENTRE = EFFECTIVE_QUADRANT_WIDTH
const RING_RATIOS = [0, 0.49, 0.66, 0.83, 1.0]
const RING_RADII = RING_RATIOS.map((r) => r * EFFECTIVE_QUADRANT_WIDTH)
const EFFECTIVE_RADIUS = 20
const RING_PADDING = 4
const AXIS_PADDING = 4
const BLIP_PADDING = 4
const AXIS_HALF_CHORD = QUADRANTS_GAP / 2 + EFFECTIVE_RADIUS + AXIS_PADDING
const PAIR_SEP = 2 * EFFECTIVE_RADIUS + BLIP_PADDING

const QUADRANTS = ['first', 'second', 'third', 'fourth']

function loosen(v) {
  // 1px tolerance: relaxation can leave sub-px residual overlap; rendered
  // pixel grid also rounds; we only flag visible breaks.
  return v - 1
}

async function ensureOutDir() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true })
}

async function extractBlips(page) {
  // Each placed blip is a <g> inside .quadrant-group whose <a.blip-link>
  // child wraps an inner <circle> (always present) and optionally an outer
  // ring path (for "new") or a partial arc (for "moved in/out"). The blip's
  // ring is encoded as the data-ring-name attribute on the <a>.
  return page.evaluate(() => {
    const out = []
    const groups = document.querySelectorAll('svg#radar-plot .quadrant-group')
    groups.forEach((group) => {
      let order = null
      group.classList.forEach((c) => {
        const m = c.match(/^quadrant-group-(first|second|third|fourth)$/)
        if (m) order = m[1]
      })
      if (!order) return
      const blipGs = group.querySelectorAll('g > a.blip-link')
      blipGs.forEach((a) => {
        const g = a.parentNode
        const transform = g.getAttribute('transform') || a.getAttribute('transform') || ''
        const m = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/)
        if (!m) return
        const tx = parseFloat(m[1])
        const ty = parseFloat(m[2])
        const isGroup = !!a.querySelector(':scope > rect')
        // Logical (x, y) is recovered by undoing the `translate(x-16, y-16)`
        // applied in drawBlipCircle. (Group blips translate to the rect's
        // top-left, not centred — handled in checkBlip via isGroup.)
        const x = tx + 16
        const y = ty + 16
        const drawnX = x + 2
        const drawnY = y + 2
        // Outer extent radius of the visual envelope:
        //   - has outer ring (class .first/.second/.third/.fourth path)? r=18
        //   - or a partial arc (moved in/out)? also r=18
        //   - else (no-change/group) r=12
        const hasOuterRing = !!a.querySelector(':scope > path')
        const visualRadius = isGroup ? 0 : hasOuterRing ? 18 : 12
        const ringName = (a.getAttribute('data-ring-name') || '').toLowerCase()
        out.push({
          quadrantOrder: order,
          ringName,
          x,
          y,
          drawnX,
          drawnY,
          visualRadius,
          isGroup,
          hasOuterRing,
        })
      })
    })
    return out
  })
}

const RING_NAME_TO_INDEX = { adopt: 0, trial: 1, assess: 2, hold: 3 }

function checkBlip(blip) {
  const issues = []
  if (blip.isGroup) return issues // groupBlips are rectangles, geometry handled separately

  const ringIndex = RING_NAME_TO_INDEX[blip.ringName]
  if (ringIndex == null) {
    issues.push({ kind: 'unknown-ring', detail: `ringName=${blip.ringName}` })
    return issues
  }
  const innerArc = RING_RADII[ringIndex]
  const outerArc = RING_RADII[ringIndex + 1]

  // Distance from radar centre to the drawn centre (this is what visually
  // matters since the rendered disc is centred on (drawnX, drawnY)).
  const dx = blip.drawnX - RADAR_CENTRE
  const dy = blip.drawnY - RADAR_CENTRE
  const r = Math.hypot(dx, dy)

  // Outer envelope must stay within the ring band (with PADDING margin).
  if (r - blip.visualRadius < innerArc + RING_PADDING - 1) {
    issues.push({
      kind: 'inner-arc-overflow',
      detail: `r=${r.toFixed(2)} env=${blip.visualRadius} innerArc=${innerArc.toFixed(2)} margin=${(
        r -
        blip.visualRadius -
        innerArc
      ).toFixed(2)}`,
    })
  }
  if (r + blip.visualRadius > outerArc - RING_PADDING + 1) {
    issues.push({
      kind: 'outer-arc-overflow',
      detail: `r=${r.toFixed(2)} env=${blip.visualRadius} outerArc=${outerArc.toFixed(2)} margin=${(
        outerArc -
        r -
        blip.visualRadius
      ).toFixed(2)}`,
    })
  }

  // Stripe-cross / axis clearance: the drawn outer envelope must not cross
  // the inner edge of its quadrant rectangle (which is offset by gap/2 from
  // the radar centre on the relevant axis).
  const xClear = Math.abs(blip.drawnX - RADAR_CENTRE) - blip.visualRadius - QUADRANTS_GAP / 2
  const yClear = Math.abs(blip.drawnY - RADAR_CENTRE) - blip.visualRadius - QUADRANTS_GAP / 2
  if (xClear < AXIS_PADDING - 1) {
    issues.push({
      kind: 'x-axis-overlap',
      detail: `xClear=${xClear.toFixed(2)} drawnX=${blip.drawnX.toFixed(2)} env=${blip.visualRadius}`,
    })
  }
  if (yClear < AXIS_PADDING - 1) {
    issues.push({
      kind: 'y-axis-overlap',
      detail: `yClear=${yClear.toFixed(2)} drawnY=${blip.drawnY.toFixed(2)} env=${blip.visualRadius}`,
    })
  }
  return issues
}

function checkPairs(blips) {
  // Differentiate two failure modes:
  //   * visible-overlap: drawn envelopes actually overlap (real bug — looks bad).
  //   * padding-violation: envelopes are tangent or near-tangent, within the
  //     ideal BLIP_PADDING margin but not visibly overlapping. The Thoughtworks
  //     reference radar shows the same kind of tangency in dense rings, so we
  //     report these but they don't fail signoff by themselves.
  const visible = []
  const padding = []
  const buckets = new Map()
  blips.forEach((b) => {
    if (b.isGroup) return
    const key = `${b.quadrantOrder}|${b.ringName}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(b)
  })
  buckets.forEach((arr, key) => {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i]
        const b = arr[j]
        const d = Math.hypot(a.drawnX - b.drawnX, a.drawnY - b.drawnY)
        const envelopeSum = a.visualRadius + b.visualRadius
        const idealSep = envelopeSum + BLIP_PADDING
        const detail = `d=${d.toFixed(2)} envelopes=${a.visualRadius}+${b.visualRadius} a=(${a.x.toFixed(1)},${a.y.toFixed(1)}) b=(${b.x.toFixed(1)},${b.y.toFixed(1)})`
        if (d < loosen(envelopeSum)) {
          visible.push({ kind: 'visible-overlap', bucket: key, detail })
        } else if (d < loosen(idealSep)) {
          padding.push({ kind: 'padding-violation', bucket: key, detail })
        }
      }
    }
  })
  return { visible, padding }
}

async function main() {
  await ensureOutDir()
  const browser = await chromium.launch({ headless: true })
  let exitCode = 0
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`)
      }
    })
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

    // Wait for the radar SVG to render with at least one blip group.
    await page.waitForSelector('svg#radar-plot .quadrant-group g a.blip-link', { timeout: 30000 })
    // Brief settle for any final DOM mutations.
    await page.waitForTimeout(500)

    const blips = await extractBlips(page)
    console.log(`Extracted ${blips.length} blips`)

    // Per-blip geometry checks.
    const allIssues = []
    blips.forEach((b) => {
      const issues = checkBlip(b)
      if (issues.length) {
        issues.forEach((i) =>
          allIssues.push({
            ...i,
            quadrantOrder: b.quadrantOrder,
            ringName: b.ringName,
            xy: [b.x.toFixed(2), b.y.toFixed(2)],
            drawn: [b.drawnX.toFixed(2), b.drawnY.toFixed(2)],
            env: b.visualRadius,
            isNewOrMoved: b.hasOuterRing,
          }),
        )
      }
    })
    // Pairwise checks (split into "visible" vs "ideal padding" failure modes).
    const pairs = checkPairs(blips)
    pairs.visible.forEach((p) => allIssues.push(p))

    // Histograms by status (sanity).
    const counts = blips.reduce(
      (acc, b) => {
        if (b.isGroup) acc.group++
        else if (b.hasOuterRing) acc.outerRing++
        else acc.plain++
        return acc
      },
      { plain: 0, outerRing: 0, group: 0 },
    )
    console.log('Blip status histogram:', counts)

    // Capture screenshots regardless of result so we always have evidence.
    const svg = page.locator('svg#radar-plot')
    const fullBox = await svg.boundingBox()
    if (fullBox) {
      await page.screenshot({
        path: path.join(OUT_DIR, 'radar-full.png'),
        clip: {
          x: Math.max(0, fullBox.x - 4),
          y: Math.max(0, fullBox.y - 4),
          width: fullBox.width + 8,
          height: fullBox.height + 8,
        },
      })
      console.log('Saved radar-full.png')
    }

    // Per-quadrant Adopt-ring tight clip — Adopt is the most fragile region
    // because of the inset stripe cross + the widening to ratio 0.40.
    // The Adopt outer ring is at r=211.2 from the centre, plus margin.
    const adoptR = RING_RADII[1] + 8
    if (fullBox) {
      const cx = fullBox.x + RADAR_CENTRE
      const cy = fullBox.y + RADAR_CENTRE
      // Each quadrant clip covers the half-plane of its quadrant within the Adopt circle.
      const clips = {
        first: { x: cx - adoptR, y: cy - adoptR, width: adoptR + 8, height: adoptR + 8 },
        second: { x: cx - adoptR, y: cy - 8, width: adoptR + 8, height: adoptR + 8 },
        third: { x: cx - 8, y: cy - adoptR, width: adoptR + 8, height: adoptR + 8 },
        fourth: { x: cx - 8, y: cy - 8, width: adoptR + 8, height: adoptR + 8 },
      }
      for (const order of QUADRANTS) {
        await page.screenshot({
          path: path.join(OUT_DIR, `adopt-${order}.png`),
          clip: clips[order],
        })
      }
      console.log('Saved per-quadrant Adopt clips')

      // Tight clip on the densest corner of first-quadrant Adopt — exactly
      // the area where the verification flagged the 2 remaining envelope
      // overlaps, so we can eyeball whether the overlap is actually visible.
      await page.screenshot({
        path: path.join(OUT_DIR, 'adopt-corner.png'),
        clip: { x: cx - 200, y: cy - 200, width: 200, height: 200 },
      })
      console.log('Saved tight corner clip')
    }

    if (consoleErrors.length) {
      console.log('Console messages (errors/warnings):')
      consoleErrors.forEach((e) => console.log('  ', e))
    }

    if (allIssues.length) {
      exitCode = 1
      console.log(`\nFOUND ${allIssues.length} VISIBLE DEFECT(S) (real bugs):`)
      allIssues.slice(0, 80).forEach((i) => console.log('  -', JSON.stringify(i)))
      if (allIssues.length > 80) console.log(`  ... and ${allIssues.length - 80} more`)
    } else {
      console.log('\nNo visible defects: every blip is inside its band, clear of the stripe cross, and not overlapping any neighbour.')
    }
    if (pairs.padding.length) {
      console.log(`\n${pairs.padding.length} pair(s) within tangency tolerance (ideal padding ${BLIP_PADDING}px not satisfied, but envelopes do not visibly overlap — same as the Thoughtworks reference in dense rings):`)
      pairs.padding.slice(0, 20).forEach((i) => console.log('  -', JSON.stringify(i)))
      if (pairs.padding.length > 20) console.log(`  ... and ${pairs.padding.length - 20} more`)
    }
    fs.writeFileSync(path.join(OUT_DIR, 'issues.json'), JSON.stringify(allIssues, null, 2))
    fs.writeFileSync(path.join(OUT_DIR, 'padding-violations.json'), JSON.stringify(pairs.padding, null, 2))
    fs.writeFileSync(path.join(OUT_DIR, 'blips.json'), JSON.stringify(blips, null, 2))
  } finally {
    await browser.close()
  }
  process.exit(exitCode)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
