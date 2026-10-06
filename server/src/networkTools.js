import { execFile } from 'node:child_process'
import dns from 'node:dns/promises'
import net from 'node:net'
import tls from 'node:tls'
import { promisify } from 'node:util'
import { assertPublicHostname, isPrivateIp } from './safeNet.js'

const execFileAsync = promisify(execFile)

export function sanitizeHost(input) {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('Enter a hostname or IP.')
  const stripped = raw.replace(/^https?:\/\//i, '').split('/')[0]
  const host = stripped.replace(/\[|\]/g, '').split('%')[0]
  const hostname = host.includes(':') && host.split(':').length === 2 && !host.includes('::')
    ? host.split(':')[0]
    : host
  if (hostname.length > 253 || /[\s\\;|&$`'<>]/.test(hostname)) {
    throw new Error('Enter a valid hostname or IP.')
  }
  if (isPrivateIp(hostname) || hostname === 'localhost') {
    throw new Error('Private and loopback hosts are not allowed.')
  }
  return hostname
}

export function isIpv4(value) {
  return net.isIPv4(String(value || '').trim())
}

export function normalizeIp(raw) {
  let value = String(raw || '').trim().replace(/^\[|\]$/g, '')
  if (value.startsWith('::ffff:')) value = value.slice(7)
  return value
}

export function clientIp(req) {
  const candidates = [
    ...String(req.headers['x-forwarded-for'] || '').split(','),
    req.headers['x-real-ip'],
    req.socket?.remoteAddress,
  ]
    .map(normalizeIp)
    .filter(Boolean)
  return candidates.find((item) => isIpv4(item)) || candidates[0] || ''
}

export async function fetchPublicIpv4() {
  const sources = [
    async () => {
      const data = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) }).then((response) => response.json())
      return String(data.ip || '').trim()
    },
    async () => {
      const text = await fetch('https://ipv4.icanhazip.com', { signal: AbortSignal.timeout(5000) }).then((response) => response.text())
      return String(text || '').trim()
    },
  ]
  for (const source of sources) {
    try {
      const ip = await source()
      if (isIpv4(ip)) return ip
    } catch {
      /* try next IPv4 source */
    }
  }
  return ''
}

export async function reverseDns(ip) {
  try {
    const names = await dns.reverse(ip)
    return names[0] || ''
  } catch {
    return ''
  }
}

export async function lookupIpMeta(ip) {
  if (!isIpv4(ip)) return {}
  try {
    const response = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(5000) })
    const who = await response.json()
    return {
      city: who?.city || '',
      region: who?.region || '',
      country: who?.country || '',
      timezone: who?.timezone?.id || who?.timezone || '',
      isp: who?.connection?.isp || who?.connection?.org || '',
      asn: who?.connection?.asn ? `AS${who.connection.asn}` : '',
      coords: who?.latitude && who?.longitude ? `${who.latitude}, ${who.longitude}` : '',
      raw: who,
    }
  } catch {
    return {}
  }
}

export async function fetchPublicIpv6() {
  try {
    const data = await fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(5000) }).then((response) => response.json())
    const ip = String(data.ip || '').trim()
    return ip.includes(':') ? ip : ''
  } catch {
    return ''
  }
}

export async function lookupDns(host) {
  const hostname = sanitizeHost(host)
  await assertPublicHostname(hostname)
  const collect = async (fn) => {
    try {
      return await fn(hostname)
    } catch {
      return []
    }
  }
  const [a, aaaa, cname, mx, txt, ns] = await Promise.all([
    collect(dns.resolve4),
    collect(dns.resolve6),
    collect(dns.resolveCname),
    collect(dns.resolveMx),
    collect(dns.resolveTxt),
    collect(dns.resolveNs),
  ])
  return {
    host: hostname,
    A: a,
    AAAA: aaaa,
    CNAME: cname,
    MX: mx,
    TXT: txt.map((item) => (Array.isArray(item) ? item.join('') : item)),
    NS: ns,
  }
}

function checkPort(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, family: 4 })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ port, open: false })
    }, timeoutMs)
    socket.on('connect', () => {
      clearTimeout(timer)
      socket.end()
      resolve({ port, open: true })
    })
    socket.on('error', () => {
      clearTimeout(timer)
      resolve({ port, open: false })
    })
  })
}

async function httpStatus(host) {
  const targets = [`https://${host}`, `http://${host}`]
  for (const url of targets) {
    try {
      const started = Date.now()
      const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(6000) })
      return { url, status: response.status, timeMs: Date.now() - started }
    } catch {
      try {
        const started = Date.now()
        const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(6000) })
        return { url, status: response.status, timeMs: Date.now() - started }
      } catch {
        continue
      }
    }
  }
  return null
}

export async function pingHost(host) {
  const hostname = sanitizeHost(host)
  await assertPublicHostname(hostname)
  const isWin = process.platform === 'win32'
  const args = isWin ? ['-4', '-n', '4', hostname] : ['-4', '-c', '4', hostname]
  let icmp = ''
  try {
    const result = await execFileAsync('ping', args, { timeout: 12000, windowsHide: true })
    icmp = String(result.stdout || result.stderr || '').trim()
  } catch (error) {
    icmp = String(error.stdout || error.stderr || error.message || 'Ping failed').trim()
  }
  const [http, ports] = await Promise.all([
    httpStatus(hostname),
    Promise.all([80, 443, 22, 53].map((port) => checkPort(hostname, port))),
  ])
  return { host: hostname, icmp, http, ports }
}

export async function checkSsl(host) {
  const hostname = sanitizeHost(host)
  await assertPublicHostname(hostname)
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate()
        const authorized = socket.authorized
        socket.end()
        if (!cert || !cert.valid_to) {
          reject(new Error('No certificate returned.'))
          return
        }
        const validFrom = new Date(cert.valid_from)
        const validTo = new Date(cert.valid_to)
        const sans = String(cert.subjectaltname || '')
          .split(',')
          .map((item) => item.replace('DNS:', '').trim())
          .filter(Boolean)
        resolve({
          host: hostname,
          authorized,
          subject: cert.subject?.CN || hostname,
          issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysRemaining: Math.round((validTo.getTime() - Date.now()) / 86400000),
          sans,
        })
      },
    )
    socket.setTimeout(10000, () => {
      socket.destroy()
      reject(new Error('SSL check timed out.'))
    })
    socket.on('error', (error) => reject(error))
  })
}
