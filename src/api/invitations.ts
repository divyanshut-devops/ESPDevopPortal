import { authFetch } from './http'
import type { Invitation, WorkspaceRole } from '../types'

export async function fetchInvitations() {
  return authFetch<{ invitations: Invitation[] }>('/api/invitations')
}

export async function createInvitation(payload: { email: string; role: WorkspaceRole }) {
  return authFetch<{ invitation: Invitation }>('/api/invitations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateInvitationApi(id: string, payload: { role: WorkspaceRole }) {
  return authFetch<{ invitation: Invitation }>(`/api/invitations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function resendInvitationApi(id: string) {
  return authFetch<{ invitation: Invitation; message?: string }>(`/api/invitations/${id}/resend`, {
    method: 'POST',
  })
}

export async function deleteInvitationApi(id: string) {
  return authFetch<{ ok: boolean }>(`/api/invitations/${id}`, { method: 'DELETE' })
}
