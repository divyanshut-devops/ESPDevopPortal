'use client'

import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { useApp } from '../context/AppContext'
import { usePaged } from '../hooks/usePaged'
import type { SecretVariable } from '../types'
import { maskSecret } from '../utils'

const emptyForm = { name: '', value: '' }

function parseEnvFile(text: string) {
  const items: { name: string; value: string }[] = []
  const seen = new Set<string>()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const body = line.startsWith('export ') ? line.slice(7).trim() : line
    const eq = body.indexOf('=')
    if (eq <= 0) continue
    const name = body.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || seen.has(name)) continue
    let value = body.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    seen.add(name)
    items.push({ name, value })
  }
  return items
}

export function SecretsEnv() {
  const { secrets, addSecret, updateSecret, deleteSecret, pushToast, can, preferences } = useApp()
  const canManage = can('secrets.manage')
  const [query, setQuery] = useState('')
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [mode, setMode] = useState<'create' | 'edit' | 'import' | 'delete' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [importText, setImportText] = useState('')
  const [active, setActive] = useState<SecretVariable | null>(null)
  const [saving, setSaving] = useState(false)
  const imported = useMemo(() => parseEnvFile(importText), [importText])

  const filtered = useMemo(
    () => secrets.filter((secret) => secret.key.toLowerCase().includes(query.toLowerCase())),
    [query, secrets],
  )
  const paged = usePaged(filtered, preferences.itemsPerPage)

  const close = () => {
    setMode(null)
    setActive(null)
    setForm(emptyForm)
    setImportText('')
  }

  const openCreate = () => {
    setActive(null)
    setForm(emptyForm)
    setImportText('')
    setMode('create')
  }

  const openImport = (text = '') => {
    setActive(null)
    setForm(emptyForm)
    setImportText(text)
    setMode('import')
  }

  const save = async () => {
    if (!form.name.trim()) {
      pushToast('Name is required', 'warning')
      return
    }
    if (!form.value.trim()) {
      pushToast('Value is required', 'warning')
      return
    }
    setSaving(true)
    try {
      if (mode === 'edit' && active) {
        await updateSecret({ ...active, key: form.name.trim(), value: form.value })
        pushToast('Secret updated')
      } else {
        await addSecret({
          key: form.name.trim(),
          value: form.value,
          environment: 'dev',
          remark: '',
        })
        pushToast('Secret encrypted and saved')
      }
      close()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to save secret', 'error')
    } finally {
      setSaving(false)
    }
  }

  const importEnv = async () => {
    if (imported.length === 0) {
      pushToast('Paste a .env file with NAME=value lines', 'warning')
      return
    }
    setSaving(true)
    try {
      for (const item of imported) {
        const existing = secrets.find((secret) => secret.key === item.name)
        if (existing) {
          await updateSecret({ ...existing, key: item.name, value: item.value })
        } else {
          await addSecret({ key: item.name, value: item.value, environment: 'dev', remark: '' })
        }
      }
      pushToast(imported.length === 1 ? '1 secret imported' : `${imported.length} secrets imported`)
      close()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to import secrets', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="secrets-page">
      <div className="secrets-hero">
        <div>
          <h2 className="secrets-title">Secrets</h2>
          <p className="secrets-copy mb-0">
            Values are encrypted before they reach the database. Only you can reveal or copy them after login.
          </p>
        </div>
        {canManage ? (
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => openImport()}>
              Import .env
            </button>
            <button type="button" className="btn btn-secret" onClick={openCreate}>
              + Add secret
            </button>
          </div>
        ) : null}
      </div>

      <div className="secret-banner">
        <i className="bi bi-lock-fill" />
        Encrypted at rest. Reveal and copy stay on this session only.
      </div>

      <div className="secrets-toolbar">
        <input
          className="form-control secret-search"
          placeholder="Search secrets..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="secret-empty">
          {secrets.length === 0 ? (
            <>
              <p className="mb-3">No secrets yet. Add a name and value, or import a .env file.</p>
              {canManage ? (
                <div className="d-flex flex-wrap justify-content-center gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => openImport()}>
                    Import .env
                  </button>
                  <button type="button" className="btn btn-secret" onClick={openCreate}>
                    + Add secret
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mb-0">No secrets match this search.</p>
          )}
        </div>
      ) : (
        <div className="secret-list">
          <div className="secret-grid">
            {paged.rows.map((secret) => {
              const open = Boolean(revealed[secret.id])
              return (
                <article className={`secret-card ${open ? 'is-open' : ''}`} key={secret.id}>
                  <div className="secret-card-head">
                    <span className="secret-card-icon">
                      <i className="bi bi-shield-lock-fill" />
                    </span>
                    <div className="secret-card-titles">
                      <div className="secret-card-name-row">
                        <h3 title={secret.key}>{secret.key}</h3>
                      </div>
                      <p>Encrypted secret</p>
                    </div>
                  </div>
                  <div className="secret-value-well">
                    <code>{open ? secret.value : maskSecret(secret.value)}</code>
                  </div>
                  <div className="secret-card-actions">
                    <button
                      type="button"
                      className="secret-action"
                      onClick={() => setRevealed((current) => ({ ...current, [secret.id]: !current[secret.id] }))}
                    >
                      <i className={`bi ${open ? 'bi-eye-slash' : 'bi-eye'}`} />
                      {open ? 'Hide' : 'Reveal'}
                    </button>
                    <button
                      type="button"
                      className="secret-action"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(secret.value)
                          pushToast('Value copied')
                        } catch {
                          pushToast('Unable to copy', 'warning')
                        }
                      }}
                    >
                      <i className="bi bi-clipboard" />
                      Copy
                    </button>
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="secret-action"
                          onClick={() => {
                            setActive(secret)
                            setForm({ name: secret.key, value: secret.value })
                            setMode('edit')
                          }}
                        >
                          <i className="bi bi-pencil" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="secret-action danger"
                          onClick={() => {
                            setActive(secret)
                            setMode('delete')
                          }}
                        >
                          <i className="bi bi-trash" />
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
          <Pagination
            compact
            page={paged.page}
            totalPages={paged.totalPages}
            totalItems={paged.totalItems}
            pageSize={paged.pageSize}
            onPageChange={paged.setPage}
          />
        </div>
      )}

      <Modal
        open={mode === 'create' || mode === 'edit'}
        title={mode === 'edit' ? 'Edit secret' : 'Add secret'}
        onClose={close}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={close}>
              Cancel
            </button>
            <button className="btn btn-secret" type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <label className="form-label">Name</label>
        <input
          className="form-control mb-3"
          placeholder="DATABASE_URL"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text')
            if (parseEnvFile(text).length > 1) {
              event.preventDefault()
              openImport(text)
            }
          }}
        />
        <label className="form-label">Value</label>
        <textarea
          className="form-control secret-value"
          rows={5}
          placeholder="Paste the value"
          value={form.value}
          onChange={(event) => setForm({ ...form, value: event.target.value })}
        />
        {mode === 'create' ? (
          <button type="button" className="btn btn-link px-0 mt-2" onClick={() => openImport()}>
            Paste or import a .env file
          </button>
        ) : null}
      </Modal>

      <Modal
        open={mode === 'import'}
        title="Import .env"
        onClose={close}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-secret" type="button" disabled={saving || imported.length === 0} onClick={() => void importEnv()}>
              {saving ? 'Importing…' : `Import ${imported.length || ''}`.trim()}
            </button>
          </>
        }
      >
        <label className="form-label">Paste .env contents</label>
        <textarea
          className="form-control secret-value mb-3"
          rows={8}
          placeholder={'DATABASE_URL=postgres://...\nJWT_SECRET=...\nAPI_KEY=...'}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
        />
        <label className="form-label">Or choose a file</label>
        <input
          className="form-control"
          type="file"
          accept=".env,.txt,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            void file.text().then(setImportText)
          }}
        />
        {imported.length > 0 ? (
          <ul className="list-unstyled mt-3 mb-0">
            {imported.map((item) => (
              <li key={item.name} className="d-flex justify-content-between gap-3 py-1">
                <code>{item.name}</code>
                <span className="text-muted text-truncate">{maskSecret(item.value)}</span>
              </li>
            ))}
          </ul>
        ) : importText.trim() ? (
          <p className="text-muted mt-3 mb-0">No NAME=value lines found.</p>
        ) : null}
      </Modal>

      <Modal
        open={mode === 'delete'}
        title="Delete secret"
        onClose={close}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={close}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => {
                if (!active) return
                void deleteSecret(active.id)
                  .then(() => {
                    pushToast('Secret deleted', 'info')
                    close()
                  })
                  .catch((error) => {
                    pushToast(error instanceof Error ? error.message : 'Unable to delete secret', 'error')
                  })
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="mb-0">Remove this secret from the encrypted vault?</p>
      </Modal>
    </div>
  )
}
