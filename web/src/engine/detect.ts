import type { Rect } from './types'

// Portable computer-vision for template-faithful mode: find the phone screen
// rectangle, the Dynamic Island, and the titanium frame thickness in any device
// mockup. Pure typed-array ops — runs identically in Node and the browser.

export interface Geometry { screen: Rect; island: Rect | null; frameThickness: number }

function brightMask(d: Uint8ClampedArray, n: number, thr: number): Uint8Array {
  const m = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    if ((d[p] + d[p + 1] + d[p + 2]) / 3 > thr) m[i] = 1
  }
  return m
}

// Largest 4-connected component of a binary mask (iterative flood fill).
function largestComponent(mask: Uint8Array, W: number, H: number): Uint8Array {
  const N = W * H
  const seen = new Uint8Array(N)
  const out = new Uint8Array(N)
  const stack = new Int32Array(N)
  let best = 0
  for (let s = 0; s < N; s++) {
    if (!mask[s] || seen[s]) continue
    let sp = 0; stack[sp++] = s; seen[s] = 1
    const comp: number[] = []
    while (sp > 0) {
      const c = stack[--sp]; comp.push(c)
      const x = c % W, y = (c / W) | 0
      if (x > 0 && mask[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack[sp++] = c - 1 }
      if (x < W - 1 && mask[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack[sp++] = c + 1 }
      if (y > 0 && mask[c - W] && !seen[c - W]) { seen[c - W] = 1; stack[sp++] = c - W }
      if (y < H - 1 && mask[c + W] && !seen[c + W]) { seen[c + W] = 1; stack[sp++] = c + W }
    }
    if (comp.length > best) { best = comp.length; out.fill(0); for (const c of comp) out[c] = 1 }
  }
  return out
}

// Fill interior holes: zeros not reachable from the border become ones.
function fillHoles(mask: Uint8Array, W: number, H: number): Uint8Array {
  const N = W * H
  const bg = new Uint8Array(N)
  const stack: number[] = []
  const push = (i: number) => { if (!mask[i] && !bg[i]) { bg[i] = 1; stack.push(i) } }
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1) }
  while (stack.length) {
    const c = stack.pop()!; const x = c % W, y = (c / W) | 0
    if (x > 0) push(c - 1); if (x < W - 1) push(c + 1)
    if (y > 0) push(c - W); if (y < H - 1) push(c + W)
  }
  const out = new Uint8Array(N)
  for (let i = 0; i < N; i++) out[i] = mask[i] || !bg[i] ? 1 : 0
  return out
}

function bbox(mask: Uint8Array, W: number, H: number): Rect {
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

export function detectGeometry(d: Uint8ClampedArray, W: number, H: number): Geometry {
  const N = W * H
  const screenMask = fillHoles(largestComponent(brightMask(d, N, 180), W, H), W, H)
  const screen = bbox(screenMask, W, H)

  // Dynamic Island: largest dark blob in the top ~14% of the screen rect
  const band = Math.round(screen.h * 0.14)
  const dark = new Uint8Array(N)
  for (let y = screen.y; y < screen.y + band; y++)
    for (let x = screen.x; x < screen.x + screen.w; x++) {
      const i = y * W + x, p = i * 4
      if ((d[p] + d[p + 1] + d[p + 2]) / 3 < 60) dark[i] = 1
    }
  const islandMask = largestComponent(dark, W, H)
  let island: Rect | null = null
  for (let i = 0; i < N; i++) if (islandMask[i]) { island = bbox(islandMask, W, H); break }

  // Frame thickness: walk left/right out of the screen until the pixel turns "bg blue"
  const midY = (screen.y + (screen.h >> 1)) * W
  const isBlue = (i: number) => { const p = i * 4; return d[p + 2] - d[p] > 30 }
  let lt = 0, x = screen.x; while (x > 1 && !isBlue(midY + x)) { x--; lt++ }
  let rt = 0; x = screen.x + screen.w - 1; while (x < W - 2 && !isBlue(midY + x)) { x++; rt++ }
  const frameThickness = Math.max(12, Math.min(90, Math.max(lt, rt)))

  return { screen, island, frameThickness }
}
