import { execFile, spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
import { WebSocketServer } from 'ws'
import { cookieValue, SESSION_COOKIE } from './session.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = () => path.resolve(__dirname, '../..')
const composeFile = () =>
  process.env.DOCKER_COMPOSE_FILE?.trim() || path.join(projectRoot(), 'docker-compose.yml')
const service = () => process.env.DOCKER_TERMINAL_SERVICE?.trim() || 'linux'
const containerName = () => process.env.DOCKER_TERMINAL_CONTAINER?.trim() || 'esp-linux-shell'
const image = () => process.env.DOCKER_TERMINAL_IMAGE?.trim() || 'ubuntu:22.04'

function composeProjectDir() {
  return path.dirname(composeFile())
}

function runDocker(args, timeout = 20000, cwd = projectRoot()) {
  return new Promise((resolve) => {
    execFile('docker', args, { timeout, windowsHide: true, cwd }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout || ''), stderr: String(stderr || ''), error })
    })
  })
}

async function containerRunning() {
  const inspect = await runDocker(['inspect', '-f', '{{.State.Running}}', containerName()], 8000)
  return inspect.ok && inspect.stdout.trim() === 'true'
}

export async function dockerTerminalStatus() {
  const info = await runDocker(['info'], 8000)
  if (!info.ok) {
    return {
      ready: false,
      running: false,
      image: image(),
      service: service(),
      container: containerName(),
      compose: 'docker-compose.yml',
      message: 'Start Docker Desktop, then open Terminal again.',
    }
  }
  const running = await containerRunning()
  return {
    ready: true,
    running,
    image: image(),
    service: service(),
    container: containerName(),
    compose: 'docker-compose.yml',
    message: running ? 'Node, AWS CLI, gcloud, vim, and bash are ready.' : 'Starting Ubuntu 22 bash…',
  }
}

export async function startDockerTerminal() {
  const info = await runDocker(['info'], 8000)
  if (!info.ok) {
    return {
      ready: false,
      running: false,
      image: image(),
      service: service(),
      container: containerName(),
      compose: 'docker-compose.yml',
      message: 'Docker is not running. Start Docker Desktop, then retry.',
    }
  }
  if (await containerRunning()) return dockerTerminalStatus()
  const up = await runDocker(
    ['compose', '-f', composeFile(), '--project-directory', composeProjectDir(), 'up', '-d', service()],
    180000,
    composeProjectDir(),
  )
  if (await containerRunning()) return dockerTerminalStatus()
  const run = await runDocker(
    [
      'run',
      '-d',
      '--name',
      containerName(),
      '--hostname',
      'esp-shell',
      '--restart',
      'unless-stopped',
      '-w',
      '/workspace',
      '-e',
      'TERM=xterm-256color',
      image(),
      'sleep',
      'infinity',
    ],
    120000,
  )
  if (!up.ok && !run.ok) {
    return {
      ready: true,
      running: false,
      image: image(),
      service: service(),
      container: containerName(),
      compose: 'docker-compose.yml',
      message: (run.stderr || up.stderr || 'Unable to start the Linux container.').trim(),
    }
  }
  return dockerTerminalStatus()
}

function write(ws, text) {
  if (ws.readyState === ws.OPEN) ws.send(text)
}

function startShell(ws) {
  const name = containerName()
  const args = [
    'exec',
    '-i',
    '-w',
    '/workspace',
    '-e',
    'TERM=xterm-256color',
    '-e',
    'LANG=C.UTF-8',
    '-e',
    'HOME=/root',
    name,
    'python3',
    '-u',
    '/usr/local/bin/esp-pty',
  ]
  const child = spawn('docker', args, {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: projectRoot(),
  })
  child.stdout?.on('data', (chunk) => {
    if (ws.readyState === ws.OPEN) ws.send(chunk)
  })
  child.stderr?.on('data', (chunk) => {
    if (ws.readyState === ws.OPEN) ws.send(chunk)
  })
  child.on('error', (error) => {
    write(
      ws,
      error.code === 'ENOENT'
        ? '\r\nDocker CLI was not found. Install Docker Desktop and retry.\r\n'
        : `\r\nDocker error: ${error.message}\r\n`,
    )
  })
  child.on('close', (code) => {
    write(ws, `\r\n[shell exited ${code ?? 0}]\r\n`)
    if (ws.readyState === ws.OPEN) ws.close()
  })
  ws.on('message', (data) => {
    if (!child.stdin?.writable) return
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
    try {
      const msg = JSON.parse(text)
      if (msg?.type === 'resize' && Number(msg.rows) && Number(msg.cols)) {
        child.stdin.write(`\x1e${Number(msg.rows)},${Number(msg.cols)}\x1f`)
        return
      }
    } catch {
      /* raw keys */
    }
    child.stdin.write(Buffer.isBuffer(data) ? data : Buffer.from(data))
  })
  const stop = () => {
    try {
      child.stdin?.end()
    } catch {
      /* ignore */
    }
    try {
      child.kill()
    } catch {
      /* ignore */
    }
  }
  ws.on('close', stop)
  ws.on('error', stop)
}

export function attachDockerTerminal(_httpServer, { jwtSecret, resolveAccess }) {
  const wss = new WebSocketServer({ noServer: true })
  wss.on('connection', async (ws, req) => {
    const token = cookieValue(req, SESSION_COOKIE)
    let email = ''
    try {
      const payload = jwt.verify(token, jwtSecret)
      if (payload?.pending2fa || !payload?.email) throw new Error('invalid')
      email = String(payload.email)
    } catch {
      write(ws, 'Session expired. Sign in again.\r\n')
      ws.close()
      return
    }
    const access = await resolveAccess(email)
    if (!access?.privileges?.includes('ssh.connect')) {
      write(ws, 'You do not have permission to use Terminal.\r\n')
      ws.close()
      return
    }
    const started = await startDockerTerminal()
    if (!started.running) {
      write(ws, `${started.message}\r\n`)
      ws.close()
      return
    }
    startShell(ws)
  })
  return {
    handleUpgrade(request, socket, head) {
      const url = new URL(request.url || '', 'http://localhost')
      if (url.pathname !== '/ws/terminal') return false
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
      return true
    },
  }
}
