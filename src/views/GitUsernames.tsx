'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createGitUser,
  deleteGitUser,
  fetchGitUsers,
  updateGitUser,
  type GitUserInput,
  type GitUserRecord,
} from '../api/gitUsers'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { useApp } from '../context/AppContext'

const emptyForm: GitUserInput = {
  companyUser: '',
  username: '',
  remark: 'Active',
}

export function GitUsernames() {
  const { can, profile, pushToast } = useApp()
  const canEdit = can('git.view') && profile.role !== 'Viewer'
  const [users, setUsers] = useState<GitUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [form, setForm] = useState<GitUserInput>(emptyForm)
  const [active, setActive] = useState<GitUserRecord | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchGitUsers()
      .then((data) => {
        if (!cancelled) setUsers(data.users)
      })
      .catch((error: Error) => {
        if (!cancelled) pushToast(error.message, 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pushToast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) =>
      [user.companyUser, user.username, user.remark].join(' ').toLowerCase().includes(q),
    )
  }, [users, query])

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

  const openEdit = (user: GitUserRecord) => {
    setActive(user)
    setForm({
      companyUser: user.companyUser,
      username: user.username,
      remark: user.remark,
    })
    setMode('edit')
  }

  const setField = (key: keyof GitUserInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const save = async () => {
    if (!form.companyUser.trim() || !form.username.trim()) {
      pushToast('Company user and username are required', 'warning')
      return
    }
    setSaving(true)
    try {
      const payload = {
        companyUser: form.companyUser.trim(),
        username: form.username.trim(),
        remark: form.remark.trim(),
      }
      if (mode === 'edit' && active) {
        const data = await updateGitUser(active.id, payload)
        setUsers((items) => items.map((item) => (item.id === active.id ? data.user : item)))
        pushToast('Git user updated')
      } else {
        const data = await createGitUser(payload)
        setUsers((items) => [...items, data.user])
        pushToast('Git user added')
      }
      close()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to save git user', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!active) return
    setSaving(true)
    try {
      await deleteGitUser(active.id)
      setUsers((items) => items.filter((item) => item.id !== active.id))
      pushToast('Git user deleted')
      close()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to delete git user', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h2 className="page-title mb-1">ESP Git Username</h2>
          <p className="text-muted mb-0">Company Git users. Add, edit, and delete them in this table.</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn-accent" onClick={openCreate}>
            + Add user
          </button>
        ) : null}
      </div>

      <input
        className="form-control"
        placeholder="Search company user, username, remark..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {loading ? (
        <p className="text-muted mb-0">Loading git users…</p>
      ) : (
        <DataTable
          data={filtered}
          rowKey={(row) => row.id}
          emptyTitle={users.length === 0 ? 'No git users yet' : 'No git users match this search'}
          emptyDescription={users.length === 0 ? 'Add a company Git user to start the list.' : 'Try a different search.'}
          columns={[
            { key: 'companyUser', label: 'ESP Company User', sortable: true },
            { key: 'username', label: 'Username', sortable: true },
            { key: 'remark', label: 'Remark', sortable: true },
          ]}
          actions={
            canEdit
              ? (row) => (
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setActive(row)
                        setMode('delete')
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )
              : undefined
          }
        />
      )}

      <Modal
        open={mode === 'create' || mode === 'edit'}
        title={mode === 'edit' ? 'Edit git user' : 'Add git user'}
        onClose={close}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-accent" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label">ESP Company User</label>
            <input className="form-control" value={form.companyUser} onChange={(event) => setField('companyUser', event.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label">Username</label>
            <input className="form-control" value={form.username} onChange={(event) => setField('username', event.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label">Remark</label>
            <input className="form-control" value={form.remark} onChange={(event) => setField('remark', event.target.value)} />
          </div>
        </div>
      </Modal>

      <Modal
        open={mode === 'delete'}
        title="Delete git user"
        onClose={close}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-accent" onClick={() => void remove()} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="mb-0">
          Delete {active?.companyUser || 'this user'} ({active?.username})? This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
