import { authFetch } from './http'

export async function fetchClientIp() {
  return authFetch<{
    clientIp: string
    publicIpv4: string
    publicIpv6?: string
    reverseDns: string
    city?: string
    region?: string
    country?: string
    timezone?: string
    isp?: string
    asn?: string
    coords?: string
    raw?: unknown
  }>('/api/network/ip')
}

export async function reverseLookup(ip: string) {
  return authFetch<{ reverseDns: string }>('/api/network/reverse', {
    method: 'POST',
    body: JSON.stringify({ ip }),
  })
}

export async function pingHost(host: string) {
  return authFetch<{
    host: string
    icmp: string
    http: { url: string; status: number; timeMs: number } | null
    ports: Array<{ port: number; open: boolean }>
  }>('/api/network/ping', {
    method: 'POST',
    body: JSON.stringify({ host }),
  })
}

export async function lookupDns(host: string) {
  return authFetch<{
    host: string
    A: string[]
    AAAA: string[]
    CNAME: string[]
    MX: Array<{ exchange: string; priority: number }>
    TXT: string[]
    NS: string[]
  }>('/api/network/dns', {
    method: 'POST',
    body: JSON.stringify({ host }),
  })
}

export async function checkSsl(host: string) {
  return authFetch<{
    host: string
    authorized: boolean
    subject: string
    issuer: string
    validFrom: string
    validTo: string
    daysRemaining: number
    sans: string[]
  }>('/api/network/ssl', {
    method: 'POST',
    body: JSON.stringify({ host }),
  })
}
