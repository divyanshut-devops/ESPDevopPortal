import { apiUrl, authFetch, parseResponse } from './http'

export interface DriveFile {
  key: string
  name: string
  size?: number
  updatedAt?: string
}

export async function driveStatus() {
  return authFetch<{ configured: boolean }>('/api/drive/status')
}

export async function fetchDriveFiles() {
  return authFetch<{ configured: boolean; files: DriveFile[] }>('/api/drive/files')
}

export async function saveDriveText(payload: { filename: string; content: string; contentType?: string }) {
  return authFetch<{ file: DriveFile }>('/api/drive/text', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function uploadDriveFile(file: File, filename?: string) {
  const body = new FormData()
  body.append('file', file)
  if (filename) body.append('filename', filename)
  return authFetch<{ file: DriveFile }>('/api/drive/upload', { method: 'POST', body })
}

export async function downloadDriveFile(key: string, name: string) {
  const response = await fetch(`${apiUrl('/api/drive/file')}?key=${encodeURIComponent(key)}`, {
    credentials: 'same-origin',
  })
  if (!response.ok) {
    await parseResponse(response)
    return
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function deleteDriveFile(key: string) {
  return authFetch<{ ok: boolean }>(`/api/drive/file?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
}
