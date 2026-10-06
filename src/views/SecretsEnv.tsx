'use client'

import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { useApp } from '../context/AppContext'
import { usePaged } from '../hooks/usePaged'
import type { SecretVariable } from '../types'
import { maskSecret } from '../utils'

const emptyForm = { name: '', value: '' }

export function SecretsEnv() {
  const { secrets, addSecret, updateSecret, deleteSecret, pushToast, can, preferences } = useApp()
  const canManage = can('secrets.manage')
  const [query, setQuery] = useState('')
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [mode, setMode] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [active, setActive] = useState<SecretVariable | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(
    () => secrets.filter((secret) => secret.key.toLowerCase().includes(query.toLowerCase())),
    [query, secrets],
  )
  const paged = usePaged(filtered, preferences.itemsPerPage)

  const close = () => {
    setMode(null)
    setActive(null)
    setForm(emptyForm)
  }

  const openCreate = () => {
    setActive(null)
    setForm(emptyForm)
    setMode('create')
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
          description: '',
          environment: 'Production',
          projectId: '',
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
          <button type="button" className="btn btn-secret" onClick={openCreate}>
            + Add secret
          </button>
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
              <p className="mb-3">No secrets yet. Add one to store it in the encrypted vault.</p>
              {canManage ? (
                <button type="button" className="btn btn-secret" onClick={openCreate}>
                  + Add secret
                </button>
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
                        <span className="secret-env-pill">ENV</span>
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
        size="sm"
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
          className="form-control secret-name"
          placeholder="e.g. Production API key"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <label className="form-label">Value</label>
        <textarea
          className="form-control secret-value"
          rows={4}
          placeholder="Paste or type the secret here..."
          value={form.value}
          onChange={(event) => setForm({ ...form, value: event.target.value })}
        />
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
