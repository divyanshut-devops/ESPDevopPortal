'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import {
  deleteStudioRequest,
  listStudioRequests,
  saveStudioRequest,
  sendStudioRequest,
  type StudioSavedRequest,
  type StudioSendResult,
} from '../api/studio'
import { useApp } from '../context/AppContext'
import { usePaged } from '../hooks/usePaged'
import type { HttpMethod, KeyValuePair } from '../types'
import { uid } from '../utils'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const HISTORY_KEY = 'esp-api-testing-history'
const SAVED_KEY = 'esp-api-testing-saved'

interface DraftRequest {
  id?: string
  name: string
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  body: string
  useSession: boolean
  bearer?: string
}

const emptyRow = (): KeyValuePair => ({ key: '', value: '', enabled: true })

function blankDraft(): DraftRequest {
  return {
    name: 'Untitled',
    method: 'GET',
    url: '/api/auth/me',
    headers: [emptyRow()],
    queryParams: [emptyRow()],
    body: '',
    useSession: true,
    bearer: '',
  }
}

function parseCurl(source: string): Partial<DraftRequest> {
  const text = source.trim()
  const next: Partial<DraftRequest> = { headers: [], queryParams: [emptyRow()], body: '' }
  const methodMatch = text.match(/-X\s+([A-Z]+)/i)
  if (methodMatch && METHODS.includes(methodMatch[1].toUpperCase() as HttpMethod)) {
    next.method = methodMatch[1].toUpperCase() as HttpMethod
  }
  const urlMatch = text.match(
    /curl[^\s]*\s+(?:-X\s+[A-Z]+\s+)?'([^']+)'|curl[^\s]*\s+(?:-X\s+[A-Z]+\s+)?"([^"]+)"|curl[^\s]*\s+(?:-X\s+[A-Z]+\s+)?(\S+)/i,
  )
  const url = urlMatch?.[1] || urlMatch?.[2] || urlMatch?.[3]
  if (url && url !== 'curl') next.url = url.replace(/\\$/, '')
  const headerMatches = [...text.matchAll(/-H\s+'([^']+)'|-H\s+"([^"]+)"/g)]
  next.headers = headerMatches.map((match) => {
    const line = match[1] || match[2] || ''
    const idx = line.indexOf(':')
    return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim(), enabled: true }
  })
  if (!next.headers?.length) next.headers = [emptyRow()]
  const dataMatch = text.match(/--data-raw\s+'([\s\S]*)'|--data\s+'([\s\S]*)'|-d\s+'([\s\S]*)'/)
  if (dataMatch) next.body = dataMatch[1] || dataMatch[2] || dataMatch[3] || ''
  return next
}

function toCurl(draft: DraftRequest) {
  try {
    const enabledQuery = draft.queryParams.filter((item) => item.enabled && item.key)
    const url = new URL(draft.url.startsWith('/') ? `https://example.local${draft.url}` : draft.url)
    enabledQuery.forEach((item) => url.searchParams.set(item.key, item.value))
    const path = draft.url.startsWith('/') ? `${draft.url.split('?')[0]}${url.search}` : url.toString()
    const parts = [`curl -X ${draft.method} '${path}'`]
    draft.headers
      .filter((item) => item.enabled && item.key)
      .forEach((item) => parts.push(`-H '${item.key}: ${item.value}'`))
    if (draft.bearer?.trim()) parts.push(`-H 'Authorization: Bearer ${draft.bearer.trim()}'`)
    if (draft.body && draft.method !== 'GET') parts.push(`--data-raw '${draft.body.replace(/'/g, "'\\''")}'`)
    return parts.join(' \\\n  ')
  } catch {
    return `curl -X ${draft.method} '${draft.url}'`
  }
}

