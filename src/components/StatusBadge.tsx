import { classNames, statusLabel } from '../utils'

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={classNames('status-badge', `status-${status.toLowerCase()}`)}>
      {statusLabel(status)}
    </span>
  )
}
