import type { StoreTarget } from './types'

// Synthetic-phone target with geometry derived from canvas size. Sized by HEIGHT
// (~0.73 of canvas) which matches the real templates across iPhone / iPad / Play.
function phoneTarget(o: {
  id: string; label: string; width: number; height: number
  platform: StoreTarget['platform']; folder: string
}): StoreTarget {
  const { width: W, height: H } = o
  const sh = Math.round(0.73 * H), sw = Math.round(sh * 0.462)
  const top = Math.round(0.28 * H), x = Math.round((W - sw) / 2)
  return {
    id: o.id, label: o.label, width: W, height: H, platform: o.platform, folder: o.folder,
    device: {
      screen: { x, y: top, w: sw, h: sh },
      cornerRadius: Math.round(0.096 * sw), bezel: Math.round(0.021 * sw),
      island: { w: Math.round(0.245 * sw), h: Math.round(0.067 * sw), top: Math.round(0.035 * sw) },
      statusScale: sw / 943,
    },
    headline: {
      cx: Math.round(W / 2), baseline1: Math.round(0.143 * H), baseline2: Math.round(0.206 * H),
      cap1: Math.round(0.021 * H), cap2: Math.round(0.038 * H), maxWidth: Math.round(0.9 * W),
    },
  }
}

export const targets = {
  appStoreIphone69: phoneTarget({ id: 'appstore-iphone-69', label: 'App Store iPhone 6.9"', width: 1290, height: 2796, platform: 'app-store', folder: 'app-store/apple-iphone-69' }),
  appStoreIphone65: phoneTarget({ id: 'appstore-iphone-65', label: 'App Store iPhone 6.5"', width: 1242, height: 2688, platform: 'app-store', folder: 'app-store/apple-iphone-65' }),
  appStoreIpad13: phoneTarget({ id: 'appstore-ipad-13', label: 'App Store iPad 13"', width: 2064, height: 2752, platform: 'app-store', folder: 'app-store/apple-ipad-13' }),
  playPhone: phoneTarget({ id: 'play-phone', label: 'Google Play phone', width: 1080, height: 1920, platform: 'google-play', folder: 'google-play/play-phone' }),
  playTablet10: phoneTarget({ id: 'play-tablet-10', label: 'Google Play 10" tablet', width: 1600, height: 2560, platform: 'google-play', folder: 'google-play/play-tablet-10' }),
  playFeatureGraphic: {
    id: 'play-feature-graphic', label: 'Google Play feature graphic', width: 1024, height: 500,
    platform: 'google-play', folder: 'google-play/feature-graphic', featureGraphic: true,
    device: { screen: { x: 0, y: 0, w: 1, h: 1 }, cornerRadius: 0, bezel: 0, island: { w: 0, h: 0, top: 0 }, statusScale: 1 },
    headline: { cx: 512, baseline1: 215, baseline2: 320, cap1: 46, cap2: 82, maxWidth: 920 },
  },
} satisfies Record<string, StoreTarget>

export const allTargets: StoreTarget[] = [
  targets.appStoreIphone69, targets.appStoreIphone65, targets.appStoreIpad13,
  targets.playPhone, targets.playTablet10, targets.playFeatureGraphic,
]
