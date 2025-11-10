import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/' // Для корневого домена GitHub Pages (tacein.github.io)
})


