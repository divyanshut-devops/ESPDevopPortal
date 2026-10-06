import { authFetch } from './http'

export interface TerminalStatus {
  ready: boolean
  running?: boolean
  image: string
  imageReady?: boolean
  service?: string
  container?: string
  compose?: string
  message: string
}

export function fetchTerminalStatus() {
  return authFetch<TerminalStatus>('/api/terminal/status')
}

export function startTerminalStack() {
  return authFetch<TerminalStatus>('/api/terminal/up', { method: 'POST' })
}

export function terminalSocketUrl() {
  const origin =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  const url = new URL(origin)
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${url.host}/ws/terminal`
}
