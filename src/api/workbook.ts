import { authFetch } from './http'

export type CellStyle = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  font?: string
  size?: number
  color?: string
  bg?: string
  align?: 'left' | 'center' | 'right'
}

export type WorkbookSheet = {
  id: string
  name: string
  rows: string[][]
  styles?: Record<string, CellStyle>
}

export type ProjectWorkbook = {
  sheets: WorkbookSheet[]
  activeId: string
  updatedAt?: string
}

export async function fetchWorkbook() {
  return authFetch<{ workbook: ProjectWorkbook }>('/api/workbook')
}

export async function saveWorkbook(payload: { sheets: WorkbookSheet[]; activeId: string }) {
  return authFetch<{ workbook: ProjectWorkbook }>('/api/workbook', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
