import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        short_name: 'Viajes',
        name: 'Gerenciamiento de Viajes',
        description: 'Aplicación de Registro, Marcado de Puntos y Lectura de Kilometraje para Viajes',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        start_url: './',
        scope: './',
        background_color: '#0f172a',
        theme_color: '#2e81ab',
        display: 'standalone',
        orientation: 'portrait'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/telegram\.org\/js\/telegram-web-app\.js/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'telegram-sdk-cache',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/catalogos\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'catalogos-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
})
