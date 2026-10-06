import { authFetch } from './http'
import type { HttpMethod, KeyValuePair } from '../types'

export interface StudioSavedRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  body: string
  useSession: boolean
  updatedAt?: string
}

export interface StudioSendResult {
  status: number
  timeMs: number
  headers: Record<string, string>
  body: string
}

export async function listStudioRequests() {
  return authFetch<{ requests: StudioSavedRequest[] }>('/api/studio/requests')
}

export async function saveStudioRequest(payload: Omit<StudioSavedRequest, 'id' | 'updatedAt'> & { id?: string }) {
  if (payload.id) {
    return authFetch<{ request: StudioSavedRequest }>(`/api/studio/requests/${payload.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }
  return authFetch<{ request: StudioSavedRequest }>('/api/studio/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteStudioRequest(id: string) {
  return authFetch<{ ok: boolean }>(`/api/studio/requests/${id}`, { method: 'DELETE' })
}

async function sendFromBrowser(payload: {
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body?: string
  useSession: boolean
}): Promise<StudioSendResult> {
  const headers = new Headers(payload.headers)
  const started = Date.now()
  const response = await fetch(payload.url, {
    method: payload.method,
    headers,
    credentials: payload.useSession ? 'same-origin' : 'omit',
    body: payload.method === 'GET' ? undefined : payload.body || undefined,
  })
  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })
  return {
    status: response.status,
    timeMs: Date.now() - started,
    headers: responseHeaders,
    body: (await response.text()).slice(0, 200_000),
  }
}

export async function sendStudioRequest(payload: {
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body?: string
  useSession: boolean
}) {
  const url = String(payload.url || '').trim()
  const sameOrigin =
    url.startsWith('/') || (typeof window !== 'undefined' && url.startsWith(window.location.origin))
  if (sameOrigin) {
    try {
      return await sendFromBrowser(payload)
    } catch {
      /* proxy through API */
    }
  }
  return authFetch<StudioSendResult>('/api/studio/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
