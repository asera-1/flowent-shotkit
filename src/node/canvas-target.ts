import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import path from 'node:path'
import type { Renderer, RenderTarget, LoadedImage } from '../render-target'

let fontsLoaded = false
function ensureFonts(fontDir: string) {
  if (fontsLoaded) return
  GlobalFonts.registerFromPath(path.join(fontDir, 'Montserrat-600.ttf'), 'Montserrat600')
  GlobalFonts.registerFromPath(path.join(fontDir, 'Montserrat-700.ttf'), 'Montserrat700')
  GlobalFonts.registerFromPath(path.join(fontDir, 'Montserrat-800.ttf'), 'Montserrat800')
  fontsLoaded = true
}

export function createNodeRenderer(opts?: { fontDir?: string }): Renderer {
  ensureFonts(opts?.fontDir ?? path.join(process.cwd(), 'assets', 'fonts'))
  return {
    createTarget(width: number, height: number): RenderTarget {
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')
      return { width, height, ctx, encodePng: () => canvas.toBuffer('image/png') }
    },
    async loadImage(src: string): Promise<LoadedImage> {
      const image = await loadImage(src)
      return { width: image.width, height: image.height, image }
    },
  }
}
