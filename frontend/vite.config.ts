import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/', // Для корневого домена GitHub Pages (tacein.github.io)
  resolve: {
    // Улучшаем разрешение модулей для production сборки
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
  },
  build: {
    // Оптимизация сборки для production
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false,
    // Улучшаем разрешение модулей при сборке
    commonjsOptions: {
      include: [/node_modules/]
    }
  }
})


