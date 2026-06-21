import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@engine': path.resolve(dir, '../src') } },
  server: { fs: { allow: [path.resolve(dir, '..')] } },
})
