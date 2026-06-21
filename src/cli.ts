import fs from 'node:fs'
import path from 'node:path'
import { createNodeRenderer } from './node/canvas-target'
import { renderProject } from './compose'
import { buildContactSheet } from './contactsheet'
import { allTargets } from './targets'
import type { Project } from './types'

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

async function main() {
  const configPath = arg('--config', 'shotkit.config.json')
  const out = arg('--out', 'out')
  const only = arg('--only', '')
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))

  let stores = raw.storeIds ? allTargets.filter((t) => raw.storeIds.includes(t.id)) : (raw.stores ?? allTargets)
  if (only) stores = stores.filter((t: any) => t.id === only)

  const project: Project = { theme: raw.theme, slides: raw.slides, stores }
  const renderer = createNodeRenderer({ fontDir: path.join(process.cwd(), 'assets', 'fonts') })
  const rendered = await renderProject(renderer, project)

  const manifest: any = { generatedAt: new Date().toISOString(), files: [] as any[] }
  for (const r of rendered) {
    const dir = path.join(out, r.store.folder)
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${r.slide.id}.png`)
    fs.writeFileSync(file, await r.target.encodePng())
    manifest.files.push({ store: r.store.id, slide: r.slide.id, file })
    console.log('rendered', file)
  }
  const sheet = buildContactSheet(renderer, rendered.map((r) => ({ label: `${r.store.label} - ${r.slide.id}`, target: r.target })))
  fs.writeFileSync(path.join(out, '_overview.png'), await sheet.encodePng())
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`done -> ${out} (${manifest.files.length} images)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
