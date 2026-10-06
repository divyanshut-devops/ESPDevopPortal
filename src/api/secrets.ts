import { authFetch } from './http'
import type { SecretVariable } from '../types'

export interface StoredSecret {
  id: string
  name: string
  value: string
  updatedAt?: string
}

export function toSecretVariable(item: StoredSecret): SecretVariable {
  return {
    id: item.id,
    key: item.name,
    value: item.value,
    description: '',
    environment: 'Production',
    projectId: '',
  }
}

export async function fetchSecrets() {
  return authFetch<{ secrets: StoredSecret[] }>('/api/secrets')
}

export async function createSecret(payload: { name: string; value: string }) {
  return authFetch<{ secret: StoredSecret }>('/api/secrets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateSecretApi(id: string, payload: { name?: string; value?: string }) {
  return authFetch<{ secret: StoredSecret }>(`/api/secrets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteSecretApi(id: string) {
  return authFetch<{ ok: boolean }>(`/api/secrets/${id}`, {
    method: 'DELETE',
  })
}
