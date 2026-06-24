import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import JSZip from 'jszip'
import { renderSlide } from '@engine/compose'
import { allTargets } from '@engine/targets'
import type { Slide, StoreTarget, Theme } from '@engine/types'
import { DeterministicDirector, OpenAIDirector, localizeHeadlines } from '@engine/director'
import { renderTemplateSlide } from '@engine/template'
import { buildContactSheet } from '@engine/contactsheet'
import type { RenderTarget } from '@engine/render-target'
import { createBrowserRenderer, initFonts, targetBlob, targetCanvas } from './browser-renderer'
import { PRESETS, PRESET_BY_KEY } from './themes'
import { themeFromColors, paletteFromImage, contrastRatio, darken } from './color'

interface UISlide { id: string; name: string; url: string; line1: string; line2: string }

const slug = (s: string) =>
  s.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'slide'

const toEngine = (s: UISlide): Slide => ({ id: s.id, screenshot: s.url, headline: { line1: s.line1, line2: s.line2 } })

function toDataUrl(url: string): Promise<string> {
  return fetch(url).then((r) => r.blob()).then((b) => new Promise<string>((res, rej) => {
    const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(b)
  }))
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1500)
}

const OFFLINE_OPTIONS = [
  { line1: 'LEARN FASTER', line2: 'EVERY DAY' },
  { line1: 'BUILT FOR', line2: 'REAL PROGRESS' },
  { line1: 'YOUR WAY', line2: 'TO FLUENCY' },
]

