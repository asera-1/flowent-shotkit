import type { Renderer, RenderTarget } from './render-target'
import type { StoreTarget, Theme } from './types'
import { detectGeometry } from './detect'
import { roundRectPath } from './imgproc'
import { drawStatusBar } from './statusbar'
import { drawHeadline } from './headline'

export interface TemplateOptions {
  frame: string
  screenshot: string
  headline: { line1: string; line2: string }
  theme: Theme
  recolor?: { from: string; to: string }   // recolor the background, keep the grain
}

function hex(c: string): [number, number, number] {
  const s = c.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
function inRR(px: number, py: number, x: number, y: number, w: number, h: number, r: number): boolean {
  const rx = Math.min(r, w / 2), ry = Math.min(r, h / 2)
  if (px < x || px > x + w || py < y || py > y + h) return false
  const dx = px < x + rx ? x + rx - px : px > x + w - rx ? px - (x + w - rx) : 0
  const dy = py < y + ry ? y + ry - py : py > y + h - ry ? py - (y + h - ry) : 0
  return dx * dx + dy * dy <= rx * ry
}

function fakeStore(W: number, H: number, g: ReturnType<typeof detectGeometry>): StoreTarget {
  const s = g.screen
  return {
    id: 'template', label: 'Template', width: W, height: H, platform: 'app-store', folder: 'template',
    device: {
      screen: s, cornerRadius: Math.round(0.096 * s.w), bezel: g.frameThickness,
      island: g.island ? { w: g.island.w, h: g.island.h, top: g.island.y - s.y }
                        : { w: Math.round(0.245 * s.w), h: Math.round(0.067 * s.w), top: Math.round(0.035 * s.w) },
      statusScale: s.w / 943,
    },
    headline: {
      cx: Math.round(W / 2), baseline1: Math.round(s.y * 0.51), baseline2: Math.round(s.y * 0.74),
      cap1: Math.round(H * 0.021), cap2: Math.round(H * 0.038), maxWidth: Math.round(0.9 * W),
    },
  }
}

export async function renderTemplateSlide(renderer: Renderer, opts: TemplateOptions): Promise<RenderTarget> {
  const frameImg = await renderer.loadImage(opts.frame)
  const W = frameImg.width, H = frameImg.height
  const t = renderer.createTarget(W, H)
  const ctx = t.ctx
  ctx.drawImage(frameImg.image, 0, 0)
  const orig = ctx.getImageData(0, 0, W, H)
  const g = detectGeometry(orig.data, W, H)
  const store = fakeStore(W, H, g)
  const s = g.screen
  const radius = store.device.cornerRadius

  if (opts.recolor) {
    // frequency separation: smooth base via 1/8 downscale + upscale; keep the detail
    const dw = Math.max(1, W >> 3), dh = Math.max(1, H >> 3)
    const down = renderer.createTarget(dw, dh); down.ctx.imageSmoothingEnabled = true
    down.ctx.drawImage(frameImg.image, 0, 0, dw, dh)
    const up = renderer.createTarget(W, H); up.ctx.imageSmoothingEnabled = true
    up.ctx.drawImage((down.ctx as any).canvas, 0, 0, W, H)
    const base = up.ctx.getImageData(0, 0, W, H).data
    const c0 = hex(opts.recolor.from), c1 = hex(opts.recolor.to)
    const out = ctx.createImageData(W, H)
    const od = orig.data, o = out.data
    const px = s.x - g.frameThickness, py = s.y - g.frameThickness
    const pw = s.w + g.frameThickness * 2, ph = s.h + g.frameThickness * 2
    for (let y = 0; y < H; y++) {
      const tgY = y / H
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        if (inRR(x, y, px, py, pw, ph, radius + g.frameThickness)) {       // keep the real phone
          o[i] = od[i]; o[i + 1] = od[i + 1]; o[i + 2] = od[i + 2]; o[i + 3] = 255
        } else {
          const tg = (x / W + tgY) / 2
          for (let k = 0; k < 3; k++) {
            const nb = c0[k] + (c1[k] - c0[k]) * tg
            o[i + k] = Math.max(0, Math.min(255, nb + (od[i + k] - base[i + k])))
          }
          o[i + 3] = 255
        }
      }
    }
    ctx.putImageData(out, 0, 0)
  }

  // swap the app screenshot into the detected screen (rounded clip, cover by width)
  const shot = await renderer.loadImage(opts.screenshot)
  ctx.save()
  roundRectPath(ctx, s.x, s.y, s.w, s.h, radius)
  ctx.clip()
  ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x, s.y, s.w, s.h)
  const scale = s.w / shot.width
  ctx.drawImage(shot.image, s.x, s.y, s.w, shot.height * scale)
  ctx.restore()

  drawStatusBar(t, store)
  if (opts.headline.line1 || opts.headline.line2) drawHeadline(t, store, opts.theme, opts.headline.line1, opts.headline.line2)
  return t
}
