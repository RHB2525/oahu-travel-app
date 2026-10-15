import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite"

// In production the files in /api run as Vercel functions. During `npm run dev`
// this plugin serves the same handlers so the AI takeoff works locally too.
function devApi(): Plugin {
  return {
    name: "dev-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([\w-]+)$/)
        if (!match || req.method !== "POST") return next()
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`)
          const request = new Request(`http://localhost${req.url}`, {
            method: "POST",
            headers: { "content-type": req.headers["content-type"] ?? "application/json" },
            body: Buffer.concat(chunks),
          })
          const response: Response = await mod.POST(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          res.statusCode = 500
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
  return {
    plugins: [react(), devApi()],
    build: { chunkSizeWarningLimit: 2000 },
  }
})
