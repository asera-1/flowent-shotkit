# flowent-shotkit — Full feature backlog

Everything we might add, grouped by area. This is the superset; the prioritized
build order is at the bottom. See `IMPROVEMENTS.md` for the competitive rationale.

**Status:** ✅ done · 🔶 in progress · ⬜ planned  
**Run tag:** `[C]` client-side & free · `[K]` BYOK (your key) · `[F]` fastlane (your machine) · `[S]` optional server

## 1. Input & capture
- ✅ Upload screenshots `[C]`
- ⬜ Drag-and-drop + paste-from-clipboard `[C]`
- ⬜ Import a folder / ZIP of screenshots `[C]`
- ⬜ Reorder, duplicate, delete, rename screens `[C]`
- ⬜ Pull captures from simulator / device / Xcode (CLI) `[C]`
- ⬜ Figma frame import `[K/S]`

## 2. Devices & frames
- ✅ Synthetic phone frame (auto-scales to any store) `[C]`
- ✅ Template-faithful: detect screen + island + frame in a real mockup `[C]`
- ✅ Grain-preserving recolor of a real mockup background `[C]`
- 🔶 Template mode in the studio UI (upload your own mockup) `[C]`
- ⬜ Bundled current device frames: iPhone 16/17 Pro, Pixel 9, iPad Pro M4 `[C]`
- ⬜ Headline-removal (inpaint) for mockups with baked-in captions `[C]`
- ⬜ 3D / angled device frames `[C]`
- ⬜ Two devices per slide (phone + tablet), landscape `[C]`

## 3. Layout
- ✅ Headline-above-device layout `[C]`
- ⬜ Layout library: text-top, text-bottom, split, diagonal, floating card, feature banner `[C]`
- ⬜ Multi-screen "panorama" (screenshots that connect across slides) `[C]`
- ⬜ Full-bleed screenshot (no device) `[C]`
- ⬜ Drag headline/device on canvas + snapping + safe-area guides `[C]`

## 4. Background & style
- ✅ 4 theme presets (Brand Blue / Iridescent / Teal / Clean Light) + grain `[C]`
- ⬜ Mesh-gradient generator (reuse the Designer studio's engine) `[C]`
- ⬜ Pattern/texture library, image backgrounds, blurred-screenshot bg `[C]`
- ⬜ Brand kit: save palette + fonts + logo; auto-extract palette from logo/screenshot `[C]`
- ⬜ Custom font upload; per-slide background override `[C]`

## 5. Text & headlines
- ✅ Two-line headline, gradient line, autofit, letter-spacing `[C]`
- ⬜ Eyebrow/subline, badges, star ratings, "featured by" strip `[C]`
- ⬜ Rich styling (weight, color, align, shadow, highlight), emoji/icons `[C]`
- ⬜ Text-fit warnings + "readable at thumbnail" check `[C]`

## 6. AI — the Director
- ✅ Deterministic Director (label → headline, banned-phrase guardrails) `[C]`
- ⬜ BYOK vision model: read screens → cohesive headline set + order + theme `[K]`
- ⬜ Brand-voice spec UI (tone, casing, banned list) `[C]`
- ⬜ Multiple options per screen + regenerate; AI theme suggestion; AI critique `[K]`

## 7. Localization
- ⬜ Translate the headline set per locale `[K]`
- ⬜ Auto text-fit per locale + overflow warnings `[C]`
- ⬜ Locale-specific screenshot swap; RTL (Arabic/Hebrew) `[C]`
- ⬜ Render all localized kits in one pass `[C]`

## 8. Export & store targets
- ✅ ZIP + `manifest.json`, organized by store `[C]`
- ✅ Targets: iPhone 6.9", iPad 13", Play phone `[C]`
- ⬜ Full size matrix: iPhone 6.5"/6.9", iPad 11"/13", Play phone/7"/10" tablet, **feature graphic 1024×500** `[C]`
- ⬜ Per-image PNG/JPG/WebP download + quality control `[C]`
- ⬜ Overview contact sheet inside the ZIP `[C]`
- ⬜ **fastlane** `deliver`/`supply` folder export (one-command upload) `[F]`
- ⬜ Direct App Store Connect / Play upload `[K/S]`
- ⬜ App-preview video export (canvas → WebM) `[C]`

## 9. ASO / optimization
- ⬜ A/B variant sets (2–3 per screen) for Apple PPO + Play experiments `[C]`
- ⬜ First-3-screens emphasis + thumbnail preview `[C]`
- ⬜ Best-practice linter: caption length, contrast ratio, safe area `[C]`
- ⬜ Competitor reference board `[C]`

## 10. Projects & collaboration
- ⬜ Save/load `.shotkit.json` projects; import/export `[C]`
- ⬜ Local autosave (IndexedDB) `[C]`
- ⬜ Template/preset gallery + shareable community presets `[C]`
- ⬜ Variants/versioning within a project; team sharing `[C/S]`

## 11. Developer / automation
- ✅ Headless engine + CLI + JSON config + manifest `[C]`
- ✅ Unit + render tests + CI workflow `[C]`
- ⬜ CLI: template mode, subset render, watch mode `[C]`
- ⬜ GitHub Action: regenerate kits on UI change `[C]`
- ⬜ Publish `@flowent/shotkit` to npm; API docs + examples; plugin hooks `[C]`

## 12. Platform / distribution
- ⬜ Host the studio as a free static site (GitHub Pages) `[C]`
- ⬜ PWA / offline; docs site with a gallery `[C]`
- ⬜ Optional desktop wrapper `[C]`

---

## Build order

- **P0 — done ✅:** template mode in the studio UI · full size matrix (6 targets incl. the
  1024×500 feature graphic) · mesh gradients · headline-top/bottom layouts · safe-area
  guides · per-image PNG download · contact-sheet export (CLI `_overview.png` + ZIP).
  Remaining layout variants (split / diagonal / floating) move to P1.
- **P1:** BYOK AI Director · localization · A/B variant sets · brand kit.
- **P2:** fastlane export · GitHub Action · npm publish · bundled real frames · headline inpaint.
- **P3:** app-preview video · projects/gallery · hosted studio · 3D frames · collaboration.
