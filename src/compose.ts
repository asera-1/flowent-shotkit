import type { Renderer, RenderTarget } from './render-target'
import type { Layout, Project, Slide, StoreTarget } from './types'
import { drawBackground } from './background'
import { drawDeviceAndScreen } from './device'
import { drawStatusBar } from './statusbar'
import { drawHeadline } from './headline'

function effectiveStore(store: StoreTarget, layout: Layout): StoreTarget {
  if (layout !== 'headline-bottom') return store
  const H = store.height, d = store.device, s = d.screen
  return {
    ...store,
    device: { ...d, screen: { ...s, y: Math.round(0.10 * H) } },
    headline: { ...store.headline, baseline1: Math.round(0.905 * H), baseline2: Math.round(0.965 * H) },
  }
}

export async function renderSlide(
  renderer: Renderer, project: Project, slide: Slide, store: StoreTarget,
): Promise<RenderTarget> {
  const t = renderer.createTarget(store.width, store.height)
  drawBackground(t, store, project.theme)
  if (store.featureGraphic) {                 // landscape banner: headline only
    drawHeadline(t, store, project.theme, slide.headline.line1, slide.headline.line2)
    return t
  }
  const eff = effectiveStore(store, project.theme.layout ?? 'headline-top')
  const shot = await renderer.loadImage(slide.screenshot)
  drawDeviceAndScreen(t, eff, shot, project.theme.deviceColor)
  drawStatusBar(t, eff)
  drawHeadline(t, eff, project.theme, slide.headline.line1, slide.headline.line2)
  return t
}

export interface RenderedSlide { store: StoreTarget; slide: Slide; target: RenderTarget }

export async function renderProject(renderer: Renderer, project: Project): Promise<RenderedSlide[]> {
  const out: RenderedSlide[] = []
  for (const store of project.stores)
    for (const slide of project.slides)
      out.push({ store, slide, target: await renderSlide(renderer, project, slide, store) })
  return out
}
