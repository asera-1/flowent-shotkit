# The Flowent Screenshot Engine

How we turn raw in-app screenshots into store-ready, on-brand App Store / Google Play
artwork — automatically, reproducibly, and at the quality bar of a senior designer.

This document explains the *engine*: the ideas, the algorithms, and the hard-won
details. The companion doc, [REUSABILITY.md](./REUSABILITY.md), explains how to ship
it as a reusable tool.

---

## 1. Philosophy

A store screenshot is not a painting — it is a **composition of known layers**:

```
background  →  device frame  →  app screen  →  status bar  →  headline
```

Once you can *locate* and *regenerate* each layer programmatically, producing 27
polished slides (9 screens × 3 stores) is a pipeline, not a week of manual work.

Three principles drive every design decision:

- **Deterministic.** Same inputs → same pixels. No manual nudging. This is what makes
  9 screens × 3 stores trivial and re-runnable when the app UI changes.
- **Template-faithful.** We *reuse the real brand template* (the actual device mockup,
  the actual grain texture, the actual headline style) instead of generating a generic
  look. The output is indistinguishable from a hand-built version because it *is* the
  same template with new content swapped in.
- **Measured, not guessed.** Geometry (screen rectangle, island, frame thickness) is
  detected from the pixels every time, so the same code works across iPhone, iPad and
  Play without per-store hand-tuning.

---

## 2. Pipeline at a glance

```
            ┌─────────────────────────────────────────────────────────┐
 RAW APP    │  1 DETECT     screen rect + Dynamic Island + frame edge  │
 SCREENSHOT │  2 SWAP       fit + paste through screen silhouette      │
    +       │  3 STATUSBAR  cover capture, redraw clean 9:41           │
 TEMPLATE   │  4 HEADLINE   remove old text, retypeset (gradient)      │
 FRAME      │  5 BACKGROUND frequency-separation recolor (keep grain)  │
    +       │  6 LIFT+SCALE measured device mask → any bg, any store   │
 HEADLINE   │                                                          │
 COPY       └─────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    STORE-READY PNG (exact pixel size)
```

Each stage is a pure function over an image buffer. They compose left-to-right.

---

## 3. Stage 1 — Template & geometry detection

**Goal:** find, in any marketing template, the rectangle of the phone *screen* and the
*Dynamic Island*, without hand-coding coordinates.

**How:**

1. Convert to grayscale; threshold for "bright" pixels (`luma > 180`). The white app
   screen is by far the largest bright region.
2. Label connected components; take the largest. That blob is the screen *outline*
   (its interior has holes wherever there is dark UI text/icons).
3. **Fill holes** (`binary_fill_holes`) to get the solid screen silhouette — a rounded
   rectangle. Its bounding box is the screen rect.
4. The **Dynamic Island** is the largest *dark* blob inside the top ~14% of that rect.

**Why it matters:** the screen silhouette (not just its bounding box) is the exact mask
we paste through later, so rounded corners are preserved for free. Detection also proved
the five iPhone frames were pixel-identical in geometry — letting us reuse one set of
coordinates across all slides.

```
screen bbox (iPhone 1290×2796):  x[160..1138]  y[781..2795]
island      (iPhone):            y[815..882]   cx≈645
```

---

## 4. Stage 2 — Lossless screen swap

**Goal:** drop a new app screenshot into the device so it looks native — no distortion,
perfect corners, island intact.

**How:**

1. **Fit by height.** Scale the screenshot so its height equals the visible screen
   height, preserving aspect ratio. If it is narrower than the screen, pad the sides by
   *edge replication* (the app background is a solid colour at the edges, so this is
   invisible). This avoids both squashing and side gaps.
2. **Paste through the silhouette.** Write the scaled screenshot only where the screen
   mask is true — rounded corners come out perfect because the mask itself is rounded.
3. **Re-overlay the island** from the original frame on top, so the black pill always
   sits cleanly above whatever the screenshot had there.

**Proof of correctness:** re-inserting a screen's *own* pixels through this pipeline
reproduces the original frame with **max pixel difference = 0**. The swap is
mathematically lossless; only the screen content changes.

---

## 5. Stage 3 — Status-bar normalization

Captured screenshots carry a real status bar (e.g. `13:28`, 58% battery, a mute bell).
Stores expect the polished `9:41`, full battery / signal look.

**How:**

1. Cover the captured status-bar band (within the screen mask only, so the rounded
   corners and bezel are untouched) with the sampled app background colour.
2. Redraw a clean bar: `9:41` on the left, then cellular bars + wifi arc + battery
   glyph on the right, all drawn as vector shapes.
3. **Scale everything** by `screen_width / 978` so the bar is correctly sized on iPhone
   (×1.0), iPad (×1.05) and Play (×0.73).

A subtle bug lived here: a 74 px cover band left a faint sliver of the old icons on the
cream-background "Stories" screen. Deepening the band to 96 px fixed it. (See §9.)

---

## 6. Stage 4 — Headline replacement

**Goal:** replace the marketing headline text in-place, in the right font, with the
brand's blue→cyan gradient on the second line.

**How:**

1. **Remove the old text.** Mask the bright-white and vivid-blue pixels in the headline
   band and inpaint them away (OpenCV Telea). Because the background there is a smooth
   gradient, the fill is invisible.
2. **Match the font.** The brand headline is **Montserrat** — Bold for line 1,
   ExtraBold for line 2 (later softened to SemiBold/Bold for a more refined look). The
   font is loaded from a bundled file, not a system guess.
3. **Re-typeset.** Lay out each line centred at a measured baseline, with measured cap
   height and letter-spacing, then auto-shrink to fit a max width.
