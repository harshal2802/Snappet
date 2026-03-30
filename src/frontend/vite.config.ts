import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_BASE_PATH to match your GitHub repo name, e.g. /Snappet/
// Defaults to /Snappet/ — change this if your repo is named differently
const base = process.env.VITE_BASE_PATH ?? '/Snappet/'

export default defineConfig({
  plugins: [react()],
  base,
})