export function App() {
  const renderer = useMemo(() => createBrowserRenderer(), [])
  const [fontsReady, setFontsReady] = useState(false)
  const [slides, setSlides] = useState<UISlide[]>([])
  const [themeKey, setThemeKey] = useState('brand-blue')
  const [customTheme, setCustomTheme] = useState<Theme | null>(null)
  const [brandColor, setBrandColor] = useState('#5CA8FF')
  const [deviceColor, setDeviceColor] = useState<'titanium' | 'black' | 'silver'>('titanium')
  const [options, setOptions] = useState<{ line1: string; line2: string }[]>([])
  const [enabled, setEnabled] = useState<string[]>(allTargets.map((t) => t.id))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeStore, setActiveStore] = useState<string>(allTargets[0].id)
  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const [templateMode, setTemplateMode] = useState(false)
  const [layout, setLayout] = useState<'headline-top' | 'headline-bottom'>('headline-top')
  const [safeArea, setSafeArea] = useState(false)
  const [aiKey, setAiKey] = useState<string>(() => { try { return localStorage.getItem('shotkit.aiKey') || '' } catch { return '' } })
  const aiModel = 'gpt-4o-mini'
  const [variants, setVariants] = useState<string[]>([])
  const [locales, setLocales] = useState('')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const tokenRef = useRef(0)
  const showingExamplesRef = useRef(false)
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const theme: Theme = useMemo(() => {
    const t = themeKey === 'custom' && customTheme ? customTheme : (PRESET_BY_KEY[themeKey]?.theme ?? PRESET_BY_KEY['brand-blue'].theme)
    return { ...t, layout, deviceColor }
  }, [themeKey, layout, customTheme, deviceColor])
  const active = slides.find((s) => s.id === activeId) || null
  const store = allTargets.find((t) => t.id === activeStore)!

  const renderOne = (s: UISlide, st: StoreTarget) =>
    templateMode && frameUrl
      ? renderTemplateSlide(renderer, { frame: frameUrl, screenshot: s.url, headline: { line1: s.line1, line2: s.line2 }, theme, recolor: theme.background.kind === 'synthetic' ? { from: theme.background.from, to: theme.background.to } : undefined })
      : renderSlide(renderer, { theme, stores: [st], slides: [toEngine(s)] }, toEngine(s), st)

  useEffect(() => { initFonts().then(() => setFontsReady(true)) }, [])
  useEffect(() => { try { localStorage.setItem('shotkit.aiKey', aiKey) } catch { /* ignore */ } }, [aiKey])

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const next: UISlide[] = arr.map((f, i) => ({
      id: `${slug(f.name)}-${(Date.now() + i).toString(36).slice(-4)}`,
      name: f.name, url: URL.createObjectURL(f), line1: '', line2: '',
    }))
    if (!next.length) return
    setSlides((p) => (showingExamplesRef.current ? next : [...p, ...next]))
    showingExamplesRef.current = false
    setActiveId(next[0].id)
  }, [])

  async function loadExamples() {
    const base = (import.meta as any).env.BASE_URL
    const ex: UISlide[] = [
      { id: 'home', name: 'home.png', url: `${base}examples/home.png`, line1: 'YOUR NEXT LESSON', line2: 'READY EVERY DAY' },
      { id: 'vocab', name: 'saved-vocab.png', url: `${base}examples/vocab.png`, line1: 'BEAT THE', line2: 'FORGETTING CURVE' },
    ]
    setSlides(ex)
    setActiveId('home')
    showingExamplesRef.current = true
  }

  // open with the example kit loaded so the studio is never blank on first visit
  useEffect(() => { loadExamples() }, [])

  // live preview of the active slide on the active store
  useEffect(() => {
    if (!fontsReady || !active || !previewRef.current) return
    const token = ++tokenRef.current
    const spinTimer = window.setTimeout(() => { if (token === tokenRef.current) setPreviewBusy(true) }, 180)
    ;(async () => {
      const target = await renderOne(active, store)
      if (token !== tokenRef.current) return
      const src = targetCanvas(target)
      const dst = previewRef.current!
      dst.width = src.width; dst.height = src.height
      const g = dst.getContext('2d')!
      g.drawImage(src, 0, 0)
      if (safeArea && !store.featureGraphic) {
        g.save(); g.strokeStyle = 'rgba(255,90,90,0.7)'; g.setLineDash([14, 10]); g.lineWidth = Math.max(2, dst.width * 0.004)
        const mx = dst.width * 0.05, my = dst.height * 0.04
        g.strokeRect(mx, my, dst.width - 2 * mx, dst.height - 2 * my); g.restore()
      }
    })().catch(console.error).finally(() => { window.clearTimeout(spinTimer); if (token === tokenRef.current) setPreviewBusy(false) })
  }, [fontsReady, active?.id, active?.line1, active?.line2, activeStore, templateMode, frameUrl, safeArea, renderer, store, theme])

  function updateActive(patch: Partial<UISlide>) {
    if (!active) return
    setSlides((p) => p.map((s) => (s.id === active.id ? { ...s, ...patch } : s)))
  }

  function notify(msg: string, error = false) {
    setToast({ msg, error })
    window.setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), error ? 6000 : 3500)
  }

  function removeSlide(id: string) {
    setSlides((p) => {
      const next = p.filter((s) => s.id !== id)
      if (id === activeId) setActiveId(next[0]?.id ?? null)
      return next
    })
    showingExamplesRef.current = false
  }

  function moveSlide(from: number | null, to: number) {
    if (from === null || from === to || to < 0 || to >= slides.length) return
    setSlides((p) => {
      const next = p.slice()
      const [m] = next.splice(from, 1)
      next.splice(to, 0, m)
      return next
    })
    showingExamplesRef.current = false
  }

  function setCustom(t: Theme) { setCustomTheme(t); setThemeKey('custom') }
  async function matchScreenshot() {
    if (!active) return
    try {
      const pal = await paletteFromImage(active.url)
      setCustom(themeFromColors(pal[0], pal[1] ?? darken(pal[0], 0.42)))
      notify('Theme matched to your screenshot')
    } catch { notify('Could not read colors from that image', true) }
  }

  async function genOptions() {
    if (!active) return
    setBusy('Writing options…')
    const brandVoice = { tone: 'direct' as const, casing: 'upper' as const, banned: [',', '—'] }
    try {
      if (aiKey.trim()) {
        const dir = new OpenAIDirector({ apiKey: aiKey.trim(), model: aiModel })
        const img = await toDataUrl(active.url)
        const opts = await dir.options({ id: active.id, image: img, label: active.name }, brandVoice.banned, 'Flowent', 3)
        setOptions(opts.filter((o) => o.line1 || o.line2))
        if (!opts.length) notify('No options returned', true)
      } else {
        const stores = enabled.map((id) => allTargets.find((t) => t.id === id)!).filter(Boolean)
        const det = await new DeterministicDirector().generate({ screenshots: [{ id: active.id, image: active.url, label: active.name }], appProfile: { name: 'Flowent' }, brandVoice, stores })
        const first = det.slides[0]?.headline
        setOptions([first, ...OFFLINE_OPTIONS].filter(Boolean).slice(0, 3) as { line1: string; line2: string }[])
      }
    } catch (e: any) {
      notify('Options failed: ' + (e?.message || e), true)
    } finally { setBusy('') }
  }

  function applyCopy(res: { slides: { screenshotId: string; headline: { line1: string; line2: string } }[] }) {
    setSlides((p) => p.map((s) => {
      const c = res.slides.find((x) => x.screenshotId === s.id)
      return c ? { ...s, line1: c.headline.line1, line2: c.headline.line2 } : s
    }))
  }

  async function autoHeadlines() {
    if (!slides.length) return
    const useAI = !!aiKey.trim()
    setBusy(useAI ? 'AI is reading your screens…' : 'Writing headlines…')
    const stores: StoreTarget[] = enabled.map((id) => allTargets.find((t) => t.id === id)!).filter(Boolean)
    const brandVoice = { tone: 'direct' as const, casing: 'upper' as const, banned: [',', '—'] }
    try {
      const screenshots = useAI
        ? await Promise.all(slides.map(async (s) => ({ id: s.id, image: await toDataUrl(s.url), label: s.name })))
        : slides.map((s) => ({ id: s.id, image: s.url, label: s.name }))
      const dir = useAI ? new OpenAIDirector({ apiKey: aiKey.trim(), model: aiModel }) : new DeterministicDirector()
      applyCopy(await dir.generate({ screenshots, appProfile: { name: 'Flowent' }, brandVoice, stores }))
    } catch (e: any) {
      notify('AI generation failed: ' + (e?.message || e) + ' — using offline templates instead.', true)
      try {
        applyCopy(await new DeterministicDirector().generate({
          screenshots: slides.map((s) => ({ id: s.id, image: s.url, label: s.name })),
          appProfile: { name: 'Flowent' }, brandVoice, stores,
        }))
      } catch { /* ignore */ }
    } finally {
      setBusy('')
    }
  }

  async function downloadActive() {
    if (!active) return
    const t = await renderOne(active, store)
    download(await targetBlob(t), `${active.id}-${store.id}.png`)
  }

  async function exportZip() {
    if (!slides.length || !enabled.length) return
    const locs = locales.split(',').map((x) => x.trim()).filter(Boolean)
    const useTemplate = templateMode && !!frameUrl
    const useLocale = !!locs.length && !!aiKey.trim()
    const variantKeys = (!useTemplate && !useLocale && variants.length) ? variants : null
    if (locs.length && !aiKey.trim()) notify('Languages need an AI key — exporting without translation.', true)
    if (useLocale && variants.length) notify('Languages take priority; A/B variants skipped this export.')
    const total = useTemplate ? slides.length
      : useLocale ? locs.length * enabled.length * slides.length
      : (variantKeys ? variantKeys.length : 1) * enabled.length * slides.length
    let done = 0
    const tick = () => setProgress({ done: ++done, total })
    setProgress({ done: 0, total })
    setBusy(useLocale ? 'Translating + rendering…' : 'Rendering kit…')
    const zip = new JSZip()
    const sheetItems: { label: string; target: RenderTarget }[] = []
    const manifest: any = { generatedAt: new Date().toISOString(), files: [] as any[] }
    try {
      if (useTemplate) {
        for (const s of slides) {
          const target = await renderOne(s, store)
          zip.file(`template/${s.id}.png`, await targetBlob(target))
          sheetItems.push({ label: s.id, target })
          manifest.files.push({ store: 'template', slide: s.id, file: `template/${s.id}.png` }); tick()
        }
      } else if (useLocale) {
        const tr = await localizeHeadlines(slides.map((s) => ({ id: s.id, line1: s.line1, line2: s.line2 })), locs, { apiKey: aiKey.trim(), model: aiModel })
        for (const loc of locs) {
          for (const id of enabled) {
            const st = allTargets.find((t) => t.id === id)!
            for (const s of slides) {
              const h = tr[loc]?.[s.id] ?? { line1: s.line1, line2: s.line2 }
              const eng = { id: s.id, screenshot: s.url, headline: h }
              const target = await renderSlide(renderer, { theme, stores: [st], slides: [eng] }, eng, st)
              zip.file(`${loc}/${st.folder}/${s.id}.png`, await targetBlob(target))
              sheetItems.push({ label: `${loc} · ${st.label} ${s.id}`, target })
              manifest.files.push({ locale: loc, store: id, slide: s.id, file: `${loc}/${st.folder}/${s.id}.png` }); tick()
            }
          }
        }
      } else {
        const keys = variantKeys ?? [themeKey]
        for (const vk of keys) {
          const vtheme: Theme = { ...PRESET_BY_KEY[vk].theme, layout }
          const prefix = variantKeys ? `variant-${vk}/` : ''
          for (const id of enabled) {
            const st = allTargets.find((t) => t.id === id)!
            for (const s of slides) {
              const target = await renderSlide(renderer, { theme: vtheme, stores: [st], slides: [toEngine(s)] }, toEngine(s), st)
              zip.file(`${prefix}${st.folder}/${s.id}.png`, await targetBlob(target))
              sheetItems.push({ label: `${variantKeys ? vk + ' · ' : ''}${st.label} ${s.id}`, target })
              manifest.files.push({ variant: vk, store: id, slide: s.id, file: `${prefix}${st.folder}/${s.id}.png` }); tick()
            }
          }
        }
      }
      if (sheetItems.length) zip.file('_overview.png', await targetBlob(buildContactSheet(renderer, sheetItems)))
      zip.file('manifest.json', JSON.stringify(manifest, null, 2))
      const out = await zip.generateAsync({ type: 'blob' })
      download(out, 'flowent-shotkit-kit.zip')
      notify(`Exported ${manifest.files.length} image${manifest.files.length === 1 ? '' : 's'} → flowent-shotkit-kit.zip`)
    } catch (e: any) {
      notify('Export failed: ' + (e?.message || e), true)
    } finally {
      setBusy(''); setProgress(null)
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">flowent · <span>shotkit</span> studio</div>
        <div className="muted">{slides.length} screen{slides.length === 1 ? '' : 's'} · {enabled.length} store{enabled.length === 1 ? '' : 's'}</div>
        <div className="spacer" />
        {busy && <div className="muted">{busy}</div>}
        <button className="btn primary" disabled={!slides.length || !enabled.length || !!busy} onClick={exportZip}>Export ZIP</button>
      </div>

      <div className="cols">
        {/* LEFT: screenshots */}
        <div className="panel">
          <div className="section">
            <h3>Screens</h3>
            <div className="row">
              <label className="btn sm" style={{ flex: 1, textAlign: 'center' }}>
                + Upload
                <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
              </label>
              <button className="btn sm" onClick={loadExamples}>Example</button>
            </div>
          </div>
          <div className="section" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {slides.length === 0 && <div className="muted">Upload app screenshots or load the example kit.</div>}
            {slides.map((s, i) => (
              <div key={s.id} role="button" tabIndex={0}
                className={'slide' + (s.id === activeId ? ' active' : '') + (dragOverId === s.id ? ' dragover' : '')}
                draggable
                onDragStart={(e) => { dragIndexRef.current = i; e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={(e) => { e.preventDefault(); if (dragOverId !== s.id) setDragOverId(s.id) }}
                onDragLeave={() => setDragOverId((d) => (d === s.id ? null : d))}
                onDrop={(e) => { e.preventDefault(); moveSlide(dragIndexRef.current, i); setDragOverId(null); dragIndexRef.current = null }}
                onDragEnd={() => { setDragOverId(null); dragIndexRef.current = null }}
                onClick={() => setActiveId(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveId(s.id) }
                  else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); moveSlide(i, i - 1) }
                  else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); moveSlide(i, i + 1) }
                }}>
                <span className="grip" aria-hidden="true">⠿</span>
                <img src={s.url} alt={s.name} />
                <div className="meta">
                  <div className="n">{s.line1 || s.name}</div>
                  <div className="h">{s.line2 || 'No headline yet'}</div>
                </div>
                <button className="x" aria-label="Remove screen" title="Remove" onClick={(e) => { e.stopPropagation(); removeSlide(s.id) }}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: preview */}
        <div className="stage">
          <div className="tabs">
            {allTargets.map((t) => (
              <button key={t.id} className={'tab' + (t.id === activeStore ? ' active' : '')} onClick={() => setActiveStore(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="preview">
            {active ? <canvas ref={previewRef} /> : <div className="empty">Add a screen to see the live preview. The engine renders right here in your browser — no server.</div>}
            {active && previewBusy && <div className="preview-spin"><div className="spin" /></div>}
          </div>
          <div className="muted">{store.width} × {store.height}{fontsReady ? '' : ' · loading fonts…'}</div>
        </div>

        {/* RIGHT: inspector */}
        <div className="panel right">
          <div className="section">
            <h3>Headline</h3>
            {active ? (
              <>
                <div className="field"><label>Line 1</label>
                  <input value={active.line1} onChange={(e) => updateActive({ line1: e.target.value })} /></div>
                <div className="field"><label>Line 2 (gradient)</label>
                  <input value={active.line2} onChange={(e) => updateActive({ line2: e.target.value })} /></div>
              </>
            ) : <div className="muted">Select a screen.</div>}
            <button className="btn block" disabled={!slides.length || !!busy} onClick={autoHeadlines}>✨ Auto-headlines (AI)</button>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" style={{ flex: 1 }} disabled={!slides.length || !!busy} onClick={autoHeadlines} title="Re-run for a fresh set">↻ Regenerate</button>
              <button className="btn sm" style={{ flex: 1 }} disabled={!active || !!busy} onClick={genOptions} title="3 options for this screen">✨ Options</button>
            </div>
            {options.length > 0 && (
              <div className="opts">
                {options.map((o, i) => (
                  <button key={i} className="opt" onClick={() => { updateActive({ line1: o.line1, line2: o.line2 }); setOptions([]) }}>
                    <b>{o.line1 || 'No line 1'}</b><span>{o.line2}</span>
                  </button>
                ))}
              </div>
            )}
            <button className="btn block" style={{ marginTop: 8 }} disabled={!active || !!busy} onClick={downloadActive}>⬇ Download this slide</button>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <div className="field" style={{ marginBottom: 6 }}>
                <label>AI key — optional, BYOK</label>
                <input type="password" placeholder="sk-…  reads your screens, writes headlines" value={aiKey} onChange={(e) => setAiKey(e.target.value)} />
              </div>
              <div className="muted">With a key, ✨ Auto-headlines uses a vision model on your screenshots. Blank = offline templates. Stored only in your browser.</div>
              <div className="field" style={{ marginTop: 10, marginBottom: 4 }}>
                <label>Languages — comma separated (needs a key)</label>
                <input placeholder="de, es, fr, it" value={locales} onChange={(e) => setLocales(e.target.value)} />
              </div>
              <div className="muted">On Export, headlines are translated per language and rendered into per-locale folders.</div>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>Maps each screen to an on-brand headline. Offline now; swap in a vision model for full auto-writing.</div>
          </div>

          <div className="section">
            <h3>Device frame</h3>
            <div className="row">
              {(['titanium', 'black', 'silver'] as const).map((c) => (
                <button key={c} className={'tab' + (deviceColor === c ? ' active' : '')} style={{ flex: 1, textTransform: 'capitalize' }} onClick={() => setDeviceColor(c)}>{c}</button>
              ))}
            </div>
            <label className="btn sm block" style={{ textAlign: 'center', display: 'block', marginTop: 10 }}>
              {frameUrl ? 'Change mockup' : '+ Upload your own mockup'}
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFrameUrl(URL.createObjectURL(f)); setTemplateMode(true) } }} />
            </label>
            {frameUrl && (
              <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
                <label className="check" style={{ flex: 1 }}>
                  <input type="checkbox" checked={templateMode} onChange={(e) => setTemplateMode(e.target.checked)} />
                  <span>Template-faithful mode</span>
                </label>
                <button className="btn sm" onClick={() => { setFrameUrl(null); setTemplateMode(false) }}>Remove</button>
              </div>
            )}
            <div className="muted" style={{ marginTop: 6 }}>Pick a finish for the built-in frame, or drop your own real device mockup — the screen is auto-detected, your screenshot is swapped in, and the background recolors to the theme (grain preserved).</div>
          </div>

          <div className="section">
            <h3>Background</h3>
            <div className="swatches">
              {(customTheme ? [...PRESETS, { key: 'custom', label: 'Custom', theme: customTheme }] : PRESETS).map((p) => (
                <button key={p.key} aria-label={p.label} className={'swatch' + (p.key === themeKey ? ' active' : '')}
                  style={{ background: p.theme.background.kind === 'mesh' ? `linear-gradient(135deg, ${p.theme.background.colors.join(', ')})` : `linear-gradient(135deg, ${p.theme.background.from}, ${p.theme.background.to})` }}
                  onClick={() => setThemeKey(p.key)}>
                  <span style={{ color: p.theme.headlineColor }}>{p.label}</span>
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10, alignItems: 'center' }}>
              <input type="color" className="color-in" aria-label="Brand color" value={brandColor}
                onChange={(e) => { setBrandColor(e.target.value); setCustom(themeFromColors(e.target.value, darken(e.target.value, 0.42))) }} />
              <button className="btn sm" style={{ flex: 1 }} disabled={!active} onClick={matchScreenshot}>🎨 Match my screenshot</button>
            </div>
          </div>

          <div className="section">
            <h3>Checks</h3>
            {active ? (() => {
              const bg = theme.background.kind === 'mesh' ? theme.background.colors[Math.floor(theme.background.colors.length / 2)] : theme.background.from
              const cr = contrastRatio(theme.headlineColor, bg)
              const len = Math.max(active.line1.length, active.line2.length)
              const rows = [
                { ok: cr >= 3, label: `Contrast ${cr.toFixed(1)}:1`, hint: cr >= 3 ? 'Good' : 'Low — darker/lighter bg or headline' },
                { ok: len > 0 && len <= 22, label: `Caption ${len} chars`, hint: len === 0 ? 'No headline yet' : len <= 22 ? 'Reads at thumbnail' : 'Long — shorten for the store grid' },
                { ok: safeArea, label: 'Safe-area guides', hint: safeArea ? 'On' : 'Turn on to keep text off edges' },
              ]
              return <div className="checks">{rows.map((c, i) => (
                <div key={i} className={'crow ' + (c.ok ? 'ok' : 'warn')}><span className="dot" />{c.label}<span className="hint">{c.hint}</span></div>
              ))}</div>
            })() : <div className="muted">Select a screen.</div>}
          </div>

          <div className="section">
            <h3>A/B variants</h3>
            <div className="muted" style={{ marginBottom: 8 }}>Export the kit under several themes to test in Apple PPO / Play experiments. Off = active theme only.</div>
            <div className="stores">
              {PRESETS.map((p) => (
                <label key={p.key} className="check">
                  <input type="checkbox" checked={variants.includes(p.key)} onChange={(e) => setVariants((cur) => e.target.checked ? [...new Set([...cur, p.key])] : cur.filter((x) => x !== p.key))} />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="section">
            <h3>Layout</h3>
            <div className="row">
              <button className={'tab' + (layout === 'headline-top' ? ' active' : '')} onClick={() => setLayout('headline-top')}>Headline top</button>
              <button className={'tab' + (layout === 'headline-bottom' ? ' active' : '')} onClick={() => setLayout('headline-bottom')}>Headline bottom</button>
            </div>
            <label className="check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={safeArea} onChange={(e) => setSafeArea(e.target.checked)} />
              <span>Safe-area guides (preview)</span>
            </label>
          </div>

          <div className="section">
            <h3>Stores</h3>
            <div className="stores">
              {allTargets.map((t) => (
                <label key={t.id} className="check">
                  <input type="checkbox" checked={enabled.includes(t.id)}
                    onChange={(e) => setEnabled((cur) => e.target.checked ? [...new Set([...cur, t.id])] : cur.filter((x) => x !== t.id))} />
                  <span>{t.label} <span className="muted">· {t.width}×{t.height}</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      {busy && (
        <div className="busy-overlay">
          <div className="card"><div className="spin" /><div>{busy}</div>{progress && <div className="muted" style={{ marginTop: 6 }}>{progress.done} / {progress.total}</div>}</div>
        </div>
      )}
      {toast && <div className={'toast' + (toast.error ? ' error' : '')} onClick={() => setToast(null)}>{toast.msg}</div>}
    </div>
  )
}
