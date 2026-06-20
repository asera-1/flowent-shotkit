import type { Renderer, RenderTarget } from './render-target'
import type { Project, Slide, StoreTarget } from './types'
import { drawBackground } from './background'
import { drawDeviceAndScreen } from './device'
import { drawStatusBar } from './statusbar'
import { drawHeadline } from './headline'

// The six-stage pipeline for one slide on one store target.
export async function renderSlide(
  renderer: Renderer, project: Project, slide: Slide, store: StoreTarget,
): Promise<RenderTarget> {
  const t = renderer.createTarget(store.width, store.height)
  drawBackground(t, store, project.theme)
  const shot = await renderer.loadImage(slide.screenshot)
  drawDeviceAndScreen(t, store, shot)
  drawStatusBar(t, store)
  drawHeadline(t, store, project.theme, slide.headline.line1, slide.headline.line2)
  return t
}

export interface RenderedSlide { store: StoreTarget; slide: Slide; target: RenderTarget }

export async function renderProject(renderer: Renderer, project: Project): Promise<RenderedSlide[]> {
  const out: RenderedSlide[] = []
  for (const store of project.stores) {
    for (const slide of project.slides) {
      out.push({ store, slide, target: await renderSlide(renderer, project, slide, store) })
    }
  }
  return out
}
