import type { RenderTarget } from './render-target'
import type { StoreTarget } from './types'
import { roundRectPath } from './imgproc'

const DARK = '#14161a'

function sampleBg(ctx: any, x: number, y: number): string {
  try {
    const p = ctx.getImageData(Math.round(x), Math.round(y), 3, 3).data
    let r = 0, g = 0, b = 0
    for (let i = 0; i < p.length; i += 4) { r += p[i]; g += p[i + 1]; b += p[i + 2] }
    const n = p.length / 4
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`
  } catch { return '#f2f3f6' }
}

// Cover the captured status bar, then redraw a clean 9:41 + signal/wifi/battery.
export function drawStatusBar(t: RenderTarget, store: StoreTarget) {
  const { ctx } = t
  const d = store.device, s = d.screen, sc = d.statusScale
  const islandH = d.island.h
  const iy = s.y + d.island.top
  const cy = iy + islandH / 2
  const bandH = d.island.top + islandH + Math.round(14 * sc)

  // cover band with sampled screen background (keep rounded top corners)
  const bg = sampleBg(ctx, s.x + 16, s.y + bandH + 12)
  ctx.save()
  roundRectPath(ctx, s.x, s.y, s.w, s.h, d.cornerRadius)
  ctx.clip()
  ctx.fillStyle = bg
  ctx.fillRect(s.x, s.y, s.w, bandH)
  ctx.restore()

  // dynamic island
  const iw = d.island.w
  const ix = s.x + (s.w - iw) / 2
  roundRectPath(ctx, ix, iy, iw, islandH, islandH / 2)
  ctx.fillStyle = '#08090b'
  ctx.fill()

  // time
  ctx.fillStyle = DARK
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.round(34 * sc)}px Montserrat700`
  ctx.fillText('9:41', s.x + 40 * sc, cy + 1)

  // right cluster: battery, wifi, cellular
  const xr = s.x + s.w - 40 * sc
  const bw = 46 * sc, bh = 22 * sc, bx0 = xr - bw, by0 = cy - bh / 2
  ctx.lineWidth = 3 * sc
  ctx.strokeStyle = DARK
  roundRectPath(ctx, bx0, by0, bw, bh, 6 * sc); ctx.stroke()
  ctx.fillStyle = DARK
  roundRectPath(ctx, bx0 + 4 * sc, by0 + 4 * sc, bw - 9 * sc, bh - 8 * sc, 3 * sc); ctx.fill()
  roundRectPath(ctx, xr + 3 * sc, cy - 6 * sc, 4 * sc, 12 * sc, 2 * sc); ctx.fill()

  const wx = bx0 - 24 * sc, wy = cy + 12 * sc
  ctx.strokeStyle = DARK
  for (const r of [9, 16, 23]) {
    ctx.lineWidth = 4.5 * sc
    ctx.beginPath(); ctx.arc(wx, wy, r * sc, Math.PI * 1.24, Math.PI * 1.76); ctx.stroke()
  }
  ctx.beginPath(); ctx.arc(wx, wy, 3 * sc, 0, Math.PI * 2); ctx.fillStyle = DARK; ctx.fill()

  const cxr = wx - 30 * sc
  ;[10, 16, 22, 28].forEach((hh, i) => {
    const bxs = cxr - (3 - i) * 10 * sc
    ctx.fillStyle = DARK
    roundRectPath(ctx, bxs, cy + 13 * sc - hh * sc, 6 * sc, hh * sc, 2 * sc); ctx.fill()
  })
}
