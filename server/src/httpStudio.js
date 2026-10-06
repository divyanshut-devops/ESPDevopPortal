import { assertSafeHttpUrl } from './safeNet.js'

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export function publicStudio(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    method: doc.method,
    url: doc.url,
    headers: doc.headers || [],
    queryParams: doc.queryParams || [],
    body: doc.body || '',
    useSession: Boolean(doc.useSession),
    updatedAt: doc.updatedAt,
  }
}

export async function sendStudioRequest({ method, url, headers, body, token, apiOrigin }) {
  const verb = String(method || 'GET').toUpperCase()
  if (!METHODS.has(verb)) throw new Error('Unsupported HTTP method.')
  const rawUrl = String(url || '').trim()
  if (!rawUrl) throw new Error('URL is required.')
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('/api/')) {
    throw new Error('Only portal /api paths can be called as relative URLs.')
  }

  const target = rawUrl.startsWith('/') ? `${apiOrigin}${rawUrl}` : rawUrl
  let parsed
  try {
    parsed = new URL(target)
  } catch {
    throw new Error('Enter a valid URL.')
  }
  await assertSafeHttpUrl(parsed, { apiOrigin })

  const outbound = new Headers()
  for (const [key, value] of Object.entries(headers || {})) {
    if (!key || String(key).toLowerCase() === 'host') continue
    outbound.set(key, String(value))
  }
  if (token && (rawUrl.startsWith('/api') || parsed.origin === apiOrigin)) {
    outbound.set('Authorization', `Bearer ${token}`)
  }

  const started = Date.now()
  const response = await fetch(parsed.toString(), {
    method: verb,
    headers: outbound,
    body: verb === 'GET' || verb === 'HEAD' ? undefined : body || undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  })
  const responseHeaders = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })
  const text = await response.text()
  return {
    status: response.status,
    timeMs: Date.now() - started,
    headers: responseHeaders,
    body: text.slice(0, 200_000),
  }
}
