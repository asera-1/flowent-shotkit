"use client"
import * as React from "react"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import JSZip from "jszip"
import { toast } from "sonner"
import { renderSlide } from "@/engine/compose"
import { allTargets } from "@/engine/targets"
import type { Slide, StoreTarget, Theme, GradientStyle } from "@/engine/types"
import { DeterministicDirector, OpenAIDirector, localizeHeadlines } from "@/engine/director"
import { renderTemplateSlide } from "@/engine/template"
import { buildContactSheet } from "@/engine/contactsheet"
import type { RenderTarget } from "@/engine/render-target"
import { createBrowserRenderer, initFonts, targetBlob, targetCanvas } from "@/engine/browser-renderer"
import { PRESETS, PRESET_BY_KEY } from "@/engine/themes"
import { themeFromColors, paletteFromImage, contrastRatio, darken } from "@/engine/color"
import { renderProductHunt, type PHSpec } from "@/engine/producthunt"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"

interface UISlide { id: string; name: string; url: string; line1: string; line2: string }
interface PHCopy { kicker: string; line1: string; line2: string; sub: string; side: "left" | "right" }

const slug = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "slide"
const toEngine = (s: UISlide): Slide => ({ id: s.id, screenshot: s.url, headline: { line1: s.line1, line2: s.line2 } })
function toDataUrl(url: string): Promise<string> {
  return fetch(url).then((r) => r.blob()).then((b) => new Promise<string>((res, rej) => {
    const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(b)
  }))
}
function download(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1500)
}
const notify = (msg: string, error = false) => (error ? toast.error(msg) : toast.success(msg))
const OFFLINE_OPTIONS = [
  { line1: "LEARN FASTER", line2: "EVERY DAY" },
  { line1: "BUILT FOR", line2: "REAL PROGRESS" },
  { line1: "YOUR WAY", line2: "TO FLUENCY" },
]
const phDefault = (): PHCopy => ({ kicker: "", line1: "YOUR HEADLINE", line2: "GOES HERE", sub: "", side: "left" })

function Pill({ active, ...props }: React.ComponentProps<typeof Button> & { active: boolean }) {
  return <Button type="button" size="sm" variant={active ? "default" : "outline"} {...props} />
}

