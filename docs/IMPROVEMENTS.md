# Making flowent-shotkit best-in-class — and still 100% open source

A study of the leading store-screenshot tools (AppLaunchpad, AppScreenStudio,
AppMockUp, BrandBird, Mockly, AppDrift, Previewed, and fastlane `frameit`/`deliver`)
and a concrete plan to match or beat them **without a backend, without watermarks,
and without SaaS lock-in**.

## The guiding principle

Anything the paid tools do on a server, we do **client-side**, **BYOK** (your own API
key), or via **fastlane** (your machine). The renderer stays free, offline, MIT. The
"magic" features are opt-in and cost *you* nothing to host.

| Capability | What the leaders do | Where they run it | Our OSS-friendly answer |
|---|---|---|---|
| Device frames | Latest iPhone/iPad/Pixel, some 3D (Mockly) | bundled assets | Bundle real frames + **template-faithful recolor** (port the Python) |
| Layouts/templates | Many (split, floating card, multi-screen) | client | Add a layout library (we have 1) |
| Backgrounds | Mesh gradients, patterns, presets | client | We have 4 themes — add mesh + patterns + custom |
| Headlines / AI | AI writes headlines from screenshots | server AI | **AI Director, BYOK** vision model (your key) |
| Localization | 20–40+ languages, cultural adaptation | server AI | Translate + auto text-fit per locale, **BYOK** |
| All store sizes | One-click every required size | client | Expand target matrix (we have 3) |
| A/B variants | Generate variants to test | client | Cheap to render — export **variant sets** |
| App preview video | +25% installs reported | server/client | Client-side canvas → WebM (MediaRecorder) |
| Store upload | Few do it; most manual | server | Generate **fastlane `deliver`/`supply`** folders |
| Cost | Free tiers, often watermarked/paywalled | SaaS | **MIT, no watermark, no signup, no server** |

## Roadmap (tagged: [client] free · [BYOK] your key · [fastlane] your machine)

### P0 — close the obvious gaps (all [client], all free)
1. **Full size matrix** — App Store iPhone 6.5"/6.9", iPad 13"/11"; Play phone, 7" & 10"
   tablet, and the **1024×500 feature graphic**. (We have 3 targets.)
2. **Template-faithful mode** — drop in your *real* device mockup; auto-detect the screen +
   island; grain-preserving recolor of the background (the Python frequency-separation trick).
   This is our single biggest differentiator vs. generic synthetic frames.
3. **Layout library** — text-top / text-bottom / split / floating-card / multi-screen bleed,
   on top of the 4 backgrounds + mesh gradients.
4. **Best-practice guardrails** — safe-area overlays, a thumbnail-size preview (the first 3
   screens convert most), and text-fit warnings for long/translated copy.
5. **Export polish** — per-image download, ZIP, and a generated overview contact sheet.

### P1 — the differentiators
6. **AI Director, for real** [BYOK] — a vision model labels each screen, writes a *cohesive*
   headline set in your brand voice (banned-phrase guardrails), and suggests order + theme.
   Deterministic offline fallback already ships.
7. **Localization** [BYOK] — translate the headline set and re-fit per locale; render localized
   kits in one pass.
8. **A/B variant sets** [client] — generate 2–3 headline/background variants per screen for
   Apple Product Page Optimization and Google Play experiments (both free in-store).

### P2 — pro / developer
9. **fastlane export** [fastlane] — output the exact `fastlane/screenshots` (iOS) and
   `fastlane/metadata/android/<locale>/images` (Play) folder structure so a user ships with
   one `fastlane deliver` / `supply` — no backend, no manual upload.
10. **CLI parity + GitHub Action** — regenerate the whole kit in CI whenever the app UI changes.
11. **App preview video** [client] — short animated export via canvas + MediaRecorder.

### P3 — community & polish
12. **Template/theme gallery** + shareable community presets (JSON), project import/export.
13. Optional **3D device frames**, in-browser screenshot capture, a docs site with examples.

## What keeps it "for everyone"
- The renderer is **100% client-side** (browser) and **headless** (Node/CLI/CI) — one MIT engine.
- Power features are **BYOK** (your key) or **fastlane** (your machine): you never pay to host.
- Ship the engine on **npm** and the studio as a **free static site** (e.g. GitHub Pages) — no
  signup, no watermark, no server bill.

## Honest positioning
The market is semi-commoditized, so we don't win on feature count. We win on a combination
almost no one offers together: **template-faithful output + an open engine that's CLI *and*
browser *and* AI + zero SaaS lock-in.** That's the wedge for developers who ship many apps and
dislike watermarked, paywalled tools.
