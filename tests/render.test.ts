import { describe, it, expect } from 'vitest'
import { createNodeRenderer } from '../src/node/canvas-target'
import { renderSlide } from '../src/compose'
import { targets } from '../src/targets'
import type { Project } from '../src/types'

const project: Project = {
  theme: {
    fontFamily: 'Montserrat', weightLine1: 600, weightLine2: 700,
    headlineColor: '#F8FAFF', gradient: ['#AEE4FF', '#F4FBFF'],
    background: { kind: 'synthetic', from: '#5CA8FF', to: '#1C46DE', glow: 'rgba(150,200,255,0.3)', grain: 7 },
  },
  stores: [targets.appStoreIphone69],
  slides: [{ id: 'home', screenshot: 'assets/examples/home.png', headline: { line1: 'YOUR NEXT LESSON', line2: 'READY EVERY DAY' } }],
}

describe('node render', () => {
  it('renders a slide to a valid PNG at the target size', async () => {
    const r = createNodeRenderer()
    const t = await renderSlide(r, project, project.slides[0], project.stores[0])
    expect([t.width, t.height]).toEqual([1290, 2796])
    const png = await t.encodePng()
    expect(png.length).toBeGreaterThan(1000)
    expect(png[0]).toBe(0x89) // PNG signature
    expect(png[1]).toBe(0x50)
  })
})
