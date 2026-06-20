// Framework-agnostic surface. Node and the browser each provide a Renderer.
export interface RenderTarget {
  width: number
  height: number
  ctx: any                 // CanvasRenderingContext2D-compatible
  encodePng(): Buffer | Promise<Buffer>
}

export interface LoadedImage {
  width: number
  height: number
  image: any               // drawable into ctx.drawImage
}

export interface Renderer {
  createTarget(width: number, height: number): RenderTarget
  loadImage(src: string): Promise<LoadedImage>
}
