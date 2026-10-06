import { formatNumber } from '../utils'

interface DashboardCardProps {
  icon: string
  label: string
  value: number | string
  hint?: string
}

export function DashboardCard({ icon, label, value, hint }: DashboardCardProps) {
  return (
    <div className="stat-card h-100">
      <div className="stat-icon">
        <i className={`bi ${icon}`} />
      </div>
      <div>
        <p>{label}</p>
        <h3>{typeof value === 'number' ? formatNumber(value) : value}</h3>
        {hint ? <small className="text-secondary">{hint}</small> : null}
      </div>
    </div>
  )
}
