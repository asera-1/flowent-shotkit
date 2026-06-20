import type { RenderTarget } from './render-target'
import type { StoreTarget, Theme } from './types'

function lineWidth(ctx: any, text: string, font: string, size: number, track: number): number {
  ctx.font = `${size}px ${font}`
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + track
  return text.length ? w - track : 0
}

function fitSize(ctx: any, text: string, font: string, capPx: number, maxW: number, trackRatio: number): number {
  let size = Math.round(capPx / 0.7)
  while (size > 10) {
    if (lineWidth(ctx, text, font, size, size * trackRatio) <= maxW) return size
    size -= 2
  }
  return 10
}

function drawTracked(ctx: any, text: string, font: string, size: number, track: number, cx: number, baseline: number, fill: any) {
  const total = lineWidth(ctx, text, font, size, track)
  let x = cx - total / 2
  ctx.font = `${size}px ${font}`
  ctx.fillStyle = fill
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (const ch of text) {
    ctx.fillText(ch, x, baseline)
    x += ctx.measureText(ch).width + track
  }
}

export function drawHeadline(t: RenderTarget, store: StoreTarget, theme: Theme, line1: string, line2: string) {
  const { ctx } = t
  const a = store.headline
  const fam1 = `${theme.fontFamily}${theme.weightLine1 ?? 600}`
  const fam2 = `${theme.fontFamily}${theme.weightLine2 ?? 700}`
  const tr1 = 0.045, tr2 = 0.012

  const s1 = fitSize(ctx, line1, fam1, a.cap1, a.maxWidth, tr1)
  drawTracked(ctx, line1, fam1, s1, s1 * tr1, a.cx, a.baseline1, theme.headlineColor)

  const s2 = fitSize(ctx, line2, fam2, a.cap2, a.maxWidth, tr2)
  const w2 = lineWidth(ctx, line2, fam2, s2, s2 * tr2)
  const grad = ctx.createLinearGradient(a.cx - w2 / 2, 0, a.cx + w2 / 2, 0)
  grad.addColorStop(0, theme.gradient[0])
  grad.addColorStop(1, theme.gradient[1])
  drawTracked(ctx, line2, fam2, s2, s2 * tr2, a.cx, a.baseline2, grad)
}
