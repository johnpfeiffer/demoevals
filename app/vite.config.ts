import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The CEREBRAS_API_KEY lives in the repository root .env and is only read
// here, on the dev/preview server. The browser calls /api/cerebras/* and the
// proxy injects the Authorization header, so the key never reaches the client.
export default defineConfig(({ mode }) => {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url))
  const env = loadEnv(mode, repoRoot, '')
  const apiKey = env.CEREBRAS_API_KEY ?? process.env.CEREBRAS_API_KEY ?? ''
  const proxy = {
    '/api/cerebras': {
      target: 'https://api.cerebras.ai',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/cerebras/, '/v1'),
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  }
  return {
    plugins: [react()],
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
    server: { proxy },
    preview: { proxy },
  }
})
