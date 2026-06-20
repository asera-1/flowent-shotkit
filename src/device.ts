import type { RenderTarget, LoadedImage } from './render-target'
import type { StoreTarget } from './types'
import { roundRectPath } from './imgproc'

// Draw the titanium phone body + the app screenshot inside the screen (clipped to
// rounded corners, cover-fit by width, top aligned — matching the real templates).
export function drawDeviceAndScreen(t: RenderTarget, store: StoreTarget, shot: LoadedImage) {
  const { ctx } = t
  const d = store.device
  const s = d.screen

  // body with soft drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(8,20,50,0.34)'
  ctx.shadowBlur = Math.round(d.bezel * 2.8)
  ctx.shadowOffsetY = Math.round(d.bezel * 1.5)
  roundRectPath(ctx, s.x - d.bezel, s.y - d.bezel, s.w + d.bezel * 2, s.h + d.bezel * 2, d.cornerRadius + d.bezel)
  const body = ctx.createLinearGradient(s.x - d.bezel, 0, s.x + s.w + d.bezel, 0)
  body.addColorStop(0, '#3a3d42'); body.addColorStop(0.5, '#141619'); body.addColorStop(1, '#3a3d42')
  ctx.fillStyle = body
  ctx.fill()
  ctx.restore()

  // screen: clip rounded rect, paint white, draw screenshot
  ctx.save()
  roundRectPath(ctx, s.x, s.y, s.w, s.h, d.cornerRadius)
  ctx.clip()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(s.x, s.y, s.w, s.h)
  const scale = s.w / shot.width
  ctx.drawImage(shot.image, s.x, s.y, s.w, shot.height * scale)
  ctx.restore()
}
