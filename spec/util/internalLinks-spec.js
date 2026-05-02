jest.mock('d3', () => {
  const select = (node) => ({
    node: () => node,
    attr(name, value) {
      if (value === undefined) return node.getAttribute(name)
      node.setAttribute(name, value)
      return this
    },
    classed(name, enabled) {
      if (enabled === undefined) return node.classList.contains(name)
      node.classList.toggle(name, enabled)
      return this
    },
    on(name, handler) {
      node[`__handler_${name}`] = handler
      return this
    },
    selectAll(selector) {
      return {
        each(callback) {
          Array.from(node.querySelectorAll(selector)).forEach((child) => callback.call(child))
        },
      }
    },
  })

  return { select }
})

jest.mock('../../src/graphing/components/quadrants', () => ({
  selectRadarQuadrant: jest.fn(),
  removeScrollListener: jest.fn(),
}))

const { enrichDescriptionLinks } = require('../../src/util/internalLinks')

describe('internalLinks enrichDescriptionLinks', () => {
  beforeEach(() => {
    delete window.location
    window.location = Object.create(window)
    window.location.href = 'https://example.com/radar?version=2026.04'
    window.location.origin = 'https://example.com'
  })

  it('decorates external links with pop-out attributes', () => {
    document.body.innerHTML = `
      <div id="description">
        <a href="https://external.example.com/article">External</a>
      </div>
    `

    const description = document.getElementById('description')
    enrichDescriptionLinks(description, [], '2026.04')

    const link = description.querySelector('a')
    expect(link.classList.contains('pop-out')).toBe(true)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.getAttribute('aria-label')).toBe('This is an external link. Opens in new tab')
  })

  it('keeps internal blip links as internal-link', () => {
    document.body.innerHTML = `
      <div id="description">
        <a href="#Kafka">Kafka</a>
      </div>
    `

    const description = document.getElementById('description')
    enrichDescriptionLinks(description, [], '2026.04')

    const link = description.querySelector('a')
    expect(link.classList.contains('internal-link')).toBe(true)
    expect(link.classList.contains('pop-out')).toBe(false)
  })
})
