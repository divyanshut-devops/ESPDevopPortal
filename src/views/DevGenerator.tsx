'use client'

import { useEffect, useState } from 'react'
import { deleteGeneratedItem, fetchGeneratorHistory, generateArtifact, generatorStatus, type GeneratedItem } from '../api/generator'
import { saveDriveText } from '../api/drive'
import { Pagination } from '../components/Pagination'
import { useApp } from '../context/AppContext'
import { usePaged } from '../hooks/usePaged'

const KINDS = [
  { id: 'bash', label: 'Bash' },
  { id: 'command', label: 'Commands' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'compose', label: 'Compose' },
  { id: 'kubernetes', label: 'Kubernetes' },
  { id: 'helm', label: 'Helm' },
  { id: 'github', label: 'GitHub Action' },
  { id: 'terraform', label: 'Terraform' },
  { id: 'nginx', label: 'Nginx' },
  { id: 'makefile', label: 'Makefile' },
  { id: 'python', label: 'Python' },
  { id: 'node', label: 'Node' },
  { id: 'powershell', label: 'PowerShell' },
]

export function DevGenerator() {
  const { can, pushToast, preferences } = useApp()
  const allowed = can('generator.use')
  const [kind, setKind] = useState('dockerfile')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [configured, setConfigured] = useState(true)
  const [freeMode, setFreeMode] = useState(true)
  const [current, setCurrent] = useState<GeneratedItem | null>(null)
  const [history, setHistory] = useState<GeneratedItem[]>([])
  const paged = usePaged(history, Math.min(preferences.itemsPerPage, 8))

  useEffect(() => {
    if (!allowed) return undefined
    let cancelled = false
    void generatorStatus()
      .then((data) => {
        if (!cancelled) {
          setConfigured(data.configured)
          setFreeMode(data.free !== false)
        }
      })
      .catch(() => {
        if (!cancelled) setConfigured(false)
      })
    void fetchGeneratorHistory()
      .then((data) => {
        if (!cancelled) setHistory(data.items)
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
    return () => {
      cancelled = true
    }
  }, [allowed])

  const generate = async () => {
    if (!prompt.trim()) {
      pushToast('Describe what you need', 'warning')
      return
    }
    setBusy(true)
    try {
      const data = await generateArtifact({ kind, prompt: prompt.trim() })
      setCurrent(data.item)
      setHistory((items) => [data.item, ...items.filter((item) => item.id !== data.item.id)])
      paged.setPage(1)
      pushToast('Generated')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to generate', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!allowed) {
    return (
      <div className="gen-page">
        <div className="gen-hero">
          <h2>Dev Generators</h2>
          <p>You do not have permission to generate files.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="gen-page">
      <div className="gen-hero">
        <div>
          <h2>Dev Generators</h2>
          <p>Describe a file, pick a type, and generate it with OpenRouter.</p>
        </div>
        {configured && freeMode ? <span className="gen-pill">Free models</span> : null}
        {!configured ? <span className="gen-pill warn">Add OPENROUTER_API_KEY</span> : null}
      </div>

      <div className="gen-shell">
        <aside className="gen-side">
          <div className="gen-kinds">
            {KINDS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`gen-kind ${kind === item.id ? 'active' : ''}`}
                onClick={() => setKind(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="gen-history-label">Recent</div>
          <div className="gen-history">
            {history.length === 0 ? (
              <p className="gen-muted">No generations yet.</p>
            ) : (
              paged.rows.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`gen-history-item ${current?.id === item.id ? 'active' : ''}`}
                  onClick={() => setCurrent(item)}
                >
                  <strong>{item.filename}</strong>
                  <span>{item.kind}</span>
                  <i
                    className="bi bi-trash"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation()
                      void deleteGeneratedItem(item.id)
                        .then(() => {
                          setHistory((items) => items.filter((entry) => entry.id !== item.id))
                          if (current?.id === item.id) setCurrent(null)
                        })
                        .catch((error) => pushToast(error instanceof Error ? error.message : 'Unable to delete', 'error'))
                    }}
                  />
                </button>
              ))
            )}
          </div>
          <Pagination
            compact
            page={paged.page}
            totalPages={paged.totalPages}
            totalItems={paged.totalItems}
            pageSize={paged.pageSize}
            onPageChange={paged.setPage}
          />
        </aside>

        <section className="gen-main">
          <textarea
            className="form-control gen-prompt"
            placeholder="Example: Node 20 API on port 8080, health check, non-root user, multi-stage Dockerfile"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="gen-actions">
            <button type="button" className="btn btn-purple" disabled={busy} onClick={() => void generate()}>
              {busy ? 'Generating…' : 'Generate'}
            </button>
            {current ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(current.content)
                      pushToast('Copied')
                    } catch {
                      pushToast('Unable to copy', 'warning')
                    }
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    const blob = new Blob([current.content], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = current.filename
                    link.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  Download
                </button>
                {can('drive.manage') ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      void saveDriveText({ filename: current.filename, content: current.content })
                        .then(() => pushToast('Saved to Personal Drive'))
                        .catch((error) => pushToast(error instanceof Error ? error.message : 'Unable to save to Drive', 'error'))
                    }}
                  >
                    Save to Drive
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
          {current ? (
            <>
              <div className="gen-filemeta">
                <strong>{current.filename}</strong>
                {current.notes ? <span>{current.notes}</span> : null}
              </div>
              <pre className="gen-output">{current.content}</pre>
            </>
          ) : (
            <div className="gen-empty">Pick a type, describe the file, then generate.</div>
          )}
        </section>
      </div>
    </div>
  )
}
