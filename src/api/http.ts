const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const AUTH_FLAG = 'esp-signed-in'

export function apiUrl(path: string) {
  return `${API_URL}${path}`
}

export function hasSessionFlag() {
  return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(AUTH_FLAG) === '1'
}

export function setSessionFlag(on: boolean) {
  if (typeof sessionStorage === 'undefined') return
  if (on) sessionStorage.setItem(AUTH_FLAG, '1')
  else sessionStorage.removeItem(AUTH_FLAG)
}

export async function parseResponse<T>(response: Response) {
  const data = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(data.message || 'Please wait a few seconds, then try again.')
    }
    throw new Error(data.message || 'Request failed')
  }
  return data
}

export async function apiFetch<T>(path: string, init: RequestInit = {}) {
  let response: Response
  try {
    response = await fetch(apiUrl(path), { ...init, credentials: 'same-origin' })
  } catch {
    throw new Error('API is not running. Start it with npm run dev.')
  }
  return parseResponse<T>(response)
}

export async function authFetch<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  return apiFetch<T>(path, { ...init, headers, credentials: 'same-origin' })
}
