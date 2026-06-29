import type { RenderTarget } from './render-target'
import type { StoreTarget, Theme } from './types'
import { addGrain } from './imgproc'

const MESH_PTS: [number, number][] = [[0.16, 0.14], [0.86, 0.2], [0.2, 0.82], [0.82, 0.86], [0.5, 0.48]]

export function drawBackground(t: RenderTarget, _store: StoreTarget, theme: Theme) {
  const { ctx, width: W, height: H } = t
  const bg = theme.background
  if (bg.kind === 'mesh') {
    ctx.fillStyle = bg.colors[0] ?? '#1c46de'
    ctx.fillRect(0, 0, W, H)
    bg.colors.slice(1).forEach((c, i) => {
      const [pxF, pyF] = MESH_PTS[i % MESH_PTS.length]
      const r = ctx.createRadialGradient(pxF * W, pyF * H, 0, pxF * W, pyF * H, W * 0.85)
      r.addColorStop(0, c); r.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, H)
    })
    addGrain(ctx, W, H, bg.grain ?? 6)
    return
  }
  const style = bg.style ?? 'diagonal'
  if (style === 'radial') {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.hypot(W, H) * 0.62)
    g.addColorStop(0, bg.from); g.addColorStop(1, bg.to)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else if (style === 'conic') {
    ctx.fillStyle = bg.to; ctx.fillRect(0, 0, W, H)
    const g = ctx.createConicGradient(-Math.PI / 2, W * 0.5, H * 0.42)
    g.addColorStop(0, bg.from); g.addColorStop(0.5, bg.to); g.addColorStop(1, bg.from)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else if (style === 'spotlight') {
    ctx.fillStyle = bg.to; ctx.fillRect(0, 0, W, H)
    const g = ctx.createRadialGradient(W * 0.5, H * 0.26, 0, W * 0.5, H * 0.26, Math.max(W, H) * 0.78)
    g.addColorStop(0, bg.from); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else {
    const [x0, y0, x1, y1] = style === 'vertical' ? [0, 0, 0, H] : [0, 0, W, H]
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, bg.from); g.addColorStop(1, bg.to)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }
  if (bg.glow && (style === 'diagonal' || style === 'vertical')) {
    const rg = ctx.createRadialGradient(W * 0.2, H * 0.12, 0, W * 0.2, H * 0.12, W * 1.05)
    rg.addColorStop(0, bg.glow); rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H)
  }
  addGrain(ctx, W, H, bg.grain ?? 7)
}
