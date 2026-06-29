import type { RenderTarget, LoadedImage } from './render-target'
import type { StoreTarget } from './types'
import { roundRectPath } from './imgproc'

export type FrameColor = 'titanium' | 'black' | 'silver'
const BODIES: Record<FrameColor, [string, string, string]> = {
  titanium: ['#6a6e74', '#26282d', '#6a6e74'],
  black: ['#3a3d42', '#0b0c0f', '#3a3d42'],
  silver: ['#e6eaf1', '#9aa0ab', '#e6eaf1'],
}

// Draw the phone body + the app screenshot inside the screen (clipped to rounded
// corners, cover-fit by width, top aligned), with a Dynamic Island and an inner
// bezel highlight for a modern, realistic device look.
export function drawDeviceAndScreen(
  t: RenderTarget, store: StoreTarget, shot: LoadedImage, frame: FrameColor = 'titanium',
) {
  const { ctx } = t
  const d = store.device
  const s = d.screen
  const stops = BODIES[frame] ?? BODIES.titanium

  // body with soft drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(8,20,50,0.34)'
  ctx.shadowBlur = Math.round(d.bezel * 2.8)
  ctx.shadowOffsetY = Math.round(d.bezel * 1.5)
  roundRectPath(ctx, s.x - d.bezel, s.y - d.bezel, s.w + d.bezel * 2, s.h + d.bezel * 2, d.cornerRadius + d.bezel)
  const body = ctx.createLinearGradient(s.x - d.bezel, 0, s.x + s.w + d.bezel, 0)
  body.addColorStop(0, stops[0]); body.addColorStop(0.5, stops[1]); body.addColorStop(1, stops[2])
  ctx.fillStyle = body
  ctx.fill()
  ctx.restore()

  // thin inner bezel highlight ring
  ctx.save()
  roundRectPath(ctx, s.x - d.bezel * 0.5, s.y - d.bezel * 0.5, s.w + d.bezel, s.h + d.bezel, d.cornerRadius + d.bezel * 0.5)
  ctx.strokeStyle = frame === 'silver' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.10)'
  ctx.lineWidth = Math.max(1, Math.round(d.bezel * 0.14))
  ctx.stroke()
  ctx.restore()

  // screen: clip rounded rect, paint white, draw screenshot, then the island
  ctx.save()
  roundRectPath(ctx, s.x, s.y, s.w, s.h, d.cornerRadius)
  ctx.clip()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(s.x, s.y, s.w, s.h)
  const scale = s.w / shot.width
  ctx.drawImage(shot.image, s.x, s.y, s.w, shot.height * scale)
  if (d.island.w > 0 && d.island.h > 0) {
    const iw = d.island.w, ih = d.island.h
    const ix = s.x + (s.w - iw) / 2, iy = s.y + d.island.top
    roundRectPath(ctx, ix, iy, iw, ih, ih / 2)
    ctx.fillStyle = '#05070c'
    ctx.fill()
  }
  ctx.restore()
}
