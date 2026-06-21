import type { Renderer, RenderTarget } from './render-target'

// Compose an overview contact sheet from already-rendered slides.
export function buildContactSheet(
  renderer: Renderer, items: { label: string; target: RenderTarget }[], fontFamily = 'Montserrat700',
): RenderTarget {
  const cols = Math.min(5, Math.max(1, items.length))
  const rows = Math.ceil(items.length / cols)
  const TW = 240, TH = 500, pad = 16, top = 52, labelH = 24
  const W = pad + cols * (TW + pad)
  const H = top + rows * (TH + labelH + pad)
  const sheet = renderer.createTarget(W, H)
  const ctx = sheet.ctx
  ctx.fillStyle = '#0b1430'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#eaf0ff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.font = `28px ${fontFamily}`
  ctx.fillText('flowent-shotkit — kit overview', pad, top / 2)
  items.forEach((it, i) => {
    const c = i % cols, r = (i / cols) | 0
    const x = pad + c * (TW + pad), y = top + r * (TH + labelH + pad)
    const src = (it.target.ctx as any).canvas
    const s = Math.min(TW / src.width, TH / src.height)
    const dw = src.width * s, dh = src.height * s
    ctx.drawImage(src as any, x + (TW - dw) / 2, y + (TH - dh) / 2, dw, dh)
    ctx.fillStyle = '#9db0d0'; ctx.font = `15px ${fontFamily}`
    ctx.fillText(it.label.slice(0, 26), x + 2, y + TH + labelH / 2 + 2)
  })
  return sheet
}