function pretty(value: string) {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function statusTone(status?: number) {
  if (!status) return ''
  if (status >= 200 && status < 300) return 'ok'
  if (status >= 400) return 'bad'
  return 'warn'
}

function PairTable({
  pairs,
  onChange,
}: {
  pairs: KeyValuePair[]
  onChange: (pairs: KeyValuePair[]) => void
}) {
  const rows = pairs.length ? pairs : [emptyRow()]
  return (
    <div className="api-kv-table">
      <div className="api-kv api-kv-head">
        <span />
        <span>Name</span>
        <span>Value</span>
        <span />
      </div>
      {rows.map((pair, index) => (
        <div className="api-kv" key={`kv-${index}`}>
          <input
            className="form-check-input"
            type="checkbox"
            checked={pair.enabled}
            onChange={(event) =>
              onChange(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, enabled: event.target.checked } : item)))
            }
          />
          <input
            className="api-input"
            placeholder="name"
            value={pair.key}
            onChange={(event) => {
              const next = rows.map((item, itemIndex) => (itemIndex === index ? { ...item, key: event.target.value } : item))
              if (index === rows.length - 1 && event.target.value) next.push(emptyRow())
              onChange(next)
            }}
          />
          <input
            className="api-input"
            placeholder="value"
            value={pair.value}
            onChange={(event) =>
              onChange(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))
            }
          />
          <button
            type="button"
            className="icon-btn-ghost"
            aria-label="Remove row"
            onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
          >
            <i className="bi bi-x" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ApiTesting() {
  const { pushToast, can } = useApp()
  const allowed = can('postman.use')
  const [draft, setDraft] = useState<DraftRequest>(blankDraft)
  const [saved, setSaved] = useState<StudioSavedRequest[]>([])
  const [history, setHistory] = useState<DraftRequest[]>([])
  const [reqTab, setReqTab] = useState<'params' | 'headers' | 'auth' | 'body'>('params')
  const [resTab, setResTab] = useState<'body' | 'headers' | 'curl'>('body')
  const [response, setResponse] = useState<StudioSendResult | null>(null)
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [listTab, setListTab] = useState<'saved' | 'history'>('saved')
  const [importOpen, setImportOpen] = useState(false)
  const [curlText, setCurlText] = useState('')
  const savedPaged = usePaged(saved, 8)
  const historyPaged = usePaged(history, 8)
  const listPaged = listTab === 'saved' ? savedPaged : historyPaged

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as DraftRequest[]
      if (Array.isArray(stored)) setHistory(stored)
    } catch {
      /* ignore */
    }
    try {
      const stored = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as StudioSavedRequest[]
      if (Array.isArray(stored) && stored.length) setSaved(stored)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void listStudioRequests()
      .then((data) => {
        if (data.requests?.length) {
          setSaved(data.requests)
          localStorage.setItem(SAVED_KEY, JSON.stringify(data.requests))
        }
      })
      .catch(() => undefined)
  }, [])

  const prettyBody = useMemo(() => pretty(response?.body || ''), [response])

  const applySaved = (item: StudioSavedRequest | DraftRequest) => {
    const mongoId = item.id && /^[a-f0-9]{24}$/i.test(item.id) ? item.id : undefined
    setDraft({
      id: mongoId,
      name: item.name,
      method: item.method,
      url: item.url,
      headers: item.headers?.length ? item.headers : [emptyRow()],
      queryParams: item.queryParams?.length ? item.queryParams : [emptyRow()],
      body: item.body || '',
      useSession: item.useSession !== false,
      bearer: 'bearer' in item ? item.bearer || '' : '',
    })
    setResponse(null)
    setSendError('')
    setResTab('body')
  }

  const saveCurrent = async () => {
    try {
      const data = await saveStudioRequest({
        id: draft.id,
        name: draft.name.trim() || 'Untitled',
        method: draft.method,
        url: draft.url,
        headers: draft.headers,
        queryParams: draft.queryParams,
        body: draft.body,
        useSession: draft.useSession,
      })
      setDraft((current) => ({ ...current, id: data.request.id, name: data.request.name }))
      let list: StudioSavedRequest[]
      try {
        list = (await listStudioRequests()).requests
      } catch {
        list = [data.request, ...saved.filter((item) => item.id !== data.request.id)]
      }
      setSaved(list)
      localStorage.setItem(SAVED_KEY, JSON.stringify(list))
      setListTab('saved')
      savedPaged.setPage(1)
      pushToast('Request saved')
    } catch (error) {
      const fallback: StudioSavedRequest = {
        id: draft.id || uid(),
        name: draft.name.trim() || 'Untitled',
        method: draft.method,
        url: draft.url,
        headers: draft.headers,
        queryParams: draft.queryParams,
        body: draft.body,
        useSession: draft.useSession,
      }
      const list = [fallback, ...saved.filter((item) => item.id !== fallback.id)]
      setDraft((current) => ({ ...current, id: fallback.id, name: fallback.name }))
      setSaved(list)
      localStorage.setItem(SAVED_KEY, JSON.stringify(list))
      setListTab('saved')
      pushToast('Saved locally')
    }
  }

  const send = async () => {
    if (!draft.url.trim()) {
      pushToast('Enter a URL', 'warning')
      return
    }
    setSending(true)
    setSendError('')
    setResTab('body')
    try {
      const headers: Record<string, string> = {}
      draft.headers
        .filter((item) => item.enabled && item.key)
        .forEach((item) => {
          headers[item.key] = item.value
        })
      if (draft.bearer?.trim()) headers.Authorization = `Bearer ${draft.bearer.trim()}`
      if (
        draft.body &&
        draft.method !== 'GET' &&
        !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
      ) {
        headers['Content-Type'] = 'application/json'
      }
      const query = draft.queryParams.filter((item) => item.enabled && item.key)
      let url = draft.url.trim()
      if (query.length) {
        const params = new URLSearchParams()
        query.forEach((item) => params.set(item.key, item.value))
        url += (url.includes('?') ? '&' : '?') + params.toString()
      }
      const result = await sendStudioRequest({
        method: draft.method,
        url,
        headers,
        body: draft.body,
        useSession: draft.useSession,
      })
      setResponse(result)
      const nextHistory = [{ ...draft, id: uid() }, ...history].slice(0, 30)
      setHistory(nextHistory)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed'
      setSendError(message)
      setResponse(null)
      pushToast(message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="api-page">
      <div className="api-hero">
        <div>
          <h2>API Studio</h2>
          <p>Send HTTP requests, inspect responses, and save calls for later.</p>
        </div>
      </div>

      <div className="api-shell">
        <aside className="api-side">
          <input
            className="api-input"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Request name"
          />
          <div className="api-side-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => applySaved(blankDraft())}>
              New
            </button>
            <button type="button" className="btn btn-accent btn-sm" disabled={!allowed} onClick={() => void saveCurrent()}>
              Save
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>
              Import
            </button>
          </div>
          <div className="api-tabs compact">
            <button type="button" className={listTab === 'saved' ? 'active' : ''} onClick={() => setListTab('saved')}>
              Saved
            </button>
            <button type="button" className={listTab === 'history' ? 'active' : ''} onClick={() => setListTab('history')}>
              History
            </button>
          </div>
          <div className="api-list">
            {listPaged.totalItems === 0 ? (
              <p className="api-muted">{listTab === 'saved' ? 'No saved requests yet.' : 'No history yet.'}</p>
            ) : (
              listPaged.rows.map((item) => (
                <button type="button" key={item.id} className="api-list-item" onClick={() => applySaved(item)}>
                  <span className={`method-badge method-${item.method}`}>{item.method}</span>
                  <strong>{item.name}</strong>
                  {listTab === 'saved' && item.id ? (
                    <i
                      className="bi bi-trash"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        void deleteStudioRequest(item.id as string)
                          .then(() => setSaved((current) => current.filter((entry) => entry.id !== item.id)))
                          .catch((error) => pushToast(error instanceof Error ? error.message : 'Unable to delete', 'error'))
                      }}
                    />
                  ) : null}
                </button>
              ))
            )}
          </div>
          <Pagination
            compact
            page={listPaged.page}
            totalPages={listPaged.totalPages}
            totalItems={listPaged.totalItems}
            pageSize={listPaged.pageSize}
            onPageChange={listPaged.setPage}
          />
        </aside>

        <section className="api-main">
          <div className="api-urlbar">
            <select
              className={`api-method method-${draft.method}`}
              value={draft.method}
              onChange={(event) => setDraft({ ...draft, method: event.target.value as HttpMethod })}
            >
              {METHODS.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
            <input
              className="api-url"
              value={draft.url}
              placeholder="https:// or /api/..."
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void send()
              }}
            />
            <button type="button" className="btn btn-accent api-send" disabled={sending || !allowed} onClick={() => void send()}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>

          <div className="api-pane">
            <div className="api-tabs">
              {(['params', 'headers', 'auth', 'body'] as const).map((item) => (
                <button key={item} type="button" className={reqTab === item ? 'active' : ''} onClick={() => setReqTab(item)}>
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
            <div className="api-pane-body">
              {reqTab === 'params' ? (
                <PairTable pairs={draft.queryParams} onChange={(queryParams) => setDraft({ ...draft, queryParams })} />
              ) : null}
              {reqTab === 'headers' ? (
                <PairTable pairs={draft.headers} onChange={(headers) => setDraft({ ...draft, headers })} />
              ) : null}
              {reqTab === 'auth' ? (
                <div className="api-auth">
                  <label className="api-check">
                    <input
                      type="checkbox"
                      checked={draft.useSession}
                      onChange={(event) => setDraft({ ...draft, useSession: event.target.checked })}
                    />
                    Use portal session for /api/*
                  </label>
                  <label className="form-label">Bearer token</label>
                  <input
                    className="api-input"
                    placeholder="Optional token"
                    value={draft.bearer || ''}
                    onChange={(event) => setDraft({ ...draft, bearer: event.target.value })}
                  />
                </div>
              ) : null}
              {reqTab === 'body' ? (
                <textarea
                  className="api-body"
                  placeholder="{ }"
                  value={draft.body}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                />
              ) : null}
            </div>
          </div>

          <div className="api-pane api-response">
            <div className="api-tabs">
              <button type="button" className={resTab === 'body' ? 'active' : ''} onClick={() => setResTab('body')}>
                Response
              </button>
              <button type="button" className={resTab === 'headers' ? 'active' : ''} onClick={() => setResTab('headers')}>
                Headers
              </button>
              <button type="button" className={resTab === 'curl' ? 'active' : ''} onClick={() => setResTab('curl')}>
                cURL
              </button>
              {response ? (
                <span className={`api-status ${statusTone(response.status)}`}>
                  {response.status} · {response.timeMs} ms
                </span>
              ) : null}
              {resTab === 'curl' ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm ms-auto"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(toCurl(draft))
                      pushToast('cURL copied')
                    } catch {
                      pushToast('Unable to copy cURL', 'warning')
                    }
                  }}
                >
                  Copy
                </button>
              ) : null}
            </div>
            <div className="api-pane-body">
              {sendError ? <div className="api-error">{sendError}</div> : null}
              {resTab === 'curl' ? (
                <pre className="api-code">{toCurl(draft)}</pre>
              ) : !response ? (
                <div className="api-empty">Enter a URL and press Send. Portal paths like /api/auth/me work with session auth.</div>
              ) : resTab === 'headers' ? (
                <pre className="api-code">{JSON.stringify(response.headers, null, 2)}</pre>
              ) : (
                <pre className="api-code">{prettyBody || '(empty body)'}</pre>
              )}
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={importOpen}
        title="Import cURL"
        onClose={() => setImportOpen(false)}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-purple"
              onClick={() => {
                const parsed = parseCurl(curlText)
                setDraft((current) => ({ ...current, ...parsed, headers: parsed.headers || current.headers }))
                setImportOpen(false)
                setCurlText('')
                pushToast('cURL imported')
              }}
            >
              Import
            </button>
          </>
        }
      >
        <textarea
          className="form-control font-monospace"
          rows={8}
          placeholder="Paste a curl command"
          value={curlText}
          onChange={(event) => setCurlText(event.target.value)}
        />
      </Modal>
    </div>
  )
}
