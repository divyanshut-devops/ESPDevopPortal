import dns from 'node:dns/promises'
import net from 'node:net'

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '::',
  '::1',
  'metadata.google.internal',
  'metadata.google.com',
  '169.254.169.254',
])

export function isPrivateIp(value) {
  const ip = String(value || '').trim().replace(/^\[|\]$/g, '')
  if (!ip) return true
  if (ip.startsWith('::ffff:')) return isPrivateIp(ip.slice(7))
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a === 255) return true
    return false
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    if (lower === '::' || lower === '::1') return true
    if (lower.startsWith('fe80:') || lower.startsWith('ff')) return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    return false
  }
  return false
}

export function isBlockedHostname(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0]
  if (!host) return true
  if (BLOCKED_HOSTS.has(host)) return true
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host.includes('metadata.google')) return true
  if (net.isIP(host) && isPrivateIp(host)) return true
  return false
}

export async function assertPublicHostname(hostname) {
  if (isBlockedHostname(hostname)) {
    throw new Error('That host is not allowed.')
  }
  let records
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('Unable to resolve that host.')
  }
  if (!records.length || records.some((item) => isPrivateIp(item.address))) {
    throw new Error('That host is not allowed.')
  }
  return records.map((item) => item.address)
}

export async function assertSafeHttpUrl(parsed, { apiOrigin = '' } = {}) {
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed.')
  }
  if (apiOrigin && parsed.origin === apiOrigin) {
    if (!parsed.pathname.startsWith('/api/')) {
      throw new Error('Only portal /api paths can be called on this origin.')
    }
    return
  }
  await assertPublicHostname(parsed.hostname)
}
