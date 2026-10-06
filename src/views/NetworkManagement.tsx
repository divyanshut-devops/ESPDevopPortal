'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { checkSsl, fetchClientIp, lookupDns, pingHost } from '../api/network'
import { useApp } from '../context/AppContext'

interface IpInfo {
  publicV4: string
  publicV6: string
  clientIp: string
  reverseDns: string
  city: string
  region: string
  country: string
  timezone: string
  isp: string
  asn: string
  coords: string
  raw: unknown
  updatedAt: string
}

type PingResult = Awaited<ReturnType<typeof pingHost>>
type DnsResult = Awaited<ReturnType<typeof lookupDns>>
type SslResult = Awaited<ReturnType<typeof checkSsl>>

function isIpv4(value: string) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value.trim())
}

function formatStamp(date: Date) {
  return date.toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function ToolCard({
  icon,
  title,
  hint,
  placeholder,
  value,
  onChange,
  actionLabel,
  busyLabel,
  busy,
  onRun,
  children,
}: {
  icon: string
  title: string
  hint: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  actionLabel: string
  busyLabel: string
  busy: boolean
  onRun: () => void
  children: ReactNode
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onRun()
  }

  return (
    <section className="network-card">
      <div className="network-card-head">
        <h5 className="network-card-title">
          <i className={`bi ${icon}`} /> {title}
        </h5>
        <p className="network-hint">{hint}</p>
      </div>
      <form className="network-input-row" onSubmit={submit}>
        <input
          className="form-control"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="submit" className="btn btn-purple network-action" disabled={busy}>
          {busy ? busyLabel : actionLabel}
        </button>
      </form>
      <div className="network-result">{children}</div>
    </section>
  )
}

export function NetworkManagement() {
  const { pushToast } = useApp()
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null)
  const [ipLoading, setIpLoading] = useState(false)
  const [pingHostValue, setPingHostValue] = useState('')
  const [pingResult, setPingResult] = useState<PingResult | null>(null)
  const [pingBusy, setPingBusy] = useState(false)
  const [dnsHost, setDnsHost] = useState('')
  const [dnsResult, setDnsResult] = useState<DnsResult | null>(null)
  const [dnsBusy, setDnsBusy] = useState(false)
  const [sslHost, setSslHost] = useState('')
  const [sslResult, setSslResult] = useState<SslResult | null>(null)
  const [sslBusy, setSslBusy] = useState(false)

  const loadIp = async () => {
    setIpLoading(true)
    try {
      const client = await fetchClientIp()
      const publicV4 = [client.publicIpv4, client.clientIp].find(isIpv4) || ''
      setIpInfo({
        publicV4,
        publicV6: client.publicIpv6 || '',
        clientIp: isIpv4(client.clientIp) ? client.clientIp : publicV4 || client.clientIp,
        reverseDns: client.reverseDns,
        city: client.city || '',
        region: client.region || '',
        country: client.country || '',
        timezone: typeof client.timezone === 'string' ? client.timezone : '',
        isp: client.isp || '',
        asn: client.asn || '',
        coords: client.coords || '',
        raw: client.raw,
        updatedAt: formatStamp(new Date()),
      })
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to look up IP', 'error')
    } finally {
      setIpLoading(false)
    }
  }

  useEffect(() => {
    void loadIp()
  }, [])

  const runPing = () => {
    if (!pingHostValue.trim()) {
      pushToast('Enter a domain or IP', 'warning')
      return
    }
    setPingBusy(true)
    void pingHost(pingHostValue.trim())
      .then(setPingResult)
      .catch((error) => {
        setPingResult(null)
        pushToast(error instanceof Error ? error.message : 'Ping failed', 'error')
      })
      .finally(() => setPingBusy(false))
  }

  const runDns = () => {
    if (!dnsHost.trim()) {
      pushToast('Enter a hostname', 'warning')
      return
    }
    setDnsBusy(true)
    void lookupDns(dnsHost.trim())
      .then(setDnsResult)
      .catch((error) => {
        setDnsResult(null)
        pushToast(error instanceof Error ? error.message : 'DNS lookup failed', 'error')
      })
      .finally(() => setDnsBusy(false))
  }

  const runSsl = () => {
    if (!sslHost.trim()) {
      pushToast('Enter a hostname', 'warning')
      return
    }
    setSslBusy(true)
    void checkSsl(sslHost.trim())
      .then(setSslResult)
      .catch((error) => {
        setSslResult(null)
        pushToast(error instanceof Error ? error.message : 'SSL check failed', 'error')
      })
      .finally(() => setSslBusy(false))
  }

  return (
    <div className="network-page">
      <div className="network-hero">
        <h2 className="network-title">Network</h2>
        <p className="network-subtitle">Your public IP, ping, DNS lookup, and SSL checks with live results.</p>
      </div>

      <div className="network-grid">
        <section className="network-card network-card-ip">
          <div className="network-card-head network-card-head-row">
            <div>
              <h5 className="network-card-title">
                <i className="bi bi-globe2" /> What is my IP?
              </h5>
              <p className="network-hint">Collects your public IPv4 first, then location and ISP.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm network-refresh" disabled={ipLoading} onClick={() => void loadIp()}>
              {ipLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {ipInfo ? (
            <>
              <div className="network-kv-grid">
                <div className="network-kv">
                  <span>PUBLIC IPV4</span>
                  <strong>{ipInfo.publicV4 || '—'}</strong>
                </div>
                <div className="network-kv">
                  <span>PUBLIC IPV6</span>
                  <strong>{ipInfo.publicV6 || '—'}</strong>
                </div>
                <div className="network-kv">
                  <span>APP SEEN CLIENT</span>
                  <strong>{ipInfo.clientIp || '—'}</strong>
                </div>
                <div className="network-kv">
                  <span>REVERSE DNS</span>
                  <strong>{ipInfo.reverseDns || '—'}</strong>
                </div>
              </div>
              <div className="network-meta">
                <div>{[ipInfo.city, ipInfo.region, ipInfo.country].filter(Boolean).join(', ') || 'Location unavailable'}</div>
                {ipInfo.timezone ? <div>Timezone: {ipInfo.timezone}</div> : null}
                {ipInfo.isp ? (
                  <div>
                    {ipInfo.asn} {ipInfo.isp}
                  </div>
                ) : null}
                {ipInfo.coords ? <div>Coords: {ipInfo.coords}</div> : null}
                <div className="network-updated">Updated {ipInfo.updatedAt}</div>
              </div>
              <p className="network-raw-label">RAW OUTPUT</p>
              <pre className="network-raw network-raw-ip">{JSON.stringify(ipInfo.raw, null, 2)}</pre>
            </>
          ) : (
            <div className="network-placeholder">{ipLoading ? 'Looking up your public IP…' : 'No IP data yet.'}</div>
          )}
        </section>

        <ToolCard
          icon="bi-activity"
          title="Ping"
          hint="ICMP ping, HTTP/HTTPS status, and common ports."
          placeholder="domain or IP"
          value={pingHostValue}
          onChange={setPingHostValue}
          actionLabel="Run"
          busyLabel="Running…"
          busy={pingBusy}
          onRun={runPing}
        >
          {pingBusy ? (
            <div className="network-placeholder">Pinging {pingHostValue}…</div>
          ) : pingResult ? (
            <>
              <div className="network-status-row">
                {pingResult.http ? (
                  <span className="chip">
                    HTTP {pingResult.http.status} · {pingResult.http.timeMs} ms
                  </span>
                ) : (
                  <span className="chip">HTTP unreachable</span>
                )}
                {pingResult.ports.map((item) => (
                  <span className={`chip ${item.open ? 'active' : ''}`} key={item.port}>
                    {item.port} {item.open ? 'open' : 'closed'}
                  </span>
                ))}
              </div>
              <pre className="network-raw">{pingResult.icmp || 'No ICMP output.'}</pre>
            </>
          ) : (
            <div className="network-placeholder">Enter a domain or IP, then run ping.</div>
          )}
        </ToolCard>

        <ToolCard
          icon="bi-diagram-3"
          title="DNS lookup"
          hint="Live A, AAAA, CNAME, MX, TXT, NS from public DNS."
          placeholder="hostname"
          value={dnsHost}
          onChange={setDnsHost}
          actionLabel="Lookup"
          busyLabel="Looking up…"
          busy={dnsBusy}
          onRun={runDns}
        >
          {dnsBusy ? (
            <div className="network-placeholder">Resolving {dnsHost}…</div>
          ) : dnsResult ? (
            <div className="network-dns">
              {(['A', 'AAAA', 'CNAME', 'NS', 'TXT'] as const).map((key) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>{dnsResult[key].length ? dnsResult[key].join(', ') : '—'}</strong>
                </div>
              ))}
              <div>
                <span>MX</span>
                <strong>
                  {dnsResult.MX.length
                    ? dnsResult.MX.map((item) => `${item.exchange} (${item.priority})`).join(', ')
                    : '—'}
                </strong>
              </div>
            </div>
          ) : (
            <div className="network-placeholder">Enter a hostname to look up DNS records.</div>
          )}
        </ToolCard>

        <ToolCard
          icon="bi-shield-check"
          title="SSL checker"
          hint="Live TLS handshake — issuer, validity, SAN."
          placeholder="hostname"
          value={sslHost}
          onChange={setSslHost}
          actionLabel="Check"
          busyLabel="Checking…"
          busy={sslBusy}
          onRun={runSsl}
        >
          {sslBusy ? (
            <div className="network-placeholder">Checking certificate for {sslHost}…</div>
          ) : sslResult ? (
            <div className="network-ssl">
              <div>
                <span>SUBJECT</span>
                <strong>{sslResult.subject}</strong>
              </div>
              <div>
                <span>ISSUER</span>
                <strong>{sslResult.issuer}</strong>
              </div>
              <div>
                <span>VALID</span>
                <strong>
                  {new Date(sslResult.validFrom).toLocaleDateString()} — {new Date(sslResult.validTo).toLocaleDateString()} ({sslResult.daysRemaining} days)
                </strong>
              </div>
              <div>
                <span>SAN</span>
                <strong>{sslResult.sans.length ? sslResult.sans.join(', ') : '—'}</strong>
              </div>
            </div>
          ) : (
            <div className="network-placeholder">Enter a hostname to inspect the TLS certificate.</div>
          )}
        </ToolCard>
      </div>
    </div>
  )
}
