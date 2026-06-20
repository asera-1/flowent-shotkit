import type { RenderTarget } from './render-target'
import type { StoreTarget, Theme } from './types'
import { addGrain } from './imgproc'

export function drawBackground(t: RenderTarget, _store: StoreTarget, theme: Theme) {
  const { ctx, width: W, height: H } = t
  const bg = theme.background
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, bg.from)
  g.addColorStop(1, bg.to)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  if (bg.glow) {
    const rg = ctx.createRadialGradient(W * 0.2, H * 0.12, 0, W * 0.2, H * 0.12, W * 1.05)
    rg.addColorStop(0, bg.glow)
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, W, H)
  }
  addGrain(ctx, W, H, bg.grain ?? 7)
}
