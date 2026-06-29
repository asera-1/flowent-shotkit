import type { Renderer, RenderTarget } from './render-target'
import type { FrameColor } from './device'
import { drawDeviceAndScreen } from './device'
import { addGrain } from './imgproc'

export interface PHHeadLine { text: string; accent?: boolean }
export interface PHSpec {
  screenshot: string
  side?: 'left' | 'right'
  kicker?: string
  head: PHHeadLine[]
  sub?: string
  deviceColor?: FrameColor
  font?: string
}
export const PH_TARGET = { id: 'producthunt-gallery', label: 'Product Hunt  1270x760', width: 1270, height: 760, folder: 'product-hunt' }
const CYAN_A = '#46D6F5', CYAN_B = '#2F7BFF'

function fitFont(ctx: any, fam: string, weight: number, text: string, targetPx: number, maxW: number): number {
  let size = Math.round(targetPx)
  while (size > 16) {
    ctx.font = `${weight} ${size}px ${fam}`
    if (ctx.measureText(text).width <= maxW) return size
    size -= 2
  }
  return 16
}

function drawText(ctx: any, W: number, H: number, spec: PHSpec, side: 'left' | 'right') {
  const fam = spec.font ?? 'Montserrat'
  const tx = side === 'left' ? Math.round(W * 0.55) : Math.round(W * 0.07)
  const maxW = Math.round(W * 0.40)
  type L = { kind: 'k' | 'h' | 'a' | 's'; text: string; size: number; w: number }
  const lines: L[] = []
  const add = (kind: L['kind'], text: string, targetPx: number, weight: number) => {
    const size = fitFont(ctx, fam, weight, text, targetPx, maxW)
    ctx.font = `${weight} ${size}px ${fam}`
    lines.push({ kind, text, size, w: ctx.measureText(text).width })
  }
  if (spec.kicker) add('k', spec.kicker, H * 0.030, 700)
  for (const ln of spec.head) add(ln.accent ? 'a' : 'h', ln.text, H * 0.092, 800)
  if (spec.sub) add('s', spec.sub, H * 0.034, 600)
  const gap = (k: string) => (k === 'k' ? H * 0.020 : k === 's' ? H * 0.028 : H * 0.012)
  let total = 0
  lines.forEach((l, i) => { total += l.size; if (i > 0) total += gap(l.kind) })
  let y = Math.round(H / 2 - total / 2)
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (i > 0) y += gap(l.kind)
    const weight = l.kind === 'k' ? 700 : l.kind === 's' ? 600 : 800
    ctx.font = `${weight} ${l.size}px ${fam}`
    if (l.kind === 'a') {
      const lg = ctx.createLinearGradient(tx, 0, tx + l.w, 0)
      lg.addColorStop(0, CYAN_A); lg.addColorStop(1, CYAN_B)
      ctx.fillStyle = lg
    } else {
      ctx.fillStyle = l.kind === 'k' ? '#b0c6ee' : l.kind === 's' ? '#9fb3d9' : '#f5f8ff'
    }
    ctx.fillText(l.text, tx, y)
    y += l.size
  }
}

export async function renderProductHunt(renderer: Renderer, spec: PHSpec): Promise<RenderTarget> {
  const W = 1270, H = 760
  const t = renderer.createTarget(W, H)
  const ctx = t.ctx
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#0a1320'); grad.addColorStop(1, '#22469c')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  const side = spec.side ?? 'left'
  const shot = await renderer.loadImage(spec.screenshot)
  const screenH = Math.round(H * 0.84)
  const asp = shot.width / shot.height
  const sw = Math.round(screenH * asp), sh = screenH
  const cx = side === 'left' ? Math.round(W * 0.27) : Math.round(W * 0.73)
  const cy = Math.round(H * 0.5)
  const sx = Math.round(cx - sw / 2), sy = Math.round(cy - sh / 2)
  const glow = ctx.createRadialGradient(cx, Math.round(H * 0.42), 0, cx, Math.round(H * 0.42), Math.round(Math.min(W, H) * 0.62))
  glow.addColorStop(0, 'rgba(74,128,235,0.55)'); glow.addColorStop(1, 'rgba(74,128,235,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
  const bezel = Math.max(2, Math.round(sw * 0.030)), cr = Math.round(sw * 0.12)
  const faux: any = { device: { screen: { x: sx, y: sy, w: sw, h: sh }, cornerRadius: cr, bezel, island: { w: Math.round(sw * 0.30), h: Math.round(sw * 0.085), top: Math.round(sw * 0.035) }, statusScale: 1 } }
  drawDeviceAndScreen(t, faux, shot, spec.deviceColor ?? 'titanium')
  addGrain(ctx, W, H, 6)
  drawText(ctx, W, H, spec, side)
  return t
}
