import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * En producción (Vercel) la carpeta /api se despliega sola como función
 * serverless. En desarrollo, Vite no la conoce: este plugin monta el mismo
 * handler dentro del servidor de desarrollo para que `npm run dev` funcione
 * igual que en producción, sin exponer nunca la llave al navegador.
 */
function apiDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'profesor-api-dev',
    apply: 'serve',
    configureServer(server) {
      // La llave vive solo en el proceso de Node, jamás en el bundle.
      for (const key of ['ANTHROPIC_API_KEY', 'LLM_MODEL', 'LLM_BASE_URL', 'RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW_MS']) {
        if (!process.env[key] && env[key]) process.env[key] = env[key]
      }
      server.middlewares.use('/api/chat', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/chat.ts')
          await mod.default(req, res)
        } catch (error) {
          server.ssrFixStacktrace(error as Error)
          console.error(error)
          if (!res.headersSent) res.statusCode = 500
          res.end(
            JSON.stringify({
              error: 'El profesor no pudo responder ahora. Intenta de nuevo en un momento.',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), apiDevServer(env)],
    server: { port: 5173 },
    build: { sourcemap: false },
  }
})
