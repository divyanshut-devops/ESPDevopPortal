'use client'

import { useEffect, useMemo, useState } from 'react'
import { WORKSPACE_ROLES, type WorkspaceRole } from '../auth/privileges'
import { createInvitation, deleteInvitationApi, fetchInvitations, resendInvitationApi, updateInvitationApi } from '../api/invitations'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { StatusBadge } from '../components/StatusBadge'
import { useApp } from '../context/AppContext'
import { usePaged } from '../hooks/usePaged'
import type { Invitation } from '../types'

const ROLE_HINTS: Record<WorkspaceRole, string> = {
  Viewer: 'Read-only access to dashboard, projects, network, and shortcuts.',
  Developer: 'APIs, secrets view, and shortcuts. No SSH or admin tools.',
  DevOps: 'Infrastructure, secrets, SSH, and project management.',
  Admin: 'Full workspace access, including invitations.',
}

export function InvitationPage() {
  const { can, pushToast, preferences } = useApp()
  const canManage = can('invitations.manage')
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('Viewer')
  const [active, setActive] = useState<Invitation | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canManage) {
      setLoading(false)
      return
    }
    let cancelled = false
    void fetchInvitations()
      .then((data) => {
        if (!cancelled) setInvitations(data.invitations)
      })
      .catch((error) => {
        if (!cancelled) pushToast(error instanceof Error ? error.message : 'Unable to load invitations', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canManage, pushToast])

  const filtered = useMemo(
    () =>
      invitations.filter((item) => {
        const haystack = `${item.email} ${item.role} ${item.status}`.toLowerCase()
        return haystack.includes(query.toLowerCase())
      }),
    [invitations, query],
  )
  const paged = usePaged(filtered, preferences.itemsPerPage)

  const close = () => {
    setMode(null)
    setActive(null)
    setEmail('')
    setRole('Viewer')
  }

  const openCreate = () => {
    setActive(null)
    setEmail('')
    setRole('Viewer')
    setMode('create')
  }

  const save = async () => {
    if (!email.trim()) {
      pushToast('Email is required', 'warning')
      return
    }
    setSaving(true)
    try {
      if (mode === 'edit' && active) {
        const data = await updateInvitationApi(active.id, { role })
        setInvitations((current) => current.map((item) => (item.id === data.invitation.id ? data.invitation : item)))
        pushToast('Permission updated')
      } else {
        const data = await createInvitation({ email: email.trim().toLowerCase(), role })
        setInvitations((current) => {
          const without = current.filter((item) => item.id !== data.invitation.id && item.email !== data.invitation.email)
          return [data.invitation, ...without]
        })
        pushToast('Invitation sent')
      }
      close()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to save invitation', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return (
      <div className="invite-page">
        <h2 className="invite-title">Invitation</h2>
        <div className="invite-empty">Only Admins can invite users and assign permissions.</div>
      </div>
    )
  }

  return (
    <div className="invite-page">
      <div className="invite-hero">
        <div>
          <h2 className="invite-title">Invitation</h2>
          <p className="invite-copy mb-0">Invite a user by email and assign Viewer, Developer, DevOps, or Admin permission.</p>
        </div>
        <button type="button" className="btn btn-purple" onClick={openCreate}>
          + Invite user
        </button>
      </div>

      <div className="invite-toolbar">
        <input
          className="form-control invite-search"
          placeholder="Search invitations..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {loading ? (
        <div className="invite-empty">Loading invitations…</div>
      ) : filtered.length === 0 ? (
        <div className="invite-empty">
          {invitations.length === 0 ? (
            <>
              <p className="mb-3">No invitations yet. Invite someone to join this workspace.</p>
              <button type="button" className="btn btn-purple" onClick={openCreate}>
                + Invite user
              </button>
            </>
          ) : (
            <p className="mb-0">No invitations match this search.</p>
          )}
        </div>
      ) : (
        <div className="invite-list">
          <div className="invite-grid">
            {paged.rows.map((item) => (
              <article className="invite-card" key={item.id}>
                <div className="invite-card-top">
                  <span className="invite-card-icon">
                    <i className="bi bi-envelope" />
                  </span>
                  <div className="invite-card-body">
                    <h3 title={item.email}>{item.email}</h3>
                    <p>
                      {item.role} · invited by {item.invitedBy}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="invite-card-actions">
                  <select
                    className="form-select invite-role-select"
                    value={item.role}
                    onChange={(event) => {
                      const nextRole = event.target.value as WorkspaceRole
                      void updateInvitationApi(item.id, { role: nextRole })
                        .then((data) => {
                          setInvitations((current) =>
                            current.map((entry) => (entry.id === data.invitation.id ? data.invitation : entry)),
                          )
                          pushToast('Permission updated')
                        })
                        .catch((error) =>
                          pushToast(error instanceof Error ? error.message : 'Unable to update permission', 'error'),
                        )
                    }}
                  >
                    {WORKSPACE_ROLES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn-ghost"
                    title="Resend"
                    onClick={() => {
                      void resendInvitationApi(item.id)
                        .then(() => pushToast(`Invitation sent to ${item.email}`))
                        .catch((error) =>
                          pushToast(error instanceof Error ? error.message : 'Unable to resend invitation', 'error'),
                        )
                    }}
                  >
                    <i className="bi bi-send" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn-ghost"
                    title="Revoke"
                    onClick={() => {
                      setActive(item)
                      setMode('delete')
                    }}
                  >
                    <i className="bi bi-trash" />
                  </button>
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
        </div>
      )}

      <Modal
        open={mode === 'create' || mode === 'edit'}
        title={mode === 'edit' ? 'Edit invitation' : 'Invite user'}
        onClose={close}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={close}>
              Cancel
            </button>
            <button className="btn btn-purple" type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Sending…' : mode === 'edit' ? 'Save' : 'Send invite'}
            </button>
          </>
        }
      >
        <label className="form-label">Email</label>
        <input
          className="form-control invite-email"
          type="email"
          placeholder="user@company.com"
          value={email}
          disabled={mode === 'edit'}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="form-label">Permission</label>
        <div className="invite-role-grid">
          {WORKSPACE_ROLES.map((option) => (
            <button
              type="button"
              key={option}
              className={`invite-role-btn ${role === option ? 'active' : ''}`}
              onClick={() => setRole(option)}
            >
              <strong>{option}</strong>
              <span>{ROLE_HINTS[option]}</span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={mode === 'delete'}
        title="Revoke invitation"
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
                void deleteInvitationApi(active.id)
                  .then(() => {
                    setInvitations((current) => current.filter((item) => item.id !== active.id))
                    pushToast('Invitation revoked', 'info')
                    close()
                  })
                  .catch((error) =>
                    pushToast(error instanceof Error ? error.message : 'Unable to revoke invitation', 'error'),
                  )
              }}
            >
              Revoke
            </button>
          </>
        }
      >
        <p className="mb-0">Revoke access for {active?.email}? They will drop to Viewer if they already signed in.</p>
      </Modal>
    </div>
  )
}
