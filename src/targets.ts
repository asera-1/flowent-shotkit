import type { StoreTarget } from './types'

// Build a synthetic-phone store target with geometry derived from canvas size.
// Phone is sized by HEIGHT (~0.73 of canvas) which matches the real templates
// across iPhone / iPad / Play. Everything else is phone-relative so it scales.
function phoneTarget(opts: {
  id: string; label: string; width: number; height: number
  platform: StoreTarget['platform']; folder: string
}): StoreTarget {
  const { width: W, height: H } = opts
  const sh = Math.round(0.73 * H)
  const sw = Math.round(sh * 0.462)
  const top = Math.round(0.28 * H)
  const x = Math.round((W - sw) / 2)
  return {
    id: opts.id, label: opts.label, width: W, height: H,
    platform: opts.platform, folder: opts.folder,
    device: {
      screen: { x, y: top, w: sw, h: sh },
      cornerRadius: Math.round(0.096 * sw),
      bezel: Math.round(0.021 * sw),
      island: { w: Math.round(0.245 * sw), h: Math.round(0.067 * sw), top: Math.round(0.035 * sw) },
      statusScale: sw / 943,
    },
    headline: {
      cx: Math.round(W / 2),
      baseline1: Math.round(0.143 * H),
      baseline2: Math.round(0.206 * H),
      cap1: Math.round(0.021 * H),
      cap2: Math.round(0.038 * H),
      maxWidth: Math.round(0.9 * W),
    },
  }
}

export const targets = {
  appStoreIphone69: phoneTarget({
    id: 'appstore-iphone-69', label: 'App Store iPhone 6.9"',
    width: 1290, height: 2796, platform: 'app-store', folder: 'app-store/apple-iphone-69',
  }),
  appStoreIpad13: phoneTarget({
    id: 'appstore-ipad-13', label: 'App Store iPad 13"',
    width: 2064, height: 2752, platform: 'app-store', folder: 'app-store/apple-ipad-13',
  }),
  playPhone: phoneTarget({
    id: 'play-phone', label: 'Google Play phone',
    width: 1080, height: 1920, platform: 'google-play', folder: 'google-play/play-phone',
  }),
} satisfies Record<string, StoreTarget>

export const allTargets: StoreTarget[] = [
  targets.appStoreIphone69, targets.appStoreIpad13, targets.playPhone,
]
