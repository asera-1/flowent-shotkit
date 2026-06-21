import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import JSZip from 'jszip'
import { renderSlide } from '@engine/compose'
import { allTargets } from '@engine/targets'
import type { Slide, StoreTarget, Theme } from '@engine/types'
import { DeterministicDirector } from '@engine/director'
import { renderTemplateSlide } from '@engine/template'
import { buildContactSheet } from '@engine/contactsheet'
import type { RenderTarget } from '@engine/render-target'
import { createBrowserRenderer, initFonts, targetBlob, targetCanvas } from './browser-renderer'
import { PRESETS, PRESET_BY_KEY } from './themes'

interface UISlide { id: string; name: string; url: string; line1: string; line2: string }

const slug = (s: string) =>
  s.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'slide'

const toEngine = (s: UISlide): Slide => ({ id: s.id, screenshot: s.url, headline: { line1: s.line1, line2: s.line2 } })

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1500)
}

export function App() {
  const renderer = useMemo(() => createBrowserRenderer(), [])
  const [fontsReady, setFontsReady] = useState(false)
  const [slides, setSlides] = useState<UISlide[]>([])
  const [themeKey, setThemeKey] = useState('brand-blue')
  const [enabled, setEnabled] = useState<string[]>(allTargets.map((t) => t.id))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeStore, setActiveStore] = useState<string>(allTargets[0].id)
  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const [templateMode, setTemplateMode] = useState(false)
  const [layout, setLayout] = useState<'headline-top' | 'headline-bottom'>('headline-top')
  const [safeArea, setSafeArea] = useState(false)
  const [busy, setBusy] = useState('')
  const previewRef = useRef<HTMLCanvasElement>(null)
  const tokenRef = useRef(0)

  const theme: Theme = useMemo(() => ({ ...PRESET_BY_KEY[themeKey].theme, layout }), [themeKey, layout])
  const active = slides.find((s) => s.id === activeId) || null
  const store = allTargets.find((t) => t.id === activeStore)!

  const renderOne = (s: UISlide, st: StoreTarget) =>
    templateMode && frameUrl
      ? renderTemplateSlide(renderer, { frame: frameUrl, screenshot: s.url, headline: { line1: s.line1, line2: s.line2 }, theme, recolor: theme.background.kind === 'synthetic' ? { from: theme.background.from, to: theme.background.to } : undefined })
      : renderSlide(renderer, { theme, stores: [st], slides: [toEngine(s)] }, toEngine(s), st)

  useEffect(() => { initFonts().then(() => setFontsReady(true)) }, [])

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const next: UISlide[] = arr.map((f, i) => ({
      id: `${slug(f.name)}-${(Date.now() + i).toString(36).slice(-4)}`,
      name: f.name, url: URL.createObjectURL(f), line1: 'YOUR HEADLINE', line2: 'GOES HERE',
    }))
    setSlides((p) => [...p, ...next])
    setActiveId((cur) => cur ?? next[0]?.id ?? null)
  }, [])

  async function loadExamples() {
    const ex: UISlide[] = [
      { id: 'home', name: 'home.png', url: '/examples/home.png', line1: 'YOUR NEXT LESSON', line2: 'READY EVERY DAY' },
      { id: 'vocab', name: 'saved-vocab.png', url: '/examples/vocab.png', line1: 'BEAT THE', line2: 'FORGETTING CURVE' },
    ]
    setSlides(ex)
    setActiveId('home')
  }

  // live preview of the active slide on the active store
  useEffect(() => {
    if (!fontsReady || !active || !previewRef.current) return
    const token = ++tokenRef.current
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
    })().catch(console.error)
  }, [fontsReady, active?.id, active?.line1, active?.line2, activeStore, templateMode, frameUrl, safeArea, renderer, store, theme])

  function updateActive(patch: Partial<UISlide>) {
    if (!active) return
    setSlides((p) => p.map((s) => (s.id === active.id ? { ...s, ...patch } : s)))
  }

  async function autoHeadlines() {
    if (!slides.length) return
    setBusy('Writing headlines…')
    const dir = new DeterministicDirector()
    const stores: StoreTarget[] = enabled.map((id) => allTargets.find((t) => t.id === id)!).filter(Boolean)
    const res = await dir.generate({
      screenshots: slides.map((s) => ({ id: s.id, image: s.url, label: s.name })),
      appProfile: { name: 'Flowent' },
      brandVoice: { tone: 'direct', casing: 'upper', banned: [',', '—'] },
      stores,
    })
    setSlides((p) => p.map((s) => {
      const c = res.slides.find((x) => x.screenshotId === s.id)
      return c ? { ...s, line1: c.headline.line1, line2: c.headline.line2 } : s
    }))
    setBusy('')
  }

  async function downloadActive() {
    if (!active) return
    const t = await renderOne(active, store)
    download(await targetBlob(t), `${active.id}-${store.id}.png`)
  }

  async function exportZip() {
    if (!slides.length || !enabled.length) return
    setBusy('Rendering kit…')
    const zip = new JSZip()
    const sheetItems: { label: string; target: RenderTarget }[] = []
    const manifest: any = { generatedAt: new Date().toISOString(), files: [] as any[] }
    if (templateMode && frameUrl) {
      for (const s of slides) {
        const target = await renderOne(s, store)
        zip.file(`template/${s.id}.png`, await targetBlob(target))
        sheetItems.push({ label: s.id, target })
        manifest.files.push({ store: 'template', slide: s.id, file: `template/${s.id}.png` })
      }
    } else {
      for (const id of enabled) {
        const st = allTargets.find((t) => t.id === id)!
        for (const s of slides) {
          const target = await renderSlide(renderer, { theme, stores: [st], slides: [toEngine(s)] }, toEngine(s), st)
          zip.file(`${st.folder}/${s.id}.png`, await targetBlob(target))
          sheetItems.push({ label: `${st.label} ${s.id}`, target })
          manifest.files.push({ store: id, slide: s.id, file: `${st.folder}/${s.id}.png` })
        }
      }
    }
    if (sheetItems.length) zip.file('_overview.png', await targetBlob(buildContactSheet(renderer, sheetItems)))
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    const out = await zip.generateAsync({ type: 'blob' })
    download(out, 'flowent-shotkit-kit.zip')
    setBusy('')
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
            {slides.map((s) => (
              <div key={s.id} className={'slide' + (s.id === activeId ? ' active' : '')} onClick={() => setActiveId(s.id)}>
                <img src={s.url} alt="" />
                <div className="meta">
                  <div className="n">{s.line1 || s.name}</div>
                  <div className="h">{s.line2}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: preview */}
        <div className="stage">
          <div className="tabs">
            {allTargets.map((t) => (
              <div key={t.id} className={'tab' + (t.id === activeStore ? ' active' : '')} onClick={() => setActiveStore(t.id)}>
                {t.label}
              </div>
            ))}
          </div>
          <div className="preview">
            {active ? <canvas ref={previewRef} /> : <div className="empty">Add a screen to see the live preview. The engine renders right here in your browser — no server.</div>}
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
            <button className="btn block" style={{ marginTop: 8 }} disabled={!active || !!busy} onClick={downloadActive}>⬇ Download this slide</button>
            <div className="muted" style={{ marginTop: 6 }}>Maps each screen to an on-brand headline. Offline now; swap in a vision model for full auto-writing.</div>
          </div>

          <div className="section">
            <h3>Device frame</h3>
            <label className="btn sm block" style={{ textAlign: 'center', display: 'block' }}>
              {frameUrl ? 'Change mockup' : '+ Upload your mockup'}
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFrameUrl(URL.createObjectURL(f)); setTemplateMode(true) } }} />
            </label>
            <label className="check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={templateMode} disabled={!frameUrl} onChange={(e) => setTemplateMode(e.target.checked)} />
              <span>Template-faithful mode</span>
            </label>
            <div className="muted" style={{ marginTop: 6 }}>Drop a real device mockup — the screen is auto-detected, your screenshot is swapped in, and the background recolors to the theme (grain preserved).</div>
          </div>

          <div className="section">
            <h3>Background</h3>
            <div className="swatches">
              {PRESETS.map((p) => (
                <div key={p.key} className={'swatch' + (p.key === themeKey ? ' active' : '')}
                  style={{ background: p.theme.background.kind === 'mesh' ? `linear-gradient(135deg, ${p.theme.background.colors.join(', ')})` : `linear-gradient(135deg, ${p.theme.background.from}, ${p.theme.background.to})` }}
                  onClick={() => setThemeKey(p.key)}>
                  <span style={{ color: p.theme.headlineColor }}>{p.label}</span>
                </div>
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
    </div>
  )
}
