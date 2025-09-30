/* eslint-disable no-undef */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Only try to access process.env during dev server, not during build
  const port = command === 'serve' && mode === 'development' 
    ? (process?.env?.VITE_PORT ? parseInt(process.env.VITE_PORT) : 5173)
    : 5173;
    
  return {
    plugins: [react()],
    server: {
      // Bind to all interfaces so other LAN devices can access Dev server
      host: true,
      port: port,
      strictPort: false // Allow fallback to other ports if specified port is busy
    }
  }
})
