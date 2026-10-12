import { authFetch } from './http'
import type { SecretVariable } from '../types'

export type SecretEnv = 'dev' | 'staging' | 'prod'

export interface StoredSecret {
  id: string
  name: string
  env?: SecretEnv
  remark?: string
  value?: string
  updatedAt?: string
}

export function toSecretVariable(item: StoredSecret): SecretVariable {
  const environment = item.env === 'staging' || item.env === 'prod' || item.env === 'dev' ? item.env : 'dev'
  return {
    id: item.id,
    key: item.name,
    value: item.value || '',
    environment,
    remark: item.remark || '',
  }
}

export async function fetchSecrets() {
  return authFetch<{ secrets: StoredSecret[] }>('/api/secrets')
}

export async function createSecret(payload: { name: string; value: string; env: SecretEnv; remark: string }) {
  return authFetch<{ secret: StoredSecret }>('/api/secrets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateSecretApi(id: string, payload: { name?: string; value?: string; env?: SecretEnv; remark?: string }) {
  return authFetch<{ secret: StoredSecret }>(`/api/secrets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function revealSecret(id: string) {
  return authFetch<{ value: string }>(`/api/secrets/${id}/reveal`, { method: 'POST' })
}

export async function deleteSecretApi(id: string) {
  return authFetch<{ ok: boolean }>(`/api/secrets/${id}`, {
    method: 'DELETE',
  })
}
