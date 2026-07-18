import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Bike Navi PWA',
        short_name: 'BikeNavi',
        description: '스마트폰 센서 기반 자전거 내비게이션 웹앱',
        theme_color: '#05070d',
        background_color: '#05070d',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
})
