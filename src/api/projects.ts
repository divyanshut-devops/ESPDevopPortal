import { authFetch } from './http'

export type ProjectEnv = 'dev' | 'staging' | 'prod'

export type ProjectRecord = {
  id: string
  name: string
  githubUrl: string
  githubBranch: string
  env: ProjectEnv
  techStack: string
  deploymentMethod: string
  domainIp: string
  cicdEnabled: boolean
  cicdTool: string
  cicdUrl: string
  cicdConfig: string
  dockerEnabled: boolean
  dockerImage: string
  dockerfilePath: string
  dockerRegistry: string
  k8sEnabled: boolean
  k8sCluster: string
  k8sNamespace: string
  k8sManifest: string
  remark: string
  updatedAt?: string
}

export type ProjectInput = Omit<ProjectRecord, 'id' | 'updatedAt'>

export async function fetchProjects() {
  return authFetch<{ projects: ProjectRecord[] }>('/api/projects')
}

export async function createProject(payload: ProjectInput) {
  return authFetch<{ project: ProjectRecord }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateProject(id: string, payload: ProjectInput) {
  return authFetch<{ project: ProjectRecord }>(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteProject(id: string) {
  return authFetch<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' })
}
