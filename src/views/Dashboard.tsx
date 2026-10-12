'use client'

import { DashboardCard } from '../components/DashboardCard'
import { useApp } from '../context/AppContext'

export function Dashboard() {
  const { projects } = useApp()
  const environments = new Set(projects.map((project) => project.env)).size

  return (
    <div className="d-flex flex-column gap-4">
      <section className="welcome-banner">
        <p className="page-kicker mb-2">ESP PLATFORM</p>
        <h1>Welcome to ESP DevOps Portal</h1>
        <p>
          Manage your projects, infrastructure, and secrets from one workspace.
        </p>
      </section>

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl">
          <DashboardCard icon="bi-folder2-open" label="Total Projects" value={projects.length} hint="Across all environments" />
        </div>
        <div className="col-12 col-sm-6 col-xl">
          <DashboardCard icon="bi-layers" label="Environments" value={environments} hint="Dev / Staging / Prod" />
        </div>
      </div>
    </div>
  )
}
