interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon = 'bi-inbox',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <i className={`bi ${icon}`} />
      <h5 className="mt-3 mb-1">{title}</h5>
      <p className="mb-3">{description}</p>
      {actionLabel && onAction ? (
        <button className="btn btn-accent btn-sm" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
