import http from 'node:http'
import dotenv from 'dotenv'
import next from 'next'

dotenv.config()
process.env.NEXT_EMBED = '1'

const { app: apiApp, bootServices } = await import('./server/src/index.js')

const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT || 3000)
const hostname = process.env.HOST || '0.0.0.0'
const nextApp = next({ dev, hostname, port })
await nextApp.prepare()
const handle = nextApp.getRequestHandler()
const nextUpgrade = nextApp.getUpgradeHandler()

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    apiApp(req, res)
    return
  }
  handle(req, res)
})

server.on('upgrade', (request, socket, head) => {
  nextUpgrade(request, socket, head)
})

server.listen(port, hostname, async () => {
  console.log(`ESP DevOps Portal running on http://localhost:${port}`)
  await bootServices()
})
