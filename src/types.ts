export interface Rect { x: number; y: number; w: number; h: number }


export type GradientStyle = 'diagonal' | 'vertical' | 'radial' | 'conic' | 'spotlight'

export type BackgroundSpec =
  | { kind: 'synthetic'; from: string; to: string; glow?: string; grain?: number; style?: GradientStyle }
  | { kind: 'mesh'; colors: string[]; grain?: number }

export type Layout = 'headline-top' | 'headline-bottom'

export interface Theme {
  fontFamily: string            // registered base family, e.g. 'Montserrat'
  weightLine1?: number          // default 600
  weightLine2?: number          // default 700
  headlineColor: string         // line 1 colour
  gradient: [string, string]    // line 2 gradient stops (left -> right)
  background: BackgroundSpec
  layout?: Layout               // default 'headline-top'
  deviceColor?: 'titanium' | 'black' | 'silver'  // synthetic frame finish
}

export interface DeviceSpec {
  screen: Rect
  cornerRadius: number
  bezel: number
  island: { w: number; h: number; top: number }
  statusScale: number
}

export interface HeadlineAnchors {
  cx: number
  baseline1: number
  baseline2: number
  cap1: number
  cap2: number
  maxWidth: number
}

export interface StoreTarget {
  id: string
  label: string
  width: number
  height: number
  platform: 'app-store' | 'google-play'
  folder: string
  device: DeviceSpec
  headline: HeadlineAnchors
  featureGraphic?: boolean       // landscape banner: headline only, no device
}

export interface Slide {
  id: string
  screenshot: string
  headline: { line1: string; line2: string }
  frame?: string                         // template-faithful: a real device mockup
  recolor?: { from: string; to: string } // recolor that mockup's background, keep the grain
}

export interface Project {
  theme: Theme
  stores: StoreTarget[]
  slides: Slide[]
}

export function defineProject(p: Project): Project { return p }