export function Studio() {
  const renderer = useMemo(() => createBrowserRenderer(), [])
  const [mode, setMode] = useState<"store" | "ph">("store")
  const [fontsReady, setFontsReady] = useState(false)
  const [slides, setSlides] = useState<UISlide[]>([])
  const [themeKey, setThemeKey] = useState("brand-blue")
  const [customTheme, setCustomTheme] = useState<Theme | null>(null)
  const [brandColor, setBrandColor] = useState("#5CA8FF")
  const [deviceColor, setDeviceColor] = useState<"titanium" | "black" | "silver">("titanium")
  const [gradientStyle, setGradientStyle] = useState<GradientStyle>("diagonal")
  const [options, setOptions] = useState<{ line1: string; line2: string }[]>([])
  const [enabled, setEnabled] = useState<string[]>(allTargets.map((t) => t.id))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeStore, setActiveStore] = useState<string>(allTargets[0].id)
  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const [templateMode, setTemplateMode] = useState(false)
  const [layout, setLayout] = useState<"headline-top" | "headline-bottom">("headline-top")
  const [safeArea, setSafeArea] = useState(false)
  const [aiKey, setAiKey] = useState<string>(() => { try { return localStorage.getItem("shotkit.aiKey") || "" } catch { return "" } })
  const aiModel = "gpt-4o-mini"
  const [variants, setVariants] = useState<string[]>([])
  const [locales, setLocales] = useState("")
  const [busy, setBusy] = useState("")
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [phMap, setPhMap] = useState<Record<string, PHCopy>>({})
  const previewRef = useRef<HTMLCanvasElement>(null)
  const tokenRef = useRef(0)
  const showingExamplesRef = useRef(false)
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const theme: Theme = useMemo(() => {
    const t = themeKey === "custom" && customTheme ? customTheme : (PRESET_BY_KEY[themeKey]?.theme ?? PRESET_BY_KEY["brand-blue"].theme)
    const background = t.background.kind === "synthetic" ? { ...t.background, style: gradientStyle } : t.background
    return { ...t, background, layout, deviceColor }
  }, [themeKey, layout, customTheme, deviceColor, gradientStyle])
  const active = slides.find((s) => s.id === activeId) || null
  const store = allTargets.find((t) => t.id === activeStore)!

  const phOf = (id: string): PHCopy => phMap[id] ?? phDefault()
  const setPh = (id: string, patch: Partial<PHCopy>) => setPhMap((m) => ({ ...m, [id]: { ...phOf(id), ...patch } }))
  const phSpec = (s: UISlide): PHSpec => {
    const p = phOf(s.id)
    return { screenshot: s.url, side: p.side, kicker: p.kicker || undefined, deviceColor, theme,
      head: [...(p.line1 ? [{ text: p.line1 }] : []), ...(p.line2 ? [{ text: p.line2, accent: true }] : [])],
      sub: p.sub || undefined }
  }

  const renderOne = (s: UISlide, st: StoreTarget) =>
    templateMode && frameUrl
      ? renderTemplateSlide(renderer, { frame: frameUrl, screenshot: s.url, headline: { line1: s.line1, line2: s.line2 }, theme, recolor: theme.background.kind === "synthetic" ? { from: theme.background.from, to: theme.background.to } : undefined })
      : renderSlide(renderer, { theme, stores: [st], slides: [toEngine(s)] }, toEngine(s), st)

  useEffect(() => { initFonts().then(() => setFontsReady(true)) }, [])
  useEffect(() => { try { localStorage.setItem("shotkit.aiKey", aiKey) } catch {} }, [aiKey])

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"))
    const next: UISlide[] = arr.map((f, i) => ({ id: `${slug(f.name)}-${(Date.now() + i).toString(36).slice(-4)}`, name: f.name, url: URL.createObjectURL(f), line1: "", line2: "" }))
    if (!next.length) return
    setSlides((p) => (showingExamplesRef.current ? next : [...p, ...next]))
    showingExamplesRef.current = false
    setActiveId(next[0].id)
  }, [])

  async function loadExamples() {
    const ex: UISlide[] = [
      { id: "home", name: "home.png", url: "/examples/home.png", line1: "YOUR NEXT LESSON", line2: "READY EVERY DAY" },
      { id: "vocab", name: "saved-vocab.png", url: "/examples/vocab.png", line1: "BEAT THE", line2: "FORGETTING CURVE" },
    ]
    setSlides(ex); setActiveId("home"); showingExamplesRef.current = true
    setPhMap({
      home: { kicker: "", line1: "SPEAK FROM", line2: "DAY ONE", sub: "Real-time AI conversations designed for fluency", side: "left" },
      vocab: { kicker: "", line1: "BEAT THE", line2: "FORGETTING CURVE", sub: "Spaced repetition that actually sticks", side: "right" },
    })
  }
  useEffect(() => { loadExamples() }, [])

  // live preview (store or product hunt)
  useEffect(() => {
    if (!fontsReady || !active || !previewRef.current) return
    const token = ++tokenRef.current
    const spinTimer = window.setTimeout(() => { if (token === tokenRef.current) setPreviewBusy(true) }, 180)
    ;(async () => {
      const target = mode === "ph" ? await renderProductHunt(renderer, phSpec(active)) : await renderOne(active, store)
      if (token !== tokenRef.current) return
      const src = targetCanvas(target); const dst = previewRef.current!
      dst.width = src.width; dst.height = src.height
      const g = dst.getContext("2d")!; g.drawImage(src, 0, 0)
      if (mode === "store" && safeArea && !store.featureGraphic) {
        g.save(); g.strokeStyle = "rgba(255,90,90,0.7)"; g.setLineDash([14, 10]); g.lineWidth = Math.max(2, dst.width * 0.004)
        const mx = dst.width * 0.05, my = dst.height * 0.04
        g.strokeRect(mx, my, dst.width - 2 * mx, dst.height - 2 * my); g.restore()
      }
    })().catch(console.error).finally(() => { window.clearTimeout(spinTimer); if (token === tokenRef.current) setPreviewBusy(false) })
  }, [mode, fontsReady, active?.id, active?.line1, active?.line2, activeStore, templateMode, frameUrl, safeArea, renderer, store, theme, phMap, deviceColor])

  function updateActive(patch: Partial<UISlide>) { if (active) setSlides((p) => p.map((s) => (s.id === active.id ? { ...s, ...patch } : s))) }
  function removeSlide(id: string) {
    setSlides((p) => { const next = p.filter((s) => s.id !== id); if (id === activeId) setActiveId(next[0]?.id ?? null); return next })
    showingExamplesRef.current = false
  }
  function moveSlide(from: number | null, to: number) {
    if (from === null || from === to || to < 0 || to >= slides.length) return
    setSlides((p) => { const next = p.slice(); const [m] = next.splice(from, 1); next.splice(to, 0, m); return next })
    showingExamplesRef.current = false
  }
  function setCustom(t: Theme) { setCustomTheme(t); setThemeKey("custom") }
  async function matchScreenshot() {
    if (!active) return
    try { const pal = await paletteFromImage(active.url); setCustom(themeFromColors(pal[0], pal[1] ?? darken(pal[0], 0.42))); notify("Theme matched to your screenshot") }
    catch { notify("Could not read colors from that image", true) }
  }
  function applyCopy(res: { slides: { screenshotId: string; headline: { line1: string; line2: string } }[] }) {
    setSlides((p) => p.map((s) => { const c = res.slides.find((x) => x.screenshotId === s.id); return c ? { ...s, line1: c.headline.line1, line2: c.headline.line2 } : s }))
  }
  async function autoHeadlines() {
    if (!slides.length) return
    const useAI = !!aiKey.trim()
    setBusy(useAI ? "AI is reading your screens…" : "Writing headlines…")
    const stores: StoreTarget[] = enabled.map((id) => allTargets.find((t) => t.id === id)!).filter(Boolean)
    const brandVoice = { tone: "direct" as const, casing: "upper" as const, banned: [",", "—"] }
    try {
      const screenshots = useAI
        ? await Promise.all(slides.map(async (s) => ({ id: s.id, image: await toDataUrl(s.url), label: s.name })))
        : slides.map((s) => ({ id: s.id, image: s.url, label: s.name }))
      const dir = useAI ? new OpenAIDirector({ apiKey: aiKey.trim(), model: aiModel }) : new DeterministicDirector()
      applyCopy(await dir.generate({ screenshots, appProfile: { name: "Flowent" }, brandVoice, stores }))
    } catch (e: any) {
      notify("AI generation failed: " + (e?.message || e) + " — using offline templates instead.", true)
      try { applyCopy(await new DeterministicDirector().generate({ screenshots: slides.map((s) => ({ id: s.id, image: s.url, label: s.name })), appProfile: { name: "Flowent" }, brandVoice, stores })) } catch {}
    } finally { setBusy("") }
  }
  async function genOptions() {
    if (!active) return
    setBusy("Writing options…")
    const brandVoice = { tone: "direct" as const, casing: "upper" as const, banned: [",", "—"] }
    try {
      if (aiKey.trim()) {
        const dir = new OpenAIDirector({ apiKey: aiKey.trim(), model: aiModel }); const img = await toDataUrl(active.url)
        const opts = await dir.options({ id: active.id, image: img, label: active.name }, brandVoice.banned, "Flowent", 3)
        setOptions(opts.filter((o) => o.line1 || o.line2)); if (!opts.length) notify("No options returned", true)
      } else {
        const stores = enabled.map((id) => allTargets.find((t) => t.id === id)!).filter(Boolean)
        const det = await new DeterministicDirector().generate({ screenshots: [{ id: active.id, image: active.url, label: active.name }], appProfile: { name: "Flowent" }, brandVoice, stores })
        setOptions([det.slides[0]?.headline, ...OFFLINE_OPTIONS].filter(Boolean).slice(0, 3) as { line1: string; line2: string }[])
      }
    } catch (e: any) { notify("Options failed: " + (e?.message || e), true) } finally { setBusy("") }
  }
  async function downloadActive() { if (!active) return; const t = await renderOne(active, store); download(await targetBlob(t), `${active.id}-${store.id}.png`) }
  async function downloadActivePH() { if (!active) return; const t = await renderProductHunt(renderer, phSpec(active)); download(await targetBlob(t), `${active.id}-producthunt.png`) }

  async function exportZip() {
    if (!slides.length || !enabled.length) return
    const locs = locales.split(",").map((x) => x.trim()).filter(Boolean)
    const useTemplate = templateMode && !!frameUrl
    const useLocale = !!locs.length && !!aiKey.trim()
    const variantKeys = !useTemplate && !useLocale && variants.length ? variants : null
    if (locs.length && !aiKey.trim()) notify("Languages need an AI key — exporting without translation.", true)
    if (useLocale && variants.length) notify("Languages take priority; A/B variants skipped this export.")
    const total = useTemplate ? slides.length : useLocale ? locs.length * enabled.length * slides.length : (variantKeys ? variantKeys.length : 1) * enabled.length * slides.length
    let done = 0; const tick = () => setProgress({ done: ++done, total })
    setProgress({ done: 0, total }); setBusy(useLocale ? "Translating + rendering…" : "Rendering kit…")
    const zip = new JSZip(); const sheetItems: { label: string; target: RenderTarget }[] = []
    const manifest: any = { generatedAt: new Date().toISOString(), files: [] as any[] }
    try {
      if (useTemplate) {
        for (const s of slides) { const target = await renderOne(s, store); zip.file(`template/${s.id}.png`, await targetBlob(target)); sheetItems.push({ label: s.id, target }); manifest.files.push({ store: "template", slide: s.id, file: `template/${s.id}.png` }); tick() }
      } else if (useLocale) {
        const tr = await localizeHeadlines(slides.map((s) => ({ id: s.id, line1: s.line1, line2: s.line2 })), locs, { apiKey: aiKey.trim(), model: aiModel })
        for (const loc of locs) for (const id of enabled) {
          const st = allTargets.find((t) => t.id === id)!
          for (const s of slides) {
            const h = tr[loc]?.[s.id] ?? { line1: s.line1, line2: s.line2 }; const eng = { id: s.id, screenshot: s.url, headline: h }
            const target = await renderSlide(renderer, { theme, stores: [st], slides: [eng] }, eng, st)
            zip.file(`${loc}/${st.folder}/${s.id}.png`, await targetBlob(target)); sheetItems.push({ label: `${loc} · ${st.label} ${s.id}`, target }); manifest.files.push({ locale: loc, store: id, slide: s.id, file: `${loc}/${st.folder}/${s.id}.png` }); tick()
          }
        }
      } else {
        const keys = variantKeys ?? [themeKey]
        for (const vk of keys) {
          const vtheme: Theme = { ...PRESET_BY_KEY[vk].theme, layout, deviceColor }
          const prefix = variantKeys ? `variant-${vk}/` : ""
          for (const id of enabled) {
            const st = allTargets.find((t) => t.id === id)!
            for (const s of slides) {
              const target = await renderSlide(renderer, { theme: vtheme, stores: [st], slides: [toEngine(s)] }, toEngine(s), st)
              zip.file(`${prefix}${st.folder}/${s.id}.png`, await targetBlob(target)); sheetItems.push({ label: `${variantKeys ? vk + " · " : ""}${st.label} ${s.id}`, target }); manifest.files.push({ variant: vk, store: id, slide: s.id, file: `${prefix}${st.folder}/${s.id}.png` }); tick()
            }
          }
        }
      }
      if (sheetItems.length) zip.file("_overview.png", await targetBlob(buildContactSheet(renderer, sheetItems)))
      zip.file("manifest.json", JSON.stringify(manifest, null, 2))
      download(await zip.generateAsync({ type: "blob" }), "flowent-shotkit-kit.zip")
      notify(`Exported ${manifest.files.length} image${manifest.files.length === 1 ? "" : "s"} → flowent-shotkit-kit.zip`)
    } catch (e: any) { notify("Export failed: " + (e?.message || e), true) } finally { setBusy(""); setProgress(null) }
  }

  async function exportPH() {
    if (!slides.length) return
    setProgress({ done: 0, total: slides.length }); setBusy("Rendering Product Hunt…")
    const zip = new JSZip(); let done = 0
    try {
      for (const s of slides) { const t = await renderProductHunt(renderer, phSpec(s)); zip.file(`product-hunt/${s.id}.png`, await targetBlob(t)); setProgress({ done: ++done, total: slides.length }) }
      download(await zip.generateAsync({ type: "blob" }), "flowent-producthunt.zip")
      notify(`Exported ${slides.length} Product Hunt image${slides.length === 1 ? "" : "s"}`)
    } catch (e: any) { notify("Export failed: " + (e?.message || e), true) } finally { setBusy(""); setProgress(null) }
  }

  const swatchList = customTheme ? [...PRESETS, { key: "custom", label: "Custom", theme: customTheme }] : PRESETS
  const phc = active ? phOf(active.id) : phDefault()

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">flowent · <span>shotkit</span> studio</div>
        <div className="inline-flex items-center gap-1 rounded-lg bg-secondary p-[3px]">
          <Button size="sm" variant={mode === "store" ? "default" : "ghost"} className="h-7" onClick={() => setMode("store")}>Store kit</Button>
          <Button size="sm" variant={mode === "ph" ? "default" : "ghost"} className="h-7" onClick={() => setMode("ph")}>Product Hunt</Button>
        </div>
        <div className="muted">{slides.length} screen{slides.length === 1 ? "" : "s"}{mode === "store" ? ` · ${enabled.length} store${enabled.length === 1 ? "" : "s"}` : ""}</div>
        <div className="spacer" />
        {busy && <div className="muted">{busy}</div>}
        {mode === "store"
          ? <Button disabled={!slides.length || !enabled.length || !!busy} onClick={exportZip}>Export ZIP</Button>
          : <Button disabled={!slides.length || !!busy} onClick={exportPH}>Export Product Hunt</Button>}
      </div>

      <div className="cols">
        {/* LEFT: screens */}
        <div className="panel">
          <div className="section">
            <h3>Screens</h3>
            <div className="row">
              <Button asChild size="sm" variant="secondary" className="flex-1">
                <label className="cursor-pointer text-center">+ Upload<input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} /></label>
              </Button>
              <Button size="sm" variant="outline" onClick={loadExamples}>Example</Button>
            </div>
          </div>
          <div className="section" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {slides.length === 0 && <div className="muted">Upload app screenshots or load the example kit.</div>}
            {slides.map((s, i) => (
              <div key={s.id} role="button" tabIndex={0}
                className={"slide" + (s.id === activeId ? " active" : "") + (dragOverId === s.id ? " dragover" : "")}
                draggable
                onDragStart={(e) => { dragIndexRef.current = i; e.dataTransfer.effectAllowed = "move" }}
                onDragOver={(e) => { e.preventDefault(); if (dragOverId !== s.id) setDragOverId(s.id) }}
                onDragLeave={() => setDragOverId((d) => (d === s.id ? null : d))}
                onDrop={(e) => { e.preventDefault(); moveSlide(dragIndexRef.current, i); setDragOverId(null); dragIndexRef.current = null }}
                onDragEnd={() => { setDragOverId(null); dragIndexRef.current = null }}
                onClick={() => setActiveId(s.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveId(s.id) } else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); moveSlide(i, i - 1) } else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); moveSlide(i, i + 1) } }}>
                <span className="grip" aria-hidden>⠿</span>
                <img src={s.url} alt={s.name} />
                <div className="meta"><div className="n">{s.line1 || s.name}</div><div className="h">{s.line2 || "No headline yet"}</div></div>
                <button className="x" aria-label="Remove screen" title="Remove" onClick={(e) => { e.stopPropagation(); removeSlide(s.id) }}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: preview */}
        <div className="stage">
          {mode === "store" && (
            <div className="tabs">
              {allTargets.map((t) => (
                <Pill key={t.id} active={t.id === activeStore} onClick={() => setActiveStore(t.id)} className="rounded-full">{t.label}</Pill>
              ))}
            </div>
          )}
          <div className="preview" style={{ position: "relative" }}>
            {active ? <canvas ref={previewRef} /> : <div className="empty">Add a screen to see the live preview. The engine renders right here in your browser — no server.</div>}
            {active && previewBusy && <div className="preview-spin"><div className="spin" /></div>}
          </div>
          <div className="muted">{mode === "store" ? `${store.width} × ${store.height}` : "1270 × 760"}{fontsReady ? "" : " · loading fonts…"}</div>
        </div>

        {/* RIGHT: inspector */}
        <div className="panel right">
          {mode === "store" ? (
            <>
              <div className="section">
                <h3>Headline</h3>
                {active ? (
                  <>
                    <div className="field"><label>Line 1</label><Input value={active.line1} onChange={(e) => updateActive({ line1: e.target.value })} /></div>
                    <div className="field"><label>Line 2 (gradient)</label><Input value={active.line2} onChange={(e) => updateActive({ line2: e.target.value })} /></div>
                  </>
                ) : <div className="muted">Select a screen.</div>}
                <Button className="w-full mt-1" disabled={!slides.length || !!busy} onClick={autoHeadlines}>✨ Auto-headlines (AI)</Button>
                <div className="row" style={{ marginTop: 8 }}>
                  <Button size="sm" variant="outline" className="flex-1" disabled={!slides.length || !!busy} onClick={autoHeadlines}>↻ Regenerate</Button>
                  <Button size="sm" variant="outline" className="flex-1" disabled={!active || !!busy} onClick={genOptions}>✨ Options</Button>
                </div>
                {options.length > 0 && (
                  <div className="opts">{options.map((o, i) => (
                    <button key={i} className="opt" onClick={() => { updateActive({ line1: o.line1, line2: o.line2 }); setOptions([]) }}><b>{o.line1 || "No line 1"}</b><span>{o.line2}</span></button>
                  ))}</div>
                )}
                <Button variant="secondary" className="w-full mt-2" disabled={!active || !!busy} onClick={downloadActive}>⬇ Download this slide</Button>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <div className="field" style={{ marginBottom: 6 }}><label>AI key — optional, BYOK</label><Input type="password" placeholder="sk-…  reads your screens, writes headlines" value={aiKey} onChange={(e) => setAiKey(e.target.value)} /></div>
                  <div className="muted">With a key, ✨ Auto-headlines uses a vision model on your screenshots. Blank = offline templates. Stored only in your browser.</div>
                  <div className="field" style={{ marginTop: 10, marginBottom: 4 }}><label>Languages — comma separated (needs a key)</label><Input placeholder="de, es, fr, it" value={locales} onChange={(e) => setLocales(e.target.value)} /></div>
                  <div className="muted">On Export, headlines are translated per language and rendered into per-locale folders.</div>
                </div>
              </div>

              <div className="section">
                <h3>Device frame</h3>
                <div className="row">{(["titanium", "black", "silver"] as const).map((c) => (<Pill key={c} active={deviceColor === c} className="flex-1 capitalize" onClick={() => setDeviceColor(c)}>{c}</Pill>))}</div>
                <Button asChild size="sm" variant="secondary" className="w-full mt-2"><label className="cursor-pointer text-center">{frameUrl ? "Change mockup" : "+ Upload your own mockup"}<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFrameUrl(URL.createObjectURL(f)); setTemplateMode(true) } }} /></label></Button>
                {frameUrl && (<div className="row" style={{ marginTop: 8, alignItems: "center" }}><label className="check flex-1"><Switch checked={templateMode} onCheckedChange={setTemplateMode} /><span>Template-faithful mode</span></label><Button size="sm" variant="outline" onClick={() => { setFrameUrl(null); setTemplateMode(false) }}>Remove</Button></div>)}
                <div className="muted" style={{ marginTop: 6 }}>Pick a finish for the built-in frame, or drop your own real device mockup — the screen is auto-detected, your screenshot is swapped in, and the background recolors to the theme (grain preserved).</div>
              </div>

              <div className="section">
                <h3>Background</h3>
                <div className="swatches">{swatchList.map((p) => (
                  <button key={p.key} aria-label={p.label} className={"swatch" + (p.key === themeKey ? " active" : "")} style={{ background: p.theme.background.kind === "mesh" ? `linear-gradient(135deg, ${p.theme.background.colors.join(", ")})` : `linear-gradient(135deg, ${p.theme.background.from}, ${p.theme.background.to})` }} onClick={() => setThemeKey(p.key)}><span style={{ color: p.theme.headlineColor }}>{p.label}</span></button>
                ))}</div>
                <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                  <input type="color" className="color-in" aria-label="Brand color" value={brandColor} onChange={(e) => { setBrandColor(e.target.value); setCustom(themeFromColors(e.target.value, darken(e.target.value, 0.42))) }} />
                  <Button size="sm" variant="outline" className="flex-1" disabled={!active} onClick={matchScreenshot}>🎨 Match my screenshot</Button>
                </div>
                <label className="sublabel">Gradient style</label>
                <div className="row" style={{ flexWrap: "wrap" }}>{(["diagonal", "vertical", "radial", "conic", "spotlight"] as const).map((gs) => (<Pill key={gs} active={gradientStyle === gs} className="capitalize" disabled={theme.background.kind === "mesh"} onClick={() => setGradientStyle(gs)}>{gs}</Pill>))}</div>
                {theme.background.kind === "mesh" && <div className="muted" style={{ marginTop: 4 }}>Pick a non-mesh preset to use gradient styles.</div>}
              </div>

              <div className="section">
                <h3>Checks</h3>
                {active ? (() => {
                  const bg = theme.background.kind === "mesh" ? theme.background.colors[Math.floor(theme.background.colors.length / 2)] : theme.background.from
                  const cr = contrastRatio(theme.headlineColor, bg); const len = Math.max(active.line1.length, active.line2.length)
                  const rows = [
                    { ok: cr >= 3, label: `Contrast ${cr.toFixed(1)}:1`, hint: cr >= 3 ? "Good" : "Low — darker/lighter bg or headline" },
                    { ok: len > 0 && len <= 22, label: `Caption ${len} chars`, hint: len === 0 ? "No headline yet" : len <= 22 ? "Reads at thumbnail" : "Long — shorten for the store grid" },
                    { ok: safeArea, label: "Safe-area guides", hint: safeArea ? "On" : "Turn on to keep text off edges" },
                  ]
                  return <div className="checks">{rows.map((c, i) => (<div key={i} className={"crow " + (c.ok ? "ok" : "warn")}><span className="dot" />{c.label}<span className="hint">{c.hint}</span></div>))}</div>
                })() : <div className="muted">Select a screen.</div>}
              </div>

              <div className="section">
                <h3>A/B variants</h3>
                <div className="muted" style={{ marginBottom: 8 }}>Export the kit under several themes to test in Apple PPO / Play experiments. Off = active theme only.</div>
                <div className="stores">{PRESETS.map((p) => (<label key={p.key} className="check"><Checkbox checked={variants.includes(p.key)} onCheckedChange={(v) => setVariants((cur) => (v ? [...new Set([...cur, p.key])] : cur.filter((x) => x !== p.key)))} /><span>{p.label}</span></label>))}</div>
              </div>

              <div className="section">
                <h3>Layout</h3>
                <div className="row"><Pill active={layout === "headline-top"} onClick={() => setLayout("headline-top")}>Headline top</Pill><Pill active={layout === "headline-bottom"} onClick={() => setLayout("headline-bottom")}>Headline bottom</Pill></div>
                <label className="check" style={{ marginTop: 10 }}><Switch checked={safeArea} onCheckedChange={setSafeArea} /><span>Safe-area guides (preview)</span></label>
              </div>

              <div className="section">
                <h3>Stores</h3>
                <div className="stores">{allTargets.map((t) => (<label key={t.id} className="check"><Checkbox checked={enabled.includes(t.id)} onCheckedChange={(v) => setEnabled((cur) => (v ? [...new Set([...cur, t.id])] : cur.filter((x) => x !== t.id)))} /><span>{t.label} <span className="muted">· {t.width}×{t.height}</span></span></label>))}</div>
              </div>
            </>
          ) : (
            <>
              <div className="section">
                <h3>Product Hunt copy</h3>
                {active ? (
                  <>
                    <div className="field"><label>Kicker (small, optional)</label><Input value={phc.kicker} onChange={(e) => setPh(active.id, { kicker: e.target.value })} placeholder="CREATE REAL-LIFE SCENARIOS" /></div>
                    <div className="field"><label>Headline line 1 (white)</label><Input value={phc.line1} onChange={(e) => setPh(active.id, { line1: e.target.value })} /></div>
                    <div className="field"><label>Headline line 2 (cyan)</label><Input value={phc.line2} onChange={(e) => setPh(active.id, { line2: e.target.value })} /></div>
                    <div className="field"><label>Subline</label><Input value={phc.sub} onChange={(e) => setPh(active.id, { sub: e.target.value })} placeholder="One supporting line" /></div>
                    <label className="sublabel">Phone side</label>
                    <div className="row"><Pill active={phc.side === "left"} onClick={() => setPh(active.id, { side: "left" })}>Left</Pill><Pill active={phc.side === "right"} onClick={() => setPh(active.id, { side: "right" })}>Right</Pill></div>
                    <Button variant="secondary" className="w-full mt-3" disabled={!!busy} onClick={downloadActivePH}>⬇ Download this image</Button>
                  </>
                ) : <div className="muted">Select a screen.</div>}
              </div>
              <div className="section">
                <h3>Device frame</h3>
                <div className="row">{(["titanium", "black", "silver"] as const).map((c) => (<Pill key={c} active={deviceColor === c} className="flex-1 capitalize" onClick={() => setDeviceColor(c)}>{c}</Pill>))}</div>
              </div>
              <div className="section">
                <h3>Background</h3>
                <div className="swatches">{swatchList.map((p) => (
                  <button key={p.key} aria-label={p.label} className={"swatch" + (p.key === themeKey ? " active" : "")} style={{ background: p.theme.background.kind === "mesh" ? `linear-gradient(135deg, ${p.theme.background.colors.join(", ")})` : `linear-gradient(135deg, ${p.theme.background.from}, ${p.theme.background.to})` }} onClick={() => setThemeKey(p.key)}><span style={{ color: p.theme.headlineColor }}>{p.label}</span></button>
                ))}</div>
                <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                  <input type="color" className="color-in" aria-label="Brand color" value={brandColor} onChange={(e) => { setBrandColor(e.target.value); setCustom(themeFromColors(e.target.value, darken(e.target.value, 0.42))) }} />
                  <Button size="sm" variant="outline" className="flex-1" disabled={!active} onClick={matchScreenshot}>🎨 Match my screenshot</Button>
                </div>
                <label className="sublabel">Gradient style</label>
                <div className="row" style={{ flexWrap: "wrap" }}>{(["diagonal", "vertical", "radial", "conic", "spotlight"] as const).map((gs) => (<Pill key={gs} active={gradientStyle === gs} className="capitalize" disabled={theme.background.kind === "mesh"} onClick={() => setGradientStyle(gs)}>{gs}</Pill>))}</div>
              </div>
              <div className="section"><div className="muted">Product Hunt gallery images are 1270 × 760. Each screen becomes one landscape image with your copy; Export Product Hunt zips them all.</div></div>
            </>
          )}
        </div>
      </div>

      {busy && (<div className="busy-overlay"><div className="card"><div className="spin" /><div>{busy}</div>{progress && <div className="muted" style={{ marginTop: 6 }}>{progress.done} / {progress.total}</div>}</div></div>)}
    </div>
  )
}
