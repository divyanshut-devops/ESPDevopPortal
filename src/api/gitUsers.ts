import { authFetch } from './http'

export type GitUserRecord = {
  id: string
  companyUser: string
  username: string
  remark: string
  updatedAt?: string
}

export type GitUserInput = Omit<GitUserRecord, 'id' | 'updatedAt'>

export async function fetchGitUsers() {
  return authFetch<{ users: GitUserRecord[] }>('/api/git-users')
}

export async function createGitUser(payload: GitUserInput) {
  return authFetch<{ user: GitUserRecord }>('/api/git-users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateGitUser(id: string, payload: GitUserInput) {
  return authFetch<{ user: GitUserRecord }>(`/api/git-users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteGitUser(id: string) {
  return authFetch<{ ok: boolean }>(`/api/git-users/${id}`, { method: 'DELETE' })
}
