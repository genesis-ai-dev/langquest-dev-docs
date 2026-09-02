import path from "node:path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { schemaFsPlugin } from './vite-plugin-schema-fs'

export default defineConfig({
  plugins: [react(), tailwindcss(), schemaFsPlugin()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
})
