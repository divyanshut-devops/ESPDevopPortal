import { authFetch } from './http'

export interface DocNote {
  id: string
  title: string
  html: string
  preview: string
  font?: string
  size?: string
  kind?: 'file' | 'folder'
  parentId?: string | null
  updatedAt?: string
  createdAt?: string
}

export async function fetchDocs() {
  return authFetch<{ docs: DocNote[] }>('/api/docs')
}

export async function createDoc(payload: {
  title?: string
  html?: string
  font?: string
  size?: string
  kind?: 'file' | 'folder'
  parentId?: string | null
}) {
  return authFetch<{ doc: DocNote }>('/api/docs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateDocApi(
  id: string,
  payload: { title?: string; html?: string; font?: string; size?: string; parentId?: string | null },
) {
  return authFetch<{ doc: DocNote }>(`/api/docs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteDocApi(id: string) {
  return authFetch<{ ok: boolean }>(`/api/docs/${id}`, { method: 'DELETE' })
}
