import { authFetch } from './http'

export interface ArchNode {
  id: string
  kind: string
  label: string
  x: number
  y: number
  w: number
  h: number
  color: string
}

export interface ArchEdge {
  id: string
  from: string
  to: string
  label: string
}

export interface ArchStroke {
  id: string
  color: string
  points: { x: number; y: number }[]
}

export interface ArchNote {
  id: string
  text: string
  x: number
  y: number
}

export interface ArchitectureBoard {
  title: string
  nodes: ArchNode[]
  edges: ArchEdge[]
  strokes: ArchStroke[]
  notes: ArchNote[]
  updatedAt?: string
}

export async function fetchArchitecture() {
  return authFetch<{ board: ArchitectureBoard }>('/api/architecture')
}

export async function saveArchitecture(board: ArchitectureBoard) {
  return authFetch<{ board: ArchitectureBoard }>('/api/architecture', {
    method: 'PUT',
    body: JSON.stringify(board),
  })
}
