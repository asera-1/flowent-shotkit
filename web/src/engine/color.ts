import type { Theme } from './types'

export function hexToRgb(h: string) {
  const x = h.replace('#', '')
  const f = x.length === 3 ? x.split('').map((c) => c + c).join('') : x
  const n = parseInt(f, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
export function rgbToHex(r: number, g: number, b: number) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}
export function darken(hex: string, amt: number) { const { r, g, b } = hexToRgb(hex); return rgbToHex(mix(r, 0, amt), mix(g, 0, amt), mix(b, 0, amt)) }
export function lighten(hex: string, amt: number) { const { r, g, b } = hexToRgb(hex); return rgbToHex(mix(r, 255, amt), mix(g, 255, amt), mix(b, 255, amt)) }
export function relLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrastRatio(a: string, b: string) {
  const L1 = relLuminance(a), L2 = relLuminance(b)
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}
export function themeFromColors(from: string, to: string): Theme {
  const light = relLuminance(from) > 0.5
  return { fontFamily: 'Montserrat', weightLine1: 600, weightLine2: 700,
    headlineColor: light ? '#16213A' : '#F8FAFF',
    gradient: [lighten(from, 0.5), '#F4FBFF'],
    background: { kind: 'synthetic', from, to, glow: 'rgba(255,255,255,0.26)', grain: 6 } }
}
// dominant vivid colors sampled from an image (client-side, no deps)
export async function paletteFromImage(url: string): Promise<string[]> {
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; await img.decode()
  const w = 64, h = Math.max(1, Math.round(64 * img.naturalHeight / Math.max(1, img.naturalWidth)))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!; g.drawImage(img, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data
  const buckets: Record<string, { r: number; g: number; b: number; n: number; sat: number }> = {}
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], a = d[i + 3]; if (a < 128) continue
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b)
    const sat = mx === 0 ? 0 : (mx - mn) / mx, lum = (r + gg + b) / 3
    if (sat < 0.18 || lum < 28 || lum > 240) continue
    const key = `${Math.round(r / 32)}-${Math.round(gg / 32)}-${Math.round(b / 32)}`
    const bk = buckets[key] ?? (buckets[key] = { r: 0, g: 0, b: 0, n: 0, sat: 0 })
    bk.r += r; bk.g += gg; bk.b += b; bk.n++; bk.sat += sat
  }
  const arr = Object.values(buckets).sort((a, b) => (b.n * b.sat) - (a.n * a.sat))
  const top = arr.slice(0, 2).map((bk) => rgbToHex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n))
  return top.length ? top : ['#5CA8FF']
}
