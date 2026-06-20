# Making the Engine Reusable — Architecture, Tech Stack & Repo Blueprint

Companion to [ENGINE.md](./ENGINE.md). That doc explains *how the engine works*; this
one explains *how to ship it as a product anyone can use*.

---

## 1. Goal & constraints

**Goal:** any developer (starting with us) can turn raw app screenshots into a complete,
on-brand store kit in minutes — in the browser, with no design pass and no server.

**Constraints that shape every choice:**

- **Browser-first, no backend.** The studio already runs fully client-side (Canvas +
  IndexedDB + no-dep ZIP). "Available for everyone" should not mean "rent a GPU server."
- **One screenshot in, many slides out.** The unit of value is a *kit*, not one image.
- **The same logic must run headless** (CI, batch, "regenerate all 27 when the UI
  changes") and **interactively** (drag a headline on a canvas).
- **Reproducible & versionable.** A project is data; rendering is a pure function of it.

---

## 2. Tech-stack decision (the biggest-ROI choice)

**Recommendation: TypeScript everywhere, with a framework-agnostic engine that runs on
both the browser Canvas and Node.**

The prototype was Python (OpenCV/scipy) because it is the fastest way to *discover* the
algorithms. It is the wrong thing to *ship* here, because shipping Python means running a
server, and that breaks the no-backend constraint and doubles the stack.

| Option | Runs in browser | Runs headless | Shares code w/ studio | Server needed | Verdict |
|--------|:---------------:|:-------------:|:---------------------:|:-------------:|---------|
| Python (OpenCV/scipy) | ✗ | ✓ | ✗ | ✓ | Great prototype, wrong product |
| TS + WASM OpenCV | ~ | ✓ | ~ | ✗ | Heavy, slow cold-start, overkill |
| **TS engine over Canvas/ImageData** | **✓** | **✓** | **✓** | **✗** | **Chosen** |

**Why TS wins the ROI test:**

- **One language, one mental model** — the engine, the CLI and the studio are the same
  codebase. No Python/JS bridge, no second runtime.
- **The CV we need is small.** We do not need general computer vision. We need: a
  separable blur, connected-components + hole-fill, mask dilation/feather, and gradient
  text. All of that is a few hundred lines over `Uint8ClampedArray` — portable, no native
  deps, and it runs identically in the browser and Node.
- **It runs for everyone, for free** — client-side in the studio; and as an `npm`
  package + CLI for developers who want batch/CI.
- **The synthetic-background path removes the hardest dependency.** Because the
  production engine *draws* the background (gradient + procedural grain) rather than
  recolouring a photo, we never need OpenCV inpaint at all (see ENGINE.md §7).

**Libraries (all prebuilt, no compilation pain):**

- Browser render target: native `CanvasRenderingContext2D` + `ImageData` — zero deps.
- Node render target: **`@napi-rs/canvas`** (prebuilt binaries, browser-compatible API).
- Image processing: a small internal `imgproc` module in pure TS (portable typed-array
  ops).
- ZIP: reuse the existing no-dep `src/lib/zip.ts`.
- Fonts: bundle **Montserrat** (`.ttf`/`.woff2`); `FontFace` in the browser,
  `GlobalFonts.registerFromPath` in Node.
- Tooling: Vite (studio), `tsup` (engine/CLI build), Vitest (tests), pnpm workspaces.

---

## 3. Target architecture

A thin, framework-agnostic **engine** at the center; everything else is an adapter.

```
            ┌──────────────────────────────────────────────┐
            │                @flowent/engine               │
            │  pure TS · no DOM · no Node · no React        │
            │  in:  Project + RenderTarget                  │
            │  out: pixels (ImageData / Buffer)             │
            └──────────────────────────────────────────────┘
              ▲                  ▲                    ▲
   browser canvas         node canvas           (future) worker
      adapter               adapter               adapter
        │                     │                      │
   ┌─────────┐          ┌──────────┐          ┌──────────────┐
   │ Studio  │          │   CLI    │          │  CI / batch  │
   │ (React) │          │ (Node)   │          │  regenerate  │
   └─────────┘          └──────────┘          └──────────────┘
```

The engine never imports `react`, `window`, or `fs`. It takes a tiny `RenderTarget`
interface (give me a canvas of size W×H, hand me back its pixels). Browser and Node each
provide one ~20-line implementation.

---

## 4. Recommended repo

A clean repo (the studio becomes one app inside it). pnpm + Turborepo workspaces.

```
flowent-shotkit/
├─ package.json                # workspaces, scripts
├─ turbo.json
├─ README.md
├─ docs/
│  ├─ ENGINE.md                # ← the engine deep-dive
│  └─ REUSABILITY.md           # ← this file
├─ packages/
│  ├─ engine/                  # @flowent/engine  (the product)
│  │  ├─ src/
│  │  │  ├─ index.ts
│  │  │  ├─ types.ts           # Project, Slide, Theme, StoreTarget
│  │  │  ├─ detect.ts          # screen rect + island + frame thickness
│  │  │  ├─ compose.ts         # swap + statusbar + lift, orchestrates a slide
│  │  │  ├─ statusbar.ts       # clean 9:41 + glyphs, scalable
│  │  │  ├─ headline.ts        # layout + gradient fill + autofit
│  │  │  ├─ background.ts      # gradient + grain + (optional) recolor
│  │  │  ├─ imgproc.ts         # blur, label, fillHoles, dilate, feather
│  │  │  ├─ targets.ts         # store presets + per-target anchors
│  │  │  └─ render-target.ts   # RenderTarget interface
│  │  └─ __tests__/            # unit + golden-image tests
│  ├─ canvas-node/             # @flowent/canvas-node (napi-rs adapter)
│  ├─ canvas-browser/          # @flowent/canvas-browser (DOM adapter)
│  └─ cli/                     # @flowent/cli  ("shotkit build …")
├─ apps/
│  └─ studio/                  # the existing React app, now imports the engine
└─ assets/
   ├─ fonts/montserrat/*.woff2
   └─ frames/                  # device templates (optional; synthetic by default)
```

If a full monorepo feels heavy on day one, ship `packages/engine` + `packages/cli` as a
**single standalone repo first**, and have the studio depend on the published package
later. Either path leads to the same place.

---

## 5. The engine API

Small, pure, and the same in every environment.

```ts
// types.ts
export interface Theme {
  font: 'montserrat'
  headline: { line1: string; line2: [string, string] } // l1 colour, l2 gradient stops
  background:
    | { kind: 'synthetic'; from: string; to: string; grain: number }
    | { kind: 'recolor'; sourceFrame: ImageInput; from: string; to: string }
}

export interface StoreTarget {
  id: 'appstore-iphone-69' | 'appstore-ipad-13' | 'play-phone' | string
  width: number; height: number
  headline: { cx: number; baseline1: number; baseline2: number; cap1: number; cap2: number }
}

export interface Slide {
  id: string
  screenshot: ImageInput          // raw capture
  frame?: ImageInput              // device template; omit to use a synthetic frame
  headline: { line1: string; line2: string }
}

export interface Project { theme: Theme; stores: StoreTarget[]; slides: Slide[] }
```

```ts
// index.ts — the whole public surface
export async function renderSlide(
  project: Project, slide: Slide, store: StoreTarget, target: RenderTarget
): Promise<Pixels>

export async function renderProject(
  project: Project, target: RenderTargetFactory
): Promise<Map<string /* store/slide */, Pixels>>

// detection is exposed too — it powers the studio's "auto-detect device" feature
export function detectGeometry(frame: Pixels): { screen: Rect; island: Rect; frameThickness: number }
```

`renderSlide` runs the six stages from ENGINE.md. `renderProject` loops stores × slides
and is what the CLI and "Export ZIP" both call.

---

## 6. CLI design

Headless, config-driven, CI-friendly — the "regenerate all 27" button.

```bash
npx @flowent/cli build --config flowent.shotkit.ts --out ./dist/release
npx @flowent/cli build --only appstore-iphone-69 --slides 8,9   # re-render a subset
```

```ts
// flowent.shotkit.ts  (typed config = no YAML guessing)
import { defineProject, stores } from '@flowent/engine'

export default defineProject({
  theme: {
    font: 'montserrat',
    headline: { line1: '#F8FAFF', line2: ['#3C69E1', '#08B2D2'] },
    background: { kind: 'synthetic', from: '#5CA8FF', to: '#1C4ADE', grain: 7 },
  },
  stores: [stores.appStoreIphone69, stores.appStoreIpad13, stores.playPhone],
  slides: [
    { id: 'home',  screenshot: './shots/home.png',  headline: { line1: 'YOUR NEXT LESSON', line2: 'READY EVERY DAY' } },
    { id: 'vocab', screenshot: './shots/saved.png', headline: { line1: 'BEAT THE',         line2: 'FORGETTING CURVE' } },
    // …
  ],
})
```

Output mirrors the store layout the studio already uses:

```
dist/release/manifest.json
dist/release/app-store/apple-iphone-69/01-home.png
dist/release/google-play/play-phone/01-home.png
```

---

## 7. How it plugs into the existing studio

The studio already has the right data model (`ReleaseSettings`, `ReleaseShot`) and the
right output (ZIP + manifest). The engine *upgrades the renderer*, it does not replace
the app.

- **Map the types.** `ReleaseShot` → `Slide`; `ReleaseSettings.targets` → `StoreTarget[]`.
  A 1-file adapter, no data migration.
- **Add two capabilities the studio lacks today** (both already proven in the prototype):
  1. **Template-faithful mode** — let a user drop a real device-frame image; `detectGeometry`
     finds the screen + island so their screenshot lands natively (vs only synthetic frames).
  2. **Grain-preserving recolor** — the frequency-separation background, so an existing
     textured brand background can be re-tinted without losing its noise.
- **Swap the export call.** "Export ZIP" calls `renderProject` instead of the inline
  Canvas code in `App.tsx`.

Net effect: the studio keeps every feature it has and gains the two senior-designer
tricks, while the rendering logic now lives in a tested package.

---

## 8. Untangling `App.tsx` (4,053 lines)

The monolith is the main risk to velocity. Refactor *incrementally*, never in one big
rewrite:

1. **Extract pure render helpers first.** Anything that takes pixels/ctx and returns
   pixels moves into `packages/engine`. This is safe — pure functions, easy to test.
2. **Extract state into hooks.** `useReleaseProject`, `usePlaygroundSettings`,
   `useCarousel` — lift the `useState` clusters out of the component body.
3. **Split the view.** `ReleaseStudio`, `CarouselStudio`, `ArtworkStudio`, plus a
   `<Canvas>` wrapper. `App.tsx` becomes a ~100-line router/shell.
4. **Lock behaviour with golden-image tests** before/while moving code, so refactors are
   provably non-breaking.

Target: `App.tsx` under ~150 lines; everything else in `packages/engine` or
`apps/studio/src/{features,hooks,components}`.

---

## 9. Distribution — how "everyone" actually uses it

- **The studio** (hosted static site): non-developers, click-and-export. Primary channel.
- **`@flowent/engine` on npm:** developers embed it in their own tools.
- **`@flowent/cli`:** teams wire "regenerate store kit" into CI so screenshots are never
  stale after a UI change.
- **(Optional) a Cowork skill** that calls the CLI, so the whole thing is drivable in
  plain language — "swap in this new screenshot and rebuild all stores" — which is
  exactly how this project was run.

---

## 10. Phased roadmap

| Phase | Deliverable | Why first |
|-------|-------------|-----------|
| **0** | `packages/engine` skeleton + `types.ts` + `imgproc.ts` + golden-image test harness | Foundation; lets everything else be tested |
| **1** | Port stages 1–6 to TS; CLI `build`; reproduce the Flowent 27 from a config | Proves parity with the prototype, headless |
| **2** | Browser adapter; wire `renderProject` into the studio's Export | Ships the engine to real users |
| **3** | Add template-faithful + recolor modes to the studio UI | The two senior-designer upgrades |
| **4** | Incremental `App.tsx` breakup behind golden tests | Pays down the monolith safely |
| **5** | Publish `@flowent/engine` + `@flowent/cli`; optional Cowork skill | "Available for everyone" |

---

## 11. Risks & mitigations

- **Browser/Node pixel drift.** Mitigate with a shared `imgproc` (no platform CV) and
  golden-image tests run in both environments.
- **Font rendering differences.** Bundle the font; never rely on system fonts; pin the
  canvas library version.
- **Scope creep from the studio UI.** Keep the engine headless and UI-free; the app may
  change weekly, the engine should be stable.
- **Large batches.** iPad assets are ~5.7 MP; render in a worker / in pairs (the
  prototype's timeout lesson) and stream ZIP entries.

---

## 12. The AI Director layer (screenshots → copy)

The renderer is deterministic. The **Director** is the AI layer that *fills the config the
renderer consumes*. It runs **once per project, not per render** — a handful of calls to
design a kit, then the renderer produces all slides locally forever.

**What is AI vs. deterministic:**

| AI does (judgment + language) | Deterministic does (mechanics) |
|-------------------------------|--------------------------------|
| Read each screenshot (vision) → label the feature | All compositing (detect, swap, status bar, recolor, scale) |
| Draft a cohesive headline *set* (one campaign voice) | Text-fit / autofit measurement |
| Curate & order (pick best N; hook→core→proof→retention) | Device / aspect detection, store sizing |
| Localize (translate + re-fit per market) | Contrast & safe-area checks |
| Critique (weak hero, busy screen, low contrast) | PNG/ZIP export |

**Guardrails (AI drafts, it does not decide):**

- A **brand-voice spec** (tone, person, casing).
- A **banned-phrase list** — no trailing commas, no em dashes, no "in seconds" / "for real
  life" / "that actually works". (These are exactly the tells we stripped by hand.)
- A **length budget per store** so line 2 never overflows.
- **Human-in-the-loop**: AI proposes, the user edits on canvas; manual copy always works.

**Provider-agnostic interface (BYOK by default; swap in any model):**

```ts
export interface DirectorInput {
  screenshots: { id: string; image: ImageInput; label?: string }[]
  appProfile: { name: string; category?: string; benefit?: string; tone?: BrandTone }
  brandVoice: BrandVoiceSpec      // tone, casing, banned phrases
  stores: StoreTarget[]           // for length budgets
  locales?: string[]              // optional localization
}

export interface DirectorOutput {
  order: string[]                                   // screenshot ids, best-first
  slides: { screenshotId: string; headline: { line1: string; line2: string }; subline?: string }[]
  theme?: Partial<Theme>                            // suggested palette/background
  localized?: Record<string, DirectorOutput['slides']>
  notes?: string[]                                  // critic feedback
}

export interface Director { generate(input: DirectorInput): Promise<DirectorOutput> }
```

**Two implementations ship:**

- `DeterministicDirector` — **no API**: OCR/label heuristics + brand-voice templates. Zero
  cost, fully reproducible, a solid offline fallback.
- `LlmDirector` (**BYOK**) — a vision LLM driven by the brand-voice spec + banned-phrase
  guardrails, returning the structured `DirectorOutput`. The key lives in the user's
  browser; calls go straight to the provider; **you host nothing**.

**Cost shape:** a few calls to *design* a kit (not per slide, not per render).
Localization multiplies by locale count — still tiny. The renderer never calls anything.

---

## 13. Recommendation in one line

**Build `@flowent/engine` in TypeScript as a headless, Canvas-based library; expose it
through a CLI and your existing studio; keep the algorithms from ENGINE.md verbatim.**
It is the smallest stack that gives us every tool we need, runs for everyone with no
server, and turns a one-off Flowent run into a repeatable product.

*Say the word and I'll scaffold `flowent-shotkit` (engine skeleton + types + CLI stub +
test harness) so Phase 0 is ready to code.*
