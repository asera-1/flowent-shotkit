import type { Renderer, RenderTarget } from './render-target'
import type { FrameColor } from './device'
import type { Theme } from './types'
import { drawDeviceAndScreen } from './device'
import { drawBackground } from './background'

export interface PHHeadLine { text: string; accent?: boolean }
export interface PHSpec {
  screenshot: string
  side?: 'left' | 'right'
  kicker?: string
  head: PHHeadLine[]
  sub?: string
  deviceColor?: FrameColor
  theme: Theme
}
export const PH_TARGET = { id: 'producthunt-gallery', label: 'Product Hunt  1270x760', width: 1270, height: 760, folder: 'product-hunt' }

// weight-specific families that the browser/Node renderers actually register
const FAM = { k: 'Montserrat700', h: 'Montserrat800', s: 'Montserrat600' }

function fitFont(ctx: any, family: string, text: string, targetPx: number, maxW: number): number {
  let size = Math.round(targetPx)
  while (size > 16) { ctx.font = `${size}px ${family}`; if (ctx.measureText(text).width <= maxW) return size; size -= 2 }
  return 16
}

function drawText(ctx: any, W: number, H: number, spec: PHSpec, side: 'left' | 'right') {
  const tx = side === 'left' ? Math.round(W * 0.55) : Math.round(W * 0.07)
  const maxW = Math.round(W * 0.40)
  const grad = spec.theme.gradient
  type L = { kind: 'k' | 'h' | 'a' | 's'; text: string; size: number; w: number; fam: string }
  const lines: L[] = []
  const add = (kind: L['kind'], text: string, targetPx: number, fam: string) => {
    const size = fitFont(ctx, fam, text, targetPx, maxW)
    ctx.font = `${size}px ${fam}`
    lines.push({ kind, text, size, w: ctx.measureText(text).width, fam })
  }
  if (spec.kicker) add('k', spec.kicker, H * 0.030, FAM.k)
  for (const ln of spec.head) add(ln.accent ? 'a' : 'h', ln.text, H * 0.092, FAM.h)
  if (spec.sub) add('s', spec.sub, H * 0.034, FAM.s)
  const gap = (k: string) => (k === 'k' ? H * 0.020 : k === 's' ? H * 0.028 : H * 0.012)
  let total = 0
  lines.forEach((l, i) => { total += l.size; if (i > 0) total += gap(l.kind) })
  let y = Math.round(H / 2 - total / 2)
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (i > 0) y += gap(l.kind)
    ctx.font = `${l.size}px ${l.fam}`
    if (l.kind === 'a') {
      const lg = ctx.createLinearGradient(tx, 0, tx + l.w, 0)
      lg.addColorStop(0, grad[0]); lg.addColorStop(1, grad[1])
      ctx.fillStyle = lg; ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = spec.theme.headlineColor
      ctx.globalAlpha = l.kind === 'h' ? 1 : l.kind === 'k' ? 0.9 : 0.72
    }
    ctx.fillText(l.text, tx, y)
    ctx.globalAlpha = 1
    y += l.size
  }
}

export async function renderProductHunt(renderer: Renderer, spec: PHSpec): Promise<RenderTarget> {
  const W = 1270, H = 760
  const t = renderer.createTarget(W, H)
  const ctx = t.ctx
  // theme-driven background (synthetic gradient / mesh + glow + grain) — same control as the store kit
  drawBackground(t, { width: W, height: H } as any, spec.theme)
  const side = spec.side ?? 'left'
  const shot = await renderer.loadImage(spec.screenshot)
  const screenH = Math.round(H * 0.84)
  const asp = shot.width / shot.height
  const sw = Math.round(screenH * asp), sh = screenH
  const cx = side === 'left' ? Math.round(W * 0.27) : Math.round(W * 0.73)
  const cy = Math.round(H * 0.5)
  const sx = Math.round(cx - sw / 2), sy = Math.round(cy - sh / 2)
  // soft neutral glow behind the device for depth (works on any theme)
  const glow = ctx.createRadialGradient(cx, Math.round(H * 0.42), 0, cx, Math.round(H * 0.42), Math.round(Math.min(W, H) * 0.62))
  glow.addColorStop(0, 'rgba(255,255,255,0.12)'); glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
  const bezel = Math.max(2, Math.round(sw * 0.030)), cr = Math.round(sw * 0.12)
  const faux: any = { device: { screen: { x: sx, y: sy, w: sw, h: sh }, cornerRadius: cr, bezel, island: { w: Math.round(sw * 0.30), h: Math.round(sw * 0.085), top: Math.round(sw * 0.035) }, statusScale: 1 } }
  drawDeviceAndScreen(t, faux, shot, spec.deviceColor ?? 'titanium')
  drawText(ctx, W, H, spec, side)
  return t
}
