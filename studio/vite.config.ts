import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.GITHUB_PAGES ? '/flowent-shotkit/' : '/'
export default defineConfig({
  base,
  plugins: [react()],
  resolve: { alias: { '@engine': path.resolve(dir, '../src') } },
  server: { open: true, fs: { allow: [path.resolve(dir, '..')] } },
})
