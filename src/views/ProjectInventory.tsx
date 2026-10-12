'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
  type ProjectEnv,
  type ProjectInput,
  type ProjectRecord,
} from '../api/projects'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { useApp } from '../context/AppContext'

const ENV_OPTIONS: { value: ProjectEnv; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'staging', label: 'Staging' },
  { value: 'prod', label: 'Prod' },
]

const emptyForm: ProjectInput = {
  name: '',
  githubUrl: '',
  githubBranch: '',
  env: 'dev',
  techStack: '',
  deploymentMethod: '',
  domainIp: '',
  cicdEnabled: false,
  cicdTool: '',
  cicdUrl: '',
  cicdConfig: '',
  dockerEnabled: false,
  dockerImage: '',
  dockerfilePath: '',
  dockerRegistry: '',
  k8sEnabled: false,
  k8sCluster: '',
  k8sNamespace: '',
  k8sManifest: '',
  remark: '',
}

function envLabel(env: ProjectEnv) {
  return ENV_OPTIONS.find((item) => item.value === env)?.label || env
}

function yesDetail(enabled: boolean, detail: string) {
  if (!enabled) return 'No'
  return detail.trim() || 'Yes'
}

export function ProjectInventory() {
  const { can, profile, pushToast } = useApp()
  const canEdit = can('projects.view') && profile.role !== 'Viewer'
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [form, setForm] = useState<ProjectInput>(emptyForm)
  const [active, setActive] = useState<ProjectRecord | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchProjects()
      .then((data) => {
        if (!cancelled) setProjects(data.projects)
      })
      .catch((error: Error) => {
        if (!cancelled) pushToast(error.message, 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pushToast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((project) =>
      [
        project.name,
        project.githubUrl,
        project.githubBranch,
        envLabel(project.env),
        project.techStack,
        project.deploymentMethod,
        project.domainIp,
        yesDetail(project.cicdEnabled, project.cicdTool),
        project.cicdUrl,
        project.cicdConfig,
        yesDetail(project.dockerEnabled, project.dockerImage),
        yesDetail(project.k8sEnabled, project.k8sCluster),
        project.remark,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [projects, query])

  const close = () => {
    setMode(null)
    setActive(null)
    setForm(emptyForm)
  }

  const openCreate = () => {
    setActive(null)
    setForm(emptyForm)
    setMode('create')
  }

  const openEdit = (project: ProjectRecord) => {
    setActive(project)
    setForm({
      name: project.name,
      githubUrl: project.githubUrl,
      githubBranch: project.githubBranch,
      env: project.env,
      techStack: project.techStack,
      deploymentMethod: project.deploymentMethod,
      domainIp: project.domainIp,
      cicdEnabled: project.cicdEnabled,
      cicdTool: project.cicdTool,
      cicdUrl: project.cicdUrl,
      cicdConfig: project.cicdConfig,
      dockerEnabled: project.dockerEnabled,
      dockerImage: project.dockerImage,
      dockerfilePath: project.dockerfilePath,
      dockerRegistry: project.dockerRegistry,
      k8sEnabled: project.k8sEnabled,
      k8sCluster: project.k8sCluster,
      k8sNamespace: project.k8sNamespace,
      k8sManifest: project.k8sManifest,
      remark: project.remark,
    })
    setMode('edit')
  }

  const setField = (key: keyof ProjectInput, value: string | boolean) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'cicdEnabled' && value === false) {
        next.cicdTool = ''
        next.cicdUrl = ''
        next.cicdConfig = ''
      }
      if (key === 'dockerEnabled' && value === false) {
        next.dockerImage = ''
        next.dockerfilePath = ''
        next.dockerRegistry = ''
      }
      if (key === 'k8sEnabled' && value === false) {
        next.k8sCluster = ''
        next.k8sNamespace = ''
        next.k8sManifest = ''
      }
      return next
    })
  }

  const save = async () => {
    if (!form.name.trim()) {
      pushToast('Project name is required', 'warning')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, name: form.name.trim() }
      if (mode === 'edit' && active) {
        const data = await updateProject(active.id, payload)
        setProjects((items) => items.map((item) => (item.id === active.id ? data.project : item)))
        pushToast('Project updated')
      } else {
        const data = await createProject(payload)
        setProjects((items) => [data.project, ...items])
        pushToast('Project added')
      }
      close()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to save project', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!active) return
    setSaving(true)
    try {
      await deleteProject(active.id)
      setProjects((items) => items.filter((item) => item.id !== active.id))
      pushToast('Project deleted')
      close()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Unable to delete project', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h2 className="page-title mb-1">My Projects</h2>
          <p className="text-muted mb-0">Add, edit, and delete projects in this table.</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn-accent" onClick={openCreate}>
            + Add project
          </button>
        ) : null}
      </div>

      <input
        className="form-control"
        placeholder="Search name, GitHub, domain, stack..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {loading ? (
        <p className="text-muted mb-0">Loading projects…</p>
      ) : (
        <DataTable
          data={filtered}
          rowKey={(row) => row.id}
          emptyTitle={projects.length === 0 ? 'No projects yet' : 'No projects match this search'}
          emptyDescription={projects.length === 0 ? 'Add a project to start the register.' : 'Try a different search.'}
          columns={[
            { key: 'name', label: 'Project', sortable: true },
            { key: 'githubUrl', label: 'GitHub URL', sortable: true },
            { key: 'githubBranch', label: 'Branch', sortable: true },
            { key: 'env', label: 'Env', sortable: true, render: (row) => envLabel(row.env) },
            { key: 'techStack', label: 'Tech stack', sortable: true },
            { key: 'deploymentMethod', label: 'Deployment', sortable: true },
            { key: 'domainIp', label: 'Domain / IP', sortable: true },
            { key: 'cicd', label: 'CI/CD', render: (row) => yesDetail(row.cicdEnabled, row.cicdTool) },
            { key: 'docker', label: 'Docker', render: (row) => yesDetail(row.dockerEnabled, row.dockerImage) },
            { key: 'k8s', label: 'K8s', render: (row) => yesDetail(row.k8sEnabled, row.k8sCluster) },
            { key: 'remark', label: 'Remark' },
          ]}
          actions={
            canEdit
              ? (row) => (
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setActive(row)
                        setMode('delete')
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )
              : undefined
          }
        />
      )}

      <Modal
        open={mode === 'create' || mode === 'edit'}
        title={mode === 'edit' ? 'Edit project' : 'Add project'}
        onClose={close}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-accent" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label">Project name</label>
            <input className="form-control" value={form.name} onChange={(event) => setField('name', event.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Env</label>
            <select className="form-select" value={form.env} onChange={(event) => setField('env', event.target.value)}>
              {ENV_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-8">
            <label className="form-label">GitHub URL</label>
            <input className="form-control" value={form.githubUrl} onChange={(event) => setField('githubUrl', event.target.value)} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">GitHub branch</label>
            <input className="form-control" value={form.githubBranch} onChange={(event) => setField('githubBranch', event.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Tech stack</label>
            <input className="form-control" value={form.techStack} onChange={(event) => setField('techStack', event.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Deployment method</label>
            <input className="form-control" value={form.deploymentMethod} onChange={(event) => setField('deploymentMethod', event.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Domain / IP</label>
            <input className="form-control" value={form.domainIp} onChange={(event) => setField('domainIp', event.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">CI/CD pipeline</label>
            <select
              className="form-select"
              value={form.cicdEnabled ? 'yes' : 'no'}
              onChange={(event) => setField('cicdEnabled', event.target.value === 'yes')}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {form.cicdEnabled ? (
            <>
              <div className="col-12 col-md-4">
                <label className="form-label">CI/CD tool</label>
                <input className="form-control" value={form.cicdTool} onChange={(event) => setField('cicdTool', event.target.value)} placeholder="GitHub Actions" />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Pipeline URL</label>
                <input className="form-control" value={form.cicdUrl} onChange={(event) => setField('cicdUrl', event.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Workflow file</label>
                <input className="form-control" value={form.cicdConfig} onChange={(event) => setField('cicdConfig', event.target.value)} placeholder=".github/workflows/deploy.yml" />
              </div>
            </>
          ) : null}
          <div className="col-12 col-md-6">
            <label className="form-label">Docker</label>
            <select
              className="form-select"
              value={form.dockerEnabled ? 'yes' : 'no'}
              onChange={(event) => setField('dockerEnabled', event.target.value === 'yes')}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Kubernetes</label>
            <select
              className="form-select"
              value={form.k8sEnabled ? 'yes' : 'no'}
              onChange={(event) => setField('k8sEnabled', event.target.value === 'yes')}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {form.dockerEnabled ? (
            <>
              <div className="col-12 col-md-4">
                <label className="form-label">Docker image</label>
                <input className="form-control" value={form.dockerImage} onChange={(event) => setField('dockerImage', event.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Dockerfile path</label>
                <input className="form-control" value={form.dockerfilePath} onChange={(event) => setField('dockerfilePath', event.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Registry</label>
                <input className="form-control" value={form.dockerRegistry} onChange={(event) => setField('dockerRegistry', event.target.value)} />
              </div>
            </>
          ) : null}
          {form.k8sEnabled ? (
            <>
              <div className="col-12 col-md-4">
                <label className="form-label">Cluster</label>
                <input className="form-control" value={form.k8sCluster} onChange={(event) => setField('k8sCluster', event.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Namespace</label>
                <input className="form-control" value={form.k8sNamespace} onChange={(event) => setField('k8sNamespace', event.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Manifest / chart</label>
                <input className="form-control" value={form.k8sManifest} onChange={(event) => setField('k8sManifest', event.target.value)} />
              </div>
            </>
          ) : null}
          <div className="col-12">
            <label className="form-label">Remark</label>
            <textarea className="form-control" rows={3} value={form.remark} onChange={(event) => setField('remark', event.target.value)} />
          </div>
        </div>
      </Modal>

      <Modal
        open={mode === 'delete'}
        title="Delete project"
        onClose={close}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-accent" onClick={() => void remove()} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="mb-0">Delete {active?.name || 'this project'}? This cannot be undone.</p>
      </Modal>
    </div>
  )
}
