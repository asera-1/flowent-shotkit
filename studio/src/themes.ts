import type { Theme } from '@engine/types'

export interface Preset { key: string; label: string; theme: Theme }

const base = { fontFamily: 'Montserrat', weightLine1: 600, weightLine2: 700 }

export const PRESETS: Preset[] = [
  { key: 'brand-blue', label: 'Brand Blue', theme: { ...base,
    headlineColor: '#F8FAFF', gradient: ['#AEE4FF', '#F4FBFF'],
    background: { kind: 'synthetic', from: '#5CA8FF', to: '#1C46DE', glow: 'rgba(150,200,255,0.30)', grain: 7 } } },
  { key: 'iridescent', label: 'Iridescent', theme: { ...base,
    headlineColor: '#16213A', gradient: ['#2D5BE3', '#7A4FE0'],
    background: { kind: 'synthetic', from: '#A9C0F0', to: '#E6A6CF', glow: 'rgba(255,240,250,0.35)', grain: 6 } } },
  { key: 'teal', label: 'Teal Brand', theme: { ...base,
    headlineColor: '#EAFFFB', gradient: ['#DAFFF8', '#AAF0FF'],
    background: { kind: 'synthetic', from: '#06324A', to: '#21C0D8', glow: 'rgba(60,200,220,0.25)', grain: 7 } } },
  { key: 'clean-light', label: 'Clean Light', theme: { ...base,
    headlineColor: '#16213A', gradient: ['#2D5BE3', '#28B6E8'],
    background: { kind: 'synthetic', from: '#F4F7FC', to: '#D6E8FB', glow: 'rgba(255,255,255,0.5)', grain: 3 } } },
]

export const PRESET_BY_KEY: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.key, p]))
