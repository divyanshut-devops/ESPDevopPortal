'use client'

import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { useApp } from '../context/AppContext'
import { usePaged } from '../hooks/usePaged'
import type { Shortcut } from '../types'

const ICONS = [
  'bi-link-45deg',
  'bi-github',
  'bi-gitlab',
  'bi-cloud',
  'bi-server',
  'bi-terminal',
  'bi-box',
  'bi-globe',
  'bi-graph-up',
  'bi-shield-lock',
  'bi-kanban',
  'bi-journal-text',
  'bi-envelope',
  'bi-speedometer2',
  'bi-database',
]

const SUGGESTED_CATEGORIES = ['Work', 'Cloud', 'CI/CD', 'Observability', 'Docs']

const emptyShortcut = (): Omit<Shortcut, 'id'> => ({
  name: '',
  description: '',
  category: 'Work',
  url: '',
  icon: 'bi-link-45deg',
})

function hostOf(url: string) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname
  } catch {
    return url
  }
}

export function QuickAccess() {
  const { shortcuts, addShortcut, updateShortcut, deleteShortcut, pushToast, can, preferences } = useApp()
  const canManage = can('shortcuts.manage')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [mode, setMode] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [form, setForm] = useState<Omit<Shortcut, 'id'> | Shortcut>(emptyShortcut())
  const [saving, setSaving] = useState(false)

  const categories = useMemo(
    () => Array.from(new Set(shortcuts.map((item) => item.category).filter(Boolean))),
    [shortcuts],
  )

  const formCategories = useMemo(
    () => Array.from(new Set([...SUGGESTED_CATEGORIES, ...categories])),
    [categories],
  )

  const filtered = useMemo(
    () =>
      shortcuts.filter((item) => {
        const haystack = `${item.name} ${item.description} ${item.category} ${item.url}`.toLowerCase()
        return haystack.includes(query.toLowerCase()) && (!category || item.category === category)
      }),
    [category, query, shortcuts],
  )
  const paged = usePaged(filtered, preferences.itemsPerPage)

  const close = () => {
    setMode(null)
    setForm(emptyShortcut())
  }

  const openCreate = () => {
    setForm(emptyShortcut())
    setMode('create')
  }

  const save = async () => {
    if (!form.name.trim()) {
      pushToast('Name is required', 'warning')
      return
    }
    if (!form.url.trim()) {
      pushToast('URL is required', 'warning')
      return
    }
    setSaving(true)
    try {
      if (mode === 'edit' && 'id' in form) {
        await updateShortcut({ ...form, name: form.name.trim(), url: form.url.trim() })
        pushToast('Shortcut updated')
      } else {
        await addShortcut({ ...form, name: form.name.trim(), url: form.url.trim() })
        pushToast('Shortcut saved')
      }
      close()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to save shortcut', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="quick-page">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
        <div>
          <h2 className="quick-title">Quick Access</h2>
          <p className="quick-copy mb-0">Pin the tools you use. Shortcuts are stored in MongoDB for your account.</p>
        </div>
        {canManage ? (
          <button type="button" className="btn btn-purple" onClick={openCreate}>
            + Add shortcut
          </button>
        ) : null}
      </div>

      <div className="quick-toolbar">
        <input
          className="form-control quick-search"
          placeholder="Search shortcuts..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {categories.length > 0 ? (
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className={`chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>
              All
            </button>
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={`chip ${category === item ? 'active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="quick-empty">
          {shortcuts.length === 0 ? (
            <>
              <p className="mb-3">No shortcuts yet. Add one to pin a tool here.</p>
              {canManage ? (
                <button type="button" className="btn btn-purple" onClick={openCreate}>
                  + Add shortcut
                </button>
              ) : null}
            </>
          ) : (
            <p className="mb-0">No shortcuts match this search.</p>
          )}
        </div>
      ) : (
        <>
          <div className="quick-grid">
            {paged.rows.map((item) => (
              <article className="shortcut-card" key={item.id}>
                <div className="shortcut-card-top">
                  <span className="shortcut-icon">
                    <i className={`bi ${item.icon}`} />
                  </span>
                  <div className="shortcut-copy">
                    <div className="shortcut-card-head">
                      <h3>{item.name}</h3>
                      <span className="shortcut-badge">{item.category}</span>
                    </div>
                    <p>{item.description || hostOf(item.url)}</p>
                  </div>
                </div>
                <div className="shortcut-actions">
                  <a className="btn btn-purple btn-sm" href={item.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                  {canManage ? (
                    <div className="ms-auto d-flex">
                      <button
                        type="button"
                        className="icon-btn-ghost"
                        title="Edit"
                        onClick={() => {
                          setForm(item)
                          setMode('edit')
                        }}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-ghost"
                        title="Delete"
                        onClick={() => {
                          setForm(item)
                          setMode('delete')
                        }}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <Pagination
            compact
            page={paged.page}
            totalPages={paged.totalPages}
            totalItems={paged.totalItems}
            pageSize={paged.pageSize}
            onPageChange={paged.setPage}
          />
        </>
      )}

      <Modal
        open={mode === 'create' || mode === 'edit'}
        title={mode === 'edit' ? 'Edit shortcut' : 'Add shortcut'}
        onClose={close}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={close}>
              Cancel
            </button>
            <button className="btn btn-purple" type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Name</label>
            <input className="form-control" placeholder="GitHub" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Category</label>
            <input className="form-control" list="shortcut-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            <datalist id="shortcut-categories">
              {formCategories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <div className="col-12">
            <label className="form-label">URL</label>
            <input className="form-control" placeholder="github.com/your-org" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
          </div>
          <div className="col-12">
            <label className="form-label">Description</label>
            <input className="form-control" placeholder="Optional" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          <div className="col-12">
            <label className="form-label">Icon</label>
            <div className="icon-picker">
              {ICONS.map((icon) => (
                <button
                  type="button"
                  key={icon}
                  className={`icon-picker-btn ${form.icon === icon ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, icon })}
                  aria-label={icon}
                >
                  <i className={`bi ${icon}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={mode === 'delete'}
        title="Delete shortcut"
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
                if (!('id' in form)) return
                void deleteShortcut(form.id)
                  .then(() => {
                    pushToast('Shortcut deleted', 'info')
                    close()
                  })
                  .catch((error) => pushToast(error instanceof Error ? error.message : 'Unable to delete shortcut', 'error'))
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="mb-0">Remove this shortcut from Quick Access?</p>
      </Modal>
    </div>
  )
}
