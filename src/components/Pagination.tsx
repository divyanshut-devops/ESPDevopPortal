interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  compact?: boolean
}

export function Pagination({ page, totalPages, totalItems, pageSize, onPageChange, compact }: PaginationProps) {
  if (totalItems === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <div className={`pagination-bar ${compact ? 'compact' : ''}`}>
      <span>
        Showing {start}-{end} of {totalItems}
      </span>
      <div className="d-flex gap-1">
        <button
          type="button"
          className="page-btn"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <i className="bi bi-chevron-left" />
        </button>
        {pages.map((item) => (
          <button
            key={item}
            type="button"
            className={`page-btn ${item === page ? 'active' : ''}`}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          className="page-btn"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <i className="bi bi-chevron-right" />
        </button>
      </div>
    </div>
  )
}
