import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': JSON.stringify({
      NEXT_PUBLIC_ADMIN_EMAILS: 'nbt1024@gmail.com,jarvis-test@z-build.com'
    }),
    'process.env.NEXT_PUBLIC_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || ''),
    'process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
    'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || ''),
    'process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || ''),
    'process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
    'process.env.NEXT_PUBLIC_FIREBASE_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || ''),
    'process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.VITE_FIREBASE_MEASUREMENT_ID || ''),
    'process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY': JSON.stringify(process.env.VITE_FIREBASE_VAPID_KEY || 'REPLACE_ME'),
    'process.env.NEXT_PUBLIC_ADMIN_EMAILS': JSON.stringify(process.env.VITE_ADMIN_EMAILS || 'nbt1024@gmail.com,jarvis-test@z-build.com'),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('firebase') || id.includes('react-router-dom')) {
              return 'vendor';
            }
            return 'ui-libs';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
