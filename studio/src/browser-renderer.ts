import type { Renderer, RenderTarget, LoadedImage } from '@engine/render-target'

let fontsP: Promise<void> | null = null
export function initFonts(): Promise<void> {
  if (!fontsP) {
    fontsP = (async () => {
      const base = (import.meta as any).env.BASE_URL
      const defs: [string, string][] = [
        ['Montserrat600', `${base}fonts/Montserrat-600.ttf`],
        ['Montserrat700', `${base}fonts/Montserrat-700.ttf`],
        ['Montserrat800', `${base}fonts/Montserrat-800.ttf`],
      ]
      await Promise.all(defs.map(async ([fam, url]) => {
        const f = new FontFace(fam, `url(${url})`)
        await f.load()
        ;(document as any).fonts.add(f)
      }))
      await (document as any).fonts.ready
    })()
  }
  return fontsP
}

function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res) => c.toBlob((b) => res(b as Blob), 'image/png'))
}

export function createBrowserRenderer(): Renderer {
  return {
    createTarget(width: number, height: number): RenderTarget {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d') as any
      return {
        width, height, ctx,
        encodePng: async () => new Uint8Array(await (await toBlob(canvas)).arrayBuffer()),
      }
    },
    async loadImage(src: string): Promise<LoadedImage> {
      const img = new Image()
      img.src = src
      await img.decode()
      return { width: img.naturalWidth, height: img.naturalHeight, image: img }
    },
  }
}

export function targetCanvas(t: RenderTarget): HTMLCanvasElement {
  return (t.ctx as CanvasRenderingContext2D).canvas
}
export function targetBlob(t: RenderTarget): Promise<Blob> {
  return toBlob(targetCanvas(t))
}
