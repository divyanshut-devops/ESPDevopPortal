import { authFetch } from './http'

export interface GeneratedItem {
  id: string
  kind: string
  filename: string
  language: string
  content: string
  notes: string
  prompt: string
  createdAt?: string
}

export async function generatorStatus() {
  return authFetch<{
    configured: boolean
    free?: boolean
    model?: string
    kinds: Record<string, { label: string; filename: string; language: string }>
  }>('/api/generator/status')
}

export async function fetchGeneratorHistory() {
  return authFetch<{ items: GeneratedItem[] }>('/api/generator/history')
}

export async function generateArtifact(payload: { kind: string; prompt: string }) {
  return authFetch<{ item: GeneratedItem }>('/api/generator', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteGeneratedItem(id: string) {
  return authFetch<{ ok: boolean }>(`/api/generator/history/${id}`, { method: 'DELETE' })
}
