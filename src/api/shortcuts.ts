import { authFetch } from './http'
import type { Shortcut } from '../types'

export function publicShortcut(item: {
  id: string
  name: string
  description?: string
  category?: string
  url: string
  icon?: string
}): Shortcut {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    category: item.category || 'Work',
    url: item.url,
    icon: item.icon || 'bi-link-45deg',
  }
}

export async function fetchShortcuts() {
  return authFetch<{ shortcuts: Shortcut[] }>('/api/shortcuts')
}

export async function createShortcut(payload: Omit<Shortcut, 'id'>) {
  return authFetch<{ shortcut: Shortcut }>('/api/shortcuts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateShortcutApi(id: string, payload: Omit<Shortcut, 'id'>) {
  return authFetch<{ shortcut: Shortcut }>(`/api/shortcuts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteShortcutApi(id: string) {
  return authFetch<{ ok: boolean }>(`/api/shortcuts/${id}`, { method: 'DELETE' })
}
