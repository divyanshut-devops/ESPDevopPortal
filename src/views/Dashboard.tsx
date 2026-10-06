'use client'

import { DashboardCard } from '../components/DashboardCard'
import { useApp } from '../context/AppContext'

export function Dashboard() {
  const { projects, collections, servers } = useApp()
  const activeConnections = servers.filter((server) => server.status === 'online').length

  return (
    <div className="d-flex flex-column gap-4">
      <section className="welcome-banner">
        <p className="page-kicker mb-2">ESP PLATFORM</p>
        <h1>Welcome to ESP DevOps Portal</h1>
        <p>
          Manage your projects, infrastructure, secrets, API tools and server access from one
          centralized workspace.
        </p>
      </section>

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl">
          <DashboardCard icon="bi-folder2-open" label="Total Projects" value={projects.length} hint="Across all environments" />
        </div>
        <div className="col-12 col-sm-6 col-xl">
          <DashboardCard icon="bi-hdd" label="Servers" value={servers.length} hint={`${activeConnections} online`} />
        </div>
        <div className="col-12 col-sm-6 col-xl">
          <DashboardCard icon="bi-layers" label="Environments" value={3} hint="Dev / Staging / Prod" />
        </div>
        <div className="col-12 col-sm-6 col-xl">
          <DashboardCard
            icon="bi-collection"
            label="API Collections"
            value={collections.length}
            hint={`${collections.reduce((sum, item) => sum + item.requests.length, 0)} requests`}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl">
          <DashboardCard icon="bi-broadcast" label="Active Connections" value={activeConnections} hint="Mock SSH sessions" />
        </div>
      </div>
    </div>
  )
}
