import type { StoreTarget, Theme } from '../types'

export type BrandTone = 'direct' | 'premium' | 'playful' | 'educational'

export interface BrandVoiceSpec {
  tone: BrandTone
  casing: 'upper' | 'title'
  banned: string[]            // phrases/tokens to strip (e.g. ',', '—', 'in seconds')
}

export interface DirectorScreenshot { id: string; image: string; label?: string }

export interface DirectorInput {
  screenshots: DirectorScreenshot[]
  appProfile: { name: string; category?: string; benefit?: string }
  brandVoice: BrandVoiceSpec
  stores: StoreTarget[]
  locales?: string[]
}

export interface DirectorSlideCopy {
  screenshotId: string
  headline: { line1: string; line2: string }
  subline?: string
}

export interface DirectorOutput {
  order: string[]
  slides: DirectorSlideCopy[]
  theme?: Partial<Theme>
  localized?: Record<string, DirectorSlideCopy[]>
  notes?: string[]
}

export interface Director { generate(input: DirectorInput): Promise<DirectorOutput> }
