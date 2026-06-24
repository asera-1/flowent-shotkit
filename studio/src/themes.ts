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
  { key: 'mesh', label: 'Mesh', theme: { ...base,
    headlineColor: '#0E1B3A', gradient: ['#2D5BE3', '#7A4FE0'],
    background: { kind: 'mesh', colors: ['#bcd0ff', '#a7e0ff', '#d9c7ff', '#ffd6ec', '#cfe0ff'], grain: 6 } } },
  { key: 'sunset', label: 'Sunset', theme: { ...base,
    headlineColor: '#FFF4EC', gradient: ['#FFE0CC', '#FFF6EE'],
    background: { kind: 'synthetic', from: '#FF8A5B', to: '#D7387F', glow: 'rgba(255,210,180,0.30)', grain: 7 } } },
  { key: 'grape', label: 'Grape', theme: { ...base,
    headlineColor: '#F3EEFF', gradient: ['#D9C7FF', '#F3EEFF'],
    background: { kind: 'synthetic', from: '#7A4FE0', to: '#3A1C9E', glow: 'rgba(200,180,255,0.28)', grain: 7 } } },
  { key: 'forest', label: 'Forest', theme: { ...base,
    headlineColor: '#ECFFF6', gradient: ['#CFFCE6', '#ECFFF6'],
    background: { kind: 'synthetic', from: '#2BB673', to: '#0B6E4F', glow: 'rgba(150,255,210,0.22)', grain: 7 } } },
  { key: 'coral', label: 'Coral', theme: { ...base,
    headlineColor: '#FFF1F1', gradient: ['#FFD6D6', '#FFF1F1'],
    background: { kind: 'synthetic', from: '#FF6B6B', to: '#C2255C', glow: 'rgba(255,200,200,0.28)', grain: 7 } } },
  { key: 'noir', label: 'Noir', theme: { ...base,
    headlineColor: '#FFFFFF', gradient: ['#C9D2E3', '#FFFFFF'],
    background: { kind: 'synthetic', from: '#2A2D34', to: '#0B0D12', glow: 'rgba(120,140,180,0.18)', grain: 9 } } },
  { key: 'aurora', label: 'Aurora', theme: { ...base,
    headlineColor: '#06241B', gradient: ['#2BB673', '#21C0D8'],
    background: { kind: 'mesh', colors: ['#8ef0c8', '#7ad7ff', '#b6a7ff', '#caffea', '#9fe0ff'], grain: 6 } } },
  { key: 'candy', label: 'Candy', theme: { ...base,
    headlineColor: '#3A1430', gradient: ['#D7387F', '#7A4FE0'],
    background: { kind: 'mesh', colors: ['#ffc7e6', '#ffd9b0', '#c7d0ff', '#ffe0ec', '#e0c7ff'], grain: 6 } } },
]

export const PRESET_BY_KEY: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.key, p]))