4. **Gradient fill.** Render line 2 as a white mask, then composite a horizontal
   blue→cyan gradient through that mask so the colour ramps across the text exactly like
   the original.

Calibrated values (iPhone): line-1 cap ≈ 64 px @ baseline 399; line-2 cap ≈ 117 px @
baseline 576; gradient `#3C69E1 → #08B2D2`.

---

## 7. Stage 5 — Background recolor that keeps the grain

The brand background is not a flat gradient — it has film grain, faint oversized "ghost"
shapes, and a soft device shadow. The ask was: *change the colour to the website blue but
keep the noise we have.* Naively repainting destroys the texture.

**The trick: frequency separation.**

```
original_bg  =  base (low-frequency colour/gradient)  +  detail (high-frequency texture)

base    = heavy Gaussian blur of the original          (σ ≈ 0.12 × width)
detail  = original − base                              (grain, ghosts, shadow)

new_bg  = brand_blue_gradient  +  detail
```

We **swap only the base colour** and **keep the detail** untouched. The grain, the ghost
letters and the device shadow survive exactly, now sitting on the new blue. This is why
the recolored slides feel like the original design, not a generated one.

Performance note: the heavy blur is computed on a ¼-scale copy and upsampled — visually
identical (it is a huge blur anyway) and ~16× faster.

> There is also a **synthetic** background path (procedural gradient + generated grain)
> for cases where no original texture exists. In the production engine this is the
> default, because it removes the inpaint step entirely (you never have to erase an old
> headline if you draw the background from scratch).

---

## 8. Stage 6 — Device lift + multi-store scaling

To place the *same* device on a *new* background (e.g. for the Brand Blue variants), we
"lift" it off the template.

**Device mask:** dilate the screen silhouette outward by the **measured frame
thickness** to include the titanium edge and side buttons, then feather 1 px. Thickness
is measured per frame by walking outward from the screen edge until the pixel becomes
clearly "background-blue" — this is what fixed the iPad, whose frame is ~50 px thick
versus the iPhone's ~20 px (a fixed dilation left a recoloured-frame "halo"; see §9).

**Multi-store scaling:** every store target is just a different canvas size and a
different set of measured headline anchors. The same six stages run unchanged; only the
numbers differ:

```
App Store iPhone 6.9"   1290 × 2796
App Store iPad 13"      2064 × 2752
Google Play phone       1080 × 1920
```

---

## 9. What the "senior designer" judgment actually was

The algorithms get you 90%. The last 10% — the part that makes it look human — was
iterative QA. The real defects we caught and fixed:

- **Tofu headlines.** First font build used the Google "latin-ext" subset (accents only,
  no A–Z) → boxes. Switched to the base "latin" subset.
- **Cream-screen status-bar ghost.** A 74 px cover band missed the bottom of the old
  icons on a light screen. Fix: 96 px band.
- **iPad frame halo.** A fixed 21 px device dilation didn't cover the iPad's ~50 px
  frame, exposing the recoloured metallic side button as a light-blue strip. Fix:
  *measure* frame thickness per frame.
- **iPad "too bold".** ExtraBold headline at iPad scale felt heavy. Fix: SemiBold +
  Bold, ~10% smaller — applied consistently across all three stores.
- **AI tells.** Trailing commas ("YOUR NEXT LESSON,") and an em dash ("ACTUALLY
  SPEAK —") read as machine-generated. Fix: strip them.
- **Timeouts.** iPad slides are 5.7 MP; batching 4 at once exceeded the shell limit.
  Fix: render in pairs.

Documenting these is the point: they are the institutional memory that keeps the next
run at the same quality.

---

## 10. Inputs, outputs, and the data model

**Inputs**
- One device-frame template per store (or a synthetic frame).
- One raw app screenshot per slide.
- Headline copy per slide (line 1 + line 2).
- A theme (background colours, headline colours, font, grain).

**Output**
- One PNG per slide per store, at the exact store pixel size, plus an overview sheet.

**Conceptual model** (names the production engine should formalize):

```
Project
  ├─ theme:    Theme            (palette, font, grain, gradient stops)
  ├─ stores:   StoreTarget[]    (id, width, height, headline anchors, sb scale)
  └─ slides:   Slide[]
                 ├─ screenshot:  image
                 ├─ headline:    { line1, line2 }
                 └─ frameRef:    which template / source frame
```

Everything else (geometry, masks) is *derived* at render time, never stored.

---

## 11. Parameter reference (as-built)

| Concept                   | iPhone 1290×2796 | iPad 2064×2752 | Play 1080×1920 |
|---------------------------|------------------|----------------|----------------|
| Screen width (px)         | 978              | 1031           | 712            |
| Status-bar scale          | 1.00             | 1.05           | 0.73           |
| Headline line-1 baseline  | 399              | 392            | 250            |
| Headline line-2 baseline  | 576              | 580            | 372            |
| Headline line-1 cap (px)  | 58               | 64             | 42             |
| Headline line-2 cap (px)  | 105              | 112            | 74             |
| Device dilation           | measured (~20)   | measured (~50) | measured (~15) |

Brand constants: font **Montserrat** (600/700/800); gradient **#3C69E1 → #08B2D2**;
recolor base blur **σ = 0.12 × width**; grain ≈ Gaussian ±7 (vivid) / ±3 (light).

---

*Reference implementation (prototype): the Python scripts `make_final.py`,
`store_render.py`, and `apply_bg.py` built during the Flowent run. The production
TypeScript port is specified in [REUSABILITY.md](./REUSABILITY.md).*
